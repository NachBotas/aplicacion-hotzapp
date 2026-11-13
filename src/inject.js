// Corre en el contexto de la página (world: MAIN) antes que WhatsApp Web.
//
// Truco para que los audios salgan como NOTA DE VOZ "recién grabada":
// cuando Whazaa va a mandar un audio, reemplazamos por un instante el micrófono
// (getUserMedia) por un stream que reproduce el audio guardado. Después se aprieta
// el botón de grabar de WhatsApp, que "graba" ese audio en tiempo real, y al terminar
// se envía. Para el que lo recibe es una nota de voz normal (con onda, "grabando
// audio…" mientras tanto, etc.). El micrófono real nunca se toca y sólo se intercepta
// la PRÓXIMA llamada después de preparar un audio.
(() => {
  if (window.__hotzappInjected) return;
  window.__hotzappInjected = true;

  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;

  const origGUM = md.getUserMedia.bind(md);
  const origEnum = md.enumerateDevices ? md.enumerateDevices.bind(md) : null;
  const perms = navigator.permissions;
  const origQuery = perms && perms.query ? perms.query.bind(perms) : null;

  let pending = null; // { id, audio: AudioBuffer, expires }
  let playing = null; // fuente sonando ahora (para poder cancelar)
  let ctx = null;
  const getCtx = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
  const post = (d) => window.postMessage({ __hz: 'page', ...d }, '*');
  const isPending = () => pending && pending.expires > Date.now();

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.__hz !== 'cs') return;
    const m = e.data;
    if (m.type === 'prepare') {
      try {
        const c = getCtx();
        if (c.state !== 'running') await c.resume().catch(() => {});
        const buf = await (await fetch(m.dataUrl)).arrayBuffer();
        const audio = await c.decodeAudioData(buf);
        pending = { id: m.id, audio, expires: Date.now() + 20000 };
        post({ type: 'ready', id: m.id, duration: audio.duration, ctxState: c.state });
      } catch (err) {
        post({ type: 'error', id: m.id, error: 'No se pudo leer el audio: ' + (err && err.message ? err.message : err) });
      }
    } else if (m.type === 'cancel') {
      pending = null;
      if (playing) { try { playing.onended = null; playing.stop(); } catch (_) {} playing = null; }
    }
  });

  async function fakeMicStream(constraints) {
    const { id, audio } = pending;
    pending = null;
    const c = getCtx();
    if (c.state !== 'running') await c.resume().catch(() => {});
    const dest = c.createMediaStreamDestination();
    const src = c.createBufferSource();
    src.buffer = audio;
    src.connect(dest); // NO se conecta a los parlantes: no se escucha nada.
    const startAt = c.currentTime + 0.35; // margen para que arranque el grabador
    src.start(startAt);
    playing = src;
    src.onended = () => { playing = null; setTimeout(() => post({ type: 'ended', id }), 300); };
    post({ type: 'started', id, duration: audio.duration, ctxState: c.state });
    const stream = dest.stream;
    // Si la página pidió también video (no debería), lo pedimos de verdad.
    if (constraints && constraints.video) {
      try {
        const v = await origGUM({ video: constraints.video });
        v.getVideoTracks().forEach((t) => stream.addTrack(t));
      } catch (_) {}
    }
    return stream;
  }

  const patchedGUM = function (constraints) {
    if (isPending() && constraints && constraints.audio) return fakeMicStream(constraints);
    return origGUM(constraints);
  };
  try {
    md.getUserMedia = patchedGUM;
    if (window.MediaDevices && MediaDevices.prototype) MediaDevices.prototype.getUserMedia = patchedGUM;
  } catch (_) {}

  // Si la PC no tiene micrófono, WhatsApp podría no mostrar el botón de grabar:
  // mientras haya un audio pendiente, simulamos que existe uno.
  if (origEnum) {
    md.enumerateDevices = async function () {
      const list = await origEnum();
      if (isPending() && !list.some((d) => d.kind === 'audioinput')) {
        list.push({ deviceId: 'hotzapp', groupId: 'hotzapp', kind: 'audioinput', label: 'Whazaa', toJSON() { return this; } });
      }
      return list;
    };
  }

  // Si el permiso de micrófono nunca se dio, evitamos el cartel de "permitir micrófono".
  if (origQuery) {
    perms.query = function (desc) {
      if (isPending() && desc && desc.name === 'microphone') {
        const status = { name: 'microphone', state: 'granted', onchange: null, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
        return Promise.resolve(status);
      }
      return origQuery(desc);
    };
  }
})();
