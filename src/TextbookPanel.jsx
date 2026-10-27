import React from 'react';

const supportLabels = {
  textbook_confirmed: '教材已核验',
  reference_confirmed: '公开参考支持',
  textbook_pending: '教材页码待核验',
  contested: '教材存在分歧',
  model_assumption: '模型教学假设',
  unverified: '尚未核验'
};

export default function TextbookPanel({
  muscle,
  textbook,
  evidence,
  sourceCatalog,
  phase,
  onSelectGroup
}) {
  if (!muscle || !textbook) return null;

  const entry = textbook.muscles?.[muscle.name] || {};
  const group = textbook.groups?.[entry.group || muscle.group] || {};
  const groupEvidence = evidence?.groups?.[entry.group || muscle.group] || {};
  const sourceMap = new Map(
    (sourceCatalog?.sources || []).map((source) => [source.id, source])
  );
  const sourceIds = groupEvidence.source_ids || [];
  const supportLevel = groupEvidence.support_level || 'unverified';
  const textbookStatus = groupEvidence.textbook_status || 'textbook_pending';
  const citation = entry.textbook_ref
    ? `${entry.textbook_ref.chapter} · 第 ${entry.textbook_ref.page} 页`
    : '具体教材章节与页码待核验';

  return (
    <div className="panel knowledge teaching">
      <div className="eyebrow">结构 → 力学 → 教材证据</div>
      <h3>{muscle.code} {muscle.label}</h3>
      <p className="code">{muscle.name}</p>

      <div className="evidence-row">
        <span className="evidence-badge" data-level={supportLevel}>
          {supportLabels[supportLevel] || supportLabels.unverified}
        </span>
        <span className="evidence-badge" data-level={textbookStatus}>
          {supportLabels[textbookStatus] || '教材待核验'}
        </span>
      </div>

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

      {groupEvidence.claims?.length > 0 && (
        <div className="teaching-block">
          <b>待核对结论</b>
          <ul className="claim-list">
            {groupEvidence.claims.map((claim) => (
              <li key={claim.statement}>
                <span>{claim.statement}</span>
                <small>{supportLabels[claim.support_level] || claim.support_level}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groupEvidence.related_groups?.length > 0 && (
        <div className="teaching-block">
          <b>相关知识</b>
          <div className="chip-row">
            {groupEvidence.related_groups.map((name) => (
              <button className="chip chip-button" key={name} onClick={() => onSelectGroup?.(name)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="teaching-block">
        <b>模型边界</b>
        <p>{group.model_note || '模型以执行器路径近似表示该结构。'}</p>
      </div>

      {sourceIds.length > 0 && (
        <div className="teaching-block">
          <b>优先核对教材</b>
          <div className="source-cards">
            {sourceIds.map((id) => {
              const source = sourceMap.get(id);
              if (!source) return null;
              return (
                <a className="source-card" key={id} href={source.url || undefined} target="_blank" rel="noreferrer">
                  <strong>{source.title}</strong>
                  <span>{source.edition} · {source.publisher}</span>
                  <small>{source.use.join(' / ')}</small>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="source-list">
        <a href={textbook.sources?.mastication.url} target="_blank" rel="noreferrer">咀嚼肌解剖 · NCBI Bookshelf ↗</a>
        <a href={textbook.sources?.stomatognathic.url} target="_blank" rel="noreferrer">口颌系统解剖与功能 · NCBI Bookshelf ↗</a>
        <a href={textbook.sources?.terminology.url} target="_blank" rel="noreferrer">解剖方位术语 · OpenStax ↗</a>
      </div>
    </div>
  );
}
