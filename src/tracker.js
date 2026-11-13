// Registro de conversaciones para las estadísticas.
//
// WhatsApp no guarda estadísticas de tiempos de respuesta en cuentas normales,
// así que Whazaa las mide mientras WhatsApp Web está abierto, con dos fuentes:
//  1) La lista de chats: detecta cuándo entra un mensaje nuevo (cambia la hora,
//     aparece el contador de no leídos) y si el último mensaje es tuyo (tildes).
//  2) El chat abierto: lee cada mensaje con su hora exacta y si es tuyo o del
//     cliente (atributos data-id y data-pre-plain-text de WhatsApp Web).
// Todo se guarda en chrome.storage.local bajo la clave "track".
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const wa = HZ.wa;

  const KEEP_DAYS = 120;
  const MIN = 60000;
  const DAY = 86400000;
  let track = {}; // { [nombre]: { g: esGrupo, ev: { [id]: [t, out] }, alertedFor, firstAt, before } }
  let meta = { start: 0, synced: 0 }; // start = desde cuándo mide Whazaa; synced = última lectura del historial
  let dirty = false;
  const writeId = Math.random().toString(36).slice(2);
  const listState = {}; // firma de cada fila de la lista
  let seenOpen = null; // último chat abierto ya leído

  // ---------- fechas ----------
  const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const WEEKDAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const TIME_RE = /^(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s?m\.?)?$/i;

  function hm(h, m, ap) {
    h = +h;
    if (ap) {
      ap = ap.toLowerCase();
      if (ap === 'p' && h < 12) h += 12;
      if (ap === 'a' && h === 12) h = 0;
    }
    return [h, +m];
  }
  function dayOrder(a, b) {
    if (a > 12) return 'dm';
    if (b > 12) return 'md';
    return /^en-us/i.test(navigator.language) ? 'md' : 'dm';
  }
  function ymd(p1, p2, p3) {
    let y, mo, d;
    if (String(p1).length === 4) [y, mo, d] = [+p1, +p2, +p3];
    else {
      const o = dayOrder(+p1, +p2);
      [d, mo] = o === 'dm' ? [+p1, +p2] : [+p2, +p1];
      y = +p3 < 100 ? 2000 + +p3 : +p3;
    }
    return [y, mo, d];
  }

  // "[11:30, 13/11/2026] Juan: "  /  "[10:05 a. m., 13/11/2026] Juan: "
  function parsePre(s) {
    const m = /\[(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s?m?\.?,\s*(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})\]/i.exec(s || '');
    if (!m) return null;
    const [h, mi] = hm(m[1], m[2], m[3]);
    const [y, mo, d] = ymd(m[4], m[5], m[6]);
    const t = new Date(y, mo - 1, d, h, mi).getTime();
    return isNaN(t) ? null : t;
  }

  // Hora de la lista de chats: "11:33", "ayer", "lunes", "12/11/2026"
  function parseListLabel(label) {
    const s = (label || '').trim().toLowerCase();
    if (!s) return null;
    const now = new Date();
    let m = TIME_RE.exec(s);
    if (m) {
      const [h, mi] = hm(m[1], m[2], m[3]);
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, mi).getTime();
      return t > Date.now() + MIN ? t - DAY : t;
    }
    if (s === 'ayer' || s === 'yesterday') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12).getTime();
    let wd = WEEKDAYS.indexOf(s);
    if (wd < 0) wd = WEEKDAYS_EN.indexOf(s);
    if (wd >= 0) {
      const diff = (now.getDay() - wd + 7) % 7 || 7;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 12).getTime();
    }
    m = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/.exec(s);
    if (m) {
      const [y, mo, d] = ymd(m[1], m[2], m[3]);
      return new Date(y, mo - 1, d, 12).getTime();
    }
    return null;
  }
  const isListLabel = (s) => parseListLabel(s) !== null;

  // ---------- almacenamiento ----------
  async function load() {
    const r = await chrome.storage.local.get('track');
    track = (r.track && r.track.chats) || {};
    meta = { start: 0, synced: 0, ...((r.track && r.track.meta) || {}) };
    if (!meta.start) { meta.start = Date.now(); dirty = true; }
  }
  async function flush() {
    if (!dirty) return;
    dirty = false;
    const cutoff = Date.now() - KEEP_DAYS * DAY;
    for (const rec of Object.values(track)) {
      for (const [id, e] of Object.entries(rec.ev)) if (e[0] < cutoff) delete rec.ev[id];
    }
    await chrome.storage.local.set({ track: { w: writeId, chats: track, meta } });
  }
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.track && (!ch.track.newValue || ch.track.newValue.w !== writeId)) load();
  });

  const rec = (name) => (track[name] ||= { g: false, ev: {} });
  function add(name, id, t, out, group) {
    if (!name || !t) return;
    const r = rec(name);
    if (group) r.g = true;
    const cur = r.ev[id];
    if (cur && cur[0] === t && cur[1] === out) return;
    r.ev[id] = [t, out ? 1 : 0];
    dirty = true;
  }

  // ---------- 2) chat abierto: mensajes con hora exacta ----------
  function rowTime(row) {
    for (const el of row.querySelectorAll('span,div')) {
      if (el.children.length) continue;
      const tx = (el.textContent || '').trim();
      if (TIME_RE.test(tx)) return tx;
    }
    return null;
  }
  function harvestOpen() {
    const main = document.querySelector('#main');
    const name = wa.chatTitle();
    if (!main || !name) { seenOpen = null; return; }
    const rows = [...main.querySelectorAll('[data-id]')].filter((r) => !r.parentElement.closest('[data-id]'));
    let lastT = null;
    let minT = Infinity;
    const found = [];
    for (const row of rows) {
      const id = row.getAttribute('data-id') || '';
      const m = /^(true|false)_/.exec(id);
      if (!m) continue;
      const out = m[1] === 'true';
      const group = id.includes('@g.us');
      if (id.includes('status@broadcast')) continue;
      const pre = row.querySelector('[data-pre-plain-text]');
      let t = pre ? parsePre(pre.getAttribute('data-pre-plain-text')) : null;
      if (!t && lastT) {
        // audios, fotos, stickers: no traen fecha; usamos la hora de la burbuja y el día del mensaje anterior
        const tl = rowTime(row);
        const mm = tl && TIME_RE.exec(tl);
        if (mm) {
          const d = new Date(lastT);
          const [h, mi] = hm(mm[1], mm[2], mm[3]);
          t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi).getTime();
          if (t < lastT) t = lastT;
        }
      }
      if (!t) continue;
      lastT = t;
      minT = Math.min(minT, t);
      found.push([id, t, out, group]);
    }
    if (!found.length) return;
    const r = rec(name);
    const live = seenOpen === name; // el chat ya estaba abierto: lo nuevo está pasando ahora
    seenOpen = name;
    // lo que vino de la lista y ya está cubierto por el historial real, se reemplaza,
    // pero conservamos su hora (más precisa que el minuto que muestra WhatsApp)
    const synth = [];
    for (const [id, e] of Object.entries(r.ev)) if (id[0] === 'L' && e[0] >= minT - MIN) { synth.push(e); delete r.ev[id]; dirty = true; }
    for (let [id, t, out, group] of found) {
      if (!r.ev[id]) {
        const k = synth.findIndex((e) => !!e[1] === out && Math.abs(e[0] - t) <= 2 * MIN);
        if (k >= 0) t = synth.splice(k, 1)[0][0];
        else if (live && Math.abs(Date.now() - t) <= 2 * MIN) t = Date.now();
      } else t = r.ev[id][0];
      add(name, id, t, out, group);
    }
  }

  // ---------- 1) lista de chats ----------
  function scanList() {
    const pane = document.querySelector('#pane-side');
    if (!pane) return;
    const open = wa.chatTitle();
    const rows = new Set();
    pane.querySelectorAll('span[title]').forEach((s) => {
      const row = s.closest('[role="listitem"],[role="row"]');
      if (row) rows.add(row);
    });
    for (const row of rows) {
      const tEl = row.querySelector('span[title]');
      const name = tEl && tEl.getAttribute('title');
      if (!name) continue;
      let label = null;
      for (const el of row.querySelectorAll('span,div')) {
        if (el.children.length) continue;
        const tx = (el.textContent || '').trim();
        if (tx && tx !== name && tx.length < 14 && isListLabel(tx)) { label = tx; break; }
      }
      let unread = 0;
      const badge = [...row.querySelectorAll('[aria-label]')].find((el) => /(no le[ií]d|unread)/i.test(el.getAttribute('aria-label')));
      if (badge) unread = parseInt(badge.textContent, 10) || 1;
      const mine = !unread && !!row.querySelector('[data-icon*="check"],[data-icon="status-time"],[data-icon="msg-time"]');
      const group = !!row.querySelector('[data-icon*="group"]');
      const sig = `${label}|${unread}|${mine}`;
      const prev = listState[name];
      listState[name] = { sig, unread, mine, label };
      if (prev && prev.sig === sig) continue;
      if (name === open) continue; // el chat abierto se lee con precisión
      let t = parseListLabel(label);
      if (!t) continue;
      // si cambió mientras lo estamos mirando, la hora real es "ahora"
      if (prev && TIME_RE.test(label || '') && Math.abs(Date.now() - t) < 2 * MIN) t = Date.now();
      const r = track[name];
      if (!prev && r && Object.values(r.ev).some((e) => e[0] >= t - MIN)) continue; // ya lo teníamos
      add(name, `L${t}${mine ? 'o' : 'i'}`, t, mine, group);
      if (prev && !mine && unread > (prev.unread || 0) && unread - (prev.unread || 0) > 1) {
        for (let k = 1; k < unread - (prev.unread || 0); k++) add(name, `L${t}i${k}`, t, false, group);
      }
    }
  }

  // ---------- consultas ----------
  const includeGroups = () => app.state.settings.statsGroups;
  function sortedEvents(r) {
    return Object.values(r.ev).sort((a, b) => a[0] - b[0]);
  }

  // Cuándo empezó realmente la conversación:
  //  · firstAt: el historial de WhatsApp llegó hasta el primer mensaje
  //  · before: sabemos que había mensajes antes de esa fecha
  //  · si no, el primer mensaje que vimos; si es de cuando se instaló Whazaa, se
  //    toma como conversación que ya existía.
  function firstOf(r, evs) {
    if (r.firstAt) return r.firstAt;
    if (r.before) return Math.min(r.before - 1, evs.length ? evs[0][0] : Infinity);
    const mn = evs.length ? evs[0][0] : Infinity;
    if (mn <= (meta.start || 0) + 5 * MIN) return -Infinity;
    return mn;
  }

  // Quién está esperando respuesta ahora
  function waiting() {
    const out = [];
    for (const [name, r] of Object.entries(track)) {
      if (r.g && !includeGroups()) continue;
      const ls = listState[name];
      if (ls && ls.mine) continue;
      const evs = sortedEvents(r);
      if (!evs.length || evs[evs.length - 1][1]) continue;
      let since = evs[evs.length - 1][0];
      for (let i = evs.length - 1; i >= 0 && !evs[i][1]; i--) since = evs[i][0];
      out.push({ name, since, wait: Date.now() - since });
    }
    return out.sort((a, b) => b.wait - a.wait);
  }

  // Para hacer seguimiento: el último mensaje es tuyo y el cliente no contesta
  // hace más de `minMs` (por defecto 1 hora). Se excluyen Cerrado y Perdido.
  const CLOSED = new Set(['cerrado', 'perdido']);
  function followups(minMs) {
    const out = [];
    const now = Date.now();
    for (const [name, r] of Object.entries(track)) {
      if (r.g && !includeGroups()) continue;
      const c = app.state.contacts[name];
      if (c && CLOSED.has(c.stageId)) continue;
      const ls = listState[name];
      if (ls && ls.unread) continue;
      const evs = sortedEvents(r);
      const last = evs[evs.length - 1];
      if (!last || !last[1]) continue;
      const wait = now - last[0];
      if (wait >= minMs && wait <= 30 * DAY) out.push({ name, since: last[0], wait });
    }
    return out.sort((a, b) => a.wait - b.wait);
  }

  // Estadísticas de un período [from, to]
  function compute(from, to) {
    const chats = [];
    const rts = [];
    for (const [name, r] of Object.entries(track)) {
      if (r.g && !includeGroups()) continue;
      const evs = sortedEvents(r);
      if (!evs.length) continue;
      const inP = evs.filter((e) => e[0] >= from && e[0] <= to);
      let waitStart = null;
      const chatRts = [];
      for (const [t, o] of evs) {
        if (t > to) break;
        if (!o) { if (waitStart === null) waitStart = t; }
        else if (waitStart !== null) {
          if (t >= from) chatRts.push(t - waitStart);
          waitStart = null;
        }
      }
      if (!inP.length) continue;
      const received = inP.filter((e) => !e[1]).length;
      const sent = inP.length - received;
      const firstIn = inP.find((e) => !e[1]);
      const answered = firstIn ? inP.some((e) => e[1] && e[0] >= firstIn[0]) : null;
      const pending = waitStart !== null;
      rts.push(...chatRts);
      const first = firstOf(r, evs);
      const isNew = first >= from && first <= to;
      chats.push({
        name, received, sent,
        isNew,
        startedBy: isNew ? (inP[0][1] ? 'me' : 'client') : null,
        answered, pending,
        pendingSince: pending ? waitStart : null,
        avgRt: chatRts.length ? chatRts.reduce((a, b) => a + b, 0) / chatRts.length : null,
        maxRt: chatRts.length ? Math.max(...chatRts) : null,
        last: inP[inP.length - 1][0]
      });
    }
    const sorted = [...rts].sort((a, b) => a - b);
    const withIn = chats.filter((c) => c.received > 0);
    return {
      from, to,
      conversations: chats.length,
      newConversations: chats.filter((c) => c.isNew).length,
      newByClient: chats.filter((c) => c.startedBy === 'client').length,
      newByMe: chats.filter((c) => c.startedBy === 'me').length,
      existingConversations: chats.filter((c) => !c.isNew).length,
      received: chats.reduce((a, c) => a + c.received, 0),
      sent: chats.reduce((a, c) => a + c.sent, 0),
      withIncoming: withIn.length,
      answered: withIn.filter((c) => c.answered).length,
      unanswered: withIn.filter((c) => !c.answered).length,
      pendingNow: chats.filter((c) => c.pending).length,
      responses: rts.length,
      avgRt: rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : null,
      medianRt: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
      maxRt: sorted.length ? sorted[sorted.length - 1] : null,
      under5: rts.length ? rts.filter((x) => x <= 5 * MIN).length / rts.length : null,
      under60: rts.length ? rts.filter((x) => x <= 60 * MIN).length / rts.length : null,
      chats: chats.sort((a, b) => b.last - a.last)
    };
  }

  HZ.fmtDur = (ms) => {
    if (ms == null) return '—';
    if (ms < MIN) return 'menos de 1 min';
    const m = Math.round(ms / MIN);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim();
    const d = Math.floor(h / 24);
    return `${d} d ${h % 24 ? (h % 24) + ' h' : ''}`.trim();
  };

  // ---------- avisos de espera ----------
  function checkWaiting() {
    const s = app.state.settings;
    const limit = (Number(s.waitMinutes) || 15) * MIN;
    const list = waiting().filter((w) => w.wait >= limit);
    app.waitingCount = list.length;
    if (!s.waitAlert) return;
    for (const w of list) {
      const r = track[w.name];
      if (r.alertedFor === w.since || Date.now() - w.since > 12 * 3600000) continue;
      r.alertedFor = w.since;
      dirty = true;
      const txt = `⏱ ${w.name} espera respuesta hace ${HZ.fmtDur(w.wait)}`;
      app.toast(txt, 6000);
      chrome.runtime.sendMessage({ type: 'notify', title: 'Whazaa · cliente esperando', message: txt.slice(2) });
    }
  }

  // ---------- historial real (WA-JS) ----------
  let syncing = false;
  async function syncHistory(force) {
    if (syncing || !HZ.api || !HZ.api.ready) return;
    const now = Date.now();
    const d = new Date(now);
    const monthAgo = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 31).getTime();
    if (!force && meta.synced && now - meta.synced < 10 * MIN) return;
    const from = meta.synced ? Math.max(monthAgo, meta.synced - 2 * 3600000) : monthAgo;
    syncing = true;
    HZ.tracker.syncing = true;
    try {
      const list = await HZ.api.call('history', from, 400);
      for (const c of list || []) {
        if (!c.name) continue;
        const r = rec(c.name);
        r.g = !!c.group;
        r.chatId = c.id;
        // lo que vino de la lista se reemplaza por el historial real
        for (const [id, e] of Object.entries(r.ev)) if (id[0] === 'L' && e[0] >= from) delete r.ev[id];
        for (const [id, t, out] of c.msgs) r.ev[id] = [t, out];
        if (c.firstAt) r.firstAt = c.firstAt;
        if (c.hasBefore) r.before = Math.min(r.before || Infinity, from);
      }
      meta.synced = now;
      dirty = true;
      await flush();
      if (app.open && app.view === 'stats') app.render();
    } catch (e) {
      console.warn('Whazaa: no se pudo leer el historial', e);
    } finally {
      syncing = false;
      HZ.tracker.syncing = false;
    }
  }

  HZ.tracker = { compute, waiting, followups, syncHistory, parsePre, parseListLabel, get data() { return track; }, get meta() { return meta; }, flush, syncing: false };

  app.afterBoot = app.afterBoot || [];
  app.afterBoot.push(async () => {
    await load();
    const tick = () => {
      try { scanList(); harvestOpen(); } catch (e) { console.warn('Whazaa tracker', e); }
    };
    tick();
    setInterval(tick, 2500);
    // leer el historial real apenas esté listo el motor rápido, y cada 10 minutos
    const trySync = () => syncHistory(false);
    setTimeout(trySync, 8000);
    setInterval(trySync, 60000);
    setInterval(flush, 5000);
    setInterval(() => { checkWaiting(); app.renderRail(); }, 20000);
    setTimeout(() => { checkWaiting(); app.renderRail(); }, 4000);
    window.addEventListener('beforeunload', () => { if (dirty) flush(); });
  });
})();
