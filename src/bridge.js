// Puente en la página (world: MAIN): expone a Whazaa unas pocas funciones de
// WA-JS para mandar mensajes al instante, a cualquier chat (aunque no esté abierto),
// y mostrar "escribiendo…" / "grabando audio…" el tiempo que quieras.
(() => {
  if (window.__hzBridge) return;
  window.__hzBridge = true;

  const W = () => window.WPP;
  const ready = () => !!(W() && W().isReady);
  const ser = (x) => (typeof x === 'string' ? x : x && x._serialized);
  const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const titleOf = (c) =>
    c.formattedTitle || c.name || (c.contact && (c.contact.name || c.contact.formattedName || c.contact.pushname)) || (c.id && c.id.user) || '';
  const SEND = { createChat: true, waitForAck: false, markIsRead: false };
  // mensajes que no son de una persona (avisos de cifrado, llamadas, sistema)
  const SYSTEM = new Set(['e2e_notification', 'notification_template', 'notification', 'gp2', 'call_log', 'protocol', 'ciphertext', 'broadcast_notification', 'debug']);
  const isUser = (m) => m && !SYSTEM.has(m.type) && !m.isNotification;

  // Parche de compatibilidad: algunas versiones de WhatsApp Web ya no tienen
  // UserPrefs.getMeLidUserOrThrow y WA-JS falla con
  // "n.UserPrefs.getMeLidUserOrThrow is not a function". La recreamos con las
  // funciones equivalentes que sí existen (mismo método que usa WA-JS para otras).
  let patched = null;
  function patchUserPrefs() {
    try {
      const U = W() && W().whatsapp && W().whatsapp.UserPrefs;
      if (!U || typeof U.getMeLidUserOrThrow === 'function') return;
      const pick = (...names) => names.map((n) => U[n]).find((f) => typeof f === 'function');
      const lid = pick('getMaybeMeLidUser', 'getMeLidUser', 'getMaybeMeLid');
      const pn = pick('getMaybeMePnUser', 'getMaybeMeUser', 'getMeUser');
      Object.defineProperty(U, 'getMeLidUserOrThrow', {
        configurable: true,
        writable: true,
        value() {
          const l = lid && lid.call(U);
          if (l) return l;
          const p = pn && pn.call(U);
          if (p) return p;
          throw new Error('WhatsApp no informa tu usuario todavía');
        }
      });
      patched = 'getMeLidUserOrThrow';
    } catch (_) {}
  }

  const M = {
    status() {
      if (ready()) patchUserPrefs();
      let auth = null;
      try { auth = ready() && W().conn && W().conn.isAuthenticated ? !!W().conn.isAuthenticated() : null; } catch (_) {}
      return { ready: ready(), auth, version: W() && W().version, patched };
    },
    activeChat() {
      const c = W().chat.getActiveChat();
      return c ? { id: ser(c.id), name: titleOf(c), group: !!c.isGroup } : null;
    },
    async presence(chatId, kind, ms) {
      if (kind === 'recording') await W().chat.markIsRecording(chatId, ms);
      else if (kind === 'composing') await W().chat.markIsComposing(chatId, ms);
      else await W().chat.markIsPaused(chatId);
      return true;
    },
    async sendText(chatId, text) {
      await W().chat.sendTextMessage(chatId, text, { ...SEND, linkPreview: false });
      return true;
    },
    async sendFile(chatId, dataUrl, opts) {
      await W().chat.sendFileMessage(chatId, dataUrl, { ...SEND, ...opts });
      return true;
    },
    async sendContact(chatId, phone, name) {
      await W().chat.sendVCardContactMessage(chatId, { id: digits(phone) + '@c.us', name });
      return true;
    },
    async findChat(name, phone) {
      const list = await W().chat.list();
      const n = norm(name);
      const d = digits(phone || (/^[+\d\s()-]{8,}$/.test(name || '') ? name : ''));
      let c = n && list.find((x) => norm(titleOf(x)) === n);
      if (!c && d) c = list.find((x) => x.id && x.id.user && (x.id.user.endsWith(d.slice(-10)) || d.endsWith(x.id.user)));
      if (c) return { id: ser(c.id), name: titleOf(c), group: !!c.isGroup };
      if (d.length >= 8) return { id: d + '@c.us', name: name || phone, group: false };
      return null;
    },
    async openChat(chatId) {
      await W().chat.openChatBottom(chatId);
      return true;
    },
    // Historial real desde `fromMs`: mensajes de cada chat con actividad y si
    // la conversación ya existía antes (para separar nuevas de existentes).
    async history(fromMs, maxChats = 400) {
      const fromS = Math.floor(fromMs / 1000);
      const list = await W().chat.list();
      const chats = list
        .filter((c) => (c.t || 0) >= fromS && c.id && c.id.server !== 'broadcast' && ser(c.id) !== 'status@broadcast')
        .sort((a, b) => (b.t || 0) - (a.t || 0))
        .slice(0, maxChats);
      const out = [];
      for (const c of chats) {
        const id = ser(c.id);
        let msgs = [];
        let reachedStart = false;
        let anchor = null;
        try {
          for (let page = 0; page < 10; page++) {
            const batch = await W().chat.getMessages(id, anchor ? { count: 100, direction: 'before', id: anchor } : { count: 100 });
            if (!batch || !batch.length) { reachedStart = true; break; }
            batch.sort((a, b) => a.t - b.t);
            msgs = batch.concat(msgs);
            if (batch.some((m) => isUser(m) && m.t < fromS)) break;
            if (batch.length < 100) { reachedStart = true; break; }
            anchor = ser(batch[0].id);
          }
        } catch (_) { continue; }
        const user = msgs.filter(isUser);
        const first = user[0];
        out.push({
          name: titleOf(c),
          id,
          group: !!c.isGroup,
          hasBefore: user.some((m) => m.t < fromS),
          firstAt: reachedStart && first ? first.t * 1000 : null,
          msgs: user.filter((m) => m.t >= fromS).map((m) => [ser(m.id), m.t * 1000, m.id && m.id.fromMe ? 1 : 0])
        });
        await new Promise((r) => setTimeout(r, 0));
      }
      return out;
    },
    // Etiquetas de WhatsApp Business: todas + las de cada chat
    async labels() {
      if (!W().labels) return { supported: false, all: [], chats: [] };
      let all = [];
      try { all = await W().labels.getAllLabels(); } catch (_) { return { supported: false, all: [], chats: [] }; }
      const chats = await W().chat.list();
      return {
        supported: true,
        all: (all || []).map((l) => ({ id: String(l.id), name: l.name, color: l.hexColor || '#8696a0' })),
        chats: chats.filter((c) => c.labels && c.labels.length).map((c) => ({ name: titleOf(c), id: ser(c.id), labels: c.labels.map(String) }))
      };
    },
    async setLabel(chatId, labelId, add) {
      await W().labels.addOrRemoveLabels([chatId], [{ labelId: String(labelId), type: add ? 'add' : 'remove' }]);
      return true;
    },
    async newLabel(name, color) {
      const l = await W().labels.addNewLabel(name, color ? { labelColor: color } : undefined);
      return l ? { id: String(l.id), name: l.name, color: l.hexColor || color || '#8696a0' } : null;
    },
    async labelPalette() {
      try { return await W().labels.getLabelColorPalette(); } catch (_) { return []; }
    }
  };

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.__hz !== 'rpc') return;
    const { id, method, args } = e.data;
    try {
      if (!Object.prototype.hasOwnProperty.call(M, method)) throw new Error('método desconocido');
      if (method !== 'status' && !ready()) throw new Error('El motor rápido todavía no está listo');
      if (method !== 'status') patchUserPrefs();
      const result = await M[method](...(args || []));
      window.postMessage({ __hz: 'rpcres', id, ok: true, result }, '*');
    } catch (err) {
      window.postMessage({ __hz: 'rpcres', id, ok: false, error: String((err && err.message) || err) }, '*');
    }
  });
})();
