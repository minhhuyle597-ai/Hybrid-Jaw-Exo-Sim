import React, { useMemo, useState } from "react";
import AtlasScene from "./AtlasScene.jsx";
import {
  SIDE_LABELS,
  claimsForStructure,
  defaultLayers,
  filterStructures,
  isolateStructure,
  updateLayers,
} from "./atlas-state.mjs";
import "./atlas.css";

const asset = (path) => import.meta.env.BASE_URL + path;
const LEVELS = {
  textbook_confirmed: "教材已核验",
  reference_confirmed: "公开参考支持",
  textbook_pending: "页码待核验",
  contested: "存在分歧",
  model_assumption: "模型假设",
  unverified: "尚未核验",
};
const DIRECTIONS = [
  ["前观", [0, 0, 1]],
  ["后观", [0, 0, -1]],
  ["左侧观", [1, 0, 0]],
  ["右侧观", [-1, 0, 0]],
  ["左前斜观", [0.8, 0.2, 1]],
];

export default function Atlas({
  shared,
  selectedId,
  onSelect,
  layers,
  setLayers,
  onReplay,
  onGraph,
}) {
  const { catalog, evidence, textbook, sourceCatalog } = shared;
  const [query, setQuery] = useState(""),
    [side, setSide] = useState(""),
    [region, setRegion] = useState("");
  const [command, setCommand] = useState(null);
  const selected =
    catalog.structures.find((s) => s.id === selectedId) ||
    catalog.structures[0];
  const layerNames = [...new Set(catalog.structures.map((s) => s.layer))];
  const matches = useMemo(
    () => filterStructures(catalog.structures, { query, side, region }),
    [catalog, query, side, region],
  );
  const claims = claimsForStructure(selected, evidence);
  const state = layers[selected.id];
  const visibleCount = Object.values(layers).filter(
    (s) => s.visible && s.opacity > 0,
  ).length;
  const sourceName = (id) =>
    sourceCatalog.sources.find((s) => s.id === id)?.title || id;
  const focus = () => {
    setLayers((old) =>
      updateLayers(old, [selected.id], {
        visible: true,
        opacity: Math.max(old[selected.id].opacity, 0.3),
      }),
    );
    setCommand({ id: selected.id, nonce: Date.now() });
  };
  const restore = () => {
    setLayers(defaultLayers(catalog.structures));
    setCommand({ direction: [0.8, 0.2, 1], nonce: Date.now() });
  };

  return (
    <main className="atlas-page">
      <div className="atlas-intro">
        <div>
          <div className="eyebrow">ANATOMICAL ATLAS · 结构探索</div>
          <h1>从结构，理解口颌运动。</h1>
          <p>逐层观察骨骼与肌肉路径，追溯教材证据，再进入同源运动回放。</p>
        </div>
        <div className="atlas-summary">
          <b>{catalog.structures.length}</b>
          <span>结构条目</span>
          <i />
          <b>
            {catalog.structures.filter((s) => s.kind === "bone").length} +{" "}
            {catalog.structures.reduce((n, s) => n + s.bindings.length, 0)}
          </b>
          <span>骨骼网格 / 肌肉路径</span>
        </div>
      </div>
      <div className="atlas-layout">
        <aside className="panel atlas-directory" aria-label="Atlas 结构目录">
          <div className="panel-title">
            <h2>结构与图层</h2>
            <span>{visibleCount} 个可见</span>
          </div>
          <div className="atlas-search">
            <label htmlFor="atlas-search">搜索结构</label>
            <input
              id="atlas-search"
              type="search"
              placeholder="咬肌 / masseter / M13"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="atlas-filters">
            <select
              aria-label="Atlas 左右侧"
              value={side}
              onChange={(e) => setSide(e.target.value)}
            >
              <option value="">全部侧别</option>
              {Object.entries(SIDE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Atlas 区域"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">全部区域</option>
              {[...new Set(catalog.structures.map((s) => s.region))].map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
          </div>
          <p className="atlas-directory-hint">
            搜索只筛选目录，不改变模型可见性。
          </p>
          <div className="atlas-tree">
            {!matches.length && (
              <p className="atlas-empty">
                没有匹配的结构。
                <button
                  onClick={() => {
                    setQuery("");
                    setSide("");
                    setRegion("");
                  }}
                >
                  清除筛选
                </button>
              </p>
            )}
            {layerNames.map((layer) => {
              const entries = matches.filter((s) => s.layer === layer);
              if (!entries.length) return null;
              const allIds = catalog.structures
                .filter((s) => s.layer === layer)
                .map((s) => s.id);
              const visible = allIds.filter((id) => layers[id].visible).length;
              return (
                <section className="atlas-layer" key={layer}>
                  <div className="atlas-layer-heading">
                    <h3>
                      {layer} <small>{entries.length}</small>
                    </h3>
                    <button
                      aria-label={`${visible === allIds.length ? "隐藏" : "显示"}${layer}图层`}
                      onClick={() =>
                        setLayers((old) =>
                          updateLayers(old, allIds, {
                            visible: visible !== allIds.length,
                          }),
                        )
                      }
                    >
                      {visible === allIds.length ? "全部隐藏" : "全部显示"}
                    </button>
                  </div>
                  {entries.map((s) => (
                    <div
                      key={s.id}
                      className={
                        "atlas-entry " +
                        (selected.id === s.id ? "is-selected" : "")
                      }
                    >
                      <input
                        type="checkbox"
                        aria-label={`显示${s.label}`}
                        checked={layers[s.id].visible}
                        onChange={(e) =>
                          setLayers((old) =>
                            updateLayers(old, [s.id], {
                              visible: e.target.checked,
                            }),
                          )
                        }
                      />
                      <button
                        aria-pressed={selected.id === s.id}
                        onClick={() => onSelect(s.id)}
                      >
                        <span>{s.label}</span>
                        <small>
                          {s.representation === "mesh"
                            ? "骨骼网格"
                            : `${s.bindings.map((b) => b.code).join(" / ")} · 路径`}
                        </small>
                      </button>
                      <span
                        className="atlas-entry-dot"
                        style={{
                          background: s.bindings[0]?.color || "#c1ad88",
                        }}
                        aria-hidden="true"
                      />
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
          <div className="atlas-directory-footer">
            <button onClick={restore}>恢复默认图层</button>
            <small>可见结构与曲线比较独立管理</small>
          </div>
        </aside>

        <section className="panel atlas-viewer" aria-label="Atlas 三维视图">
          <div className="atlas-viewer-heading">
            <div>
              <span className="atlas-live-dot" />
              三维结构观察
            </div>
            <small>参考状态 · {catalog.state.time_s.toFixed(2)} s</small>
          </div>
          <div className="atlas-views" aria-label="Atlas 观察方向">
            {DIRECTIONS.map(([label, direction]) => (
              <button
                key={label}
                onClick={() => setCommand({ direction, nonce: Date.now() })}
              >
                {label}
              </button>
            ))}
          </div>
          <AtlasScene
            catalog={catalog}
            layers={layers}
            selected={selected.id}
            onSelect={onSelect}
            command={command}
          />
          <div className="atlas-selection-tools">
            <span>
              {selected.label}
              {!state.visible && " · 已隐藏"}
            </span>
            <button onClick={focus}>定位所选</button>
            <button
              onClick={() => {
                setLayers((old) => isolateStructure(old, selected.id));
                setCommand({ id: selected.id, nonce: Date.now() });
              }}
            >
              单独显示
            </button>
            <button onClick={restore}>全景复位</button>
          </div>
          <label className="atlas-opacity">
            所选结构透明度
            <input
              aria-label="所选结构透明度"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.opacity}
              onChange={(e) =>
                setLayers((old) =>
                  updateLayers(old, [selected.id], {
                    opacity: Number(e.target.value),
                  }),
                )
              }
            />
            <output>{Math.round(state.opacity * 100)}% 不透明</output>
          </label>
          <p className="atlas-model-note">
            骨骼来自上游简化模型；彩色线条表示肌肉—肌腱路径。当前未收录独立关节盘、神经、血管和真实肌腹模型。
          </p>
        </section>

        <aside className="panel atlas-details" aria-label="所选结构详情">
          <div className="eyebrow">SELECTED STRUCTURE</div>
          <h2>{selected.label}</h2>
          <p className="atlas-english">{selected.english}</p>
          <div className="atlas-tags">
            <span>{selected.layer}</span>
            <span>{selected.region}</span>
            <span>{SIDE_LABELS[selected.side]}</span>
          </div>
          <p className="atlas-detail-note">{selected.note}</p>
          <div className="atlas-detail-actions">
            <button
              className="atlas-primary"
              disabled={!selected.bindings.length}
              onClick={() => onReplay(selected.id)}
            >
              查看运动与曲线 ↗
            </button>
            <button
              disabled={!selected.bindings.length}
              onClick={() => onGraph(selected.id)}
            >
              查看知识关系 ↗
            </button>
          </div>
          {!selected.bindings.length && (
            <p className="atlas-muted">
              该骨骼暂无独立执行器曲线或知识关系数据；仍可通过顶部导航浏览回放。
            </p>
          )}
          {!!selected.bindings.length && (
            <section className="atlas-detail-section">
              <h3>对应模型肌束</h3>
              <p className="atlas-muted">一个解剖结构可对应多个执行器。</p>
              {selected.bindings.map((b) => (
                <div className="atlas-binding" key={b.name}>
                  <span style={{ background: b.color }} />
                  {b.code} {b.label}
                </div>
              ))}
            </section>
          )}
          <section className="atlas-detail-section">
            <h3>
              关系与证据 <small>{claims.length} 条</small>
            </h3>
            {!claims.length && (
              <p className="atlas-muted">
                暂无逐条教材关系记录。网格来源可追溯，不代表几何细节已完成解剖核验。
              </p>
            )}
            {claims.map((claim, i) => (
              <article className="atlas-claim" key={`${selected.id}-${i}`}>
                <span
                  className={
                    "atlas-evidence-level level-" + claim.support_level
                  }
                >
                  {LEVELS[claim.support_level] || "尚未核验"}
                </span>
                <p>{claim.statement}</p>
                <small>适用范围：{claim.group}；未单独核验当前模型几何。</small>
                {claim.citations?.map((c, j) => (
                  <div className="atlas-citation" key={j}>
                    {sourceName(c.source_id)} · 第 {c.pages} 页
                  </div>
                ))}
              </article>
            ))}
          </section>
          {selected.evidence_groups.map((group) => {
            const detail = textbook?.groups?.[group];
            const binding = selected.bindings.find(
              (b) => textbook?.muscles?.[b.name]?.group === group,
            );
            const ref = textbook?.muscles?.[binding?.name]?.textbook_ref;
            return (
              detail?.origin_insertion && (
                <section className="atlas-detail-section" key={group}>
                  <h3>{group} · 教材附着概述</h3>
                  <p>{detail.origin_insertion}</p>
                  <small>
                    《{textbook.book.title}》{textbook.book.edition} · 第{" "}
                    {ref?.page || "待核验"}{" "}
                    页；描述肌群，不是对模型附着点的校验。
                  </small>
                </section>
              )
            );
          })}
          <details className="atlas-provenance">
            <summary>模型来源与使用边界</summary>
            <p>
              上游
              v0.1.0，与现有回放同一模型、同一首帧状态。结构显示不进行在线物理求解。
            </p>
            <a
              href={catalog.provenance.upstream}
              target="_blank"
              rel="noreferrer"
            >
              查看上游来源 ↗
            </a>
            <a
              href={asset("atlas/manifest.json")}
              target="_blank"
              rel="noreferrer"
            >
              资源版本与校验记录 ↗
            </a>
            {catalog.provenance.notices.map((path) => (
              <a key={path} href={asset(path)} target="_blank" rel="noreferrer">
                {path.includes("anatomical")
                  ? "骨骼网格归属声明"
                  : "上游许可与声明"}{" "}
                ↗
              </a>
            ))}
          </details>
        </aside>
      </div>
    </main>
  );
}
