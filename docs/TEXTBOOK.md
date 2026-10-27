# 教材联动层

本目录在队友的同步回放器上增加了“教材解释层”，不修改 MuJoCo 数据生成与视频渲染。

## 新增文件

- `public/data/textbook.json`：教材元数据、24 个肌肉分束、5 个自由度与公开解剖参考。
- `public/data/source_catalog.json`：10 本教材的书目、版本、用途和购买或阅读链接。
- `public/data/evidence.json`：逐组结论、证据等级、教材核验状态和模型边界。
- `public/data/teaching-phases.json`：0–9 s、9–16 s、16–21.4 s 三个观察片段。
- `public/data/quiz.json`：5 道与模型边界相关的自测题。
- `src/TextbookPanel.jsx`：右侧教材面板。
- `src/QuizPanel.jsx`：自测面板。
- `src/EvidenceBoard.jsx`：教材来源与全部结论的证据总表。
- `src/teaching.css`：新增界面样式。

## 如何填写教材页码

`textbook.json` 中的 `muscles.<name>.textbook_ref` 初始为 `null`，`textbook_status` 为 `pending`。

确认教材后，把每个结构改为：

```json
{
  "textbook_ref": {
    "chapter": "第 X 章 咀嚼系统",
    "page": 58
  },
  "textbook_status": "textbook_confirmed"
}
```

未核验的内容保持 `pending`。不要在页面中使用未确认的页码。

## 教材目录

`source_catalog.json` 按以下优先级组织：

- `core`：核心必读，优先用于解剖、咬合和功能术语核对。
- `method`：方法支撑，用于公式、模型假设和生物力学概念。
- `extended`：延伸专题，只有具体问题需要时才引用。

## 证据与模型分离

`evidence.json` 不负责教材正文，只记录：

- 待核对的结构结论；
- 当前是公开参考支持、教材已核验，还是存在分歧；
- 结论对应的教材 ID；
- 模型不能证明什么。

这说明网页的数值输出和教材概念核验是两套不同证据，不能互相替代。

## 交互

- 左侧支持按编号、中文名和英文名搜索。
- “咀嚼肌、舌骨上肌群、下颌运动、力学量与边界”可以快速筛选结构。
- 右侧教材面板可以点击相关知识继续跳转。
- 底部“教材与模型证据总表”列出 10 本教材以及每条待核对结论。

## 证据等级

- `textbook_confirmed`：课程教材已核对。
- `reference_confirmed`：公开解剖学参考资料支持。
- `pending`：尚未完成课程教材页码核对。
- `model_simplification`：仅代表模型内部简化表示。

## 构建

```bash
npm ci
npm test
npm run build
```
