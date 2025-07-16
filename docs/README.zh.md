# 更多文档

version: v0.5.1

## 设置面板文档

### 渲染引擎

Shiki, PrismJS，CodeMirror

- Shiki: 一个强大的代码高亮引擎。
  - 功能更加强大，更多主题和插件
  - 插件: meta标注、注释型标注。行高亮、单词高亮、差异化标注、警告/错误标注
  - 主题：近80种配色方案：你可以在 https://textmate-grammars-themes.netlify.app 中可视化选择
  - *min版不包含该库，无法选用该引擎*
- PrismJS: Obsidian默认在阅读模式中使用的渲染引擎。
  - 当选择这个的时候，你也可以选用min版本的本插件，拥有更小的插件体积和更快的加载速度
  - 可以与使用obsidian主题的代码配色，可以与一些其他的obsidian风格化插件配合
- CodeMirror: Obsidian默认在实时模式中使用的渲染引擎。当前插件不支持
  - 适合实时渲染，性能尚可
  - 但代码分析比较粗糙，高亮层数少，效果较差

### 渲染方式

- textarea (默认)
  - 优点:
    允许实时编辑，typora般的所见即所得的体验
    支持编辑注释型高亮
    同为块内编辑的obsidian新版本md表格，采用的是这种方式 (但ob表格编辑时不触发重渲染)
  - 缺点:
    原理上是将textarea和pre完美重叠在一起，但容易受主题和样式影响导致不完全重叠
- pre
  - 缺点:
    不允许实时编辑
- editable pre
  - 优点:
    允许实时编辑，typora般的所见即所得的体验
    原理上是 `code[contenteditable='true']`
  - 缺点:
    程序上需要手动处理光标位置
    *不支持实时编辑注释型高亮*
- codemirror
  - 缺点:
    V0.5.0及之前唯一支持的方式，不允许实时编辑

> [!warning]
> 
> 如果选用了可实时编辑的方案，最好能在仓库定期备份的情况下使用，避免意外

### 自动保存方式

- onchange
  - 优点:
    更好的性能
    程序实现简单更简单，无需手动管理光标位置
  - 缺点:
    延时保存，特殊场景可能不会保存修改: 程序突然崩溃。当光标在代码块中时，直接切换到阅读模式，或关闭当前窗口/标签页
- oninput
  - 优点:
    实时保存，数据更安全
    同为块内编辑的obsidian新版本md表格，采用的是这种方式
  - 缺点:
    性能略差? 每次修改都要重新创建代码块
    程序需要手动管理光标位置，手动防抖。
    需要注意输入法问题，输入候选阶段也会触发 `oninput`

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
