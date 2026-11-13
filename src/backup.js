// Sección "Copia de seguridad": exporta TODO (configuración + audios, imágenes,
// videos y documentos) en un .zip con carpetas, y lo vuelve a cargar en otra compu.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const I = HZ.icon;
  const esc = HZ.escape;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // ================= ZIP (sin librerías) =================
  const CRC_T = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function dos(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }
  // files: [{ path, data: Uint8Array }]  → Blob .zip (sin compresión, nombres UTF-8)
  function makeZip(files) {
    const parts = [];
    const central = [];
    const { time, date } = dos(new Date());
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.path);
      const crc = crc32(f.data);
      const size = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true);
      lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true);
      lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      parts.push(lh, name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true);
      ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true);
      ch.setUint32(24, size, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch, name);
      offset += 30 + name.length + size;
    }
    const cdSize = central.reduce((a, p) => a + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }

  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }

  // Lee un .zip (también si lo re-comprimiste con Windows/Mac) → Map(ruta → bytes)
  async function readZip(ab) {
    const u8 = new Uint8Array(ab);
    const dv = new DataView(ab);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('El archivo no es un .zip válido');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = new Map();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('El .zip está dañado');
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const xlen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen)).replace(/\\/g, '/');
      p += 46 + nlen + xlen + clen;
      if (name.endsWith('/')) continue;
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const raw = u8.subarray(start, start + csize);
      out.set(name, method === 8 ? await inflateRaw(raw) : method === 0 ? raw : null);
    }
    return out;
  }

  // ================= helpers =================
  const FOLDER = { audio: 'audios', image: 'imagenes', video: 'videos', document: 'documentos' };
  const MIME_EXT = { 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/wav': '.wav', 'audio/webm': '.webm', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/3gpp': '.3gp', 'application/pdf': '.pdf' };
  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const extOf = (m) => {
    const fromName = /\.[a-z0-9]{1,5}$/i.exec(m.name || '');
    if (fromName) return fromName[0].toLowerCase();
    return MIME_EXT[(m.mime || '').split(';')[0]] || '';
  };
  const mb = (b) => (b / 1024 / 1024).toFixed(b > 10 * 1024 * 1024 ? 0 : 1) + ' MB';
  const fmtDate = (ms) => new Date(ms).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
  const blobToDataUrl = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });

  const LEEME = `COPIA DE SEGURIDAD DE HOTZAPP
=============================

Este archivo tiene TODO lo de tu HotZapp:
- hotzapp.json  → respuestas rápidas, secuencias, CRM, notas, pendientes,
                  agenda y preferencias.
- archivos/     → los audios, imágenes, videos y documentos de tus respuestas.

CÓMO PASARLO A OTRA COMPUTADORA
1. Instalá HotZapp en la otra computadora.
2. Abrí WhatsApp Web → menú de HotZapp → Copia de seguridad.
3. Tocá "Cargar backup" y elegí ESTE archivo .zip (no hace falta descomprimirlo).

IMPORTANTE: no cambies el nombre de las carpetas ni de los archivos de adentro,
porque HotZapp los busca por su ruta.
`;

  let busy = false;

  // ================= exportar =================
  async function exportBackup() {
    if (busy) return;
    busy = true;
    try {
      app.status('📦 Preparando el backup…', '', 0);
      const all = await chrome.storage.local.get(null);
      const data = {};
      const media = {};
      for (const [k, v] of Object.entries(all)) {
        if (k.startsWith('media:')) media[k.slice(6)] = v;
        else data[k] = v;
      }
      const withMedia = (data.replies || []).filter((r) => r.mediaId && media[r.mediaId]);
      const files = [];
      const index = {};
      const used = new Set();
      let missing = 0;
      for (let i = 0; i < withMedia.length; i++) {
        const r = withMedia[i];
        if (index[r.mediaId]) continue;
        const m = media[r.mediaId];
        const ext = extOf(m);
        const base = `archivos/${FOLDER[r.type] || 'otros'}/${safe(r.name) || 'archivo'}`;
        let path = base + ext;
        for (let n = 2; used.has(path.toLowerCase()); n++) path = `${base} (${n})${ext}`;
        used.add(path.toLowerCase());
        try {
          const bytes = new Uint8Array(await (await fetch(m.dataUrl)).arrayBuffer());
          files.push({ path, data: bytes });
          index[r.mediaId] = { path, name: m.name || path.split('/').pop(), mime: m.mime || '', size: bytes.length };
        } catch (_) {
          missing++;
        }
        app.status(`📦 Copiando archivos… ${i + 1}/${withMedia.length}`, '', (i + 1) / Math.max(1, withMedia.length));
        await new Promise((r2) => setTimeout(r2, 0));
      }
      const createdAt = Date.now();
      data.settings = { ...(data.settings || {}), lastBackup: createdAt };
      const manifest = { app: 'hotzapp', format: 3, version: chrome.runtime.getManifest().version, createdAt, data, media: index };
      files.unshift({ path: 'hotzapp.json', data: enc.encode(JSON.stringify(manifest, null, 1)) });
      files.push({ path: 'LEEME.txt', data: enc.encode(LEEME) });
      const blob = makeZip(files);
      const d = new Date(createdAt);
      const pad = (x) => String(x).padStart(2, '0');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `HotZapp-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      await app.saveSettings({ lastBackup: createdAt });
      app.status(`✅ Backup descargado (${mb(blob.size)}, ${Object.keys(index).length} archivos)${missing ? ` · ${missing} archivo(s) no se pudieron copiar` : ''}`, 'ok');
    } catch (e) {
      app.status('⚠️ No se pudo crear el backup: ' + e.message, 'err');
    } finally {
      busy = false;
    }
  }

  // ================= importar =================
  async function readBackupFile(file) {
    const ab = await file.arrayBuffer();
    const head = new Uint8Array(ab, 0, Math.min(4, ab.byteLength));
    // Backups viejos (.json con los archivos adentro)
    if (head[0] === 0x7b /* { */) {
      const json = JSON.parse(dec.decode(ab));
      if (json.app !== 'hotzapp' || !json.data) throw new Error('Ese archivo no es un backup de HotZapp');
      const data = {};
      const mediaObjs = {};
      for (const [k, v] of Object.entries(json.data)) (k.startsWith('media:') ? mediaObjs : data)[k] = v;
      return { data, mediaObjs, missing: 0, createdAt: null };
    }
    const entries = await readZip(ab);
    const key = [...entries.keys()].find((k) => k === 'hotzapp.json' || k.endsWith('/hotzapp.json'));
    if (!key) throw new Error('Ese .zip no es un backup de HotZapp (falta hotzapp.json)');
    const prefix = key.slice(0, -'hotzapp.json'.length); // por si lo re-comprimieron dentro de una carpeta
    const manifest = JSON.parse(dec.decode(entries.get(key)));
    if (manifest.app !== 'hotzapp' || !manifest.data) throw new Error('Ese archivo no es un backup de HotZapp');
    const mediaObjs = {};
    let missing = 0;
    const ids = Object.keys(manifest.media || {});
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const info = manifest.media[id];
      const bytes = entries.get(prefix + info.path);
      if (!bytes) { missing++; continue; }
      const dataUrl = await blobToDataUrl(new Blob([bytes], { type: info.mime || 'application/octet-stream' }));
      mediaObjs['media:' + id] = { id, name: info.name, mime: info.mime, size: bytes.length, dataUrl };
      app.status(`📥 Cargando archivos… ${i + 1}/${ids.length}`, '', (i + 1) / Math.max(1, ids.length));
    }
    return { data: manifest.data, mediaObjs, missing, createdAt: manifest.createdAt };
  }

  function mergeData(cur, b) {
    const byId = (a, x) => {
      const have = new Set((a || []).map((y) => y.id));
      return [...(a || []), ...(x || []).filter((y) => !have.has(y.id))];
    };
    const contacts = { ...(b.contacts || {}) };
    for (const [k, v] of Object.entries(cur.contacts || {})) contacts[k] = { ...(contacts[k] || {}), ...v };
    const notes = { ...(cur.notes || {}) };
    for (const [k, list] of Object.entries(b.notes || {})) notes[k] = byId(notes[k], list);
    return {
      replies: byId(cur.replies, b.replies),
      stages: byId(cur.stages, b.stages),
      contacts,
      notes,
      tasks: byId(cur.tasks, b.tasks),
      scheduled: byId(cur.scheduled, b.scheduled)
    };
  }

  async function importBackup(file, mode) {
    if (busy) return;
    busy = true;
    try {
      app.status('📥 Leyendo el backup…', '', 0);
      const { data, mediaObjs, missing, createdAt } = await readBackupFile(file);
      const nReplies = (data.replies || []).length;
      const when = createdAt ? ` del ${fmtDate(createdAt)}` : '';
      const msg = mode === 'replace'
        ? `Vas a REEMPLAZAR todo lo que tenés ahora por el backup${when} (${nReplies} respuestas, ${Object.keys(mediaObjs).length} archivos).\n\nLo actual se borra. ¿Continuar?`
        : `Vas a COMBINAR el backup${when} con lo que ya tenés: se agrega lo que te falte y no se borra nada. ¿Continuar?`;
      if (!confirm(msg)) { app.status(''); return; }
      if (mode === 'replace') {
        await chrome.storage.local.clear();
        await chrome.storage.local.set({ ...data, ...mediaObjs });
      } else {
        const cur = await HZ.getAll();
        const merged = mergeData(cur, data);
        const haveMedia = new Set(cur.replies.map((r) => r.mediaId).filter(Boolean));
        const newMedia = Object.fromEntries(Object.entries(mediaObjs).filter(([k]) => !haveMedia.has(k.slice(6))));
        await chrome.storage.local.set({ ...merged, ...newMedia });
      }
      app.status(`✅ Backup cargado${missing ? ` · faltaron ${missing} archivo(s) dentro del .zip` : ''}`, missing ? 'err' : 'ok');
    } catch (e) {
      app.status('⚠️ No se pudo cargar: ' + e.message, 'err');
    } finally {
      busy = false;
    }
  }

  // ================= vista =================
  let bytesInUse = null;
  app.views.backup = {
    render(head, body) {
      head.innerHTML = app.header('Copia de seguridad');
      const st = app.state;
      const by = (t) => st.replies.filter((r) => r.type === t).length;
      const files = st.replies.filter((r) => r.mediaId).length;
      const last = st.settings.lastBackup;
      const old = !last || Date.now() - last > 14 * 86400000;
      if (bytesInUse === null) chrome.storage.local.getBytesInUse(null).then((b) => { bytesInUse = b; if (app.view === 'backup') app.render(); });
      const row = (label, val) => `<div class="row" style="padding:5px 0;border-bottom:1px solid var(--line)"><span class="grow" style="color:var(--muted)">${label}</span><b>${val}</b></div>`;
      body.innerHTML = `
        <div class="item">
          ${row('Respuestas rápidas', st.replies.length)}
          ${row('↳ textos / audios / imágenes', `${by('text')} / ${by('audio')} / ${by('image')}`)}
          ${row('↳ videos / documentos / contactos', `${by('video')} / ${by('document')} / ${by('contact')}`)}
          ${row('↳ secuencias', by('sequence'))}
          ${row('Archivos guardados', files + (bytesInUse ? ` · ${mb(bytesInUse)}` : ''))}
          ${row('Contactos en el CRM', Object.values(st.contacts).filter((c) => c.stageId).length)}
          ${row('Notas / pendientes / programados', `${Object.values(st.notes).reduce((a, l) => a + l.length, 0)} / ${st.tasks.length} / ${st.scheduled.filter((s) => s.status === 'pending').length}`)}
          <div class="m" style="margin-top:8px;${old ? 'color:var(--orange)' : ''}">${last ? `Último backup: ${fmtDate(last)}` : '⚠️ Todavía no hiciste ningún backup.'}${last && old ? ' · ya pasaron más de 2 semanas' : ''}</div>
        </div>

        <button class="btn" style="width:100%;margin-top:6px;height:42px;font-size:14px" data-bk="export">${I('download', 17)} Crear backup</button>
        <p class="hint" style="margin-top:8px">Se descarga un archivo <b>.zip</b> con todas tus respuestas y configuraciones, y los audios, imágenes, videos y documentos ordenados en carpetas. Guardalo en un pendrive, Google Drive o mandátelo por mail.</p>

        <h3 class="sec2">Cargar backup</h3>
        <div class="two">
          <button class="btn ghost" data-bk="merge">${I('upload', 15)} Combinar</button>
          <button class="btn ghost" data-bk="replace" style="color:#f87171">${I('upload', 15)} Reemplazar todo</button>
        </div>
        <input type="file" hidden accept=".zip,.json,application/zip,application/json" data-bkfile>
        <p class="hint" style="margin-top:8px"><b>Combinar</b> agrega lo del backup que no tengas, sin borrar nada.<br><b>Reemplazar todo</b> borra lo actual y deja exactamente lo del backup (ideal para una compu nueva).</p>

        <h3 class="sec2">Pasar HotZapp a otra computadora</h3>
        <div class="item" style="line-height:1.7">
          <b>1.</b> En esta compu: <b>Crear backup</b>.<br>
          <b>2.</b> Pasá el .zip a la otra compu (pendrive, Drive, mail…).<br>
          <b>3.</b> Allá, instalá HotZapp y abrí WhatsApp Web.<br>
          <b>4.</b> Menú HotZapp → Copia de seguridad → <b>Reemplazar todo</b> y elegí el .zip. No hace falta descomprimirlo.
        </div>

        <h3 class="sec2">Sobre tus archivos</h3>
        <div class="item" style="line-height:1.6">
          📁 Cuando cargás un audio, imagen, video o documento, <b>HotZapp guarda una copia adentro de la extensión</b>: aunque después muevas o borres el original, la respuesta sigue funcionando.<br><br>
          ⚠️ Pero si desinstalás HotZapp, borrás los datos de Chrome o cambiás de compu, <b>esa copia se pierde</b>. Por eso:<br>
          • Hacé un backup cada tanto (sobre todo después de cargar respuestas nuevas).<br>
          • Te recomendamos guardar también los <b>archivos originales juntos en una carpeta</b> (por ejemplo <i>Documentos/HotZapp</i>), así siempre los tenés a mano para volver a cargarlos o editarlos.
        </div>`;
    }
  };

  let pendingMode = null;
  app.el.body.addEventListener('click', (e) => {
    if (app.view !== 'backup') return;
    const t = e.target.closest('[data-bk]');
    if (!t) return;
    if (t.dataset.bk === 'export') return exportBackup();
    pendingMode = t.dataset.bk;
    const inp = app.el.body.querySelector('[data-bkfile]');
    inp.value = '';
    inp.click();
  });
  app.el.body.addEventListener('change', (e) => {
    if (app.view !== 'backup' || !e.target.matches('[data-bkfile]') || !e.target.files[0]) return;
    bytesInUse = null;
    importBackup(e.target.files[0], pendingMode || 'merge');
  });
  app.onState = app.onState || [];
  app.onState.push(() => { bytesInUse = null; });

  HZ.backup = { makeZip, readZip, exportBackup, importBackup };
})();
