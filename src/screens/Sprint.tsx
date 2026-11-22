import type { Course } from '../data/types';
import { MODE_META, overallMastery, type Plan } from '../lib/plan';
import { currentToday, mistakeCount, useStore } from '../store';

const heatLabel = (h: 1 | 2 | 3) => (h === 3 ? '高频' : h === 2 ? '常考' : '了解');

export default function Sprint({
  course,
  plan,
  onStart,
  onReview,
  onRetake,
}: {
  course: Course;
  plan: Plan;
  onStart: () => void;
  onReview: () => void;
  onRetake: () => void;
}) {
  const { state, dispatch } = useStore();
  const today = currentToday(state);
  const mastery = overallMastery(plan.order);
  const mistakes = mistakeCount(state);
  const weak = plan.order.filter((k) => k.seen > 0).slice(0, 3);
  const untouched = plan.order.filter((k) => k.seen === 0).length;

  const taskDone = (kind: string) => {
    if (kind === 'kp') return today.kps.length >= plan.todayKps.length;
    if (kind === 'quiz') return today.quiz >= plan.dailyQuiz;
    return today.review >= Math.max(1, plan.dailyReview);
  };

  const doneCount = plan.tasks.filter((t) => taskDone(t.kind)).length;

  return (
    <>
      <div className="hero">
        <div className="hero-top">
          <span>{state.exam && state.exam.days <= 3 ? '⏰ 时间不多了' : '🍀 期末冲刺中'}</span>
          <span className="hero-tag">{MODE_META[plan.mode].label}</span>
        </div>
        <div className="hero-course">{course.name} · 期末</div>
        <div className="countdown">
          <span className="countdown-num">{plan.days}</span>
          <span className="countdown-unit">天后考试</span>
        </div>
        <div className="hero-line">{plan.headline}</div>

        <div className="hero-foot">
          <div className="hero-pill">
            <b>{Math.round(mastery * 100)}%</b>
            <span>考点掌握度</span>
          </div>
          <div className="hero-pill">
            <b>{plan.forecast}</b>
            <span>预估分</span>
          </div>
          <div className="hero-pill">
            <b>{state.streak.count}</b>
            <span>连续冲刺天数</span>
          </div>
        </div>

        <div className="hero-bar">
          <i style={{ width: `${Math.round(Math.min(1, plan.coverage) * 100)}%` }} />
        </div>
        <div className="hero-line" style={{ fontSize: 11.5 }}>
          目标 {plan.target} 分 · 考点覆盖 {Math.round(Math.min(1, plan.coverage) * 100)}% · 还有 {untouched} 个考点没测过
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">今日冲刺任务</div>
          <div className="card-note">
            {doneCount}/{plan.tasks.length} 完成
          </div>
        </div>
        {plan.tasks.map((t) => {
          const done = taskDone(t.kind);
          const value =
            t.kind === 'quiz'
              ? Math.min(plan.dailyQuiz, today.quiz)
              : t.kind === 'review'
                ? Math.min(t.goal, today.review)
                : Math.min(t.goal, today.kps.length);
          return (
            <div key={t.id} className={`task ${done ? 'done' : ''}`}>
              <div className="task-check">✓</div>
              <div className="task-body">
                <div className="task-title">{t.title}</div>
                <div className="task-detail">{t.detail}</div>
              </div>
              <div className="task-count">
                {value}/{t.goal || 1}
              </div>
            </div>
          );
        })}
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onStart}>
          开始今天的第一组题 →
        </button>
        <div className="card-note" style={{ textAlign: 'center', marginTop: 9 }}>
          一组 {Math.min(10, plan.queue.length)} 题，3 分钟，做错立刻讲
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">考点性价比排行</div>
          <div className="card-note">考频 ÷ 你的掌握度</div>
        </div>
        {plan.order.slice(0, 6).map((o, i) => (
          <div className="kprow" key={o.kp.id}>
            <div className={`kp-index ${o.kp.heat === 3 ? 'hot' : ''}`}>{i + 1}</div>
            <div className="kp-main">
              <div className="kp-name">{o.kp.name}</div>
              <div className="kp-meta">
                <span className={`heat ${o.kp.heat === 2 ? 'mid' : o.kp.heat === 1 ? 'low' : ''}`}>
                  {heatLabel(o.kp.heat)}
                </span>
                <span>{o.kp.chapter}</span>
                <span>
                  {o.seen === 0 ? '未测' : `做过 ${o.seen} 题 · 对 ${Math.round(o.mastery * 100)}%`}
                </span>
              </div>
            </div>
            <div className="meter">
              <i style={{ width: `${Math.round(o.mastery * 100)}%` }} />
            </div>
          </div>
        ))}
        <div className="card-note" style={{ marginTop: 10 }}>
          越靠前越值钱：老师年年考、你还没掌握的那些，就是提分空间。
        </div>
      </div>

      {weak.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">最该补的三个洞</div>
            <div className="card-note">按掌握度排序</div>
          </div>
          {weak.map((o) => (
            <div className="kprow" key={o.kp.id}>
              <div className="kp-index hot">!</div>
              <div className="kp-main">
                <div className="kp-name">{o.kp.name}</div>
                <div className="kp-meta">
                  已做 {o.seen} 题，正确率 {Math.round(o.mastery * 100)}%
                </div>
              </div>
            </div>
          ))}
          <div className="card-note" style={{ marginTop: 10 }}>
            这三个补上，比乱刷一百道题更管用。
          </div>
        </div>
      )}

      <div className="card">
        <div className="between">
          <div>
            <div className="card-title">🧯 保命模式</div>
            <div className="card-note" style={{ marginTop: 3 }}>
              只出高频 + 中低难度题，放弃冷门章节
            </div>
          </div>
          <button
            className={`switch ${state.lifesaver ? 'on' : ''}`}
            aria-label="保命模式"
            onClick={() => dispatch({ type: 'lifesaver', on: !state.lifesaver })}
          />
        </div>
        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="card-note">
            错题本里还有 <b style={{ color: 'var(--accent)' }}>{mistakes}</b> 道没收拾
          </div>
          <button className="btn btn-sm" onClick={onReview} disabled={mistakes === 0}>
            去复盘
          </button>
        </div>
      </div>

      <div className="foot-note">
        <button className="link" onClick={onRetake}>
          换个科目 / 重新估算天数
        </button>
      </div>
    </>
  );
}
