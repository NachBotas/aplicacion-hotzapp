// Filtros arriba de la lista de chats:
//  "↩ Seguimiento"  → clientes que no te contestan hace más de 1 hora (configurable)
//  "⏱ Esperando"    → clientes a los que todavía no les respondiste
// Al tocarlos se despliega la lista filtrada; tocando un chat se abre.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const I = HZ.icon;
  const esc = HZ.escape;
  const MIN = 60000;

  const host = document.createElement('div');
  host.id = 'whazaa-filters';
  host.style.cssText = 'flex:none;display:block;width:100%;min-width:0;contain:inline-size;position:relative;z-index:6;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${HZ.PANEL_CSS}
    .fb { display:flex; gap:6px; padding:6px 12px; background:var(--bg); border-bottom:1px solid var(--line); align-items:center; }
    .fb .lbl2 { color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; margin-right:2px; }
    .fchip { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line2); background:var(--bg2); color:var(--fg); border-radius:20px; padding:4px 11px; cursor:pointer; font-size:12.5px; font-weight:600; }
    .fchip .n { border-radius:10px; padding:0 7px; font-size:11px; font-weight:800; color:#111; }
    .fchip.on { border-color:currentColor; }
    .fchip.follow { color:#f5b74a; } .fchip.follow .n { background:#f5a524; }
    .fchip.wait { color:#fca5a5; } .fchip.wait .n { background:#f05252; color:#fff; }
    .drop2 { position:absolute; left:8px; right:8px; top:100%; margin-top:4px; background:#1d1f1f; border:1px solid var(--line); border-radius:12px; box-shadow:0 12px 30px rgba(0,0,0,.5); max-height:60vh; overflow:auto; padding:6px; }
    .drop2[hidden] { display:none; }
    .drop2 .hd { padding:6px 8px 8px; color:var(--muted); font-size:12px; line-height:1.4; }
    .fi2 { display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; cursor:pointer; }
    .fi2:hover { background:var(--bg3); }
    .fi2 .nm { flex:1; min-width:0; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .fi2 .sub { color:var(--muted); font-size:11px; font-weight:400; }
  </style><div class="hz"><div class="fb"></div><div class="drop2 scroll" hidden></div></div>`;
  ['keydown', 'keyup', 'keypress'].forEach((ev) => host.addEventListener(ev, (e) => e.stopPropagation()));
  const fb = root.querySelector('.fb');
  const drop = root.querySelector('.drop2');
  let openKind = null;

  const lists = () => {
    const s = app.state.settings;
    return {
      follow: HZ.tracker ? HZ.tracker.followups((Number(s.followMinutes) || 60) * MIN) : [],
      wait: HZ.tracker ? HZ.tracker.waiting().filter((w) => w.wait >= (Number(s.waitMinutes) || 15) * MIN) : []
    };
  };

  function render() {
    if (!app.state) return;
    const L = lists();
    const s = app.state.settings;
    fb.innerHTML = `<span class="lbl2">Filtrar</span>
      <button class="fchip follow ${openKind === 'follow' ? 'on' : ''}" data-f="follow" title="Clientes que no te contestan hace más de ${HZ.fmtDur((Number(s.followMinutes) || 60) * MIN)}">↩ Seguimiento <span class="n">${L.follow.length}</span></button>
      <button class="fchip wait ${openKind === 'wait' ? 'on' : ''}" data-f="wait" title="Clientes esperando tu respuesta hace más de ${s.waitMinutes} min">⏱ Esperando <span class="n">${L.wait.length}</span></button>`;
    if (!openKind) { drop.hidden = true; return; }
    const items = L[openKind];
    const head = openKind === 'follow'
      ? `<b style="color:#f5b74a">↩ Para hacer seguimiento</b><br>No te contestan hace más de ${HZ.fmtDur((Number(s.followMinutes) || 60) * MIN)} (tu mensaje fue el último). No incluye Cerrado ni Perdido.`
      : `<b style="color:#fca5a5">⏱ Esperando tu respuesta</b><br>Te escribieron hace más de ${s.waitMinutes} min y todavía no contestaste.`;
    drop.innerHTML = `<div class="hd">${head}</div>` + (items.length
      ? items.map((w) => {
          const c = app.state.contacts[w.name];
          const st = c && app.state.stages.find((x) => x.id === c.stageId);
          return `<div class="fi2" data-open="${esc(w.name)}">
            <div class="nm">${esc(w.name)}<div class="sub">${openKind === 'follow' ? 'tu último mensaje' : 'te escribió'} hace ${HZ.fmtDur(w.wait)}${st ? ' · ' + esc(st.name) : ''}</div></div>
            <span class="badge ${openKind === 'follow' ? 'pending' : 'failed'}">${openKind === 'follow' ? '↩' : '⏱'} ${HZ.fmtDur(w.wait)}</span></div>`;
        }).join('')
      : `<div class="empty">${openKind === 'follow' ? 'Nadie pendiente de seguimiento 🎉' : 'Nadie esperando respuesta 🎉'}</div>`);
    drop.hidden = false;
  }
  app.renderFilters = render;

  root.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]');
    if (f) { openKind = openKind === f.dataset.f ? null : f.dataset.f; return render(); }
    const o = e.target.closest('[data-open]');
    if (o) { openKind = null; render(); await app.openChat(o.dataset.open); }
  });
  document.addEventListener('mousedown', (e) => {
    if (openKind && !e.composedPath().includes(host)) { openKind = null; render(); }
  }, true);

  function mount() {
    const pane = document.querySelector('#pane-side');
    const show = app.state && (app.state.settings.listShowFollow || app.state.settings.listShowTimer);
    if (!pane || !show) { if (host.isConnected) host.remove(); return; }
    if (host.nextElementSibling !== pane) { pane.parentElement.insertBefore(host, pane); render(); }
  }

  app.afterBoot = app.afterBoot || [];
  app.afterBoot.push(() => {
    mount();
    setInterval(mount, 1000);
    setInterval(render, 15000);
  });
  app.onState = app.onState || [];
  app.onState.push(() => { mount(); render(); });
})();
