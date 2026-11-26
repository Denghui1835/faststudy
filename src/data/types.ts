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

/**
 * 资料出处：这门课的资料是哪个学校的、凭什么可信。
 * 期末题库最怕「来路不明的题」，所以出处必须是数据的一部分，而不是文案里的一句漂亮话。
 */
export interface Source {
  /** 完整校名；公开教材类写「多校通用」 */
  school: string;
  /** 小空间用的简称：农大 / 通用 */
  tag: string;
  /** 一句话依据：卷面结构 / 课件 / 教材 */
  basis: string;
  /** true = 本校真题或本校课件整理；false/缺省 = 通用公开资料 */
  local?: boolean;
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

/**
 * 资料原稿：题库不是凭空来的，能点开看原卷才叫「有出处」。
 * file 是 public/ 下的相对路径，静态托管时直接可下载。
 */
export interface Material {
  id: string;
  title: string;
  /** paper = 原卷；answer = 参考答案；slides = 课件 */
  kind: 'paper' | 'answer' | 'slides';
  file: string;
  size: string;
  pages?: number;
  /** 一句话说明这份东西是什么、怎么用 */
  note?: string;
}

export interface Course {
  id: string;
  name: string;
  short: string;
  color: string;
  /** 资料出处（哪个学校 / 什么依据） */
  source: Source;
  /** 原卷 / 答案 / 课件，可下载；没有就留空 */
  materials?: Material[];
  kps: KP[];
  questions: Question[];
}
