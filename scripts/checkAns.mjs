// 只读查看 ANS 提交页状态（复用本机 Chrome 的真实登录态）
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\lenovo\\AppData\\Local\\Google\\Chrome\\User Data';
const url = process.argv[2] ?? 'https://ans.cauai.fun/competitions/agrihackathon/submissions';
const shot = process.argv[3] ?? 'D:\\书山有路\\faststudy\\.shots\\ans.png';

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=9444',
  `--user-data-dir=${PROFILE}`,
  '--profile-directory=Default',
  '--window-size=1440,1000',
  url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);

let target = null;
for (let i = 0; i < 25 && !target; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9444/json')).json();
    target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  } catch {
    await sleep(400);
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
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(6000);

const info = await evalJs(`JSON.stringify({
  url: location.href,
  title: document.title,
  text: document.body.innerText.slice(0, 2600),
  buttons: [...document.querySelectorAll('button,a[role=button]')].map(b => (b.innerText||'').trim()).filter(Boolean).slice(0, 40),
  inputs: [...document.querySelectorAll('input,select,textarea')].map(i => ({ tag: i.tagName, name: i.name, placeholder: i.placeholder, type: i.type })).slice(0, 30)
})`);
console.log(info);

const cap = await send('Page.captureScreenshot', { format: 'png' });
if (cap.result?.data) { writeFileSync(shot, Buffer.from(cap.result.data, 'base64')); console.log('saved', shot); }

ws.close();
chrome.kill();
await sleep(400);
process.exit(0);
