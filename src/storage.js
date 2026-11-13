// Capa de datos compartida (content script + página de opciones + background).
// Todo se guarda en chrome.storage.local. Los archivos (imágenes/audios) se
// guardan aparte bajo la clave "media:<id>" para que la lista de respuestas sea liviana.
(function () {
  const HZ = (globalThis.HZ = globalThis.HZ || {});

  HZ.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  HZ.DEFAULTS = {
    replies: [],
    stages: [
      { id: 'nuevo', name: 'Nuevo lead', color: '#3b82f6' },
      { id: 'conversando', name: 'En conversación', color: '#f59e0b' },
      { id: 'propuesta', name: 'Propuesta enviada', color: '#8b5cf6' },
      { id: 'cerrado', name: 'Cerrado ✅', color: '#10b981' },
      { id: 'perdido', name: 'Perdido', color: '#6b7280' }
    ],
    contacts: {}, // { [nombreDelChat]: { stageId, note, updatedAt } }
    scheduled: [], // [{ id, chatName, phone, kind:'reply'|'text', replyId, text, at, status, error, sentAt }]
    settings: {
      stepDelay: 1, // segundos por defecto entre pasos
      showDots: true, // puntos de color en la lista de chats
      slashShortcuts: true, // autocompletar con "/" en la caja de texto
      panelWidth: 360
    }
  };

  const KEYS = Object.keys(HZ.DEFAULTS);

  HZ.getAll = async () => {
    const data = await chrome.storage.local.get(KEYS);
    const out = {};
    for (const k of KEYS) {
      const def = HZ.DEFAULTS[k];
      out[k] = data[k] === undefined ? structuredClone(def) : data[k];
      if (k === 'settings') out[k] = { ...def, ...out[k] };
    }
    return out;
  };

  HZ.get = async (key) => (await HZ.getAll())[key];
  HZ.set = (obj) => chrome.storage.local.set(obj);

  HZ.onChange = (cb) =>
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && Object.keys(changes).some((k) => KEYS.includes(k))) cb(changes);
    });

  // ---------- media ----------
  HZ.getMedia = async (id) => {
    if (!id) return null;
    const r = await chrome.storage.local.get('media:' + id);
    return r['media:' + id] || null;
  };
  HZ.saveMedia = async (media) => {
    const m = { id: media.id || HZ.uid(), ...media };
    await chrome.storage.local.set({ ['media:' + m.id]: m });
    return m;
  };
  HZ.deleteMedia = (id) => chrome.storage.local.remove('media:' + id);

  HZ.dataUrlToFile = async (dataUrl, name, mime) => {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name || 'archivo', { type: mime || blob.type });
  };
  HZ.fileToDataUrl = (file) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });

  // ---------- variables ----------
  HZ.greeting = (d = new Date()) => {
    const h = d.getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  };

  // Variables disponibles: {nombre} {nombre_completo} {saludo} {fecha} {hora}
  HZ.fillVars = (text, ctx = {}) => {
    const full = (ctx.chatName || '').trim();
    const looksLikePhone = /^[+\d\s()-]+$/.test(full);
    const first = looksLikePhone ? '' : full.split(/\s+/)[0] || '';
    const now = new Date();
    const map = {
      nombre: first,
      nombre_completo: looksLikePhone ? '' : full,
      saludo: HZ.greeting(now),
      fecha: now.toLocaleDateString('es-AR'),
      hora: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    };
    return String(text || '')
      .replace(/\{(\w+)\}/g, (m, k) => (k.toLowerCase() in map ? map[k.toLowerCase()] : m))
      .replace(/[ \t]+([,.!?])/g, '$1') // "Hola !" -> "Hola!" cuando {nombre} queda vacío
      .replace(/[ \t]{2,}/g, ' ');
  };

  HZ.escape = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  HZ.stepIcon = (t) => ({ text: '📝', image: '🖼️', audio: '🎤' })[t] || '•';
})();
