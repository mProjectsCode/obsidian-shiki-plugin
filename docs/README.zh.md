# 更多文档

version: v0.5.1

## 设置面板文档

### 渲染引擎

Shiki, PrismJS，CodeMirror

- Shiki: 一个强大的代码高亮引擎。
  - 功能更加强大，更多主题和插件
  - 插件: meta标注、注释型标注。行高亮、单词高亮、差异化标注、警告/错误标注
  - 主题：近80种配色方案：你可以在 https://textmate-grammars-themes.netlify.app 中可视化选择
- PrismJS: Obsidian默认在阅读模式中使用的渲染引擎。
  - 当选择这个的时候，你也可以选用min版本的本插件，拥有更小的插件体积和更快的加载速度
  - 可以与使用obsidian主题的代码配色，可以与一些其他的obsidian风格化插件配合
- CodeMirror: Obsidian默认在实时模式中使用的渲染引擎。当前插件不支持
  - 适合实时渲染，性能尚可
  - 但代码分析比较粗糙，高亮层数少，效果较差

### 渲染方式

- textarea: 允许实时编辑，typora般的所见即所得的体验
  - WARNING: 由于该方式允许编辑文本内容，最好能在仓库定期备份的情况下使用，避免意外
- pre: 不允许实时编辑
- codemirror: V0.5.0及之前唯一支持的方式，不允许实时编辑

## Shiki扩展语法

详见: https://shiki.style/packages/transformers (可切换至中文)

这是个简单的语法总结:

- notaion 注释型标注
  - diff:            `// [!code ++]` `// [!code --]` 差异化
  - highlight:       `// [!code hl]` `// [!code highlight]` 高亮
  - word highlight:  `// [!code word:<Word>:<number>]` `// [!code word:Hello:1]` 单词高亮
  - focus:           `// [!code focus]` 聚焦
  - error level:     `// [!code error]` `// [!code warning]` 警告/错误
  - (mul line):      `// [!code highlight:3]` (多行)
- meta 元数据型标注
  - highlight:       `{1,3-4}`
  - word highlight   `/<Word>/` `/Hello/`

示例: see [../README.md](../README.md) or [Shiki document](https://shiki.style/packages/transformers)
