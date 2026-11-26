import type { Course, KP, Question } from '../data/types';

/**
 * 题库检索：纯函数，不依赖 React / localStorage。
 *
 * 设计取舍（期末冲刺场景下的「检索」不是搜索引擎）：
 * - 一个输入框同时搜题干、选项、三段式讲解、考点名和章节，不让用户在筛选项里迷路；
 * - 多个关键词用空格分隔，全部命中才算命中（AND），避免「数据 结构」把半套题库都捞出来；
 * - 排序看「命中位置的含金量」再叠加考频：命中考点名的题最该先看到。
 */

export type HitLabel = '考点' | '题干' | '选项' | '讲解' | '章节';

export interface SearchHit {
  /** courseId::qid，稳定的列表 key */
  key: string;
  course: Course;
  kp: KP;
  q: Question;
  score: number;
  /** 命中的字段，按含金量排序，用于列表上的小标签 */
  labels: HitLabel[];
}

export interface SearchResult {
  /** 已排序的命中列表（未截断） */
  hits: SearchHit[];
  /** 关键词（已归一化），交给高亮用 */
  tokens: string[];
}

interface Field {
  label: HitLabel;
  text: string;
  weight: number;
}

const LABEL_ORDER: HitLabel[] = ['考点', '题干', '选项', '讲解', '章节'];

const WEIGHTS = {
  kp: 6,
  stem: 4,
  option: 2,
  keep: 2,
  what: 1.4,
  why: 1.2,
  chapter: 1,
};

/**
 * 逐字归一（全角转半角、统一小写），保证结果与原文**等长**，
 * 这样高亮用的下标可以直接落在原字符串上。
 */
function normChars(s: string): string {
  let out = '';
  for (const ch of s) {
    const n = ch.normalize('NFKC').toLowerCase();
    out += n.length === ch.length ? n : ch;
  }
  return out;
}

/** 关键词：空格 / 中英文逗号 / 顿号 / 分号 / 斜杠切分，最多 6 个 */
export function tokenize(query: string): string[] {
  return query
    .split(/[\s,，、;；/|]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);
}

/** 统计出现次数（封顶 4 次，防止一个词刷分把别的题全挤下去） */
function countOcc(hay: string, needle: string): number {
  let n = 0;
  let i = 0;
  while (n < 4) {
    const p = hay.indexOf(needle, i);
    if (p < 0) break;
    n += 1;
    i = p + needle.length;
  }
  return n;
}

function fieldsOf(q: Question, kp: KP): Field[] {
  return [
    { label: '考点', text: kp.name, weight: WEIGHTS.kp },
    { label: '题干', text: q.stem, weight: WEIGHTS.stem },
    { label: '选项', text: q.options.join(' '), weight: WEIGHTS.option },
    { label: '讲解', text: q.explain.keep, weight: WEIGHTS.keep },
    { label: '讲解', text: `${q.explain.what} ${q.explain.why}`, weight: WEIGHTS.what },
    { label: '章节', text: kp.chapter, weight: WEIGHTS.chapter },
  ];
}

function labelRank(l: HitLabel): number {
  const i = LABEL_ORDER.indexOf(l);
  return i < 0 ? LABEL_ORDER.length : i;
}

/**
 * @param all 全部课程（范围选「全部课程」时用）
 * @param query 用户输入
 * @param courseId 只搜这一门课时传 id；搜全部传 null / undefined
 */
export function searchBank(all: Course[], query: string, courseId?: string | null): SearchResult {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { hits: [], tokens };

  const needles = tokens.map(normChars).filter(Boolean);
  if (needles.length === 0) return { hits: [], tokens };
  const phrase = needles.length > 1 ? needles.join('') : '';

  const hits: SearchHit[] = [];

  all.forEach((course) => {
    if (courseId && course.id !== courseId) return;
    const kpById = new Map(course.kps.map((k) => [k.id, k]));
    course.questions.forEach((q) => {
      const kp = kpById.get(q.kp);
      if (!kp) return;
      const fields = fieldsOf(q, kp);
      const texts = fields.map((f) => normChars(f.text));
      const union = texts.join('\u0000');

      // AND：每个关键词都必须在某处出现
      if (!needles.every((t) => union.includes(t))) return;

      let score = 0;
      const labels: HitLabel[] = [];
      needles.forEach((t) => {
        fields.forEach((f, fi) => {
          const n = countOcc(texts[fi], t);
          if (!n) return;
          // 命中次数做轻微加权（最高 1.24 倍），压不过字段本身的权重差
          score += f.weight * (1 + Math.min(n - 1, 3) * 0.08);
          if (!labels.includes(f.label)) labels.push(f.label);
        });
      });

      if (phrase && union.replace(/\s+/g, '').includes(phrase)) score += 5;
      // 考频只作为同分时的顺位参考
      score += kp.heat * 0.3;

      labels.sort((a, b) => labelRank(a) - labelRank(b));
      hits.push({ key: `${course.id}::${q.id}`, course, kp, q, score, labels });
    });
  });

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.kp.heat !== a.kp.heat) return b.kp.heat - a.kp.heat;
    return a.q.id.localeCompare(b.q.id);
  });

  return { hits, tokens };
}

/* ------------------------------------------------------------------ *
 * 课程检索：课程会越来越多（现在 8 门，以后 20 门），所以要能「找课」
 * 而不是只能在一排 chip 里翻。搜课名 / 简称 / 考点名 / 章节都能找到课。
 * ------------------------------------------------------------------ */

export interface CourseHit {
  course: Course;
  score: number;
  /** 这门课里被关键词命中的考点，用来回答「我要找的那个点在哪个课」 */
  matchedKps: KP[];
  /** 课名或简称本身命中 */
  nameMatched: boolean;
}

export interface CourseSearchResult {
  hits: CourseHit[];
  tokens: string[];
}

export function searchCourses(all: Course[], query: string): CourseSearchResult {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { hits: [], tokens };

  const needles = tokens.map(normChars).filter(Boolean);
  if (needles.length === 0) return { hits: [], tokens };

  const hits: CourseHit[] = [];

  all.forEach((course) => {
    const nameText = normChars(`${course.name} ${course.short} ${course.id}`);
    const kps = course.kps.map((kp) => ({
      kp,
      name: normChars(kp.name),
      chapter: normChars(kp.chapter),
    }));
    const union = [nameText, ...kps.map((k) => `${k.name} ${k.chapter}`)].join('\u0000');

    // AND：每个关键词都要能在「课名 / 任一考点 / 章节」里找到
    if (!needles.every((t) => union.includes(t))) return;

    let score = 0;
    let nameMatched = false;
    needles.forEach((t) => {
      const n = countOcc(nameText, t);
      if (n) {
        // 课名命中远重于考点命中：用户打「线代」是想找课，不是找题
        score += 8 * (1 + Math.min(n - 1, 2) * 0.1);
        nameMatched = true;
      }
    });

    const matchedKps: KP[] = [];
    kps.forEach(({ kp, name, chapter }) => {
      let hit = false;
      needles.forEach((t) => {
        if (countOcc(name, t)) {
          score += 3;
          hit = true;
        } else if (countOcc(chapter, t)) {
          score += 1;
          hit = true;
        }
      });
      if (hit) matchedKps.push(kp);
    });

    hits.push({ course, score, matchedKps, nameMatched });
  });

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 同分时考点多的课更可能是用户想要的那门「大课」
    if (b.course.kps.length !== a.course.kps.length) return b.course.kps.length - a.course.kps.length;
    return b.course.questions.length - a.course.questions.length;
  });

  return { hits, tokens };
}

export interface Segment {
  text: string;
  hit: boolean;
}

/**
 * 把一段文字按关键词切成「普通 / 命中」片段，交给组件渲染 <mark>。
 * 关键词按长度降序匹配，避免「数据结构」先被「数据」切碎。
 */
export function segments(text: string, tokens: string[]): Segment[] {
  const needles = tokens
    .map((t) => t.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!needles.length || !text) return [{ text, hit: false }];

  const lower = normChars(text);
  // 先标记每个字符是否落在命中区间，最后一趟合并成片段
  const marks = new Array<boolean>(text.length).fill(false);
  needles.forEach((needle) => {
    const n = normChars(needle);
    if (!n) return;
    let from = 0;
    for (;;) {
      const p = lower.indexOf(n, from);
      if (p < 0) break;
      for (let i = p; i < p + n.length && i < marks.length; i += 1) marks[i] = true;
      from = p + n.length;
    }
  });

  const out: Segment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i += 1) {
    if (i === text.length || marks[i] !== marks[start]) {
      out.push({ text: text.slice(start, i), hit: marks[start] });
      start = i;
    }
  }
  return out;
}
