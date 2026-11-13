// Conversión de audio a OGG Opus, el formato de las notas de voz de WhatsApp.
//
// WhatsApp rechaza WAV, WEBM (lo que graba el navegador) y otros formatos con
// errores como "InvalidMediaCheckRepairFailedType". Acá convertimos cualquier
// audio que Chrome pueda leer (wav, mp3, m4a, webm, ogg…) a OGG Opus mono 48 kHz,
// usando el codificador Opus que ya trae Chrome (WebCodecs) y armando el
// contenedor OGG a mano. No necesita librerías ni internet.
(function () {
  const HZ = globalThis.HZ;
  const SR = 48000; // Opus trabaja siempre a 48 kHz
  const PRE_SKIP = 312;
  const FRAME = 960; // 20 ms
  const OGG_MIME = 'audio/ogg; codecs=opus';

  // ---------- CRC de OGG (polinomio 0x04c11db7, sin reflejar) ----------
  const CRC = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    CRC[i] = r >>> 0;
  }
  function crc(u8) {
    let c = 0;
    for (let i = 0; i < u8.length; i++) c = ((c << 8) ^ CRC[((c >>> 24) ^ u8[i]) & 0xff]) >>> 0;
    return c >>> 0;
  }

  function page(packets, { granule, serial, seq, bos = false, eos = false }) {
    const seg = [];
    for (const p of packets) {
      let n = p.length;
      while (n >= 255) { seg.push(255); n -= 255; }
      seg.push(n);
    }
    const dataLen = packets.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(27 + seg.length + dataLen);
    const dv = new DataView(out.buffer);
    out.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
    out[4] = 0;
    out[5] = (bos ? 2 : 0) | (eos ? 4 : 0);
    dv.setUint32(6, granule % 0x100000000, true);
    dv.setUint32(10, Math.floor(granule / 0x100000000), true);
    dv.setUint32(14, serial, true);
    dv.setUint32(18, seq, true);
    out[26] = seg.length;
    out.set(seg, 27);
    let o = 27 + seg.length;
    for (const p of packets) { out.set(p, o); o += p.length; }
    dv.setUint32(22, crc(out), true);
    return out;
  }

  function opusHead(inputRate) {
    const h = new Uint8Array(19);
    const dv = new DataView(h.buffer);
    h.set([...'OpusHead'].map((c) => c.charCodeAt(0)), 0);
    h[8] = 1; // versión
    h[9] = 1; // canales (mono)
    dv.setUint16(10, PRE_SKIP, true);
    dv.setUint32(12, inputRate, true);
    dv.setInt16(16, 0, true);
    h[18] = 0;
    return h;
  }
  function opusTags() {
    const vendor = new TextEncoder().encode('Whazaa');
    const h = new Uint8Array(8 + 4 + vendor.length + 4);
    const dv = new DataView(h.buffer);
    h.set([...'OpusTags'].map((c) => c.charCodeAt(0)), 0);
    dv.setUint32(8, vendor.length, true);
    h.set(vendor, 12);
    dv.setUint32(12 + vendor.length, 0, true);
    return h;
  }

  // ¿Ya es OGG Opus? (busca "OpusHead" al principio del archivo)
  function isOggOpus(u8) {
    if (!(u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53)) return false;
    const head = new TextDecoder('latin1').decode(u8.subarray(0, 200));
    return head.includes('OpusHead');
  }

  async function decodeToMono48k(bytes) {
    const tmp = new OfflineAudioContext(1, 1, SR);
    const buf = await tmp.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const len = Math.max(1, Math.ceil(buf.duration * SR));
    const ctx = new OfflineAudioContext(1, len, SR);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination); // mezcla a mono
    src.start();
    const out = await ctx.startRendering();
    return { pcm: out.getChannelData(0), inputRate: buf.sampleRate, duration: buf.duration };
  }

  async function encodeOpus(pcm) {
    if (typeof AudioEncoder === 'undefined') throw new Error('Este navegador no puede convertir audios (actualizá Chrome).');
    const config = { codec: 'opus', sampleRate: SR, numberOfChannels: 1, bitrate: 32000, opus: { frameDuration: 20000, application: 'voip' } };
    const sup = await AudioEncoder.isConfigSupported(config).catch(() => ({ supported: false }));
    if (!sup.supported) delete config.opus;
    const packets = [];
    let error = null;
    const enc = new AudioEncoder({
      output: (chunk) => {
        const b = new Uint8Array(chunk.byteLength);
        chunk.copyTo(b);
        packets.push({ data: b, samples: Math.round(((chunk.duration || 20000) * SR) / 1e6) });
      },
      error: (e) => { error = e; }
    });
    enc.configure(config);
    for (let i = 0; i < pcm.length; i += FRAME) {
      const frame = new Float32Array(FRAME);
      frame.set(pcm.subarray(i, Math.min(pcm.length, i + FRAME)));
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: FRAME, numberOfChannels: 1, timestamp: Math.round((i / SR) * 1e6), data: frame });
      enc.encode(ad);
      ad.close();
    }
    await enc.flush();
    enc.close();
    if (error) throw error;
    return packets;
  }

  function mux(packets, inputRate, totalSamples) {
    const serial = (Math.random() * 0xffffffff) >>> 0;
    const pages = [page([opusHead(inputRate)], { granule: 0, serial, seq: 0, bos: true }), page([opusTags()], { granule: 0, serial, seq: 1 })];
    let seq = 2;
    let granule = 0;
    let cur = [];
    let segs = 0;
    const endGranule = PRE_SKIP + totalSamples;
    for (let i = 0; i < packets.length; i++) {
      const p = packets[i];
      const need = Math.floor(p.data.length / 255) + 1;
      if (cur.length && (segs + need > 255 || cur.length >= 50)) {
        pages.push(page(cur, { granule, serial, seq: seq++ }));
        cur = [];
        segs = 0;
      }
      cur.push(p.data);
      segs += need;
      granule += p.samples;
    }
    pages.push(page(cur, { granule: Math.min(granule, endGranule), serial, seq: seq++, eos: true }));
    const size = pages.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(size);
    let o = 0;
    for (const p of pages) { out.set(p, o); o += p.length; }
    return out;
  }

  const toDataUrl = (u8, mime) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(new Blob([u8], { type: mime }));
    });

  // Convierte un media {dataUrl, name, mime} a OGG Opus (si hace falta).
  // Devuelve { dataUrl, mime, name, size, duration, converted }
  HZ.toVoiceFormat = async (m) => {
    const bytes = new Uint8Array(await (await fetch(m.dataUrl)).arrayBuffer());
    if (isOggOpus(bytes)) {
      const clean = HZ.cleanDataUrl(m.dataUrl, 'audio/ogg');
      return { ...m, dataUrl: clean, mime: OGG_MIME, converted: clean !== m.dataUrl };
    }
    let dec;
    try {
      dec = await decodeToMono48k(bytes);
    } catch (_) {
      throw new Error('No se pudo leer el audio. Probá con un MP3, WAV, M4A u OGG.');
    }
    const packets = await encodeOpus(dec.pcm);
    const ogg = mux(packets, dec.inputRate, dec.pcm.length);
    const base = String(m.name || 'audio').replace(/\.[^.]+$/, '');
    return { ...m, dataUrl: await toDataUrl(ogg, 'audio/ogg'), mime: OGG_MIME, name: base + '.ogg', size: ogg.length, duration: dec.duration, converted: true };
  };

  // Para el motor de envío: convierte una vez y lo guarda, así la próxima sale al instante.
  HZ.ensureVoiceMedia = async (m) => {
    const v = await HZ.toVoiceFormat(m);
    if (v.converted && m.id) {
      const { converted, ...save } = v;
      await HZ.saveMedia(save);
    }
    return v;
  };

  HZ.isOggOpus = isOggOpus;
})();
