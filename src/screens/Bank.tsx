import type { Course } from '../data/types';
import { courses } from '../data';
import type { Plan } from '../lib/plan';
import { useStore } from '../store';

export default function Bank({
  course,
  plan,
  onPractice,
  onSwitchCourse,
}: {
  course: Course;
  plan: Plan;
  onPractice: (kpId: string) => void;
  onSwitchCourse: (id: string) => void;
}) {
  const { state } = useStore();
  const totalByKp = (kpId: string) => course.questions.filter((q) => q.kp === kpId).length;

  const doneOfKp = (kpId: string) => {
    const qs = course.questions.filter((q) => q.kp === kpId);
    return qs.filter((q) => (state.progress[q.id]?.seen ?? 0) > 0).length;
  };

  return (
    <div className="col">
      <div className="topline">
        <div>
          <h1>题库</h1>
          <div className="sub">
            {course.name} · {course.kps.length} 个考点 · {course.questions.length} 题 · 按性价比排序
          </div>
        </div>
        <div className="chips">
          {courses.map((c) => (
            <button
              key={c.id}
              className={`chip ${c.id === course.id ? 'on' : ''}`}
              onClick={() => onSwitchCourse(c.id)}
            >
              {c.short}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="ico">📚</span>考点清单
          </div>
          <span className="card-note">考频越高越靠前，掌握度低更靠前</span>
        </div>
        {plan.order.map((o, i) => {
          const done = doneOfKp(o.kp.id);
          const total = totalByKp(o.kp.id);
          return (
            <div className="row-item" key={o.kp.id}>
              <div className={`idx ${o.kp.heat === 3 ? 'hot' : 'blue'}`}>{i + 1}</div>
              <div className="row-main">
                <div className="row-title">{o.kp.name}</div>
                <div className="row-meta">
                  <span className={`heat ${o.kp.heat === 2 ? 'mid' : o.kp.heat === 1 ? 'low' : ''}`}>
                    {o.kp.heat === 3 ? '高频' : o.kp.heat === 2 ? '常考' : '了解'}
                  </span>
                  <span>{o.kp.chapter}</span>
                  <span>
                    {done}/{total} 题已练
                  </span>
                  <span>掌握 {o.seen === 0 ? '—' : `${Math.round(o.mastery * 100)}%`}</span>
                </div>
              </div>
              <div style={{ width: 90, flex: 'none' }}>
                <div className="bar">
                  <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => onPractice(o.kp.id)}>
                练这组
              </button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="ico">🗂️</span>其他课程
          </div>
          <span className="card-note">期末撞车时，可以随时换</span>
        </div>
        <div className="course-grid">
          {courses.map((c) => (
            <button
              key={c.id}
              className={`course-card ${c.id === course.id ? 'on' : ''}`}
              onClick={() => onSwitchCourse(c.id)}
            >
              <div className="course-dot" style={{ background: c.color }}>
                {c.name.slice(0, 1)}
              </div>
              <div className="course-name">{c.name}</div>
              <div className="course-sub">
                {c.kps.length} 考点 · {c.questions.length} 题
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
