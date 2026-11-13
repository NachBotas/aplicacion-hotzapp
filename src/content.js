// Panel de HotZapp dentro de WhatsApp Web + atajos "/" + puntos de etiqueta + agenda.
(function () {
  const HZ = globalThis.HZ;
  const wa = HZ.wa;
  const esc = HZ.escape;
  if (window.top !== window || document.getElementById('hotzapp-root')) return;

  let state = null; // { replies, stages, contacts, scheduled, settings }
  let tab = 'replies';
  let filter = '';
  let open = false;
  let busy = false;
  const queue = [];

  // ---------- montaje ----------
  const host = document.createElement('div');
  host.id = 'hotzapp-root';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>${HZ.PANEL_CSS}</style>
    <div class="hz">
      <button class="launcher" title="Abrir HotZapp">⚡ HotZapp</button>
      <aside class="panel" hidden>
        <header class="top">
          <div class="brand">
            <span class="logo">⚡</span><b>HotZapp</b>
            <button class="icon-btn" data-act="options" title="Configuración">⚙️</button>
            <button class="icon-btn" data-act="close" title="Cerrar">✕</button>
          </div>
          <div class="current"></div>
        </header>
        <nav class="tabs">
          <button data-tab="replies">⚡ Respuestas</button>
          <button data-tab="funnel">📊 Embudo</button>
          <button data-tab="agenda">⏰ Agenda</button>
        </nav>
        <div class="body"></div>
        <div class="status"></div>
      </aside>
      <div class="pop" hidden></div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const panel = $('.panel');
  const launcher = $('.launcher');
  const body = $('.body');
  const statusEl = $('.status');
  const currentEl = $('.current');
  const pop = $('.pop');

  // Empuja la interfaz de WhatsApp para que el panel no tape el chat.
  const pushStyle = document.createElement('style');
  document.documentElement.appendChild(pushStyle);
  function applyPush() {
    const w = (state && state.settings.panelWidth) || 360;
    panel.style.setProperty('--w', w + 'px');
    pushStyle.textContent = open
      ? `#app, body > #app { width: calc(100vw - ${w}px) !important; max-width: calc(100vw - ${w}px) !important; }`
      : '';
  }

  function setOpen(v) {
    open = v;
    panel.hidden = !v;
    launcher.hidden = v;
    applyPush();
    try { localStorage.setItem('hotzapp-open', v ? '1' : '0'); } catch (_) {}
    if (v) render();
  }

  // ---------- estado / mensajes ----------
  let statusTimer;
  function setStatus(msg, kind = '', progress = null) {
    clearTimeout(statusTimer);
    statusEl.className = 'status ' + kind;
    statusEl.innerHTML =
      `<span>${esc(msg)}</span>` + (progress != null ? `<div class="bar"><i style="width:${Math.round(progress * 100)}%"></i></div>` : '');
    if (kind === 'ok' || kind === 'err') statusTimer = setTimeout(() => (statusEl.innerHTML = ''), kind === 'err' ? 9000 : 4000);
  }

  // ---------- envío de respuestas ----------
  async function sendStep(step, ctx) {
    if (step.type === 'text') {
      await wa.sendText(HZ.fillVars(step.text, ctx));
    } else if (step.type === 'image') {
      const m = await HZ.getMedia(step.mediaId);
      if (!m) throw new Error('Falta la imagen de este paso.');
      const file = await HZ.dataUrlToFile(m.dataUrl, m.name || 'imagen.jpg', m.mime);
      await wa.sendImage(file, HZ.fillVars(step.caption || '', ctx));
    } else if (step.type === 'audio') {
      const m = await HZ.getMedia(step.mediaId);
      if (!m) throw new Error('Falta el audio de este paso.');
      await wa.sendVoice(m.dataUrl, (t, d) => setStatus(`🎤 Grabando audio… ${Math.round(t)}s / ${Math.round(d)}s`, '', t / d));
    }
  }

  async function runReply(reply, label) {
    const ctx = { chatName: wa.chatTitle() };
    const steps = reply.steps || [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const delay = Number(s.delay ?? state.settings.stepDelay) || 0;
      if (i > 0 && delay > 0) {
        setStatus(`⏳ Esperando ${delay}s antes del paso ${i + 1}/${steps.length}…`);
        await wa.sleep(delay * 1000);
      }
      setStatus(`${HZ.stepIcon(s.type)} Enviando paso ${i + 1}/${steps.length} de “${label || reply.title}”…`);
      await sendStep(s, ctx);
    }
  }

  // Cola: nunca se mandan dos respuestas a la vez.
  function enqueue(job) {
    return new Promise((resolve, reject) => {
      queue.push({ job, resolve, reject });
      pump();
    });
  }
  async function pump() {
    if (busy || !queue.length) return;
    busy = true;
    const { job, resolve, reject } = queue.shift();
    try { resolve(await job()); } catch (e) { reject(e); } finally { busy = false; pump(); }
  }

  async function sendReply(replyId) {
    const reply = state.replies.find((r) => r.id === replyId);
    if (!reply) return;
    try {
      await enqueue(() => runReply(reply));
      setStatus(`✅ “${reply.title}” enviada`, 'ok');
    } catch (e) {
      setStatus('⚠️ ' + e.message, 'err');
    }
  }

  // ---------- render ----------
  function render() {
    if (!state || !open) return;
    root.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    renderCurrent();
    if (tab === 'replies') renderReplies();
    else if (tab === 'funnel') renderFunnel();
    else renderAgenda();
  }

  let lastTitle = null;
  function renderCurrent() {
    const name = wa.chatTitle();
    lastTitle = name;
    if (!name) {
      currentEl.innerHTML = `<span class="name none">Abrí un chat para usar HotZapp</span>`;
      return;
    }
    const c = state.contacts[name];
    currentEl.innerHTML = `
      <span class="name" title="${esc(name)}">💬 ${esc(name)}</span>
      <select data-act="stage-current" title="Etapa del embudo">
        <option value="">Sin etiqueta</option>
        ${state.stages.map((s) => `<option value="${esc(s.id)}" ${c && c.stageId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select>`;
  }

  function replySummary(r) {
    const steps = r.steps || [];
    const firstText = steps.find((s) => s.type === 'text');
    const icons = steps.map((s) => HZ.stepIcon(s.type)).join(' ');
    return `${icons}${firstText ? ' · ' + esc(firstText.text.slice(0, 60)) : ''}`;
  }

  function renderReplies() {
    const q = wa.norm(filter);
    const list = state.replies.filter((r) => !q || wa.norm(r.title + ' ' + (r.shortcut || '') + ' ' + JSON.stringify(r.steps)).includes(q));
    body.innerHTML = `
      <div class="row field">
        <input type="search" data-act="filter" placeholder="Buscar respuesta…" value="${esc(filter)}">
        <button class="btn small" data-act="new-reply" title="Nueva respuesta">＋</button>
      </div>
      ${
        list.length
          ? list
              .map(
                (r) => `
        <div class="reply" data-reply="${esc(r.id)}" title="Clic para enviar al chat abierto">
          <div class="info">
            <div class="t">${esc(r.title)} ${r.shortcut ? `<span class="kbd">${esc(r.shortcut)}</span>` : ''}</div>
            <div class="s">${replySummary(r)}</div>
          </div>
          <button class="send" data-reply="${esc(r.id)}" title="Enviar">➤</button>
        </div>`
              )
              .join('')
          : `<div class="empty">${state.replies.length ? 'No hay resultados.' : 'Todavía no tenés respuestas rápidas.<br>Creá la primera con ＋ (textos, imágenes y audios).'}</div>`
      }
      <div class="empty" style="padding:8px 0;font-size:12px">Tip: escribí <span class="kbd">/</span> en la caja de mensaje para usar los atajos.</div>`;
  }

  function renderFunnel() {
    const names = Object.keys(state.contacts);
    body.innerHTML =
      state.stages
        .map((st) => {
          const items = names.filter((n) => state.contacts[n].stageId === st.id).sort((a, b) => (state.contacts[b].updatedAt || 0) - (state.contacts[a].updatedAt || 0));
          return `
        <div class="stage">
          <h4><span class="dot" style="background:${esc(st.color)}"></span>${esc(st.name)}<span class="count">${items.length}</span></h4>
          ${items
            .map(
              (n) => `
            <div class="card">
              <span class="n" data-open="${esc(n)}" title="Abrir chat">${esc(n)}</span>
              <select data-move="${esc(n)}">
                ${state.stages.map((s) => `<option value="${esc(s.id)}" ${s.id === st.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
                <option value="">— Quitar —</option>
              </select>
            </div>`
            )
            .join('')}
        </div>`;
        })
        .join('') +
      `<button class="btn ghost" style="width:100%" data-act="board">Abrir tablero completo ↗</button>`;
  }

  function toLocalInput(ms) {
    const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }

  function renderAgenda() {
    const name = wa.chatTitle() || '';
    const items = [...state.scheduled].sort((a, b) => a.at - b.at);
    const pending = items.filter((s) => s.status === 'pending' || s.status === 'sending');
    const done = items.filter((s) => s.status === 'sent' || s.status === 'failed').reverse().slice(0, 15);
    const label = { pending: 'Pendiente', sending: 'Enviando', sent: 'Enviado', failed: 'Falló' };
    const item = (s) => {
      const r = s.kind === 'reply' ? state.replies.find((x) => x.id === s.replyId) : null;
      const what = r ? '⚡ ' + r.title : '📝 ' + (s.text || '').slice(0, 50);
      return `
      <div class="sched">
        <div class="row"><span class="w" style="flex:1">${esc(s.chatName)}</span><span class="badge ${s.status}">${label[s.status]}</span></div>
        <div class="m">${esc(what)}</div>
        <div class="m">🕒 ${new Date(s.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}${s.error ? ' · ' + esc(s.error) : ''}</div>
        ${s.status === 'pending' || s.status === 'failed' ? `<div class="row" style="margin-top:6px;justify-content:flex-end">
          ${s.status === 'failed' ? `<button class="btn small ghost" data-retry="${esc(s.id)}">Reintentar</button>` : ''}
          <button class="btn small ghost" data-cancel="${esc(s.id)}">Eliminar</button></div>` : ''}
      </div>`;
    };
    body.innerHTML = `
      <div class="field"><label>Para (nombre del chat como aparece en WhatsApp)</label>
        <input data-f="chat" value="${esc(name)}" placeholder="Ej: Juan Pérez"></div>
      <div class="field"><label>Qué enviar</label>
        <select data-f="what">
          <option value="__text">📝 Texto personalizado</option>
          ${state.replies.map((r) => `<option value="${esc(r.id)}">⚡ ${esc(r.title)}</option>`).join('')}
        </select></div>
      <div class="field" data-textwrap><textarea data-f="text" rows="3" placeholder="Escribí el mensaje… (podés usar {nombre} y {saludo})"></textarea></div>
      <div class="field"><label>Cuándo</label>
        <input type="datetime-local" data-f="at" value="${toLocalInput(Date.now() + 60 * 60000)}"></div>
      <button class="btn" style="width:100%" data-act="schedule">⏰ Programar mensaje</button>
      <h3 class="sec">Pendientes (${pending.length})</h3>
      ${pending.map(item).join('') || '<div class="empty">No hay mensajes programados.</div>'}
      ${done.length ? `<h3 class="sec">Historial</h3>${done.map(item).join('')}` : ''}
      <div class="empty" style="font-size:12px">Los programados se envían mientras WhatsApp Web esté abierto en esta computadora.</div>`;
  }

  // ---------- eventos del panel ----------
  launcher.addEventListener('click', () => setOpen(true));

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act],[data-tab],[data-reply],[data-open],[data-cancel],[data-retry]');
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
    if (t.dataset.reply) { e.stopPropagation(); sendReply(t.dataset.reply); return; }
    if (t.dataset.open) {
      setStatus('Abriendo chat…');
      const ok = await wa.openChat(t.dataset.open);
      setStatus(ok ? '✅ Chat abierto' : '⚠️ No encontré ese chat en la lista', ok ? 'ok' : 'err');
      return;
    }
    if (t.dataset.cancel) {
      state.scheduled = state.scheduled.filter((s) => s.id !== t.dataset.cancel);
      await HZ.set({ scheduled: state.scheduled });
      return;
    }
    if (t.dataset.retry) {
      const s = state.scheduled.find((x) => x.id === t.dataset.retry);
      if (s) { s.status = 'pending'; s.error = ''; s.at = Date.now(); await HZ.set({ scheduled: state.scheduled }); checkScheduled(); }
      return;
    }
    switch (t.dataset.act) {
      case 'close': setOpen(false); break;
      case 'options': chrome.runtime.sendMessage({ type: 'openOptions' }); break;
      case 'new-reply': chrome.runtime.sendMessage({ type: 'openOptions', hash: '#replies/new' }); break;
      case 'board': chrome.runtime.sendMessage({ type: 'openOptions', hash: '#funnel' }); break;
      case 'schedule': await createSchedule(); break;
    }
  });

  root.addEventListener('input', (e) => {
    if (e.target.dataset.act === 'filter') {
      filter = e.target.value;
      const pos = e.target.selectionStart;
      renderReplies();
      const f = body.querySelector('[data-act="filter"]');
      f.focus();
      f.setSelectionRange(pos, pos);
    }
  });

  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.act === 'stage-current') {
      await setStage(wa.chatTitle(), t.value);
    } else if (t.dataset.move !== undefined) {
      await setStage(t.dataset.move, t.value);
    } else if (t.dataset.f === 'what') {
      body.querySelector('[data-textwrap]').hidden = t.value !== '__text';
    }
  });

  // Que WhatsApp no robe las teclas mientras se escribe en el panel.
  ['keydown', 'keypress', 'keyup', 'paste'].forEach((ev) => host.addEventListener(ev, (e) => e.stopPropagation()));

  async function setStage(name, stageId) {
    if (!name) return;
    const contacts = { ...state.contacts };
    if (stageId) contacts[name] = { ...(contacts[name] || {}), stageId, updatedAt: Date.now() };
    else delete contacts[name];
    state.contacts = contacts;
    await HZ.set({ contacts });
    const st = state.stages.find((s) => s.id === stageId);
    setStatus(st ? `🏷️ ${name} → ${st.name}` : `🏷️ Etiqueta quitada de ${name}`, 'ok');
  }

  async function createSchedule() {
    const val = (k) => body.querySelector(`[data-f="${k}"]`).value;
    const chatName = val('chat').trim();
    const what = val('what');
    const at = new Date(val('at')).getTime();
    if (!chatName) return setStatus('⚠️ Poné el nombre del chat', 'err');
    if (!at || isNaN(at)) return setStatus('⚠️ Elegí fecha y hora', 'err');
    const item = { id: HZ.uid(), chatName, at, status: 'pending', createdAt: Date.now() };
    if (what === '__text') {
      const text = val('text').trim();
      if (!text) return setStatus('⚠️ Escribí el mensaje', 'err');
      Object.assign(item, { kind: 'text', text });
    } else Object.assign(item, { kind: 'reply', replyId: what });
    state.scheduled = [...state.scheduled, item];
    await HZ.set({ scheduled: state.scheduled });
    setStatus('⏰ Programado para ' + new Date(at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }), 'ok');
  }

  // ---------- agenda: ejecución ----------
  let checking = false;
  async function checkScheduled() {
    if (checking || !state || !wa.footer() && !document.querySelector('#side')) return;
    checking = true;
    try {
      const now = Date.now();
      const due = state.scheduled.filter((s) => s.status === 'pending' && s.at <= now).sort((a, b) => a.at - b.at);
      for (const s of due) {
        await updateSched(s.id, { status: 'sending' });
        try {
          await enqueue(async () => {
            setStatus(`⏰ Enviando programado a ${s.chatName}…`);
            const ok = await wa.openChat(s.chatName, s.phone);
            if (!ok) throw new Error('No encontré el chat “' + s.chatName + '”');
            await wa.sleep(800);
            if (s.kind === 'text') await wa.sendText(HZ.fillVars(s.text, { chatName: wa.chatTitle() }));
            else {
              const r = state.replies.find((x) => x.id === s.replyId);
              if (!r) throw new Error('La respuesta rápida ya no existe');
              await runReply(r);
            }
          });
          await updateSched(s.id, { status: 'sent', sentAt: Date.now(), error: '' });
          setStatus(`✅ Programado enviado a ${s.chatName}`, 'ok');
          chrome.runtime.sendMessage({ type: 'notify', title: 'HotZapp', message: `Mensaje programado enviado a ${s.chatName}` });
        } catch (e) {
          await updateSched(s.id, { status: 'failed', error: e.message });
          setStatus('⚠️ Programado: ' + e.message, 'err');
          chrome.runtime.sendMessage({ type: 'notify', title: 'HotZapp – no se pudo enviar', message: `${s.chatName}: ${e.message}` });
        }
      }
    } finally {
      checking = false;
    }
  }
  async function updateSched(id, patch) {
    const list = await HZ.get('scheduled');
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    state.scheduled = list;
    await HZ.set({ scheduled: list });
  }

  // ---------- puntos de color en la lista de chats ----------
  function paintDots() {
    const list = document.querySelector('#pane-side');
    if (!list || !state) return;
    const on = state.settings.showDots;
    const stageById = Object.fromEntries(state.stages.map((s) => [s.id, s]));
    list.querySelectorAll('.hz-dot').forEach((d) => {
      const span = d.previousElementSibling;
      const c = on && span && state.contacts[span.getAttribute('title')];
      if (!c || !stageById[c.stageId] || d.dataset.stage !== c.stageId) d.remove();
    });
    if (!on) return;
    list.querySelectorAll('span[title]').forEach((span) => {
      const c = state.contacts[span.getAttribute('title')];
      const st = c && stageById[c.stageId];
      if (!st) return;
      const next = span.nextElementSibling;
      if (next && next.classList.contains('hz-dot')) return;
      const dot = document.createElement('span');
      dot.className = 'hz-dot';
      dot.dataset.stage = st.id;
      dot.title = st.name;
      dot.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:6px;vertical-align:middle;flex:none;background:${st.color}`;
      span.after(dot);
    });
  }

  // ---------- atajos "/" en la caja de mensaje ----------
  let popItems = [];
  let popIndex = 0;

  function composeFocused() {
    const box = wa.composeBox();
    return box && (box === document.activeElement || box.contains(document.activeElement)) ? box : null;
  }

  function updatePop() {
    if (!state || !state.settings.slashShortcuts) return hidePop();
    const box = composeFocused();
    const txt = box ? box.textContent : '';
    const m = /^\/(\S*)$/.exec(txt.trim());
    if (!box || !m) return hidePop();
    const q = wa.norm(m[1]);
    popItems = state.replies
      .filter((r) => !q || wa.norm((r.shortcut || '').replace(/^\//, '')).startsWith(q) || wa.norm(r.title).includes(q))
      .slice(0, 8);
    if (!popItems.length) return hidePop();
    popIndex = Math.min(popIndex, popItems.length - 1);
    const rect = (wa.footer() || box).getBoundingClientRect();
    pop.style.left = rect.left + 12 + 'px';
    pop.style.bottom = window.innerHeight - rect.top + 6 + 'px';
    pop.innerHTML =
      `<div class="hint">⚡ HotZapp · ↑↓ elegir · Enter enviar · Esc cerrar</div>` +
      popItems
        .map(
          (r, i) => `<div class="it ${i === popIndex ? 'on' : ''}" data-pop="${i}">
            <span class="t">${esc(r.title)}</span>
            <span>${(r.steps || []).map((s) => HZ.stepIcon(s.type)).join('')}</span>
            ${r.shortcut ? `<span class="kbd">${esc(r.shortcut)}</span>` : ''}</div>`
        )
        .join('');
    pop.hidden = false;
  }
  function hidePop() {
    pop.hidden = true;
    popItems = [];
    popIndex = 0;
  }
  async function choosePop(i) {
    const r = popItems[i];
    hidePop();
    if (!r) return;
    const box = wa.composeBox();
    if (box) {
      box.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    }
    await wa.sleep(100);
    sendReply(r.id);
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (pop.hidden || !composeFocused()) return;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        popIndex = (popIndex + (k === 'ArrowDown' ? 1 : -1) + popItems.length) % popItems.length;
        updatePop();
      } else if (k === 'Enter' || k === 'Tab') {
        choosePop(popIndex);
      } else if (k === 'Escape') {
        hidePop();
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true
  );
  document.addEventListener('input', () => setTimeout(updatePop, 0), true);
  document.addEventListener('keyup', (e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) setTimeout(updatePop, 0); }, true);
  pop.addEventListener('mousedown', (e) => {
    const it = e.target.closest('[data-pop]');
    if (!it) return;
    e.preventDefault();
    choosePop(Number(it.dataset.pop));
  });

  // ---------- arranque ----------
  async function load() {
    state = await HZ.getAll();
    applyPush();
    render();
    paintDots();
  }

  HZ.onChange(async () => {
    state = await HZ.getAll();
    applyPush();
    // no re-renderizar formularios mientras el usuario escribe en ellos
    const active = root.activeElement;
    if (active && active.matches('input:not([data-act="filter"]),textarea,select') && tab === 'agenda') return;
    render();
    paintDots();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle') setOpen(!open);
  });

  load().then(() => {
    let saved = '1';
    try { saved = localStorage.getItem('hotzapp-open') ?? '1'; } catch (_) {}
    setOpen(saved === '1');
  });

  // Vigila cambios de chat, la lista y la agenda.
  setInterval(() => {
    if (open && wa.chatTitle() !== lastTitle) renderCurrent();
  }, 700);
  setInterval(paintDots, 2000);
  setInterval(checkScheduled, 15000);
  setTimeout(checkScheduled, 5000);
})();
