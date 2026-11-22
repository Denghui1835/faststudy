import type { Course, Question } from '../data/types';

export interface ExamRecord {
  id: string;
  courseId: string;
  at: number;
  total: number;
  correct: number;
  /** 百分制 */
  score: number;
  seconds: number;
  perKp: { kpId: string; right: number; all: number }[];
}

export const paperSize = (course: Course) => Math.min(20, course.questions.length);

/** 每题 60 秒，最少 10 分钟 */
export const paperSeconds = (size: number) => Math.max(600, size * 60);

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 组卷：按考频从高到低轮流取题，保证高频考点一定被覆盖，
 * 同时把每道题在考点内打散，避免整卷都是同一章的题。
 */
export function buildPaper(course: Course, size: number): Question[] {
  const byKp = new Map<string, Question[]>();
  course.kps.forEach((k) => byKp.set(k.id, shuffle(course.questions.filter((q) => q.kp === k.id))));

  const order = [...course.kps].sort((a, b) => b.heat - a.heat || a.name.localeCompare(b.name));
  const picked: Question[] = [];

  while (picked.length < size) {
    let added = false;
    for (const kp of order) {
      const pool = byKp.get(kp.id)!;
      if (pool.length > 0) {
        picked.push(pool.shift()!);
        added = true;
        if (picked.length >= size) break;
      }
    }
    if (!added) break;
  }
  return shuffle(picked);
}

export const isCorrect = (q: Question, picked: number[] = []) =>
  picked.length === q.answer.length && picked.every((i) => q.answer.includes(i));

export function grade(course: Course, paper: Question[], answers: Record<string, number[]>, seconds: number): ExamRecord {
  const perKp = new Map<string, { right: number; all: number }>();
  let correct = 0;

  paper.forEach((q) => {
    const ok = isCorrect(q, answers[q.id]);
    if (ok) correct += 1;
    const cur = perKp.get(q.kp) ?? { right: 0, all: 0 };
    cur.all += 1;
    if (ok) cur.right += 1;
    perKp.set(q.kp, cur);
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    courseId: course.id,
    at: Date.now(),
    total: paper.length,
    correct,
    score: paper.length ? Math.round((correct / paper.length) * 100) : 0,
    seconds,
    perKp: [...perKp.entries()].map(([kpId, v]) => ({ kpId, ...v })),
  };
}

/** 薄弱点：正确率从低到高，至少 1 题才算进榜 */
export function weakPoints(course: Course, record: ExamRecord) {
  return record.perKp
    .filter((p) => p.all > 0)
    .map((p) => ({
      ...p,
      rate: p.right / p.all,
      name: course.kps.find((k) => k.id === p.kpId)?.name ?? p.kpId,
      heat: course.kps.find((k) => k.id === p.kpId)?.heat ?? 1,
    }))
    .sort((a, b) => a.rate - b.rate || b.heat - a.heat);
}

export const fmtSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
