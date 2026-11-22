import type { Course } from '../data/types';
import { BASIS_LABEL, MODE_META, type Mode } from '../lib/plan';
import type { Plan } from '../lib/plan';
import { useStore } from '../store';

const MODE_ROWS: { mode: Mode; days: string; desc: string }[] = [
  { mode: 'systematic', days: '≥ 14 天', desc: '按章节铺满考点，允许开新章节，先搭框架再刷题' },
  { mode: 'targeted', days: '4 – 13 天', desc: '只打性价比最高的 3–5 个考点，放弃冷门章节' },
  { mode: 'lifesaver', days: '≤ 3 天', desc: '只出高频 + 中低难度题，只保基础分与必考题型' },
];

export default function PlanPage({
  course,
  plan,
  onStart,
  onRetake,
}: {
  course: Course;
  plan: Plan;
  onStart: () => void;
  onRetake: () => void;
}) {
  const { state, dispatch } = useStore();
  const exam = state.exam!;

  const rest = plan.order.filter((o) => !plan.todayKps.some((t) => t.kp.id === o.kp.id));
  const nextDays = [1, 2].map((d) => ({
    day: d,
    items: rest.slice((d - 1) * 3, d * 3),
  }));

  return (
    <div className="col">
      <div className="topline">
        <div>
          <h1>冲刺计划</h1>
          <div className="sub">
            {course.name} · {plan.days} 天后考试 · 目标 {plan.target} 分
          </div>
        </div>
        <div className="top-actions">
          <button className="btn btn-sm" onClick={onRetake}>
            重新估算
          </button>
          <button className="btn btn-primary btn-sm" onClick={onStart}>
            开始刷题
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🧭</span>当前策略
            </div>
            <span className="pill blue">{MODE_META[plan.mode].label}</span>
          </div>
          <div className="notice">{plan.headline}</div>
          <div className="divider" />
          <div className="row-meta" style={{ gap: 18, fontSize: 12 }}>
            <span>
              基础：<b>{BASIS_LABEL[exam.basis]}</b>
            </span>
            <span>
              目标：<b>{exam.target} 分</b>
            </span>
            <span>
              预估：<b>{plan.forecast} 分</b>
            </span>
          </div>
          <div className="divider" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="row-title">🧯 保命模式</div>
              <div className="card-note" style={{ marginTop: 2 }}>
                时间严重不足时，只做高频 + 中低难度，主动砍掉冷门章节
              </div>
            </div>
            <button
              className={`switch ${state.lifesaver ? 'on' : ''}`}
              aria-label="保命模式"
              onClick={() => dispatch({ type: 'lifesaver', on: !state.lifesaver })}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">📅</span>今日任务
            </div>
            <span className="card-note">完成度 {Math.round(
              (plan.tasks.filter((t) => {
                if (t.kind === 'quiz') return state.today.quiz >= plan.dailyQuiz;
                if (t.kind === 'review') return state.today.review >= Math.max(1, plan.dailyReview);
                return state.today.kps.length >= plan.todayKps.length;
              }).length /
                plan.tasks.length) *
                100,
            )}%</span>
          </div>
          {plan.tasks.map((t) => {
            const done =
              t.kind === 'quiz'
                ? state.today.quiz >= plan.dailyQuiz
                : t.kind === 'review'
                  ? state.today.review >= Math.max(1, plan.dailyReview)
                  : state.today.kps.length >= plan.todayKps.length;
            return (
              <div key={t.id} className={`task-row ${done ? 'done' : ''}`}>
                <div className="tick">✓</div>
                <div style={{ minWidth: 0 }}>
                  <div className="task-name">{t.title}</div>
                  <div className="task-desc">{t.detail}</div>
                </div>
                <div className="task-count">{done ? '完成' : '待办'}</div>
              </div>
            );
          })}
          <button className="btn btn-primary btn-wide" style={{ marginTop: 14 }} onClick={onStart}>
            现在开始
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🎯</span>今日要过的考点
            </div>
            <span className="card-note">按性价比</span>
          </div>
          {plan.todayKps.map((o, i) => (
            <div className="row-item" key={o.kp.id}>
              <div className={`idx ${i === 0 ? 'hot' : 'blue'}`}>{i + 1}</div>
              <div className="row-main">
                <div className="row-title">{o.kp.name}</div>
                <div className="row-meta">
                  <span>{o.kp.chapter}</span>
                  <span>{o.seen === 0 ? '未测' : `掌握 ${Math.round(o.mastery * 100)}%`}</span>
                  <span>{o.total} 题</span>
                </div>
              </div>
            </div>
          ))}
          {nextDays.map((d) =>
            d.items.length ? (
              <div key={d.day} style={{ marginTop: 10 }}>
                <div className="card-note" style={{ marginBottom: 4 }}>
                  第 {d.day + 1} 天预告
                </div>
                {d.items.map((o) => (
                  <div key={o.kp.id} className="row-meta" style={{ padding: '4px 0', fontSize: 12 }}>
                    · {o.kp.name}
                  </div>
                ))}
              </div>
            ) : null,
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">📐</span>策略是怎么切换的
            </div>
          </div>
          {MODE_ROWS.map((r) => (
            <div className="row-item" key={r.mode}>
              <div className="idx blue" style={{ width: 52, borderRadius: 7, fontSize: 9.5 }}>
                {r.days}
              </div>
              <div className="row-main">
                <div className="row-title">
                  {MODE_META[r.mode].label}
                  {plan.mode === r.mode && <span className="pill blue" style={{ marginLeft: 6 }}>当前</span>}
                </div>
                <div className="row-meta">{r.desc}</div>
              </div>
            </div>
          ))}
          <div className="notice" style={{ marginTop: 12 }}>
            时间变少时系统会自动降档；你也可以手动打开保命模式，立刻把题库过滤成「高频 + 中低难度」。
          </div>
        </div>
      </div>
    </div>
  );
}
