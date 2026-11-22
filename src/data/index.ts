import type { Course, Question } from './types';
import { dataStructure } from './ds';
import { advancedMath } from './math';
import { linearAlgebra } from './linalg';
import { probability } from './prob';
import { marxism } from './marx';
import { english } from './english';

const raw = [dataStructure, advancedMath, linearAlgebra, probability, marxism, english];

/** 题号统一按课程重新编号，避免手写 id 重复 */
export const courses: Course[] = raw.map((c) => ({
  ...c,
  questions: c.questions.map((q, i) => ({ ...q, id: `${c.id}-${String(i + 1).padStart(2, '0')}` })),
}));

export const courseById = (id: string): Course => courses.find((c) => c.id === id) ?? courses[0];

export const allQuestions = (): Question[] => courses.flatMap((c) => c.questions);

export const totalQuestions = courses.reduce((n, c) => n + c.questions.length, 0);
