// Puente en la página (world: MAIN): expone a HotZapp unas pocas funciones de
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

  const M = {
    status() {
      let auth = null;
      try { auth = ready() && W().conn && W().conn.isAuthenticated ? !!W().conn.isAuthenticated() : null; } catch (_) {}
      return { ready: ready(), auth, version: W() && W().version };
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
    async labels() {
      if (!W().labels) return [];
      let all = [];
      try { all = await W().labels.getAllLabels(); } catch (_) { return []; }
      if (!all || !all.length) return [];
      const byId = Object.fromEntries(all.map((l) => [String(l.id), l]));
      const chats = await W().chat.list();
      return chats
        .filter((c) => c.labels && c.labels.length)
        .map((c) => ({
          name: titleOf(c),
          labels: c.labels.map((id) => byId[String(id)]).filter(Boolean).map((l) => ({ name: l.name, color: l.hexColor || '#8696a0' }))
        }));
    }
  };

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.__hz !== 'rpc') return;
    const { id, method, args } = e.data;
    try {
      if (!Object.prototype.hasOwnProperty.call(M, method)) throw new Error('método desconocido');
      if (method !== 'status' && !ready()) throw new Error('El motor rápido todavía no está listo');
      const result = await M[method](...(args || []));
      window.postMessage({ __hz: 'rpcres', id, ok: true, result }, '*');
    } catch (err) {
      window.postMessage({ __hz: 'rpcres', id, ok: false, error: String((err && err.message) || err) }, '*');
    }
  });
})();
