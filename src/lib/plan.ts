import type { Course, KP, Question } from '../data/types';

export type Basis = 'zero' | 'heard' | 'ok';

export interface ExamConfig {
  courseId: string;
  days: number;
  target: number;
  basis: Basis;
}

export interface QStat {
  seen: number;
  correct: number;
  wrong: number;
  last: number;
}

export type Progress = Record<string, QStat>;

export type Mode = 'systematic' | 'targeted' | 'lifesaver';

export const BASIS_LABEL: Record<Basis, string> = {
  zero: '完全没学，从零开始',
  heard: '听过课，但很多不会',
  ok: '基础还行，集中刷题',
};

export const MODE_META: Record<Mode, { label: string; tagline: string; rule: string }> = {
  systematic: {
    label: '系统重建',
    tagline: '还有两周以上，来得及把框架搭起来',
    rule: '先铺满考点，再攻高频题，不跳章节',
  },
  targeted: {
    label: '定点爆破',
    tagline: '只剩一周左右，只刷最值钱的考点',
    rule: '按性价比排序：考频高、你还没掌握的优先',
  },
  lifesaver: {
    label: '保命模式',
    tagline: '不到 3 天，放弃全面覆盖，只保基础分',
    rule: '只做高频 + 中低难度题，绝不开新章节',
  },
};

export function pickMode(days: number): Mode {
  if (days >= 14) return 'systematic';
  if (days >= 4) return 'targeted';
  return 'lifesaver';
}

export interface KpInsight {
  kp: KP;
  mastery: number;
  seen: number;
  total: number;
  /** 性价比：考频权重 ÷ 距离掌握的差距 */
  value: number;
}

/** 每个考点的掌握度 = 做对次数 / 做过次数；没做过按 0 算，但会被标记为「未测」 */
export function kpInsights(course: Course, progress: Progress): KpInsight[] {
  return course.kps
    .map((kp) => {
      const qs = course.questions.filter((q) => q.kp === kp.id);
      let seen = 0;
      let correct = 0;
      qs.forEach((q) => {
        const st = progress[q.id];
        if (st) {
          seen += st.seen;
          correct += st.correct;
        }
      });
      const mastery = seen > 0 ? correct / seen : 0;
      const value = (kp.heat / 3) * (1 - mastery * 0.9) * 100;
      return { kp, mastery, seen, total: qs.length, value };
    })
    .sort((a, b) => b.value - a.value);
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  goal: number;
  kind: 'kp' | 'quiz' | 'review';
}

export interface Plan {
  mode: Mode;
  days: number;
  target: number;
  headline: string;
  order: KpInsight[];
  todayKps: KpInsight[];
  queue: Question[];
  dailyQuiz: number;
  dailyReview: number;
  tasks: Task[];
  coverage: number;
  /** 达成目标分的预估：按当前正确率线性外推，仅作心理锚点 */
  forecast: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function buildPlan(course: Course, exam: ExamConfig, progress: Progress, forceLifesaver = false): Plan {
  const days = Math.max(1, exam.days);
  const mode: Mode = forceLifesaver ? 'lifesaver' : pickMode(days);
  const order = kpInsights(course, progress);

  // 保命模式：只保留高频、且不碰最难的题
  const pool =
    mode === 'lifesaver'
      ? course.questions.filter((q) => {
          const kp = course.kps.find((k) => k.id === q.kp)!;
          return kp.heat >= 2 && q.diff <= 2;
        })
      : course.questions;

  const valueOf = (q: Question) => order.find((o) => o.kp.id === q.kp)?.value ?? 0;
  const heatOf = (q: Question) => course.kps.find((k) => k.id === q.kp)?.heat ?? 1;

  const queue = [...pool].sort((a, b) => {
    const vb = valueOf(b) - valueOf(a);
    if (Math.abs(vb) > 0.01) return vb;
    const hb = heatOf(b) - heatOf(a);
    if (hb !== 0) return hb;
    return a.diff - b.diff;
  });

  const dailyQuiz = clamp(Math.round(queue.length / Math.min(days, 5)), 8, 40);
  const dailyReview = mode === 'lifesaver' ? 0 : Math.min(8, Math.ceil(course.questions.length / 10));
  const kpPerDay = mode === 'lifesaver' ? 2 : mode === 'targeted' ? 3 : 2;

  const todayKps = order.slice(0, kpPerDay);
  const seenTotal = Object.values(progress).reduce((n, s) => n + s.seen, 0);
  const correctTotal = Object.values(progress).reduce((n, s) => n + s.correct, 0);
  const acc = seenTotal > 0 ? correctTotal / seenTotal : 0;

  const coverageTarget = mode === 'lifesaver' ? 0.35 : mode === 'targeted' ? 0.75 : 1;
  const testedKps = order.filter((o) => o.seen > 0).length;
  const coverage = course.kps.length > 0 ? testedKps / course.kps.length : 0;

  const forecast = clamp(Math.round(exam.target + (acc > 0 ? (acc - 0.6) * 55 : -12)), 0, 100);

  const headline =
    mode === 'lifesaver'
      ? `只剩 ${days} 天，别贪了：只保高频题和必考题型`
      : mode === 'targeted'
        ? `${days} 天，够打一场定点爆破：先把性价比最高的 3 个考点吃掉`
        : `${days} 天，先搭框架再刷题，今天从「${todayKps[0]?.kp.name ?? ''}」开始`;

  const tasks: Task[] = [
    {
      id: `kp-${todayKps.map((k) => k.kp.id).join('-')}`,
      title: `过 ${todayKps.length} 个考点`,
      detail: todayKps.map((k) => k.kp.name).join(' · '),
      goal: todayKps.length,
      kind: 'kp',
    },
    {
      id: 'quiz',
      title: `刷 ${dailyQuiz} 题`,
      detail: mode === 'lifesaver' ? '只出高频 + 中低难度题' : '按性价比排序，从最值钱的开始',
      goal: dailyQuiz,
      kind: 'quiz',
    },
    {
      id: 'review',
      title: dailyReview > 0 ? `复盘 ${dailyReview} 道错题` : '看一眼速记卡',
      detail: dailyReview > 0 ? '错题不消灭，刷多少都是白刷' : '时间不够时，速记比刷题划算',
      goal: dailyReview,
      kind: 'review',
    },
  ];

  return {
    mode,
    days,
    target: exam.target,
    headline,
    order,
    todayKps,
    queue,
    dailyQuiz,
    dailyReview,
    tasks,
    coverage: Math.min(1, coverage / Math.max(0.01, coverageTarget)),
    forecast,
  };
}

/** 整门课的掌握度（按考频加权） */
export function overallMastery(insights: KpInsight[]): number {
  const w = insights.reduce((n, i) => n + i.kp.heat, 0);
  if (w === 0) return 0;
  return insights.reduce((n, i) => n + i.mastery * i.kp.heat, 0) / w;
}

/** 连击称号 */
export function rankOf(quizCount: number, accuracy: number): { name: string; next: string } {
  if (quizCount === 0) return { name: '待抢救', next: '做完第一组题就能升级' };
  if (quizCount < 20) return { name: '临阵磨枪', next: `再刷 ${20 - quizCount} 题 → 抱佛脚` };
  if (quizCount < 60) return { name: '抱佛脚', next: `再刷 ${60 - quizCount} 题 → 佛光初现` };
  if (accuracy >= 0.85) return { name: '佛光普照', next: '保持住，你已经比大多数人稳了' };
  return { name: '佛光初现', next: `正确率到 85% → 佛光普照（当前 ${Math.round(accuracy * 100)}%）` };
}

export function fmtDays(days: number): string {
  if (days <= 0) return '今天';
  if (days === 1) return '明天';
  return `${days} 天`;
}

export function fmtClock(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
