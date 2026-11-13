// Sección "Estadísticas": métricas de hoy / 7 días / 30 días, quién está esperando,
// exportar a Excel (.xlsx) con código de verificación y verificar un archivo recibido.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const I = HZ.icon;
  const esc = HZ.escape;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const MIN = 60000;
  const DAY = 86400000;
  const SALT = 'hotzapp-stats-v1·7f3a9c';

  const RANGES = {
    today: { label: 'Hoy', days: 1 },
    week: { label: 'Últimos 7 días', days: 7 },
    month: { label: 'Últimos 30 días', days: 30 }
  };
  let range = 'today';

  const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function period(key) {
    const to = Date.now();
    const from = startOfDay(to) - (RANGES[key].days - 1) * DAY;
    return { from, to };
  }
  const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
  const mins = (ms) => (ms == null ? '' : Math.round((ms / MIN) * 10) / 10);
  const fDate = (t) => new Date(t).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const fDateTime = (t) => new Date(t).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function account() {
    try {
      const raw = localStorage.getItem('last-wid-md') || localStorage.getItem('last-wid') || '';
      const num = raw.replace(/"/g, '').split(/[:@]/)[0];
      return /^\d{8,}$/.test(num) ? '+' + num : '';
    } catch (_) { return ''; }
  }

  // =============== vista ===============
  app.views.stats = {
    render(head, body) {
      head.innerHTML = app.header('Estadísticas');
      const s = app.state.settings;
      const { from, to } = period(range);
      const st = HZ.tracker.compute(from, to);
      const limit = (Number(s.waitMinutes) || 15) * MIN;
      const waits = HZ.tracker.waiting().slice(0, 30);
      const tile = (label, val, sub = '', warn = false) =>
        `<div class="item" style="margin:0"><div class="m" style="margin:0 0 2px">${label}</div><div style="font-size:20px;font-weight:700;${warn ? 'color:#f87171' : ''}">${val}</div>${sub ? `<div class="m">${sub}</div>` : ''}</div>`;

      let days = '';
      if (range !== 'today') {
        const arr = [];
        for (let d = startOfDay(from); d <= to; d += DAY) arr.push({ d, c: HZ.tracker.compute(d, Math.min(to, d + DAY - 1)) });
        const max = Math.max(1, ...arr.map((x) => x.c.conversations));
        days = `<h3 class="sec2">Conversaciones por día</h3>
          <div class="item" style="display:flex;align-items:flex-end;gap:${range === 'week' ? 8 : 2}px;height:120px;padding:10px">
            ${arr.map((x) => `<div title="${fDate(x.d)}: ${x.c.conversations} conversaciones · ${x.c.answered}/${x.c.withIncoming} respondidas" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%">
              <div style="width:100%;background:var(--blue);border-radius:3px 3px 0 0;height:${Math.max(2, (x.c.conversations / max) * 80)}px"></div>
              ${range === 'week' ? `<div class="m" style="font-size:10px;margin-top:3px">${new Date(x.d).toLocaleDateString('es-AR', { weekday: 'short' })}</div>` : ''}</div>`).join('')}
          </div>`;
      }

      body.innerHTML = `
        <div class="seg" style="margin-bottom:12px">${Object.entries(RANGES).map(([k, r]) => `<button data-range="${k}" class="${range === k ? 'on' : ''}">${k === 'today' ? 'Hoy' : k === 'week' ? '7 días' : '30 días'}</button>`).join('')}</div>
        <div class="two">
          ${tile('Conversaciones', st.conversations, `${st.newConversations} nuevas`)}
          ${tile('Respondidas', `${st.answered}/${st.withIncoming}`, st.withIncoming ? pct(st.answered / st.withIncoming) : '')}
          ${tile('Tiempo de respuesta', HZ.fmtDur(st.avgRt), `mediana ${HZ.fmtDur(st.medianRt)}`)}
          ${tile('Sin responder', st.unanswered, `máx. espera ${HZ.fmtDur(st.maxRt)}`, st.unanswered > 0)}
          ${tile('Mensajes', `${st.received} / ${st.sent}`, 'recibidos / enviados')}
          ${tile('Respondidas rápido', pct(st.under5), `en menos de 5 min · ${pct(st.under60)} en < 1 h`)}
        </div>
        ${days}
        <button class="btn" style="width:100%;margin-top:14px;height:42px;font-size:14px" data-st="export">${I('download', 17)} Exportar estadísticas</button>
        <button class="btn ghost" style="width:100%;margin-top:8px" data-st="verify">${I('check', 15)} Verificar un archivo recibido</button>
        <input type="file" hidden accept=".xlsx" data-stfile>

        <h3 class="sec2">Esperando respuesta ahora (${waits.length})</h3>
        ${waits.length ? waits.map((w) => `<div class="item"><div class="row"><span class="t grow">${esc(w.name)}</span>
            <span class="badge ${w.wait >= limit ? 'failed' : 'pending'}">⏱ ${HZ.fmtDur(w.wait)}</span>
            <button class="btn sm ghost" data-stopen="${esc(w.name)}">Abrir</button></div>
            <div class="m">desde ${fDateTime(w.since)}</div></div>`).join('') : '<div class="empty">Nadie está esperando respuesta 🎉</div>'}

        <h3 class="sec2">Avisos</h3>
        <div class="pref"><span class="grow">Avisar cuando alguien espera respuesta</span><div class="sw ${s.waitAlert ? 'on' : ''}" data-stset="waitAlert"><span class="tr"></span></div></div>
        <div class="row" style="margin:4px 0 8px"><span class="grow help" style="margin:0">Avisar después de</span><input type="number" min="1" max="1440" data-stmin value="${s.waitMinutes}" style="width:80px"><span class="help" style="margin:0">min</span></div>
        <div class="pref"><span class="grow">Mostrar el temporizador en la lista de chats</span><div class="sw ${s.listShowTimer ? 'on' : ''}" data-stset="listShowTimer"><span class="tr"></span></div></div>
        <div class="pref"><span class="grow">Incluir grupos en las estadísticas</span><div class="sw ${s.statsGroups ? 'on' : ''}" data-stset="statsGroups"><span class="tr"></span></div></div>

        <h3 class="sec2">Cómo se mide</h3>
        <p class="hint" style="line-height:1.6">WhatsApp no guarda estas estadísticas en cuentas normales, así que HotZapp las calcula <b>desde que está instalado</b>, mientras WhatsApp Web esté abierto: mira la lista de chats y lee la hora exacta de los mensajes de cada chat que abrís. Si se responde desde el celular con WhatsApp Web cerrado, se registra la próxima vez que se abra ese chat en la compu.<br>
        <b>Tiempo de respuesta</b>: desde el primer mensaje del cliente sin contestar hasta tu respuesta.</p>`;
    }
  };

  const body = app.el.body;
  body.addEventListener('click', (e) => {
    if (app.view !== 'stats') return;
    const t = e.target.closest('[data-range],[data-st],[data-stopen],[data-stset]');
    if (!t) return;
    if (t.dataset.range) { range = t.dataset.range; return app.render(); }
    if (t.dataset.stopen) return app.openChat(t.dataset.stopen);
    if (t.dataset.stset) return app.saveSettings({ [t.dataset.stset]: !app.state.settings[t.dataset.stset] });
    if (t.dataset.st === 'export') return openExport();
    if (t.dataset.st === 'verify') { const f = body.querySelector('[data-stfile]'); f.value = ''; f.click(); }
  });
  body.addEventListener('change', async (e) => {
    if (app.view !== 'stats') return;
    if (e.target.matches('[data-stmin]')) await app.saveSettings({ waitMinutes: Math.max(1, Number(e.target.value) || 15) });
    if (e.target.matches('[data-stfile]') && e.target.files[0]) verifyFile(e.target.files[0]);
  });
  // refrescar los números cada minuto mientras se mira
  setInterval(() => {
    const a = app.root.activeElement;
    if (app.open && app.view === 'stats' && !(a && a.matches('input'))) app.render();
  }, 60000);

  // =============== ventana "Exportar estadísticas" ===============
  function openExport() {
    let sel = range;
    const m = app.modal('');
    const draw = () => {
      m.innerHTML = `
        <h2>${I('download', 22)} Exportar estadísticas</h2>
        <div class="mb">
          <p class="hint" style="text-align:center">¿De qué período querés descargar las estadísticas?</p>
          <div class="types" style="grid-template-columns:repeat(3,1fr)">
            ${Object.entries(RANGES).map(([k, r]) => {
              const p = period(k);
              const c = HZ.tracker.compute(p.from, p.to);
              return `<button class="tbtn" data-exr="${k}" style="${sel === k ? 'border-color:var(--blue);background:var(--blue-soft)' : ''}">
                <span style="font-size:15px">${r.label}</span><small style="color:var(--muted);font-weight:400">${c.conversations} conversaciones</small></button>`;
            }).join('')}
          </div>
          <div class="item" style="margin-top:14px;line-height:1.6">
            Se descarga un archivo <b>Excel (.xlsx)</b> que abre en Excel, Google Sheets o Numbers, con 3 hojas: <b>Resumen</b>, <b>Por día</b> y <b>Conversaciones</b>.<br>
            Incluye la cuenta de WhatsApp, quién lo exportó, la fecha y un <b>código de verificación</b>: con “Verificar un archivo recibido” podés comprobar que nadie cambió los números.
          </div>
        </div>
        <div class="mf"><button class="btn gray" data-exx="cancel">Cancelar</button><button class="btn" data-exx="go">${I('download', 15)} Descargar</button></div>`;
    };
    draw();
    m.addEventListener('click', async (e) => {
      const r = e.target.closest('[data-exr]');
      if (r) { sel = r.dataset.exr; return draw(); }
      const x = e.target.closest('[data-exx]');
      if (!x) return;
      if (x.dataset.exx === 'cancel') return app.closeModal();
      x.disabled = true;
      try {
        await exportXlsx(sel);
        app.closeModal();
      } catch (err) {
        app.toast('No se pudo exportar: ' + err.message, 5000);
        x.disabled = false;
      }
    });
  }

  // =============== XLSX ===============
  const xmlEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const colName = (i) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '') + String.fromCharCode(65 + (i % 26));
  function cell(ref, v, style) {
    const s = style ? ` s="${style}"` : '';
    if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
    if (v === null || v === undefined || v === '') return `<c r="${ref}"${s}/>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }
  // rows: [[valores...]], cada fila puede ser { cells, style }
  function sheetXml(rows, widths) {
    const cols = widths ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const data = rows.map((row, r) => {
      const { cells, style } = Array.isArray(row) ? { cells: row, style: 0 } : row;
      return `<row r="${r + 1}">${cells.map((v, c) => cell(colName(c) + (r + 1), v, style)).join('')}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${data}</sheetData></worksheet>`;
  }
  function buildXlsx(sheets) {
    const ns = 'http://schemas.openxmlformats.org';
    const files = [];
    const add = (path, s) => files.push({ path, data: enc.encode(s) });
    add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
    add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
    add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    add('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F7"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows, s.widths)));
    return HZ.backup.makeZip(files);
  }

  async function sha(text) {
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(SALT + text));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return hex.slice(0, 16).match(/.{4}/g).join('-');
  }

  function summaryRows(st) {
    return [
      ['Conversaciones', st.conversations],
      ['Conversaciones nuevas', st.newConversations],
      ['Conversaciones con mensajes del cliente', st.withIncoming],
      ['Respondidas', st.answered],
      ['Sin responder', st.unanswered],
      ['% respondidas', st.withIncoming ? Math.round((st.answered / st.withIncoming) * 100) : 0],
      ['Mensajes recibidos', st.received],
      ['Mensajes enviados', st.sent],
      ['Respuestas medidas', st.responses],
      ['Tiempo de respuesta promedio (min)', st.avgRt == null ? '' : mins(st.avgRt)],
      ['Tiempo de respuesta mediana (min)', st.medianRt == null ? '' : mins(st.medianRt)],
      ['Espera más larga (min)', st.maxRt == null ? '' : mins(st.maxRt)],
      ['% respondidas en menos de 5 min', st.under5 == null ? '' : Math.round(st.under5 * 100)],
      ['% respondidas en menos de 1 hora', st.under60 == null ? '' : Math.round(st.under60 * 100)]
    ];
  }

  async function exportXlsx(key) {
    const { from, to } = period(key);
    const st = HZ.tracker.compute(from, to);
    const acc = account();
    const who = app.state.settings.myName || '';
    const gen = Date.now();
    const sum = summaryRows(st);
    const payload = JSON.stringify({ v: 1, acc, who, range: RANGES[key].label, from, to, gen, sum });
    const code = await sha(payload);
    const stageName = (n) => {
      const c = app.state.contacts[n];
      const s = c && app.state.stages.find((x) => x.id === c.stageId);
      return s ? s.name : '';
    };

    const resumen = [
      { cells: ['Estadísticas de WhatsApp · HotZapp'], style: 3 },
      [],
      ['Período', RANGES[key].label],
      ['Desde', fDateTime(from)],
      ['Hasta', fDateTime(to)],
      ['Cuenta de WhatsApp', acc || '(no disponible)'],
      ['Exportado por', who || '(sin nombre: configuralo en Herramientas)'],
      ['Generado', fDateTime(gen)],
      ['Código de verificación', code],
      [],
      { cells: ['Indicador', 'Valor'], style: 2 },
      ...sum,
      [],
      ['Cómo se mide: HotZapp registra los chats mientras WhatsApp Web está abierto en esta computadora.'],
      ['Tiempo de respuesta = desde el primer mensaje del cliente sin contestar hasta la respuesta.']
    ];

    const porDia = [{ cells: ['Fecha', 'Conversaciones', 'Nuevas', 'Con mensajes del cliente', 'Respondidas', 'Sin responder', 'Recibidos', 'Enviados', 'T. respuesta promedio (min)', 'T. respuesta mediana (min)'], style: 2 }];
    for (let d = startOfDay(from); d <= to; d += DAY) {
      const c = HZ.tracker.compute(d, Math.min(to, d + DAY - 1));
      porDia.push([new Date(d).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }), c.conversations, c.newConversations, c.withIncoming, c.answered, c.unanswered, c.received, c.sent, mins(c.avgRt), mins(c.medianRt)]);
    }

    const convs = [{ cells: ['Chat', 'Etapa CRM', 'Recibidos', 'Enviados', 'Nueva', 'Respondida', 'T. respuesta promedio (min)', 'Espera más larga (min)', 'Último mensaje', 'Esperando respuesta desde'], style: 2 }];
    for (const c of st.chats) {
      convs.push([c.name, stageName(c.name), c.received, c.sent, c.isNew ? 'Sí' : 'No', c.answered === null ? '—' : c.answered ? 'Sí' : 'No', mins(c.avgRt), mins(c.maxRt), fDateTime(c.last), c.pending ? fDateTime(c.pendingSince) : '']);
    }

    const blob = buildXlsx([
      { name: 'Resumen', rows: resumen, widths: [40, 34] },
      { name: 'Por día', rows: porDia, widths: [30, 15, 10, 22, 12, 13, 11, 11, 24, 24] },
      { name: 'Conversaciones', rows: convs, widths: [30, 20, 11, 11, 8, 11, 24, 20, 20, 24] },
      { name: 'verificacion', hidden: true, rows: [[payload], [code]] }
    ]);
    const d = new Date(gen);
    const pad = (x) => String(x).padStart(2, '0');
    const slug = (who || 'equipo').normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Estadisticas-${key === 'today' ? 'hoy' : key === 'week' ? '7-dias' : '30-dias'}-${slug}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    app.status(`✅ Estadísticas exportadas (${RANGES[key].label})`, 'ok');
  }

  // =============== verificar un archivo ===============
  async function readSheets(file) {
    const files = await HZ.backup.readZip(await file.arrayBuffer());
    const xml = (p) => {
      const u = files.get(p);
      return u ? new DOMParser().parseFromString(dec.decode(u), 'application/xml') : null;
    };
    const wb = xml('xl/workbook.xml');
    const rels = xml('xl/_rels/workbook.xml.rels');
    if (!wb || !rels) throw new Error('No es un archivo de Excel válido');
    const shared = [];
    const ss = xml('xl/sharedStrings.xml');
    if (ss) ss.querySelectorAll('si').forEach((si) => shared.push([...si.querySelectorAll('t')].map((t) => t.textContent).join('')));
    const relMap = {};
    rels.querySelectorAll('Relationship').forEach((r) => (relMap[r.getAttribute('Id')] = r.getAttribute('Target')));
    const out = {};
    wb.querySelectorAll('sheet').forEach((sh) => {
      const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let target = relMap[rid] || '';
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const doc = xml(target);
      if (!doc) return;
      const rows = [];
      doc.querySelectorAll('row').forEach((row) => {
        const vals = [];
        row.querySelectorAll('c').forEach((c) => {
          const ref = c.getAttribute('r') || '';
          const col = ref.replace(/\d+/g, '').split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
          const t = c.getAttribute('t');
          let v;
          if (t === 'inlineStr') v = [...c.querySelectorAll('t')].map((x) => x.textContent).join('');
          else if (t === 's') v = shared[+((c.querySelector('v') || {}).textContent)] ?? '';
          else v = (c.querySelector('v') || {}).textContent ?? '';
          vals[col >= 0 ? col : vals.length] = v;
        });
        rows.push(vals);
      });
      out[sh.getAttribute('name')] = rows;
    });
    return out;
  }

  async function verifyFile(file) {
    let ok = false;
    let html = '';
    try {
      const sheets = await readSheets(file);
      const ver = sheets.verificacion;
      if (!ver || !ver[0] || !ver[1]) throw new Error('Este Excel no fue exportado por HotZapp (no tiene datos de verificación).');
      const payload = ver[0][0];
      const code = ver[1][0];
      const data = JSON.parse(payload);
      const realCode = await sha(payload);
      const changes = [];
      if (realCode !== code) changes.push('Los datos internos de verificación fueron alterados.');
      const res = sheets.Resumen || [];
      const shown = {};
      res.forEach((r) => { if (r && r[0] != null) shown[r[0]] = r[1]; });
      if (shown['Código de verificación'] !== undefined && shown['Código de verificación'] !== realCode) changes.push('El código de verificación de la hoja Resumen no coincide.');
      for (const [label, val] of data.sum) {
        const vis = shown[label];
        const same = String(val) === '' ? String(vis ?? '') === '' : vis !== undefined && vis !== '' && Math.abs(Number(vis) - Number(val)) < 0.051;
        if (!same) changes.push(`“${label}”: dice ${vis === undefined || vis === '' ? '(vacío)' : vis}, el original era ${val === '' ? '(vacío)' : val}.`);
      }
      ok = !changes.length;
      html = `
        <div class="item" style="line-height:1.7">
          <b>Cuenta de WhatsApp:</b> ${esc(data.acc || '(no disponible)')}<br>
          <b>Exportado por:</b> ${esc(data.who || '(sin nombre)')}<br>
          <b>Período:</b> ${esc(data.range)} · ${fDateTime(data.from)} → ${fDateTime(data.to)}<br>
          <b>Generado:</b> ${fDateTime(data.gen)}
        </div>
        ${ok ? '' : `<div class="item" style="border:1px solid #f05252"><b style="color:#f87171">Cambios detectados:</b><br>${changes.map(esc).join('<br>')}</div>`}
        <div class="item">${data.sum.map(([l, v]) => `<div class="row" style="padding:3px 0"><span class="grow m" style="margin:0">${esc(l)}</span><b>${v === '' ? '—' : esc(v)}</b></div>`).join('')}</div>`;
    } catch (e) {
      html = `<div class="item">${esc(e.message)}</div>`;
    }
    const m = app.modal(`
      <h2>${ok ? '✅ Archivo original' : '⚠️ No se puede confirmar'}</h2>
      <div class="mb scroll"><p class="hint" style="text-align:center">${ok ? 'Los números coinciden con lo que registró HotZapp: nadie los modificó.' : 'Este archivo fue modificado o no es una exportación de HotZapp.'}</p>${html}</div>
      <div class="mf"><button class="btn" data-vclose>Cerrar</button></div>`);
    m.querySelector('[data-vclose]').onclick = () => app.closeModal();
  }

  HZ.stats = { exportXlsx, verifyFile, readSheets };
})();
