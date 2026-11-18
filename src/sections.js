// Secciones del panel: Menú, Respuestas rápidas, Pendientes, Agenda, Datos del lead,
// Notas, Herramientas y el tablero CRM.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const wa = HZ.wa;
  const I = HZ.icon;
  const esc = HZ.escape;
  const V = app.views;
  const S = () => app.state;
  const fmt = (ms) => new Date(ms).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const toLocalInput = (ms) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const noChat = `<div class="empty">${I('user', 28, 'style="margin:0 auto 8px;opacity:.6"')}Abrí una conversación de WhatsApp para ver esta sección.</div>`;

  // =============== MENÚ ===============
  V.menu = {
    render(head, body) {
      const c = app.counts();
      head.innerHTML = app.header(`<span class="logo">${I('bolt', 14)}</span>Whazaa`);
      const mi = (view, icon, label, n, orange) =>
        `<div class="mi" data-open="${view}"><span class="t">${label}</span><span class="ico">${I(icon, 19)}${n ? `<span class="cnt ${orange ? 'orange' : ''}">${n}</span>` : ''}</span></div>`;
      body.innerHTML = `<div class="menu">
        <div class="mi" data-open="tutorial" style="background:#25d36614;border:1px solid #25d36640;margin:2px 0 6px"><span class="t">📖 Tutorial: cómo usar Whazaa${S().settings.tutorialSeen ? '' : '<span class="newb">NUEVO</span>'}</span><span class="ico" style="color:#25d366">${I('chevronRight', 18)}</span></div>
        <div class="sec">Tu día</div>
        ${mi('tasks', 'bell', 'Pendientes', c.tasks, true)}
        ${mi('agenda', 'calendar', 'Agenda', c.agenda)}
        ${mi('stats', 'chart', 'Estadísticas', app.waitingCount || 0, true)}
        ${mi('crm', 'kanban', 'CRM')}
        <div class="sec">Esta conversación</div>
        ${mi('lead', 'lead', 'Datos del lead')}
        ${mi('notes', 'notes', 'Notas', c.notes)}
        <div class="sec">Herramientas</div>
        ${mi('replies', 'bolt', 'Respuestas rápidas')}
        ${mi('tools', 'wrench', 'Herramientas')}
        ${mi('backup', 'archive', 'Copia de seguridad', !S().settings.lastBackup || Date.now() - S().settings.lastBackup > 14 * 86400000 ? '!' : 0, true)}
      </div>`;
    }
  };

  app.el.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open]');
    if (!t || !app.el.body.contains(t)) return;
    if (t.dataset.open === 'crm') V.crm.open();
    else app.show(t.dataset.open);
  });

  // =============== RESPUESTAS RÁPIDAS ===============
  let q = '';
  let panelTypes = [];
  V.replies = {
    render(head, body) {
      head.innerHTML = app.header('Respuestas rápidas', `<button class="ib" data-go="tools" title="Configuración">${I('gear', 18)}</button>`);
      const st = S();
      const nq = wa.norm(q);
      const list = st.replies.filter(
        (r) => (!nq || wa.norm(`${r.name} ${r.shortcut} ${r.category} ${app.preview(r)}`).includes(nq)) && (!panelTypes.length || panelTypes.includes(r.type))
      );
      const groups = {};
      for (const r of list) (groups[r.category || ''] ||= []).push(r);
      const names = Object.keys(groups).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
      const card = (r) => {
        const meta = r.type === 'sequence'
          ? `${HZ.seqCount(r)} mensajes · unos ${app.seqDuration(r)} s · usado ${r.uses || 0}×`
          : `usado ${r.uses || 0}×`;
        return `<div class="rcard ${app.busyIds.has(r.id) ? 'busy' : ''}" data-send="${r.id}" draggable="true" data-drag="${r.id}" title="Clic para enviar al chat abierto">
          <span class="grip">${I('grip', 14)}</span>
          ${app.typeIcon(r.type, 16)}
          <div class="main">
            <div class="nm">${esc(r.name)}${r.shortcut ? ` <span class="kbd">;${esc(r.shortcut)}</span>` : ''}</div>
            <div class="pv">${esc(app.preview(r))}</div>
            <div class="ft">
              <button class="pill" data-cat="${r.id}">${r.category ? esc(r.category) : '+ categoría'}</button>
              <span class="used">${meta}</span>
            </div>
          </div>
          <div class="acts"><button class="ib" data-edit="${r.id}" title="Editar">${I('edit', 15)}</button><button class="ib" data-del="${r.id}" title="Eliminar">${I('trash', 15)}</button></div>
          <button class="ib star ${r.favorite ? 'on' : ''}" data-fav="${r.id}" title="Favorito">${r.favorite ? HZ.iconFilled('star', 16) : I('star', 16)}</button>
        </div>`;
      };
      body.innerHTML = `
        <div class="search">
          <div class="in"><input type="search" data-q placeholder="Buscar mensaje" value="${esc(q)}">
            <button class="ib" data-pfilter title="Filtrar por tipo" style="${panelTypes.length ? 'color:#7aa7ff' : ''}">${I('filter', 15)}</button></div>
          <button class="btn" data-new>+ Nueva</button>
        </div>
        <p class="hint">En el chat, empieza con <span class="kbd">;</span> y ves esta lista.</p>
        ${names.length ? names.map((n) => {
          const closed = st.collapsed[n || '__none'];
          const items = groups[n].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
          return `<div class="cat ${closed ? 'closed' : ''}">
            <div class="cat-h" data-toggle="${esc(n || '__none')}"><span class="dot"></span>${n ? esc(n) : 'Sin categoría'} (${items.length})<span class="chev">${I('chevronDown', 14)}</span></div>
            <div class="cat-b">${items.map(card).join('')}</div></div>`;
        }).join('') : `<div class="empty">${st.replies.length ? 'No hay resultados.' : 'Todavía no tenés respuestas rápidas.<br>Creá la primera con <b>+ Nueva</b>.'}</div>`}`;
      if (V.replies._focus) {
        const inp = body.querySelector('[data-q]');
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
        V.replies._focus = false;
      }
    }
  };
  app.refreshBusy = () => {
    app.root.querySelectorAll('[data-send]').forEach((el) => el.classList.toggle('busy', app.busyIds.has(el.dataset.send)));
    app.onBusy && app.onBusy();
  };

  const body = app.el.body;
  body.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) {
      q = e.target.value;
      V.replies._focus = true;
      app.render();
    }
  });
  body.addEventListener('click', async (e) => {
    if (app.view !== 'replies') return;
    const t = e.target.closest('[data-new],[data-edit],[data-del],[data-fav],[data-cat],[data-toggle],[data-send],[data-pfilter]');
    if (!t) return;
    const st = S();
    if (t.dataset.new !== undefined) return HZ.editor.pick();
    if (t.dataset.pfilter !== undefined) return typeFilterPop(t);
    if (t.dataset.edit) return HZ.editor.open(null, st.replies.find((r) => r.id === t.dataset.edit));
    if (t.dataset.del) return HZ.editor.remove(t.dataset.del);
    if (t.dataset.fav) return app.save({ replies: st.replies.map((r) => (r.id === t.dataset.fav ? { ...r, favorite: !r.favorite } : r)) });
    if (t.dataset.cat) {
      const r = st.replies.find((x) => x.id === t.dataset.cat);
      const c = prompt('Categoría (vacío para quitarla):', r.category || '');
      if (c === null) return;
      return app.save({ replies: st.replies.map((x) => (x.id === r.id ? { ...x, category: c.trim() } : x)) });
    }
    if (t.dataset.toggle) {
      const k = t.dataset.toggle;
      return app.save({ collapsed: { ...st.collapsed, [k]: !st.collapsed[k] } });
    }
    if (t.dataset.send) return app.send(t.dataset.send);
  });

  // Filtro por tipo dentro del panel
  function typeFilterPop(anchor) {
    const fp = app.el.fpop;
    const r = anchor.getBoundingClientRect();
    const draw = () => {
      fp.innerHTML = `<h4>Mostrar</h4>${Object.entries(HZ.TYPES).map(([k, T]) =>
        `<div class="fi" data-pt="${k}"><button class="check ${panelTypes.includes(k) ? 'on' : ''}">${panelTypes.includes(k) ? I('check', 12) : ''}</button><span style="color:${T.color}">${I(T.icon, 16)}</span>${T.label}</div>`).join('')}`;
    };
    draw();
    app.fpMode = 'panel';
    fp.hidden = false;
    fp.style.left = Math.max(8, r.right - 280) + 'px';
    fp.style.top = r.bottom + 6 + 'px';
    fp.style.bottom = '';
    fp.onclick = (e) => {
      const it = e.target.closest('[data-pt]');
      if (!it) return;
      const k = it.dataset.pt;
      panelTypes = panelTypes.includes(k) ? panelTypes.filter((x) => x !== k) : [...panelTypes, k];
      draw();
      app.render();
    };
  }

  // Arrastrar para reordenar (y cambiar de categoría)
  let dragId = null;
  body.addEventListener('dragstart', (e) => {
    const c = e.target.closest && e.target.closest('[data-drag]');
    if (!c) return;
    dragId = c.dataset.drag;
    e.dataTransfer.effectAllowed = 'move';
  });
  body.addEventListener('dragover', (e) => {
    const c = e.target.closest && e.target.closest('[data-drag]');
    if (!c || !dragId) return;
    e.preventDefault();
    body.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over'));
    c.classList.add('drag-over');
  });
  body.addEventListener('drop', async (e) => {
    const c = e.target.closest && e.target.closest('[data-drag]');
    if (!c || !dragId) return;
    e.preventDefault();
    const to = c.dataset.drag;
    if (to === dragId) return;
    const list = [...S().replies];
    const from = list.findIndex((r) => r.id === dragId);
    const [moved] = list.splice(from, 1);
    const target = list.find((r) => r.id === to);
    moved.category = target.category || '';
    list.splice(list.findIndex((r) => r.id === to), 0, moved);
    dragId = null;
    await app.save({ replies: list });
  });
  body.addEventListener('dragend', () => { dragId = null; body.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); });

  // =============== PENDIENTES ===============
  V.tasks = {
    render(head, body) {
      head.innerHTML = app.header('Pendientes');
      const st = S();
      const now = Date.now();
      const endToday = new Date(new Date().setHours(23, 59, 59, 999)).getTime();
      const open = st.tasks.filter((t) => !t.done).sort((a, b) => (a.due || 9e15) - (b.due || 9e15));
      const groups = [
        ['Vencidos y de hoy', open.filter((t) => t.due && t.due <= endToday)],
        ['Próximos', open.filter((t) => t.due && t.due > endToday)],
        ['Sin fecha', open.filter((t) => !t.due)],
        ['Hechos', st.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 10)]
      ];
      const item = (t) => `<div class="item ${t.done ? 'done' : ''}"><div class="row" style="align-items:flex-start">
        <button class="check ${t.done ? 'on' : ''}" data-tdone="${t.id}">${t.done ? I('check', 12) : ''}</button>
        <div class="grow"><div class="t">${esc(t.text)}</div>
          <div class="m">${t.chatName ? `<a href="#" data-chat="${esc(t.chatName)}" style="color:#7aa7ff;text-decoration:none">💬 ${esc(t.chatName)}</a>` : ''}
          ${t.due ? `<span class="${!t.done && t.due < now ? 'overdue' : ''}"> · ⏰ ${fmt(t.due)}</span>` : ''}</div></div>
        <button class="ib" data-tdel="${t.id}">${I('trash', 14)}</button></div></div>`;
      body.innerHTML = `
        <div class="field"><input data-tf="text" placeholder="¿Qué tenés que hacer? Ej.: llamar para cerrar"></div>
        <div class="two"><input data-tf="chat" value="${esc(wa.chatTitle() || '')}" placeholder="Chat (opcional)"><input type="datetime-local" data-tf="due" value="${toLocalInput(Date.now() + 86400000)}"></div>
        <button class="btn" style="width:100%;margin-top:10px" data-tadd>+ Agregar pendiente</button>
        ${groups.map(([title, items]) => (items.length ? `<h3 class="sec2">${title} (${items.length})</h3>${items.map(item).join('')}` : '')).join('')}
        ${!st.tasks.length ? '<div class="empty">No tenés pendientes. Agregá recordatorios para hacer seguimiento a tus leads.</div>' : ''}`;
    }
  };
  body.addEventListener('click', async (e) => {
    if (app.view !== 'tasks') return;
    const t = e.target.closest('[data-tadd],[data-tdone],[data-tdel],[data-chat]');
    if (!t) return;
    const st = S();
    if (t.dataset.chat) { e.preventDefault(); return app.openChat(t.dataset.chat); }
    if (t.dataset.tadd !== undefined) {
      const v = (k) => body.querySelector(`[data-tf="${k}"]`).value;
      const text = v('text').trim();
      if (!text) return app.status('Escribí el pendiente', 'err');
      const due = v('due') ? new Date(v('due')).getTime() : 0;
      return app.save({ tasks: [...st.tasks, { id: HZ.uid(), text, chatName: v('chat').trim(), due, done: false, createdAt: Date.now() }] });
    }
    if (t.dataset.tdone) return app.save({ tasks: st.tasks.map((x) => (x.id === t.dataset.tdone ? { ...x, done: !x.done, doneAt: Date.now() } : x)) });
    if (t.dataset.tdel) return app.save({ tasks: st.tasks.filter((x) => x.id !== t.dataset.tdel) });
  });

  app.openChat = async (name) => {
    app.status('Abriendo chat…');
    let ok = false;
    try { ok = await app.openChatFast(name); } catch (_) {}
    if (!ok) ok = await wa.openChat(name);
    app.status(ok ? '✅ Chat abierto' : '⚠️ No encontré ese chat en la lista', ok ? 'ok' : 'err');
    return ok;
  };

  // =============== AGENDA (mensajes programados) ===============
  V.agenda = {
    render(head, body) {
      head.innerHTML = app.header('Agenda');
      const st = S();
      const items = [...st.scheduled].sort((a, b) => a.at - b.at);
      const pending = items.filter((s) => s.status === 'pending' || s.status === 'sending');
      const done = items.filter((s) => s.status === 'sent' || s.status === 'failed').reverse().slice(0, 15);
      const label = { pending: 'Pendiente', sending: 'Enviando', sent: 'Enviado', failed: 'Falló' };
      const item = (s) => {
        const r = s.kind === 'reply' ? st.replies.find((x) => x.id === s.replyId) : null;
        return `<div class="item"><div class="row"><span class="t grow">${esc(s.chatName)}</span><span class="badge ${s.status}">${label[s.status]}</span></div>
          <div class="m">${r ? '⚡ ' + esc(r.name) : s.kind === 'reply' ? '(respuesta borrada)' : '📝 ' + esc((s.text || '').slice(0, 80))}</div>
          <div class="m">⏰ ${fmt(s.at)}${s.error ? ' · ' + esc(s.error) : ''}</div>
          ${s.status === 'pending' || s.status === 'failed' ? `<div class="row" style="justify-content:flex-end;margin-top:6px">
            ${s.status === 'failed' ? `<button class="btn sm ghost" data-sretry="${s.id}">Reintentar</button>` : ''}
            <button class="btn sm danger" data-sdel="${s.id}">Eliminar</button></div>` : ''}</div>`;
      };
      body.innerHTML = `
        <div class="field"><label>Para</label><input data-sf="chat" value="${esc(wa.chatTitle() || '')}" placeholder="Nombre del chat como aparece en WhatsApp"></div>
        <div class="field"><label>Qué enviar</label><select data-sf="what"><option value="__text">📝 Texto personalizado</option>
          ${st.replies.map((r) => `<option value="${r.id}">${HZ.TYPES[r.type].label} · ${esc(r.name)}</option>`).join('')}</select></div>
        <div class="field" data-swrap><textarea data-sf="text" style="min-height:60px" placeholder="Escribí el mensaje… (podés usar {primer_nombre} y {saludo})"></textarea></div>
        <div class="field"><label>Cuándo</label><input type="datetime-local" data-sf="at" value="${toLocalInput(Date.now() + 3600000)}"></div>
        <button class="btn" style="width:100%" data-sadd>Programar mensaje</button>
        <h3 class="sec2">Programados (${pending.length})</h3>
        ${pending.map(item).join('') || '<div class="empty">No hay mensajes programados.</div>'}
        ${done.length ? `<h3 class="sec2">Historial</h3>${done.map(item).join('')}` : ''}
        <p class="hint">Se envían solos mientras WhatsApp Web esté abierto en esta computadora.</p>`;
    }
  };
  body.addEventListener('change', (e) => {
    if (e.target.matches('[data-sf="what"]')) body.querySelector('[data-swrap]').hidden = e.target.value !== '__text';
  });
  body.addEventListener('click', async (e) => {
    if (app.view !== 'agenda') return;
    const t = e.target.closest('[data-sadd],[data-sdel],[data-sretry]');
    if (!t) return;
    const st = S();
    if (t.dataset.sdel) return app.save({ scheduled: st.scheduled.filter((s) => s.id !== t.dataset.sdel) });
    if (t.dataset.sretry) {
      await app.save({ scheduled: st.scheduled.map((s) => (s.id === t.dataset.sretry ? { ...s, status: 'pending', error: '', at: Date.now() } : s)) });
      return app.checkScheduled && app.checkScheduled();
    }
    const v = (k) => body.querySelector(`[data-sf="${k}"]`).value;
    const chatName = v('chat').trim();
    const at = new Date(v('at')).getTime();
    if (!chatName) return app.status('Poné el nombre del chat', 'err');
    if (!at) return app.status('Elegí fecha y hora', 'err');
    const item = { id: HZ.uid(), chatName, at, status: 'pending', createdAt: Date.now() };
    if (v('what') === '__text') {
      const text = v('text').trim();
      if (!text) return app.status('Escribí el mensaje', 'err');
      Object.assign(item, { kind: 'text', text });
    } else Object.assign(item, { kind: 'reply', replyId: v('what') });
    await app.save({ scheduled: [...st.scheduled, item] });
    app.status('⏰ Programado para ' + fmt(at), 'ok');
  });

  // =============== DATOS DEL LEAD ===============
  const LEAD_FIELDS = [
    ['phone', 'Teléfono', '+54 9 11 5555-0000'],
    ['email', 'Email', 'nombre@empresa.com'],
    ['company', 'Empresa', 'Ej.: Clínica Vivace'],
    ['value', 'Valor del negocio', 'Ej.: 150000'],
    ['source', 'Origen', 'Ej.: Instagram, anuncio, referido']
  ];
  let newLabelOpen = false;
  let palette = [];
  let newColor = '';
  V.lead = {
    render(head, body) {
      head.innerHTML = app.header('Datos del lead');
      const chat = wa.chatTitle();
      if (!chat) { body.innerHTML = noChat; return; }
      const c = S().contacts[chat] || {};
      if (!c.phone && /^[+\d\s()-]{8,}$/.test(chat)) c.phone = chat;
      const mine = new Set((app.waLabels[chat] || []).map((l) => l.id));
      const sup = app.waLabelsSupported;
      const done = HZ.isDone ? HZ.isDone(chat) : !!c.closedAt;
      const labelsHtml = sup === false || !(HZ.api && HZ.api.ready)
        ? `<p class="hint">${HZ.api && HZ.api.ready ? 'Las etiquetas existen sólo en <b>WhatsApp Business</b>. Con WhatsApp común podés usar la <b>Etapa del CRM</b> de abajo.' : 'Las etiquetas de WhatsApp se cargan cuando el motor rápido está activo.'}</p>`
        : `<div class="chips" style="margin-top:0">${app.waLabelsAll.map((l) => {
            const on = mine.has(l.id);
            return `<button class="vchip" data-wlabel="${esc(l.id)}" data-on="${on ? 1 : 0}" style="border-color:${esc(l.color)};${on ? `background:${esc(l.color)};color:#fff;font-weight:700` : `color:${esc(l.color)}`}">${on ? '✓ ' : ''}${esc(l.name)}</button>`;
          }).join('')}
          <button class="vchip" data-newlabel style="border-style:dashed">+ Nueva etiqueta</button></div>
          ${newLabelOpen ? `<div class="item" style="margin-top:8px"><input data-nlname placeholder="Nombre de la etiqueta (ej.: Cliente VIP)">
            <div class="chips" style="margin-top:8px">${palette.slice(0, 20).map((col) => `<button class="vchip" data-nlcolor="${esc(col)}" style="width:22px;height:22px;padding:0;border-radius:50%;background:${esc(col)};${newColor === col ? 'outline:2px solid #fff' : ''}"></button>`).join('')}</div>
            <div class="row" style="margin-top:8px;justify-content:flex-end"><button class="btn sm gray" data-nlcancel>Cancelar</button><button class="btn sm" data-nlsave>Crear en WhatsApp</button></div></div>` : ''}
          <p class="hint" style="margin-top:6px">Son las etiquetas de tu WhatsApp Business: tocá una para ponerla o sacarla. Se sincronizan con tu celular.</p>`;
      body.innerHTML = `
        <div class="item" style="margin-bottom:14px"><div class="t">💬 ${esc(chat)}</div><div class="m">${(S().notes[chat] || []).length} notas · <a href="#" data-goview="notes" style="color:#7aa7ff;text-decoration:none">ver notas</a></div></div>

        <div class="field"><label>Etiquetas de WhatsApp</label>${labelsHtml}</div>

        <div class="field"><label>Estado del contacto</label>
          <div class="item" style="margin:0">
            <div class="pref" style="padding:2px 0"><span class="grow">🚫 <b>No es un lead</b><div class="m" style="margin:2px 0 0">Equipo, proveedor, personal… No cuenta en métricas, seguimiento ni esperando.</div></span><div class="sw ${c.notLead ? 'on' : ''}" data-notlead><span class="tr"></span></div></div>
            ${c.notLead ? `<div class="seg" style="margin:6px 0 4px">${Object.entries(app.NOTLEAD_KINDS).map(([k, l]) => `<button data-nlkind="${k}" class="${c.notLead === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
            <div style="border-top:1px solid var(--line);margin:8px 0"></div>
            <div class="pref" style="padding:2px 0"><span class="grow">✓ <b>Conversación terminada</b><div class="m" style="margin:2px 0 0">${done ? `Terminada el ${new Date(c.closedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}. Vuelve a aparecer si te escribe.` : 'Deja de aparecer en Esperando y Seguimiento hasta que te vuelva a escribir.'}</div></span>
              <button class="btn sm ${done ? 'ghost' : ''}" data-done="${done ? 0 : 1}">${done ? '↺ Reactivar' : 'Terminar'}</button></div>
          </div></div>

        <div class="field"><label>Etapa del CRM <span class="opt">(tablero de Whazaa)</span></label><select data-lf="stageId"><option value="">Sin etapa</option>
          ${S().stages.map((s) => `<option value="${s.id}" ${c.stageId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        ${LEAD_FIELDS.map(([k, l, ph]) => `<div class="field"><label>${l}</label><input data-lf="${k}" value="${esc(c[k] || '')}" placeholder="${ph}"></div>`).join('')}
        <p class="hint">Se guarda solo. El teléfono se usa en la variable “Teléfono”.</p>`;
    }
  };
  body.addEventListener('click', async (e) => {
    if (app.view !== 'lead') return;
    const t = e.target.closest('[data-wlabel],[data-newlabel],[data-nlcolor],[data-nlcancel],[data-nlsave],[data-notlead],[data-nlkind],[data-done]');
    if (!t) return;
    const chat = wa.chatTitle();
    if (!chat) return;
    if (t.dataset.notlead !== undefined) return app.setNotLead(chat, (S().contacts[chat] || {}).notLead ? '' : 'otro');
    if (t.dataset.nlkind) return app.setNotLead(chat, t.dataset.nlkind);
    if (t.dataset.done) return app.setDone(chat, t.dataset.done === '1');
    if (t.dataset.newlabel !== undefined) {
      newLabelOpen = !newLabelOpen;
      if (newLabelOpen && !palette.length) palette = (await HZ.api.call('labelPalette').catch(() => [])) || [];
      newColor = palette[0] || '';
      app.render();
      const inp = body.querySelector('[data-nlname]');
      if (inp) inp.focus();
      return;
    }
    if (t.dataset.nlcolor) { newColor = t.dataset.nlcolor; body.querySelectorAll('[data-nlcolor]').forEach((b) => (b.style.outline = b === t ? '2px solid #fff' : '')); return; }
    if (t.dataset.nlcancel !== undefined) { newLabelOpen = false; return app.render(); }
    try {
      let chatId = app.waChatIds[chat];
      if (!chatId) { const a = await HZ.api.call('activeChat'); chatId = a && a.id; }
      if (!chatId) throw new Error('No encontré el chat');
      if (t.dataset.nlsave !== undefined) {
        const name = (body.querySelector('[data-nlname]').value || '').trim();
        if (!name) return app.status('Poné un nombre para la etiqueta', 'err');
        const l = await HZ.api.call('newLabel', name, newColor || undefined);
        if (l) await HZ.api.call('setLabel', chatId, l.id, true);
        newLabelOpen = false;
        app.status(`🏷️ Etiqueta “${name}” creada en WhatsApp`, 'ok');
      } else {
        const add = t.dataset.on !== '1';
        await HZ.api.call('setLabel', chatId, t.dataset.wlabel, add);
        app.status(add ? '🏷️ Etiqueta puesta' : '🏷️ Etiqueta quitada', 'ok');
      }
      await app.reloadLabels();
      app.render();
    } catch (err) {
      app.status('⚠️ No se pudo cambiar la etiqueta: ' + err.message, 'err');
    }
  });
  body.addEventListener('change', async (e) => {
    const k = e.target.dataset.lf;
    if (!k || app.view !== 'lead') return;
    const chat = wa.chatTitle();
    if (!chat) return;
    const contacts = { ...S().contacts, [chat]: { ...(S().contacts[chat] || {}), [k]: e.target.value.trim(), updatedAt: Date.now() } };
    await app.save({ contacts });
    app.status('Guardado ✓', 'ok');
  });
  body.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goview]');
    if (g) { e.preventDefault(); app.show(g.dataset.goview); }
  });

  // =============== NOTAS ===============
  V.notes = {
    render(head, body) {
      head.innerHTML = app.header('Notas');
      const chat = wa.chatTitle();
      if (!chat) { body.innerHTML = noChat; return; }
      const list = [...(S().notes[chat] || [])].sort((a, b) => b.at - a.at);
      body.innerHTML = `
        <div class="item" style="margin-bottom:12px"><div class="t">💬 ${esc(chat)}</div></div>
        <textarea data-note placeholder="Escribí una nota sobre esta conversación… (Ctrl+Enter para guardar)" style="min-height:70px"></textarea>
        <button class="btn" style="width:100%;margin:8px 0 6px" data-nadd>Agregar nota</button>
        ${list.map((n) => `<div class="item"><div class="row" style="align-items:flex-start"><div class="grow" style="white-space:pre-wrap">${esc(n.text)}</div>
          <button class="ib" data-ndel="${n.id}">${I('trash', 14)}</button></div><div class="m">${fmt(n.at)}</div></div>`).join('') || '<div class="empty">Sin notas todavía.</div>'}`;
    }
  };
  async function addNote() {
    const chat = wa.chatTitle();
    const ta = body.querySelector('[data-note]');
    if (!chat || !ta || !ta.value.trim()) return;
    const notes = { ...S().notes, [chat]: [...(S().notes[chat] || []), { id: HZ.uid(), text: ta.value.trim(), at: Date.now() }] };
    ta.value = '';
    ta.blur();
    await app.save({ notes });
  }
  body.addEventListener('keydown', (e) => { if (e.target.matches('[data-note]') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); });
  body.addEventListener('click', async (e) => {
    if (app.view !== 'notes') return;
    if (e.target.closest('[data-nadd]')) return addNote();
    const d = e.target.closest('[data-ndel]');
    if (d) {
      const chat = wa.chatTitle();
      await app.save({ notes: { ...S().notes, [chat]: (S().notes[chat] || []).filter((n) => n.id !== d.dataset.ndel) } });
    }
  });

  // =============== HERRAMIENTAS ===============
  V.tools = {
    render(head, body) {
      head.innerHTML = app.header('Herramientas');
      const s = S().settings;
      const sw = (k, label) => `<div class="pref"><span class="grow">${label}</span><div class="sw ${s[k] ? 'on' : ''}" data-set="${k}"><span class="tr"></span></div></div>`;
      body.innerHTML = `
        <div class="field"><label>Tu nombre <span class="opt">(variable “Tu nombre”)</span></label><input data-setv="myName" value="${esc(s.myName)}" placeholder="Ej.: Nacho"></div>
        <div class="field"><label>Duración por defecto de un temporizador nuevo (secuencias)</label><div class="row"><input type="number" min="0" step="0.5" data-setv="stepDelay" value="${s.stepDelay}" style="width:90px"><span class="help" style="margin:0">segundos</span></div></div>
        <h3 class="sec2">Barra de respuestas (abajo del chat)</h3>
        ${sw('showBar', 'Mostrar la barra de respuestas')}
        <div class="pref"><span class="grow">Ubicación de la barra</span><div class="seg"><button data-barpos="below" class="${s.barPosition !== 'above' ? 'on' : ''}">Debajo de la caja</button><button data-barpos="above" class="${s.barPosition === 'above' ? 'on' : ''}">Encima</button></div></div>
        ${sw('directSend', 'Mensaje sale directo')}
        ${sw('directSequence', 'Secuencia sale directo')}
        <div class="pref"><span class="grow">Estilo de los chips</span><div class="seg"><button data-chip="icon" class="${s.chipStyle === 'icon' ? 'on' : ''}">Ícono</button><button data-chip="color" class="${s.chipStyle === 'color' ? 'on' : ''}">Color</button></div></div>
        <h3 class="sec2">Envío de mensajes</h3>
        ${HZ.api && HZ.api.broken ? `<div class="item" style="margin-bottom:8px;border:1px solid #f5a524">⚠️ <b>El motor rápido falló con esta versión de WhatsApp</b><div class="m">Se está usando el modo compatibilidad hasta que recargues WhatsApp Web. Detalle: ${esc(HZ.api.broken).slice(0, 140)}</div></div>` : ''}
        ${HZ.api && HZ.api.broken ? '' : `<div class="item" style="margin-bottom:8px">${HZ.api && HZ.api.ready
          ? '✅ <b>Motor rápido activo</b><div class="m">Los mensajes y audios salen al instante, podés seguir con otros chats mientras se envían y cancelarlos desde la barra de abajo.</div>'
          : '⚠️ <b>Motor rápido no disponible</b><div class="m">Se está usando el modo compatibilidad (hace clic en WhatsApp, un envío a la vez, en el chat abierto). Recargá WhatsApp Web; si sigue así, puede que una actualización de WhatsApp lo haya roto.</div>'}</div>`}
        <div class="pref"><span class="grow">Modo de envío</span><div class="seg"><button data-mode="fast" class="${s.sendMode !== 'dom' ? 'on' : ''}">Rápido</button><button data-mode="dom" class="${s.sendMode === 'dom' ? 'on' : ''}">Compatibilidad</button></div></div>
        <h3 class="sec2">Lista de chats</h3>
        ${sw('listShowStage', 'Mostrar también la etapa del CRM de Whazaa (opcional)')}
        ${sw('listShowLabels', 'Mostrar las etiquetas de WhatsApp al lado del nombre')}
        ${sw('headerLabels', 'Botón “🏷️ Etiquetas” arriba del chat (Alt+E)')}
        ${sw('listShowTimer', 'Mostrar el temporizador de espera (⏱)')}
        ${sw('listShowFollow', 'Mostrar “↩ sin respuesta” para hacer seguimiento')}
        <h3 class="sec2">Panel</h3>
        <div class="field"><label>Ancho del panel (px)</label><input type="number" min="280" max="600" data-setv="panelWidth" value="${s.panelWidth}"></div>
        <h3 class="sec2">Copia de seguridad</h3>
        <p class="hint">Exportá todo (respuestas, audios, imágenes, videos, documentos, CRM, notas y agenda) en un .zip para pasarlo a otra computadora.</p>
        <button class="btn ghost" style="width:100%" data-open="backup">${I('archive', 15)} Ir a Copia de seguridad</button>
        <h3 class="sec2">Uso responsable</h3>
        <p class="hint">No uses Whazaa para spam ni envíos masivos a gente que no te escribió: WhatsApp puede restringir números con muchos reportes.</p>`;
    }
  };
  body.addEventListener('click', async (e) => {
    if (app.view !== 'tools') return;
    const t = e.target.closest('[data-set],[data-chip],[data-mode],[data-barpos]');
    if (!t) return;
    const s = S().settings;
    if (t.dataset.set) return app.saveSettings({ [t.dataset.set]: !s[t.dataset.set] });
    if (t.dataset.chip) return app.saveSettings({ chipStyle: t.dataset.chip });
    if (t.dataset.mode) return app.saveSettings({ sendMode: t.dataset.mode });
    if (t.dataset.barpos) return app.saveSettings({ barPosition: t.dataset.barpos });
  });
  body.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.setv) {
      const k = t.dataset.setv;
      let v = t.value;
      if (k === 'stepDelay') v = Math.max(0, Number(v) || 0);
      if (k === 'panelWidth') v = Math.min(600, Math.max(280, Number(v) || 340));
      await app.saveSettings({ [k]: k === 'myName' ? v.trim() : v });
      app.status('Guardado ✓', 'ok');
    }
  });

  // =============== CRM (tablero) ===============
  let crmModal = null;
  V.crm = {
    open() {
      crmModal = app.modal('<div></div>', { wide: true, onClose: () => (crmModal = null) });
      V.crm.draw();
    },
    draw() {
      if (!crmModal) return;
      const st = S();
      const names = Object.keys(st.contacts).filter((n) => st.contacts[n].stageId);
      const total = (ids) => ids.reduce((a, n) => a + (Number(String(st.contacts[n].value || '').replace(/[^\d.]/g, '')) || 0), 0);
      crmModal.innerHTML = `
        <h2>${I('kanban', 20)} CRM</h2>
        <div class="mb scroll" style="padding-bottom:0">
          <div class="board scroll">
            ${st.stages.map((sg, si) => {
              const items = names.filter((n) => st.contacts[n].stageId === sg.id).sort((a, b) => (st.contacts[b].updatedAt || 0) - (st.contacts[a].updatedAt || 0));
              const sum = total(items);
              return `<section class="col" data-stage="${sg.id}">
                <header><input type="color" value="${esc(sg.color)}" data-scolor="${si}"><input type="text" value="${esc(sg.name)}" data-sname="${si}">
                  <span class="n">${items.length}</span><button class="ib" data-sdelst="${si}" title="Eliminar etapa">${I('x', 14)}</button></header>
                ${sum ? `<div class="help" style="padding:6px 12px 0">Total: $ ${sum.toLocaleString('es-AR')}</div>` : ''}
                <div class="items scroll">${items.map((n) => {
                  const c = st.contacts[n];
                  const meta = [c.company, c.value ? '$ ' + c.value : '', (st.notes[n] || []).length ? `📝 ${(st.notes[n] || []).length}` : ''].filter(Boolean).join(' · ');
                  return `<div class="lead" draggable="true" data-lead="${esc(n)}"><div class="t"><span data-crmopen="${esc(n)}" title="Abrir chat">${esc(n)}</span>
                    <button class="ib" data-crmdel="${esc(n)}" title="Quitar del CRM">${I('x', 12)}</button></div>${meta ? `<div class="m">${esc(meta)}</div>` : ''}</div>`;
                }).join('')}</div>
                <footer><input placeholder="+ Agregar contacto" data-crmadd="${sg.id}"></footer>
              </section>`;
            }).join('')}
            <div style="flex:none;width:180px"><button class="btn ghost" style="width:100%" data-addstage>+ Nueva etapa</button></div>
          </div>
        </div>
        <div class="mf"><button class="btn gray" data-crmclose>Cerrar</button></div>`;
    }
  };
  app.onState = app.onState || [];
  app.onState.push(() => {
    const a = app.root.activeElement;
    if (crmModal && !(a && crmModal.contains(a) && a.matches('input'))) V.crm.draw();
  });
  const ov = app.el.ov;
  ov.addEventListener('click', async (e) => {
    if (!crmModal) return;
    const t = e.target.closest('[data-crmclose],[data-addstage],[data-sdelst],[data-crmopen],[data-crmdel]');
    if (!t) return;
    const st = S();
    if (t.dataset.crmclose !== undefined) return app.closeModal();
    if (t.dataset.addstage !== undefined) return app.save({ stages: [...st.stages, { id: HZ.uid(), name: 'Nueva etapa', color: '#0ea5e9' }] });
    if (t.dataset.sdelst) {
      const sg = st.stages[+t.dataset.sdelst];
      const n = Object.values(st.contacts).filter((c) => c.stageId === sg.id).length;
      if (!confirm(`¿Eliminar la etapa “${sg.name}”?${n ? ` Sus ${n} contacto(s) quedan sin etapa.` : ''}`)) return;
      const contacts = Object.fromEntries(Object.entries(st.contacts).map(([k, c]) => [k, c.stageId === sg.id ? { ...c, stageId: '' } : c]));
      return app.save({ stages: st.stages.filter((s) => s.id !== sg.id), contacts });
    }
    if (t.dataset.crmopen) { app.closeModal(); return app.openChat(t.dataset.crmopen); }
    if (t.dataset.crmdel) return app.setStage(t.dataset.crmdel, '');
  });
  ov.addEventListener('change', (e) => {
    if (!crmModal) return;
    const t = e.target;
    const st = S();
    if (t.dataset.sname) { const stages = [...st.stages]; stages[+t.dataset.sname] = { ...stages[+t.dataset.sname], name: t.value.trim() || 'Etapa' }; app.save({ stages }); }
    if (t.dataset.scolor) { const stages = [...st.stages]; stages[+t.dataset.scolor] = { ...stages[+t.dataset.scolor], color: t.value }; app.save({ stages }); }
  });
  ov.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!crmModal || !t.dataset || !t.dataset.crmadd || e.key !== 'Enter' || !t.value.trim()) return;
    const name = t.value.trim();
    t.blur();
    app.setStage(name, t.dataset.crmadd);
  });
  let leadDrag = null;
  ov.addEventListener('dragstart', (e) => { const l = e.target.closest && e.target.closest('[data-lead]'); if (l) leadDrag = l.dataset.lead; });
  ov.addEventListener('dragover', (e) => { const c = e.target.closest && e.target.closest('.col'); if (c && leadDrag) { e.preventDefault(); c.classList.add('over'); } });
  ov.addEventListener('dragleave', (e) => { const c = e.target.closest && e.target.closest('.col'); if (c) c.classList.remove('over'); });
  ov.addEventListener('drop', (e) => {
    const c = e.target.closest && e.target.closest('.col');
    if (!c || !leadDrag) return;
    e.preventDefault();
    c.classList.remove('over');
    app.setStage(leadDrag, c.dataset.stage);
    leadDrag = null;
  });
})();
