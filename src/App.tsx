import { useMemo, useState } from 'react';
import { StoreProvider, useStore, currentToday, mistakeCount } from './store';
import { courseById } from './data';
import { buildPlan, MODE_META } from './lib/plan';
import Onboarding from './screens/Onboarding';
import Sprint from './screens/Sprint';
import Quiz from './screens/Quiz';
import Mistakes from './screens/Mistakes';
import Profile from './screens/Profile';
import './styles.css';

type Tab = 'sprint' | 'quiz' | 'mistakes' | 'me';

function Shell() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null;
    return t === 'quiz' || t === 'mistakes' || t === 'me' ? t : 'sprint';
  });
  const [quizMode, setQuizMode] = useState<'normal' | 'review'>('normal');
  const [session, setSession] = useState(0);

  const course = useMemo(() => (state.exam ? courseById(state.exam.courseId) : null), [state.exam]);
  const plan = useMemo(
    () => (course && state.exam ? buildPlan(course, state.exam, state.progress, state.lifesaver) : null),
    [course, state.exam, state.progress, state.lifesaver],
  );

  if (!state.onboarded || !course || !plan) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">F</div>
            <div>
              <div className="brand-name">FastStudy</div>
              <div className="brand-sub">期末极限备考</div>
            </div>
          </div>
        </header>
        <Onboarding onDone={() => setTab('sprint')} />
      </div>
    );
  }

  const start = (mode: 'normal' | 'review') => {
    setQuizMode(mode);
    setSession((s) => s + 1);
    setTab('quiz');
  };

  const today = currentToday(state);
  const mistakes = mistakeCount(state);

  return (
    <div className="app">
      {tab !== 'quiz' && (
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">F</div>
            <div>
              <div className="brand-name">FastStudy</div>
              <div className="brand-sub">期末极限备考</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="hero-tag" style={{ background: 'var(--ink)', color: '#fff' }}>
              {MODE_META[plan.mode].label}
            </span>
            <span className="card-note">
              今日 {today.quiz}/{plan.dailyQuiz}
            </span>
          </div>
        </header>
      )}

      {tab === 'sprint' && (
        <div className="screen">
          <Sprint
            course={course}
            plan={plan}
            onStart={() => start('normal')}
            onReview={() => start('review')}
            onRetake={() => setTab('me')}
          />
        </div>
      )}

      {tab === 'quiz' && (
        <Quiz
          key={session}
          course={course}
          plan={plan}
          mode={quizMode}
          onExit={() => setTab('sprint')}
          onGoMistakes={() => setTab('mistakes')}
        />
      )}

      {tab === 'mistakes' && (
        <div className="screen">
          <Mistakes course={course} onReview={() => start('review')} />
        </div>
      )}

      {tab === 'me' && (
        <div className="screen">
          <Profile course={course} plan={plan} onRetake={() => setTab('sprint')} />
        </div>
      )}

      <nav className="tabbar">
        <button className={`tab ${tab === 'sprint' ? 'on' : ''}`} onClick={() => setTab('sprint')}>
          <span className="tab-icon">🚀</span>
          <span>冲刺</span>
        </button>
        <button className={`tab ${tab === 'quiz' ? 'on' : ''}`} onClick={() => start('normal')}>
          <span className="tab-icon">✍️</span>
          <span>刷题</span>
        </button>
        <button className={`tab ${tab === 'mistakes' ? 'on' : ''}`} onClick={() => setTab('mistakes')}>
          <span className="tab-icon">🧯</span>
          <span>错题{mistakes > 0 ? ` ${mistakes}` : ''}</span>
        </button>
        <button className={`tab ${tab === 'me' ? 'on' : ''}`} onClick={() => setTab('me')}>
          <span className="tab-icon">👤</span>
          <span>我的</span>
        </button>
      </nav>
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
