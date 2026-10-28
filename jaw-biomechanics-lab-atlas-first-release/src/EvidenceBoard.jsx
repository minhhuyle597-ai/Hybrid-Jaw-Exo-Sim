import React from 'react';

const labels = {
  textbook_confirmed: '教材已核验',
  reference_confirmed: '公开参考支持',
  textbook_pending: '教材页码待核验',
  contested: '存在分歧',
  model_assumption: '模型假设',
  unverified: '尚未核验'
};

const priorityLabels = {
  core: '核心必读',
  method: '方法支撑',
  extended: '延伸专题'
};

export default function EvidenceBoard({ evidence, sourceCatalog, onSelectGroup }) {
  if (!evidence) return null;
  const sources = sourceCatalog?.sources || [];
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const groups = Object.entries(evidence.groups || {});

  return (
    <section className="panel evidence-board">
      <div className="panel-title">
        <h2>教材与模型证据总表</h2>
        <span>3Dentes 式证据记录</span>
      </div>
      <details>
        <summary>展开 10 本教材、结构结论和核验状态</summary>

        <div className="source-groups">
          {['core', 'method', 'extended'].map((priority) => {
            const items = sources.filter((source) => source.priority === priority);
            return (
              <div className="source-group" key={priority}>
                <h3>{priorityLabels[priority]}</h3>
                <div className="source-card-grid">
                  {items.map((source) => (
                    <a className="source-card" key={source.id} href={source.url || undefined} target="_blank" rel="noreferrer">
                      <strong>{source.title}</strong>
                      <span>{source.edition} · {source.year || '版次待补'}</span>
                      <small>{source.authors}</small>
                      <small>{source.use.join(' / ')}</small>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="table-wrap evidence-table-wrap">
          <table>
            <thead>
              <tr>
                <th>模型结构</th>
                <th>待核对结论</th>
                <th>证据状态</th>
                <th>教材状态</th>
                <th>教材页码</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([groupName, group]) => (
                <React.Fragment key={groupName}>
                  {(group.claims || []).map((claim) => (
                    <tr key={`${groupName}-${claim.statement}`}>
                      <td>
                        <button className="link-button" onClick={() => onSelectGroup?.(groupName)}>
                          {groupName}
                        </button>
                      </td>
                      <td>{claim.statement}</td>
                      <td><span className="evidence-badge" data-level={claim.support_level}>{labels[claim.support_level] || claim.support_level}</span></td>
                      <td>{labels[group.textbook_status] || group.textbook_status}</td>
                      <td>
                        {(claim.citations || []).length > 0
                          ? claim.citations.map((citation) => {
                            const source = sourceMap.get(citation.source_id);
                            return `${source?.title || citation.source_id} · ${citation.pages}`;
                          }).join('；')
                          : '模型定义'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {evidence.model_boundaries?.length > 0 && (
          <div className="boundary-list">
            <h3>模型边界</h3>
            {evidence.model_boundaries.map((item) => <p key={item}>{item}</p>)}
          </div>
        )}
      </details>
    </section>
  );
}
