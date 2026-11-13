// Barra de respuestas rápidas debajo de la caja de mensaje + atajo ";".
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const wa = HZ.wa;
  const I = HZ.icon;
  const esc = HZ.escape;
  const S = () => app.state;

  // ---------- barra ----------
  const barHost = document.createElement('div');
  barHost.id = 'hotzapp-bar';
  barHost.style.cssText = 'flex:none;display:block;width:100%;min-width:0;max-width:100%;contain:inline-size;overflow:hidden;position:relative;z-index:5;';
  const broot = barHost.attachShadow({ mode: 'open' });
  broot.innerHTML = `<style>${HZ.PANEL_CSS}</style><div class="hz"><div class="cbar"></div></div>`;
  const bar = broot.querySelector('.cbar');
  ['keydown', 'keyup', 'keypress', 'paste'].forEach((ev) => barHost.addEventListener(ev, (e) => e.stopPropagation()));

  let armed = null; // secuencia esperando el segundo clic
  let armTimer;

  function visibleReplies() {
    const s = S().settings;
    return S().replies
      .filter((r) => (!s.onlyFavorites || r.favorite) && (!s.typeFilter.length || s.typeFilter.includes(r.type)))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
  }

  function renderBar() {
    if (!S()) return;
    const s = S().settings;
    if (s.barCollapsed) {
      bar.innerHTML = `<button class="circle" data-b="expand" title="Mostrar respuestas rápidas">${I('plus', 14)}</button><div class="jobs"></div>`;
      renderJobs();
      return;
    }
    const filtered = s.onlyFavorites || s.typeFilter.length;
    const list = visibleReplies();
    bar.innerHTML = `
      <button class="circle" data-b="collapse" title="Ocultar barra">${I('minus', 14)}</button>
      <button class="circle fbtn" data-b="filter" title="Filtros y preferencias">${I('filter', 15)}${filtered ? '<span class="dot"></span>' : ''}</button>
      <div class="chiprow">${list.length ? list.map((r) => {
        const T = HZ.TYPES[r.type];
        const colored = s.chipStyle === 'color';
        const cls = ['chip', colored ? 'colored' : '', armed === r.id ? 'armed' : '', app.busyIds.has(r.id) ? 'busy' : ''].join(' ');
        const style = colored ? `style="background:${T.color}"` : '';
        const icon = colored ? '' : `<span style="color:${T.color}">${I(T.icon, 15)}</span>`;
        const n = r.type === 'sequence' ? `<span class="n">${HZ.seqCount(r)}</span>` : '';
        return `<button class="${cls}" ${style} data-chip="${r.id}" title="${esc(app.preview(r)).slice(0, 200)}">${icon}${esc(r.name)}${n}</button>`;
      }).join('') : `<span style="color:var(--muted);font-size:12px;padding:4px">${S().replies.length ? 'Ninguna respuesta con estos filtros.' : 'Creá respuestas rápidas desde el panel ⚡'}</span>`}</div>
      <div class="jobs"></div>`;
    renderJobs();
  }
  app.renderBar = renderBar;

  // ---------- envíos en curso: cuenta regresiva + cancelar ----------
  function renderJobs() {
    const box = bar.querySelector('.jobs');
    if (!box) return;
    const list = [...(app.jobs ? app.jobs.values() : [])];
    const secs = (j) => (j.endsAt ? Math.max(0, Math.ceil((j.endsAt - Date.now()) / 1000)) : null);
    // se actualiza en el lugar (sin redibujar) para que el clic en ⏹ nunca se pierda
    const keep = new Set();
    for (const j of list) {
      keep.add(j.id);
      let b = box.querySelector(`[data-canceljob="${j.id}"]`);
      if (!b) {
        b = document.createElement('button');
        b.className = 'chip jobchip';
        b.dataset.canceljob = j.id;
        b.title = 'Cancelar el envío' + (j.chatName ? ' a ' + j.chatName : '');
        b.innerHTML = `<span class="spin"></span><span class="lb"></span><b class="cd"></b><span class="x">${I('x', 12)}</span>`;
        const all = box.querySelector('[data-cancelall]');
        box.insertBefore(b, all);
      }
      const who = j.chatName ? j.chatName.split(' ')[0] + ' · ' : '';
      const lb = who + (j.phase || j.label);
      const s = secs(j);
      const cd = s !== null ? s + 's' : '';
      if (b.querySelector('.lb').textContent !== lb) b.querySelector('.lb').textContent = lb;
      if (b.querySelector('.cd').textContent !== cd) b.querySelector('.cd').textContent = cd;
    }
    box.querySelectorAll('[data-canceljob]').forEach((b) => { if (!keep.has(b.dataset.canceljob)) b.remove(); });
    let all = box.querySelector('[data-cancelall]');
    if (list.length > 1) {
      if (!all) {
        all = document.createElement('button');
        all.className = 'chip jobchip all';
        all.dataset.cancelall = '1';
        box.appendChild(all);
      }
      const t = `Cancelar todo (${list.length})`;
      if (all.textContent !== t) all.innerHTML = `${I('stop', 12)} ${t}`;
    } else if (all) all.remove();
  }
  app.onJobs = app.onJobs || [];
  app.onJobs.push(renderJobs);
  setInterval(() => { if (app.jobs && app.jobs.size) renderJobs(); }, 250);

  bar.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-canceljob],[data-cancelall]');
    if (c) return c.dataset.cancelall ? app.cancelAll() : app.cancelJob(c.dataset.canceljob);
    const t = e.target.closest('[data-b],[data-chip]');
    if (!t) return;
    const s = S().settings;
    if (t.dataset.b === 'collapse') return app.saveSettings({ barCollapsed: true });
    if (t.dataset.b === 'expand') return app.saveSettings({ barCollapsed: false });
    if (t.dataset.b === 'filter') return toggleFilter(t);
    const id = t.dataset.chip;
    const r = S().replies.find((x) => x.id === id);
    if (!r) return;
    if (r.type === 'sequence' && !s.directSequence && armed !== id) {
      armed = id;
      clearTimeout(armTimer);
      armTimer = setTimeout(() => { armed = null; renderBar(); }, 4000);
      renderBar();
      app.toast(`Tocá de nuevo “${r.name}” para enviar la secuencia`, 2500);
      return;
    }
    armed = null;
    app.send(id);
  });

  // ---------- filtro / preferencias ----------
  const fp = app.el.fpop;
  let fpAnchor = null;
  function drawFilter() {
    const s = S().settings;
    const sw = (k) => `<div class="sw ${s[k] ? 'on' : ''}" data-fs="${k}"><span class="tr"></span></div>`;
    fp.innerHTML = `
      <h4>Mostrar</h4>
      <div class="fi" data-fs="onlyFavorites"><span style="color:#f97316">${HZ.iconFilled('star', 16)}</span><span class="grow">Solo favoritos</span>${sw('onlyFavorites')}</div>
      ${Object.entries(HZ.TYPES).map(([k, T]) => {
        const on = s.typeFilter.includes(k);
        return `<div class="fi" data-ft="${k}"><button class="check ${on ? 'on' : ''}">${on ? I('check', 12) : ''}</button><span style="color:${T.color}">${I(T.icon, 16)}</span>${T.label}</div>`;
      }).join('')}
      <hr><h4>Preferencias</h4>
      <div class="fi" style="cursor:default">${I('star', 15)}<span class="grow">Estilo de los chips</span></div>
      <div class="seg"><button data-fc="icon" class="${s.chipStyle === 'icon' ? 'on' : ''}">Ícono</button><button data-fc="color" class="${s.chipStyle === 'color' ? 'on' : ''}">Color</button></div>
      <div class="fi" data-fs="directSend">${I('send', 15)}<span class="grow">Mensaje sale directo</span>${sw('directSend')}</div>
      <div class="fi" data-fs="directSequence">${I('layers', 15)}<span class="grow">Secuencia sale directo</span>${sw('directSequence')}</div>`;
  }
  function placeFilter() {
    if (!fpAnchor) return;
    const r = fpAnchor.getBoundingClientRect();
    fp.style.left = Math.max(8, r.left - 6) + 'px';
    fp.style.top = '';
    fp.style.bottom = window.innerHeight - r.top + 8 + 'px';
  }
  function toggleFilter(anchor) {
    if (!fp.hidden && fpAnchor === anchor) { fp.hidden = true; return; }
    fpAnchor = anchor;
    app.fpMode = 'bar';
    drawFilter();
    fp.hidden = false;
    placeFilter();
    fp.onclick = (e) => {
      const t = e.target.closest('[data-fs],[data-ft],[data-fc]');
      if (!t) return;
      const s = S().settings;
      if (t.dataset.fs) app.saveSettings({ [t.dataset.fs]: !s[t.dataset.fs] });
      else if (t.dataset.fc) app.saveSettings({ chipStyle: t.dataset.fc });
      else {
        const k = t.dataset.ft;
        app.saveSettings({ typeFilter: s.typeFilter.includes(k) ? s.typeFilter.filter((x) => x !== k) : [...s.typeFilter, k] });
      }
    };
  }
  // cerrar el popover al hacer clic afuera
  const closeIfOutside = (e) => {
    if (fp.hidden) return;
    const path = e.composedPath();
    if (path.includes(fp) || path.some((n) => n.dataset && (n.dataset.b === 'filter' || n.dataset.pfilter !== undefined))) return;
    fp.hidden = true;
  };
  document.addEventListener('mousedown', closeIfOutside, true);

  // ---------- montar la barra debajo de la caja de mensaje ----------
  function mountBar() {
    const main = document.querySelector('#main');
    const show = S() && S().settings.showBar && main && main.querySelector('footer');
    if (!show) { if (barHost.isConnected) barHost.remove(); return; }
    if (barHost.parentNode !== main) {
      main.appendChild(barHost);
      renderBar();
    }
  }

  // ---------- atajo ";" en la caja de mensaje ----------
  const pop = app.el.pop;
  let popItems = [];
  let popIndex = 0;
  const composeFocused = () => {
    const box = wa.composeBox();
    return box && (box === document.activeElement || box.contains(document.activeElement)) ? box : null;
  };
  function hidePop() { pop.hidden = true; popItems = []; popIndex = 0; }
  function updatePop() {
    if (!S()) return;
    const box = composeFocused();
    const m = box && /^;(\S*)$/.exec((box.textContent || '').trim());
    if (!m) return hidePop();
    const q = wa.norm(m[1]);
    popItems = S().replies
      .filter((r) => !q || wa.norm(r.shortcut || '').startsWith(q) || wa.norm(r.name).includes(q))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))
      .slice(0, 10);
    if (!popItems.length) return hidePop();
    popIndex = Math.min(popIndex, popItems.length - 1);
    const rect = (wa.footer() || box).getBoundingClientRect();
    pop.style.left = rect.left + 12 + 'px';
    pop.style.bottom = window.innerHeight - rect.top + 6 + 'px';
    pop.innerHTML = `<div class="ph2">⚡ Respuestas rápidas · ↑↓ elegir · Enter enviar · Esc cerrar</div>` +
      popItems.map((r, i) => `<div class="it ${i === popIndex ? 'on' : ''}" data-pop="${i}">${app.typeIcon(r.type, 14)}<span class="t">${esc(r.name)}</span>${r.shortcut ? `<span class="kbd">;${esc(r.shortcut)}</span>` : ''}</div>`).join('');
    pop.hidden = false;
  }
  async function choose(i) {
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
    app.send(r.id);
  }
  document.addEventListener('keydown', (e) => {
    if (pop.hidden || !composeFocused()) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      popIndex = (popIndex + (k === 'ArrowDown' ? 1 : -1) + popItems.length) % popItems.length;
      updatePop();
    } else if (k === 'Enter' || k === 'Tab') choose(popIndex);
    else if (k === 'Escape') hidePop();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  document.addEventListener('input', () => setTimeout(updatePop, 0), true);
  document.addEventListener('keyup', (e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) setTimeout(updatePop, 0); }, true);
  pop.addEventListener('mousedown', (e) => {
    const it = e.target.closest('[data-pop]');
    if (!it) return;
    e.preventDefault();
    choose(Number(it.dataset.pop));
  });

  app.afterBoot = app.afterBoot || [];
  app.afterBoot.push(() => {
    mountBar();
    renderBar();
    setInterval(mountBar, 500);
  });
  app.onState = app.onState || [];
  app.onState.push(() => {
    mountBar();
    renderBar();
    if (fp.hidden || app.fpMode !== 'bar') return;
    if (fpAnchor && fpAnchor.isConnected) drawFilter();
    else {
      // el botón se redibujó: re-anclar al nuevo
      const nb = bar.querySelector('[data-b="filter"]');
      if (nb) { fpAnchor = nb; drawFilter(); placeFilter(); } else fp.hidden = true;
    }
  });
  app.onBusy = () => { renderBar(); renderJobs(); };
})();
