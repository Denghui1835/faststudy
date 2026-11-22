// 用 CDP 量一下真实布局尺寸，顺便支持点击后截图
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/?demo=1';
const shot = process.argv[3] ?? '';
const clickText = process.argv[4] ?? '';

const profile = mkdtempSync(join(tmpdir(), 'cdp-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--remote-debugging-port=9333',
  `--user-data-dir=${profile}`,
  '--window-size=430,932',
  url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1800);

let target = null;
for (let i = 0; i < 20 && !target; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9333/json')).json();
    target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  } catch {
    await sleep(300);
  }
}
if (!target) {
  console.error('no target');
  chrome.kill();
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
await new Promise((r) => ws.addEventListener('open', r));

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

const evalJs = async (expr) => {
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return res.result?.result?.value;
};

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await send('Page.reload');
await sleep(1400);
const probe = await evalJs(`JSON.stringify({
  innerWidth: window.innerWidth,
  dpr: window.devicePixelRatio,
  docScrollW: document.documentElement.scrollWidth,
  bodyScrollW: document.body.scrollWidth,
  appW: document.querySelector('.app')?.getBoundingClientRect().width,
  appLeft: document.querySelector('.app')?.getBoundingClientRect().left,
  screenW: document.querySelector('.screen')?.getBoundingClientRect().width,
  maxRight: Math.max(...[...document.querySelectorAll('.app *')].map(e => e.getBoundingClientRect().right)),
  widest: [...document.querySelectorAll('.app *')].map(e => ({c: e.className?.toString?.().slice(0,40), w: Math.round(e.getBoundingClientRect().width), r: Math.round(e.getBoundingClientRect().right)})).sort((a,b)=>b.w-a.w).slice(0,6)
})`);
console.log(probe);

if (clickText) {
  await evalJs(`(() => {
    const t = ${JSON.stringify(clickText)};
    const el = [...document.querySelectorAll('button')].find(b => (b.innerText||'').includes(t));
    if (el) { el.click(); return 'clicked: ' + el.innerText.slice(0,20); }
    return 'not found';
  })()`).then((r) => console.log(r));
  await sleep(1200);
}

if (shot) {
  const cap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (cap.result?.data) {
    writeFileSync(shot, Buffer.from(cap.result.data, 'base64'));
    console.log('saved', shot);
  } else {
    console.log('capture failed', JSON.stringify(cap).slice(0, 200));
  }
}

ws.close();
chrome.kill();
await sleep(300);
process.exit(0);
