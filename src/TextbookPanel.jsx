import React from 'react';

const evidenceLabels = {
  textbook_confirmed: '教材已核验',
  reference_confirmed: '公开参考资料',
  pending: '待课程核验',
  model_simplification: '模型简化'
};

export default function TextbookPanel({ muscle, textbook, phase }) {
  if (!muscle || !textbook) return null;

  const entry = textbook.muscles?.[muscle.name] || {};
  const group = textbook.groups?.[entry.group || muscle.group] || {};
  const book = textbook.book || {};
  const status = entry.textbook_status === 'pending'
    ? 'pending'
    : entry.textbook_status === 'textbook_confirmed'
      ? 'textbook_confirmed'
      : 'reference_confirmed';
  const citation = entry.textbook_ref
    ? `${entry.textbook_ref.chapter} · 第 ${entry.textbook_ref.page} 页`
    : book.title;

  return (
    <div className="panel knowledge teaching">
      <div className="eyebrow">结构 → 力学 → 证据</div>
      <h3>{muscle.code} {muscle.label}</h3>
      <p className="code">{muscle.name}</p>

      <div className="textbook-cite">
        <b>教材位置</b>
        <span>{citation}</span>
        {!entry.textbook_ref && (
          <span className="pending">页码待课程核验，未确认前不标为教材结论</span>
        )}
      </div>

      <div className="teaching-block">
        <b>主要功能</b>
        <div className="chip-row">
          {(group.functions || []).map((f) => <span className="chip" key={f}>{f}</span>)}
        </div>
      </div>

      {group.origin_insertion && (
        <div className="teaching-block">
          <b>起止点</b>
          <p>{group.origin_insertion}</p>
        </div>
      )}

      {phase && (
        <div className="teaching-block phase">
          <b>当前观察片段</b>
          <p>{phase.title} · {phase.question}</p>
        </div>
      )}

      <div className="teaching-block">
        <b>模型边界</b>
        <p>{group.model_note || '模型以执行器路径近似表示该结构。'}</p>
      </div>

      <div className="evidence-badge" data-level={status}>
        {evidenceLabels[status] || evidenceLabels.reference_confirmed}
      </div>

      <div className="source-list">
        <a href={textbook.sources?.mastication.url} target="_blank" rel="noreferrer">
          咀嚼肌解剖 · NCBI Bookshelf ↗
        </a>
        <a href={textbook.sources?.stomatognathic.url} target="_blank" rel="noreferrer">
          口颌系统解剖与功能 · NCBI Bookshelf ↗
        </a>
        <a href={textbook.sources?.terminology.url} target="_blank" rel="noreferrer">
          解剖方位术语 · OpenStax ↗
        </a>
      </div>
    </div>
  );
}
