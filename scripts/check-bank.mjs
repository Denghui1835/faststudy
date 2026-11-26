// 题库完整性校验：用 vite 的 lib 模式把 TS 数据打成单个 ESM，再跑断言
import { build } from 'vite';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'fs-check-'));

await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    lib: { entry: 'src/data/index.ts', formats: ['es'], fileName: 'bank' },
    outDir: dir,
    emptyOutDir: true,
    minify: false,
    target: 'node18',
  },
});

const file = join(dir, 'bank.js');
writeFileSync(file, readFileSync(file, 'utf8'));
const { courses, totalQuestions, allQuestions } = await import(pathToFileURL(file).href);

let fail = 0;
const bad = (m) => { console.log('FAIL ' + m); fail++; };

const ids = new Set();
const schools = new Map();
for (const c of courses) {
  if (!c.id || !c.name || !c.short || !c.color) bad(`course missing meta: ${JSON.stringify(c.id)}`);
  if (!/^#[0-9A-Fa-f]{6}$/.test(c.color)) bad(`bad color ${c.id}: ${c.color}`);

  // 资料出处：每门课都必须写清楚是哪个学校的、凭什么
  const src = c.source;
  if (!src || !src.school || !src.tag || !src.basis) bad(`missing source on ${c.id}`);
  else if (src.tag.length > 4) bad(`source.tag too long on ${c.id}: ${src.tag}`);
  if (src) schools.set(src.school, (schools.get(src.school) ?? 0) + 1);

  // 资料原稿：声明了就必须真有文件，否则页面上会出现死链
  (c.materials ?? []).forEach((m) => {
    const p = join('public', m.file);
    if (!existsSync(p)) bad(`material file missing: ${m.file}`);
    if (!m.size) bad(`material missing size: ${m.id}`);
  });
  const kpIds = new Set(c.kps.map((k) => k.id));
  if (kpIds.size !== c.kps.length) bad(`dup kp id in ${c.id}`);
  for (const k of c.kps) {
    if (![1, 2, 3].includes(k.heat)) bad(`bad heat ${c.id}/${k.id}=${k.heat}`);
    if (!k.name || !k.chapter) bad(`kp missing text ${c.id}/${k.id}`);
  }
  const usedKp = new Set();
  for (const q of c.questions) {
    if (ids.has(q.id)) bad(`dup question id ${q.id}`);
    ids.add(q.id);
    if (!kpIds.has(q.kp)) bad(`question ${q.id} references unknown kp ${q.kp}`);
    usedKp.add(q.kp);
    if (![1, 2, 3].includes(q.diff)) bad(`bad diff ${q.id}=${q.diff}`);
    if (!['single', 'multi', 'judge'].includes(q.type)) bad(`bad type ${q.id}`);
    if (!q.stem || q.stem.length < 6) bad(`short stem ${q.id}`);
    if (!Array.isArray(q.options) || q.options.length < 2) bad(`bad options ${q.id}`);
    if (q.options.length !== new Set(q.options).size) bad(`dup option text ${q.id}`);
    for (const a of q.answer) {
      if (!Number.isInteger(a) || a < 0 || a >= q.options.length) bad(`answer out of range ${q.id}: ${a}`);
    }
    if (q.answer.length !== new Set(q.answer).size) bad(`dup answer index ${q.id}`);
    if (q.type === 'single' && q.answer.length !== 1) bad(`single with ${q.answer.length} answers ${q.id}`);
    if (q.type === 'multi' && q.answer.length < 2) bad(`multi with <2 answers ${q.id}`);
    if (q.type === 'judge' && (q.options.length !== 2 || q.answer.length !== 1)) bad(`judge shape ${q.id}`);
    for (const k of ['what', 'why', 'keep']) {
      const v = q.explain?.[k];
      if (typeof v !== 'string' || v.length < 8) bad(`explain.${k} too short ${q.id}`);
    }
    if (q.year !== undefined && (q.year < 2000 || q.year > 2100)) bad(`bad year ${q.id}=${q.year}`);
  }
  const unused = [...kpIds].filter((k) => !usedKp.has(k));
  if (unused.length) bad(`kp without questions in ${c.id}: ${unused.join(',')}`);
}

const qn = courses.reduce((n, c) => n + c.questions.length, 0);
const kn = courses.reduce((n, c) => n + c.kps.length, 0);
console.log(`courses=${courses.length} kps=${kn} questions=${qn} (totalQuestions=${totalQuestions}, allQuestions=${allQuestions().length})`);
for (const c of courses) {
  const cnt = (t) => c.questions.filter((q) => q.type === t).length;
  console.log(
    `  ${c.id.padEnd(3)} ${c.name.padEnd(12)} ${String(c.kps.length).padStart(2)} 考点 ${String(c.questions.length).padStart(3)} 题  ` +
      `单${cnt('single')}/多${cnt('multi')}/判${cnt('judge')}  年份标注 ${c.questions.filter((q) => q.year).length}`,
  );
}
console.log(fail === 0 ? 'OK 全部校验通过' : `共 ${fail} 处问题`);
process.exit(fail === 0 ? 0 : 1);
