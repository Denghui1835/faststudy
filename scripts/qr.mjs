// 生成二维码：node scripts/qr.mjs
import QRCode from 'qrcode';
import { mkdirSync } from 'node:fs';

const out = 'docs/qr';
mkdirSync(out, { recursive: true });

const targets = [
  { name: 'demo', url: 'https://denghui1835.github.io/faststudy/?demo=1' },
  { name: 'apk', url: 'https://github.com/denghui1835/faststudy/releases/latest/download/FastStudy-v0.1-android.apk' },
  { name: 'repo', url: 'https://github.com/denghui1835/faststudy' },
];

for (const t of targets) {
  await QRCode.toFile(`${out}/${t.name}.png`, t.url, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#1b2b4bff', light: '#ffffffff' },
  });
  console.log('saved', `${out}/${t.name}.png`, '<-', t.url);
}
