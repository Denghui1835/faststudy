import { useState } from 'react';
import type { Course } from '../data/types';
import { overallMastery, rankOf, type Plan } from '../lib/plan';
import { useStore } from '../store';

export default function Profile({ course, plan, onRetake }: { course: Course; plan: Plan; onRetake: () => void }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(state.settings.baseUrl || 'https://api.deepseek.com/v1');
  const [apiKey, setApiKey] = useState(state.settings.apiKey);
  const [model, setModel] = useState(state.settings.model || 'deepseek-chat');
  const [saved, setSaved] = useState(false);

  const accuracy = state.total.quiz ? state.total.correct / state.total.quiz : 0;
  const rank = rankOf(state.total.quiz, accuracy);
  const mastery = overallMastery(plan.order);
  const minutes = Math.round(state.total.seconds / 60);
  const barW = Math.min(100, Math.round((mastery + (state.total.quiz > 0 ? 0.1 : 0)) * 100));

  return (
    <>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="between">
          <div>
            <div className="card-title" style={{ fontSize: 19 }}>
              冲刺档案
            </div>
            <div className="card-note" style={{ marginTop: 3 }}>
              {course.name} · 目标 {state.exam?.target ?? 80} 分
            </div>
          </div>
          <div className="hero-tag" style={{ background: 'var(--ink)', color: '#fff' }}>
            {rank.name}
          </div>
        </div>

        <div className="divider" />

        <div className="between" style={{ marginBottom: 6 }}>
          <div className="card-note">整门课掌握度</div>
          <b style={{ fontSize: 13 }}>{Math.round(mastery * 100)}%</b>
        </div>
        <div className="meter" style={{ width: '100%', height: 7 }}>
          <i style={{ width: `${barW}%` }} />
        </div>
        <div className="card-note" style={{ marginTop: 8 }}>
          {rank.next}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <b>{state.total.quiz}</b>
          <span>累计刷题</span>
        </div>
        <div className="stat">
          <b>{Math.round(accuracy * 100)}%</b>
          <span>总正确率</span>
        </div>
        <div className="stat">
          <b>{minutes}</b>
          <span>专注分钟</span>
        </div>
        <div className="stat">
          <b>{state.streak.count}</b>
          <span>连续天数</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">考点掌握明细</div>
          <div className="card-note">按考频加权</div>
        </div>
        {plan.order.map((o) => (
          <div className="kprow" key={o.kp.id}>
            <div className={`kp-index ${o.mastery < 0.5 && o.seen > 0 ? 'hot' : ''}`}>
              {o.seen === 0 ? '—' : `${Math.round(o.mastery * 100)}`}
            </div>
            <div className="kp-main">
              <div className="kp-name">{o.kp.name}</div>
              <div className="kp-meta">
                <span className={`heat ${o.kp.heat === 2 ? 'mid' : o.kp.heat === 1 ? 'low' : ''}`}>
                  {o.kp.heat === 3 ? '高频' : o.kp.heat === 2 ? '常考' : '了解'}
                </span>
                <span>{o.seen === 0 ? '还没测过' : `做过 ${o.seen} 题`}</span>
              </div>
            </div>
            <div className="meter">
              <i style={{ width: `${Math.round(o.mastery * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="between">
          <div>
            <div className="card-title">🤖 接上你自己的大模型</div>
            <div className="card-note" style={{ marginTop: 3 }}>
              可选。配了就用你的额度讲题，不配也能用本地讲解
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? '收起' : '配置'}
          </button>
        </div>

        {open && (
          <div style={{ marginTop: 14 }}>
            <div className="field-label">接口地址</div>
            <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" />
            <div className="field-label">API Key</div>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
            <div className="field-label">模型名</div>
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" />
            <button
              className="btn btn-primary"
              style={{ marginTop: 14 }}
              onClick={() => {
                dispatch({ type: 'settings', settings: { baseUrl, apiKey, model } });
                setSaved(true);
                window.setTimeout(() => setSaved(false), 1600);
              }}
            >
              {saved ? '已保存（只存在你本机）' : '保存配置'}
            </button>
            <div className="card-note" style={{ marginTop: 8 }}>
              Key 只保存在浏览器 localStorage，不上传任何服务器——这也是「算力自带」的意思。
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">关于 FastStudy</div>
        <div className="card-note" style={{ marginTop: 6, lineHeight: 1.7 }}>
          v0.1 ｜ 平时欠的知识，期末一起还。
          <br />
          面向「只剩几天、课还没学会」的学生，用考试倒计时决定教学策略：14 天以上系统重建，4–13 天定点爆破，3 天以内保命模式。
        </div>
        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="link" onClick={onRetake}>
            换科目 / 重设天数
          </button>
          <button
            className="link"
            style={{ color: 'var(--bad)' }}
            onClick={() => {
              if (window.confirm('清空所有刷题记录并回到引导页？')) dispatch({ type: 'reset' });
            }}
          >
            清空数据
          </button>
        </div>
      </div>

      <div className="foot-note">
        FastStudy · 农客松参赛作品
        <br />
        H5 优先，架构上为微信小程序留了适配位置
      </div>
    </>
  );
}
