import { useMemo, useState } from 'react';
import { StoreProvider, useStore, currentToday, mistakeCount } from './store';
import { courseById } from './data';
import { buildPlan, MODE_META } from './lib/plan';
import Onboarding from './screens/Onboarding';
import Dashboard from './screens/Dashboard';
import PlanPage from './screens/PlanPage';
import Bank from './screens/Bank';
import Progress from './screens/Progress';
import Quiz from './screens/Quiz';
import Exam from './screens/Exam';
import Mistakes from './screens/Mistakes';
import Profile from './screens/Profile';
import './styles.css';

type Tab = 'home' | 'plan' | 'bank' | 'exam' | 'progress' | 'mistakes' | 'me' | 'quiz';

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: '首页' },
  { id: 'plan', icon: '🗓️', label: '计划' },
  { id: 'bank', icon: '📚', label: '题库' },
  { id: 'exam', icon: '⏱️', label: '模考' },
  { id: 'progress', icon: '📈', label: '进度' },
  { id: 'mistakes', icon: '🧯', label: '错题' },
  { id: 'me', icon: '👤', label: '我的' },
];

function Shell() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null;
    if (t === 'quiz') return 'quiz';
    return t && NAV.some((n) => n.id === t) ? (t as Tab) : 'home';
  });
  const [quizMode, setQuizMode] = useState<'normal' | 'review'>('normal');
  const [kpFilter, setKpFilter] = useState<string | undefined>(undefined);
  const [session, setSession] = useState(0);

  const course = useMemo(() => (state.exam ? courseById(state.exam.courseId) : null), [state.exam]);
  const plan = useMemo(
    () => (course && state.exam ? buildPlan(course, state.exam, state.progress, state.lifesaver) : null),
    [course, state.exam, state.progress, state.lifesaver],
  );

  if (!state.onboarded || !course || !plan) {
    return (
      <div className="shell" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <Onboarding onDone={() => setTab('home')} />
      </div>
    );
  }

  const start = (mode: 'normal' | 'review', kp?: string) => {
    setQuizMode(mode);
    setKpFilter(kp);
    setSession((s) => s + 1);
    setTab('quiz');
  };

  const today = currentToday(state);
  const mistakes = mistakeCount(state);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="side-mark">F</div>
          <div>
            <div className="side-name">FastStudy</div>
            <div className="side-sub">期末极限备考</div>
          </div>
        </div>

        <nav className="nav-list">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? 'on' : ''}`}
              onClick={() => setTab(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {n.id === 'mistakes' && mistakes > 0 && <span className="nav-badge">{mistakes}</span>}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <b>{course.short} · {plan.days} 天后考</b>
          今日 {today.quiz}/{plan.dailyQuiz} 题 · {MODE_META[plan.mode].label}
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-sm btn-wide"
              style={{ background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}
              onClick={() => start('normal')}
            >
              快速开刷
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        {tab === 'home' && (
          <Dashboard
            course={course}
            plan={plan}
            onStart={() => start('normal')}
            onReview={() => start('review')}
            onBank={() => setTab('bank')}
          />
        )}

        {tab === 'plan' && (
          <PlanPage course={course} plan={plan} onStart={() => start('normal')} onRetake={() => setTab('me')} />
        )}

        {tab === 'bank' && (
          <Bank
            course={course}
            plan={plan}
            onPractice={(kp) => start('normal', kp)}
            onSwitchCourse={(id) =>
              dispatch({
                type: 'retake',
                exam: { ...(state.exam as NonNullable<typeof state.exam>), courseId: id },
              })
            }
          />
        )}

        {tab === 'progress' && <Progress course={course} plan={plan} />}

        {tab === 'exam' && (
          <Exam course={course} onPractice={(kp) => start('normal', kp)} onGoMistakes={() => setTab('mistakes')} />
        )}

        {tab === 'mistakes' && (
          <div className="col">
            <Mistakes course={course} onReview={() => start('review')} />
          </div>
        )}

        {tab === 'me' && (
          <Profile course={course} plan={plan} onRetake={() => setTab('plan')} onSwitchCourse={() => setTab('bank')} />
        )}

        {tab === 'quiz' && (
          <Quiz
            key={session}
            course={course}
            plan={plan}
            mode={quizMode}
            kpFilter={kpFilter}
            onExit={() => setTab('home')}
            onGoMistakes={() => setTab('mistakes')}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
