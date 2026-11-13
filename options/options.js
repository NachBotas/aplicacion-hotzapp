// Página de configuración de HotZapp.
const view = document.getElementById('view');
const esc = HZ.escape;
let state = null;

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function route() {
  const [sec, arg] = (location.hash.slice(1) || 'replies').split('/');
  document.querySelectorAll('.nav > a').forEach((a) => a.classList.toggle('on', a.dataset.sec === sec));
  ({ replies: renderReplies, funnel: renderFunnel, scheduled: renderScheduled, settings: renderSettings }[sec] || renderReplies)();
  if (sec === 'replies' && arg === 'new') {
    history.replaceState(null, '', '#replies');
    openEditor(null);
  }
}

// =================== RESPUESTAS ===================
function renderReplies() {
  view.innerHTML = `
    <div class="head">
      <div><h1>Respuestas rápidas</h1>
      <p class="sub">Cada respuesta puede tener varios pasos: textos, imágenes y audios (se envían como nota de voz recién grabada).</p></div>
      <button class="btn" id="new">＋ Nueva respuesta</button>
    </div>
    ${
      state.replies.length
        ? `<div class="list">${state.replies
            .map((r) => {
              const steps = r.steps || [];
              const txt = steps.find((s) => s.type === 'text');
              return `<div class="card">
                <h3>${esc(r.title)} ${r.shortcut ? `<span class="kbd">${esc(r.shortcut)}</span>` : ''}</h3>
                <div class="meta">${steps.map((s) => HZ.stepIcon(s.type)).join(' ')} · ${steps.length} paso${steps.length === 1 ? '' : 's'}${txt ? '\n' + esc(txt.text.slice(0, 140)) : ''}</div>
                <div class="actions">
                  <button class="btn small ghost" data-dup="${r.id}">Duplicar</button>
                  <button class="btn small danger" data-del="${r.id}">Eliminar</button>
                  <button class="btn small" data-edit="${r.id}">Editar</button>
                </div></div>`;
            })
            .join('')}</div>`
        : `<div class="empty">Todavía no hay respuestas. Creá la primera con “Nueva respuesta”.</div>`
    }`;
  view.querySelector('#new').onclick = () => openEditor(null);
  view.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => openEditor(b.dataset.edit)));
  view.querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = async () => {
        const r = state.replies.find((x) => x.id === b.dataset.del);
        if (!confirm(`¿Eliminar “${r.title}”?`)) return;
        for (const s of r.steps || []) if (s.mediaId) await HZ.deleteMedia(s.mediaId);
        await HZ.set({ replies: state.replies.filter((x) => x.id !== r.id) });
      })
  );
  view.querySelectorAll('[data-dup]').forEach(
    (b) =>
      (b.onclick = async () => {
        const r = state.replies.find((x) => x.id === b.dataset.dup);
        const steps = [];
        for (const s of r.steps || []) {
          const ns = { ...s, id: HZ.uid() };
          if (s.mediaId) {
            const m = await HZ.getMedia(s.mediaId);
            if (m) ns.mediaId = (await HZ.saveMedia({ ...m, id: undefined })).id;
          }
          steps.push(ns);
        }
        await HZ.set({ replies: [...state.replies, { ...r, id: HZ.uid(), title: r.title + ' (copia)', shortcut: '', steps }] });
      })
  );
}

// ---------- editor ----------
const dlg = document.getElementById('editor');
let draft = null; // { id, title, shortcut, steps: [...] }
let recorder = null;

async function openEditor(id) {
  const r = id ? state.replies.find((x) => x.id === id) : null;
  draft = r ? structuredClone(r) : { id: null, title: '', shortcut: '', steps: [{ id: HZ.uid(), type: 'text', text: '', delay: 0 }] };
  for (const s of draft.steps) if (s.mediaId) s._media = await HZ.getMedia(s.mediaId);
  document.getElementById('ed-title').textContent = r ? 'Editar respuesta' : 'Nueva respuesta';
  document.getElementById('ed-name').value = draft.title;
  document.getElementById('ed-short').value = draft.shortcut || '';
  renderSteps();
  dlg.showModal();
}

function renderSteps() {
  const box = document.getElementById('ed-steps');
  box.innerHTML = draft.steps
    .map((s, i) => {
      const head = `<div class="sh">${HZ.stepIcon(s.type)} Paso ${i + 1} · ${{ text: 'Texto', image: 'Imagen', audio: 'Audio (nota de voz)' }[s.type]}
        <span class="sp"></span>
        ${i > 0 ? `<span class="help">esperar</span><input type="number" min="0" step="0.5" data-k="delay" data-i="${i}" value="${s.delay ?? state.settings.stepDelay}"><span class="help">s</span>` : ''}
        <button type="button" class="btn small ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn small ghost" data-down="${i}" ${i === draft.steps.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="btn small danger" data-rm="${i}">✕</button></div>`;
      if (s.type === 'text') return `<div class="step">${head}<textarea rows="4" data-k="text" data-i="${i}" placeholder="Escribí el mensaje…">${esc(s.text || '')}</textarea></div>`;
      if (s.type === 'image')
        return `<div class="step">${head}
          ${s._media ? `<img src="${s._media.dataUrl}" alt="">` : ''}
          <div class="media-row"><input type="file" accept="image/*" data-file="${i}"></div>
          <textarea rows="2" data-k="caption" data-i="${i}" placeholder="Texto que acompaña la imagen (opcional)" style="margin-top:8px">${esc(s.caption || '')}</textarea></div>`;
      return `<div class="step">${head}
        ${s._media ? `<audio controls src="${s._media.dataUrl}"></audio>` : ''}
        <div class="media-row">
          <button type="button" class="btn small ${recorder && recorder.i === i ? 'danger' : 'ghost'}" data-rec="${i}">${recorder && recorder.i === i ? '⏹ Detener' : '🎙️ Grabar'}</button>
          ${recorder && recorder.i === i ? '<span class="rec">● Grabando…</span>' : ''}
          <span class="help">o subí un archivo:</span><input type="file" accept="audio/*" data-file="${i}" style="width:auto">
        </div></div>`;
    })
    .join('');
}

const edSteps = document.getElementById('ed-steps');
edSteps.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.k) draft.steps[+t.dataset.i][t.dataset.k] = t.dataset.k === 'delay' ? Number(t.value) : t.value;
});
edSteps.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.file === undefined || !t.files[0]) return;
  const f = t.files[0];
  if (f.size > 16 * 1024 * 1024) return alert('El archivo es muy grande (máx. 16 MB).');
  draft.steps[+t.dataset.file]._media = { name: f.name, mime: f.type, dataUrl: await HZ.fileToDataUrl(f), _new: true };
  renderSteps();
});
edSteps.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.rm !== undefined) draft.steps.splice(+d.rm, 1);
  else if (d.up !== undefined) { const i = +d.up; [draft.steps[i - 1], draft.steps[i]] = [draft.steps[i], draft.steps[i - 1]]; }
  else if (d.down !== undefined) { const i = +d.down; [draft.steps[i + 1], draft.steps[i]] = [draft.steps[i], draft.steps[i + 1]]; }
  else if (d.rec !== undefined) return toggleRecord(+d.rec);
  renderSteps();
});

async function toggleRecord(i) {
  if (recorder) {
    recorder.mr.stop();
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    return alert('No se pudo acceder al micrófono: ' + err.message);
  }
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
  mr.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
    draft.steps[i]._media = { name: 'grabacion.webm', mime: blob.type, dataUrl: await HZ.fileToDataUrl(blob), _new: true };
    recorder = null;
    renderSteps();
  };
  recorder = { mr, i };
  mr.start();
  renderSteps();
}

document.querySelectorAll('[data-add]').forEach(
  (b) =>
    (b.onclick = () => {
      draft.steps.push({ id: HZ.uid(), type: b.dataset.add, text: '', caption: '', delay: state.settings.stepDelay });
      renderSteps();
    })
);
document.getElementById('ed-cancel').onclick = () => {
  if (recorder) recorder.mr.stop();
  dlg.close();
};
document.getElementById('ed-save').onclick = async () => {
  if (recorder) return alert('Detené la grabación antes de guardar.');
  draft.title = document.getElementById('ed-name').value.trim();
  let sc = document.getElementById('ed-short').value.trim().replace(/\s+/g, '');
  if (sc && !sc.startsWith('/')) sc = '/' + sc;
  draft.shortcut = sc;
  if (!draft.title) return alert('Ponele un nombre a la respuesta.');
  if (!draft.steps.length) return alert('Agregá al menos un paso.');
  for (const [i, s] of draft.steps.entries()) {
    if (s.type === 'text' && !String(s.text || '').trim()) return alert(`El paso ${i + 1} está vacío.`);
    if (s.type !== 'text' && !s._media) return alert(`Falta el archivo del paso ${i + 1}.`);
  }
  if (sc && state.replies.some((r) => r.shortcut === sc && r.id !== draft.id)) return alert(`El atajo ${sc} ya lo usa otra respuesta.`);

  const old = draft.id ? state.replies.find((r) => r.id === draft.id) : null;
  const oldMedia = new Set((old?.steps || []).map((s) => s.mediaId).filter(Boolean));
  const steps = [];
  for (const s of draft.steps) {
    const { _media, ...clean } = s;
    if (s.type === 'text') delete clean.mediaId;
    else if (_media && _media._new) {
      const { _new, ...m } = _media;
      clean.mediaId = (await HZ.saveMedia({ ...m, id: undefined })).id;
    }
    if (clean.mediaId) oldMedia.delete(clean.mediaId);
    steps.push(clean);
  }
  for (const id of oldMedia) await HZ.deleteMedia(id);
  const reply = { id: draft.id || HZ.uid(), title: draft.title, shortcut: draft.shortcut, steps };
  const replies = draft.id ? state.replies.map((r) => (r.id === draft.id ? reply : r)) : [...state.replies, reply];
  await HZ.set({ replies });
  dlg.close();
  toast('Respuesta guardada ✅');
};

// =================== EMBUDO (Kanban) ===================
function renderFunnel() {
  const names = Object.keys(state.contacts);
  view.innerHTML = `
    <div class="head"><div><h1>Embudo de ventas</h1>
    <p class="sub">Arrastrá los contactos entre etapas. También podés etiquetar el chat abierto desde el panel en WhatsApp Web.</p></div></div>
    <div class="board">
      ${state.stages
        .map((st, si) => {
          const items = names.filter((n) => state.contacts[n].stageId === st.id);
          return `<section class="col" data-stage="${esc(st.id)}">
            <header>
              <input type="color" value="${esc(st.color)}" data-color="${si}" title="Color">
              <input type="text" value="${esc(st.name)}" data-sname="${si}">
              <span class="cnt">${items.length}</span>
              <button class="btn small ghost" data-sdel="${si}" title="Eliminar etapa">✕</button>
            </header>
            <div class="items">
              ${items
                .map(
                  (n) => `<div class="lead" draggable="true" data-lead="${esc(n)}">
                    <button class="x" data-ldel="${esc(n)}" title="Quitar">✕</button><b>${esc(n)}</b>
                    <textarea placeholder="Nota…" data-note="${esc(n)}">${esc(state.contacts[n].note || '')}</textarea></div>`
                )
                .join('')}
            </div>
            <footer><input placeholder="＋ Agregar contacto" title="Nombre del chat tal como aparece en WhatsApp" data-addlead="${esc(st.id)}"></footer>
          </section>`;
        })
        .join('')}
      <div class="add-col"><button class="btn ghost" id="add-stage">＋ Nueva etapa</button></div>
    </div>`;

  view.querySelector('#add-stage').onclick = () =>
    HZ.set({ stages: [...state.stages, { id: HZ.uid(), name: 'Nueva etapa', color: '#0ea5e9' }] });

  view.querySelectorAll('[data-sname]').forEach((inp) => (inp.onchange = () => { state.stages[+inp.dataset.sname].name = inp.value.trim() || 'Etapa'; HZ.set({ stages: state.stages }); }));
  view.querySelectorAll('[data-color]').forEach((inp) => (inp.onchange = () => { state.stages[+inp.dataset.color].color = inp.value; HZ.set({ stages: state.stages }); }));
  view.querySelectorAll('[data-sdel]').forEach(
    (b) =>
      (b.onclick = () => {
        const st = state.stages[+b.dataset.sdel];
        const n = Object.values(state.contacts).filter((c) => c.stageId === st.id).length;
        if (!confirm(`¿Eliminar la etapa “${st.name}”?${n ? ` Se quitarán ${n} contacto(s).` : ''}`)) return;
        const contacts = Object.fromEntries(Object.entries(state.contacts).filter(([, c]) => c.stageId !== st.id));
        HZ.set({ stages: state.stages.filter((s) => s.id !== st.id), contacts });
      })
  );
  view.querySelectorAll('[data-addlead]').forEach(
    (inp) =>
      (inp.onkeydown = (e) => {
        if (e.key !== 'Enter' || !inp.value.trim()) return;
        inp.blur();
        HZ.set({ contacts: { ...state.contacts, [inp.value.trim()]: { stageId: inp.dataset.addlead, updatedAt: Date.now() } } });
      })
  );
  view.querySelectorAll('[data-ldel]').forEach(
    (b) => (b.onclick = () => { const c = { ...state.contacts }; delete c[b.dataset.ldel]; HZ.set({ contacts: c }); })
  );
  view.querySelectorAll('[data-note]').forEach(
    (t) => (t.onchange = () => { const c = { ...state.contacts }; c[t.dataset.note] = { ...c[t.dataset.note], note: t.value }; HZ.set({ contacts: c }); })
  );
  // drag & drop
  view.querySelectorAll('.lead').forEach((el) => (el.ondragstart = (e) => e.dataTransfer.setData('text/plain', el.dataset.lead)));
  view.querySelectorAll('.col').forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add('over'); };
    col.ondragleave = () => col.classList.remove('over');
    col.ondrop = (e) => {
      e.preventDefault();
      col.classList.remove('over');
      const n = e.dataTransfer.getData('text/plain');
      if (!n || !state.contacts[n]) return;
      HZ.set({ contacts: { ...state.contacts, [n]: { ...state.contacts[n], stageId: col.dataset.stage, updatedAt: Date.now() } } });
    };
  });
}

// =================== PROGRAMADOS ===================
function renderScheduled() {
  const items = [...state.scheduled].sort((a, b) => b.at - a.at);
  const label = { pending: 'Pendiente', sending: 'Enviando', sent: 'Enviado', failed: 'Falló' };
  const local = new Date(Date.now() + 3600000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  view.innerHTML = `
    <div class="head"><div><h1>Mensajes programados</h1>
    <p class="sub">Se envían automáticamente a la hora indicada mientras WhatsApp Web esté abierto (aunque la pestaña no esté al frente).</p></div></div>
    <div class="form-inline">
      <label>Chat (nombre exacto en WhatsApp)<input id="s-chat" placeholder="Ej: Juan Pérez"></label>
      <label>Qué enviar<select id="s-what"><option value="__text">📝 Texto personalizado</option>
        ${state.replies.map((r) => `<option value="${r.id}">⚡ ${esc(r.title)}</option>`).join('')}</select></label>
      <label>Cuándo<input type="datetime-local" id="s-at" value="${local}"></label>
      <button class="btn" id="s-add">Programar</button>
      <label class="full" id="s-textwrap">Mensaje<textarea id="s-text" rows="2" placeholder="Podés usar {nombre} y {saludo}"></textarea></label>
    </div>
    ${
      items.length
        ? `<table><thead><tr><th>Chat</th><th>Mensaje</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>
      ${items
        .map((s) => {
          const r = s.kind === 'reply' ? state.replies.find((x) => x.id === s.replyId) : null;
          return `<tr><td><b>${esc(s.chatName)}</b></td>
            <td>${r ? '⚡ ' + esc(r.title) : s.kind === 'reply' ? '<i>(respuesta eliminada)</i>' : esc(s.text)}</td>
            <td>${new Date(s.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td><span class="badge ${s.status}">${label[s.status]}</span>${s.error ? `<div class="sub" style="margin:4px 0 0">${esc(s.error)}</div>` : ''}</td>
            <td><button class="btn small danger" data-sdel="${s.id}">Eliminar</button></td></tr>`;
        })
        .join('')}</tbody></table>`
        : '<div class="empty">No hay mensajes programados.</div>'
    }`;
  const what = view.querySelector('#s-what');
  what.onchange = () => (view.querySelector('#s-textwrap').hidden = what.value !== '__text');
  view.querySelector('#s-add').onclick = async () => {
    const chatName = view.querySelector('#s-chat').value.trim();
    const at = new Date(view.querySelector('#s-at').value).getTime();
    if (!chatName || !at) return alert('Completá el chat y la fecha.');
    const item = { id: HZ.uid(), chatName, at, status: 'pending', createdAt: Date.now() };
    if (what.value === '__text') {
      const text = view.querySelector('#s-text').value.trim();
      if (!text) return alert('Escribí el mensaje.');
      Object.assign(item, { kind: 'text', text });
    } else Object.assign(item, { kind: 'reply', replyId: what.value });
    await HZ.set({ scheduled: [...state.scheduled, item] });
    toast('Mensaje programado ⏰');
  };
  view.querySelectorAll('[data-sdel]').forEach((b) => (b.onclick = () => HZ.set({ scheduled: state.scheduled.filter((s) => s.id !== b.dataset.sdel) })));
}

// =================== AJUSTES ===================
function renderSettings() {
  const s = state.settings;
  view.innerHTML = `
    <h1>Ajustes</h1><p class="sub">Preferencias y copia de seguridad.</p>
    <div class="settings">
      <div class="card">
        <label>Espera por defecto entre pasos (segundos)<input type="number" min="0" step="0.5" id="o-delay" value="${s.stepDelay}"></label><br>
        <label>Ancho del panel en WhatsApp Web (px)<input type="number" min="280" max="600" id="o-width" value="${s.panelWidth}"></label><br>
        <label class="chk"><input type="checkbox" id="o-dots" ${s.showDots ? 'checked' : ''}> Mostrar puntos de color de la etapa en la lista de chats</label><br>
        <label class="chk"><input type="checkbox" id="o-slash" ${s.slashShortcuts ? 'checked' : ''}> Autocompletar respuestas al escribir “/” en la caja de mensaje</label>
      </div>
      <div class="card">
        <h3>Copia de seguridad</h3>
        <p class="sub">Exportá todo (respuestas, imágenes, audios, embudo y programados) en un archivo para pasarlo a otra computadora.</p>
        <div class="actions" style="justify-content:flex-start;display:flex;gap:8px">
          <button class="btn" id="o-export">⬇️ Exportar</button>
          <label class="btn ghost" style="color:var(--fg);font-size:14px">⬆️ Importar<input type="file" accept=".json" id="o-import" hidden></label>
        </div>
      </div>
      <div class="card">
        <h3>Uso responsable</h3>
        <p class="sub">HotZapp automatiza clics dentro de tu propio WhatsApp Web. No lo uses para spam ni envíos masivos a gente que no te escribió: WhatsApp puede restringir números que reciben muchos reportes.</p>
      </div>
    </div>`;
  const save = (patch) => HZ.set({ settings: { ...state.settings, ...patch } }).then(() => toast('Guardado'));
  view.querySelector('#o-delay').onchange = (e) => save({ stepDelay: Math.max(0, Number(e.target.value) || 0) });
  view.querySelector('#o-width').onchange = (e) => save({ panelWidth: Math.min(600, Math.max(280, Number(e.target.value) || 360)) });
  view.querySelector('#o-dots').onchange = (e) => save({ showDots: e.target.checked });
  view.querySelector('#o-slash').onchange = (e) => save({ slashShortcuts: e.target.checked });
  view.querySelector('#o-export').onclick = async () => {
    const all = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify({ app: 'hotzapp', version: 1, data: all })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hotzapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  view.querySelector('#o-import').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (json.app !== 'hotzapp' || !json.data) throw new Error('No es un backup de HotZapp');
      if (!confirm('Esto reemplaza todos tus datos actuales. ¿Continuar?')) return;
      await chrome.storage.local.clear();
      await chrome.storage.local.set(json.data);
      toast('Backup importado ✅');
    } catch (err) {
      alert('No se pudo importar: ' + err.message);
    }
  };
}

// =================== arranque ===================
async function load() {
  state = await HZ.getAll();
}
HZ.onChange(async () => {
  await load();
  // no re-dibujar mientras el usuario escribe en un campo de la vista
  const a = document.activeElement;
  if (a && view.contains(a) && a.matches('input[type=text],input:not([type]),textarea')) return;
  route();
});
window.addEventListener('hashchange', route);
load().then(route);
