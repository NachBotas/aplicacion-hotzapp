// Capa de datos compartida (content script, página de opciones y background).
// Todo vive en chrome.storage.local. Los archivos (imágenes, audios, videos,
// documentos) se guardan aparte bajo "media:<id>" para que la lista sea liviana.
(function () {
  const HZ = (globalThis.HZ = globalThis.HZ || {});

  HZ.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Tipos de respuesta rápida
  HZ.TYPES = {
    text: { label: 'Texto', color: '#3fb59c', icon: 'text' },
    audio: { label: 'Audio', color: '#a78bfa', icon: 'mic' },
    image: { label: 'Imagen', color: '#4ade80', icon: 'image' },
    video: { label: 'Video', color: '#f5a524', icon: 'film' },
    document: { label: 'Documento', color: '#f0997b', icon: 'file' },
    contact: { label: 'Contacto', color: '#8b9cf7', icon: 'user' },
    sequence: { label: 'Secuencia', color: '#f472b6', icon: 'layers' }
  };

  HZ.DEFAULTS = {
    // Respuesta: { id, type, name, category, shortcut, favorite, uses, text, caption, mediaId,
    //   viewOnce, asVoice, typing (seg), contactName, contactPhone,
    //   items:[{replyId, delay}], afterStage }
    replies: [],
    stages: [
      { id: 'nuevo', name: 'Nuevo lead', color: '#3b82f6' },
      { id: 'conversando', name: 'En conversación', color: '#f59e0b' },
      { id: 'propuesta', name: 'Propuesta enviada', color: '#8b5cf6' },
      { id: 'cerrado', name: 'Cerrado ✅', color: '#10b981' },
      { id: 'perdido', name: 'Perdido', color: '#6b7280' }
    ],
    // { [nombreDelChat]: { stageId, phone, email, company, value, source, updatedAt } }
    contacts: {},
    notes: {}, // { [nombreDelChat]: [{ id, text, at }] }
    tasks: [], // [{ id, chatName, text, due, done, notified }]
    scheduled: [], // [{ id, chatName, kind:'reply'|'text', replyId, text, at, status, error }]
    collapsed: {}, // categorías plegadas
    settings: {
      myName: '',
      stepDelay: 2,
      showBar: true,
      barCollapsed: false,
      chipStyle: 'icon', // 'icon' | 'color'
      directSend: true, // "Mensaje sale directo"
      directSequence: false, // "Secuencia sale directo"
      onlyFavorites: false,
      typeFilter: [], // tipos a mostrar en la barra ([] = todos)
      showDots: true,
      panelWidth: 340,
      railCollapsed: false
    }
  };

  const KEYS = Object.keys(HZ.DEFAULTS);

  // Convierte respuestas de la versión 1 (con "steps") al formato nuevo.
  function migrate(replies) {
    if (!replies.some((r) => r.steps)) return null;
    const out = [];
    for (const r of replies) {
      if (!r.steps) { out.push(r); continue; }
      const conv = (s, name) => {
        const base = { id: HZ.uid(), name, category: '', shortcut: '', favorite: false, uses: 0 };
        if (s.type === 'text') return { ...base, type: 'text', text: s.text || '' };
        if (s.type === 'image') return { ...base, type: 'image', mediaId: s.mediaId, caption: s.caption || '' };
        return { ...base, type: 'audio', mediaId: s.mediaId, asVoice: true };
      };
      if (r.steps.length === 1) out.push({ ...conv(r.steps[0], r.title), id: r.id, shortcut: r.shortcut || '' });
      else {
        const children = r.steps.map((s, i) => conv(s, `${r.title} · ${i + 1}`));
        out.push(...children);
        out.push({
          id: r.id, type: 'sequence', name: r.title, category: '', shortcut: r.shortcut || '', favorite: false, uses: 0,
          items: children.map((c, i) => ({ replyId: c.id, delay: i ? Number(r.steps[i].delay ?? 2) : 0 })), afterStage: ''
        });
      }
    }
    return out;
  }

  HZ.getAll = async () => {
    const data = await chrome.storage.local.get(KEYS);
    const out = {};
    for (const k of KEYS) {
      const def = HZ.DEFAULTS[k];
      out[k] = data[k] === undefined ? structuredClone(def) : data[k];
      if (k === 'settings') out[k] = { ...def, ...out[k] };
    }
    const migrated = migrate(out.replies);
    if (migrated) {
      out.replies = migrated;
      await chrome.storage.local.set({ replies: migrated });
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
    const m = { ...media, id: media.id || HZ.uid() };
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
  HZ.VARS = [
    { token: '{primer_nombre}', label: 'Primer nombre' },
    { token: '{nombre_completo}', label: 'Nombre completo' },
    { token: '{saludo}', label: 'Saludo' },
    { token: '{mi_nombre}', label: 'Tu nombre' },
    { token: '{telefono}', label: 'Teléfono' },
    { token: '{fecha}', label: 'Fecha de hoy' },
    { token: '{hora}', label: 'Hora actual' }
  ];

  HZ.greeting = (d = new Date()) => {
    const h = d.getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  };

  // ctx: { chatName, phone, myName }
  HZ.fillVars = (text, ctx = {}) => {
    const full = (ctx.chatName || '').trim();
    const isPhone = /^[+\d\s()-]+$/.test(full);
    const first = isPhone ? '' : full.split(/\s+/)[0] || '';
    const now = new Date();
    const map = {
      primer_nombre: first,
      nombre: first,
      nombre_completo: isPhone ? '' : full,
      saludo: HZ.greeting(now),
      mi_nombre: ctx.myName || '',
      telefono: ctx.phone || (isPhone ? full : ''),
      fecha: now.toLocaleDateString('es-AR'),
      hora: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    };
    return String(text || '')
      .replace(/\{(\w+)\}/g, (m, k) => (k.toLowerCase() in map ? map[k.toLowerCase()] : m))
      .replace(/[ \t]+([,.!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ');
  };

  HZ.escape = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
})();
