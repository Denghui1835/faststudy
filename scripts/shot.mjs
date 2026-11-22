// 通用截图：node scripts/shot.mjs <url> <out.png> [w] [h] [mobile:0|1] [clickText]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2];
const out = process.argv[3];
const w = Number(process.argv[4] ?? 1440);
const h = Number(process.argv[5] ?? 900);
const mobile = (process.argv[6] ?? '0') === '1';
const clickText = process.argv[7] ?? '';

const profile = mkdtempSync(join(tmpdir(), 'shot-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--remote-debugging-port=9488', `--user-data-dir=${profile}`,
  `--window-size=${w},${h}`, url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2000);
let target = null;
for (let i = 0; i < 20 && !target; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9488/json')).json();
    target = list.find((t) => t.type === 'page');
  } catch { await sleep(300); }
}
if (!target) { console.error('no target'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
await send('Page.reload');
await sleep(1500);

if (clickText) {
  const r = await evalJs(`(() => {
    const t = ${JSON.stringify(clickText)};
    const els = [...document.querySelectorAll('button')].filter(b => (b.innerText||'').includes(t));
    if (!els.length) return 'not found';
    els[0].click();
    return 'clicked: ' + els[0].innerText.replace(/\\s+/g,' ').slice(0, 24);
  })()`);
  console.log(r);
  await sleep(1200);
}

const cap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(out, Buffer.from(cap.result.data, 'base64'));
console.log('saved', out);
ws.close(); chrome.kill();
await sleep(300);
process.exit(0);
