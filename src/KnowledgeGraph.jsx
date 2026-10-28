import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import "./graph.css";

import { buildGraph, CATEGORIES, LEVEL_LABELS } from "./knowledge-graph.mjs";

export default function KnowledgeGraph({
  muscles,
  textbook,
  evidence,
  sourceCatalog,
  phases,
  onOpenMuscle,
  onOpenGroup,
  onBack,
  onOpenAtlas,
  initialMuscleId,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [active, setActive] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("全部");

  const graph = useMemo(
    () => buildGraph({ muscles, textbook, evidence, sourceCatalog, phases }),
    [muscles, textbook, evidence, sourceCatalog, phases],
  );

  useEffect(() => {
    setActive(graph.nodes.find((n) => n.muscleId === initialMuscleId) || null);
  }, [graph, initialMuscleId]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    chart.on("click", (params) => {
      const d = params.data || {};
      setActive(
        params.dataType === "edge"
          ? { ...d, name: d.relation, desc: d.scope || "教学索引关系" }
          : d,
      );
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
      .filter(
        (n) => categoryFilter === "全部" || n.categoryName === categoryFilter,
      )
      .map((n) => ({ ...n }));
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = graph.edges.filter(
      (e) =>
        visibleIds.has(
          typeof e.source === "string" ? e.source : e.source?.id,
        ) &&
        visibleIds.has(typeof e.target === "string" ? e.target : e.target?.id),
    );

    chart.setOption(
      {
        backgroundColor: "#f7f9f4",
        tooltip: {
          confine: true,
          formatter: (p) => {
            const d = p.data;
            const escape = (value) =>
              String(value || "").replace(
                /[&<>"']/g,
                (c) =>
                  ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                  })[c],
              );
            return `<b>${escape(d.relation || d.name)}</b><br>${escape(d.scope || d.desc)}`;
          },
        },
        series: [
          {
            type: "graph",
            layout: "force",
            roam: true,
            draggable: true,
            data: visibleNodes,
            links: visibleEdges,
            categories: CATEGORIES,
            label: { show: true, position: "right", color: "#38544b" },
            labelLayout: { hideOverlap: true },
            edgeSymbol: ["none", "arrow"],
            edgeSymbolSize: 6,
            emphasis: {
              focus: "adjacency",
              lineStyle: { width: 2 },
            },
            force: {
              repulsion: 280,
              gravity: 0.08,
              edgeLength: [50, 140],
              layoutAnimation: true,
            },
          },
        ],
      },
      true,
    );
  }, [graph, categoryFilter]);

  const counts = useMemo(() => {
    const result = { 全部: graph.nodes.length };
    CATEGORIES.forEach((c) => {
      result[c.name] = graph.nodes.filter(
        (n) => n.categoryName === c.name,
      ).length;
    });
    return result;
  }, [graph]);

  return (
    <main className="graph-page">
      <div className="graph-intro">
        <div>
          <div className="eyebrow">KNOWLEDGE GRAPH · 口颌生物力学</div>
          <h1>从解剖结构到教材证据的探究链路</h1>
          <p>
            选择节点或关系查看逐条证据，再进入 Atlas
            或运动回放。教材结论与模型映射分别标注。
          </p>
        </div>
        <button className="primary" onClick={onBack}>
          ← 回到运动回放
        </button>
      </div>

      <div className="graph-toolbar">
        <label>
          查找节点{" "}
          <select
            aria-label="查找知识图谱节点"
            value={active?.id || ""}
            onChange={(e) =>
              setActive(graph.nodes.find((n) => n.id === e.target.value))
            }
          >
            <option value="">选择结构、结论或教材</option>
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.categoryName} · {n.name}
              </option>
            ))}
          </select>
        </label>
        <span>按节点类型过滤</span>
        {["全部", ...CATEGORIES.map((c) => c.name)].map((name) => (
          <button
            key={name}
            className={categoryFilter === name ? "active" : ""}
            onClick={() => setCategoryFilter(name)}
          >
            {name} · {counts[name] || 0}
          </button>
        ))}
      </div>

      <div className="graph-layout">
        <div
          className="graph-canvas"
          ref={canvasRef}
          role="img"
          aria-label="口颌生物力学知识图谱，点击节点或关系查看详情"
        />
        <aside className="graph-side">
          <h2>图谱说明</h2>
          <p>
            模型执行器归属、教材结论、逐条引用和核验状态分别表达。肌群结论不会自动成为模型附着点或力学量的验证。
          </p>
          <ul className="graph-legend">
            {CATEGORIES.map((c) => (
              <li key={c.name}>
                <span
                  className="legend-dot"
                  style={{ background: c.itemStyle.color }}
                />
                {c.name}
              </li>
            ))}
          </ul>
          {active && (
            <div className="graph-active">
              <b>{active.name}</b>
              <small>{active.desc}</small>
              {active.supportLevel && (
                <p>
                  {LEVEL_LABELS[active.supportLevel] || active.supportLevel}
                </p>
              )}
              {active.citations?.map((c, i) => (
                <p key={i}>
                  {sourceCatalog.sources.find((s) => s.id === c.source_id)
                    ?.title || c.source_id}{" "}
                  · 第 {c.pages} 页
                </p>
              ))}
              <div className="graph-active-actions">
                {(active.muscleId != null || active.groupName) && (
                  <>
                    <button
                      onClick={() =>
                        onOpenAtlas(
                          active.muscleId ??
                            muscles.find((m) => m.group === active.groupName)
                              ?.id,
                        )
                      }
                    >
                      在 Atlas 中定位
                    </button>
                    <button
                      onClick={() =>
                        active.muscleId != null
                          ? onOpenMuscle(active.muscleId)
                          : onOpenGroup(active.groupName)
                      }
                    >
                      查看运动回放
                    </button>
                  </>
                )}
                {active.url && (
                  <a href={active.url} target="_blank" rel="noreferrer">
                    打开教材来源 ↗
                  </a>
                )}
              </div>
            </div>
          )}
          <p className="graph-hint">
            拖拽节点整理布局，滚轮缩放。点击只展开详情，使用详情中的按钮跳转。
          </p>
        </aside>
      </div>
    </main>
  );
}
