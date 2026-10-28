export const LEVEL_LABELS = {
  textbook_confirmed: "教材已核验",
  reference_confirmed: "公开参考支持",
  textbook_pending: "教材页码待核验",
  contested: "教材存在分歧",
  model_assumption: "模型教学假设",
  unverified: "尚未核验",
};

export const CATEGORIES = [
  { name: "解剖结构", itemStyle: { color: "#176b59" } },
  { name: "模型肌束", itemStyle: { color: "#0c8c83" } },
  { name: "功能与解剖结论", itemStyle: { color: "#e58b35" } },
  { name: "力学变量", itemStyle: { color: "#6f6bc2" } },
  { name: "教材出处", itemStyle: { color: "#b23a4d" } },
  { name: "证据等级", itemStyle: { color: "#9a7517" } },
];

export function buildGraph({ muscles, evidence, sourceCatalog }) {
  const nodes = [],
    edges = [],
    books = new Set();
  const sourceMap = new Map(sourceCatalog.sources.map((s) => [s.id, s]));
  const groups = [...new Set(muscles.map((m) => m.group))].sort();
  const node = (id, name, category, extra = {}) => {
    nodes.push({
      id,
      name,
      category,
      categoryName: CATEGORIES[category].name,
      symbolSize: category === 0 ? 44 : 23,
      label: {
        show: true,
        fontSize: category === 0 ? 13 : 10,
        color: "#38544b",
        position: "right",
        width: 160,
        overflow: "truncate",
      },
      ...extra,
    });
    return id;
  };
  const edge = (source, target, relation, extra = {}) =>
    edges.push({
      source,
      target,
      relation,
      lineStyle: { color: "#bacfc1", opacity: 0.7, curveness: 0.08 },
      ...extra,
    });
  for (const group of groups) {
    const groupId = node(`group:${group}`, group, 0, {
      groupName: group,
      desc: "肌群层级的教材与模型索引；模型几何须独立核验。",
    });
    for (const muscle of muscles.filter((m) => m.group === group)) {
      const id = node(
        `muscle:${muscle.name}`,
        `${muscle.code} ${muscle.label}`,
        1,
        {
          groupName: group,
          muscleId: muscle.id,
          desc: "模型执行器分束，可定位 Atlas 或查看回放曲线。",
        },
      );
      edge(groupId, id, "对应模型执行器", {
        scope: "模型映射，不表示独立解剖肌肉",
      });
    }
    const mech = node(`mech:${group}`, `${group} · 模型输出`, 3, {
      groupName: group,
      desc: "路径长度、带符号执行器力、力矩贡献与兴奋/激活；执行器力不等于牙齿咬合力。",
    });
    edge(groupId, mech, "关联模型输出", {
      scope: "模型定义，不是教材生理验证",
    });
    for (const [i, claim] of (evidence.groups[group]?.claims || []).entries()) {
      const claimId = node(`claim:${group}:${i}`, claim.statement, 2, {
        groupName: group,
        desc: `适用范围：${group}。该结论不自动验证某侧、某分束或网格附着点。`,
        citations: claim.citations || [],
        supportLevel: claim.support_level || "unverified",
      });
      edge(groupId, claimId, "相关结论", {
        scope: group,
        citations: claim.citations || [],
      });
      for (const citation of claim.citations || []) {
        const source = sourceMap.get(citation.source_id);
        const bookId = `book:${citation.source_id}`;
        if (!books.has(bookId)) {
          books.add(bookId);
          node(bookId, source?.title || citation.source_id, 4, {
            url: source?.url || null,
            desc: `${source?.title || citation.source_id} · ${source?.edition || ""}`,
          });
        }
        edge(claimId, bookId, "引用", {
          citations: [citation],
          scope: claim.statement,
        });
      }
      const level = claim.support_level || "unverified";
      const evidenceId = node(
        `evidence:${group}:${i}`,
        LEVEL_LABELS[level] || level,
        5,
        {
          groupName: group,
          desc: claim.statement,
          citations: claim.citations || [],
          supportLevel: level,
        },
      );
      edge(claimId, evidenceId, "核验状态", {
        scope: claim.statement,
        supportLevel: level,
      });
    }
  }
  return { nodes, edges };
}
