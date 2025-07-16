/*
 * thanks ~~https://github.com/Fevol/obsidian-criticmarkup/blob/6f2e8ed3fcf3a548875f7bd2fe09b9df2870e4fd/src/ui/embeddable-editor.ts~~
 *   https://github.com/Fevol/obsidian-criticmarkup/blob/6f2e8ed3fcf3a548875f7bd2fe09b9df2870e4fd/src/ui/embeddable-editor.ts
 * thanks https://github.com/mgmeyers/obsidian-kanban/blob/main/src/components/Editor/MarkdownEditor.tsx#L134
 *   view: KanbanView
 *   plugin: KanbanPlugin https://github.com/mgmeyers/obsidian-kanban/blob/main/src/KanbanView.tsx
 *   MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(md.editMode)).constructor; https://github.com/mgmeyers/obsidian-kanban/blob/main/src/main.ts#L41
 */

import { insertBlankLine } from '@codemirror/commands'
import { Prec, type Extension } from "@codemirror/state"
import { EditorView, keymap, ViewUpdate } from "@codemirror/view"
import { type App, type Editor, type TFile, type MarkdownView } from "obsidian"

function getEditorClass(app: App): any {
	// @ts-expect-error without embedRegistry
	const md: any = app.embedRegistry.embedByExtension.md(
		{ app: app, containerEl: createDiv(), state: {} },
		null,
		''
	)

	md.load()
	md.editable = true
	md.showEditor()

	const MarkdownEditor: any = Object.getPrototypeOf(Object.getPrototypeOf(md.editMode)).constructor;

	md.unload()

	return MarkdownEditor
}

// 伪造 controller 对象 (构造错误不影响编辑功能，但影响保存功能)
// 对应 ctx.containerEl div.cm-scroller
export function makeFakeController(app: App, view: MarkdownView|null, getEditor: () => Editor|null): Record<any, any> {
	return {
		app,
		showSearch: (): void => { },
		toggleMode: (): void => { },
		onMarkdownScroll: (): void => { },
		getMode: () => "source",
		scroll: 0,
		editMode: null,
		get editor(): Editor | null { return getEditor(); },
		get file(): TFile | null | undefined { return view?.file; },
		get path(): string { return view?.file?.path ?? ""; }
	}
}

// let extensions: any = null // global

/**
 * event:
 * - 'Enter'/'Shift Enter': newLine
 * - 'Esc': (emitFinish) save and switch real-live-mode/read-mode
 * - 'blur': (emitSave) save but no switch
 * - 'update': no work
 */
export function getEmbedEditor(
	app: App,
	emitFinish: (cm: EditorView) => void,
	emitSave: (cm: EditorView) => void,
	onChange: (cupdate: ViewUpdate, changed: boolean) => void,
): any {
	// if (extensions !== null) return extensions

	const MarkdownEditor = getEditorClass(app)

	class EmbedEditor extends MarkdownEditor {
		buildLocalExtensions(): Extension[] {
			// obsidian自带扩展 (无法兼容插件扩展的行为)
			const extensions = super.buildLocalExtensions();

			// 管理和同步看板的状态
			// extensions.push(stateManagerField.init(() => stateManager));

			// 日期插件
			// extensions.push(datePlugins);

			// 为编辑器添加 focus 和 blur 事件的监听器
			extensions.push(
				Prec.highest(
					EditorView.domEventHandlers({
						// focus: (event: FocusEvent, view: EditorView) => {
						// 	view.activeEditor = this.owner;
						// 	if (Platform.isMobile) {
						// 		view.contentEl.addClass('is-mobile-editing');
						// 	}
			
						// 	evt.win.setTimeout(() => {
						// 		this.app.workspace.activeEditor = this.owner;
						// 		if (Platform.isMobile) {
						// 			app.mobileToolbar.update();
						// 		}
						// 	});
						// 	return true;
						// },
						blur: (event: FocusEvent, view: EditorView) => {
							emitSave(view)
							return true;
						},
					})
				)
			)

			// 如果传入了 placeholder，则为编辑器设置输入占位符提示文字
			// if (placeholder) extensions.push(placeholderExt(placeholder));

			// 添加 paste 事件监听，如果传入了 onPaste，则处理粘贴事件，例如自定义内容粘贴行为
			// if (onPaste) {
			// 	extensions.push(
			// 		Prec.high(
			// 			EditorView.domEventHandlers({
			// 				paste: onPaste,
			// 			})
			// 		)
			// 	);
			// }

			// 监听按键 (Esc/Enter退出编辑，Mod(Shift)+Enter才是换行)
			extensions.push(
				Prec.highest(
					keymap.of([
						{
							key: 'Enter',
							run: (cm: EditorView): boolean => {
								// 根据 Obsidian 的智能缩进配置，决定换行方式
								if (this.app.vault.getConfig('smartIndentList')) {
									this.editor.newlineAndIndentContinueMarkdownList()
								} else {
									insertBlankLine(cm as any);
								}
								return true
							},
							shift: (): boolean => { return false },
							preventDefault: true,
						},
						{
							key: 'Mod-Enter',
							run: (cm: EditorView): boolean => {
								// 根据 Obsidian 的智能缩进配置，决定换行方式
								if (this.app.vault.getConfig('smartIndentList')) {
									this.editor.newlineAndIndentContinueMarkdownList()
								} else {
									insertBlankLine(cm as any);
								}
								return true
							},
							shift: (): boolean => { return true },
							preventDefault: true,
						},
						{
							key: 'Escape',
							run: (cm: EditorView): boolean => {
								emitFinish(cm)
								return false
							},
							preventDefault: true,
						},
					])
				)
			)

			return extensions;
		}

		onUpdate(update: ViewUpdate, changed: boolean): void {
			super.onUpdate(update, changed)
				onChange(update, changed)
		}
	}

	return EmbedEditor
}

// old strategy backup
/*else if (this.editor) {
	// // @ts-expect-error Editor without cm
	const obCmView: EditorView = this.editor.cm
	const obCmState: EditorState = obCmView.state
	
	// Strategy 2：直接clone state，只改doc. bug: 无法加入修改检测
	const cmState = obCmState.update({
		changes: { from: 0, to: obCmState.doc.length, insert: this.codeblockInfo.source ?? this.codeblockInfo.source_old },
	}).state
	new EditorView({ // const cmView =
		state: cmState,
		parent: divContent // targetEl
	})

	// Strategy 3：只取extensions，生成新state. bug: ~~很难拿到全部的extension，拿到的那个基本没用~~ 有extension也似乎不起作用
	const obView: MarkdownView|null = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
	const controller = makeFakeController(this.plugin.app, obView??null, () => this.editor)
	const containerEl = document.createElement("div")
	// // @ts-expect-error
	const embedEditor: EmbedEditor = new EmbedEditor(app, containerEl, controller)
	const obExtensions: any = embedEditor.buildLocalExtensions()
	const cmState = EditorState.create({
		doc: this.codeblockInfo.source ?? this.codeblockInfo.source_old,
		extensions: [
			// basicSetup,
			// markdown(),
			...obExtensions,
			// EditorView.updateListener.of(update => {
			// 	if (update.docChanged) {
			// 		this.codeblockInfo.source = update.state.doc.toString();
			// 	}
			// })
		]
	})
	new EditorView({ // const cmView =
		state: cmState,
		parent: divContent // targetEl
	})
}
else {
	Strategy 5 - HyperMD, but need hyperMD and codemirror same orgin
	const divTextarea = document.createElement('textarea'); divContent.appendChild(divTextarea);
	divTextarea.textContent = this.codeblockInfo.source ?? this.codeblockInfo.source_old
	const editor = HyperMD.fromTextArea(divTextarea, {
		mode: 'text/x-hypermd',
		lineNumbers: false,
	})

	Strategy 6 - MarkdownEditView, but it is difficult to create within the specified div.
	const leaf = this.plugin.app.workspace.getLeaf(true);
	const mdView = new MarkdownView(leaf)
	const mdEditView = new MarkdownEditView(mdView)

	Strategy 7 - innerText, but without render
	divContent.innerText = this.codeblockInfo.source ?? this.codeblockInfo.source_old
}
*/
