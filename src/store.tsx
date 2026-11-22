import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { ExamConfig, Progress } from './lib/plan';
import type { AiSettings } from './lib/ai';

export interface TodayState {
  date: string;
  quiz: number;
  review: number;
  seconds: number;
  kps: string[];
}

export interface State {
  version: 1;
  onboarded: boolean;
  exam: ExamConfig | null;
  progress: Progress;
  /** 错题本：qid -> 错了几次 */
  mistakes: Record<string, number>;
  today: TodayState;
  total: { quiz: number; correct: number; seconds: number };
  streak: { count: number; last: string };
  lifesaver: boolean;
  settings: AiSettings;
}

export type Action =
  | { type: 'onboard'; exam: ExamConfig }
  | { type: 'answer'; qid: string; kp: string; correct: boolean; seconds: number; fromReview?: boolean }
  | { type: 'lifesaver'; on: boolean }
  | { type: 'settings'; settings: AiSettings }
  | { type: 'clearMistakes' }
  | { type: 'reset' }
  | { type: 'retake'; exam: ExamConfig };

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const emptyToday = (): TodayState => ({ date: todayKey(), quiz: 0, review: 0, seconds: 0, kps: [] });

const initialState: State = {
  version: 1,
  onboarded: false,
  exam: null,
  progress: {},
  mistakes: {},
  today: emptyToday(),
  total: { quiz: 0, correct: 0, seconds: 0 },
  streak: { count: 0, last: '' },
  lifesaver: false,
  settings: { baseUrl: '', apiKey: '', model: 'deepseek-chat' },
};

function bumpStreak(streak: State['streak']): State['streak'] {
  const t = todayKey();
  if (streak.last === t) return streak;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  return { count: streak.last === yesterday ? streak.count + 1 : 1, last: t };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'onboard':
      return { ...state, onboarded: true, exam: action.exam, today: emptyToday(), lifesaver: action.exam.days <= 3 };
    case 'retake':
      return { ...state, exam: action.exam, today: emptyToday() };
    case 'answer': {
      const today = state.today.date === todayKey() ? state.today : emptyToday();
      const prev = state.progress[action.qid] ?? { seen: 0, correct: 0, wrong: 0, last: 0 };
      const mistakes = { ...state.mistakes };
      if (action.correct) {
        delete mistakes[action.qid];
      } else {
        mistakes[action.qid] = (mistakes[action.qid] ?? 0) + 1;
      }
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.qid]: {
            seen: prev.seen + 1,
            correct: prev.correct + (action.correct ? 1 : 0),
            wrong: prev.wrong + (action.correct ? 0 : 1),
            last: Date.now(),
          },
        },
        mistakes,
        today: {
          ...today,
          quiz: today.quiz + 1,
          review: today.review + (action.fromReview ? 1 : 0),
          seconds: today.seconds + action.seconds,
          kps: today.kps.includes(action.kp) ? today.kps : [...today.kps, action.kp],
        },
        total: {
          quiz: state.total.quiz + 1,
          correct: state.total.correct + (action.correct ? 1 : 0),
          seconds: state.total.seconds + action.seconds,
        },
        streak: bumpStreak(state.streak),
      };
    }
    case 'lifesaver':
      return { ...state, lifesaver: action.on };
    case 'settings':
      return { ...state, settings: action.settings };
    case 'clearMistakes':
      return { ...state, mistakes: {} };
    case 'reset':
      return { ...initialState, today: emptyToday() };
    default:
      return state;
  }
}

const KEY = 'faststudy.v1';

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as State;
    if (parsed.version !== 1) return initialState;
    return { ...initialState, ...parsed, today: parsed.today?.date === todayKey() ? parsed.today : emptyToday() };
  } catch {
    return initialState;
  }
}

/** ?demo=1：给评委准备的一键演示数据（也有利于截图与录屏） */
function seedDemo(base: State): State {
  const exam: ExamConfig = { courseId: 'ds', days: 5, target: 80, basis: 'heard' };
  const progress: Progress = {};
  // 模拟一个「听过课、刷过一点、但还没掌握」的真实状态
  ['ds-01', 'ds-02', 'ds-06', 'ds-07', 'ds-13'].forEach((qid) => {
    progress[qid] = { seen: 1, correct: 1, wrong: 0, last: Date.now() };
  });
  ['ds-03', 'ds-10', 'ds-17', 'ds-21'].forEach((qid) => {
    progress[qid] = { seen: 1, correct: 0, wrong: 1, last: Date.now() };
  });
  progress['ds-05'] = { seen: 1, correct: 1, wrong: 0, last: Date.now() };
  return {
    ...base,
    onboarded: true,
    exam,
    progress,
    mistakes: { 'ds-03': 1, 'ds-10': 1, 'ds-17': 1, 'ds-21': 1 },
    today: { date: todayKey(), quiz: 5, review: 1, seconds: 420, kps: ['ds-linear', 'ds-stack'] },
    total: { quiz: 9, correct: 5, seconds: 640 },
    streak: { count: 3, last: todayKey() },
    lifesaver: false,
  };
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> }>({ state: initialState, dispatch: () => {} });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as State, () => {
    const s = load();
    if (!s.onboarded && typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')) {
      return seedDemo(s);
    }
    return s;
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* 隐私模式下写不进去就当作临时会话 */
    }
  }, [state]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

/** 按天归零，避免昨天的数据假装今天的进度 */
export function currentToday(state: State): TodayState {
  return state.today.date === todayKey() ? state.today : emptyToday();
}

export const questionProgress = (state: State, qid: string) =>
  state.progress[qid] ?? { seen: 0, correct: 0, wrong: 0, last: 0 };

export const mistakeCount = (state: State) => Object.keys(state.mistakes).length;
