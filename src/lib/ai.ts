import type { Course, Question } from '../data/types';

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface SessionItem {
  qid: string;
  kp: string;
  correct: boolean;
  picked: number[];
  seconds: number;
}

/**
 * 引导式讲解：先给「怎么想」，绝不先给答案。
 * 这是 FastStudy 和普通题库最大的区别：不会的题先被拉一把，再让你自己选。
 */
export function guideSteps(q: Question, kpName: string, heat: 1 | 2 | 3): string[] {
  const heatText = heat === 3 ? '老师年年考，属于必拿分' : heat === 2 ? '常考，值得花 5 分钟' : '偶尔出现，别在这里卡太久';
  return [
    `这题考的是「${kpName}」——${heatText}。`,
    q.explain.what,
    `先别急着选：把每个选项往「${kpName}」的定义上套一遍，凡是偷换概念的都先划掉。`,
  ];
}

/** 一组题做完的「AI 诊断」，规则引擎生成，无需联网 */
export function diagnose(items: SessionItem[], course: Course): { title: string; lines: string[]; action: string } {
  const total = items.length;
  const correct = items.filter((i) => i.correct).length;
  const acc = total ? correct / total : 0;

  const byKp = new Map<string, { right: number; all: number }>();
  items.forEach((i) => {
    const cur = byKp.get(i.kp) ?? { right: 0, all: 0 };
    cur.all += 1;
    if (i.correct) cur.right += 1;
    byKp.set(i.kp, cur);
  });
  const worst = [...byKp.entries()]
    .map(([kpId, v]) => ({ kpId, rate: v.all ? v.right / v.all : 0, all: v.all }))
    .sort((a, b) => a.rate - b.rate)[0];
  const worstName = worst ? (course.kps.find((k) => k.id === worst.kpId)?.name ?? '本组考点') : '本组考点';

  const lines: string[] = [];
  lines.push(`本组 ${total} 题，对 ${correct} 题（${Math.round(acc * 100)}%），平均每题 ${Math.round(items.reduce((n, i) => n + i.seconds, 0) / Math.max(1, total))} 秒。`);

  if (acc >= 0.85) {
    lines.push(`「${worstName}」是全组最弱的一项，但也在及格线上——说明这一块可以开始抬难度了。`);
  } else if (acc >= 0.6) {
    lines.push(`最弱的是「${worstName}」，这恰恰是高频考点，下一组建议连着刷它，别换主题。`);
  } else {
    lines.push(`正确率还没到 60%，问题不在手速而在概念：「${worstName}」的定义还没立住。`);
  }

  if (items.some((i) => i.seconds < 5 && !i.correct)) {
    lines.push('有几道题 5 秒内就选错了——这不是不会，是看题太快，把「不正确」看成了「正确」。');
  }

  const action =
    acc >= 0.85
      ? '去看下一个考点，别在已经会的题上打转。'
      : acc >= 0.6
        ? `把「${worstName}」的讲解重看一遍，然后原地重做错的那几道。`
        : `先停下刷题，把「${worstName}」的 3 条结论抄一遍再回来。`;

  return {
    title: acc >= 0.85 ? '这一块稳了' : acc >= 0.6 ? '有基础，还差一口气' : '先止损，再提分',
    lines,
    action,
  };
}

/** 可选：接上自己的大模型接口后，让 AI 用一句话讲透这题 */
export async function askLLM(
  settings: AiSettings,
  question: Question,
  kpName: string,
  picked: number[],
): Promise<string> {
  const base = settings.baseUrl.replace(/\/+$/, '');
  if (!base || !settings.apiKey) throw new Error('还没有配置模型接口');

  const pickedText = picked.map((i) => question.options[i]).join('、') || '（未作答）';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || 'deepseek-chat',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            '你是大学生期末冲刺辅导老师。回答控制在 120 字以内，用「你错在……」开头，先说错因再给一句能背下来的结论，不要重复题目原文。',
        },
        {
          role: 'user',
          content: `考点：${kpName}\n题目：${question.stem}\n选项：${question.options.join(' / ')}\n学生选：${pickedText}\n正确答案：${question.answer
            .map((i) => question.options[i])
            .join('、')}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`模型接口返回 ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || '模型没有返回内容';
}
