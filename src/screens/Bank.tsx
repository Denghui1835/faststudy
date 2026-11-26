import { useEffect, useMemo, useRef, useState } from 'react';
import type { Course } from '../data/types';
import { courses } from '../data';
import { searchBank, searchCourses, segments } from '../lib/search';
import type { Plan } from '../lib/plan';
import { useStore } from '../store';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TYPE_LABEL = { single: '单选', multi: '多选', judge: '判断' } as const;
const KIND_LABEL = { paper: '原卷', answer: '答案', slides: '课件' } as const;
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
  const { state, dispatch } = useStore();
  const totalByKp = (kpId: string) => course.questions.filter((q) => q.kp === kpId).length;

  const doneOfKp = (kpId: string) => {
    const qs = course.questions.filter((q) => q.kp === kpId);
    return qs.filter((q) => (state.progress[q.id]?.seen ?? 0) > 0).length;
  };

  const [query, setQuery] = useState('');
  const [scopeAll, setScopeAll] = useState(false);
  const [school, setSchool] = useState<string | null>(null);
  const [heat, setHeat] = useState<1 | 2 | 3 | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);

  // 课程检索：课程会变多，先让用户把「课」找出来，再谈搜题
  const [courseQuery, setCourseQuery] = useState('');
  const courseRef = useRef<HTMLInputElement>(null);
  const courseResult = useMemo(() => searchCourses(courses, courseQuery), [courseQuery]);
  const courseSearching = courseResult.tokens.length > 0;

  const result = useMemo(
    () => searchBank(courses, query, { courseId: scopeAll ? null : course.id, school, heat }),
    [query, scopeAll, course.id, school, heat],
  );
  /** 收藏是本地过滤，不参与检索打分 */
  const hits = useMemo(
    () => (favOnly ? result.hits.filter((h) => state.favs[h.q.id]) : result.hits),
    [result.hits, favOnly, state.favs],
  );
  const searching = result.active;
  const shown = hits.slice(0, limit);
  const searchable = scopeAll
    ? courses.reduce((n, c) => n + c.questions.length, 0)
    : course.questions.length;
  const favCount = Object.keys(state.favs).length;

  /** 分面：学校（按 source 聚合）与考频。垂直领域的检索先选学校，再选科目，最后选考频。 */
  const schoolOptions = useMemo(() => {
    const map = new Map<string, { school: string; tag: string; questions: number }>();
    courses.forEach((c) => {
      const prev = map.get(c.source.school);
      map.set(c.source.school, {
        school: c.source.school,
        tag: prev?.tag ?? c.source.tag,
        questions: (prev?.questions ?? 0) + c.questions.length,
      });
    });
    return [...map.values()];
  }, []);

  const HEATS: { v: 1 | 2 | 3; label: string }[] = [
    { v: 3, label: '高频' },
    { v: 2, label: '常考' },
    { v: 1, label: '了解' },
  ];

  const changeSchool = (v: string | null) => {
    setSchool(v);
    // 选了别的学校，「本课程」范围会直接筛空，自动切到全部课
    if (v && v !== course.source.school) setScopeAll(true);
    setLimit(PAGE);
    setOpenKey(null);
  };
  const changeHeat = (v: 1 | 2 | 3 | null) => {
    setHeat(v);
    setLimit(PAGE);
    setOpenKey(null);
  };
  const changeFavOnly = (v: boolean) => {
    setFavOnly(v);
    setLimit(PAGE);
    setOpenKey(null);
  };

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

  // 键盘：1 聚焦课程检索、2 聚焦关键词检索，Esc 清空当前框
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

      if (!typing && (e.key === '1' || e.key === '2')) {
        e.preventDefault();
        (e.key === '1' ? courseRef : inputRef).current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (document.activeElement === courseRef.current) {
          setCourseQuery('');
          courseRef.current?.blur();
        } else if (document.activeElement === inputRef.current) {
          setQuery('');
          setLimit(PAGE);
          setOpenKey(null);
          inputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hot = plan.order.slice(0, 6).map((o) => o.kp.name);

  return (
    <div className="col">
      <div className="topline bank-top">
        <div>
          <h1>题库</h1>
          <div className="sub">
            {course.name} · {course.kps.length} 个考点 · {course.questions.length} 题 · 资料：
            <b className={course.source.local ? 'src-local' : ''}>{course.source.tag}</b>
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

      {course.materials && course.materials.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">📄</span>资料原稿（可下载）
            </div>
            <span className="card-note">
              出处：{course.source.school} · {course.source.basis}
            </span>
          </div>
          <div className="mat-list">
            {course.materials.map((m) => (
              <div className="mat-row" key={m.id}>
                <span className={`mat-kind ${m.kind}`}>{KIND_LABEL[m.kind]}</span>
                <div className="mat-main">
                  <div className="mat-title">
                    {m.title}
                    <span className="muted">
                      {' '}
                      · {m.size}
                      {m.pages ? ` · ${m.pages} 页` : ''}
                    </span>
                  </div>
                  {m.note && <div className="mat-note">{m.note}</div>}
                </div>
                <div className="mat-actions">
                  <a className="btn btn-sm" href={`./${m.file}`} target="_blank" rel="noreferrer">
                    看原稿
                  </a>
                  <a className="btn btn-sm btn-primary" href={`./${m.file}`} download>
                    下载
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div className="notice" style={{ marginTop: 10 }}>
            原卷、答案、课件都在这里，题目是从这些原件里长出来的——不是「网传回忆版」。
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="ico">🎓</span>课程检索
          </div>
          <span className="card-note">
            {courses.length} 门课 · 课名 / 简称 / 考点 / 章节都能找 · 按 1 聚焦
          </span>
        </div>

        <div className="search-bar">
          <span className="search-ico" aria-hidden="true">
            🎓
          </span>
          <input
            ref={courseRef}
            type="search"
            value={courseQuery}
            onChange={(e) => setCourseQuery(e.target.value)}
            placeholder="找课程：课名、简称，或者任意考点（例：线代 / 二叉树）"
            aria-label="检索课程"
          />
          {courseQuery && (
            <button
              className="search-clear"
              onClick={() => {
                setCourseQuery('');
                courseRef.current?.focus();
              }}
            >
              清除
            </button>
          )}
        </div>

        {!courseSearching && (
          <div className="search-hint">
            <span className="muted">课程多了不用翻：</span>
            {courses.slice(0, 4).map((c) => (
              <button key={c.id} className="kw" onClick={() => setCourseQuery(c.short)}>
                {c.short}
              </button>
            ))}
            <span className="muted">…直接搜课名或考点名</span>
          </div>
        )}

        {courseSearching && courseResult.hits.length === 0 && (
          <div className="empty" style={{ padding: '20px 0 6px' }}>
            <div className="empty-title">没有匹配的课程</div>
            <div className="empty-text">
              换个说法试试（课名 / 简称 / 考点名都行），或者去下面的「其他课程」里翻。
            </div>
          </div>
        )}

        {courseResult.hits.length > 0 && (
          <div className="course-hits">
            {courseResult.hits.map((h) => (
              <button
                key={h.course.id}
                className={`course-hit ${h.course.id === course.id ? 'on' : ''}`}
                onClick={() => {
                  onSwitchCourse(h.course.id);
                  setCourseQuery('');
                }}
              >
                <span className="course-dot" style={{ background: h.course.color }}>
                  {h.course.name.slice(0, 1)}
                </span>
                <span className="course-hit-main">
                  <span className="course-hit-name">
                    <Marked text={h.course.name} tokens={courseResult.tokens} />
                    {h.course.short !== h.course.name && <em>{h.course.short}</em>}
                  </span>
                  <span className="course-hit-meta">
                    {h.course.kps.length} 考点 · {h.course.questions.length} 题 ·{' '}
                    <span className={h.course.source.local ? 'src-local' : ''}>
                      {h.course.source.tag}
                    </span>
                    {h.course.id === course.id ? ' · 当前课程' : ''}
                  </span>
                  {h.matchedKps.length > 0 && (
                    <span className="course-hit-kps">
                      相关考点：
                      {h.matchedKps
                        .slice(0, 4)
                        .map((k) => k.name)
                        .join(' / ')}
                      {h.matchedKps.length > 4 ? ` 等 ${h.matchedKps.length} 个` : ''}
                    </span>
                  )}
                </span>
                <span className="course-hit-go">
                  {h.course.id === course.id ? '在用' : '进入 →'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="ico">🔍</span>关键词检索
          </div>
          <span className="card-note">题干 / 选项 / 讲解 / 考点，一处搜全套 · 按 2 聚焦</span>
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
            placeholder="搜题干、选项或讲解…（多个词用空格隔开）"
            aria-label="关键词检索题库"
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
            {searching ? `${hits.length} 条命中` : `${searchable} 题可搜`}
          </span>
        </div>

        {/* 垂直领域的三级分面：学校 → 考频 → 收藏，叠在搜索框上逐级收窄 */}
        <div className="facet-bar">
          <div className="facet-group">
            <span className="facet-label">学校</span>
            <button
              className={`facet ${school === null ? 'on' : ''}`}
              onClick={() => changeSchool(null)}
            >
              全部
            </button>
            {schoolOptions.map((s) => (
              <button
                key={s.school}
                className={`facet ${school === s.school ? 'on' : ''}`}
                onClick={() => changeSchool(school === s.school ? null : s.school)}
              >
                {s.tag}
                <em>{s.questions}</em>
              </button>
            ))}
          </div>
          <div className="facet-group">
            <span className="facet-label">考频</span>
            <button className={`facet ${heat === null ? 'on' : ''}`} onClick={() => changeHeat(null)}>
              全部
            </button>
            {HEATS.map((h) => (
              <button
                key={h.v}
                className={`facet ${heat === h.v ? 'on' : ''}`}
                onClick={() => changeHeat(heat === h.v ? null : h.v)}
              >
                {h.label}
              </button>
            ))}
          </div>
          <div className="facet-group">
            <button
              className={`facet fav ${favOnly ? 'on' : ''}`}
              onClick={() => changeFavOnly(!favOnly)}
              aria-pressed={favOnly}
            >
              ♥ 收藏
              <em>{favCount}</em>
            </button>
          </div>
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

        {searching && hits.length === 0 && (
          <div className="empty" style={{ padding: '24px 0 8px' }}>
            <div className="empty-emoji">🔎</div>
            <div className="empty-title">
              {query.trim() ? `没搜到「${query.trim()}」` : '这个筛选组合下没有题'}
            </div>
            <div className="empty-text">
              {favOnly
                ? '收藏夹还是空的：在题目右侧点 ♡ 就能收进来，考前只看收藏。'
                : `换成更短的关键词，或者把上面的「学校 / 考频」放宽；跨课程记得切到「全部 ${courses.length} 门课」。`}
            </div>
          </div>
        )}

        {shown.length > 0 && (
          <div className="sr-list">
            {shown.map((hit) => {
              const open = openKey === hit.key;
              const wrong = state.mistakes[hit.q.id] ?? 0;
              const sameCourse = hit.course.id === course.id;
              const fav = Boolean(state.favs[hit.q.id]);
              return (
                <div className={`sr-item ${open ? 'on' : ''}`} key={hit.key}>
                  <div className="sr-row">
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
                          <span className={`sr-src ${hit.course.source.local ? 'local' : ''}`}>
                            {hit.course.source.tag}
                          </span>
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
                    </button>
                    <div className="sr-side">
                      <button
                        className={`fav-btn ${fav ? 'on' : ''}`}
                        aria-label={fav ? '取消收藏' : '收藏这道题'}
                        aria-pressed={fav}
                        title={fav ? '取消收藏' : '收藏（爱心）'}
                        onClick={() => dispatch({ type: 'fav', qid: hit.q.id, on: !fav })}
                      >
                        {fav ? '♥' : '♡'}
                      </button>
                      <button
                        className="sr-toggle"
                        onClick={() => setOpenKey(open ? null : hit.key)}
                      >
                        {open ? '收起' : '看答案'}
                      </button>
                    </div>
                  </div>

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

        {hits.length > shown.length && (
          <button
            className="btn btn-wide"
            style={{ marginTop: 10 }}
            onClick={() => setLimit((n) => n + PAGE)}
          >
            再看 {Math.min(PAGE, hits.length - shown.length)} 条（还有 {hits.length - shown.length}{' '}
            条）
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
                {c.kps.length} 考点 · {c.questions.length} 题 ·{' '}
                <span className={c.source.local ? 'src-local' : ''}>{c.source.tag}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
