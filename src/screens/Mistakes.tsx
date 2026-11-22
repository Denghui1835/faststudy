import type { Course } from '../data/types';
import { useStore } from '../store';

export default function Mistakes({ course, onReview }: { course: Course; onReview: () => void }) {
  const { state, dispatch } = useStore();
  const entries = Object.entries(state.mistakes).sort((a, b) => b[1] - a[1]);
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  const kpName = (kpId: string) => course.kps.find((k) => k.id === kpId)?.name ?? '';

  const groups = new Map<string, { qid: string; times: number }[]>();
  entries.forEach(([qid, times]) => {
    const q = byId.get(qid);
    if (!q) return;
    const list = groups.get(q.kp) ?? [];
    list.push({ qid, times });
    groups.set(q.kp, list);
  });

  return (
    <>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-head">
          <div className="card-title" style={{ fontSize: 20 }}>
            错题急救本
          </div>
          <span className="hero-tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {entries.length} 道待收拾
          </span>
        </div>
        <div className="card-note">
          每答对一次，这题就自动出本。错题不消灭，刷多少都是白刷。
        </div>
        {entries.length > 0 && (
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onReview}>
            开始复盘这 {Math.min(10, entries.length)} 道
          </button>
        )}
      </div>

      {entries.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">🎉</div>
          <div className="empty-title">错题本是空的</div>
          <div className="empty-text">
            要么你真的很稳，
            <br />
            要么你还没开始刷题。
          </div>
        </div>
      )}

      {[...groups.entries()].map(([kpId, list]) => (
        <div className="card" key={kpId}>
          <div className="card-head">
            <div className="card-title" style={{ fontSize: 14 }}>
              {kpName(kpId)}
            </div>
            <div className="card-note">{list.length} 道</div>
          </div>
          {list.map(({ qid, times }) => {
            const q = byId.get(qid);
            if (!q) return null;
            return (
              <div key={qid} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>{q.stem}</div>
                <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <span className="heat">错过 {times} 次</span>
                  <span className="card-note">正确：{q.answer.map((i) => q.options[i]).join('、')}</span>
                </div>
                <div className="bubble" style={{ marginTop: 8, background: 'var(--paper)', color: 'var(--ink-2)' }}>
                  {q.explain.keep}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {entries.length > 0 && (
        <div className="foot-note">
          <button
            className="link"
            onClick={() => {
              if (window.confirm('确定要清空错题本吗？这个操作不可撤销。')) dispatch({ type: 'clearMistakes' });
            }}
          >
            清空错题本
          </button>
        </div>
      )}
    </>
  );
}
