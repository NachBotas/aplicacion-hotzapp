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
          <span>Secuencia de mensajes<small>Armá varios mensajes (texto, audio, imagen…) en uno solo, con esperas entre medio.</small></span></button>
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
      : { id: null, type, name: '', category: '', shortcut: '', favorite: false, uses: 0, text: '', caption: '', viewOnce: false, asVoice: true, typing: 0, contactName: '', contactPhone: '', items: [], afterStage: '', recSecs: 3, recReal: false };
    if (draft.mediaId) draft._media = await HZ.getMedia(draft.mediaId);
    if (draft.type === 'sequence') {
      draft.items = HZ.seqItems(draft).map((it) => (it.type === 'msg' ? { type: 'msg', msg: { ...it.msg } } : it));
      for (const it of draft.items) if (it.type === 'msg' && it.msg.mediaId) it.msg._media = await HZ.getMedia(it.msg.mediaId);
    }
    if (draft.type === 'audio' && draft.recSecs === undefined) draft.recSecs = 3;
    if (draft.type === 'audio' && draft._media) setTimeout(loadDur, 0);
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
    if (d.type === 'sequence') {
      if (!d.items.some((it) => it.type !== 'wait')) n++;
      for (const it of d.items) if (it.type === 'msg') n += msgMissing(it.msg);
    }
    return n;
  }

  function msgMissing(m) {
    if (m.type === 'text') return String(m.text || '').trim() ? 0 : 1;
    if (m.type === 'contact') return (String(m.contactName || '').trim() ? 0 : 1) + (String(m.contactPhone || '').trim() ? 0 : 1);
    return m._media ? 0 : 1;
  }

  // objetivo de una acción: el borrador principal o un paso propio de la secuencia
  const tgt = (i) => (i === undefined || i === null || i === '' ? draft : draft.items[+i].msg);
  const ia = (i) => (i === undefined || i === null || i === '' ? '' : ` data-i="${i}"`);

  const sw = (key, label, help = '') =>
    `<div class="sw ${draft[key] ? 'on' : ''}" data-sw="${key}"><span class="tr"></span><span>${label}</span></div>${help ? `<div class="help" style="margin:0 0 8px">${help}</div>` : ''}`;
  const chips = (target, small) => small ? `<div class="chips">${HZ.VARS.map((v) => `<button type="button" class="vchip" data-var="${v.token}" data-target="${target}">${v.label}</button>`).join('')}</div>` : `<div class="chips">${HZ.VARS.map((v) => `<button type="button" class="vchip" data-var="${v.token}" data-target="${target}">${v.label}</button>`).join('')}</div>
    <div class="help">Haz clic para agregar. Al enviar, se cambia por el dato real.</div>`;
  const shortcutField = () => `<div class="field"><label>Atajo</label><div class="short"><input data-k="shortcut" value="${esc(draft.shortcut)}" placeholder="atajo"></div></div>`;
  const more = (label, inner) => `
    <div class="more ${moreOpen ? 'open' : ''}" data-more>${I('chevronDown', 14)} Más opciones <span class="opt">(${label})</span></div>
    <div ${moreOpen ? '' : 'hidden'} data-morebody>${inner}</div>`;

  function mediaBlock(i) {
    const d = tgt(i);
    const m = d._media;
    const A = ia(i);
    const recHere = rec && String(rec.i ?? '') === String(i ?? '');
    if (m) {
      const pv =
        d.type === 'image' ? `<img src="${m.dataUrl}" alt="">` :
        d.type === 'video' ? `<video src="${m.dataUrl}" controls></video>` :
        d.type === 'audio' ? `<audio src="${m.dataUrl}" controls></audio>` :
        `<span style="color:${HZ.TYPES.document.color}">${I('file', 28)}</span><span class="grow">${esc(m.name)}<div class="help">${(m.size / 1024 / 1024 || 0).toFixed(2)} MB</div></span>`;
      return `<div class="preview">${pv}<button type="button" class="btn sm ghost" data-x="clearmedia"${A}>Cambiar</button></div>`;
    }
    if (d.type === 'audio') {
      return `<div class="two">
        <button type="button" class="big ${recHere ? 'rec' : ''}" data-x="rec"${A}>${I(recHere ? 'stop' : 'mic', 20)}${recHere ? 'Detener grabación' : 'Grabar ahora'}${recHere ? '<small>● grabando…</small>' : ''}</button>
        <button type="button" class="big" data-x="file"${A}>${I('file', 20)}Elegir archivo<small>${ACCEPT.audio.hint}</small></button>
      </div><input type="file" hidden accept="${ACCEPT.audio.accept}" data-file${A}>
      ${A ? '' : '<div class="help">Se guarda una copia dentro de HotZapp y entra en tu <b>Copia de seguridad</b>.</div>'}`;
    }
    return `<div class="drop" data-drop${A}>Haz clic aquí o arrastra el archivo.<small>${ACCEPT[d.type].hint}</small></div>
      ${A ? '' : '<div class="help">Se guarda una copia dentro de HotZapp y entra en tu <b>Copia de seguridad</b>. Te recomendamos tener los originales juntos en una carpeta.</div>'}
      <input type="file" hidden accept="${ACCEPT[d.type].accept}" data-file${A}>`;
  }

  function msgCard(m, i, ctl) {
    const T = HZ.TYPES[m.type];
    const A = ` data-i="${i}"`;
    const isw = (k, label, on) => `<div class="sw ${on ? 'on' : ''}" data-isw="${k}"${A} style="margin:6px 0"><span class="tr"></span><span>${label}</span></div>`;
    let body = '';
    if (m.type === 'text') {
      body = `<textarea data-ik="text"${A} style="min-height:64px" placeholder="Escribí el mensaje…">${esc(m.text || '')}</textarea>${chips(i + ':text', true)}
        <div class="row" style="margin-top:6px"><span class="help" style="margin:0">✍️ “escribiendo…”</span><input type="number" min="0" max="60" data-ik="typing"${A} value="${Number(m.typing) || 0}" style="width:64px;padding:4px 6px"><span class="help" style="margin:0">s</span></div>`;
    } else if (m.type === 'contact') {
      body = `<div class="two"><input data-ik="contactName"${A} value="${esc(m.contactName || '')}" placeholder="Nombre del contacto"><input data-ik="contactPhone"${A} value="${esc(m.contactPhone || '')}" placeholder="Teléfono"></div>`;
    } else {
      body = mediaBlock(i);
      if (m.type === 'audio') {
        body += isw('asVoice', 'Como nota de voz (grabado al momento)', m.asVoice !== false);
        if (m.asVoice !== false) body += `<div class="row"><span class="help" style="margin:0">🎤 “grabando audio…”</span>
          <input type="number" min="0" max="600" data-ik="recSecs"${A} value="${m.recReal ? '' : (m.recSecs ?? 3)}" ${m.recReal ? 'disabled' : ''} style="width:64px;padding:4px 6px"><span class="help" style="margin:0">s</span>
          <span class="grow"></span>${isw('recReal', 'lo que dura el audio', !!m.recReal)}</div>`;
      } else {
        body += `<textarea data-ik="caption"${A} style="min-height:44px;margin-top:8px" placeholder="Texto que acompaña (opcional)">${esc(m.caption || '')}</textarea>${chips(i + ':caption', true)}`;
        if (m.type !== 'document') body += isw('viewOnce', 'Ver una sola vez', !!m.viewOnce);
      }
    }
    return `<div class="seqm"><div class="seqm-h"><span class="ticon" style="background:${T.color}22;color:${T.color}">${I(T.icon, 14)}</span>
      <span class="n"><b>${T.label}</b>${msgMissing(m) ? ' <span class="req" style="font-size:11px">· falta completar</span>' : ''}</span>${ctl}</div>${body}</div>`;
  }

  function seqBlock() {
    const d = draft;
    const avail = app.state.replies.filter((r) => r.type !== 'sequence' && r.id !== d.id);
    return `
      <div class="lbl">Mensajes, en orden <span class="opt">· salen una tras otra, con la espera que elijas</span></div>
      ${d.items.map((it, i) => {
        const ctl = `<button type="button" class="ib" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="ib" data-mv="${i}:1" ${i === d.items.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="ib" data-rmi="${i}">${I('x', 14)}</button>`;
        if (it.type === 'wait') {
          return `<div class="seqi wait"><span class="ticon" style="background:#8d959922;color:#c0c6c9">${I('clock', 14)}</span><span class="n">Esperar</span>
            <input type="number" min="0" step="1" data-wsecs="${i}" value="${it.secs}"><span class="help" style="margin:0">segundos</span>${ctl}</div>`;
        }
        if (it.type === 'msg') return msgCard(it.msg, i, ctl);
        const r = app.state.replies.find((x) => x.id === it.replyId);
        const sim = r && r.type === 'audio' && r.asVoice !== false ? ` · 🎤 ${r.recReal ? 'duración del audio' : (r.recSecs ?? 3) + ' s'}` : r && r.type === 'text' && r.typing ? ` · ✍️ ${r.typing} s` : '';
        return `<div class="seqi">${r ? app.typeIcon(r.type, 14) : ''}<span class="n">${esc(r ? r.name : '(borrada)')}<span class="help" style="margin:0">${sim}</span></span>${ctl}</div>`;
      }).join('')}
      <div class="lbl" style="margin:12px 0 6px">Agregar un mensaje nuevo</div>
      <div class="addtypes">${['text', 'audio', 'image', 'video', 'document', 'contact'].map((k) => `<button type="button" class="addtype" data-addmsg="${k}"><span style="color:${HZ.TYPES[k].color}">${I(HZ.TYPES[k].icon, 16)}</span>${HZ.TYPES[k].label}</button>`).join('')}</div>
      <div class="seqbtns" style="margin-top:8px">
        <div class="addseq" data-x="addwait" style="color:var(--fg)">⏱ Agregar temporizador</div>
        <div class="addseq" data-x="addseq">+ Usar una respuesta guardada</div>
      </div>
      ${pickerOpen ? `<div class="picker scroll">${avail.length ? avail.map((r) => `<div class="pi" data-addid="${r.id}">${app.typeIcon(r.type, 14)}<span class="grow">${esc(r.name)}</span></div>`).join('') : '<div class="empty">Primero creá respuestas de texto, audio, imagen, etc.</div>'}</div>` : ''}
      <div class="help">Armá la secuencia completa acá: cada mensaje se crea y edita en el mismo lugar. Poné temporizadores entre medio para que parezca más natural. También podés sumar respuestas que ya tenías guardadas.</div>
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
             <div class="help" style="margin:0 0 6px 42px">El otro ve “escribiendo…” durante esos segundos y después le llega el mensaje.</div>
             ${d.typing ? `<div class="row" style="margin:4px 0 10px 42px"><input type="number" min="1" max="60" step="1" data-k="typing" value="${d.typing}" style="width:80px"><span class="help" style="margin:0">segundos</span></div>` : ''}`);
        break;
      case 'audio':
        body = nameF + catF +
          `<div class="field"><label>Audio <span class="req">*</span></label>${mediaBlock()}</div>` +
          sw('asVoice', 'Enviar como audio grabado al momento', 'Llega como mensaje de voz de WhatsApp (con su onda), no como archivo adjunto.') +
          (d.asVoice !== false ? `<div class="item" style="margin:4px 0 12px">
            <div class="lbl" style="margin-bottom:8px">🎤 Simular “grabando audio…” antes de enviar</div>
            <div class="row" style="flex-wrap:wrap">
              <input type="number" min="0" max="600" step="1" data-k="recSecs" value="${d.recReal ? '' : (d.recSecs ?? 3)}" ${d.recReal ? 'disabled' : ''} style="width:80px">
              <span class="help" style="margin:0">segundos</span>
              <span class="grow"></span>
              <div class="sw ${d.recReal ? 'on' : ''}" data-sw="recReal" style="margin:0"><span class="tr"></span><span>lo que dura el audio${d._dur ? ` (${Math.round(d._dur)} s)` : ''}</span></div>
            </div>
            <div class="help">El otro ve “grabando audio…” durante ese tiempo y después le llega la nota de voz. Poné 0 para mandarlo al instante. Mientras tanto podés seguir con otros chats, y cancelarlo desde la barra de abajo (⏹).</div>
          </div>` : '') +
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
  async function setFile(f, i) {
    if (!f) return;
    if (f.size > MAX) return app.toast('El archivo es muy grande (máx. 64 MB).');
    const d = tgt(i);
    d._media = { name: f.name, mime: f.type || 'application/octet-stream', size: f.size, dataUrl: await HZ.fileToDataUrl(f), _new: true };
    if (d === draft && !draft.name) draft.name = f.name.replace(/\.[^.]+$/, '');
    d._dur = 0;
    draw();
    if (d.type === 'audio') loadDur(i);
  }

  async function loadDur(i) {
    const owner = draft;
    const d = owner && tgt(i);
    if (!d || !d._media || !HZ.audioDuration) return;
    const dur = await HZ.audioDuration({ id: 'draft-' + d._media.dataUrl.length + '-' + (d._media.size || 0), dataUrl: d._media.dataUrl });
    if (draft === owner && dur) { d._dur = dur; draw(); }
  }

  async function toggleRec(i) {
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
      const d = tgt(i);
      d._media = { name: 'grabacion.' + (blob.type.includes('ogg') ? 'ogg' : 'webm'), mime: blob.type, size: blob.size, dataUrl: await HZ.fileToDataUrl(blob), _new: true };
      d._dur = 0;
      draw();
      loadDur(i);
    };
    rec = { mr, i };
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
    const { _media, _dur, ...clean } = d;
    if (clean.type === 'audio') clean.recSecs = Math.max(0, Number(d.recSecs ?? 3));
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
    if (clean.type === 'sequence') {
      const keep = new Set();
      const items = [];
      for (const it of d.items) {
        if (it.type !== 'msg') { items.push(it); continue; }
        const { _media: mm, _dur: _x, ...msg } = it.msg;
        if (mm && mm._new) {
          const { _new, ...m } = mm;
          msg.mediaId = (await HZ.saveMedia({ ...m, id: undefined })).id;
        }
        if (!['audio', 'image', 'video', 'document'].includes(msg.type)) delete msg.mediaId;
        if (msg.mediaId) keep.add(msg.mediaId);
        msg.typing = Number(msg.typing) || 0;
        if (msg.type === 'audio') msg.recSecs = Math.max(0, Number(msg.recSecs ?? 3));
        items.push({ type: 'msg', msg });
      }
      clean.items = items;
      for (const it of (old && old.items) || []) if (it.type === 'msg' && it.msg && it.msg.mediaId && !keep.has(it.msg.mediaId)) await HZ.deleteMedia(it.msg.mediaId);
    }
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
    for (const it of r.items || []) if (it.type === 'msg' && it.msg && it.msg.mediaId) await HZ.deleteMedia(it.msg.mediaId);
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
    if (t.dataset.wsecs !== undefined) draft.items[+t.dataset.wsecs].secs = Math.max(0, Number(t.value) || 0);
    if (t.dataset.k === 'recSecs') draft.recSecs = Math.max(0, Number(t.value) || 0);
    if (t.dataset.ik && t.dataset.i !== undefined) {
      const m = draft.items[+t.dataset.i].msg;
      m[t.dataset.ik] = ['typing', 'recSecs'].includes(t.dataset.ik) ? Math.max(0, Number(t.value) || 0) : t.value;
    }
    updateMissing();
  });
  ov.addEventListener('change', (e) => {
    if (!draft) return;
    const t = e.target;
    if (t.dataset.k === 'afterStage') draft.afterStage = t.value;
    if (t.matches('[data-file]')) setFile(t.files[0], t.dataset.i);
  });
  ov.addEventListener('click', async (e) => {
    if (!draft || !modal || !modal.isConnected) return;
    const t = e.target.closest('[data-x],[data-sw],[data-isw],[data-var],[data-more],[data-drop],[data-mv],[data-rmi],[data-addid],[data-addmsg]');
    if (!t) return;
    const d = draft;
    if (t.dataset.sw) {
      const k = t.dataset.sw;
      d[k] = k === 'typing' ? (d.typing ? 0 : 3) : !d[k];
      if (k === 'recReal' && d.recReal && d._media && !d._dur) loadDur();
      return draw();
    }
    if (t.dataset.isw) {
      const m = d.items[+t.dataset.i].msg;
      const k = t.dataset.isw;
      m[k] = k === 'asVoice' ? m.asVoice === false : !m[k];
      if (k === 'recReal' && m.recReal && m._media && !m._dur) loadDur(t.dataset.i);
      return draw();
    }
    if (t.dataset.addmsg) {
      const k = t.dataset.addmsg;
      d.items.push({ type: 'msg', msg: { type: k, text: '', caption: '', typing: 0, asVoice: true, recSecs: 3, recReal: false, viewOnce: false, contactName: '', contactPhone: '' } });
      pickerOpen = false;
      draw();
      const cards = modal.querySelectorAll('.seqm');
      const last = cards[cards.length - 1];
      if (last) { last.scrollIntoView({ block: 'center' }); const f = last.querySelector('textarea,input'); if (f && k !== 'audio') f.focus(); }
      return;
    }
    if (t.dataset.var) {
      const [ti, tf] = t.dataset.target.includes(':') ? t.dataset.target.split(':') : [null, t.dataset.target];
      const ta = ti !== null ? modal.querySelector(`[data-ik="${tf}"][data-i="${ti}"]`) : modal.querySelector(`[data-k="${tf}"]`);
      const s = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, s) + t.dataset.var + ta.value.slice(ta.selectionEnd ?? s);
      if (ti !== null) d.items[+ti].msg[tf] = ta.value;
      else d[tf] = ta.value;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + t.dataset.var.length;
      return updateMissing();
    }
    if (t.dataset.more !== undefined) { moreOpen = !moreOpen; return draw(); }
    if (t.dataset.drop !== undefined) return fileInput(t.dataset.i).click();
    if (t.dataset.mv) {
      const [i, dir] = t.dataset.mv.split(':').map(Number);
      const j = i + dir;
      stopRec();
      [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
      return draw();
    }
    if (t.dataset.rmi !== undefined) { stopRec(); d.items.splice(+t.dataset.rmi, 1); return draw(); }
    if (t.dataset.addid) {
      d.items.push({ type: 'reply', replyId: t.dataset.addid });
      pickerOpen = false;
      return draw();
    }
    switch (t.dataset.x) {
      case 'cancel': return app.closeModal();
      case 'back': stopRec(); return pick();
      case 'save': return save();
      case 'delete': if (await remove(d.id)) app.closeModal(); return;
      case 'clearmedia': tgt(t.dataset.i)._media = null; return draw();
      case 'rec': return toggleRec(t.dataset.i);
      case 'file': return fileInput(t.dataset.i).click();
      case 'addseq': pickerOpen = !pickerOpen; return draw();
      case 'addwait': d.items.push({ type: 'wait', secs: Number(app.state.settings.stepDelay) || 3 }); pickerOpen = false; return draw();
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
    setFile(e.dataTransfer.files[0], z.dataset.i);
  });

  const fileInput = (i) => (i === undefined || i === '' ? modal.querySelector('[data-file]:not([data-i])') : modal.querySelector(`[data-file][data-i="${i}"]`));

  HZ.editor = { pick, open, remove };
})();
