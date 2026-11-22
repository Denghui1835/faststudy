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
      <div className="topline">
        <div>
          <h1>错题急救本</h1>
          <div className="sub">答对一次就自动出本 · 错题不消灭，刷多少都是白刷</div>
        </div>
        <div className="top-actions">
          <span className="pill red">{entries.length} 道待收拾</span>
          {entries.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={onReview}>
              开始复盘
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 && (
        <div className="card">
          <div className="empty">
            <div className="empty-emoji">🎉</div>
            <div className="empty-title">错题本是空的</div>
            <div className="empty-text">
              要么你真的很稳，
              <br />
              要么你还没开始刷题。
            </div>
          </div>
        </div>
      )}

      {[...groups.entries()].map(([kpId, list]) => (
        <div className="card" key={kpId}>
          <div className="card-head">
            <div className="card-title">
              <span className="ico">📌</span>
              {kpName(kpId)}
            </div>
            <span className="card-note">{list.length} 道</span>
          </div>
          {list.map(({ qid, times }) => {
            const q = byId.get(qid);
            if (!q) return null;
            return (
              <div key={qid} className="row-item" style={{ alignItems: 'flex-start' }}>
                <div className="idx hot">{times}</div>
                <div className="row-main">
                  <div className="row-title" style={{ whiteSpace: 'normal' }}>
                    {q.stem}
                  </div>
                  <div className="row-meta" style={{ marginTop: 4 }}>
                    <span>正确：{q.answer.map((i) => q.options[i]).join('、')}</span>
                  </div>
                  <div className="bubble" style={{ marginTop: 8 }}>
                    {q.explain.keep}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {entries.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="muted">错过的题都在这，答对一次就消失——这是它比别的错题本更好的地方。</div>
            <button
              className="btn btn-sm"
              onClick={() => {
                if (window.confirm('确定要清空错题本吗？这个操作不可撤销。')) dispatch({ type: 'clearMistakes' });
              }}
            >
              清空
            </button>
          </div>
        </div>
      )}
    </>
  );
}
