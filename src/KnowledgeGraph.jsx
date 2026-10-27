import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as echarts from 'echarts';
import './graph.css';

const LEVEL_LABELS = {
  textbook_confirmed: '教材已核验',
  reference_confirmed: '公开参考支持',
  textbook_pending: '教材页码待核验',
  contested: '教材存在分歧',
  model_assumption: '模型教学假设',
  unverified: '尚未核验'
};

const CATEGORIES = [
  {name: '解剖结构', itemStyle: {color: '#176b59'}},
  {name: '模型肌束', itemStyle: {color: '#0c8c83'}},
  {name: '功能动作', itemStyle: {color: '#e58b35'}},
  {name: '力学变量', itemStyle: {color: '#6f6bc2'}},
  {name: '教材出处', itemStyle: {color: '#b23a4d'}},
  {name: '证据等级', itemStyle: {color: '#9a7517'}}
];

const CAT_INDEX = Object.fromEntries(CATEGORIES.map((c, i) => [c.name, i]));

const MECHANICS = ['路径长度', '执行器力', '力矩贡献', '兴奋 / 激活'];

const shortSource = (id) => {
  if (id === 'oral_anatomy_8e') return '口腔解剖生理学·第8版';
  if (id === 'occlusion_4e') return '牙合学·第4版';
  if (id === 'okeson_zh_8e') return 'Okeson 中文版·第8版';
  if (id === 'okeson_en_9e') return 'Okeson 第9版';
  if (id === 'oral_biomechanics_yu') return '口腔生物力学·于海洋';
  if (id === 'oral_biomechanics_chen') return '口腔生物力学·陈新民';
  return id;
};

function buildGraph({muscles, textbook, evidence, sourceCatalog, phases}) {
  const nodes = [];
  const edges = [];
  const sourceMap = new Map((sourceCatalog?.sources || []).map((s) => [s.id, s]));
  const groupNames = [...new Set(muscles.map((m) => m.group))].sort();

  const node = (id, name, categoryName, extra = {}) => {
    const base = {
      id,
      name,
      category: CAT_INDEX[categoryName],
      categoryName,
      symbolSize: 30,
      itemStyle: {},
      label: {show: true, fontSize: 11, color: '#38544b', position: 'right'}
    };
    nodes.push({...base, ...extra});
    return id;
  };

  const edge = (source, target, opts = {}) => {
    edges.push({source, target, lineStyle: {color: '#c4d3ca', opacity: 0.75, curveness: 0.08}, ...opts});
  };

  groupNames.forEach((groupName) => {
    const groupMuscles = muscles.filter((m) => m.group === groupName);
    const groupEvidence = evidence?.groups?.[groupName] || {};
    const groupTextbook = textbook?.groups?.[groupName] || {};
    const firstEntry = groupMuscles
      .map((m) => textbook?.muscles?.[m.name])
      .find((entry) => entry?.textbook_ref);
    const citation = firstEntry?.textbook_ref;
    const source = sourceMap.get(citation?.source_id || groupEvidence.source_ids?.[0]);
    const bookId = citation?.source_id || groupEvidence.source_ids?.[0] || 'oral_anatomy_8e';
    const book = sourceMap.get(bookId);
    const supportLevel = groupEvidence.support_level || groupTextbook.textbook_status || 'unverified';
    const functions = groupTextbook.functions || groupEvidence.claims?.map((c) => c.statement) || [];

    const gNode = node(`group:${groupName}`, groupName, '解剖结构', {
      symbolSize: 48,
      label: {show: true, fontSize: 13, fontWeight: 650, color: '#176b59', position: 'right'},
      groupName,
      desc: '点击回到该肌群的三维回放'
    });

    const muscleIds = [];
    groupMuscles.forEach((m) => {
      const mId = node(`muscle:${m.name}`, `${m.code} ${m.label}`, '模型肌束', {
        symbolSize: 20,
        label: {show: true, fontSize: 8, color: '#56736a', position: 'right'},
        muscleId: m.id,
        groupName,
        desc: '点击回到该肌肉的三维回放'
      });
      muscleIds.push(mId);
      edge(gNode, mId);
    });

    const actionIds = (functions.length ? functions : ['模型输出，功能待核验']).map((fn) => {
      const aId = node(`action:${groupName}:${fn}`, fn, '功能动作', {
        symbolSize: 26,
        label: {show: true, fontSize: 10, color: '#8a5a1d', position: 'right'},
        groupName,
        desc: '对应功能动作，点击回到相关肌肉'
      });
      edge(gNode, aId, {lineStyle: {color: '#e5c9a6', curveness: 0.18}});
      return aId;
    });

    const mechId = node(`mech:${groupName}`, MECHANICS.join('\n'), '力学变量', {
      symbolSize: 30,
      label: {show: true, fontSize: 9, color: '#4c458f', position: 'right'},
      groupName,
      desc: '回放中与该肌群同步显示的力学变量'
    });
    actionIds.forEach((aId) => edge(aId, mechId, {lineStyle: {color: '#b8b0e6', curveness: 0.1}}));

    const pages = citation?.page || (book?.coverage ? '见教材覆盖' : '待核验');
    const bookIdNode = node(`book:${groupName}`, `${shortSource(bookId)}\nP${pages}`, '教材出处', {
      symbolSize: 28,
      label: {show: true, fontSize: 10, color: '#8c2d3d', position: 'right'},
      groupName,
      url: book?.url || null,
      desc: book ? `${book.title} · ${book.edition || ''}` : '打开教材或跳回对应肌群'
    });
    edge(mechId, bookIdNode, {lineStyle: {color: '#d8aab1', curveness: 0.1}});

    const evLabel = LEVEL_LABELS[supportLevel] || supportLevel;
    node(`evidence:${groupName}`, `${groupName} · ${evLabel}`, '证据等级', {
      symbolSize: 32,
      label: {show: true, fontSize: 10, fontWeight: 600, color: '#7a5c0f', position: 'right'},
      groupName,
      desc: `证据状态：${evLabel}，点击回到对应肌群`
    });
    edge(bookIdNode, `evidence:${groupName}`, {lineStyle: {color: '#d7bf83', curveness: 0.1}});

    const related = groupEvidence.related_groups || [];
    related.forEach((name) => {
      if (groupNames.includes(name)) {
        edge(gNode, `group:${name}`, {lineStyle: {color: '#d8e0da', opacity: 0.45, type: 'dashed', curveness: 0.25}});
      }
    });
  });

  return {nodes, edges};
}

export default function KnowledgeGraph({
  muscles,
  textbook,
  evidence,
  sourceCatalog,
  phases,
  onOpenMuscle,
  onOpenGroup,
  onBack
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [active, setActive] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('全部');

  const graph = useMemo(
    () => buildGraph({muscles, textbook, evidence, sourceCatalog, phases}),
    [muscles, textbook, evidence, sourceCatalog, phases]
  );

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    chart.on('click', (params) => {
      if (params.dataType === 'edge') return;
      const d = params.data || {};
      setActive(d);
      if (d.categoryName === '教材出处' && d.url) {
        window.open(d.url, '_blank', 'noopener');
      }
      if (d.muscleId != null) onOpenMuscle?.(d.muscleId);
      else if (d.groupName) onOpenGroup?.(d.groupName);
    });

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const visibleNodes = graph.nodes
      .filter((n) => categoryFilter === '全部' || n.categoryName === categoryFilter)
      .map((n) => ({...n}));
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = graph.edges.filter(
      (e) => visibleIds.has(typeof e.source === 'string' ? e.source : e.source?.id) &&
        visibleIds.has(typeof e.target === 'string' ? e.target : e.target?.id)
    );

    chart.setOption({
      backgroundColor: '#f7f9f4',
      tooltip: {
        confine: true,
        formatter: (p) => {
          if (p.dataType === 'edge') return '';
          const d = p.data;
          return `<b>${d.name || ''}</b><br><span style="color:#64766d">${d.desc || ''}</span>`;
        }
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          data: visibleNodes,
          links: visibleEdges,
          categories: CATEGORIES,
          label: {show: true, position: 'right', color: '#38544b'},
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 6,
          emphasis: {
            focus: 'adjacency',
            lineStyle: {width: 2}
          },
          force: {
            repulsion: 280,
            gravity: 0.08,
            edgeLength: [50, 140],
            layoutAnimation: true
          }
        }
      ]
    }, true);
  }, [graph, categoryFilter]);

  const counts = useMemo(() => {
    const result = {全部: graph.nodes.length};
    CATEGORIES.forEach((c) => {
      result[c.name] = graph.nodes.filter((n) => n.categoryName === c.name).length;
    });
    return result;
  }, [graph]);

  return (
    <main className="graph-page">
      <div className="graph-intro">
        <div>
          <div className="eyebrow">KNOWLEDGE GRAPH · 口颌生物力学</div>
          <h1>从解剖结构到教材证据的探究链路</h1>
          <p>结构 → 动作 → 力学变量 → 教材章节与页码 → 证据等级。点击任意节点回到三维回放中对应的肌群或肌肉。</p>
        </div>
        <button className="primary" onClick={onBack}>← 回到 3D 回放</button>
      </div>

      <div className="graph-toolbar">
        <span>按节点类型过滤</span>
        {['全部', ...CATEGORIES.map((c) => c.name)].map((name) => (
          <button
            key={name}
            className={categoryFilter === name ? 'active' : ''}
            onClick={() => setCategoryFilter(name)}
          >
            {name} · {counts[name] || 0}
          </button>
        ))}
      </div>

      <div className="graph-layout">
        <div className="graph-canvas" ref={canvasRef} role="img" aria-label="口颌生物力学知识图谱，点击节点回到对应肌肉回放" />
        <aside className="graph-side">
          <h2>图谱说明</h2>
          <p>每条链路都从一块肌群出发：它有什么动作，回放里对应哪些力学量，出处是教材的哪一章哪一页，最后落在什么证据等级上。</p>
          <ul className="graph-legend">
            {CATEGORIES.map((c) => (
              <li key={c.name}>
                <span className="legend-dot" style={{background: c.itemStyle.color}} />
                {c.name}
              </li>
            ))}
          </ul>
          {active && (
            <div className="graph-active">
              <b>{active.name}</b>
              <small>{active.desc}</small>
            </div>
          )}
          <p className="graph-hint">拖拽节点可整理布局，滚轮缩放，鼠标悬停看说明。教材节点会打开对应来源，其余节点自动跳回回放。</p>
        </aside>
      </div>
    </main>
  );
}
