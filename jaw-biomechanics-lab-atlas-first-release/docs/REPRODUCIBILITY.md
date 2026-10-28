# 复现与开发

## 只运行网页

使用 Node.js 22.12+；依赖由 `package-lock.json` 锁定。

```bash
npm ci
npm test
npm run dev
```

不需要 Python、显卡或在线后端。发布资源已包含视频、记录及投影。GitHub Pages 通过 `.github/workflows/pages.yml` 构建部署。

## Python 环境和上游模型

本仓库不重复收录上游网格和控制器源码。单独获取固定版本，保持原始许可与声明：

```bash
git clone --branch v0.1.0 --depth 1 https://github.com/paulotto/hybrid-jaw-exo-sim.git /path/to/shared/hybrid-jaw-exo-sim
python -m venv .venv
# 激活环境后
python -m pip install -r requirements.lock.txt
```

推荐 Python 3.11；锁定的 MuJoCo 是 3.4.0。脚本只导入所需控制模块，未安装 PyVista/Qt 等非必要依赖。离屏渲染仍需要可用的 OpenGL；本次生成环境为 Windows，Linux 需自行配置兼容的 EGL/OSMesa/显示环境。

指定上游根目录：

```powershell
$env:HYBRID_JAW_EXO_SIM_ROOT = 'C:\path\to\shared\hybrid-jaw-exo-sim'
```

```bash
export HYBRID_JAW_EXO_SIM_ROOT=/path/to/shared/hybrid-jaw-exo-sim
```

脚本会验证肌肉身份和参考长度映射。对应上游提交是 `f4d76c75be22c40eb0d1abdd1bde6a2c443df198`，模型和参考文件 SHA256 见 `provenance.json`。

## 三个阶段

```bash
python scripts/generate_demo.py
python scripts/render_views.py
python scripts/verify_data.py
```

生成脚本拒绝覆盖已有状态文件，渲染脚本拒绝覆盖已有视频。先检查旧输出是否被修改或仍被使用，再把确认可替换的产物移入恢复目录并记录清单；不要直接删除原始记录。仅重绘视角时保留 `states.npz` 和 `frames.json`，只运行后两步。

### 物理配置

- 官方 `jaw_exo_model_rigid_skin_sep_compiled_wo_flex.xml` 与 `jaw_ref_sub_skip_y_hinge_18_deg_ik_best.h5`。
- 初始 qpos 为参考第一帧，速度与激活初值为零。
- 上游 `ActuatorLengthTracker.step_manual()` 每步计算输入，再写入 ctrl 并执行 `mj_step`；采样时 `mj_forward` 更新派生量。
- `kp=200, ki=50, kd=20`，导数滤波 0.01 s、误差方向反转、输出 `[0,1]`。
- 步长 0.001 s，采样 0.04 s；参考末尾为21.41 s，采样到21.40 s。
- 执行器24–27的增益和偏置参数置零，检查输出为零；其它原始被动结构与约束保留。

### 可视化配置

只修改渲染属性：隐藏皮肤/外骨骼及其腱索，按固定肌肉身份设置颜色与路径宽度；不改动已保存动力学记录。视角参数、画布大小及颜色表写入 `views.json`。相机瞳距为0，投影和画面使用同一视锥。

`render_views.py --preview` 只制作静态预览和本地投影核对图，不重新求解物理。

## 校验范围

`npm test`：帧边界、全帧往返、资源路径、视频哈希、身份/颜色和数据结构。

`verify_data.py`：解码五个视频检查帧数/FPS/时长，检查投影数据范围，从七个保存状态复算肌肉量，并将传动力臂与有限差分比较。

网页还需手动检查播放中切换视角、暂停跳转、放大/平移、截图和不同屏幕尺寸。数值一致性检查不代替生物力学或临床验证。

## 重建静态站点

配置禁止 Vite 自动清空旧 `dist`。重复构建前将已确认由本项目生成且未被手改的旧 `dist` 移至恢复目录，再 `npm run build`，避免旧哈希文件混入发布包。CI 每次使用全新检出，不存在该问题。
