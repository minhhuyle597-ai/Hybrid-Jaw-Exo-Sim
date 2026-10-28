# 数据格式与同步

## 文件

| 文件 | 内容 |
| --- | --- |
| `frames.json` | `meta` 与 536 个 `frames` |
| `states.npz` | `time_s`, `qpos`, `qvel`, `act`, `ctrl`，供复算 |
| `muscles.csv` | 每帧每肌肉一行，共 12,864 条数据记录，UTF-8 BOM |
| `views.json` | 5 个相机、视频路径、SHA256、24 肌肉固定编号与颜色 |
| `{view}-paths.json` | `[frame][muscle][pathPoint][x,y]`，1280×720 画布坐标 |
| `provenance.json` | 上游提交、模型/参考哈希、参数及改动 |
| `multiview-validation.json` | 本地复算及视频完整性检查 |

## 每帧字段

| 字段 | 来源 | 单位/解释 |
| --- | --- | --- |
| `time_s` | 视频 k/25 | 秒 |
| `simulation_time_s` | `data.time` | 秒，浮点积分误差可能带微小尾差 |
| `excitation[24]` | `data.ctrl` | 无单位，0–1 |
| `activation[24]` | `data.act` | 动力学激活状态，不等同于输入 |
| `length_mm[24]` | `actuator_length × 1000` | 肌肉—肌腱路径长度，mm |
| `signed_force_N[24]` | `actuator_force` | 带符号力，N；本模型牵拉通常为负 |
| `moment_arm[24][5]` | 稀疏 `actuator_moment` 还原 | 旋转列 m，平移列 m/m |
| `generalized_force[24][5]` | 逐执行器力 × 传动雅可比 | 前两列 N，后三列 N·m |
| `qpos[5]` | 广义坐标 | 前两项 m，后三项 rad |
| `incisal_mm[3]` | 切牙标记点世界坐标 | mm；网页绘制相对起点位移 |
| `target_length_mm[24]` | 参考轨迹插值 | mm；用于跟踪误差检查 |

自由度次序为 `slide_xz`, `slide_y`, `hinge_x`, `hinge_y`, `hinge_z`。力矩正负由模型坐标约定决定，不能仅凭正负判断张口/闭口功能。

## 时间同步

各视频的第 k 帧都由 `states.npz[k]` 渲染，PTS 为 k/25 秒。网页优先使用 `requestVideoFrameCallback().mediaTime`，以 `floor(time × fps)` 选择数据。暂停跳转与不支持帧回调的浏览器由 `seeked / timeupdate` 补充。

切换视角时先保存媒体时间与播放状态，等待新视角视频和路径文件就绪后恢复；加载期间不显示另一视角的旧标注。倍速只改变播放速度，不改变数据的物理时间。

## 注意

CSV 的力/力矩列保留符号。任何咬合力或关节反力研究都需要额外核验接触与约束，本数据不提供这些量。颜色只表示身份，不编码力值。
