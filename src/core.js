// Núcleo de Whazaa dentro de WhatsApp Web: estado, panel, riel y motor de envío.
(function () {
  const HZ = globalThis.HZ;
  const wa = HZ.wa;
  const I = HZ.icon;
  if (window.top !== window || document.getElementById('hotzapp-root')) { HZ.skip = true; return; }

  const app = (HZ.app = {
    state: null,
    view: 'menu',
    open: false,
    views: {},
    busyIds: new Set()
  });

  // ---------- montaje ----------
  const host = document.createElement('div');
  host.id = 'hotzapp-root';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>${HZ.PANEL_CSS}</style>
    <div class="hz">
      <div class="rail"></div>
      <aside class="panel" hidden>
        <div class="ph"></div>
        <div class="pb scroll"></div>
        <div class="status"></div>
      </aside>
      <div class="ov" hidden></div>
      <div class="pop scroll" hidden></div>
      <div class="fpop" hidden></div>
    </div>`;
  ['keydown', 'keypress', 'keyup', 'paste', 'input'].forEach((ev) => host.addEventListener(ev, (e) => e.stopPropagation()));

  app.root = root;
  app.$ = (s) => root.querySelector(s);
  app.el = { rail: app.$('.rail'), panel: app.$('.panel'), head: app.$('.ph'), body: app.$('.pb'), status: app.$('.status'), ov: app.$('.ov'), pop: app.$('.pop'), fpop: app.$('.fpop') };

  // Empuja la interfaz de WhatsApp para que el panel no tape el chat.
  const pushStyle = document.createElement('style');
  document.documentElement.appendChild(pushStyle);
  app.applyPush = () => {
    const w = (app.state && app.state.settings.panelWidth) || 340;
    app.el.panel.style.setProperty('--w', w + 'px');
    pushStyle.textContent = app.open
      ? `#app { width: calc(100vw - ${w}px) !important; max-width: calc(100vw - ${w}px) !important; }`
      : '';
  };

  app.show = (view) => {
    app.view = view || app.view;
    app.open = true;
    app.el.panel.hidden = false;
    app.applyPush();
    app.render();
    renderRail();
  };
  app.close = () => {
    app.open = false;
    app.el.panel.hidden = true;
    app.applyPush();
    renderRail();
  };
  app.toggle = () => (app.open ? app.close() : app.show());

  // ---------- helpers ----------
  app.save = async (patch) => {
    Object.assign(app.state, patch);
    await HZ.set(patch);
  };
  app.saveSettings = (patch) => app.save({ settings: { ...app.state.settings, ...patch } });

  app.chat = () => wa.chatTitle();
  app.ctx = () => {
    const chatName = wa.chatTitle();
    const c = (chatName && app.state.contacts[chatName]) || {};
    return { chatName, phone: c.phone || '', myName: app.state.settings.myName };
  };

  let statusTimer;
  app.status = (msg, kind = '', progress = null) => {
    clearTimeout(statusTimer);
    const s = app.el.status;
    s.className = 'status ' + kind;
    s.innerHTML = msg
      ? `<span>${HZ.escape(msg)}</span>` + (progress != null ? `<div class="bar"><i style="width:${Math.round(progress * 100)}%"></i></div>` : '')
      : '';
    if (kind === 'ok' || kind === 'err') statusTimer = setTimeout(() => (s.innerHTML = ''), kind === 'err' ? 9000 : 4000);
    if (!app.open && (kind === 'err' || kind === 'ok')) app.toast(msg);
  };

  app.toast = (msg, ms = 3000) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    root.querySelector('.hz').appendChild(t);
    setTimeout(() => t.remove(), ms);
  };

  app.typeIcon = (type, size = 16) => {
    const T = HZ.TYPES[type] || HZ.TYPES.text;
    return `<span class="ticon" style="background:${T.color}22;color:${T.color}">${I(T.icon, size)}</span>`;
  };

  app.preview = (r) => {
    if (r.type === 'text') return r.text || '';
    if (r.type === 'contact') return `${r.contactName || ''} · ${r.contactPhone || ''}`;
    if (r.type === 'sequence') {
      return HZ.seqItems(r).map((it) => {
        if (it.type === 'wait') return `⏱ ${it.secs} s`;
        if (it.type === 'msg') return it.msg.type === 'text' ? '“' + String(it.msg.text || '').slice(0, 30) + '”' : HZ.TYPES[it.msg.type].label;
        const c = app.state.replies.find((x) => x.id === it.replyId);
        return c ? c.name : '(borrada)';
      }).join(' → ');
    }
    return r.caption || HZ.TYPES[r.type].label;
  };

  app.seqDuration = (r) =>
    HZ.seqItems(r).reduce((a, it) => {
      if (it.type === 'wait') return a + (Number(it.secs) || 0);
      const c = it.type === 'msg' ? it.msg : app.state.replies.find((x) => x.id === it.replyId);
      if (!c) return a;
      if (c.type === 'text') return a + (Number(c.typing) || 0);
      if (c.type === 'audio' && c.asVoice !== false) return a + (c.recReal ? 0 : Number(c.recSecs ?? 3));
      return a;
    }, 0);

  // ---------- etapas ----------
  app.setStage = async (name, stageId) => {
    if (!name) return;
    const contacts = { ...app.state.contacts };
    if (stageId) contacts[name] = { ...(contacts[name] || {}), stageId, updatedAt: Date.now() };
    else if (contacts[name]) contacts[name] = { ...contacts[name], stageId: '', updatedAt: Date.now() };
    await app.save({ contacts });
  };

  // ---------- estado del contacto: no es lead / conversación terminada ----------
  app.NOTLEAD_KINDS = { equipo: 'Equipo', proveedor: 'Proveedor', personal: 'Personal', otro: 'No es lead' };
  app.setNotLead = async (name, kind) => {
    if (!name) return;
    const contacts = { ...app.state.contacts };
    const c = { ...(contacts[name] || {}) };
    if (kind) c.notLead = kind; else delete c.notLead;
    c.updatedAt = Date.now();
    contacts[name] = c;
    await app.save({ contacts });
    app.status(kind ? `🚫 ${name}: ${app.NOTLEAD_KINDS[kind] || 'no es lead'} (no cuenta en métricas)` : `✓ ${name} vuelve a contar como lead`, 'ok');
  };
  app.setDone = async (name, done) => {
    if (!name) return;
    const contacts = { ...app.state.contacts };
    const c = { ...(contacts[name] || {}) };
    if (done) c.closedAt = Date.now(); else delete c.closedAt;
    contacts[name] = c;
    await app.save({ contacts });
    app.status(done ? `✓ Conversación con ${name} terminada (vuelve si te escribe)` : `↺ Conversación con ${name} reactivada`, 'ok');
  };

  // ---------- motor de envío ----------
  const queue = [];
  let busy = false;
  app.enqueue = (job) =>
    new Promise((resolve, reject) => {
      queue.push({ job, resolve, reject });
      pump();
    });
  async function pump() {
    if (busy || !queue.length) return;
    busy = true;
    const { job, resolve, reject } = queue.shift();
    try { resolve(await job()); } catch (e) { reject(e); } finally { busy = false; pump(); }
  }

  // (el envío de respuestas está en engine.js)

  // ---------- riel izquierdo ----------
  app.counts = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const chat = wa.chatTitle();
    return {
      tasks: app.state.tasks.filter((t) => !t.done && t.due && t.due < end).length,
      notes: chat ? (app.state.notes[chat] || []).length : 0,
      agenda: app.state.scheduled.filter((s) => s.status === 'pending').length
    };
  };

  function renderRail() {
    const r = app.el.rail;
    if (!app.state) return;
    const collapsed = app.state.settings.railCollapsed;
    const c = app.counts();
    const b = (view, icon, title, n, orange) =>
      `<button class="rb ${app.open && app.view === view ? 'on' : ''}" data-rail="${view}" title="${title}">${I(icon, 17)}${n ? `<span class="cnt ${orange ? 'orange' : ''}">${n}</span>` : ''}</button>`;
    r.classList.toggle('collapsed', !!collapsed);
    r.innerHTML = collapsed
      ? `<button class="rb tog" data-rail="__expand" title="Mostrar Whazaa">${I('chevronRight', 16)}</button>`
      : `<button class="rb tog" data-rail="__collapse" title="Ocultar">${I('chevronLeft', 16)}</button>
         ${b('menu', 'menu', 'Menú Whazaa')}
         ${b('replies', 'bolt', 'Respuestas rápidas')}
         ${b('tasks', 'listCheck', 'Pendientes', c.tasks, true)}
         ${b('notes', 'notes', 'Notas del chat', c.notes)}
         ${b('agenda', 'calendar', 'Agenda', c.agenda)}
         ${b('stats', 'chart', 'Estadísticas · clientes esperando', app.waitingCount || 0, true)}
         ${b('crm', 'kanban', 'CRM')}`;
  }
  app.renderRail = renderRail;

  app.el.rail.addEventListener('click', (e) => {
    const t = e.target.closest('[data-rail]');
    if (!t) return;
    const v = t.dataset.rail;
    if (v === '__collapse') return app.saveSettings({ railCollapsed: true }).then(renderRail);
    if (v === '__expand') return app.saveSettings({ railCollapsed: false }).then(renderRail);
    if (v === 'crm') return app.views.crm.open();
    if (app.open && app.view === v) app.close();
    else app.show(v);
  });

  function placeRail() {
    const main = document.querySelector('#main') || document.querySelector('#app');
    const r = main ? main.getBoundingClientRect() : { left: 0, top: 0, height: window.innerHeight };
    const rail = app.el.rail;
    rail.hidden = !document.querySelector('#side');
    rail.style.left = Math.max(0, r.left + 6) + 'px';
    rail.style.top = Math.max(70, r.top + r.height / 2 - rail.offsetHeight / 2) + 'px';
  }

  // ---------- render ----------
  app.render = () => {
    if (!app.state || !app.open) return;
    const v = app.views[app.view] || app.views.menu;
    v.render(app.el.head, app.el.body);
  };

  app.header = (title, extra = '') => `
    <h2>${title}</h2>${extra}
    ${app.view !== 'menu' ? `<button class="ib" data-go="menu" title="Menú">${I('menu', 18)}</button>` : ''}
    <button class="ib" data-go="__close" title="Cerrar">${I('x', 18)}</button>`;

  app.el.head.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go]');
    if (!t) return;
    if (t.dataset.go === '__close') app.close();
    else app.show(t.dataset.go);
  });

  // ---------- modal genérico ----------
  app.modal = (html, { wide = false, onClose } = {}) => {
    const ov = app.el.ov;
    ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
    ov.hidden = false;
    app._onModalClose = onClose;
    return ov.firstElementChild;
  };
  app.closeModal = () => {
    app.el.ov.hidden = true;
    app.el.ov.innerHTML = '';
    const cb = app._onModalClose;
    app._onModalClose = null;
    cb && cb();
  };
  app.el.ov.addEventListener('mousedown', (e) => { if (e.target === app.el.ov) app.closeModal(); });
  host.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !app.el.ov.hidden) app.closeModal(); });

  // ---------- arranque ----------
  app.boot = async () => {
    app.state = await HZ.getAll();
    let saved = '0';
    try { saved = localStorage.getItem('hotzapp-open') ?? '0'; } catch (_) {}
    renderRail();
    if (saved === '1') app.show(localStorage.getItem('hotzapp-view') || 'menu');
    app.afterBoot && app.afterBoot.forEach((f) => f());

    HZ.onChange(async () => {
      app.state = await HZ.getAll();
      app.applyPush();
      renderRail();
      // no re-dibujar si el usuario está escribiendo en el panel
      const a = root.activeElement;
      if (!(a && app.el.body.contains(a) && a.matches('input,textarea,select'))) app.render();
      app.onState && app.onState.forEach((f) => f());
    });

    let lastChat = wa.chatTitle();
    setInterval(() => {
      placeRail();
      const c = wa.chatTitle();
      if (c !== lastChat) {
        lastChat = c;
        renderRail();
        if (app.open && ['lead', 'notes', 'menu'].includes(app.view)) app.render();
      }
      try {
        localStorage.setItem('hotzapp-open', app.open ? '1' : '0');
        localStorage.setItem('hotzapp-view', app.view);
      } catch (_) {}
    }, 600);
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle') app.toggle();
  });
})();
