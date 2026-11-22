import type { Course } from '../data/types';
import { MODE_META, overallMastery, type Plan } from '../lib/plan';
import { currentToday, mistakeCount, useStore } from '../store';
import { Donut, Mountains, Radar } from '../components/Charts';

const heatText = (h: 1 | 2 | 3) => (h === 3 ? '高频' : h === 2 ? '常考' : '了解');

/** 考点名过长时截断，避免路径条折行 */
const shortName = (n: string, len = 9) => {
  const s = n.replace(/^[^：]*：/, '');
  return s.length > len ? s.slice(0, len) + '…' : s;
};

export default function Dashboard({
  course,
  plan,
  onStart,
  onReview,
  onBank,
}: {
  course: Course;
  plan: Plan;
  onStart: () => void;
  onReview: () => void;
  onBank: () => void;
}) {
  const { state } = useStore();
  const today = currentToday(state);
  const mastery = overallMastery(plan.order);
  const mistakes = mistakeCount(state);

  const mastered = plan.order.filter((o) => o.seen > 0 && o.mastery >= 0.8).length;
  const learning = plan.order.filter((o) => o.seen > 0 && o.mastery < 0.8).length;
  const todo = plan.order.length - mastered - learning;

  const taskDone = (kind: string) =>
    kind === 'quiz'
      ? today.quiz >= plan.dailyQuiz
      : kind === 'review'
        ? today.review >= Math.max(1, plan.dailyReview)
        : today.kps.length >= plan.todayKps.length;

  const doneCount = plan.tasks.filter((t) => taskDone(t.kind)).length;

  const accuracy = state.total.quiz ? state.total.correct / state.total.quiz : 0;
  const weakest = plan.order[0];
  const minutes = Math.round(state.total.seconds / 60);

  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? '凌晨好' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  const radar = [
    { name: '记忆', value: Math.min(1, mastered / Math.max(1, plan.order.length) + 0.15) },
    { name: '理解', value: Math.min(1, (mastery + 0.2) * 0.9) },
    { name: '运用', value: Math.min(1, accuracy * 0.9 + 0.05) },
    { name: '分析', value: Math.min(1, mastery * 0.85 + 0.1) },
    { name: '综合', value: Math.min(1, (mastery + accuracy) / 2) },
    { name: '冲刺', value: Math.min(1, (today.quiz / Math.max(1, plan.dailyQuiz)) * 0.8 + 0.1) },
  ];

  const firstPending = course.kps.findIndex((k) => {
    const o = plan.order.find((x) => x.kp.id === k.id);
    return !o || o.seen === 0 || o.mastery < 0.7;
  });

  return (
    <div className="dash">
      <div className="col">
        <div className="hello">
          <Mountains />
          <div className="hello-text">
            <h2>{greeting}，同学 👋</h2>
            <p>
              {course.name} · 距考 {plan.days} 天 · {MODE_META[plan.mode].label}：{MODE_META[plan.mode].tagline}
            </p>
          </div>
          <div className="hello-pills">
            <div className="hello-pill">
              <b>{plan.days}</b>
              <span>距考天数</span>
            </div>
            <div className="hello-pill">
              <b>{Math.round(mastery * 100)}%</b>
              <span>掌握度</span>
            </div>
            <div className="hello-pill">
              <b>{state.streak.count}</b>
              <span>连续天数</span>
            </div>
          </div>
        </div>

        <div className="grid grid-2" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <span className="ico">📊</span>学习进度
              </div>
              <span className="card-note">
                {mastered + learning}/{plan.order.length} 考点
              </span>
            </div>
            <div className="donut-wrap">
              <Donut
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
                  已掌握 <b>{mastered} 考点</b>
                </div>
                <div className="legend-row">
                  <span className="dot" style={{ background: '#3b6bf5' }} />
                  学习中 <b>{learning} 考点</b>
                </div>
                <div className="legend-row">
                  <span className="dot" style={{ background: '#e3dccd' }} />
                  待学习 <b>{todo} 考点</b>
                </div>
                <div className="divider" style={{ margin: '4px 0' }} />
                <div className="legend-row" style={{ fontSize: 11.5 }}>
                  预估分
                  <b style={{ color: plan.forecast >= plan.target ? '#23b26d' : '#e04b4b' }}>{plan.forecast}</b>
                </div>
              </div>
            </div>
            <div className="divider" style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span className="card-note">今日完成度</span>
              <span className="card-note">
                {today.quiz}/{plan.dailyQuiz} 题 · 距目标还差 {Math.max(0, learning + todo)} 个考点
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${Math.min(100, (today.quiz / Math.max(1, plan.dailyQuiz)) * 100)}%` }} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <span className="ico">✅</span>今日任务
              </div>
              <span className="card-note">
                {doneCount}/{plan.tasks.length} 完成
              </span>
            </div>
            {plan.tasks.map((t) => {
              const done = taskDone(t.kind);
              const value =
                t.kind === 'quiz'
                  ? Math.min(plan.dailyQuiz, today.quiz)
                  : t.kind === 'review'
                    ? Math.min(t.goal || 1, today.review)
                    : Math.min(t.goal || 1, today.kps.length);
              return (
                <div key={t.id} className={`task-row ${done ? 'done' : ''}`}>
                  <div className="tick">✓</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="task-name">{t.title}</div>
                    <div className="task-desc">{t.detail}</div>
                  </div>
                  <div className="task-count">
                    {value}/{t.goal || 1}
                  </div>
                </div>
              );
            })}
            <div className="bar" style={{ margin: '12px 0' }}>
              <i style={{ width: `${(doneCount / plan.tasks.length) * 100}%` }} />
            </div>
            <button className="btn btn-primary btn-wide" onClick={onStart}>
              开始今天的第一组题 →
            </button>
          </div>
        </div>

        <div className="grid grid-2" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <span className="ico">📘</span>最近在刷
              </div>
              <button className="link" onClick={onBank}>
                全部考点 →
              </button>
            </div>
            <div className="recent">
              <div className="thumb">{course.short}</div>
              <div style={{ minWidth: 0 }}>
                <div className="recent-title">{weakest ? shortName(weakest.kp.name, 14) : '暂无'}</div>
                <div className="recent-sub">
                  {weakest?.seen
                    ? `做过 ${weakest.seen} 题 · 正确率 ${Math.round(weakest.mastery * 100)}%`
                    : '还没测过这个考点'}
                </div>
                <div className="row-meta" style={{ marginTop: 6 }}>
                  <span className="heat">{heatText(weakest?.kp.heat ?? 1)}</span>
                  <span className="pill blue">性价比第 1</span>
                </div>
              </div>
              <button className="play-btn" onClick={onStart} aria-label="开始">
                ▶
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <span className="ico">📈</span>学习统计
              </div>
              <span className="card-note">累计</span>
            </div>
            <div className="stats3">
              <div className="stat-box">
                <b>{minutes}</b>
                <span>专注分钟</span>
              </div>
              <div className="stat-box">
                <b>{state.total.quiz}</b>
                <span>刷题总数</span>
              </div>
              <div className="stat-box">
                <b style={{ color: accuracy >= 0.8 ? '#23b26d' : '#1b2b4b' }}>{Math.round(accuracy * 100)}%</b>
                <span>正确率</span>
              </div>
            </div>
            {mistakes > 0 && (
              <div
                className="notice"
                style={{ marginTop: 12, background: '#fdf2e2', borderColor: '#f7dcb0', color: '#96631a' }}
              >
                错题急救本里还有 <b>{mistakes}</b> 道没收拾，
                <button className="link" style={{ color: '#b57209' }} onClick={onReview}>
                  去复盘 →
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🗺️</span>学习路径（{course.short}）
            </div>
            <span className="card-note">按章节顺序 · 已掌握的点亮</span>
          </div>
          <div className="path">
            {course.kps.map((kp, i) => {
              const o = plan.order.find((x) => x.kp.id === kp.id);
              const st = !o || o.seen === 0 ? 'lock' : o.mastery >= 0.7 ? 'done' : 'now';
              return (
                <div key={kp.id} className={`path-node ${st === 'lock' ? 'lock' : st}`}>
                  {i === firstPending && <span className="badge-now">当前</span>}
                  <div className="path-dot">{st === 'done' ? '✓' : st === 'lock' ? '🔒' : i + 1}</div>
                  <div className="path-label">{shortName(kp.name)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="col">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🎯</span>掌握度
            </div>
            <span className="card-note">按考频加权</span>
          </div>
          {plan.order.slice(0, 6).map((o) => (
            <div className="mastery-row" key={o.kp.id}>
              <div className="mastery-name">{shortName(o.kp.name, 8)}</div>
              <div className="mastery-bar">
                <i style={{ width: `${Math.round(o.mastery * 100)}%` }} />
              </div>
              <div className="mastery-val">{o.seen === 0 ? '—' : `${Math.round(o.mastery * 100)}%`}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🕸️</span>能力画像
            </div>
            <span className="card-note">自评分</span>
          </div>
          <Radar axes={radar} size={220} />
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🧭</span>迭代规划
            </div>
          </div>
          <div className="roadmap">
            {[
              { t: 'v0.1 核心闭环', d: '计划 · 引导刷题 · 错题本 · 看板', done: true },
              { t: 'v0.2 资料驱动', d: '上传课件/往年卷，自动抽取考点', done: false },
              { t: 'v0.3 模拟考试', d: '限时套卷 + 薄弱点报告', done: false },
              { t: 'v1.0 小程序正式版', d: '登录 · 云同步 · 组队冲刺', done: false },
            ].map((r) => (
              <div key={r.t} className={`road-node ${r.done ? 'done' : ''}`}>
                <div className="road-dot" />
                <div>
                  <div className="road-title">{r.t}</div>
                  <div className="road-desc">{r.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
