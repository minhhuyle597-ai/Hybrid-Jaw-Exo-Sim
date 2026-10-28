import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const asset = (path) => import.meta.env.BASE_URL + path;

export default function AtlasScene({
  catalog,
  layers,
  selected,
  onSelect,
  command,
}) {
  const host = useRef(null),
    engine = useRef(null),
    select = useRef(onSelect);
  const current = useRef({ layers, selected });
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  select.current = onSelect;
  current.current = { layers, selected };

  useEffect(() => {
    const el = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setStatus({
        loading: false,
        error: "此设备未能启动三维显示。结构目录、证据和回放入口仍可使用。",
      });
      return;
    }
    let disposed = false,
      contextUnavailable = false;
    const abort = new AbortController();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f4ef");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.001, 10);
    camera.position.set(0.3, 0.08, 0.4);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute(
      "aria-label",
      "口颌三维模型，拖动旋转，滚轮缩放；也可使用观察方向和结构目录按钮",
    );
    renderer.domElement.setAttribute("role", "img");
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -0.06, 0);
    controls.minDistance = 0.025;
    controls.maxDistance = 1.5;
    controls.enableDamping = false;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x607164, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-0.4, 0.6, 0.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1);
    fill.position.set(0.5, 0, -0.3);
    scene.add(fill);
    const groups = new Map(),
      pending = new Map();
    let initialFit = false;
    const disposeObject = (object) =>
      object.traverse((child) => {
        child.geometry?.dispose();
        const materials = child.material
          ? Array.isArray(child.material)
            ? child.material
            : [child.material]
          : [];
        materials.forEach((material) => material.dispose());
      });
    const render = () => {
      if (!disposed && !contextUnavailable) renderer.render(scene, camera);
    };
    const fit = (id, direction) => {
      const box = new THREE.Box3();
      groups.forEach((group, sid) => {
        if (id ? sid === id : group.visible)
          box.union(new THREE.Box3().setFromObject(group));
      });
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(
        box.getBoundingSphere(new THREE.Sphere()).radius,
        0.012,
      );
      const halfFov = Math.min(
        THREE.MathUtils.degToRad(camera.fov / 2),
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect,
        ),
      );
      const dir = direction
        ? new THREE.Vector3(...direction).normalize()
        : camera.position.clone().sub(controls.target).normalize();
      controls.target.copy(center);
      camera.position
        .copy(center)
        .addScaledVector(dir, (radius / Math.sin(halfFov)) * 1.12);
      controls.update();
      render();
    };
    const apply = () => {
      groups.forEach((group, id) => {
        const state = current.current.layers[id];
        group.visible = !!state?.visible && state.opacity > 0;
        group.traverse((child) => {
          if (!child.material) return;
          const material = child.material;
          const opacity = state?.opacity ?? 1;
          const transparent = opacity < 1;
          if (material.transparent !== transparent) material.needsUpdate = true;
          material.transparent = transparent;
          material.opacity = opacity;
          material.depthWrite = !transparent;
          material.emissive?.set(
            id === current.current.selected ? "#2b6656" : "#000000",
          );
          material.emissiveIntensity =
            id === current.current.selected ? 0.28 : 0;
        });
      });
      render();
    };
    const add = (id, object) => {
      if (disposed) {
        disposeObject(object);
        return;
      }
      object.traverse((child) => {
        child.userData.structureId = id;
      });
      groups.set(id, object);
      scene.add(object);
      apply();
    };
    const get = async (url) => {
      const response = await fetch(asset(url), { signal: abort.signal });
      if (!response.ok)
        throw new Error(`资源加载失败 (${response.status})：${url}`);
      return response;
    };
    const loadPaths = async () => {
      const resource = catalog.assets.find((a) => a.id === "muscle-paths");
      const data = await (await get(resource.url)).json();
      const pathGroups = new Map();
      for (const path of data.paths) {
        if (!pathGroups.has(path.structure_id))
          pathGroups.set(path.structure_id, new THREE.Group());
        const group = pathGroups.get(path.structure_id);
        const material = new THREE.MeshStandardMaterial({
          color: path.color,
          roughness: 0.6,
        });
        const points = path.points.map((p) => new THREE.Vector3(...p));
        for (let i = 1; i < points.length; i++) {
          const delta = points[i].clone().sub(points[i - 1]);
          if (delta.length() < 1e-9) continue;
          const segment = new THREE.Mesh(
            new THREE.CylinderGeometry(0.00085, 0.00085, delta.length(), 8),
            material,
          );
          segment.position
            .copy(points[i])
            .add(points[i - 1])
            .multiplyScalar(0.5);
          segment.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            delta.normalize(),
          );
          group.add(segment);
        }
      }
      pathGroups.forEach((group, id) => add(id, group));
    };
    const ensureVisible = async () => {
      if (contextUnavailable) return;
      const requests = [];
      if (!pending.has("muscle-paths"))
        pending.set("muscle-paths", loadPaths());
      requests.push(pending.get("muscle-paths"));
      for (const s of catalog.structures.filter(
        (s) =>
          s.representation === "mesh" && current.current.layers[s.id]?.visible,
      )) {
        if (!pending.has(s.id)) {
          const url = catalog.assets.find((a) => a.id === s.asset_id).url;
          pending.set(
            s.id,
            (async () => {
              const buffer = await (await get(url)).arrayBuffer();
              const gltf = await new GLTFLoader().parseAsync(buffer, "");
              add(s.id, gltf.scene);
            })(),
          );
        }
        requests.push(pending.get(s.id));
      }
      try {
        await Promise.all(requests);
        if (disposed) return;
        if (!initialFit) {
          fit(null, [0.8, 0.2, 1]);
          initialFit = true;
        }
        setStatus({ loading: false, error: "" });
      } catch (error) {
        if (!disposed) setStatus({ loading: false, error: error.message });
      }
    };
    const resize = () => {
      const width = el.clientWidth,
        height = el.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    controls.addEventListener("change", render);
    const ray = new THREE.Raycaster();
    let down = null;
    const pointerDown = (e) => {
      down = [e.clientX, e.clientY];
    };
    const pointerUp = (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
        return;
      down = null;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hits = ray.intersectObjects(
        [...groups.values()].filter((g) => g.visible),
        true,
      );
      if (hits[0]) select.current(hits[0].object.userData.structureId);
    };
    const contextLost = (e) => {
      e.preventDefault();
      contextUnavailable = true;
      setStatus({
        loading: false,
        error: "三维显示连接中断，请重新载入模型。",
      });
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    engine.current = { apply, ensureVisible, fit };
    setStatus({ loading: true, error: "" });
    resize();
    ensureVisible();
    return () => {
      disposed = true;
      abort.abort();
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      groups.forEach(disposeObject);
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, [catalog, revision]);

  useEffect(() => {
    engine.current?.apply();
    engine.current?.ensureVisible();
  }, [layers, selected]);
  useEffect(() => {
    const activeEngine = engine.current;
    let cancelled = false;
    if (command && activeEngine)
      activeEngine.ensureVisible().then(() => {
        if (!cancelled && engine.current === activeEngine)
          activeEngine.fit(command.id, command.direction);
      });
    return () => {
      cancelled = true;
    };
  }, [command]);

  return (
    <div
      className="atlas-scene-wrap"
      data-status={
        status.error ? "error" : status.loading ? "loading" : "ready"
      }
    >
      <div ref={host} className="atlas-scene" />
      <div className="atlas-compass">
        上 S · 前 A · 左 L<br />
        <small>左右均指模型自身方向</small>
      </div>
      <div className="atlas-scene-caption">
        拖动旋转 · 滚轮缩放 · 双指平移
        <br />
        首帧静态结构 · 肌肉以路径示意
      </div>
      {status.loading && (
        <div className="atlas-scene-message" role="status">
          正在载入三维结构…
        </div>
      )}
      {status.error && (
        <div className="atlas-scene-message" role="alert">
          <p>{status.error}</p>
          <button onClick={() => setRevision((r) => r + 1)}>
            重新载入模型
          </button>
        </div>
      )}
      {!status.loading &&
        !status.error &&
        !Object.values(layers).some((s) => s.visible && s.opacity > 0) && (
          <div className="atlas-scene-message">
            所有图层已隐藏；可在结构目录中重新显示，或点击恢复默认。
          </div>
        )}
    </div>
  );
}
