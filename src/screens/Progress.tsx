import type { Course } from '../data/types';
import { overallMastery, rankOf, type Plan } from '../lib/plan';
import { currentToday, mistakeCount, useStore } from '../store';
import { Donut, Radar } from '../components/Charts';

export default function Progress({ course, plan }: { course: Course; plan: Plan }) {
  const { state } = useStore();
  const today = currentToday(state);
  const accuracy = state.total.quiz ? state.total.correct / state.total.quiz : 0;
  const mastery = overallMastery(plan.order);
  const minutes = Math.round(state.total.seconds / 60);
  const rank = rankOf(state.total.quiz, accuracy);

  const mastered = plan.order.filter((o) => o.seen > 0 && o.mastery >= 0.8).length;
  const learning = plan.order.filter((o) => o.seen > 0 && o.mastery < 0.8).length;
  const todo = plan.order.length - mastered - learning;

  const radar = [
    { name: '记忆', value: Math.min(1, mastered / Math.max(1, plan.order.length) + 0.15) },
    { name: '理解', value: Math.min(1, (mastery + 0.2) * 0.9) },
    { name: '运用', value: Math.min(1, accuracy * 0.9 + 0.05) },
    { name: '分析', value: Math.min(1, mastery * 0.85 + 0.1) },
    { name: '综合', value: Math.min(1, (mastery + accuracy) / 2) },
    { name: '冲刺', value: Math.min(1, (today.quiz / Math.max(1, plan.dailyQuiz)) * 0.8 + 0.1) },
  ];

  return (
    <div className="col">
      <div className="topline">
        <div>
          <h1>学习进度</h1>
          <div className="sub">
            {course.name} · 目标 {plan.target} 分 · 距考 {plan.days} 天
          </div>
        </div>
        <div className="chips">
          <span className="pill blue">预估分 {plan.forecast}</span>
          <span className="pill green">{rank.name}</span>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">⏱️</span>专注时长
            </div>
          </div>
          <div className="donut-center" style={{ fontSize: 30 }}>
            {minutes}
            <span style={{ fontSize: 12, color: '#93a0b5', marginLeft: 4 }}>分钟</span>
          </div>
          <div className="card-note" style={{ marginTop: 4 }}>
            今日 {Math.round(today.seconds / 60)} 分钟
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">✍️</span>刷题
            </div>
          </div>
          <div className="donut-center" style={{ fontSize: 30 }}>
            {state.total.quiz}
            <span style={{ fontSize: 12, color: '#93a0b5', marginLeft: 4 }}>题</span>
          </div>
          <div className="card-note" style={{ marginTop: 4 }}>
            今日 {today.quiz} 题 · 错题 {mistakeCount(state)} 道待收拾
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🎯</span>正确率
            </div>
          </div>
          <div className="donut-center" style={{ fontSize: 30, color: accuracy >= 0.8 ? '#23b26d' : '#1b2b4b' }}>
            {Math.round(accuracy * 100)}
            <span style={{ fontSize: 12, color: '#93a0b5', marginLeft: 2 }}>%</span>
          </div>
          <div className="card-note" style={{ marginTop: 4 }}>
            连续冲刺 {state.streak.count} 天
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🍩</span>掌握度分布
            </div>
            <span className="card-note">{plan.order.length} 个考点</span>
          </div>
          <div className="donut-wrap">
            <Donut
              size={132}
              stroke={15}
              parts={[
                { value: mastered, color: '#23b26d' },
                { value: learning, color: '#3b6bf5' },
                { value: Math.max(0, todo), color: '#eee7d8' },
              ]}
              center={`${Math.round(mastery * 100)}%`}
              label="整体掌握"
            />
            <div className="legend">
              <div className="legend-row">
                <span className="dot" style={{ background: '#23b26d' }} />
                已掌握（≥80%）<b>{mastered}</b>
              </div>
              <div className="legend-row">
                <span className="dot" style={{ background: '#3b6bf5' }} />
                学习中<b>{learning}</b>
              </div>
              <div className="legend-row">
                <span className="dot" style={{ background: '#e3dccd' }} />
                待学习<b>{todo}</b>
              </div>
            </div>
          </div>
          <div className="divider" />
          <div className="rank-card">
            <div className="rank-name">{rank.name}</div>
            <div className="rank-sub">{rank.next}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🕸️</span>能力画像
            </div>
            <span className="card-note">由做题记录推导</span>
          </div>
          <Radar axes={radar} size={250} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="ico">📋</span>考点掌握明细
          </div>
          <span className="card-note">按性价比排序</span>
        </div>
        {plan.order.map((o) => (
          <div className="row-item" key={o.kp.id}>
            <div className={`idx ${o.mastery < 0.5 && o.seen > 0 ? 'hot' : 'blue'}`}>
              {o.seen === 0 ? '—' : Math.round(o.mastery * 100)}
            </div>
            <div className="row-main">
              <div className="row-title">{o.kp.name}</div>
              <div className="row-meta">
                <span className={`heat ${o.kp.heat === 2 ? 'mid' : o.kp.heat === 1 ? 'low' : ''}`}>
                  {o.kp.heat === 3 ? '高频' : o.kp.heat === 2 ? '常考' : '了解'}
                </span>
                <span>{o.kp.chapter}</span>
                <span>{o.seen === 0 ? '还没测过' : `做过 ${o.seen} 题`}</span>
              </div>
            </div>
            <div style={{ width: 140, flex: 'none' }}>
              <div className="bar">
                <i
                  style={{
                    width: `${Math.round(o.mastery * 100)}%`,
                    background:
                      o.mastery >= 0.8
                        ? 'linear-gradient(90deg,#23b26d,#5fd39a)'
                        : o.mastery < 0.5 && o.seen > 0
                          ? 'linear-gradient(90deg,#e04b4b,#ff8181)'
                          : undefined,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
