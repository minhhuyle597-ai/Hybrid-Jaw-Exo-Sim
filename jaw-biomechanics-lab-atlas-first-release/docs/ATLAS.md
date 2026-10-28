# 口颌结构 Atlas

第一阶段将结构浏览从视频回放中独立出来。入口为 `#/atlas`，继续使用静态 GitHub Pages，无需在线数据库、Python 或实时物理服务。

## 已实现范围

- 18 个稳定结构条目：4 个骨骼条目与左右各 7 个肌肉 / 肌肉部分条目。
- 4 个可独立选择的骨骼网格：颅骨、上颌骨、下颌骨、舌骨。原始网格内未独立分割的牙齿等结构不能单独控制。
- 24 条真实模型导出的肌肉—肌腱路径，按解剖结构聚合。例如 `muscle.masseter.left` 对应 M13 与 M15，而不是将两个执行器视为两块独立肌肉。
- 中英文名称、别名、执行器编号搜索，区域与侧别筛选，分组显隐、单结构显隐 / 透明度 / 单独显示 / 定位 / 复位。
- 三维点击选择、旋转、缩放与平移，以及五个可用键盘操作的方向按钮。
- Atlas、逐条证据知识图谱和现有运动回放之间的结构映射；页面切换保留回放帧，重回回放时暂停在该帧。
- 图层状态在当前应用会话内跨页保留，完整刷新恢复默认。链接记录页面、所选结构与回放帧；不序列化相机或整套图层状态。
- 模型加载失败可重试；无 WebGL 时仍可搜索、查看证据、进入关系图与回放。

Atlas 显示回放首帧（0.00 s）的静态结构。链接中的 `frame` 是返回回放的时间上下文，**不会让 Atlas 模型运动**。肌肉路径不是肌腹体积；教材结论核验与模型几何准确性分别展示。关节盘、神经、血管及独立牙齿分割尚未加入。

## 数据和模块

| 文件 | 职责 |
| --- | --- |
| `public/atlas/manifest.json` | 结构目录、执行器映射、资源校验、来源与坐标约定 |
| `public/atlas/*.glb` | 每个骨骼一个 glTF 2.0 二进制模型，保留 `extras.structureId` |
| `public/atlas/muscle-paths.json` | 首帧 24 条世界坐标路径、结构 ID、执行器名称、固定颜色 |
| `src/main.jsx` | Hash 路由、共享小型索引、按页面加载组件与回放时间上下文 |
| `src/Atlas.jsx` | 结构树、独立图层状态、证据和页面联动 |
| `src/AtlasScene.jsx` | Three.js 场景、资源按需加载、拾取、相机与资源释放 |
| `src/atlas-state.mjs` | 稳定 ID 映射、搜索、图层操作、路由解析 |
| `src/knowledge-graph.mjs` | 明确关系类型、逐结论引用与核验状态；纯数据构图 |
| `src/ReplayLab.jsx` | 保留原来的同步回放、曲线、教学片段、自测与导出 |

结构 ID 不使用数组下标、中文名或 M 编号。新增结构必须包含名称、类型、区域、侧别、图层、表示形式、资源绑定、执行器绑定和证据适用范围。没有执行器数据的结构不生成空曲线；当前骨骼没有知识关系记录，因此其关系跳转按钮禁用并说明原因。

教材结论直接来自现有 `evidence.json` 的每一条 `claim`，保留该条的 `support_level` 和 `citations`。`evidence_groups` 用于检索，不能将整个组的核验状态赋给每个结构。图谱中的“对应模型执行器”“关联模型输出”是模型映射关系，不是教材证明。

## 资产生成与坐标验证

`scripts/export_atlas.py` 验证上游提交和原始 MJCF 的 SHA256，加载已有 `states.npz[0]`，仅调用 `mj_forward`，不重新积分、不重写视频或仿真状态。

骨骼顶点先经过 MuJoCo 编译后的 geom 世界变换；路径直接使用 `wrap_xpos`。两者应用相同的正交变换 `(x, y, z) → (y, z, x)`，仍以米为单位。glTF / Three.js 的 +X 为模型左、+Y 为上、+Z 为前；该变换保持右手坐标系。记录每个源网格及生成资源的 SHA256，保留上游和 ArtiSynth 归属声明。

复现需要单独获取上游 v0.1.0（详见 [REPRODUCIBILITY.md](REPRODUCIBILITY.md)），并安装 MuJoCo 3.4.0 与 numpy 2.2.6；无需 OpenGL 上下文：

```bash
python -m venv .venv
.venv/bin/python -m pip install mujoco==3.4.0 numpy==2.2.6
export HYBRID_JAW_EXO_SIM_ROOT=/path/to/hybrid-jaw-exo-sim
.venv/bin/python scripts/export_atlas.py --output .runtime/atlas-export
```

输出目录必须不存在。先比较新旧清单和资源，再决定是否替换 `public/atlas`；脚本拒绝直接覆盖已有目录。上游提交必须为 `f4d76c75be22c40eb0d1abdd1bde6a2c443df198`。

## 开发与验证

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Linux 若使用已安装的 Chromium，可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` 运行。浏览器测试针对构建后的站点，在 `/Hybrid-Jaw-Exo-Sim/` 子路径启动临时预览服务器，覆盖直接刷新链接、无回放数据下载、实际渲染变化、图谱与回放往返、帧时间恢复、移动端和失败恢复。测试使用软件 WebGL，不能替代目标硬件上的性能测量。

`npm test` 校验生成资产 SHA256、GLB 顶点索引范围、所有执行器的唯一映射、路径长度与首帧数值一致、左右侧、图层状态、路由和逐条引用，并继续执行原有回放测试。

## 后续扩展

增加独立关节盘、神经、血管或肌腹前，先落实模型来源、许可、解剖核验和空间配准，再接入结构目录。当前三维骨骼资源合计约 6 MB，按资源独立加载；Atlas 不加载视频、NPZ 或 `frames.json`，ECharts 和回放代码也延迟到相应页面加载。

扩展到更多区域时，可将清单拆为区域索引与资源包，并增加不同精度网格、视口内列表渲染及明确的内存预算。当前版本尚未实现这些大规模优化，也未引入跨器官生理关系或实时物理求解。
