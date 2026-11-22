export type QType = 'single' | 'multi' | 'judge';

/** 考点：期末考试的分值颗粒度 */
export interface KP {
  id: string;
  name: string;
  chapter: string;
  /** 3 = 老师年年考，2 = 常考，1 = 偶尔出现 */
  heat: 1 | 2 | 3;
}

/** 讲解三段式：考什么 → 为什么错 → 记住一句话 */
export interface Explain {
  what: string;
  why: string;
  keep: string;
}

export interface Question {
  id: string;
  kp: string;
  type: QType;
  stem: string;
  options: string[];
  answer: number[];
  explain: Explain;
  diff: 1 | 2 | 3;
  /** 出现过的年份（用于押题依据） */
  year?: number;
}

export interface Course {
  id: string;
  name: string;
  short: string;
  color: string;
  kps: KP[];
  questions: Question[];
}
