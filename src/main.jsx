import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  defaultLayers,
  parseRoute,
  routeHash,
  structureForActuator,
} from "./atlas-state.mjs";
import "./style.css";
import "./teaching.css";
import "./atlas.css";

const Atlas = lazy(() => import("./Atlas.jsx"));
const ReplayLab = lazy(() => import("./ReplayLab.jsx"));
const KnowledgeGraph = lazy(() => import("./KnowledgeGraph.jsx"));
const asset = (path) => import.meta.env.BASE_URL + path;

class PageBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <main className="error" role="alert">
          <h1>页面未能加载</h1>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()}>重新加载</button>
        </main>
      );
    return this.props.children;
  }
}

function App() {
  const [shared, setShared] = useState(null),
    [error, setError] = useState("");
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [lastStructure, setLastStructure] = useState("muscle.masseter.left");
  const [replayFrame, setReplayFrame] = useState(
    () => parseRoute(window.location.hash).frame,
  );
  const [layers, setLayers] = useState({});

  useEffect(() => {
    const handler = () => {
      const next = parseRoute(window.location.hash);
      setRoute(next);
      setReplayFrame(next.frame);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const read = async (path) => {
      const response = await fetch(asset(path), { signal: controller.signal });
      if (!response.ok)
        throw new Error(`数据加载失败 (${response.status})：${path}`);
      return response.json();
    };
    Promise.all(
      [
        "atlas/manifest.json",
        "data/views.json",
        "data/textbook.json",
        "data/evidence.json",
        "data/source_catalog.json",
        "data/teaching-phases.json",
        "data/quiz.json",
      ].map(read),
    )
      .then(
        ([
          catalog,
          manifest,
          textbook,
          evidence,
          sourceCatalog,
          phases,
          quiz,
        ]) => {
          setLayers(defaultLayers(catalog.structures));
          setShared({
            catalog,
            manifest,
            textbook,
            evidence,
            sourceCatalog,
            phases: phases.phases,
            quiz: quiz.questions,
          });
        },
      )
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);

  const onReplaySelect = useCallback(
    (id) => {
      const s = shared && structureForActuator(shared.catalog.structures, id);
      if (s) setLastStructure(s.id);
    },
    [shared],
  );
  const routeStructure = shared?.catalog.structures.find(
    (s) => s.id === route.structure,
  );
  const selectedId = routeStructure?.id || lastStructure;
  const navigate = (
    page,
    id = route.page === "replay" ? lastStructure : selectedId,
  ) => {
    setLastStructure(id);
    window.location.hash = routeHash(page, id, replayFrame);
    if (page !== route.page) window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openActuator = (page, id) =>
    navigate(
      page,
      structureForActuator(shared.catalog.structures, id)?.id || selectedId,
    );

  if (error)
    return (
      <main className="error" role="alert">
        <h1>无法打开实验室</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>重新加载</button>
      </main>
    );
  if (!shared)
    return (
      <main className="loading" role="status">
        正在加载结构目录与教材索引…
      </main>
    );
  const { catalog, manifest, textbook, evidence, sourceCatalog, phases } =
    shared;
  const selected =
    catalog.structures.find((s) => s.id === selectedId) ||
    catalog.structures[0];
  const graphMuscles = manifest.muscles.map((m) => ({
    ...m,
    group: textbook.muscles[m.name]?.group || m.group,
  }));

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">J</span>
          <div>
            <b>口颌肌骨实验室</b>
            <small>JAW BIOMECHANICS · EXPLORER</small>
          </div>
        </div>
        <nav className="app-nav" aria-label="实验室导航">
          {[
            ["replay", "运动回放"],
            ["atlas", "结构 Atlas"],
            ["graph", "知识图谱"],
          ].map(([page, label]) => (
            <a
              key={page}
              href={routeHash(
                page,
                route.page === "replay" ? lastStructure : selectedId,
                replayFrame,
              )}
              aria-current={route.page === page ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <a className="download" href={asset("data/muscles.csv")} download>
          ↓ 导出回放数据
        </a>
      </header>
      {route.structure && !routeStructure && (
        <div className="app-route-notice" role="status">
          未找到链接中的结构，已显示默认选择。
        </div>
      )}
      <PageBoundary key={route.page}>
        <Suspense
          fallback={
            <main className="loading" role="status">
              正在载入
              {route.page === "atlas"
                ? "结构 Atlas"
                : route.page === "graph"
                  ? "知识图谱"
                  : "回放实验室"}
              …
            </main>
          }
        >
          {route.page === "atlas" && (
            <Atlas
              shared={shared}
              selectedId={selected.id}
              onSelect={(id) => navigate("atlas", id)}
              layers={layers}
              setLayers={setLayers}
              onReplay={(id) => navigate("replay", id)}
              onGraph={(id) => navigate("graph", id)}
            />
          )}
          {route.page === "replay" && (
            <ReplayLab
              shared={shared}
              selectedStructure={routeStructure}
              initialFrame={Math.min(route.frame, manifest.frame_count - 1)}
              onFrameChange={setReplayFrame}
              onSelectionChange={onReplaySelect}
              onOpenAtlas={(id) => openActuator("atlas", id)}
            />
          )}
          {route.page === "graph" && (
            <KnowledgeGraph
              muscles={graphMuscles}
              textbook={textbook}
              evidence={evidence}
              sourceCatalog={sourceCatalog}
              phases={phases}
              initialMuscleId={selected.bindings[0]?.id}
              onOpenMuscle={(id) => openActuator("replay", id)}
              onOpenAtlas={(id) => openActuator("atlas", id)}
              onOpenGroup={(group) => {
                const s = catalog.structures.find((s) =>
                  s.evidence_groups.includes(group),
                );
                navigate("replay", s?.id || selectedId);
              }}
              onBack={() => navigate("replay")}
            />
          )}
        </Suspense>
      </PageBoundary>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
