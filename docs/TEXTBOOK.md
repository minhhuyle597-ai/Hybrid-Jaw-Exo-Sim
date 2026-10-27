# 教材联动层

本目录在队友的同步回放器上增加了“教材解释层”，不修改 MuJoCo 数据生成与视频渲染。

## 新增文件

- `public/data/textbook.json`：教材元数据、24 个肌肉分束、5 个自由度与公开解剖参考。
- `public/data/teaching-phases.json`：0–9 s、9–16 s、16–21.4 s 三个观察片段。
- `public/data/quiz.json`：5 道与模型边界相关的自测题。
- `src/TextbookPanel.jsx`：右侧教材面板。
- `src/QuizPanel.jsx`：自测面板。
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
