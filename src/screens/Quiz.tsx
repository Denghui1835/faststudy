import { useMemo, useRef, useState } from 'react';
import type { Course, Question } from '../data/types';
import { askLLM, diagnose, guideSteps, type SessionItem } from '../lib/ai';
import type { Plan } from '../lib/plan';
import { fmtClock } from '../lib/plan';
import { useStore } from '../store';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function buildQueue(course: Course, plan: Plan, progress: Record<string, { seen: number; correct: number; wrong: number }>, mistakes: Record<string, number>, mode: 'normal' | 'review', size = 10): Question[] {
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  if (mode === 'review') {
    return Object.entries(mistakes)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter((q): q is Question => Boolean(q))
      .slice(0, size);
  }
  const heatOf = (qid: string) => course.kps.find((k) => k.id === byId.get(qid)?.kp)?.heat ?? 1;
  const pool = plan.mode === 'lifesaver' ? course.questions.filter((q) => heatOf(q.id) >= 2 && q.diff <= 2) : course.questions;
  const scored = pool.map((q) => {
    const st = progress[q.id];
    const wrong = mistakes[q.id] ? 1 : 0;
    const perQ = st && st.seen > 0 ? st.correct / st.seen : -1;
    const freshness = st && st.seen > 0 ? (perQ >= 0.8 ? 0 : 2) : 4;
    const heat = heatOf(q.id);
    return { q, score: heat * 10 + freshness * 6 + wrong * 9 + (3 - q.diff) * 2 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, size).map((s) => s.q);
}

const eq = (a: number[], b: number[]) => a.length === b.length && a.every((v) => b.includes(v));

export default function Quiz({
  course,
  plan,
  mode,
  onExit,
  onGoMistakes,
}: {
  course: Course;
  plan: Plan;
  mode: 'normal' | 'review';
  onExit: () => void;
  onGoMistakes: () => void;
}) {
  const { state, dispatch } = useStore();
  const [seed, setSeed] = useState(0);
  const queue = useMemo(
    () => buildQueue(course, plan, state.progress, state.mistakes, mode),
    // 换一组时重新抽题
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [course, plan.mode, mode, seed],
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
      const text = await askLLM(state.settings, q, kp.name, picked);
      setAiText(text);
    } catch (e) {
      setAiText(
        `（本地讲解）你选的是「${picked.map((i) => q.options[i]).join('、') || '空'}」，正确答案是「${q.answer
          .map((i) => q.options[i])
          .join('、')}」。${q.explain.why}`,
      );
      void e;
    } finally {
      setAiBusy(false);
    }
  };

  const correctNow = submitted && eq([...picked].sort(), q.answer);

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      {comboText && <div className="combo">{comboText}</div>}

      <div className="between" style={{ marginBottom: 4 }}>
        <button className="icon-btn" onClick={onExit} aria-label="退出">
          ←
        </button>
        <div className="card-note">
          第 {idx + 1} / {queue.length} 题 · 已练 {fmtClock(items.reduce((n, i) => n + i.seconds, 0))}
        </div>
        <div className="card-note">
          {combo >= 2 ? `🔥 ${combo}` : `${Math.round(((idx + (submitted ? 1 : 0)) / queue.length) * 100)}%`}
        </div>
      </div>

      <div className="hero-bar" style={{ background: 'rgba(19,29,51,.08)', marginTop: 6 }}>
        <i
          style={{
            width: `${((idx + (submitted ? 1 : 0)) / queue.length) * 100}%`,
            background: 'linear-gradient(90deg,var(--violet),#8b95ff)',
          }}
        />
      </div>

      <div className="q-wrap">
        <div className="q-meta">
          <span className="q-type">{q.type === 'multi' ? '多选' : q.type === 'judge' ? '判断' : '单选'}</span>
          <span>{kp?.name}</span>
          {kp && <span className={`heat ${kp.heat === 2 ? 'mid' : kp.heat === 1 ? 'low' : ''}`}>{kp.heat === 3 ? '高频' : kp.heat === 2 ? '常考' : '了解'}</span>}
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
            } else if (isPicked) {
              cls += ' sel';
            }
            return (
              <button key={i} className={cls} onClick={() => toggle(i)}>
                <span className="opt-key">{LETTERS[i]}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {!submitted && (
          <div className="footbar">
            <button className="btn btn-ghost" onClick={() => setShowHint((v) => !v)} style={{ marginBottom: 9 }}>
              {showHint ? '收起思路' : '不会，先讲讲思路'}
            </button>
            {q.type === 'multi' && (
              <button className="btn btn-primary" disabled={picked.length === 0} onClick={() => submit(picked)}>
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
              <span style={{ fontWeight: 500, fontSize: 12.5, opacity: 0.75, marginLeft: 'auto' }}>
                正确答案 {q.answer.map((i) => LETTERS[i]).join('、')}
              </span>
            </div>

            <div className="explain">
              <div className="exp-row">
                <div className="exp-badge">考什么</div>
                <div className="exp-text">{q.explain.what}</div>
              </div>
              <div className="exp-row">
                <div className="exp-badge">错在哪</div>
                <div className="exp-text">{q.explain.why}</div>
              </div>
            </div>

            <div className="keep">
              <span>记住这一句</span>
              {q.explain.keep}
            </div>

            <div className="row" style={{ gap: 9, marginTop: 12 }}>
              <button className="btn btn-sm" onClick={askAi} disabled={aiBusy}>
                {aiBusy ? 'AI 正在想…' : '🤖 让 AI 再讲一遍'}
              </button>
              {q.year && <span className="card-note">{q.year} 年考过</span>}
            </div>

            {aiText && <div className="bubble">{aiText}</div>}

            <div className="footbar">
              <button className="btn btn-primary" onClick={next}>
                {idx + 1 >= queue.length ? '看本组结果' : '下一题 →'}
              </button>
            </div>
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
    <div className="screen">
      <div className="between" style={{ marginBottom: 10 }}>
        <button className="icon-btn" onClick={onExit} aria-label="返回">
          ←
        </button>
        <div className="card-note">本组完成</div>
        <div style={{ width: 34 }} />
      </div>

      <div className="hero">
        <div className="hero-top">
          <span>本组战绩</span>
          <span className="hero-tag">{fmtClock(secs)}</span>
        </div>
        <div className="countdown">
          <span className="countdown-num">{acc}</span>
          <span className="countdown-unit">% 正确率</span>
        </div>
        <div className="hero-line">
          {right} / {total} 题答对，平均每题 {Math.round(secs / Math.max(1, total))} 秒
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">{report.title}</div>
          <div className="card-note">AI 诊断</div>
        </div>
        {report.lines.map((l, i) => (
          <div key={i} className="exp-text" style={{ marginBottom: 8 }}>
            · {l}
          </div>
        ))}
        <div className="keep">
          <span>下一步动作</span>
          {report.action}
        </div>
      </div>

      {wrongIds.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">这组错的题</div>
            <div className="card-note">已进错题急救本</div>
          </div>
          {wrongIds.map((id) => {
            const q = byId.get(id);
            if (!q) return null;
            return (
              <div className="kprow" key={id}>
                <div className="kp-index hot">✕</div>
                <div className="kp-main">
                  <div className="kp-name">{q.stem.slice(0, 22)}…</div>
                  <div className="kp-meta">{q.explain.keep.slice(0, 26)}…</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <button className="btn btn-primary" onClick={onAgain}>
          再来一组
        </button>
        <button className="btn" onClick={onGoMistakes}>
          去错题急救本
        </button>
      </div>
    </div>
  );
}
