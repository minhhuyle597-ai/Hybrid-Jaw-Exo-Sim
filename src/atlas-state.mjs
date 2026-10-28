export const SIDE_LABELS = {
  left: "左侧",
  right: "右侧",
  midline: "中线 / 双侧整体",
};

export function defaultLayers(structures) {
  return Object.fromEntries(
    structures.map((s) => [s.id, { visible: true, opacity: 1 }]),
  );
}

export function updateLayers(state, ids, patch) {
  const next = { ...state };
  for (const id of ids) if (next[id]) next[id] = { ...next[id], ...patch };
  return next;
}

export function isolateStructure(state, id) {
  if (!state[id]) return state;
  return Object.fromEntries(
    Object.entries(state).map(([key, value]) => [
      key,
      { ...value, visible: key === id, ...(key === id ? { opacity: 1 } : {}) },
    ]),
  );
}

export function filterStructures(
  structures,
  { query = "", side = "", layer = "", region = "" } = {},
) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return structures.filter(
    (s) =>
      (!side || s.side === side) &&
      (!layer || s.layer === layer) &&
      (!region || s.region === region) &&
      tokens.every((token) =>
        [
          s.label,
          s.english,
          s.id,
          ...s.aliases,
          ...s.bindings.flatMap((b) => [b.code, b.label, b.name]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(token),
      ),
  );
}

export const structureForActuator = (structures, id) =>
  structures.find((s) => s.bindings.some((b) => b.id === id));

// Preserve the scope and evidence of each statement; never inherit a group
// verification status onto geometry, individual attachments or another claim.
export function claimsForStructure(structure, evidence) {
  return (structure?.evidence_groups || []).flatMap((group) =>
    (evidence?.groups?.[group]?.claims || []).map((claim) => ({
      ...claim,
      group,
    })),
  );
}

export function parseRoute(hash) {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(query);
  const frame = Number(params.get("frame") || 0);
  return {
    page: ["atlas", "graph", "replay"].includes(path) ? path : "replay",
    structure: params.get("structure") || "",
    frame: Number.isSafeInteger(frame) && frame >= 0 ? frame : 0,
  };
}

export function routeHash(page, structure = "", frame = 0) {
  const params = new URLSearchParams();
  if (structure) params.set("structure", structure);
  if (frame > 0) params.set("frame", String(frame));
  return `#/${page}${params.size ? "?" + params.toString() : ""}`;
}
