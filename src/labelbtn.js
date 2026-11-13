// Botón "🏷️ Etiquetas" en la cabecera del chat (al lado de "Añadir a la lista"):
// pone y saca etiquetas de WhatsApp con un toque, o crea una nueva.
// Atajo de teclado: Alt + E.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const wa = HZ.wa;
  const I = HZ.icon;
  const esc = HZ.escape;

  // ---------- acciones (compartidas con Datos del lead) ----------
  async function chatIdOf(name) {
    if (app.waChatIds && app.waChatIds[name]) return app.waChatIds[name];
    const a = await HZ.api.call('activeChat').catch(() => null);
    if (a && wa.sameChat(a.name, name)) return a.id;
    const f = await app.findChat(name);
    return f && f.id;
  }
  app.toggleLabel = async (name, labelId, add) => {
    const id = await chatIdOf(name);
    if (!id) throw new Error('No encontré el chat');
    await HZ.api.call('setLabel', id, labelId, add);
    // reflejarlo al instante, sin esperar la próxima lectura
    const l = app.waLabelsAll.find((x) => x.id === labelId);
    const cur = (app.waLabels[name] || []).filter((x) => x.id !== labelId);
    app.waLabels[name] = add && l ? [...cur, l] : cur;
    app.paintList && app.paintList();
    app.reloadLabels && setTimeout(app.reloadLabels, 800);
  };
  app.createLabel = async (labelName, color, chatName) => {
    const l = await HZ.api.call('newLabel', labelName, color || undefined);
    if (!l) throw new Error('WhatsApp no creó la etiqueta');
    app.waLabelsAll = [...app.waLabelsAll, l];
    if (chatName) await app.toggleLabel(chatName, l.id, true);
    return l;
  };

  // ---------- botón en la cabecera ----------
  const host = document.createElement('div');
  host.id = 'whazaa-labels';
  host.style.cssText = 'display:inline-flex;align-items:center;flex:none;margin:0 6px;position:relative;z-index:10;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${HZ.PANEL_CSS}
    .lb { display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 12px; border-radius:20px; border:1px solid var(--line2); background:transparent; color:var(--fg); cursor:pointer; font-weight:600; font-size:13.5px; white-space:nowrap; }
    .lb:hover { background:var(--bg2); }
    .lb .dots { display:inline-flex; }
    .lb .dots i { width:9px; height:9px; border-radius:50%; margin-left:-3px; border:1.5px solid #161717; }
    .lb .dots i:first-child { margin-left:0; }
    .menu2 { position:fixed; z-index:2147483060; width:290px; background:#1d1f1f; border:1px solid var(--line); border-radius:12px; box-shadow:0 12px 30px rgba(0,0,0,.55); padding:6px; }
    .menu2[hidden] { display:none; }
    .menu2 .hd { padding:6px 8px 8px; color:var(--muted); font-size:12px; }
    .menu2 input { margin-bottom:6px; }
    .lr { display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; cursor:pointer; }
    .lr:hover { background:var(--bg3); }
    .lr .c { width:14px; height:14px; border-radius:50%; flex:none; }
    .lr .n { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .lr .ck { width:18px; height:18px; border-radius:5px; border:1.5px solid var(--muted); display:grid; place-items:center; color:#fff; flex:none; }
    .lr.on .ck { background:#25d366; border-color:#25d366; }
    .list2 { max-height:300px; overflow:auto; }
    .newrow { border-top:1px solid var(--line); margin-top:4px; padding-top:6px; }
    .pal { display:flex; flex-wrap:wrap; gap:6px; margin:6px 2px; }
    .pal button { width:20px; height:20px; border-radius:50%; border:0; cursor:pointer; }
    .pal button.sel { outline:2px solid #fff; outline-offset:1px; }
  </style>
  <div class="hz"><button class="lb" title="Etiquetas de WhatsApp (Alt+E)"></button><div class="menu2 scroll" hidden></div></div>`;
  ['keydown', 'keyup', 'keypress', 'paste', 'input'].forEach((ev) => host.addEventListener(ev, (e) => e.stopPropagation()));
  const btn = root.querySelector('.lb');
  const menu = root.querySelector('.menu2');
  let open = false;
  let q = '';
  let creating = false;
  let palette = [];
  let color = '';

  function renderBtn() {
    const name = wa.chatTitle();
    const mine = (name && app.waLabels[name]) || [];
    btn.innerHTML = `${I('archive', 16)}<span>Etiquetas</span>${mine.length
      ? `<span class="dots">${mine.slice(0, 4).map((l) => `<i style="background:${esc(l.color)}"></i>`).join('')}</span>`
      : ''}${I('chevronDown', 14)}`;
  }

  function renderMenu() {
    if (!open) { menu.hidden = true; return; }
    const name = wa.chatTitle();
    const r = btn.getBoundingClientRect();
    menu.style.top = r.bottom + 6 + 'px';
    menu.style.left = Math.max(8, Math.min(window.innerWidth - 298, r.right - 290)) + 'px';
    if (!HZ.api || !HZ.api.ready) {
      menu.innerHTML = `<div class="hd">Las etiquetas de WhatsApp se cargan cuando el motor rápido está activo. Recargá WhatsApp Web.</div>`;
    } else if (app.waLabelsSupported === false) {
      menu.innerHTML = `<div class="hd">Las etiquetas existen sólo en <b>WhatsApp Business</b>.</div>`;
    } else {
      const mine = new Set(((name && app.waLabels[name]) || []).map((l) => l.id));
      const nq = wa.norm(q);
      const all = app.waLabelsAll.filter((l) => !nq || wa.norm(l.name).includes(nq));
      menu.innerHTML = `<div class="hd">🏷️ Etiquetas de <b>${esc(name || '')}</b> · tocá para poner o sacar</div>
        ${app.waLabelsAll.length > 6 ? `<input data-q placeholder="Buscar etiqueta…" value="${esc(q)}">` : ''}
        <div class="list2 scroll">${all.map((l) => `<div class="lr ${mine.has(l.id) ? 'on' : ''}" data-lid="${esc(l.id)}">
            <span class="c" style="background:${esc(l.color)}"></span><span class="n">${esc(l.name)}</span><span class="ck">${mine.has(l.id) ? I('check', 12) : ''}</span></div>`).join('') ||
          '<div class="hd">No hay etiquetas todavía.</div>'}</div>
        <div class="newrow">${creating
          ? `<input data-newname placeholder="Nombre de la nueva etiqueta" value="${esc(q)}">
             <div class="pal">${palette.slice(0, 20).map((c) => `<button data-col="${esc(c)}" class="${c === color ? 'sel' : ''}" style="background:${esc(c)}"></button>`).join('')}</div>
             <div class="row" style="justify-content:flex-end"><button class="btn sm gray" data-cancelnew>Cancelar</button><button class="btn sm" data-savenew>Crear y poner</button></div>`
          : `<div class="lr" data-startnew><span class="c" style="border:1.5px dashed var(--muted)"></span><span class="n">+ Nueva etiqueta</span></div>`}</div>`;
      const inp = menu.querySelector(creating ? '[data-newname]' : '[data-q]');
      if (inp && document.activeElement === host) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
    menu.hidden = false;
  }

  function toggleMenu(v = !open) {
    open = v;
    if (open) { q = ''; creating = false; app.reloadLabels && app.reloadLabels().then(() => open && renderMenu()); }
    renderMenu();
    if (open) { const inp = menu.querySelector('[data-q]'); if (inp) inp.focus(); }
  }

  btn.addEventListener('click', () => toggleMenu());
  menu.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) { q = e.target.value; renderMenu(); }
  });
  menu.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') return toggleMenu(false);
    if (e.key === 'Enter' && e.target.matches('[data-newname]')) menu.querySelector('[data-savenew]').click();
  });
  menu.addEventListener('click', async (e) => {
    const name = wa.chatTitle();
    const row = e.target.closest('[data-lid]');
    try {
      if (row) {
        const add = !row.classList.contains('on');
        row.classList.toggle('on', add);
        row.querySelector('.ck').innerHTML = add ? I('check', 12) : '';
        await app.toggleLabel(name, row.dataset.lid, add);
        const l = app.waLabelsAll.find((x) => x.id === row.dataset.lid);
        app.status(`🏷️ ${l ? l.name : 'Etiqueta'} ${add ? 'puesta a' : 'sacada de'} ${name}`, 'ok');
        renderBtn();
        return renderMenu();
      }
      if (e.target.closest('[data-startnew]')) {
        creating = true;
        if (!palette.length) palette = (await HZ.api.call('labelPalette').catch(() => [])) || [];
        color = palette[0] || '';
        return renderMenu();
      }
      const col = e.target.closest('[data-col]');
      if (col) { color = col.dataset.col; menu.querySelectorAll('[data-col]').forEach((b) => b.classList.toggle('sel', b === col)); return; }
      if (e.target.closest('[data-cancelnew]')) { creating = false; return renderMenu(); }
      if (e.target.closest('[data-savenew]')) {
        const n = (menu.querySelector('[data-newname]').value || '').trim();
        if (!n) return;
        await app.createLabel(n, color, name);
        creating = false;
        q = '';
        app.status(`🏷️ Etiqueta “${n}” creada en WhatsApp y puesta a ${name}`, 'ok');
        renderBtn();
        return renderMenu();
      }
    } catch (err) {
      app.status('⚠️ No se pudo cambiar la etiqueta: ' + err.message, 'err');
      if (row) renderMenu();
    }
  });
  document.addEventListener('mousedown', (e) => { if (open && !e.composedPath().includes(host)) toggleMenu(false); }, true);
  // Alt + E abre / cierra las etiquetas del chat abierto
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'e' || e.key === 'E' || e.code === 'KeyE') && wa.chatTitle()) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    }
  }, true);

  // ---------- ubicarlo en la cabecera, antes de los botones de la derecha ----------
  function mount() {
    const header = document.querySelector('#main header');
    const show = header && app.state && app.state.settings.headerLabels !== false;
    if (!show) { if (host.isConnected) host.remove(); open = false; return; }
    if (header.contains(host)) return;
    const hr = header.getBoundingClientRect();
    const right = [...header.querySelectorAll('button,[role="button"]')]
      .filter((b) => wa.visible(b) && b.getBoundingClientRect().left > hr.left + hr.width * 0.5)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    let anchor = right[0];
    // subir hasta el hijo directo de su fila, para no meternos dentro de otro botón
    while (anchor && anchor.parentElement && anchor.parentElement !== header && anchor.parentElement.children.length === 1) anchor = anchor.parentElement;
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(host, anchor);
    else header.appendChild(host);
    renderBtn();
  }

  let lastChat = null;
  app.afterBoot = app.afterBoot || [];
  app.afterBoot.push(() => {
    mount();
    setInterval(() => {
      mount();
      const c = wa.chatTitle();
      if (c !== lastChat) { lastChat = c; open = false; renderMenu(); renderBtn(); }
    }, 700);
  });
  app.onState = app.onState || [];
  app.onState.push(() => { renderBtn(); if (open) renderMenu(); });
  setInterval(renderBtn, 5000);
})();
