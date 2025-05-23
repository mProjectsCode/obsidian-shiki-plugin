# More Document

version: v0.5.1

## SettingPanel Document

### Rendering engine

Shiki, PrismJS, CodeMirror

- Shiki: A powerful code highlighting engine.
  - More powerful functions, more themes and plugins
  - Plugins: meta annotations, annotated annotations. Line highlighting, word highlighting, differentiated annotation, warning/error annotation
  - Theme: Nearly 80 color schemes: You can visually select them at https://textmate-grammars-themes.netlify.app
- PrismJS: The rendering engine that Obsidian uses by default in reading mode.
  - When choosing this one, you can also select the min version of this plugin, which has a smaller plugin size and a faster loading speed
  - It can be color-matched with code using obsidian themes and can be used in conjunction with some other obsidian stylization plugins
- CodeMirror: Obsidian is the default rendering engine used in real-time mode. The current plugin is not supported

### Rendering method

- textarea: Allows real-time editing and offers a Typora-like WYSIWYG experience
  - WARNING: Since this method allows for the editing of text content, it is best to use it when the warehouse is regularly backed up to avoid accidents
- pre: Real-time editing is not allowed. The rendering effect is more similar to the textarea method
- codemirror: The only supported method for V0.5.0 and earlier versions, which does not allow real-time editing

## Shiki Extend Sytax

see https://shiki.style/packages/transformers for detail

This is a simple summary of grammar:

- notaion
  - diff:            `// [!code ++]` `// [!code --]`
  - highlight:       `// [!code hl]` `// [!code highlight]`
  - word highlight:  `// [!code word:<Word>:<number>]` `// [!code word:Hello:1]`
  - focus:           `// [!code focus]`
  - error level:     `// [!code error]` `// [!code warning]`
  - (mul line):      `// [!code highlight:3]`
- meta
  - highlight:       `{1,3-4}`
  - word highlight   `/<Word>/` `/Hello/`

example: see [../README.md](../README.md) or [Shiki document](https://shiki.style/packages/transformers)
