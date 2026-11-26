import { useEffect, useMemo, useRef, useState } from 'react';
import type { Course } from '../data/types';
import { courses } from '../data';
import { searchBank, segments } from '../lib/search';
import type { Plan } from '../lib/plan';
import { useStore } from '../store';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TYPE_LABEL = { single: '单选', multi: '多选', judge: '判断' } as const;
const PAGE = 12;

/** 把命中的关键词包成 <mark>；未命中的部分保持纯文本，避免被父级 span 样式改写排版 */
function Marked({ text, tokens }: { text: string; tokens: string[] }) {
  return (
    <>
      {segments(text, tokens).map((s, i) =>
        s.hit ? (
          <mark className="hl" key={i}>
            {s.text}
          </mark>
        ) : (
          s.text
        ),
      )}
    </>
  );
}

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

  const [query, setQuery] = useState('');
  const [scopeAll, setScopeAll] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(
    () => searchBank(courses, query, scopeAll ? null : course.id),
    [query, scopeAll, course.id],
  );
  const searching = result.tokens.length > 0;
  const shown = result.hits.slice(0, limit);
  const searchable = scopeAll
    ? courses.reduce((n, c) => n + c.questions.length, 0)
    : course.questions.length;

  // 换关键词 / 换范围时回到第一批结果，避免展开状态错位到另一条题上
  const changeQuery = (v: string) => {
    setQuery(v);
    setLimit(PAGE);
    setOpenKey(null);
  };
  const changeScope = (all: boolean) => {
    setScopeAll(all);
    setLimit(PAGE);
    setOpenKey(null);
  };

  // 「/」聚焦搜索框，Esc 清空 —— 桌面端刷题库时手不用离开键盘
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('');
        setLimit(PAGE);
        setOpenKey(null);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hot = plan.order.slice(0, 6).map((o) => o.kp.name);

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
            <span className="ico">🔍</span>题库检索
          </div>
          <span className="card-note">题干 / 选项 / 讲解 / 考点，一处搜全套</span>
        </div>

        <div className="search-bar">
          <span className="search-ico" aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder="搜考点、题干、选项或讲解…（按 / 快速聚焦，多个词用空格隔开）"
            aria-label="检索题库"
          />
          {query && (
            <button
              className="search-clear"
              onClick={() => {
                changeQuery('');
                inputRef.current?.focus();
              }}
            >
              清除
            </button>
          )}
        </div>

        <div className="search-scope">
          <button className={`chip ${scopeAll ? '' : 'on'}`} onClick={() => changeScope(false)}>
            本课程
          </button>
          <button className={`chip ${scopeAll ? 'on' : ''}`} onClick={() => changeScope(true)}>
            全部 {courses.length} 门课
          </button>
          <span className="muted" style={{ marginLeft: 'auto' }}>
            {searching ? `${result.hits.length} 条命中` : `${searchable} 题可搜`}
          </span>
        </div>

        {!searching && (
          <div className="search-hint">
            <span className="muted">高频考点：</span>
            {hot.map((name) => (
              <button key={name} className="kw" onClick={() => changeQuery(name)}>
                {name}
              </button>
            ))}
          </div>
        )}

        {searching && result.hits.length === 0 && (
          <div className="empty" style={{ padding: '24px 0 8px' }}>
            <div className="empty-emoji">🔎</div>
            <div className="empty-title">没搜到「{query.trim()}」</div>
            <div className="empty-text">
              换成更短的关键词试试；跨课程的内容记得切到「全部 {courses.length} 门课」。
            </div>
          </div>
        )}

        {shown.length > 0 && (
          <div className="sr-list">
            {shown.map((hit) => {
              const open = openKey === hit.key;
              const wrong = state.mistakes[hit.q.id] ?? 0;
              const sameCourse = hit.course.id === course.id;
              return (
                <div className={`sr-item ${open ? 'on' : ''}`} key={hit.key}>
                  <button
                    className="sr-head"
                    onClick={() => setOpenKey(open ? null : hit.key)}
                    aria-expanded={open}
                  >
                    <div className="sr-main">
                      <div className="sr-stem">
                        <Marked text={hit.q.stem} tokens={result.tokens} />
                      </div>
                      <div className="sr-meta">
                        {!sameCourse && (
                          <span className="sr-course" style={{ background: hit.course.color }}>
                            {hit.course.short}
                          </span>
                        )}
                        <span className="sr-kp">{hit.kp.name}</span>
                        <span
                          className={`heat ${hit.kp.heat === 2 ? 'mid' : hit.kp.heat === 1 ? 'low' : ''}`}
                        >
                          {hit.kp.heat === 3 ? '高频' : hit.kp.heat === 2 ? '常考' : '了解'}
                        </span>
                        <span>{TYPE_LABEL[hit.q.type]}</span>
                        {wrong > 0 && <span className="pill red">错过 {wrong} 次</span>}
                      </div>
                    </div>
                    <span className="sr-toggle">{open ? '收起' : '看答案'}</span>
                  </button>

                  {open && (
                    <div className="sr-body">
                      <div className="sr-tags">
                        命中 <b>{hit.labels.join(' · ')}</b>
                        {hit.q.year ? <span className="muted"> · {hit.q.year} 年考过</span> : null}
                      </div>

                      <div className="opts">
                        {hit.q.options.map((opt, i) => {
                          const right = hit.q.answer.includes(i);
                          return (
                            <div key={i} className={`opt ${right ? 'ok' : 'dim'}`}>
                              <span className="opt-key">{LETTERS[i]}</span>
                              <span>
                                <Marked text={opt} tokens={result.tokens} />
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="exp-grid">
                        <div className="exp-cell">
                          <div className="exp-tag">考什么</div>
                          <div className="exp-text">
                            <Marked text={hit.q.explain.what} tokens={result.tokens} />
                          </div>
                        </div>
                        <div className="exp-cell">
                          <div className="exp-tag">错在哪</div>
                          <div className="exp-text">
                            <Marked text={hit.q.explain.why} tokens={result.tokens} />
                          </div>
                        </div>
                      </div>

                      <div className="keep">
                        <span>记住这一句</span>
                        <b>
                          <Marked text={hit.q.explain.keep} tokens={result.tokens} />
                        </b>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 9,
                          marginTop: 12,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        {sameCourse ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onPractice(hit.kp.id)}
                          >
                            练这组（{hit.kp.name}）
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onSwitchCourse(hit.course.id)}
                          >
                            切到「{hit.course.short}」再练
                          </button>
                        )}
                        <span className="muted">
                          正确答案 {hit.q.answer.map((i) => LETTERS[i]).join('、')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {result.hits.length > shown.length && (
          <button
            className="btn btn-wide"
            style={{ marginTop: 10 }}
            onClick={() => setLimit((n) => n + PAGE)}
          >
            再看 {Math.min(PAGE, result.hits.length - shown.length)} 条（还有{' '}
            {result.hits.length - shown.length} 条）
          </button>
        )}
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
