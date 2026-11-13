// Estilos del panel (van dentro de un Shadow DOM para no chocar con WhatsApp).
globalThis.HZ.PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: "Segoe UI", Helvetica, Arial, sans-serif; }
.hz {
  --bg: #ffffff; --bg2: #f4f5f7; --fg: #111b21; --muted: #667781; --line: #e3e6ea;
  --accent: #ff5722; --accent2: #ffede6; --ok: #10b981; --err: #ef4444;
  color: var(--fg); font-size: 13px;
}
@media (prefers-color-scheme: dark) {
  .hz { --bg: #111b21; --bg2: #1f2c34; --fg: #e9edef; --muted: #8696a0; --line: #2a3942; --accent2: #3a2219; }
}
.launcher {
  position: fixed; right: 0; top: 50%; transform: translateY(-50%); z-index: 2147483000;
  background: var(--accent); color: #fff; border: 0; border-radius: 10px 0 0 10px;
  padding: 12px 7px; cursor: pointer; writing-mode: vertical-rl; font-weight: 700; letter-spacing: 1px;
  box-shadow: 0 2px 10px rgba(0,0,0,.25); font-size: 13px;
}
.launcher:hover { padding-right: 10px; }
.panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: var(--w, 360px); z-index: 2147483000;
  background: var(--bg); border-left: 1px solid var(--line); display: flex; flex-direction: column;
  box-shadow: -4px 0 18px rgba(0,0,0,.12);
}
.panel[hidden], .launcher[hidden] { display: none; }
header.top { padding: 12px 14px 10px; border-bottom: 1px solid var(--line); background: var(--bg); }
.brand { display: flex; align-items: center; gap: 8px; }
.brand b { font-size: 16px; flex: 1; }
.logo { width: 24px; height: 24px; border-radius: 7px; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 14px; }
.icon-btn { background: transparent; border: 0; cursor: pointer; color: var(--muted); font-size: 16px; padding: 4px 6px; border-radius: 6px; }
.icon-btn:hover { background: var(--bg2); color: var(--fg); }
.current { margin-top: 10px; display: flex; gap: 8px; align-items: center; background: var(--bg2); padding: 8px 10px; border-radius: 10px; }
.current .name { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.current .none { color: var(--muted); font-weight: 400; }
select, input, textarea {
  font-size: 13px; color: var(--fg); background: var(--bg); border: 1px solid var(--line);
  border-radius: 8px; padding: 6px 8px; outline: none; width: 100%;
}
select:focus, input:focus, textarea:focus { border-color: var(--accent); }
.current select { width: auto; max-width: 150px; }
nav.tabs { display: flex; border-bottom: 1px solid var(--line); }
nav.tabs button {
  flex: 1; background: none; border: 0; padding: 10px 4px; cursor: pointer; color: var(--muted);
  font-weight: 600; font-size: 13px; border-bottom: 2px solid transparent;
}
nav.tabs button.on { color: var(--accent); border-bottom-color: var(--accent); }
.body { flex: 1; overflow-y: auto; padding: 12px 14px; }
.empty { color: var(--muted); text-align: center; padding: 24px 8px; line-height: 1.5; }
.reply {
  border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin-bottom: 8px;
  display: flex; gap: 10px; align-items: center; cursor: pointer; background: var(--bg);
}
.reply:hover { border-color: var(--accent); background: var(--accent2); }
.reply .info { flex: 1; min-width: 0; }
.reply .t { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reply .s { color: var(--muted); font-size: 12px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kbd { font-family: ui-monospace, monospace; background: var(--bg2); border-radius: 4px; padding: 0 4px; font-size: 11px; }
.send {
  background: var(--accent); color: #fff; border: 0; border-radius: 50%; width: 32px; height: 32px;
  cursor: pointer; font-size: 13px; flex: none;
}
.send:disabled { opacity: .5; cursor: default; }
.btn { background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 600; font-size: 13px; }
.btn.ghost { background: var(--bg2); color: var(--fg); }
.btn.small { padding: 4px 8px; font-size: 12px; }
.row { display: flex; gap: 8px; align-items: center; }
.field { margin-bottom: 10px; }
.field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; font-weight: 600; }
.stage { margin-bottom: 12px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.stage h4 { margin: 0; padding: 8px 10px; font-size: 13px; display: flex; align-items: center; gap: 8px; background: var(--bg2); }
.stage h4 .dot { width: 10px; height: 10px; border-radius: 50%; }
.stage h4 .count { margin-left: auto; color: var(--muted); font-weight: 400; }
.card { display: flex; gap: 6px; align-items: center; padding: 7px 10px; border-top: 1px solid var(--line); }
.card .n { flex: 1; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card .n:hover { color: var(--accent); }
.card select { width: 110px; padding: 3px 4px; font-size: 12px; }
.sched { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
.sched .w { font-weight: 600; }
.sched .m { color: var(--muted); font-size: 12px; margin-top: 2px; }
.badge { display: inline-block; border-radius: 20px; padding: 1px 8px; font-size: 11px; font-weight: 600; }
.badge.pending { background: #fef3c7; color: #92400e; }
.badge.sent { background: #d1fae5; color: #065f46; }
.badge.failed { background: #fee2e2; color: #991b1b; }
.badge.sending { background: #dbeafe; color: #1e40af; }
h3.sec { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); margin: 16px 0 8px; }
.status {
  border-top: 1px solid var(--line); padding: 8px 14px; font-size: 12px; color: var(--muted); min-height: 34px;
  display: flex; align-items: center; gap: 8px;
}
.status.err { color: var(--err); }
.status.ok { color: var(--ok); }
.bar { height: 4px; background: var(--bg2); border-radius: 4px; flex: 1; overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--accent); width: 0; transition: width .25s linear; }
.pop {
  position: fixed; z-index: 2147483001; background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.18); max-height: 260px; overflow-y: auto; min-width: 280px; padding: 4px;
}
.pop[hidden] { display: none; }
.pop .it { padding: 7px 10px; border-radius: 7px; cursor: pointer; display: flex; gap: 8px; align-items: center; }
.pop .it.on, .pop .it:hover { background: var(--accent2); }
.pop .it .t { flex: 1; }
.pop .hint { color: var(--muted); font-size: 11px; padding: 4px 10px; }
`;
