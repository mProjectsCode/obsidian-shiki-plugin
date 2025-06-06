import { EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { App, Editor, MarkdownView } from "obsidian";

function getEditorClass(app: App) {
	// @ts-expect-error without embedRegistry
	const md = app.embedRegistry.embedByExtension.md(
		{ app: app, containerEl: createDiv(), state: {} },
		null,
		''
	);

	md.load();
	md.editable = true;
	md.showEditor();

	const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(md.editMode)).constructor;

	md.unload();

	return MarkdownEditor;
}

// 伪造 controller 对象
export function makeFakeController(app: App, view: MarkdownView|null, getEditor: () => Editor|null): Record<any, any> {
	return {
		app,
		showSearch: () => { },
		toggleMode: () => { },
		onMarkdownScroll: () => { },
		getMode: () => "source",
		scroll: 0,
		editMode: null,
		get editor() { return getEditor(); },
		get file() { return view?.file; },
		get path() { return view?.file?.path ?? ""; }
	}
}

// let extensions: any = null // global

export function getMyEditor(app: App): any {
	// if (extensions !== null) return extensions

	const MarkdownEditor = getEditorClass(app)

	class MyEditor extends MarkdownEditor {
		buildLocalExtensions(): Extension[] {
			const extensions = super.buildLocalExtensions();

			// extensions.push(stateManagerField.init(() => stateManager));
			// extensions.push(datePlugins);
			/*extensions.push(
				Prec.highest(
					EditorView.domEventHandlers({
						focus: (evt) => {
							view.activeEditor = this.owner;
							if (Platform.isMobile) {
								view.contentEl.addClass('is-mobile-editing');
							}

							evt.win.setTimeout(() => {
								this.app.workspace.activeEditor = this.owner;
								if (Platform.isMobile) {
									app.mobileToolbar.update();
								}
							});
							return true;
						},
						blur: () => {
							if (Platform.isMobile) {
								view.contentEl.removeClass('is-mobile-editing');
								app.mobileToolbar.update();
							}
							return true;
						},
					})
				)
			);

			if (placeholder) extensions.push(placeholderExt(placeholder));
			if (onPaste) {
				extensions.push(
					Prec.high(
						EditorView.domEventHandlers({
							paste: onPaste,
						})
					)
				);
			}

			const makeEnterHandler = (mod: boolean, shift: boolean) => (cm: EditorView) => {
				const didRun = onEnter(cm, mod, shift);
				if (didRun) return true;
				if (this.app.vault.getConfig('smartIndentList')) {
					this.editor.newlineAndIndentContinueMarkdownList();
				} else {
					insertBlankLine(cm as any);
				}
				return true;
			};

			extensions.push(
				Prec.highest(
					keymap.of([
						{
							key: 'Enter',
							run: makeEnterHandler(false, false),
							shift: makeEnterHandler(false, true),
							preventDefault: true,
						},
						{
							key: 'Mod-Enter',
							run: makeEnterHandler(true, false),
							shift: makeEnterHandler(true, true),
							preventDefault: true,
						},
						{
							key: 'Escape',
							run: (cm) => {
								onEscape(cm);
								return false;
							},
							preventDefault: true,
						},
					])
				)
			);*/

			return extensions;
		}
	}

	return MyEditor
}
