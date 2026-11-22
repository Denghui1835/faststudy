// 渲染任意 HTML 为指定尺寸 PNG（用于封面 / 头图）
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = resolve(process.argv[2]);
const out = resolve(process.argv[3]);
const w = Number(process.argv[4] ?? 1200);
const h = Number(process.argv[5] ?? 630);

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--remote-debugging-port=9477', `--user-data-dir=${process.env.TEMP}\\cover-profile`,
  `--window-size=${w},${h}`, pathToFileURL(htmlPath).href,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2000);
let target = null;
for (let i = 0; i < 20 && !target; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9477/json')).json();
    target = list.find((t) => t.type === 'page');
  } catch { await sleep(300); }
}
if (!target) { chrome.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });

await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });
await send('Page.reload');
await sleep(1400);
const cap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(out, Buffer.from(cap.result.data, 'base64'));
console.log('saved', out);
ws.close(); chrome.kill();
await sleep(300);
process.exit(0);
