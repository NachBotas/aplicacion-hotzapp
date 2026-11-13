// Automatización del DOM de WhatsApp Web.
// WhatsApp cambia sus clases seguido, por eso usamos atributos estables
// (#main, #side, footer, contenteditable, data-icon, aria-label) con varias alternativas.
(function () {
  const HZ = globalThis.HZ;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeout = 8000, every = 150) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try {
        const v = fn();
        if (v) return v;
      } catch (_) {}
      await sleep(every);
    }
    return null;
  }

  const visible = (el) => !!el && el.isConnected && el.getClientRects().length > 0;
  const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const digits = (s) => String(s || '').replace(/\D/g, '');

  const SEL = {
    main: '#main',
    side: '#side',
    footer: '#main footer',
    compose: [
      '#main footer div[contenteditable="true"][role="textbox"]',
      '#main footer div[contenteditable="true"]',
      '#main div[contenteditable="true"][data-tab="10"]'
    ],
    search: [
      '#side div[contenteditable="true"][role="textbox"]',
      '#side div[contenteditable="true"]',
      '#side input[type="text"]',
      '#side input[role="textbox"]',
      '#side input'
    ],
    chatList: '#pane-side'
  };

  const ICON = {
    send: /send/i,
    mic: /(^ptt$|mic|microphone)/i
  };
  const LABEL = {
    send: /^(send|enviar|enviar mensaje|send message)$/i,
    mic: /(voice message|mensaje de voz|grabar|record|audio)/i
  };

  const first = (sels, root = document) => {
    for (const s of sels) {
      const el = root.querySelector(s);
      if (el && visible(el)) return el;
    }
    return null;
  };

  const composeBox = () => first(SEL.compose);
  const searchBox = () => first(SEL.search);
  const footer = () => document.querySelector(SEL.footer);

  function findButton(root, iconRe, labelRe, exclude) {
    if (!root) return null;
    const ok = (el) => visible(el) && !(exclude && exclude(el));
    for (const ic of root.querySelectorAll('[data-icon]')) {
      if (iconRe.test(ic.getAttribute('data-icon') || '') && ok(ic)) return ic.closest('button,[role="button"]') || ic;
    }
    if (labelRe) {
      for (const b of root.querySelectorAll('button,[role="button"]')) {
        if (labelRe.test((b.getAttribute('aria-label') || '').trim()) && ok(b)) return b;
      }
    }
    return null;
  }

  function realClick(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...o, pointerId: 1, isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', { ...o, pointerId: 1, isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.click();
  }

  function pressKey(el, key, extra = {}) {
    const codes = { Enter: 13, Escape: 27, Backspace: 8 };
    const o = { key, code: key, keyCode: codes[key] || 0, which: codes[key] || 0, bubbles: true, cancelable: true, ...extra };
    el.dispatchEvent(new KeyboardEvent('keydown', o));
    el.dispatchEvent(new KeyboardEvent('keyup', o));
  }

  // ---------- chat actual ----------
  function chatTitle() {
    const h = document.querySelector('#main header');
    if (!h) return null;
    const el =
      h.querySelector('[data-testid="conversation-info-header-chat-title"]') ||
      h.querySelector('span[dir="auto"][title]') ||
      h.querySelector('span[dir="auto"]') ||
      h.querySelector('[title]');
    const t = el ? (el.getAttribute('title') || el.textContent || '').trim() : '';
    return t || null;
  }

  const sameChat = (a, b) => {
    if (!a || !b) return false;
    if (norm(a) === norm(b)) return true;
    const da = digits(a), db = digits(b);
    return da.length >= 8 && db.length >= 8 && (da.endsWith(db) || db.endsWith(da));
  };

  // ---------- edición de cajas de texto ----------
  function clearEditable(el) {
    el.focus();
    if (el.tagName === 'INPUT') {
      setInputValue(el, '');
      return;
    }
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function pasteText(el, text) {
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }

  async function typeInto(el, text) {
    if (el.tagName === 'INPUT') {
      el.focus();
      setInputValue(el, text);
      return;
    }
    clearEditable(el);
    pasteText(el, text);
    await sleep(150);
    if (!norm(el.textContent)) {
      // Plan B: insertar línea por línea con Shift+Enter
      const lines = String(text).split('\n');
      lines.forEach((line, i) => {
        if (i > 0) pressKey(el, 'Enter', { shiftKey: true });
        document.execCommand('insertText', false, line);
      });
    }
  }

  // ---------- envío ----------
  function requireChat() {
    const box = composeBox();
    if (!box) throw new Error('Abrí un chat de WhatsApp primero.');
    return box;
  }

  // opts: { typing: segundos de "escribiendo…", send: false = sólo dejarlo escrito }
  async function sendText(text, opts = {}) {
    const box = requireChat();
    if (!String(text).trim()) return;
    const typing = Number(opts.typing) || 0;
    if (typing > 0) {
      // Escribimos de a poco para que el otro vea "escribiendo…", y al final
      // pegamos el texto completo (así se respetan saltos de línea y emojis).
      clearEditable(box);
      const plain = String(text).replace(/\s+/g, ' ');
      const t0 = Date.now();
      let i = 0;
      while (Date.now() - t0 < typing * 1000) {
        const target = Math.min(plain.length, Math.ceil(((Date.now() - t0) / (typing * 1000)) * plain.length));
        if (target > i) {
          box.focus();
          document.execCommand('insertText', false, plain.slice(i, target));
          i = target;
        }
        await sleep(120);
      }
    }
    await typeInto(box, text);
    if (opts.send === false) return;
    await sleep(250);
    const btn = await waitFor(() => findButton(footer(), ICON.send, LABEL.send), 3000);
    if (btn) realClick(btn);
    else pressKey(box, 'Enter');
    await waitFor(() => !norm(composeBox()?.textContent), 4000);
  }

  // Deja el texto escrito en la caja sin enviarlo.
  async function insertText(text) {
    const box = requireChat();
    await typeInto(box, text);
  }

  // Busca el botón de "enviar" del editor de multimedia (fuera del footer del chat).
  const mediaSendButton = () => {
    const f = footer();
    return findButton(document.body, ICON.send, LABEL.send, (el) => (f && f.contains(el)) || el.closest('#side'));
  };

  function captionBox() {
    const f = footer();
    const all = [...document.querySelectorAll('div[contenteditable="true"]')].filter(
      (el) => visible(el) && !(f && f.contains(el)) && !el.closest('#side')
    );
    return all[all.length - 1] || null;
  }

  const VIEW_ONCE_ICON = /view.?once|once/i;
  const VIEW_ONCE_LABEL = /(una sola vez|ver una vez|view once)/i;

  // Imágenes, videos, documentos y audios como archivo.
  // opts: { caption, viewOnce, send: false = dejar la vista previa abierta }
  async function sendFile(file, opts = {}) {
    const box = requireChat();
    box.focus();
    const dt = new DataTransfer();
    dt.items.add(file);
    box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    let btn = await waitFor(mediaSendButton, 4000);
    if (!btn) {
      // Plan B: arrastrar y soltar el archivo sobre el chat
      const main = document.querySelector(SEL.main);
      const dt2 = new DataTransfer();
      dt2.items.add(file);
      for (const type of ['dragenter', 'dragover', 'drop']) {
        main.dispatchEvent(new DragEvent(type, { dataTransfer: dt2, bubbles: true, cancelable: true }));
        await sleep(120);
      }
      btn = await waitFor(mediaSendButton, 8000);
    }
    if (!btn) throw new Error('No se abrió la vista previa del archivo.');
    if (opts.caption && opts.caption.trim()) {
      const cb = captionBox();
      if (cb) {
        cb.focus();
        pasteText(cb, opts.caption);
        await sleep(250);
      }
    }
    if (opts.viewOnce) {
      const f = footer();
      const vo = findButton(document.body, VIEW_ONCE_ICON, VIEW_ONCE_LABEL, (el) => (f && f.contains(el)) || el.closest('#side'));
      if (!vo) {
        pressKey(document.activeElement || document.body, 'Escape');
        throw new Error('No encontré el botón "ver una sola vez" de WhatsApp (no se envió).');
      }
      realClick(vo);
      await sleep(300);
    }
    if (opts.send === false) return;
    await sleep(300);
    realClick(mediaSendButton() || btn);
    await waitFor(() => !mediaSendButton(), 15000);
  }

  // ---------- tarjeta de contacto ----------
  // Usa el menú Adjuntar → Contacto (sólo funciona con contactos agendados).
  // Si no se puede, manda los datos como texto.
  async function sendContact(name, phone) {
    requireChat();
    const f = footer();
    const attach = findButton(f || document, /(plus|clip|attach)/i, /(adjuntar|attach)/i);
    let ok = false;
    if (attach) {
      realClick(attach);
      const item = await waitFor(() =>
        [...document.querySelectorAll('li,[role="menuitem"],[role="button"],button,div[tabindex]')].find(
          (el) => visible(el) && /^(contacto|contact)$/i.test((el.textContent || '').trim())
        ), 3000);
      if (item) {
        realClick(item);
        const dlg = await waitFor(() => [...document.querySelectorAll('[role="dialog"],[data-animate-modal-popup]')].find(visible), 4000);
        const input = dlg && (dlg.querySelector('div[contenteditable="true"]') || dlg.querySelector('input'));
        if (input) {
          const digitsOnly = digits(phone);
          await typeInto(input, digitsOnly.slice(-8) || name);
          const row = await waitFor(() => {
            const rows = [...dlg.querySelectorAll('[role="listitem"],[role="row"],[role="checkbox"]')].filter(visible);
            return rows.find((r) => digits(r.textContent).endsWith(digitsOnly.slice(-8)) || norm(r.textContent).includes(norm(name))) || null;
          }, 4000);
          if (row) {
            realClick(row);
            await sleep(400);
            const s1 = await waitFor(() => findButton(dlg, ICON.send, LABEL.send), 3000);
            if (s1) {
              realClick(s1);
              await sleep(800);
              const s2 = await waitFor(() => findButton(document.body, ICON.send, LABEL.send, (el) => (f && f.contains(el)) || el.closest('#side')), 3000);
              if (s2) { realClick(s2); ok = true; await sleep(600); }
            }
          }
        }
      }
      if (!ok) {
        for (let i = 0; i < 3; i++) { pressKey(document.activeElement || document.body, 'Escape'); await sleep(200); }
      }
    }
    if (!ok) await sendText(`👤 *${name}*\n📞 ${phone}\nhttps://wa.me/${digits(phone)}`);
    return ok;
  }

  // ---------- audio como nota de voz ----------
  let audioSeq = 0;
  function waitPage(type, id, timeout) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        window.removeEventListener('message', on);
        reject(new Error('timeout:' + type));
      }, timeout);
      function on(e) {
        const d = e.data;
        if (e.source !== window || !d || d.__hz !== 'page' || d.id !== id) return;
        if (d.type === 'error') {
          clearTimeout(t);
          window.removeEventListener('message', on);
          reject(new Error(d.error));
        } else if (d.type === type) {
          clearTimeout(t);
          window.removeEventListener('message', on);
          resolve(d);
        }
      }
      window.addEventListener('message', on);
    });
  }

  async function sendVoice(dataUrl, onProgress, opts = {}) {
    const box = requireChat();
    clearEditable(box); // el botón de micrófono sólo aparece con la caja vacía
    await sleep(200);
    const id = 'a' + ++audioSeq + '_' + Date.now();
    const ready = waitPage('ready', id, 15000);
    window.postMessage({ __hz: 'cs', type: 'prepare', id, dataUrl }, '*');
    const info = await ready;

    const mic = await waitFor(() => findButton(footer(), ICON.mic, LABEL.mic), 4000);
    if (!mic) {
      window.postMessage({ __hz: 'cs', type: 'cancel', id }, '*');
      throw new Error('No encontré el botón de micrófono de WhatsApp.');
    }
    const started = waitPage('started', id, 6000);
    realClick(mic);
    try {
      await started;
    } catch (_) {
      window.postMessage({ __hz: 'cs', type: 'cancel', id }, '*');
      throw new Error('WhatsApp no empezó a grabar. Probá hacer clic una vez en la página y reintentá.');
    }
    const dur = info.duration;
    const t0 = Date.now();
    const tick = setInterval(() => onProgress && onProgress(Math.min(dur, (Date.now() - t0) / 1000), dur), 250);
    try {
      await waitPage('ended', id, (dur + 15) * 1000);
    } finally {
      clearInterval(tick);
    }
    await sleep(300);
    if (opts.viewOnce) {
      const vo = findButton(footer(), VIEW_ONCE_ICON, VIEW_ONCE_LABEL);
      if (!vo) {
        const del = findButton(footer(), /(delete|trash|bin)/i, /(eliminar|borrar|delete|cancel)/i);
        if (del) realClick(del);
        throw new Error('No encontré "ver una sola vez" para la nota de voz (no se envió).');
      }
      realClick(vo);
      await sleep(300);
    }
    const send = await waitFor(() => findButton(footer(), ICON.send, LABEL.send), 4000);
    if (!send) throw new Error('No encontré el botón para enviar la nota de voz.');
    realClick(send);
    await sleep(800);
  }

  // ---------- abrir un chat ----------
  function findChatRow(name) {
    const list = document.querySelector(SEL.chatList) || document.querySelector(SEL.side);
    if (!list) return null;
    for (const s of list.querySelectorAll('span[title]')) {
      if (sameChat(s.getAttribute('title'), name)) {
        return s.closest('[role="listitem"],[role="row"],[role="gridcell"],[tabindex="-1"],[tabindex="0"]') || s;
      }
    }
    return null;
  }

  async function openChat(name, phone) {
    if (sameChat(chatTitle(), name) || (phone && sameChat(chatTitle(), phone))) return true;
    let row = findChatRow(name) || (phone && findChatRow(phone));
    const sb = searchBox();
    if (!row && sb) {
      await typeInto(sb, name || phone);
      row = await waitFor(() => findChatRow(name) || (phone && findChatRow(phone)), 5000);
    }
    if (row) {
      realClick(row);
      const ok = await waitFor(() => sameChat(chatTitle(), name) || (phone && sameChat(chatTitle(), phone)), 6000);
      if (sb && norm(sb.value ?? sb.textContent)) {
        clearEditable(sb);
        pressKey(sb, 'Escape');
      }
      return !!ok;
    }
    if (sb) {
      clearEditable(sb);
      pressKey(sb, 'Escape');
    }
    return false;
  }

  HZ.wa = {
    sleep, waitFor, visible, norm, sameChat,
    composeBox, searchBox, footer, chatTitle, digits,
    sendText, insertText, sendFile, sendVoice, sendContact, openChat, realClick
  };
})();
