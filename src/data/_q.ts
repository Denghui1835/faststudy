import type { Question } from './types';

/** 单选 */
export const s = (
  id: string,
  kp: string,
  stem: string,
  options: string[],
  answer: number,
  what: string,
  why: string,
  keep: string,
  diff: 1 | 2 | 3 = 2,
  year?: number,
): Question => ({
  id,
  kp,
  type: 'single',
  stem,
  options,
  answer: [answer],
  explain: { what, why, keep },
  diff,
  year,
});

/** 多选 */
export const m = (
  id: string,
  kp: string,
  stem: string,
  options: string[],
  answer: number[],
  what: string,
  why: string,
  keep: string,
  diff: 1 | 2 | 3 = 3,
  year?: number,
): Question => ({
  id,
  kp,
  type: 'multi',
  stem,
  options,
  answer: [...answer].sort(),
  explain: { what, why, keep },
  diff,
  year,
});

/** 判断 */
export const j = (
  id: string,
  kp: string,
  stem: string,
  answer: boolean,
  what: string,
  why: string,
  keep: string,
  diff: 1 | 2 | 3 = 1,
  year?: number,
): Question => ({
  id,
  kp,
  type: 'judge',
  stem,
  options: ['正确', '错误'],
  answer: [answer ? 0 : 1],
  explain: { what, why, keep },
  diff,
  year,
});
