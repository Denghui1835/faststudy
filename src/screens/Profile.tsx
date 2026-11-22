import { useState } from 'react';
import type { Course } from '../data/types';
import { BASIS_LABEL, MODE_META, overallMastery, rankOf, type Plan } from '../lib/plan';
import { mistakeCount, useStore } from '../store';

export default function Profile({
  course,
  plan,
  onRetake,
  onSwitchCourse,
}: {
  course: Course;
  plan: Plan;
  onRetake: () => void;
  onSwitchCourse: () => void;
}) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(state.settings.baseUrl || 'https://api.deepseek.com/v1');
  const [apiKey, setApiKey] = useState(state.settings.apiKey);
  const [model, setModel] = useState(state.settings.model || 'deepseek-chat');
  const [saved, setSaved] = useState(false);

  const accuracy = state.total.quiz ? state.total.correct / state.total.quiz : 0;
  const rank = rankOf(state.total.quiz, accuracy);
  const mastery = overallMastery(plan.order);
  const exam = state.exam!;

  return (
    <div className="col">
      <div className="topline">
        <div>
          <h1>我的</h1>
          <div className="sub">冲刺档案 · 模型配置 · 关于</div>
        </div>
        <div className="top-actions">
          <span className="pill">{course.short}</span>
          <span className="pill green">{rank.name}</span>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🎓</span>冲刺档案
            </div>
            <span className="card-note">目标 {exam.target} 分</span>
          </div>
          <div className="rank-card">
            <div className="rank-name">{rank.name}</div>
            <div className="rank-sub">{rank.next}</div>
            <div className="bar" style={{ marginTop: 14, background: 'rgba(255,255,255,.18)' }}>
              <i style={{ width: `${Math.min(100, Math.round(mastery * 100))}%`, background: 'linear-gradient(90deg,#f2a33c,#ffd08a)' }} />
            </div>
            <div className="rank-sub" style={{ marginTop: 8 }}>
              整门课掌握度 {Math.round(mastery * 100)}% · 预估分 {plan.forecast}
            </div>
          </div>
          <div className="divider" />
          <div className="row-meta" style={{ gap: 16, fontSize: 12 }}>
            <span>科目：<b>{course.name}</b></span>
            <span>距考：<b>{plan.days} 天</b></span>
            <span>基础：<b>{BASIS_LABEL[exam.basis]}</b></span>
            <span>策略：<b style={{ color: '#3b6bf5' }}>{MODE_META[plan.mode].label}</b></span>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <button className="btn btn-sm" onClick={onSwitchCourse}>
              换科目
            </button>
            <button className="btn btn-sm" onClick={onRetake}>
              改天数 / 目标分
            </button>
            <button
              className="btn btn-sm"
              style={{ color: '#e04b4b' }}
              onClick={() => {
                if (window.confirm('清空所有刷题记录并回到引导页？')) dispatch({ type: 'reset' });
              }}
            >
              清空数据
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="ico">🤖</span>接上你自己的大模型
            </div>
            <button className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
              {open ? '收起' : '配置'}
            </button>
          </div>
          <div className="card-note">
            可选。配了就用你自己的额度讲题；不配也能用本地讲解引擎，完全离线。
          </div>
          <div className="notice" style={{ marginTop: 12 }}>
            Key 只存在浏览器 localStorage，不上传任何服务器——这就是「算力自带」。
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
                className="btn btn-primary btn-wide"
                style={{ marginTop: 14 }}
                onClick={() => {
                  dispatch({ type: 'settings', settings: { baseUrl, apiKey, model } });
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 1600);
                }}
              >
                {saved ? '已保存' : '保存配置'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>
            <span className="ico">📦</span>数据
          </div>
          <div className="row-meta" style={{ fontSize: 12 }}>
            <span>刷题 {state.total.quiz} 题</span>
            <span>错题 {mistakeCount(state)} 道</span>
            <span>连刷 {state.streak.count} 天</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>
            <span className="ico">🧩</span>版本
          </div>
          <div className="row-meta" style={{ fontSize: 12 }}>
            <span>v0.1 · H5</span>
            <span>React 19 + Vite</span>
            <span>纯静态</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>
            <span className="ico">🏆</span>参赛
          </div>
          <div className="row-meta" style={{ fontSize: 12 }}>
            <span>农客松 AgriHackathon 2026</span>
            <span>主赛道「人类与学习」</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span className="ico">💡</span>关于 FastStudy
        </div>
        <div className="card-note" style={{ marginTop: 6, lineHeight: 1.8 }}>
          v0.1 ｜ 平时欠的知识，期末一起还。
          <br />
          面向「只剩几天、课还没学会」的学生：14 天以上系统重建，4–13 天定点爆破，3 天以内保命模式。
          题库与策略引擎与渲染解耦，已为微信小程序预留迁移路径。
        </div>
      </div>
    </div>
  );
}
