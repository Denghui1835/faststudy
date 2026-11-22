import { useState } from 'react';
import { courses, courseById } from '../data';
import type { Basis } from '../lib/plan';
import { BASIS_LABEL, pickMode, MODE_META } from '../lib/plan';
import { useStore } from '../store';

const DAY_CHIPS = [1, 3, 5, 7, 14, 30];
const SCORE_CHIPS = [60, 70, 80, 90];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { dispatch } = useStore();
  const [step, setStep] = useState(1);
  const [courseId, setCourseId] = useState('ds');
  const [days, setDays] = useState(7);
  const [target, setTarget] = useState(80);
  const [basis, setBasis] = useState<Basis>('heard');

  const course = courseById(courseId);
  const mode = pickMode(days);

  const finish = () => {
    dispatch({ type: 'onboard', exam: { courseId, days, target, basis } });
    onDone();
  };

  return (
    <div className="main" style={{ paddingTop: 26 }}>
      <div className="topline">
        <div>
          <h1>FastStudy · 期末极限备考</h1>
          <div className="sub">平时欠的知识，期末一起还。先花 30 秒告诉我你的处境。</div>
        </div>
        <div className="steps" style={{ width: 160, margin: 0 }}>
          {[1, 2, 3].map((i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
      </div>

      <div className="onboard">
        <div className="card pad-lg">
          {step === 1 && (
            <>
              <div className="card-title" style={{ fontSize: 18 }}>
                先告诉我，你哪门课要爆炸
              </div>
              <div className="card-note" style={{ marginTop: 4 }}>
                选一门最急的，剩下的考完再说。
              </div>
              <div className="course-grid" style={{ marginTop: 18 }}>
                {courses.map((c) => (
                  <button
                    key={c.id}
                    className={`course-card ${courseId === c.id ? 'on' : ''}`}
                    onClick={() => setCourseId(c.id)}
                  >
                    <div className="course-dot" style={{ background: c.color }}>
                      {c.name.slice(0, 1)}
                    </div>
                    <div className="course-name">{c.name}</div>
                    <div className="course-sub">
                      {c.kps.length} 个考点 · {c.questions.length} 题
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="card-title" style={{ fontSize: 18 }}>
                还剩几天？
              </div>
              <div className="card-note" style={{ marginTop: 4 }}>
                这个数字决定了策略：是系统重建，还是保命。
              </div>

              <div className="field-label">
                距离《{course.short}》期末 <span>{days} 天后</span>
              </div>
              <div className="chips">
                {DAY_CHIPS.map((d) => (
                  <button key={d} className={`chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>
                    {d} 天
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, maxWidth: 220 }}>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                />
              </div>

              <div className="field-label">
                目标分数 <span>别一上来就要 95</span>
              </div>
              <div className="chips">
                {SCORE_CHIPS.map((s) => (
                  <button key={s} className={`chip ${target === s ? 'on' : ''}`} onClick={() => setTarget(s)}>
                    {s} 分
                  </button>
                ))}
              </div>

              <div className="notice" style={{ marginTop: 18 }}>
                <b>当前策略：{MODE_META[mode].label}</b>
                <br />
                {MODE_META[mode].tagline}，{MODE_META[mode].rule}。
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="card-title" style={{ fontSize: 18 }}>
                说实话，你现在什么水平
              </div>
              <div className="card-note" style={{ marginTop: 4 }}>
                系统按这个决定先讲概念还是直接上题。
              </div>
              <div className="basis-list" style={{ marginTop: 18 }}>
                {(Object.keys(BASIS_LABEL) as Basis[]).map((b) => (
                  <button key={b} className={`basis ${basis === b ? 'on' : ''}`} onClick={() => setBasis(b)}>
                    <span className="basis-radio" />
                    <span>{BASIS_LABEL[b]}</span>
                  </button>
                ))}
              </div>

              <div className="divider" style={{ margin: '18px 0' }} />
              <div className="stats3">
                <div className="stat-box">
                  <b style={{ fontSize: 14 }}>{course.name}</b>
                  <span>科目</span>
                </div>
                <div className="stat-box">
                  <b style={{ fontSize: 14 }}>{days} 天</b>
                  <span>剩余时间</span>
                </div>
                <div className="stat-box">
                  <b style={{ fontSize: 14 }}>{target} 分</b>
                  <span>目标</span>
                </div>
                <div className="stat-box">
                  <b style={{ fontSize: 14, color: '#3b6bf5' }}>{MODE_META[mode].label}</b>
                  <span>策略</span>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            {step > 1 && (
              <button className="btn" style={{ flex: '0 0 100px' }} onClick={() => setStep(step - 1)}>
                返回
              </button>
            )}
            {step < 3 ? (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(step + 1)}>
                下一步
              </button>
            ) : (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={finish}>
                生成抢救计划
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
