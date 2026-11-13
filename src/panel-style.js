// Estilos de HotZapp (van dentro de Shadow DOM para no chocar con WhatsApp).
globalThis.HZ.PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.hz {
  --bg: #161717; --bg2: #1f2121; --bg3: #2a2c2c; --line: #2f3232; --line2: #3b3f3f;
  --fg: #e9edef; --muted: #8d9599; --muted2: #6b7377;
  --blue: #1d6bff; --blue2: #3b82ff; --blue-soft: rgba(29,107,255,.16);
  --orange: #f97316; --red: #f05252; --green: #22c55e;
  color: var(--fg); font-size: 13px; line-height: 1.4;
}
button { font: inherit; color: inherit; }
svg { display: block; flex: none; }
input, textarea, select {
  font: inherit; font-size: 13px; color: var(--fg); background: var(--bg2); border: 1px solid var(--line2);
  border-radius: 8px; padding: 8px 10px; outline: none; width: 100%;
}
input::placeholder, textarea::placeholder { color: var(--muted2); }
input:focus, textarea:focus, select:focus { border-color: var(--blue); }
textarea { resize: vertical; min-height: 80px; }
select option { background: var(--bg2); }
.scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.scroll::-webkit-scrollbar-thumb { background: var(--line2); border-radius: 8px; }

/* ---------- botones ---------- */
.btn { border: 0; border-radius: 8px; padding: 9px 16px; cursor: pointer; font-weight: 600; font-size: 13px; background: var(--blue); color: #fff; display: inline-flex; align-items: center; gap: 6px; justify-content: center; }
.btn:hover { background: var(--blue2); }
.btn:disabled { opacity: .4; cursor: default; background: var(--blue); }
.btn.gray { background: #5b6068; }
.btn.gray:hover { background: #6b7078; }
.btn.ghost { background: var(--bg2); border: 1px solid var(--line2); color: var(--fg); }
.btn.ghost:hover { background: var(--bg3); }
.btn.danger { background: transparent; border: 1px solid var(--line2); color: var(--red); }
.btn.sm { padding: 5px 10px; font-size: 12px; }
.ib { background: transparent; border: 0; cursor: pointer; color: var(--muted); padding: 5px; border-radius: 7px; display: inline-grid; place-items: center; }
.ib:hover { background: var(--bg3); color: var(--fg); }
.ib.on { color: #f5b301; }

/* ---------- riel izquierdo ---------- */
.rail {
  position: fixed; z-index: 2147482990; display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 4px; width: 38px;
  box-shadow: 0 4px 18px rgba(0,0,0,.35);
}
.rail[hidden] { display: none; }
.rail .rb { position: relative; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; border: 0; background: transparent; color: var(--fg); cursor: pointer; }
.rail .rb:hover, .rail .rb.on { background: var(--bg3); }
.rail .rb .lbl { position: absolute; bottom: -3px; font-size: 8px; color: var(--muted); }
.rail .tog { height: 18px; color: var(--muted); }
.cnt { position: absolute; top: -3px; right: -4px; min-width: 15px; height: 15px; padding: 0 4px; border-radius: 10px; background: #8d9599; color: #111; font-size: 10px; font-weight: 700; display: grid; place-items: center; }
.cnt.orange { background: var(--orange); color: #fff; }

/* ---------- panel derecho ---------- */
.panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: var(--w, 340px); z-index: 2147482995;
  background: var(--bg); border-left: 1px solid var(--line); display: flex; flex-direction: column;
}
.panel[hidden] { display: none; }
.ph { display: flex; align-items: center; gap: 6px; padding: 14px 12px 10px 16px; }
.ph h2 { margin: 0; font-size: 17px; font-weight: 700; flex: 1; display: flex; align-items: center; gap: 8px; }
.pb { flex: 1; overflow-y: auto; padding: 4px 12px 16px; }
.status { border-top: 1px solid var(--line); padding: 8px 14px; font-size: 12px; color: var(--muted); min-height: 34px; display: flex; align-items: center; gap: 8px; }
.status:empty { display: none; }
.status.err { color: var(--red); }
.status.ok { color: var(--green); }
.bar { height: 4px; background: var(--bg3); border-radius: 4px; flex: 1; overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--blue); width: 0; transition: width .25s linear; }

/* menú principal */
.menu .sec { font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: .6px; padding: 8px 16px; background: var(--bg2); margin: 6px -12px; text-transform: uppercase; }
.menu .mi { display: flex; align-items: center; gap: 10px; padding: 11px 6px 11px 4px; cursor: pointer; border-radius: 8px; font-size: 14px; }
.menu .mi:hover { background: var(--bg2); }
.menu .mi span.t { flex: 1; }
.menu .mi .ico { position: relative; color: var(--fg); }
.menu .mi .ico .cnt { top: -7px; right: -7px; }
.menu .brand { display: flex; align-items: center; gap: 8px; padding: 6px 4px 10px; font-size: 14px; }
.menu .brand b { flex: 1; }
.logo { width: 22px; height: 22px; border-radius: 6px; background: var(--blue); color: #fff; display: grid; place-items: center; }

/* respuestas */
.search { display: flex; gap: 8px; margin-bottom: 8px; }
.search .in { flex: 1; position: relative; }
.search .in input { padding-right: 30px; height: 38px; }
.search .in .ib { position: absolute; right: 4px; top: 5px; }
.search .btn { height: 38px; padding: 0 16px; font-size: 14px; }
.hint { color: var(--muted); font-size: 12px; margin: 0 0 12px 2px; }
.kbd { font-family: ui-monospace, monospace; background: var(--bg3); border: 1px solid var(--line2); border-radius: 4px; padding: 0 5px; font-size: 11px; color: var(--fg); }
.cat { border-left: 2px solid var(--line2); margin: 0 0 6px 4px; padding-left: 10px; }
.cat-h { display: flex; align-items: center; gap: 8px; padding: 10px 0 8px 10px; cursor: pointer; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; }
.cat-h .dot { width: 10px; height: 10px; border-radius: 50%; background: #8d9599; }
.cat-h .chev { margin-left: auto; transition: transform .15s; }
.cat.closed .chev { transform: rotate(-90deg); }
.cat.closed .cat-b { display: none; }
.rcard { position: relative; display: flex; gap: 10px; background: var(--bg2); border: 1px solid transparent; border-radius: 10px; padding: 10px 10px 10px 4px; margin-bottom: 8px; cursor: pointer; }
.rcard:hover { border-color: var(--line2); background: #232525; }
.rcard.drag-over { border-color: var(--blue); }
.rcard .grip { color: var(--muted2); cursor: grab; align-self: center; }
.ticon { width: 30px; height: 30px; border-radius: 7px; display: grid; place-items: center; flex: none; }
.rcard .main { flex: 1; min-width: 0; }
.rcard .nm { font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 22px; }
.rcard .pv { color: var(--muted); font-size: 12px; margin: 4px 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rcard .ft { display: flex; align-items: center; gap: 8px; }
.rcard .ft .used { margin-left: auto; color: var(--muted); font-size: 11px; white-space: nowrap; }
.pill { border: 1px solid var(--line2); border-radius: 20px; padding: 2px 9px; font-size: 11px; color: var(--muted); background: transparent; cursor: pointer; white-space: nowrap; }
.pill:hover { color: var(--fg); border-color: var(--muted); }
.rcard .star { position: absolute; top: 6px; right: 6px; }
.rcard .acts { position: absolute; top: 6px; right: 34px; display: none; gap: 2px; }
.rcard:hover .acts { display: flex; }
.rcard.busy { opacity: .6; }
.empty { color: var(--muted); text-align: center; padding: 26px 10px; line-height: 1.6; }

/* listas genéricas */
.item { background: var(--bg2); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
.item .t { font-weight: 600; }
.item .m { color: var(--muted); font-size: 12px; margin-top: 3px; }
.row { display: flex; gap: 8px; align-items: center; }
.grow { flex: 1; min-width: 0; }
.field { margin-bottom: 14px; }
.field > label, .lbl { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--fg); }
.field > label .opt, .lbl .opt { font-weight: 400; color: var(--muted); }
.req { color: var(--red); }
.badge { display: inline-block; border-radius: 20px; padding: 1px 8px; font-size: 11px; font-weight: 600; }
.badge.pending { background: rgba(245,165,36,.18); color: #f5b74a; }
.badge.sent { background: rgba(34,197,94,.16); color: #4ade80; }
.badge.failed { background: rgba(240,82,82,.16); color: #f87171; }
.badge.sending { background: var(--blue-soft); color: #7aa7ff; }
h3.sec2 { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin: 18px 0 8px; }
.check { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--muted); display: grid; place-items: center; cursor: pointer; flex: none; background: transparent; color: #fff; padding: 0; }
.check.on { background: var(--blue); border-color: var(--blue); }
.done .t { text-decoration: line-through; color: var(--muted); }
.overdue { color: #f87171 !important; }

/* ---------- modal ---------- */
.ov { position: fixed; inset: 0; z-index: 2147483100; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 20px; }
.ov[hidden] { display: none; }
.modal { background: #1a1b1b; border-radius: 14px; width: min(560px, 100%); max-height: calc(100vh - 40px); display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
.modal.wide { width: min(1200px, 100%); height: calc(100vh - 40px); }
.modal h2 { margin: 0; padding: 20px 22px 14px; text-align: center; font-size: 20px; display: flex; justify-content: center; align-items: center; gap: 10px; }
.modal .mb { overflow-y: auto; padding: 0 22px 8px; flex: 1; }
.modal .mf { padding: 14px 22px 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.missing { color: var(--orange); font-size: 12px; padding: 0 22px; }
.types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.tbtn { background: transparent; border: 1px solid var(--line2); border-radius: 10px; padding: 18px 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 600; }
.tbtn:hover { background: var(--bg2); border-color: var(--muted2); }
.tbtn.seq { grid-column: 1 / -1; flex-direction: row; justify-content: flex-start; gap: 14px; padding: 14px 18px; text-align: left; }
.tbtn.seq small { display: block; color: var(--muted); font-weight: 400; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.vchip { background: var(--bg3); border: 1px solid var(--line2); border-radius: 20px; padding: 3px 10px; font-size: 12px; cursor: pointer; color: var(--fg); }
.vchip:hover { border-color: var(--muted); }
.help { color: var(--muted); font-size: 12px; margin-top: 6px; }
.more { display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--fg); font-weight: 600; margin: 4px 0 12px; user-select: none; }
.more .opt { font-weight: 400; color: var(--muted); }
.more svg { transition: transform .15s; transform: rotate(-90deg); }
.more.open svg { transform: none; }
.drop { border: 1.5px dashed var(--line2); border-radius: 10px; padding: 22px; text-align: center; cursor: pointer; color: var(--fg); }
.drop small { display: block; color: var(--muted); margin-top: 4px; font-size: 11px; }
.drop.over { border-color: var(--blue); background: var(--blue-soft); }
.preview { display: flex; align-items: center; gap: 10px; background: var(--bg2); border-radius: 10px; padding: 10px; }
.preview img, .preview video { max-height: 120px; max-width: 200px; border-radius: 8px; }
.preview audio { flex: 1; height: 36px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.big { border: 1px solid var(--line2); border-radius: 10px; padding: 18px 8px; text-align: center; cursor: pointer; background: transparent; display: flex; flex-direction: column; align-items: center; gap: 6px; font-weight: 600; }
.big:hover { background: var(--bg2); }
.big small { color: var(--muted); font-weight: 400; font-size: 11px; }
.big.rec { border-color: var(--red); color: var(--red); }
.sw { display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 6px 0; user-select: none; }
.sw .tr { width: 32px; height: 18px; border-radius: 10px; background: #4b5055; position: relative; flex: none; transition: background .15s; }
.sw .tr::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left .15s; }
.sw.on .tr { background: var(--blue); }
.sw.on .tr::after { left: 16px; }
.pref { display: flex; align-items: center; gap: 10px; padding: 7px 0; }
.pref .grow { color: var(--fg); }
.seg { display: flex; border: 1px solid var(--line2); border-radius: 8px; overflow: hidden; }
.seg button { flex: 1; border: 0; background: transparent; padding: 3px 10px; cursor: pointer; color: var(--fg); }
.seg button.on { background: var(--blue); color: #fff; border-radius: 7px; }
.short { position: relative; }
.short::before { content: ";"; position: absolute; left: 11px; top: 8px; color: var(--muted); font-weight: 700; }
.short input { padding-left: 24px; }
.seqi { display: flex; align-items: center; gap: 8px; background: var(--bg2); border-radius: 9px; padding: 8px 10px; margin-bottom: 6px; }
.seqi .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seqi input { width: 58px; padding: 4px 6px; }
.addseq { border: 1.5px dashed var(--line2); border-radius: 10px; padding: 12px; text-align: center; color: #7aa7ff; font-weight: 600; cursor: pointer; }
.kv { display: grid; grid-template-columns: 130px 1fr; gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); align-items: start; }
.kv b { font-size: 13px; }
.kv .v { display: flex; flex-direction: column; gap: 4px; }
.kv .v small { color: var(--muted); }
.picker { max-height: 280px; overflow-y: auto; border: 1px solid var(--line2); border-radius: 10px; margin-top: 8px; }
.picker .pi { display: flex; gap: 10px; align-items: center; padding: 8px 10px; cursor: pointer; }
.picker .pi:hover { background: var(--bg2); }

/* ---------- CRM ---------- */
.board { display: flex; gap: 12px; overflow-x: auto; height: 100%; padding-bottom: 8px; align-items: flex-start; }
.col { background: var(--bg2); border-radius: 12px; width: 250px; flex: none; display: flex; flex-direction: column; max-height: 100%; }
.col.over { outline: 2px dashed var(--blue); }
.col header { padding: 10px; display: flex; gap: 6px; align-items: center; border-bottom: 1px solid var(--line); }
.col header input[type=text] { font-weight: 700; border-color: transparent; background: transparent; padding: 4px 6px; }
.col header input[type=text]:focus { border-color: var(--blue); }
.col header input[type=color] { width: 22px; height: 22px; padding: 0; border: 0; background: none; flex: none; cursor: pointer; }
.col .n { color: var(--muted); font-size: 12px; }
.col .items { padding: 8px; overflow-y: auto; flex: 1; min-height: 50px; }
.lead { background: var(--bg); border: 1px solid var(--line); border-radius: 9px; padding: 8px 10px; margin-bottom: 6px; cursor: grab; }
.lead:hover { border-color: var(--line2); }
.lead .t { font-weight: 600; display: flex; gap: 6px; align-items: center; }
.lead .t span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.lead .t span:hover { color: #7aa7ff; }
.lead .m { color: var(--muted); font-size: 11px; margin-top: 3px; }
.col footer { padding: 8px; }

/* ---------- barra inferior ---------- */
.cbar { min-width: 0; max-width: 100%; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg); border-top: 1px solid var(--line); overflow: hidden; }
.cbar .circle { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; flex: none; border: 1px solid var(--line2); background: transparent; color: var(--muted); padding: 0; }
.cbar .fbtn { width: 30px; height: 30px; background: var(--blue); color: #fff; border: 0; position: relative; }
.cbar .fbtn .dot { position: absolute; top: 1px; right: 1px; width: 9px; height: 9px; border-radius: 50%; background: #fff; border: 2px solid var(--blue); }
.chiprow { display: flex; gap: 8px; overflow-x: auto; flex: 1; min-width: 0; scrollbar-width: none; }
.chiprow::-webkit-scrollbar { display: none; }
.chip { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; border: 1px solid var(--line2); border-radius: 20px; padding: 4px 12px; cursor: pointer; background: var(--bg2); color: var(--fg); font-size: 12.5px; flex: none; }
.chip:hover { border-color: var(--muted); }
.chip .n { background: var(--bg3); border-radius: 10px; padding: 0 7px; font-size: 11px; font-weight: 700; }
.chip.armed { border-color: var(--orange); color: var(--orange); }
.chip.busy { opacity: .55; }
.chip.colored { border: 0; color: #111; font-weight: 600; }
.chip.colored .n { background: rgba(0,0,0,.18); }
.fpop { position: fixed; z-index: 2147483050; background: #1d1f1f; border: 1px solid var(--line); border-radius: 12px; width: 280px; padding: 10px 14px; box-shadow: 0 10px 30px rgba(0,0,0,.5); }
.fpop[hidden] { display: none; }
.fpop h4 { margin: 4px 0 6px; font-size: 11px; letter-spacing: .6px; color: var(--muted); text-transform: uppercase; }
.fpop .fi { display: flex; align-items: center; gap: 10px; padding: 6px 0; cursor: pointer; }
.fpop hr { border: 0; border-top: 1px solid var(--line); margin: 8px 0; }
.fpop .seg { margin: 4px 0 6px; }

.jobs { display: flex; gap: 6px; flex: 0 1 auto; max-width: 55%; overflow-x: auto; scrollbar-width: none; margin-left: auto; padding-left: 6px; border-left: 1px solid var(--line); }
.jobs::-webkit-scrollbar { display: none; }
.jobs:empty { display: none; }
.jobchip { background: rgba(240,82,82,.14); border-color: rgba(240,82,82,.5); color: #fca5a5; }
.jobchip:hover { background: rgba(240,82,82,.25); border-color: #f05252; }
.jobchip b { color: #fff; }
.jobchip b:empty { display: none; }
.jobchip .x { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: rgba(240,82,82,.35); color: #fff; margin-left: 2px; }
.jobchip.all { background: #f05252; color: #fff; border-color: #f05252; }
.spin { width: 10px; height: 10px; border-radius: 50%; border: 2px solid rgba(252,165,165,.35); border-top-color: #fca5a5; animation: hzspin .8s linear infinite; }
@keyframes hzspin { to { transform: rotate(360deg); } }
.seqi.wait { background: transparent; border: 1px dashed var(--line2); }
.seqm { background: var(--bg2); border-radius: 10px; padding: 10px; margin-bottom: 8px; }
.seqm-h { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.seqm-h .n { flex: 1; min-width: 0; }
.seqm .preview { background: var(--bg); }
.seqm .drop { padding: 14px; }
.seqm .big { padding: 10px 6px; }
.seqm .chips .vchip { font-size: 11px; padding: 2px 8px; }
.addtypes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.addtype { display: flex; align-items: center; gap: 8px; justify-content: center; border: 1px solid var(--line2); background: transparent; border-radius: 9px; padding: 9px 6px; cursor: pointer; font-weight: 600; color: var(--fg); }
.addtype:hover { background: var(--bg2); border-color: var(--muted2); }
.seqbtns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.wtags { display: inline-flex; gap: 4px; }

/* popup ";" */
.pop { position: fixed; z-index: 2147483001; background: #1d1f1f; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.5); max-height: 300px; overflow-y: auto; min-width: 320px; padding: 4px; }
.pop[hidden] { display: none; }
.pop .it { padding: 7px 10px; border-radius: 8px; cursor: pointer; display: flex; gap: 10px; align-items: center; }
.pop .it.on, .pop .it:hover { background: var(--bg3); }
.pop .it .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pop .ph2 { color: var(--muted); font-size: 11px; padding: 6px 10px; }
.toast { position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%); z-index: 2147483200; background: #2a2c2c; color: var(--fg); padding: 10px 16px; border-radius: 10px; font-weight: 600; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
`;
