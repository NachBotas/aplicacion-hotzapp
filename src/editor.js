// Editor de respuestas rápidas: selector de tipo + formularios por tipo.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const I = HZ.icon;
  const esc = HZ.escape;

  const ACCEPT = {
    audio: { accept: 'audio/*,.ogg,.mp3,.m4a,.wav,.opus', hint: '.ogg, .mp3' },
    image: { accept: 'image/png,image/jpeg,image/webp,image/gif', hint: 'Formatos: .png, .jpg, .webp' },
    video: { accept: 'video/mp4,video/3gpp,video/*', hint: 'Formatos: .mp4, .3gp' },
    document: { accept: '*/*', hint: 'Formatos: .pdf, .doc, .xls, .csv, .zip y otros' }
  };
  const TITLES = { text: 'Nuevo mensaje de texto', audio: 'Nuevo audio', image: 'Nueva imagen', video: 'Nuevo video', document: 'Nuevo documento', contact: 'Nuevo contacto', sequence: 'Nueva secuencia' };
  const MAX = 64 * 1024 * 1024;

  let draft = null;
  let isNew = true;
  let moreOpen = false;
  let rec = null; // grabación en curso
  let pickerOpen = false;
  let modal = null;

  // ---------- selector de tipo ----------
  function pick() {
    draft = null;
    const t = (k) => `<button class="tbtn" data-type="${k}"><span style="color:${HZ.TYPES[k].color}">${I(HZ.TYPES[k].icon, 22)}</span>${HZ.TYPES[k].label}</button>`;
    modal = app.modal(`
      <h2>Nueva respuesta rápida</h2>
      <div class="mb"><div class="types">
        ${['text', 'audio', 'image', 'video', 'document', 'contact'].map(t).join('')}
        <button class="tbtn seq" data-type="sequence"><span style="color:${HZ.TYPES.sequence.color}">${I('layers', 22)}</span>
          <span>Secuencia de mensajes<small>Varias respuestas rápidas, una tras otra.</small></span></button>
      </div></div>
      <div class="mf"><button class="btn gray" data-x="cancel">Cancelar</button></div>`);
    modal.addEventListener('click', (e) => {
      const b = e.target.closest('[data-type],[data-x]');
      if (!b) return;
      if (b.dataset.x) return app.closeModal();
      open(b.dataset.type);
    });
  }

  // ---------- abrir formulario ----------
  async function open(type, reply) {
    isNew = !reply;
    moreOpen = !!(reply && (reply.shortcut || reply.typing));
    pickerOpen = false;
    draft = reply
      ? structuredClone(reply)
      : { id: null, type, name: '', category: '', shortcut: '', favorite: false, uses: 0, text: '', caption: '', viewOnce: false, asVoice: true, typing: 0, contactName: '', contactPhone: '', items: [], afterStage: '' };
    if (draft.mediaId) draft._media = await HZ.getMedia(draft.mediaId);
    modal = app.modal('<div class="mb"></div>', { onClose: stopRec });
    draw();
  }

  function missing() {
    const d = draft;
    let n = 0;
    if (!d.name.trim()) n++;
    if (d.type === 'text' && !d.text.trim()) n++;
    if (['audio', 'image', 'video', 'document'].includes(d.type) && !d._media) n++;
    if (d.type === 'contact') { if (!d.contactName.trim()) n++; if (!d.contactPhone.trim()) n++; }
    if (d.type === 'sequence' && !d.items.length) n++;
    return n;
  }

  const sw = (key, label, help = '') =>
    `<div class="sw ${draft[key] ? 'on' : ''}" data-sw="${key}"><span class="tr"></span><span>${label}</span></div>${help ? `<div class="help" style="margin:0 0 8px">${help}</div>` : ''}`;
  const chips = (target) => `<div class="chips">${HZ.VARS.map((v) => `<button type="button" class="vchip" data-var="${v.token}" data-target="${target}">${v.label}</button>`).join('')}</div>
    <div class="help">Haz clic para agregar. Al enviar, se cambia por el dato real.</div>`;
  const shortcutField = () => `<div class="field"><label>Atajo</label><div class="short"><input data-k="shortcut" value="${esc(draft.shortcut)}" placeholder="atajo"></div></div>`;
  const more = (label, inner) => `
    <div class="more ${moreOpen ? 'open' : ''}" data-more>${I('chevronDown', 14)} Más opciones <span class="opt">(${label})</span></div>
    <div ${moreOpen ? '' : 'hidden'} data-morebody>${inner}</div>`;

  function mediaBlock() {
    const d = draft;
    const m = d._media;
    if (m) {
      const pv =
        d.type === 'image' ? `<img src="${m.dataUrl}" alt="">` :
        d.type === 'video' ? `<video src="${m.dataUrl}" controls></video>` :
        d.type === 'audio' ? `<audio src="${m.dataUrl}" controls></audio>` :
        `<span style="color:${HZ.TYPES.document.color}">${I('file', 28)}</span><span class="grow">${esc(m.name)}<div class="help">${(m.size / 1024 / 1024 || 0).toFixed(2)} MB</div></span>`;
      return `<div class="preview">${pv}<button type="button" class="btn sm ghost" data-x="clearmedia">Cambiar</button></div>`;
    }
    if (d.type === 'audio') {
      return `<div class="two">
        <button type="button" class="big ${rec ? 'rec' : ''}" data-x="rec">${I(rec ? 'stop' : 'mic', 20)}${rec ? 'Detener grabación' : 'Grabar ahora'}${rec ? '<small>● grabando…</small>' : ''}</button>
        <button type="button" class="big" data-x="file">${I('file', 20)}Elegir archivo<small>${ACCEPT.audio.hint}</small></button>
      </div><input type="file" hidden accept="${ACCEPT.audio.accept}" data-file>`;
    }
    return `<div class="drop" data-drop>Haz clic aquí o arrastra el archivo.<small>${ACCEPT[d.type].hint}</small></div>
      <input type="file" hidden accept="${ACCEPT[d.type].accept}" data-file>`;
  }

  function seqBlock() {
    const d = draft;
    const avail = app.state.replies.filter((r) => r.type !== 'sequence' && r.id !== d.id);
    return `
      <div class="lbl">Mensajes, en orden <span class="opt">· salen una tras otra, con la espera que elijas</span></div>
      ${d.items.map((it, i) => {
        const r = app.state.replies.find((x) => x.id === it.replyId);
        return `<div class="seqi">${r ? app.typeIcon(r.type, 14) : ''}<span class="n">${esc(r ? r.name : '(borrada)')}</span>
          ${i > 0 ? `<span class="help" style="margin:0">esperar</span><input type="number" min="0" step="0.5" data-delay="${i}" value="${it.delay}"><span class="help" style="margin:0">s</span>` : ''}
          <button type="button" class="ib" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="ib" data-mv="${i}:1" ${i === d.items.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="ib" data-rmi="${i}">${I('x', 14)}</button></div>`;
      }).join('')}
      <div class="addseq" data-x="addseq">+ Agregar respuesta rápida</div>
      ${pickerOpen ? `<div class="picker scroll">${avail.length ? avail.map((r) => `<div class="pi" data-addid="${r.id}">${app.typeIcon(r.type, 14)}<span class="grow">${esc(r.name)}</span></div>`).join('') : '<div class="empty">Primero creá respuestas de texto, audio, imagen, etc.</div>'}</div>` : ''}
      <div class="help">Elige las respuestas rápidas que van a salir, en orden.</div>
      <div class="kv" style="margin-top:12px"><b>Después de disparar</b><div class="v">
        <select data-k="afterStage"><option value="">Nada. La conversación se queda donde está.</option>
          ${app.state.stages.map((s) => `<option value="${s.id}" ${d.afterStage === s.id ? 'selected' : ''}>Mover a “${esc(s.name)}”</option>`).join('')}</select>
        <small>Mueve el chat a esa etapa del CRM cuando termina la secuencia.</small></div></div>
      <div class="kv"><b>Quién la dispara</b><div class="v"><span><b>Tú</b> · en la conversación abierta</span>
        <small>Desde los mismos lugares donde ya envías una respuesta rápida. La secuencia todavía no sale por sí sola.</small></div></div>`;
  }

  function draw() {
    const d = draft;
    const cats = [...new Set(app.state.replies.map((r) => r.category).filter(Boolean))];
    const nameF = `<div class="field"><label>Nombre <span class="req">*</span></label><input data-k="name" value="${esc(d.name)}" placeholder="Cómo vas a encontrar este mensaje después"></div>`;
    const catInput = `<input data-k="category" list="hz-cats" value="${esc(d.category)}" placeholder="Ej.: Presupuestos"><datalist id="hz-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
    const catF = `<div class="field"><label>Categoría <span class="opt">· solo tú la ves (opcional)</span></label>${catInput}</div>`;
    let body = '';
    switch (d.type) {
      case 'text':
        body = nameF + catF +
          `<div class="field"><label>Mensaje <span class="req">*</span></label><textarea data-k="text" placeholder="Escribe tu mensaje aquí…">${esc(d.text)}</textarea>${chips('text')}</div>` +
          more('atajo, “escribiendo…”', shortcutField() +
            `<div class="sw ${d.typing ? 'on' : ''}" data-sw="typing"><span class="tr"></span><span>Simular “escribiendo…” antes de enviar</span></div>
             ${d.typing ? `<div class="row" style="margin:4px 0 10px 42px"><input type="number" min="1" max="60" step="1" data-k="typing" value="${d.typing}" style="width:80px"><span class="help" style="margin:0">segundos</span></div>` : ''}`);
        break;
      case 'audio':
        body = nameF + catF +
          `<div class="field"><label>Audio <span class="req">*</span></label>${mediaBlock()}</div>` +
          sw('asVoice', 'Enviar como audio grabado al momento', 'Llega como mensaje de voz de WhatsApp, no como archivo adjunto. Mientras se envía, el otro ve “grabando audio…”.') +
          sw('viewOnce', 'Ver una sola vez') +
          more('atajo', shortcutField());
        break;
      case 'image':
      case 'video':
        body = nameF + catF +
          `<div class="field"><label>Archivo <span class="req">*</span></label>${mediaBlock()}</div>` +
          sw('viewOnce', 'Ver una sola vez') +
          `<div class="field" style="margin-top:12px"><label>Descripción <span class="opt">(opcional)</span></label><textarea data-k="caption" style="min-height:52px" placeholder="Escribe tu mensaje aquí…">${esc(d.caption)}</textarea>${chips('caption')}</div>` +
          more('atajo', shortcutField());
        break;
      case 'document':
        body = nameF + catF +
          `<div class="field"><label>Archivo <span class="req">*</span></label>${mediaBlock()}</div>` +
          `<div class="field"><label>Descripción <span class="opt">(opcional)</span></label><textarea data-k="caption" style="min-height:52px" placeholder="Escribe tu mensaje aquí…">${esc(d.caption)}</textarea>${chips('caption')}</div>` +
          more('atajo', shortcutField());
        break;
      case 'contact':
        body = nameF + catF +
          `<div class="field"><label>Nombre del contacto <span class="req">*</span></label><input data-k="contactName" value="${esc(d.contactName)}" placeholder="Ej.: Facturación · Clínica Vivace"></div>
           <div class="field"><label>Teléfono <span class="req">*</span></label><input data-k="contactPhone" value="${esc(d.contactPhone)}" placeholder="+54 9 11 5555-0000">
           <div class="help">Llega como tarjeta de contacto si lo tenés agendado; si no, como mensaje con el número y un link para escribirle.</div></div>` +
          more('atajo', shortcutField());
        break;
      case 'sequence':
        body = nameF +
          `<div class="two"><div class="field"><label>Categoría <span class="opt">· solo tú la ves (opcional)</span></label>${catInput}</div>
           <div class="field"><label>Atajo <span class="opt">(opcional)</span></label><div class="short"><input data-k="shortcut" value="${esc(d.shortcut)}" placeholder="atajo"></div></div></div>` +
          seqBlock();
        break;
    }
    const T = HZ.TYPES[d.type];
    const title = isNew ? TITLES[d.type] : 'Editar ' + T.label.toLowerCase();
    modal.innerHTML = `
      <h2><span style="color:${T.color}">${I(T.icon, 22)}</span>${title}</h2>
      <div class="mb scroll">${body}</div>
      <div class="missing"></div>
      <div class="mf">
        <button class="btn gray" data-x="cancel">Cancelar</button>
        ${isNew ? `<button class="btn gray" data-x="back">‹ Cambiar el tipo</button>` : `<button class="btn danger" data-x="delete">Eliminar</button>`}
        <button class="btn" data-x="save">Guardar</button>
      </div>`;
    updateMissing();
    const first = modal.querySelector('[data-k="name"]');
    if (first && !d.name) setTimeout(() => first.focus(), 30);
  }

  function updateMissing() {
    const n = missing();
    modal.querySelector('.missing').textContent = n ? `Faltan ${n} campo${n === 1 ? '' : 's'}.` : '';
    modal.querySelector('[data-x="save"]').disabled = n > 0;
  }

  // ---------- archivos ----------
  async function setFile(f) {
    if (!f) return;
    if (f.size > MAX) return app.toast('El archivo es muy grande (máx. 64 MB).');
    draft._media = { name: f.name, mime: f.type || 'application/octet-stream', size: f.size, dataUrl: await HZ.fileToDataUrl(f), _new: true };
    if (!draft.name) draft.name = f.name.replace(/\.[^.]+$/, '');
    draw();
  }

  async function toggleRec() {
    if (rec) { rec.mr.stop(); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      return app.toast('No se pudo usar el micrófono: ' + err.message);
    }
    const mime = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const wasActive = rec && !rec.cancelled;
      rec = null;
      if (!wasActive || !draft) return;
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      draft._media = { name: 'grabacion.' + (blob.type.includes('ogg') ? 'ogg' : 'webm'), mime: blob.type, size: blob.size, dataUrl: await HZ.fileToDataUrl(blob), _new: true };
      draw();
    };
    rec = { mr };
    mr.start();
    draw();
  }
  function stopRec() {
    if (rec) { rec.cancelled = true; rec.mr.stop(); }
  }

  // ---------- guardar / eliminar ----------
  async function save() {
    const d = draft;
    if (missing()) return;
    let sc = (d.shortcut || '').trim().replace(/\s+/g, '').replace(/^[;/]+/, '');
    if (sc && app.state.replies.some((r) => r.shortcut === sc && r.id !== d.id)) return app.toast(`El atajo ;${sc} ya lo usa otra respuesta.`);
    const old = d.id ? app.state.replies.find((r) => r.id === d.id) : null;
    const { _media, ...clean } = d;
    clean.shortcut = sc;
    clean.name = d.name.trim();
    clean.category = (d.category || '').trim();
    clean.typing = Number(d.typing) || 0;
    if (_media && _media._new) {
      const { _new, ...m } = _media;
      clean.mediaId = (await HZ.saveMedia({ ...m, id: undefined })).id;
      if (old && old.mediaId) await HZ.deleteMedia(old.mediaId);
    }
    if (!['audio', 'image', 'video', 'document'].includes(clean.type)) delete clean.mediaId;
    let replies;
    if (clean.id) replies = app.state.replies.map((r) => (r.id === clean.id ? clean : r));
    else {
      clean.id = HZ.uid();
      clean.createdAt = Date.now();
      replies = [...app.state.replies, clean];
    }
    await app.save({ replies });
    app.closeModal();
    app.toast('Respuesta guardada ✅');
  }

  async function remove(id) {
    const r = app.state.replies.find((x) => x.id === id);
    if (!r || !confirm(`¿Eliminar “${r.name}”?`)) return false;
    if (r.mediaId) await HZ.deleteMedia(r.mediaId);
    const replies = app.state.replies
      .filter((x) => x.id !== id)
      .map((x) => (x.type === 'sequence' ? { ...x, items: (x.items || []).filter((it) => it.replyId !== id) } : x));
    await app.save({ replies });
    return true;
  }

  // ---------- eventos ----------
  const ov = app.el.ov;
  ov.addEventListener('input', (e) => {
    if (!draft) return;
    const t = e.target;
    if (t.dataset.k) draft[t.dataset.k] = t.dataset.k === 'typing' ? Number(t.value) : t.value;
    if (t.dataset.delay !== undefined) draft.items[+t.dataset.delay].delay = Number(t.value) || 0;
    updateMissing();
  });
  ov.addEventListener('change', (e) => {
    if (!draft) return;
    const t = e.target;
    if (t.dataset.k === 'afterStage') draft.afterStage = t.value;
    if (t.matches('[data-file]')) setFile(t.files[0]);
  });
  ov.addEventListener('click', async (e) => {
    if (!draft || !modal || !modal.isConnected) return;
    const t = e.target.closest('[data-x],[data-sw],[data-var],[data-more],[data-drop],[data-mv],[data-rmi],[data-addid]');
    if (!t) return;
    const d = draft;
    if (t.dataset.sw) {
      const k = t.dataset.sw;
      d[k] = k === 'typing' ? (d.typing ? 0 : 3) : !d[k];
      return draw();
    }
    if (t.dataset.var) {
      const ta = modal.querySelector(`[data-k="${t.dataset.target}"]`);
      const s = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, s) + t.dataset.var + ta.value.slice(ta.selectionEnd ?? s);
      d[t.dataset.target] = ta.value;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + t.dataset.var.length;
      return updateMissing();
    }
    if (t.dataset.more !== undefined) { moreOpen = !moreOpen; return draw(); }
    if (t.dataset.drop !== undefined) return modal.querySelector('[data-file]').click();
    if (t.dataset.mv) {
      const [i, dir] = t.dataset.mv.split(':').map(Number);
      const j = i + dir;
      [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
      if (j === 0 || i === 0) d.items[0].delay = 0;
      return draw();
    }
    if (t.dataset.rmi !== undefined) { d.items.splice(+t.dataset.rmi, 1); if (d.items[0]) d.items[0].delay = 0; return draw(); }
    if (t.dataset.addid) {
      d.items.push({ replyId: t.dataset.addid, delay: d.items.length ? app.state.settings.stepDelay : 0 });
      pickerOpen = false;
      return draw();
    }
    switch (t.dataset.x) {
      case 'cancel': return app.closeModal();
      case 'back': stopRec(); return pick();
      case 'save': return save();
      case 'delete': if (await remove(d.id)) app.closeModal(); return;
      case 'clearmedia': d._media = null; return draw();
      case 'rec': return toggleRec();
      case 'file': return modal.querySelector('[data-file]').click();
      case 'addseq': pickerOpen = !pickerOpen; return draw();
    }
  });
  ov.addEventListener('dragover', (e) => {
    const z = e.target.closest && e.target.closest('[data-drop]');
    if (z) { e.preventDefault(); z.classList.add('over'); }
  });
  ov.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) z.classList.remove('over'); });
  ov.addEventListener('drop', (e) => {
    const z = e.target.closest && e.target.closest('[data-drop]');
    if (!z) return;
    e.preventDefault();
    setFile(e.dataTransfer.files[0]);
  });

  HZ.editor = { pick, open, remove };
})();
