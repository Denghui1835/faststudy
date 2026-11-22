import { useEffect, useRef, useState } from 'react';
import type { Course, Question } from '../data/types';
import { buildPaper, fmtSec, grade, isCorrect, paperSeconds, paperSize, weakPoints, type ExamRecord } from '../lib/exam';
import { useStore } from '../store';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function Exam({
  course,
  onPractice,
  onGoMistakes,
}: {
  course: Course;
  onPractice: (kpId: string) => void;
  onGoMistakes: () => void;
}) {
  const { state, dispatch } = useStore();
  const [stage, setStage] = useState<'intro' | 'run' | 'done'>('intro');
  const [paper, setPaper] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const answersRef = useRef<Record<string, number[]>>({});
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(0);
  const [record, setRecord] = useState<ExamRecord | null>(null);

  const size = paperSize(course);
  const limit = paperSeconds(size);
  const history = state.exams ?? [];
  const startAt = useRef(0);

  const start = () => {
    const p = buildPaper(course, size);
    setPaper(p);
    setAnswers({});
    answersRef.current = {};
    setIdx(0);
    setLeft(limit);
    setRecord(null);
    startAt.current = Date.now();
    setStage('run');
  };

  const submit = (auto = false) => {
    if (stage !== 'run') return;
    const answered = Object.keys(answersRef.current).length;
    if (!auto && answered < paper.length) {
      const ok = window.confirm(`还有 ${paper.length - answered} 题没答，确定交卷吗？`);
      if (!ok) return;
    }
    const used = Math.min(limit, Math.round((Date.now() - startAt.current) / 1000));
    const rec = grade(course, paper, answersRef.current, used);
    setRecord(rec);
    dispatch({ type: 'exam', record: rec });
    dispatch({ type: 'examMistakes', qids: paper.filter((q) => !isCorrect(q, answersRef.current[q.id])).map((q) => q.id) });
    setStage('done');
  };

  useEffect(() => {
    if (stage !== 'run') return;
    const t = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((startAt.current + limit * 1000 - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) {
        window.clearInterval(t);
        submit(true);
      }
    }, 500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paper]);

  if (stage === 'intro') {
    return (
      <div className="col">
        <div className="topline">
          <div>
            <h1>模拟考试</h1>
            <div className="sub">
              {course.name} · {size} 题 · 限时 {Math.round(limit / 60)} 分钟 · 不即时给答案
            </div>
          </div>
          <div className="top-actions">
            <span className="pill blue">交卷后出薄弱点报告</span>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <span className="ico">⏱️</span>考前须知
              </div>
            </div>
            <div className="row-item">
              <div className="idx blue">1</div>
              <div className="row-main">
                <div className="row-title">按考频组卷</div>
                <div className="row-meta">高频考点一定进卷，再按章节打散，避免整卷都是同一章</div>
              </div>
            </div>
            <div className="row-item">
              <div className="idx blue">2</div>
              <div className="row-main">
                <div className="row-title">不给即时反馈</div>
                <div className="row-meta">答完才知道对错——这才是考试，也和「练习模式」区分开</div>
              </div>
            </div>
            <div className="row-item">
              <div className="idx blue">3</div>
              <div className="row-main">
                <div className="row-title">到点自动交卷</div>
                <div className="row-meta">时间到就交，模拟真实考场的压力</div>
              </div>
            </div>
            <div className="row-item">
              <div className="idx blue">4</div>
              <div className="row-main">
                <div className="row-title">交卷出薄弱点报告</div>
                <div className="row-meta">按考点正确率排序，直接告诉你去练哪三个</div>
              </div>
            </div>
            <button className="btn btn-primary btn-wide" style={{ marginTop: 16 }} onClick={start}>
              开始考试（{size} 题 / {Math.round(limit / 60)} 分钟）
            </button>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <span className="ico">📜</span>历史成绩
              </div>
              <span className="card-note">{history.length} 次</span>
            </div>
            {history.length === 0 && (
              <div className="empty" style={{ padding: '24px 8px' }}>
                <div className="empty-emoji">📄</div>
                <div className="empty-text">还没考过。第一次别紧张，反正没人看。</div>
              </div>
            )}
            {history.slice(0, 5).map((h) => (
              <div className="row-item" key={h.id}>
                <div className={`idx ${h.score >= 60 ? 'blue' : 'hot'}`}>{h.score}</div>
                <div className="row-main">
                  <div className="row-title">
                    {h.correct}/{h.total} 题 · 用时 {fmtSec(h.seconds)}
                  </div>
                  <div className="row-meta">{new Date(h.at).toLocaleString('zh-CN', { hour12: false })}</div>
                </div>
                <span className={`pill ${h.score >= 80 ? 'green' : h.score >= 60 ? 'amber' : 'red'}`}>
                  {h.score >= 80 ? '稳' : h.score >= 60 ? '过线' : '危险'}
                </span>
              </div>
            ))}
            {history.length > 0 && (
              <div className="notice" style={{ marginTop: 12 }}>
                同分不同卷：每次组卷都会重新抽题，所以分数波动是正常的。
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'run') {
    const q = paper[idx];
    if (!q) return null;
    const picked = answers[q.id] ?? [];
    const answeredCount = Object.keys(answers).length;
    const urgent = left <= 120;

    const choose = (i: number) => {
      const next = q.type === 'multi' ? (picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]) : [i];
      const all = { ...answersRef.current, [q.id]: next };
      answersRef.current = all;
      setAnswers(all);
    };

    return (
      <div className="quiz-shell">
        <div className="card">
          <div className="quiz-progress">
            <span className={`exam-timer ${urgent ? 'urgent' : ''}`}>⏱ {fmtSec(left)}</span>
            <div style={{ flex: 1 }}>
              <div className="bar" style={{ marginBottom: 6 }}>
                <i style={{ width: `${(answeredCount / paper.length) * 100}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  第 {idx + 1} / {paper.length} 题
                </span>
                <span>已答 {answeredCount} 题</span>
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => submit(false)}>
              交卷
            </button>
          </div>

          <div className="row-meta" style={{ marginTop: 14 }}>
            <span className="q-type">{course.kps.find((k) => k.id === q.kp)?.chapter}</span>
            <span style={{ fontWeight: 700, color: '#5a6b87' }}>{course.kps.find((k) => k.id === q.kp)?.name}</span>
            <span className="pill">{q.type === 'multi' ? '多选' : q.type === 'judge' ? '判断' : '单选'}</span>
          </div>

          <div className="q-stem">{q.stem}</div>

          <div className="opts">
            {q.options.map((opt, i) => (
              <button key={i} className={`opt ${picked.includes(i) ? 'sel' : ''}`} onClick={() => choose(i)}>
                <span className="opt-key">{LETTERS[i]}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
            <button className="btn" style={{ flex: '0 0 96px' }} disabled={idx === 0} onClick={() => setIdx((v) => v - 1)}>
              上一题
            </button>
            {idx + 1 < paper.length ? (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setIdx((v) => v + 1)}>
                下一题 →
              </button>
            ) : (
              <button className="btn btn-blue" style={{ flex: 1 }} onClick={() => submit(false)}>
                交卷并看报告
              </button>
            )}
          </div>

          <div className="q-nav">
            {paper.map((p, i) => (
              <button
                key={p.id}
                className={`q-dot ${i === idx ? 'on' : ''} ${answers[p.id] ? 'done' : ''}`}
                onClick={() => setIdx(i)}
                aria-label={`第 ${i + 1} 题`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // done
  const rec = record!;
  const weak = weakPoints(course, rec);
  const wrong = paper.filter((q) => !isCorrect(q, answers[q.id]));

  return (
    <div className="col">
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🏁</span>考试报告
            </div>
            <span className={`pill ${rec.score >= 80 ? 'green' : rec.score >= 60 ? 'amber' : 'red'}`}>
              {rec.score >= 80 ? '稳了' : rec.score >= 60 ? '过线' : '危险'}
            </span>
          </div>
          <div className="score-hero">
            <b>{rec.score}</b>
            <span>分</span>
          </div>
          <div className="stats3" style={{ marginTop: 8 }}>
            <div className="stat-box">
              <b>
                {rec.correct}/{rec.total}
              </b>
              <span>答对题数</span>
            </div>
            <div className="stat-box">
              <b>{fmtSec(rec.seconds)}</b>
              <span>用时</span>
            </div>
            <div className="stat-box">
              <b>{Math.round(rec.seconds / Math.max(1, rec.total))}s</b>
              <span>平均每题</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={start}>
              再考一次
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={onGoMistakes}>
              去错题急救本
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🎯</span>薄弱点报告
            </div>
            <span className="card-note">正确率从低到高</span>
          </div>
          {weak.map((w) => (
            <div key={w.kpId} className="mastery-row">
              <div className="mastery-name" style={{ width: 132 }}>
                {w.name.replace(/^[^：]*：/, '')}
              </div>
              <div className="mastery-bar">
                <i
                  style={{
                    width: `${Math.round(w.rate * 100)}%`,
                    background:
                      w.rate >= 0.8
                        ? 'linear-gradient(90deg,#23b26d,#5fd39a)'
                        : w.rate < 0.5
                          ? 'linear-gradient(90deg,#e04b4b,#ff8181)'
                          : undefined,
                  }}
                />
              </div>
              <div className="mastery-val">
                {w.right}/{w.all}
              </div>
              <button className="btn btn-sm" onClick={() => onPractice(w.kpId)}>
                去练
              </button>
            </div>
          ))}
          {weak.length > 0 && (
            <div className="keep" style={{ marginTop: 14 }}>
              <span>现在最该做的</span>
              <b>先把「{weak[0].name.replace(/^[^：]*：/, '')}」补到 80%，再回来考一次。</b>
            </div>
          )}
        </div>
      </div>

      {wrong.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">✕</span>错题回顾（{wrong.length} 题）
            </div>
            <span className="card-note">已进错题急救本</span>
          </div>
          {wrong.map((q) => (
            <div className="row-item" key={q.id} style={{ alignItems: 'flex-start' }}>
              <div className="idx hot">✕</div>
              <div className="row-main">
                <div className="row-title" style={{ whiteSpace: 'normal' }}>
                  {q.stem}
                </div>
                <div className="row-meta">
                  <span>
                    你选：{answers[q.id]?.map((i) => LETTERS[i]).join('、') || '未答'}
                  </span>
                  <span>正确：{q.answer.map((i) => LETTERS[i]).join('、')}</span>
                </div>
                <div className="bubble" style={{ marginTop: 6 }}>
                  {q.explain.keep}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="ico">🧾</span>最近成绩
          </div>
          <span className="card-note">{history.length} 次记录</span>
        </div>
        {(state.exams ?? []).slice(0, 5).map((h) => (
          <div className="row-item" key={h.id}>
            <div className={`idx ${h.score >= 60 ? 'blue' : 'hot'}`}>{h.score}</div>
            <div className="row-main">
              <div className="row-title">
                {h.correct}/{h.total} 题 · {fmtSec(h.seconds)}
              </div>
              <div className="row-meta">{new Date(h.at).toLocaleString('zh-CN', { hour12: false })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
