import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  claimsForStructure,
  defaultLayers,
  filterStructures,
  isolateStructure,
  parseRoute,
  routeHash,
  structureForActuator,
  updateLayers,
} from "../src/atlas-state.mjs";
import { buildGraph } from "../src/knowledge-graph.mjs";

const read = (path) =>
  JSON.parse(
    readFileSync(new URL("../public/" + path, import.meta.url), "utf8"),
  );
const catalog = read("atlas/manifest.json"),
  views = read("data/views.json"),
  evidence = read("data/evidence.json");
const textbook = read("data/textbook.json"),
  sourceCatalog = read("data/source_catalog.json");
const paths = read("atlas/muscle-paths.json").paths;
const structures = catalog.structures;

test("stable anatomical identities map every replay actuator exactly once, preserving sides and evidence scope", () => {
  assert.equal(new Set(structures.map((s) => s.id)).size, structures.length);
  assert.equal(structures.filter((s) => s.representation === "mesh").length, 4);
  const bindings = structures.flatMap((s) => s.bindings);
  assert.equal(bindings.length, 24);
  assert.equal(new Set(bindings.map((b) => b.id)).size, 24);
  for (const b of bindings) {
    assert.equal(b.name, views.muscles[b.id].name);
    assert.equal(b.color, views.muscles[b.id].color);
    const s = structureForActuator(structures, b.id);
    assert.ok(b.name.endsWith("_" + s.side));
    assert.ok(s.evidence_groups.includes(textbook.muscles[b.name].group));
  }
  assert.deepEqual(
    structures
      .find((s) => s.id === "muscle.masseter.left")
      .bindings.map((b) => b.code),
    ["M13", "M15"],
  );
  assert.equal(structureForActuator(structures, 1000), undefined);
});

test("exported resources are complete, hash-checked glTF meshes in the recorded coordinate system", () => {
  const provenance = read("data/provenance.json");
  assert.equal(catalog.provenance.commit, provenance.release_commit);
  assert.equal(catalog.provenance.model_sha256, provenance.model_sha256);
  assert.deepEqual(catalog.coordinates.from_mujoco, ["y", "z", "x"]);
  assert.equal(catalog.units, "m");
  assert.equal(catalog.state.frame, 0);
  assert.equal(
    catalog.state.sha256,
    createHash("sha256")
      .update(
        readFileSync(new URL("../public/data/states.npz", import.meta.url)),
      )
      .digest("hex"),
  );
  for (const asset of catalog.assets) {
    assert.match(asset.url, /^atlas\/[a-z-]+\.(glb|json)$/);
    const bytes = readFileSync(
      new URL("../public/" + asset.url, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.sha256,
    );
    if (!asset.url.endsWith(".glb")) continue;
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const jsonLength = bytes.readUInt32LE(12);
    const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    assert.equal(doc.nodes[0].extras.structureId, asset.id);
    assert.equal(doc.accessors[0].count, asset.vertices);
    assert.equal(doc.accessors[2].count, asset.triangles * 3);
    const binaryStart = 28 + jsonLength;
    const indices = doc.bufferViews[2];
    for (let offset = 0; offset < indices.byteLength; offset += 4) {
      assert.ok(
        bytes.readUInt32LE(binaryStart + indices.byteOffset + offset) <
          asset.vertices,
      );
    }
    for (let axis = 0; axis < 3; axis++) {
      const extent = doc.accessors[0].max[axis] - doc.accessors[0].min[axis];
      assert.ok(
        extent > 0.001 && extent < 0.5,
        "bone bounds must be plausible in metres",
      );
    }
    assert.match(asset.source_sha256, /^[a-f0-9]{64}$/);
  }
});

test("all 3D paths match first-frame replay lengths and anatomical laterality", () => {
  assert.equal(paths.length, 24);
  const frame = read("data/frames.json").frames[0];
  for (const path of paths) {
    const s = structures.find((s) => s.id === path.structure_id);
    const b = s.bindings.find((b) => b.name === path.actuator_name);
    assert.ok(b);
    assert.ok(path.points.length >= 2);
    let length = 0;
    path.points.forEach((point, i) => {
      assert.equal(point.length, 3);
      assert.ok(point.every((n) => Number.isFinite(n) && Math.abs(n) < 1));
      assert.ok(s.side === "left" ? point[0] > 0 : point[0] < 0);
      if (i)
        length += Math.hypot(
          ...point.map((value, axis) => value - path.points[i - 1][axis]),
        );
    });
    assert.ok(Math.abs(length * 1000 - frame.length_mm[b.id]) < 0.001, b.name);
  }
});

test("search resolves multilingual names and actuator codes without changing layers", () => {
  for (const query of ["左侧咬肌", "M13", "masseter left"]) {
    assert.deepEqual(
      filterStructures(structures, { query }).map((s) => s.id),
      ["muscle.masseter.left"],
    );
  }
  assert.equal(
    filterStructures(structures, { query: "咬肌", side: "right" }).length,
    1,
  );
  assert.equal(
    filterStructures(structures, { query: "not-a-structure" }).length,
    0,
  );
  assert.ok(
    filterStructures(structures, { region: "口底" }).every(
      (s) => s.region === "口底",
    ),
  );
  const state = defaultLayers(structures);
  const faded = updateLayers(state, ["bone.skull"], { opacity: 0.4 });
  const isolated = isolateStructure(faded, "muscle.masseter.left");
  assert.equal(Object.values(isolated).filter((s) => s.visible).length, 1);
  assert.equal(isolated["bone.skull"].opacity, 0.4);
  assert.ok(Object.values(state).every((s) => s.visible && s.opacity === 1));
  assert.deepEqual(isolateStructure(state, "unknown"), state);
});

test("hash routes support direct links and reject invalid frame numbers", () => {
  for (const page of ["atlas", "graph", "replay"]) {
    assert.deepEqual(parseRoute(routeHash(page, "muscle.masseter.left", 125)), {
      page,
      structure: "muscle.masseter.left",
      frame: 125,
    });
  }
  for (const frame of ["-1", "NaN", "Infinity", "0.5"])
    assert.equal(parseRoute("#/replay?frame=" + frame).frame, 0);
  assert.equal(parseRoute("#/unknown").page, "replay");
});

test("graph relations retain every claim citation and never infer verification from the whole group", () => {
  const muscles = views.muscles.map((m) => ({
    ...m,
    group: textbook.muscles[m.name].group,
  }));
  const graph = buildGraph({ muscles, evidence, sourceCatalog });
  const ids = new Set(graph.nodes.map((n) => n.id));
  assert.equal(ids.size, graph.nodes.length);
  for (const edge of graph.edges) {
    assert.ok(ids.has(edge.source) && ids.has(edge.target));
    assert.ok(edge.relation);
  }
  for (const [group, detail] of Object.entries(evidence.groups)) {
    for (const [i, claim] of detail.claims.entries()) {
      const node = graph.nodes.find((n) => n.id === `claim:${group}:${i}`);
      assert.ok(node, group);
      assert.equal(node.supportLevel, claim.support_level);
      assert.deepEqual(node.citations, claim.citations || []);
      const citations = graph.edges
        .filter((e) => e.source === node.id && e.relation === "引用")
        .flatMap((e) => e.citations);
      assert.deepEqual(citations, claim.citations || []);
    }
  }
  const s = structures.find((s) => s.id === "muscle.masseter.left");
  assert.ok(
    claimsForStructure(s, evidence).some(
      (c) => c.support_level === "model_assumption",
    ),
  );
  assert.deepEqual(
    claimsForStructure(
      structures.find((s) => s.id === "bone.skull"),
      evidence,
    ),
    [],
  );
});
