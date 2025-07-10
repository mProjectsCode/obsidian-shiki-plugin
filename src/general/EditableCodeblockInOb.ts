import { EditableCodeblock, loadPrism2, type OuterInfo } from 'src/general/EditableCodeblock'

// add `obsidian` and `cm` dependencies
import {
	type App,
	debounce,
	type Editor,
	loadPrism,
	type MarkdownPostProcessorContext,
	MarkdownRenderer,
	MarkdownRenderChild,
	MarkdownView,
} from 'obsidian';
import { type Settings } from 'src/settings/Settings';
import { EditorState } from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { markdown } from "@codemirror/lang-markdown";
import { basicSetup } from "@codemirror/basic-setup";
import { getEmbedEditor, makeFakeController } from "src/EditableEditor"

import { LLOG } from 'src/general/LLogInOb';

loadPrism2.fn = loadPrism

const reg_code = /^((\s|>\s|-\s|\*\s|\+\s)*)(```+|~~~+)(\S*)(\s?.*)/
// const reg_code_noprefix = /^((\s)*)(```+|~~~+)(\S*)(\s?.*)/

export default class EditableCodeblockInOb extends EditableCodeblock {
	// 新增依赖
	plugin: { app: App; settings: Settings };
	ctx: MarkdownPostProcessorContext;
	editor: Editor|null = null; // Cache to avoid focus changes. And the focus point may not be correct when creating the code block. It can be updated again when oninput

	constructor(plugin: { app: App; settings: Settings }, language_old:string, source_old:string, el:HTMLElement, ctx:MarkdownPostProcessorContext) {
		super(language_old, source_old, el)

		// 新增依赖
		this.plugin = plugin
		this.ctx = ctx
		this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null
		this.isReadingMode = ctx.containerEl.hasClass('markdown-preview-section') || ctx.containerEl.hasClass('markdown-preview-view');
		this.isMarkdownRendered = !ctx.el.hasClass('.cm-preview-code-block') && ctx.el.hasClass('markdown-rendered') // TODO fix: can't check codeblock in Editor codeblock

		// override
		this.outerInfo = this.init_outerInfo2(language_old, source_old, el, ctx)
	}

	/// TODO: fix: after edit, can't up/down to root editor
	/// @param el: HTMLTextAreaElement|HTMLInputElement|HTMLPreElement
	override enable_editarea_listener(el: HTMLElement, cb_tab?: (ev: KeyboardEvent)=>void, cb_up?: (ev: KeyboardEvent)=>void, cb_down?: (ev: KeyboardEvent)=>void): void {
		if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) return

		super.enable_editarea_listener(el, cb_tab, cb_up, cb_down) // `tab`

		el.addEventListener('focus', () => {
			// update_outEditor()
			this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null
		})

		// textarea - async part - keydown
		el.addEventListener('keydown', (ev: KeyboardEvent) => { // ~~`tab` key~~、`arrow` key	
			if (ev.key == 'ArrowDown') {
				if (cb_down) { cb_down(ev); return }
				if (!this.editor) return

				// check is the last line
				if (el instanceof HTMLInputElement) {
					// true
				} else if (el instanceof HTMLTextAreaElement) {
					const selectionEnd: number = el.selectionEnd
					const textBefore = el.value.substring(0, selectionEnd)
					const linesBefore = textBefore.split('\n')
					if (linesBefore.length !== el.value.split('\n').length) return
				} else {
					// TODO
					return
				}
				
				const sectionInfo = this.ctx.getSectionInfo(this.el);
				if (!sectionInfo) return

				ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange`
				const toLine = sectionInfo.lineEnd + 1
				if (toLine > this.editor.lineCount() - 1) { // when codeblock on the last line
					// strategy1: only move to end
					// toLine--

					// strategy2: insert a blank line
					const lastLineIndex = this.editor.lineCount() - 1
					const lastLineContent = this.editor.getLine(lastLineIndex)
					this.editor.replaceRange("\n", { line: lastLineIndex, ch: lastLineContent.length })
				}
				this.editor.setCursor(toLine, 0)
				this.editor.focus()
				return
			}
			else if (ev.key == 'ArrowUp') {
				if (cb_up) { cb_up(ev); return }
				if (!this.editor) return

				// check is the first line
				if (el instanceof HTMLInputElement) {
					// true
				} else if (el instanceof HTMLTextAreaElement) {
					const selectionStart: number = el.selectionStart
					const textBefore = el.value.substring(0, selectionStart)
					const linesBefore = textBefore.split('\n')
					if (linesBefore.length !== 1) return
				} else {
					// TODO
					return
				}

				const sectionInfo = this.ctx.getSectionInfo(this.el);
				if (!sectionInfo) return

				ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange`
				let toLine = sectionInfo.lineStart - 1
				if (toLine < 0) { // when codeblock on the frist line
					// strategy1: only move to start
					// toLine = 0

					// strategy2: insert a blank line
					toLine = 0
					this.editor.replaceRange("\n", { line: 0, ch: 0 })
				}
				this.editor.setCursor(toLine, 0)
				this.editor.focus()
				return
			}
			/*else if (ev.key == 'ArrowRight') {
				if (cb_down) { cb_down(ev); return }
				if (!this.editor) return

				// check is the last char
				if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
					const selectionEnd: number|null = el.selectionEnd
					if (selectionEnd === null || selectionEnd != el.value.length) return
				} else {
					// TODO
					return
				}
				
				const sectionInfo = this.ctx.getSectionInfo(this.el);
				if (!sectionInfo) return

				ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange`
				const toLine = sectionInfo.lineEnd + 1
				if (toLine > this.editor.lineCount() - 1) { // when codeblock on the last line
					// strategy1: only move to end
					// toLine--

					// strategy2: insert a blank line
					const lastLineIndex = this.editor.lineCount() - 1
					const lastLineContent = this.editor.getLine(lastLineIndex)
					this.editor.replaceRange("\n", { line: lastLineIndex, ch: lastLineContent.length })
				}
				this.editor.setCursor(toLine, 0)
				this.editor.focus()
				return
			}
			else if (ev.key == 'ArrowLeft') {
				if (cb_up) { cb_up(ev); return }
				if (!this.editor) return

				// check is the first char
				if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
					const selectionStart: number|null = el.selectionStart
					if (selectionStart === null || selectionStart != 0) return
				} else {
					// TODO
					return
				}

				const sectionInfo = this.ctx.getSectionInfo(this.el);
				if (!sectionInfo) return

				ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange`
				let toLine = sectionInfo.lineStart - 1
				if (toLine < 0) { // when codeblock on the frist line
					// strategy1: only move to start
					// toLine = 0

					// strategy2: insert a blank line
					toLine = 0
					this.editor.replaceRange("\n", { line: 0, ch: 0 })
				}
				this.editor.setCursor(toLine, 0)
				this.editor.focus()
				return
			}*/
		})
	}

	override async emit_save(isUpdateLanguage: boolean = true, isUpdateSource: boolean = true): Promise<void> {
		/**
		 * @deprecated You should use `saveContent_safe` version
		 */
		const saveContent_debounced = debounce(async (isUpdateLanguage: boolean = true, isUpdateSource: boolean = true) => {
			void this.emit_save_unsafe(isUpdateLanguage, isUpdateSource)
		}, 200)

		// [!code warn:3] The exception caused by the transaction cannot be caught.
		// If it fails here, there will be an error print
		// ~~so, use double save. Ensure both speed and safety at the same time.~~
		// (When adding or deleting at the end, there will be bugs in double save)
		// try {
		// } catch {
		// }
		if (this.settings.saveMode == 'oninput') {
			void this.emit_save_unsafe(isUpdateLanguage, isUpdateSource)
		}
		else if (this.settings.saveMode == 'onchange') {
			void saveContent_debounced(isUpdateLanguage, isUpdateSource)
		}
	}

	/**
	 * @deprecated can't save when cursor in codeblock and use short-key switch to source mode.
	 * You should use `saveContent_safe` version
	 */
	async emit_save_unsafe(isUpdateLanguage: boolean = true, isUpdateSource: boolean = true): Promise<void> {
		// range
		const sectionInfo = this.ctx.getSectionInfo(this.el);
		if (!sectionInfo) {
			LLOG.error("Warning: without el section!")
			return;
		}
		// sectionInfo.lineStart; // index in (```<language>)
		// sectionInfo.lineEnd;   // index in (```), Let's not modify the fence part

		// editor
		if (!this.editor) {
			LLOG.error("Warning: without editor!")
			return;
		}

		// change - language
		if (isUpdateLanguage) {
			this.editor.transaction({
				changes: [{
					from: {line: sectionInfo.lineStart, ch: 0},
					to: {line: sectionInfo.lineStart+1, ch: 0},
					text: this.outerInfo.flag + this.outerInfo.language_type + this.outerInfo.language_meta + '\n'
				}],
			});
		}

		// change - source
		if (isUpdateSource) {
			this.editor.transaction({
				changes: [{
					from: {line: sectionInfo.lineStart+1, ch: 0},
					to: {line: sectionInfo.lineEnd, ch: 0},
					text: (this.outerInfo.source ?? this.innerInfo.source_old) + '\n'
				}],
			});
		}
	}

	// ---------------------- ex, no override -------------------------

	private init_outerInfo2(language_old:string, source_old:string, el:HTMLElement, ctx: MarkdownPostProcessorContext): OuterInfo {
		const sectionInfo = ctx.getSectionInfo(el);
		if (!sectionInfo) {
			// This is possible. when rerender
			const outerInfo:OuterInfo = {
				prefix: '',
				flag: '', // null flag
				language_meta: '',
				language_type: language_old,
				source: null, // null flag
			}
			return outerInfo
		}
		// sectionInfo.lineStart; // index in (```<language>)
		// sectionInfo.lineEnd;   // index in (```), Let's not modify the fence part

		const lines = sectionInfo.text.split('\n')
		if (lines.length < sectionInfo.lineStart + 1 || lines.length < sectionInfo.lineEnd + 1) {
			// This is impossible.
			// Unless obsidian makes a mistake.
			LLOG.error('Warning: el ctx error!')
		}

		const firstLine = lines[sectionInfo.lineStart]
		const match = reg_code.exec(firstLine)
		if (!match) {
			// This is possible.
			// When the code block is nested and the first line is not a code block
			// (The smallest section of getSectionInfo is `markdown-preview-section>div`)
			const outerInfo:OuterInfo = {
				prefix: '',
				flag: '', // null flag
				language_meta: '',
				language_type: language_old,
				source: null, // null flag
			}
			return outerInfo
		}

		const outerInfo:OuterInfo = {
			prefix: match[1],
			flag: match[3],
			language_meta: match[5],
			language_type: match[4],
			source: lines.slice(sectionInfo.lineStart + 1, sectionInfo.lineEnd).join('\n'),
		}
		return outerInfo
	}

	/** editable callout
	 * 
	 * onCall: language.startWith('sk-')
	 */
	renderCallout(): void {
		// - div
		//   - divCallout
		//     - divTitle
		//       - divIcon
		//       - divInner
		//     - divContent
		//       - ( ) b1 .markdown-rendered
		//       - ( ) b2 .cm-editor > .cm-scroller > div.contenteditable
		//   - divEditBtn

		const renderMarkdown = (targetEl: HTMLElement): Promise<void> => {
			targetEl.innerHTML = ''
			const divRender = document.createElement('div'); targetEl.appendChild(divRender); divRender.classList.add('markdown-rendered');
			const mdrc: MarkdownRenderChild = new MarkdownRenderChild(divRender);
			return MarkdownRenderer.render(this.plugin.app, this.outerInfo.source ?? this.innerInfo.source_old, divRender, this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path??"", mdrc)
		}

		// div
		const div = document.createElement('div'); this.el.appendChild(div); div.classList.add(
			'cm-preview-code-block', 'cm-embed-block', 'markdown-rendered', 'admonition-parent', 'admonition-tip-parent',
		)

		// divCallout
		const divCallout = document.createElement('div'); div.appendChild(divCallout); divCallout.classList.add(
			'callout', 'admonition', 'admonition-tip', 'admonition-plugin'
		);
		divCallout.setAttribute('data-callout', this.outerInfo.language_type.slice(3)); divCallout.setAttribute('data-callout-fold', ''); divCallout.setAttribute('data-callout-metadata', '')

		// divTitle
		const divTitle = document.createElement('div'); divCallout.appendChild(divTitle); divTitle.classList.add('callout-title', 'admonition-title');
		const divIcon = document.createElement('div'); divTitle.appendChild(divIcon); divIcon.classList.add('callout-icon', 'admonition-title-icon');
		divIcon.innerHTML = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="fire" class="svg-inline--fa fa-fire fa-w-12" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M216 23.86c0-23.8-30.65-32.77-44.15-13.04C48 191.85 224 200 224 288c0 35.63-29.11 64.46-64.85 63.99-35.17-.45-63.15-29.77-63.15-64.94v-85.51c0-21.7-26.47-32.23-41.43-16.5C27.8 213.16 0 261.33 0 320c0 105.87 86.13 192 192 192s192-86.13 192-192c0-170.29-168-193-168-296.14z"></path></svg>`
		const divInner = document.createElement('div'); divTitle.appendChild(divInner); divInner.classList.add('callout-title-inner', 'admonition-title-content');
		divInner.textContent = this.outerInfo.language_type.slice(3)

		// divContent
		const divContent = document.createElement('div'); divCallout.appendChild(divContent); divContent.classList.add('callout-content', 'admonition-content');
		if (this.isReadingMode || this.isMarkdownRendered) {
			void renderMarkdown(divContent)
		}

		// divEditBtn
		const divEditBtn = document.createElement('div'); div.appendChild(divEditBtn); divEditBtn.classList.add('edit-block-button')
		divEditBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-code-2"><path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path></svg>`

		// #region divContent async part
		if (!this.isReadingMode && !this.isMarkdownRendered) {
			this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null; // 这里，通常初始化和现在的activeEditor都拿不到editor，不知道为什么
			const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)
			if (view) this.editor = view.editor
			
			const embedEditor = (): void => {
				divContent.innerHTML = ''
				
				const EmbedEditor: new (...args: any[]) => any = getEmbedEditor(
					this.plugin.app,
					(cm: EditorView) => {
						this.outerInfo.source = cm.state.doc.toString()
						void renderMarkdown(divContent) // if save but nochange, will not rerender. So it is needed.

						// global_isLiveMode_cache = false // TODO can add option, default cm or readmode
						div.classList.remove('is-no-saved'); void this.emit_save(false, true);
					},
					(cm: EditorView) => {
						this.outerInfo.source = cm.state.doc.toString()

						// global_isLiveMode_cache = true // TODO can add option, default cm or readmode
						div.classList.remove('is-no-saved'); void this.emit_save(false, true);
					},
					(update: ViewUpdate, changed: boolean) => {
						if (!changed) return
						div.classList.add('is-no-saved');
					},
				)

				if (EmbedEditor) {
					// Strategy 1: use `class EmbedEditor extends MarkdownEditor`
					const obView: MarkdownView|null = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
					const controller = makeFakeController(this.plugin.app, obView??null, () => this.editor)
					const embedEditor: Editor = new EmbedEditor(this.plugin.app, divContent, controller)
					// @ts-expect-error without set, if no set, cm style invalid
					embedEditor.set(this.outerInfo.source ?? '')
				}
				else {
					// Strategy 4 use ob extensions, but without ob style
					const cmState = EditorState.create({
						doc: this.outerInfo.source ?? this.innerInfo.source_old,
						extensions: [
							basicSetup,
							// keymap.of(defaultKeymap),
							markdown(),
							EditorView.updateListener.of(update => {
								if (update.docChanged) {
									this.outerInfo.source = update.state.doc.toString();
									div.classList.add('is-no-saved');
								}
							})
						]
					})
					new EditorView({ // const cmView =
						state: cmState,
						parent: divContent // targetEl
					})
					// async
					const elCmEditor: HTMLElement|null = divContent.querySelector('div[contenteditable=true]')
					if (!elCmEditor) {
						LLOG.warn('can\'t find elCmEditor')
						return
					}
					elCmEditor.focus()
					elCmEditor.addEventListener('blur', (): void => {
						void renderMarkdown(divContent) // if save but nochange, will not rerender. So it is needed.

						div.classList.remove('is-no-saved'); void this.emit_save(false, true);
					})
				}
			}

			// if (global_isLiveMode_cache) {
			// global_isLiveMode_cache = false // TODO can add option, default cm or readmode
			embedEditor()
			divContent.addEventListener('dblclick', () => { embedEditor() })
		}
		// #endregion
	}
}
