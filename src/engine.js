// Motor de envíos de Whazaa.
//
// Modo rápido (por defecto): usa WA-JS a través de bridge.js. Cada envío queda
// atado al chat donde lo disparaste, así podés pasar a otro chat mientras sale;
// los audios salen como nota de voz al instante, mostrando "grabando audio…"
// el tiempo que configures. Distintos chats se envían en paralelo; dentro de un
// mismo chat, en orden.
//
// Modo compatibilidad (si WA-JS no está disponible): escribe y hace clic en la
// interfaz de WhatsApp, uno a la vez y sólo en el chat abierto.
//
// Todo envío se puede cancelar desde la barra de abajo (⏹).
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const wa = HZ.wa;

  app.onJobs = app.onJobs || [];

  // ---------------- puente con WA-JS ----------------
  let seq = 0;
  const pending = new Map();
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__hz !== 'rpcres') return;
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    clearTimeout(p.t);
    if (e.data.ok) p.res(e.data.result);
    else p.rej(new Error(e.data.error));
  });
  const api = (HZ.api = {
    ready: false,
    version: null,
    call(method, ...args) {
      return new Promise((res, rej) => {
        const id = 'r' + ++seq;
        const t = setTimeout(() => { pending.delete(id); rej(new Error('WhatsApp no respondió a tiempo')); }, method === 'status' ? 4000 : 180000);
        pending.set(id, { res, rej, t });
        window.postMessage({ __hz: 'rpc', id, method, args }, '*');
      });
    }
  });
  async function poll() {
    try {
      const s = await api.call('status');
      const was = api.ready;
      api.ready = !!(s.ready && s.auth !== false);
      api.version = s.version;
      if (was !== api.ready) {
        app.onJobs.forEach((f) => f());
        if (app.open && app.view === 'tools') app.render();
      }
    } catch (_) {
      api.ready = false;
    }
  }
  poll();
  setInterval(poll, 3000);
  app.fastMode = () => api.ready && app.state.settings.sendMode !== 'dom';

  // ---------------- trabajos (envíos en curso) ----------------
  const jobs = (app.jobs = new Map());
  const notify = () => app.onJobs.forEach((f) => f());

  function cancelledError() {
    const e = new Error('Envío cancelado');
    e.cancelled = true;
    return e;
  }
  const check = (job) => { if (job.cancelled) throw cancelledError(); };
  function setPhase(job, phase, ms = 0) {
    job.phase = phase;
    job.endsAt = ms ? Date.now() + ms : 0;
    notify();
  }
  // espera que se corta al cancelar
  function wait(job, ms, phase) {
    check(job);
    setPhase(job, phase, ms);
    return new Promise((res, rej) => {
      const w = () => { clearTimeout(t); rej(cancelledError()); };
      const t = setTimeout(() => { job.waiters.delete(w); res(); }, ms);
      job.waiters.add(w);
    });
  }

  app.cancelJob = (id) => {
    const job = jobs.get(id);
    if (!job || job.cancelled) return;
    job.cancelled = true;
    job.waiters.forEach((w) => w());
    job.waiters.clear();
    if (job.chatId && api.ready) api.call('presence', job.chatId, 'paused').catch(() => {});
    setPhase(job, 'cancelando…');
  };
  app.cancelAll = () => [...jobs.keys()].forEach(app.cancelJob);

  // Cola por chat: un chat a la vez en orden, chats distintos en paralelo.
  const chains = new Map();
  function chain(key, fn) {
    const prev = chains.get(key) || Promise.resolve();
    const p = prev.catch(() => {}).then(fn);
    const tail = p.catch(() => {});
    chains.set(key, tail);
    tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
    return p;
  }

  // ---------------- helpers ----------------
  async function media(r) {
    const m = await HZ.getMedia(r.mediaId);
    if (!m) throw new Error(`Falta el archivo de “${r.name}”.`);
    return m;
  }
  const durCache = new Map();
  async function audioDuration(m) {
    if (durCache.has(m.id)) return durCache.get(m.id);
    let d = 0;
    try {
      const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
      const buf = await ctx.decodeAudioData(await (await fetch(m.dataUrl)).arrayBuffer());
      d = buf.duration;
    } catch (_) {}
    durCache.set(m.id, d);
    return d;
  }
  HZ.audioDuration = audioDuration;
  const recSecs = async (r, m) => (r.recReal ? Math.round(await audioDuration(m)) : Math.max(0, Number(r.recSecs ?? 3)));

  // ---------------- modo rápido ----------------
  async function fastOne(job, r, ctx) {
    const id = job.chatId;
    const fill = (t) => HZ.fillVars(t, ctx);
    switch (r.type) {
      case 'text': {
        const secs = Number(r.typing) || 0;
        if (secs > 0) {
          api.call('presence', id, 'composing', secs * 1000).catch(() => {});
          await wait(job, secs * 1000, `✍️ ${r.name}`);
        }
        check(job);
        setPhase(job, `➤ ${r.name}`);
        await api.call('sendText', id, fill(r.text));
        break;
      }
      case 'audio': {
        const m = await media(r);
        const voice = r.asVoice !== false;
        if (voice) {
          const secs = await recSecs(r, m);
          if (secs > 0) {
            api.call('presence', id, 'recording', secs * 1000).catch(() => {});
            await wait(job, secs * 1000, `🎤 ${r.name}`);
          }
        }
        check(job);
        setPhase(job, `➤ ${r.name}`);
        const o = { type: 'audio', isPtt: voice, filename: m.name };
        if (voice) o.waveform = true;
        if (r.viewOnce) o.isViewOnce = true;
        await api.call('sendFile', id, m.dataUrl, o);
        break;
      }
      case 'image':
      case 'video':
      case 'document': {
        const m = await media(r);
        check(job);
        setPhase(job, `➤ ${r.name}`);
        const o = { type: r.type, filename: m.name, mimetype: (m.mime || '').split(';')[0] || undefined };
        const cap = fill(r.caption || '');
        if (cap.trim()) o.caption = cap;
        if (r.type !== 'document' && r.viewOnce) o.isViewOnce = true;
        await api.call('sendFile', id, m.dataUrl, o);
        break;
      }
      case 'contact':
        check(job);
        setPhase(job, `➤ ${r.name}`);
        await api.call('sendContact', id, r.contactPhone, r.contactName);
        break;
    }
  }

  // ---------------- modo compatibilidad (clics en la página) ----------------
  async function domOne(job, r, ctx, direct) {
    const fill = (t) => HZ.fillVars(t, ctx);
    const here = wa.chatTitle();
    if (!wa.sameChat(here, job.chatName)) throw new Error(`Cambiaste de chat: no se envió “${r.name}” a ${job.chatName}.`);
    check(job);
    setPhase(job, `➤ ${r.name}`);
    switch (r.type) {
      case 'text':
        if (direct) await wa.sendText(fill(r.text), { typing: r.typing });
        else await wa.insertText(fill(r.text));
        break;
      case 'audio': {
        const m = await media(r);
        if (r.asVoice !== false) {
          await wa.sendVoice(m.dataUrl, (t, d) => setPhase(job, `🎤 ${r.name}`, (d - t) * 1000), { viewOnce: r.viewOnce, isCancelled: () => job.cancelled });
        } else {
          await wa.sendFile(await HZ.dataUrlToFile(m.dataUrl, m.name || 'audio.mp3', m.mime), { viewOnce: r.viewOnce, send: direct });
        }
        break;
      }
      case 'image':
      case 'video':
      case 'document': {
        const m = await media(r);
        const file = await HZ.dataUrlToFile(m.dataUrl, m.name, m.mime);
        await wa.sendFile(file, { caption: fill(r.caption || ''), viewOnce: r.type !== 'document' && r.viewOnce, send: direct });
        break;
      }
      case 'contact':
        await wa.sendContact(r.contactName, r.contactPhone);
        break;
    }
  }

  const runStep = (job, r, ctx, direct) => (job.fast ? fastOne(job, r, ctx) : domOne(job, r, ctx, direct));

  async function bumpUses(id) {
    if (!app.state.replies.some((x) => x.id === id)) return;
    const replies = app.state.replies.map((x) => (x.id === id ? { ...x, uses: (x.uses || 0) + 1, lastUsed: Date.now() } : x));
    await app.save({ replies });
  }

  // ---------------- API pública ----------------
  // opts: { direct, target:{id,name}, reply (objeto, para programados de texto) }
  app.send = async (id, opts = {}) => {
    const r = opts.reply || app.state.replies.find((x) => x.id === id);
    if (!r) return false;
    const fast = app.fastMode();
    let target = opts.target || null;
    if (!target && fast) target = await api.call('activeChat').catch(() => null);
    if (!target) {
      const name = wa.chatTitle();
      if (!name || !wa.composeBox()) {
        app.lastError = 'Abrí un chat de WhatsApp primero.';
        app.status(app.lastError, 'err');
        return false;
      }
      target = { id: null, name };
    }
    const direct = opts.direct ?? app.state.settings.directSend;
    // "Mensaje sale directo" apagado: se deja listo en la caja (necesita la página)
    const useFast = fast && !!target.id && (direct || r.type === 'sequence' || r.type === 'contact');
    const job = { id: HZ.uid(), replyId: r.id, chatId: target.id, chatName: target.name || '', label: r.name, fast: useFast, phase: 'en cola', endsAt: 0, cancelled: false, waiters: new Set() };
    jobs.set(job.id, job);
    app.busyIds.add(r.id);
    notify();
    app.refreshBusy && app.refreshBusy();
    const ctx = { chatName: job.chatName, phone: (app.state.contacts[job.chatName] || {}).phone || '', myName: app.state.settings.myName };
    try {
      await chain(useFast ? job.chatId : 'dom', async () => {
        check(job);
        if (r.type === 'sequence') {
          const items = HZ.seqItems(r);
          for (const it of items) {
            if (it.type === 'wait') {
              if (it.secs > 0) await wait(job, it.secs * 1000, `⏱ ${r.name}`);
              continue;
            }
            if (it.type === 'msg') {
              await runStep(job, { ...it.msg, name: `${r.name} · ${HZ.TYPES[it.msg.type].label.toLowerCase()}` }, ctx, true);
              continue;
            }
            const child = app.state.replies.find((x) => x.id === it.replyId);
            if (!child || child.type === 'sequence') continue;
            await runStep(job, child, ctx, true);
            await bumpUses(child.id);
          }
          if (r.afterStage && job.chatName) await app.setStage(job.chatName, r.afterStage);
        } else {
          await runStep(job, r, ctx, direct);
        }
        await bumpUses(r.id);
      });
      const where = job.chatName ? ` a ${job.chatName}` : '';
      app.status(direct || r.type === 'sequence' || useFast ? `✅ “${r.name}” enviada${where}` : `✍️ “${r.name}” lista para enviar`, 'ok');
      return true;
    } catch (e) {
      if (e.cancelled) {
        app.status(`⏹ Envío cancelado: “${r.name}”`, 'ok');
        app.lastError = 'Envío cancelado';
      } else {
        app.lastError = e.message;
        app.status('⚠️ ' + e.message, 'err');
      }
      return false;
    } finally {
      jobs.delete(job.id);
      if (![...jobs.values()].some((j) => j.replyId === r.id)) app.busyIds.delete(r.id);
      notify();
      app.refreshBusy && app.refreshBusy();
    }
  };

  // Para programados y CRM: encontrar un chat por nombre / teléfono
  app.findChat = (name, phone) => (api.ready ? api.call('findChat', name, phone || '').catch(() => null) : Promise.resolve(null));
  app.openChatFast = async (name) => {
    const c = await app.findChat(name);
    if (!c) return false;
    await api.call('openChat', c.id);
    return true;
  };
})();
