import { useMemo, useRef, useState } from 'react';
import type { Course, Question } from '../data/types';
import { askLLM, diagnose, guideSteps, type SessionItem } from '../lib/ai';
import type { Plan } from '../lib/plan';
import { fmtClock } from '../lib/plan';
import { useStore } from '../store';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function buildQueue(
  course: Course,
  plan: Plan,
  progress: Record<string, { seen: number; correct: number; wrong: number }>,
  mistakes: Record<string, number>,
  mode: 'normal' | 'review',
  kpFilter?: string,
  size = 10,
): Question[] {
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  if (mode === 'review') {
    return Object.entries(mistakes)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter((q): q is Question => Boolean(q))
      .slice(0, size);
  }
  const heatOf = (q: Question) => course.kps.find((k) => k.id === q.kp)?.heat ?? 1;
  let pool = course.questions;
  if (kpFilter) pool = pool.filter((q) => q.kp === kpFilter);
  else if (plan.mode === 'lifesaver') pool = pool.filter((q) => heatOf(q) >= 2 && q.diff <= 2);
  if (pool.length === 0) pool = course.questions;

  const scored = pool.map((q) => {
    const st = progress[q.id];
    const wrong = mistakes[q.id] ? 1 : 0;
    const perQ = st && st.seen > 0 ? st.correct / st.seen : -1;
    const freshness = st && st.seen > 0 ? (perQ >= 0.8 ? 0 : 2) : 4;
    return { q, score: heatOf(q) * 10 + freshness * 6 + wrong * 9 + (3 - q.diff) * 2 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, size).map((s) => s.q);
}

const eq = (a: number[], b: number[]) => a.length === b.length && a.every((v) => b.includes(v));

export default function Quiz({
  course,
  plan,
  mode,
  kpFilter,
  onExit,
  onGoMistakes,
}: {
  course: Course;
  plan: Plan;
  mode: 'normal' | 'review';
  kpFilter?: string;
  onExit: () => void;
  onGoMistakes: () => void;
}) {
  const { state, dispatch } = useStore();
  const [seed, setSeed] = useState(0);
  const queue = useMemo(
    () => buildQueue(course, plan, state.progress, state.mistakes, mode, kpFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [course, plan.mode, mode, kpFilter, seed],
  );

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [combo, setCombo] = useState(0);
  const [comboText, setComboText] = useState('');
  const [finished, setFinished] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const startedAt = useRef(Date.now());

  const q = queue[idx];
  const kp = q ? course.kps.find((k) => k.id === q.kp) : undefined;

  if (!q || finished) {
    return (
      <div className="quiz-shell">
        <Result
          items={items}
          course={course}
          onAgain={() => {
            setSeed((s) => s + 1);
            setIdx(0);
            setPicked([]);
            setSubmitted(false);
            setShowHint(false);
            setItems([]);
            setFinished(false);
            setAiText('');
            startedAt.current = Date.now();
          }}
          onGoMistakes={onGoMistakes}
          onExit={onExit}
        />
      </div>
    );
  }

  const submit = (choice: number[]) => {
    if (submitted) return;
    const correct = eq([...choice].sort(), q.answer);
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    setPicked(choice);
    setSubmitted(true);
    setItems((prev) => [...prev, { qid: q.id, kp: q.kp, correct, picked: choice, seconds }]);
    dispatch({ type: 'answer', qid: q.id, kp: q.kp, correct, seconds, fromReview: mode === 'review' });
    if (correct) {
      const next = combo + 1;
      setCombo(next);
      if (next >= 2) {
        setComboText(`连击 ×${next}`);
        window.setTimeout(() => setComboText(''), 760);
      }
    } else {
      setCombo(0);
    }
  };

  const toggle = (i: number) => {
    if (submitted) return;
    if (q.type === 'multi') {
      setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
    } else {
      submit([i]);
    }
  };

  const next = () => {
    if (idx + 1 >= queue.length) {
      setFinished(true);
      return;
    }
    setIdx(idx + 1);
    setPicked([]);
    setSubmitted(false);
    setShowHint(false);
    setAiText('');
    startedAt.current = Date.now();
  };

  const askAi = async () => {
    if (!kp) return;
    setAiBusy(true);
    setAiText('');
    try {
      setAiText(await askLLM(state.settings, q, kp.name, picked));
    } catch {
      setAiText(
        `（本地讲解）你选的是「${picked.map((i) => q.options[i]).join('、') || '空'}」，正确答案是「${q.answer
          .map((i) => q.options[i])
          .join('、')}」。${q.explain.why}`,
      );
    } finally {
      setAiBusy(false);
    }
  };

  const correctNow = submitted && eq([...picked].sort(), q.answer);
  const pct = Math.round(((idx + (submitted ? 1 : 0)) / queue.length) * 100);

  return (
    <div className="quiz-shell">
      {comboText && <div className="combo">{comboText}</div>}

      <div className="card">
        <div className="quiz-progress">
          <button className="btn btn-sm" onClick={onExit}>
            ← 退出
          </button>
          <div style={{ flex: 1 }}>
            <div className="bar" style={{ marginBottom: 6 }}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                第 {idx + 1} / {queue.length} 题
              </span>
              <span>{combo >= 2 ? `🔥 连击 ${combo}` : `已练 ${fmtClock(items.reduce((n, i) => n + i.seconds, 0))}`}</span>
            </div>
          </div>
          <span className="pill blue">{q.type === 'multi' ? '多选' : q.type === 'judge' ? '判断' : '单选'}</span>
        </div>

        <div className="row-meta" style={{ marginTop: 14 }}>
          <span className="q-type">{kp?.chapter}</span>
          <span style={{ fontWeight: 700, color: '#5a6b87' }}>{kp?.name}</span>
          <span className={`heat ${kp?.heat === 2 ? 'mid' : kp?.heat === 1 ? 'low' : ''}`}>
            {kp?.heat === 3 ? '高频' : kp?.heat === 2 ? '常考' : '了解'}
          </span>
        </div>

        <div className="q-stem">{q.stem}</div>

        <div className="opts">
          {q.options.map((opt, i) => {
            const isPicked = picked.includes(i);
            const isRight = q.answer.includes(i);
            let cls = 'opt';
            if (submitted) {
              if (isRight) cls += ' ok';
              else if (isPicked) cls += ' bad';
              else cls += ' dim';
            } else if (isPicked) cls += ' sel';
            return (
              <button key={i} className={cls} onClick={() => toggle(i)}>
                <span className="opt-key">{LETTERS[i]}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {!submitted && (
          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setShowHint((v) => !v)}>
              {showHint ? '收起思路' : '不会，先讲讲思路'}
            </button>
            {q.type === 'multi' && (
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={picked.length === 0} onClick={() => submit(picked)}>
                提交答案
              </button>
            )}
          </div>
        )}

        {!submitted && showHint && kp && (
          <div className="hint">
            <div className="hint-title">AI 引导 · 先别给答案</div>
            {guideSteps(q, kp.name, kp.heat).map((s, i) => (
              <div className="hint-step" key={i}>
                {s}
              </div>
            ))}
          </div>
        )}

        {submitted && (
          <>
            <div className={`verdict ${correctNow ? 'ok' : 'bad'}`}>
              {correctNow ? '✓ 对了' : '✕ 答错了'}
              <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.8, marginLeft: 'auto' }}>
                正确答案 {q.answer.map((i) => LETTERS[i]).join('、')}
              </span>
            </div>

            <div className="exp-grid">
              <div className="exp-cell">
                <div className="exp-tag">考什么</div>
                <div className="exp-text">{q.explain.what}</div>
              </div>
              <div className="exp-cell">
                <div className="exp-tag">错在哪</div>
                <div className="exp-text">{q.explain.why}</div>
              </div>
            </div>

            <div className="keep">
              <span>记住这一句</span>
              <b>{q.explain.keep}</b>
            </div>

            <div style={{ display: 'flex', gap: 9, marginTop: 12, alignItems: 'center' }}>
              <button className="btn btn-sm" onClick={askAi} disabled={aiBusy}>
                {aiBusy ? 'AI 正在想…' : '🤖 让 AI 再讲一遍'}
              </button>
              {q.year && <span className="muted">{q.year} 年考过</span>}
            </div>

            {aiText && <div className="bubble">{aiText}</div>}

            <button className="btn btn-primary btn-wide" style={{ marginTop: 14 }} onClick={next}>
              {idx + 1 >= queue.length ? '看本组结果' : '下一题 →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Result({
  items,
  course,
  onAgain,
  onGoMistakes,
  onExit,
}: {
  items: SessionItem[];
  course: Course;
  onAgain: () => void;
  onGoMistakes: () => void;
  onExit: () => void;
}) {
  const total = items.length;
  const right = items.filter((i) => i.correct).length;
  const acc = total ? Math.round((right / total) * 100) : 0;
  const report = diagnose(items, course);
  const wrongIds = items.filter((i) => !i.correct).map((i) => i.qid);
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  const secs = items.reduce((n, i) => n + i.seconds, 0);

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="ico">🏁</span>本组完成
          </div>
          <button className="btn btn-sm" onClick={onExit}>
            回到首页
          </button>
        </div>
        <div className="stats3">
          <div className="stat-box">
            <b style={{ color: acc >= 80 ? '#23b26d' : acc >= 60 ? '#1b2b4b' : '#e04b4b' }}>{acc}%</b>
            <span>正确率</span>
          </div>
          <div className="stat-box">
            <b>
              {right}/{total}
            </b>
            <span>答对题数</span>
          </div>
          <div className="stat-box">
            <b>{fmtClock(secs)}</b>
            <span>总用时</span>
          </div>
          <div className="stat-box">
            <b>{Math.round(secs / Math.max(1, total))}s</b>
            <span>平均每题</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="ico">🤖</span>{report.title}
          </div>
          <span className="card-note">AI 诊断</span>
        </div>
        {report.lines.map((l, i) => (
          <div key={i} className="exp-text" style={{ marginBottom: 7 }}>
            · {l}
          </div>
        ))}
        <div className="keep">
          <span>下一步动作</span>
          <b>{report.action}</b>
        </div>
      </div>

      {wrongIds.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🧯</span>这组错的题
            </div>
            <span className="card-note">已进错题急救本</span>
          </div>
          {wrongIds.map((id) => {
            const q = byId.get(id);
            if (!q) return null;
            return (
              <div className="row-item" key={id}>
                <div className="idx hot">✕</div>
                <div className="row-main">
                  <div className="row-title">{q.stem}</div>
                  <div className="row-meta">记住：{q.explain.keep}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onAgain}>
          再来一组
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={onGoMistakes}>
          去错题急救本
        </button>
      </div>
    </>
  );
}
