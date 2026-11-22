import type { Course, Question } from './types';
import { dataStructure } from './ds';
import { advancedMath } from './math';
import { linearAlgebra } from './linalg';
import { probability } from './prob';
import { marxism } from './marx';
import { english } from './english';
import { physics } from './physics';
import { network } from './network';
import { extra } from './extra';

const raw = [dataStructure, advancedMath, linearAlgebra, probability, marxism, english, physics, network];

/**
 * 把 extra 里按课程 id 追加的题目合进各课程；
 * 题号统一重新编号（每课从 01 开始），避免手写 id 重复。
 */
export const courses: Course[] = raw.map((c) => {
  const merged = [...c.questions, ...(extra[c.id] ?? [])];
  return {
    ...c,
    questions: merged.map((q, i) => ({ ...q, id: `${c.id}-${String(i + 1).padStart(2, '0')}` })),
  };
});

export const courseById = (id: string): Course => courses.find((c) => c.id === id) ?? courses[0];

export const allQuestions = (): Question[] => courses.flatMap((c) => c.questions);

export const totalQuestions = courses.reduce((n, c) => n + c.questions.length, 0);
