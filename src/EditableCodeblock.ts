/**
 * General editable code blocks based on shiki/prismjs
 * 
 * This will gradually be modified into a universal module that does not rely on obsidian
 */ 

import {
	type App,
	debounce,
	type Editor,
	loadPrism,
	type MarkdownPostProcessorContext,
	Notice,
	MarkdownRenderer,
	MarkdownRenderChild,
	MarkdownView,
} from 'obsidian';
import { type Settings } from 'src/settings/Settings';

// import {
// 	// ScrollableMarkdownEditor,
// 	WorkspaceLeaf, MarkdownEditView,
// 	ViewState, livePreviewState, editorEditorField
// } from 'obsidian';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from "@codemirror/lang-markdown";
import { basicSetup } from "@codemirror/basic-setup";
import { getEmbedEditor, makeFakeController } from "src/EditableEditor"

import {
	transformerNotationDiff,
	transformerNotationHighlight,
	transformerNotationFocus,
	transformerNotationErrorLevel,
	transformerNotationWordHighlight,

	transformerMetaHighlight,
	transformerMetaWordHighlight,
} from '@shikijs/transformers';
import { bundledThemesInfo, codeToHtml } from 'shiki'; // 8.6MB
import type Prism from 'prismjs';

const reg_code = /^((\s|>\s|-\s|\*\s|\+\s)*)(```+|~~~+)(\S*)(\s?.*)/
// const reg_code_noprefix = /^((\s)*)(```+|~~~+)(\S*)(\s?.*)/

/**
 * Codeblock Info.
 * Life cycle: One codeblock has one.
 * Pay attention to consistency.
 */
export interface CodeblockInfo {
	// from ctx.getSectionInfo(el) // [!code warning] There may be indentation
	prefix: string, // `> - * + ` // [!code warning] Because of the list nest, first-line indentation is not equal to universal indentation.
	flag: string, // (```+|~~~+)
	language_meta: string, // allow both end space, allow blank
	language_type: string, // source code, can be an alias
	source: string|null,

	// from obsidian callback args // [!code warning] It might be old data in oninput/onchange method
	language_old: string, // to lib, can't be an alias
	source_old: string,
}

// RAII, use: setValue -> refresh -> getValue -> reSetNull
let global_refresh_cache: null|{start:number, end:number} = null
let global_isLiveMode_cache: boolean = false

// Class definitions in rust style, The object is separated from the implementation
export class EditableCodeblock {
	plugin: { app: App; settings: Settings };
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	editor: Editor|null; // Cache to avoid focus changes. And the focus point may not be correct when creating the code block. It can be updated again when oninput
	codeblockInfo: CodeblockInfo;

	// redundancy
	isReadingMode: boolean;
	isMarkdownRendered: boolean;

	constructor(plugin: { app: App; settings: Settings }, language_old:string, source_old:string, el:HTMLElement, ctx:MarkdownPostProcessorContext) {
		this.plugin = plugin
		this.el = el
		this.ctx = ctx
		this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null;

		this.isReadingMode = ctx.containerEl.hasClass('markdown-preview-section') || ctx.containerEl.hasClass('markdown-preview-view');
		this.isMarkdownRendered = !ctx.el.hasClass('.cm-preview-code-block') && ctx.el.hasClass('markdown-rednered')

		this.codeblockInfo = EditableCodeblock.createCodeBlockInfo(language_old, source_old, el, ctx)
		this.codeblockInfo.source = this.codeblockInfo.source_old
	}

	// Data related to codeblock
	static createCodeBlockInfo(language_old:string, source_old:string, el:HTMLElement, ctx:MarkdownPostProcessorContext): CodeblockInfo {
		const sectionInfo = ctx.getSectionInfo(el);
		if (!sectionInfo) {
			// This is possible. when rerender
			const codeblockInfo:CodeblockInfo = {
				prefix: '',
				flag: '', // null flag
				language_meta: '',
				language_type: language_old,
				source: null, // null flag

				language_old: language_old,
				source_old: source_old,
			}
			return codeblockInfo
		}
		// sectionInfo.lineStart; // index in (```<language>)
		// sectionInfo.lineEnd;   // index in (```), Let's not modify the fence part

		const lines = sectionInfo.text.split('\n')
		if (lines.length < sectionInfo.lineStart + 1 || lines.length < sectionInfo.lineEnd + 1) {
			// This is impossible.
			// Unless obsidian makes a mistake.
			new Notice("Warning: el ctx error!", 3000)
			throw new Error('Warning: el ctx error!')
		}

		const firstLine = lines[sectionInfo.lineStart]
		const match = reg_code.exec(firstLine)
		if (!match) {
			// This is possible.
			// When the code block is nested and the first line is not a code block
			// (The smallest section of getSectionInfo is `markdown-preview-section>div`)
			const codeblockInfo:CodeblockInfo = {
				prefix: '',
				flag: '', // null flag
				language_meta: '',
				language_type: language_old,
				source: null, // null flag

				language_old: language_old,
				source_old: source_old,
			}
			return codeblockInfo
		}

		const codeblockInfo:CodeblockInfo = {
			prefix: match[1],
			flag: match[3],
			language_meta: match[5],
			language_type: match[4],
			source: lines.slice(sectionInfo.lineStart + 1, sectionInfo.lineEnd).join('\n'),

			language_old: language_old,
			source_old: source_old,
		}
		return codeblockInfo
	}

	renderCallout(): void {
		// - divAd
		//   - divCallout
		//     - divTitle
		//       - divIcon
		//       - divInner
		//     - divContent
		//       - ( ) b1 .markdown-rednered
		//       - ( ) b2 .cm-editor > .cm-scroller > div.contenteditable
		//   - divEditBtn

		// divAd
		const divAd = document.createElement('div'); this.el.appendChild(divAd); divAd.classList.add(
			'cm-preview-code-block', 'cm-embed-block', 'markdown-rendered', 'admonition-parent', 'admonition-tip-parent',
		)

		// divCallout
		const divCallout = document.createElement('div'); divAd.appendChild(divCallout); divCallout.classList.add(
			'callout', 'admonition', 'admonition-tip', 'admonition-plugin'
		);
		divCallout.setAttribute('data-callout', this.codeblockInfo.language_type.slice(3)); divCallout.setAttribute('data-callout-fold', ''); divCallout.setAttribute('data-callout-metadata', '')

		// divTitle
		const divTitle = document.createElement('div'); divCallout.appendChild(divTitle); divTitle.classList.add('callout-title', 'admonition-title');
		const divIcon = document.createElement('div'); divTitle.appendChild(divIcon); divIcon.classList.add('callout-icon', 'admonition-title-icon');
		divIcon.innerHTML = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="fire" class="svg-inline--fa fa-fire fa-w-12" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M216 23.86c0-23.8-30.65-32.77-44.15-13.04C48 191.85 224 200 224 288c0 35.63-29.11 64.46-64.85 63.99-35.17-.45-63.15-29.77-63.15-64.94v-85.51c0-21.7-26.47-32.23-41.43-16.5C27.8 213.16 0 261.33 0 320c0 105.87 86.13 192 192 192s192-86.13 192-192c0-170.29-168-193-168-296.14z"></path></svg>`
		const divInner = document.createElement('div'); divTitle.appendChild(divInner); divInner.classList.add('callout-title-inner', 'admonition-title-content');
		divInner.textContent = this.codeblockInfo.language_type.slice(3)

		// divContent
		const divContent = document.createElement('div'); divCallout.appendChild(divContent); divContent.classList.add('callout-content', 'admonition-content');
		if (this.isReadingMode || this.isMarkdownRendered || !global_isLiveMode_cache) {
			divContent.innerHTML = ''
			const divRender = document.createElement('div'); divContent.appendChild(divRender); divRender.classList.add('markdown-rednered');
			const mdrc: MarkdownRenderChild = new MarkdownRenderChild(divRender);
			void MarkdownRenderer.render(this.plugin.app, this.codeblockInfo.source ?? this.codeblockInfo.source_old, divRender, this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path??"", mdrc)
		}

		// divEditBtn
		const divEditBtn = document.createElement('div'); divAd.appendChild(divEditBtn); divEditBtn.classList.add('edit-block-button')
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
						this.codeblockInfo.source = cm.state.doc.toString()
						
						divContent.innerHTML = ''
						const divRender = document.createElement('div'); divContent.appendChild(divRender); divRender.classList.add('markdown-rednered');
						const mdrc: MarkdownRenderChild = new MarkdownRenderChild(divRender);
						void MarkdownRenderer.render(this.plugin.app, this.codeblockInfo.source ?? this.codeblockInfo.source_old, divRender, this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path??"", mdrc)

						global_isLiveMode_cache = false
						void this.saveContent_safe(false, true) // if nochange, will not rerender. So the above code is needed.
					},
					(cm: EditorView) => {
						this.codeblockInfo.source = cm.state.doc.toString()

						global_isLiveMode_cache = true
						void this.saveContent_safe(false, true)
					}
				)
				// console.log('extensionsC', EmbedEditor, this.editor, this.plugin.app.workspace.activeEditor, this.plugin.app.workspace.activeEditor?.editor)
				if (EmbedEditor) {
					// Strategy 1: 使用overload后的MarkdownEditor对象
					const obView: MarkdownView|null = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
					const controller = makeFakeController(this.plugin.app, obView??null, () => this.editor)
					const embedEditor: Editor = new EmbedEditor(this.plugin.app, divContent, controller)
					// @ts-expect-error without set, if no set, cm style invalid
					embedEditor.set(this.codeblockInfo.source ?? '')
					// // @ts-expect-error without cm
					// const obCmView: EditorView = embedEditor.cm;
					// console.log('embedEditor child component cm', obCmView)
				}
				// else if (this.editor) {
				// 	// @ts-expect-error Editor without cm
				// 	const obCmView: EditorView = this.editor.cm
				// 	const obCmState: EditorState = obCmView.state
					
				// 	// Strategy 2：直接clone state，只改doc. bug: 无法加入修改检测
				// 	const cmState = obCmState.update({
				// 		changes: { from: 0, to: obCmState.doc.length, insert: this.codeblockInfo.source ?? this.codeblockInfo.source_old },
				// 	}).state
				// 	new EditorView({ // const cmView =
				// 		state: cmState,
				// 		parent: divContent // targetEl
				// 	})

				// 	// Strategy 3：只取extensions，生成新state. bug: ~~很难拿到全部的extension，拿到的那个基本没用~~ 有extension也似乎不起作用
				// 	// const obView: MarkdownView|null = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				// 	// const controller = makeFakeController(this.plugin.app, obView??null, () => this.editor)
				// 	// const containerEl = document.createElement("div")
				// 	// // @ts-expect-error
				// 	// const embedEditor: EmbedEditor = new EmbedEditor(app, containerEl, controller)
				// 	// const obExtensions: any = embedEditor.buildLocalExtensions()
				// 	// const cmState = EditorState.create({
				// 	// 	doc: this.codeblockInfo.source ?? this.codeblockInfo.source_old,
				// 	// 	extensions: [
				// 	// 		// basicSetup,
				// 	// 		// markdown(),
				// 	// 		...obExtensions,
				// 	// 		// EditorView.updateListener.of(update => {
				// 	// 		// 	if (update.docChanged) {
				// 	// 		// 		this.codeblockInfo.source = update.state.doc.toString();
				// 	// 		// 	}
				// 	// 		// })
				// 	// 	]
				// 	// })
				// 	// new EditorView({ // const cmView =
				// 	// 	state: cmState,
				// 	// 	parent: divContent // targetEl
				// 	// })
				// }
				else {
					// Strategy 4 use ob extensions, but without ob style
					const cmState = EditorState.create({
						doc: this.codeblockInfo.source ?? this.codeblockInfo.source_old,
						extensions: [
							basicSetup,
							// keymap.of(defaultKeymap),
							markdown(),
							EditorView.updateListener.of(update => {
								if (update.docChanged) {
									this.codeblockInfo.source = update.state.doc.toString();
								}
							})
						]
					})
					new EditorView({ // const cmView =
						state: cmState,
						parent: divContent // targetEl
					})

					// Strategy 5 - HyperMD, but need hyperMD and codemirror same orgin
					// const divTextarea = document.createElement('textarea'); divContent.appendChild(divTextarea);
					// divTextarea.textContent = this.codeblockInfo.source ?? this.codeblockInfo.source_old
					// const editor = HyperMD.fromTextArea(divTextarea, {
					// 	mode: 'text/x-hypermd',
					// 	lineNumbers: false,
					// })

					// Strategy 6 - MarkdownEditView, but it is difficult to create within the specified div.
					// const leaf = this.plugin.app.workspace.getLeaf(true);
					// const mdView = new MarkdownView(leaf)
					// const mdEditView = new MarkdownEditView(mdView)

					// Strategy 7 - innerText, but without render
					// divContent.innerText = this.codeblockInfo.source ?? this.codeblockInfo.source_old
				}
				
				// only use when no use extensions event
				// async // Maybe todo: async check
				// const elCmEditor: HTMLElement|null = divContent.querySelector('div[contenteditable=true]')
				// if (!elCmEditor) {
				// 	console.warn('can\'t find elCmEditor')
				// 	return
				// }
				// elCmEditor.focus()
				// elCmEditor.addEventListener('blur', (): void => {
				// 	divContent.innerHTML = ''
				// 	const divRender = document.createElement('div'); divContent.appendChild(divRender); divRender.classList.add('markdown-rednered');
				// 	const mdrc: MarkdownRenderChild = new MarkdownRenderChild(divRender);
				// 	void MarkdownRenderer.render(this.plugin.app, this.codeblockInfo.source ?? this.codeblockInfo.source_old, divRender, this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path??"", mdrc)

				// 	void this.saveContent_safe(false, true) // if nochange, will not rerender. So the above code is needed.
				// })
			}

			if (global_isLiveMode_cache) {
				global_isLiveMode_cache = false
				embedEditor()
			}
			divContent.addEventListener('dblclick', () => { embedEditor() })
		}
		// #endregion
	}

	/**
	 * param this.plugin.settings.saveMode onchange/oninput
	 */
	renderTextareaPre(): void {
		// dom
		// - div.obsidian-shiki-plugin
		//   - span > pre > code
		//   - textarea
		//   - div.language-edit
		
		// div
		const div = document.createElement('div'); this.el.appendChild(div); div.classList.add('obsidian-shiki-plugin')

		// span
		const span = document.createElement('span'); div.appendChild(span);
		void this.renderPre(span)

		// textarea
		const textarea = document.createElement('textarea'); div.appendChild(textarea);
		const attributes = {
			'resize-none': '', 'autocomplete': 'off', 'autocorrect': 'off', 'autocapitalize': 'none', 'spellcheck': 'false',
		};
		Object.entries(attributes).forEach(([key, val]) => {
			textarea.setAttribute(key, val);
		});
		textarea.value = this.codeblockInfo.source ?? this.codeblockInfo.source_old;

		// language-edit
		const editEl = document.createElement('div'); div.appendChild(editEl); editEl.classList.add('language-edit');
		editEl.setAttribute('align', 'right');
		const editInput = document.createElement('input'); editEl.appendChild(editInput);
		editInput.value = this.codeblockInfo.language_type + this.codeblockInfo.language_meta

		// readmode and markdown reRender not shouldn't change
		if (this.isReadingMode || this.isMarkdownRendered) {
			textarea.setAttribute('readonly', '')
			textarea.setAttribute('display', '')
			editInput.setAttribute('readonly', '')
			return
		}

		// #region textarea - async part - composition start/end
		let isComposing = false; // is in the input method combination stage, can fix chinese input method invalid
		textarea.addEventListener('compositionstart', () => {
			isComposing = true
		});

		textarea.addEventListener('compositionend', () => {
			isComposing = false
			// updateCursorPosition(); // (option)
		});
		// #endregion

		// #region textarea - async part - oninput/onchange
		// refresh/save strategy1: input no save
		if (this.plugin.settings.saveMode == 'onchange') {
			textarea.oninput = (ev): void => {
				if (isComposing) return

				this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null;

				const newValue = (ev.target as HTMLTextAreaElement).value
				this.codeblockInfo.source = newValue
				void this.renderPre(span)
			}
			textarea.onchange = (ev): void => { // save must on oninput: avoid: textarea --update--> source update --update--> textarea (lose curosr position)
				const newValue = (ev.target as HTMLTextAreaElement).value
				this.codeblockInfo.source = newValue
				void this.saveContent_safe(false, true)
			}
		}
		// refresh/save strategy2: cache and rebuild
		else {
			void Promise.resolve().then(() => {
				if (!global_refresh_cache) return
				// this.el.appendChild(global_refresh_cache.el)
				// const textarea: HTMLTextAreaElement|null = global_refresh_cache.el.querySelector('textarea')
				textarea.setSelectionRange(global_refresh_cache.start, global_refresh_cache.end)
				textarea.focus()
				global_refresh_cache = null
				// return
			})
			textarea.oninput = (ev): void => {
				if (isComposing) return

				this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null;

				const newValue = (ev.target as HTMLTextAreaElement).value
				this.codeblockInfo.source = newValue
				void this.renderPre(span)

				global_refresh_cache = {
					start: textarea.selectionStart,
					end: textarea.selectionEnd,
				}
				void this.saveContent_safe(false, true)
			}
		}
		// #endregion

		// #region language-edit - async part
		if (this.plugin.settings.saveMode != 'oninput') {
			// no support
		}
		{
			editInput.oninput = (ev): void => {
				if (isComposing) return

				this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null;

				const newValue = (ev.target as HTMLInputElement).value
				const match = /^(\S*)(\s?.*)$/.exec(newValue)
				if (!match) throw new Error('This is not a regular expression matching that may fail')
				this.codeblockInfo.language_type = match[1]
				this.codeblockInfo.language_meta = match[2]
				void this.renderPre(span)
			}
			editInput.onchange = (ev): void => { // save must on oninput: avoid: textarea --update--> source update --update--> textarea (lose curosr position)
				const newValue = (ev.target as HTMLInputElement).value
				const match = /^(\S*)(\s?.*)$/.exec(newValue)
				if (!match) throw new Error('This is not a regular expression matching that may fail')
				this.codeblockInfo.language_type = match[1]
				this.codeblockInfo.language_meta = match[2]
				void this.saveContent_safe(true, false)
			}
		}
		// #endregion

		// #region textarea - async part - keydown
		this.enableTabEmitIndent(textarea, undefined, undefined, (ev)=>{
			const selectionEnd: number = textarea.selectionEnd
			const textBefore = textarea.value.substring(0, selectionEnd)
			const linesBefore = textBefore.split('\n')
			if (linesBefore.length !== textarea.value.split('\n').length) return

			ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange
			editInput.setSelectionRange(0, 0)
			editInput.focus()
		})
		// #endregion

		// #region language-edit - async part - keydown
		this.enableTabEmitIndent(editInput, undefined, (ev)=>{
			ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange
			const position = textarea.value.length
			textarea.setSelectionRange(position, position)
			textarea.focus()
		}, undefined)
		// #endregion
	}

	/**
	 * param this.plugin.settings.saveMode onchange/oninput
	 */
	async renderEditablePre(): Promise<void> {
		// dom
		// - div.obsidian-shiki-plugin.editable-pre
		//   - pre
		//     - code.language-<codeType>

		// div
		const div = document.createElement('div'); this.el.appendChild(div); div.classList.add('obsidian-shiki-plugin', 'editable-pre')

		// pre, code
		await this.renderPre(div)
		let pre: HTMLPreElement|null = div.querySelector(':scope>pre')
		let code: HTMLPreElement|null = div.querySelector(':scope>pre>code')
		if (!pre || !code) { console.error('render failed. can\'t find pre/code 1'); return }
		code.setAttribute('contenteditable', 'true'); code.setAttribute('spellcheck', 'false')

		// readmode and markdown reRender not shouldn't change
		if (this.isReadingMode || this.isMarkdownRendered) {
			code.setAttribute('readonly', '')
			return
		}

		// #region code - async part - composition start/end
		let isComposing = false; // is in the input method combination stage, can fix chinese input method invalid
		code.addEventListener('compositionstart', () => {
			isComposing = true
		});

		code.addEventListener('compositionend', () => {
			isComposing = false
			// updateCursorPosition(); // (option)
		});
		// #endregion
		
		// #region code - async part - oninput/onchange
		// refresh/save strategy1: input no save
		if (this.plugin.settings.saveMode == 'onchange') {
			void Promise.resolve().then(() => {
				if (!global_refresh_cache) return
				if (!pre || !code) { console.error('render failed. can\'t find pre/code 11'); global_refresh_cache = null; return }
				this.renderEditablePre_restoreCursorPosition(pre, global_refresh_cache.start, global_refresh_cache.end)
				global_refresh_cache = null
			})
			code.oninput = (ev): void => {
				if (isComposing) return
				if (!pre || !code) { console.error('render failed. can\'t find pre/code 12'); return }

				this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null;

				const newValue = (ev.target as HTMLPreElement).innerText // .textContent more fast, but can't get new line by 'return' (\n yes, br no)
				this.codeblockInfo.source = newValue
				
				void Promise.resolve().then(async () => { // like vue nextTick, ensure that the cursor is behind
					pre = div.querySelector(':scope>pre')
					code = div.querySelector(':scope>pre>code')
					if (!pre || !code) { console.error('render failed. can\'t find pre/code 13'); global_refresh_cache = null; return }

					// save pos
					global_refresh_cache = this.renderEditablePre_saveCursorPosition(pre)

					// pre, code
					await this.renderPre(div, code)

					// restore pos
					code.setAttribute('contenteditable', 'true'); code.setAttribute('spellcheck', 'false')

					if (!global_refresh_cache) return
					this.renderEditablePre_restoreCursorPosition(pre, global_refresh_cache.start, global_refresh_cache.end)
					global_refresh_cache = null
				})
			}
			//   pre/code without onchange, use blur event
			code.addEventListener('blur', (ev): void => { // save must on oninput: avoid: textarea --update--> source update --update--> textarea (lose curosr position)
				const newValue = (ev.target as HTMLPreElement).innerText // .textContent more fast, but can't get new line by 'return' (\n yes, br no)
				this.codeblockInfo.source = newValue // prism use textContent and shiki use innerHTML, Their escapes from `</>` are different
				void this.saveContent_safe(false, true)
			})
		}
		// refresh/save strategy2: cache and rebuild
		else {
			void Promise.resolve().then(() => {
				if (!global_refresh_cache) return
				if (!pre || !code) { console.error('render failed. can\'t find pre/code 21'); global_refresh_cache = null; return }
				this.renderEditablePre_restoreCursorPosition(pre, global_refresh_cache.start, global_refresh_cache.end)
				global_refresh_cache = null
			})
			code.oninput = (ev): void => {
				if (isComposing) return
				if (!pre || !code) { console.error('render failed. can\'t find pre/code 22'); return }

				this.editor = this.plugin.app.workspace.activeEditor?.editor ?? null;

				const newValue = (ev.target as HTMLPreElement).innerText // .textContent more fast, but can't get new line by 'return' (\n yes, br no)
				this.codeblockInfo.source = newValue
				void this.renderPre(div)


				global_refresh_cache = this.renderEditablePre_saveCursorPosition(pre)
				void this.saveContent_safe(false, true)
			}
		}
		// #endregion
	
		// #region code - async part - keydown
		this.enableTabEmitIndent(code)
		// #endregion
	}

	renderEditablePre_saveCursorPosition(container: Node): null|{start: number, end: number} {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return null

		const range: Range = selection.getRangeAt(0)

		// get start
		const preRange: Range = document.createRange()
		preRange.selectNodeContents(container)
		preRange.setEnd(range.startContainer, range.startOffset)
		const start = preRange.toString().length

		return {
			start,
			end: start + range.toString().length
		}
	}
	
	renderEditablePre_restoreCursorPosition(container: Node, start: number, end: number): void {
		// get range
		const range: Range = document.createRange()
		let charIndex = 0
		let isFoundStart = false
		let isFoundEnd = false
		function traverse(node: Node): void {
			if (node.nodeType === Node.TEXT_NODE) { // pre/code is Node.ELEMENT_NODE, not inconformity
				const nextIndex = charIndex + (node.nodeValue?.length ?? 0)
				if (!isFoundStart && start >= charIndex && start <= nextIndex) { // start
					range.setStart(node, start - charIndex)
					isFoundStart = true
				}
				if (isFoundStart && !isFoundEnd && end >= charIndex && end <= nextIndex) { // end
					range.setEnd(node, end - charIndex)
					isFoundEnd = true
				}
				charIndex = nextIndex
			} 
			else {
				for (const child of node.childNodes) {
					traverse(child)
					if (isFoundEnd) break
				}
			}
		}
		traverse(container)

		const selection = window.getSelection()
		selection?.removeAllRanges()
		selection?.addRange(range)
	}

	// There will be a strong sense of lag, and the experience is not good
	/**
	 * @deprecated There will be a strong sense of lag, and the experience is not good.
	 * you should use `renderPre` version
	 */
	renderPre_debounced = debounce(async (targetEl:HTMLElement): Promise<void> => {
		void this.renderPre(targetEl)
		console.log('debug renderPre debounced')
	}, 200)

	/**
	 * Render code to targetEl
	 * 
	 * param this.plugin.settings.renderEngine shiki/prism
	 * @param targetEl in which element should the result be rendered
	 * - targetEl (usually a div)
	 *   - pre
	 *     - code
	 * @param code (option) code element, can reduce the refresh rate, avoid code blur event
	 */
	async renderPre(targetEl:HTMLElement, code?:HTMLElement): Promise<void> {
		// source correct.
		// When the last line of the source is blank (with no Spaces either),
		// prismjs and shiki will both ignore the line,
		// this causes `textarea` and `pre` to fail to align.
		let source: string = this.codeblockInfo.source ?? this.codeblockInfo.source_old
		if (source.endsWith('\n')) source += '\n'

		// pre html string - shiki, insert `<pre>...<pre/>`
		if (this.plugin.settings.renderEngine == 'shiki') {
			// check theme, TODO: use more theme
			let theme = ''
			for (const item of bundledThemesInfo) {
				if (item.id == this.plugin.settings.theme) { theme = this.plugin.settings.theme; break }
			}
			if (theme === '') {
				theme = 'andromeeda'
				// console.warn(`no support theme '${this.plugin.settings.theme}' temp in this render mode`) // [!code error] TODO fix
			}

			const preStr:string = await codeToHtml(source, {
				lang: this.codeblockInfo.language_old,
				theme: theme,
				meta: { __raw: this.codeblockInfo.language_meta },
				// https://shiki.style/packages/transformers
				transformers: [
					transformerNotationDiff({ matchAlgorithm: 'v3' }),
					transformerNotationHighlight(),
					transformerNotationFocus(),
					transformerNotationErrorLevel(),
					transformerNotationWordHighlight(),

					transformerMetaHighlight(),
					transformerMetaWordHighlight(),
				],
			})

			if (!code) {
				targetEl.innerHTML = preStr // prism use textContent and shiki use innerHTML, Their escapes from `</>` are different
			}
			else {
				const parser = new DOMParser();
  				const doc = parser.parseFromString(preStr, 'text/html');
				const codeElement = doc.querySelector('pre>code')
				if (!codeElement) { console.error('shiki return preStr without code tag', doc); return }
				code.innerHTML = codeElement.innerHTML
			}
		}
		// pre html string - prism, insert `<pre>...<pre/>`
		else {
			const prism = await loadPrism() as typeof Prism;
			if (!prism) {
				new Notice('warning: withou Prism')
				throw new Error('warning: withou Prism')
			}

			if (!code) {
				targetEl.innerHTML = ''
				const pre = document.createElement('pre'); targetEl.appendChild(pre);
				code = document.createElement('code'); pre.appendChild(code); code.classList.add('language-'+this.codeblockInfo.language_type);
			}

			code.textContent = source; // prism use textContent and shiki use innerHTML, Their escapes from `</>` are different
			prism.highlightElement(code)
		}
	}

	// el: HTMLTextAreaElement|HTMLInputElement|HTMLPreElement
	enableTabEmitIndent(el: HTMLElement, cb_tab?: (ev: KeyboardEvent)=>void, cb_up?: (ev: KeyboardEvent)=>void, cb_down?: (ev: KeyboardEvent)=>void): void {
		if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) return

		// #region textarea - async part - keydown
		el.addEventListener('keydown', (ev: KeyboardEvent) => { // `tab` key、`arrow` key	
			if (ev.key == 'Tab') {
				if (cb_tab) { cb_tab(ev); return }
				ev.preventDefault()

				// get indent
				const configUseTab = this.plugin.app.vault.getConfig('useTab')
				const configTabSize = this.plugin.app.vault.getConfig('tabSize')
				const indent_space = ' '.repeat(configTabSize)
				let indent = configUseTab ? '\t' : indent_space
				
				if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
					const value = el.value
					const selectionStart: number = el.selectionStart ?? 0
					const selectionEnd: number = el.selectionEnd ?? 0

					// auto indent (otpion)
					{
						const lineStart: number = value.lastIndexOf('\n', selectionStart - 1) + 1
						const lineEnd: number = value.indexOf('\n', selectionStart)
						const lineCurrent: string = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd)
						// TODO enhamce: determine whether to insert the tab directly or the entire line of tabs based on the cursor
						if (lineCurrent.startsWith('\t')) indent = '\t'
						else if (lineCurrent.startsWith(' ')) indent = indent_space
					}
					
					// change
					// new value: cursorBefore + tab + cusrorAfter
					el.value = el.value.substring(0, selectionStart) + indent + el.value.substring(selectionEnd)
					// new cursor pos
					el.selectionStart = el.selectionEnd = selectionStart + indent.length;
					el.dispatchEvent(new InputEvent('input', {
						inputType: 'insertText',
						data: indent,
						bubbles: true,
						cancelable: true
					}))
					return
				}
				else { // pre/code
					const selection = window.getSelection();
					if (!selection || selection.rangeCount === 0) return;
					
					// auto indent (otpion)
					let range
					{
						range = selection.getRangeAt(0)
						const container = range.startContainer
						const lineText = container.textContent ?? ''
						const lineStart = lineText.lastIndexOf('\n', range.startOffset - 1) + 1
						const lineCurrent = lineText.slice(lineStart, range.startOffset)
						if (lineCurrent.startsWith('\t')) indent = '\t'
						else if (lineCurrent.startsWith(' ')) indent = indent_space
					}
					
					// change
					// new value
					const textNode = document.createTextNode(indent)
					range.deleteContents()
					range.insertNode(textNode)
					// new cursor pos
					const newRange = document.createRange();
					newRange.setStartAfter(textNode);
					newRange.collapse(true);
					selection.removeAllRanges();
					selection.addRange(newRange);
					el.dispatchEvent(new InputEvent('input', {
						inputType: 'insertText',
						data: indent,
						bubbles: true,
						cancelable: true
					}));
					return
				}
				return
			}
			else if (ev.key == 'ArrowDown') {
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
		// #endregion
	}

	async saveContent_safe(isUpdateLanguage: boolean = true, isUpdateSource: boolean = true): Promise<void> {
		// [!code warn:3] The exception caused by the transaction cannot be caught.
		// If it fails here, there will be an error print
		// ~~so, use double save. Ensure both speed and safety at the same time.~~
		// (When adding or deleting at the end, there will be bugs in double save)
		// try {
		// } catch {
		// }
		if (this.plugin.settings.saveMode == 'oninput') {
			void this.saveContent(isUpdateLanguage, isUpdateSource)
		}
		else if (this.plugin.settings.saveMode == 'onchange') {
			void this.saveContent_debounced(isUpdateLanguage, isUpdateSource)
		}
	}

	/**
	 * @deprecated You should use `saveContent_safe` version
	 */
	saveContent_debounced = debounce(async (isUpdateLanguage: boolean = true, isUpdateSource: boolean = true) => {
		void this.saveContent(isUpdateLanguage, isUpdateSource)
	}, 200)

	/**
	 * Save textarea text content to codeBlock markdown source
	 * 
	 * @deprecated can't save when cursor in codeblock and use short-key switch to source mode.
	 * You should use `saveContent_safe` version
	 * 
	 * Data security (Importance)
	 * - Make sure `Ctrl+z` is normal: use transaction
	 * - Make sure check error: try-catch
	 * - Make sure to remind users of errors: use Notice
	 * - Avoid overwriting the original data with incorrect data, this is unacceptable
	 * 
	 * Refresh strategy1 (unable): real-time save, debounce
	 * - We need to ensure that the textarea element is not recreated when updating
	 *   the content of the code block. It should be reused to avoid changes in the cursor position.
	 * - Reduce the update frequency and the number of transactions.
	 *   Multiple calls within a certain period of time will only become one. (debounce)
	 * 
	 * Refresh strategy2 (enable): onchange emit
	 * - It is better implemented under the obsidian architecture.
	 *   Strategy1 requires additional processing: cache el
	 * - ~~Disadvantage: Can't use `ctrl+z` well in the code block.~~
	 *   textarea can be `ctrl+z` normally
	 * - Afraid if the program crashes, the frequency of save is low
	 * 
	 * Other / Universal
	 * - This should be a universal module. It has nothing to do with the logic of the plugin.
	 * - Indent process
	 * 
	 * @param isUpdateLanguage reduce modifications and minimize mistakes, can be used to increase stability
	 * @param isUpdateSource   reduce modifications and minimize mistakes, can be used to increase stability
	 */
	async saveContent(isUpdateLanguage: boolean = true, isUpdateSource: boolean = true): Promise<void> {
		// range
		const sectionInfo = this.ctx.getSectionInfo(this.el);
		if (!sectionInfo) {
			new Notice("Warning: without el section!", 3000)
			return;
		}
		// sectionInfo.lineStart; // index in (```<language>)
		// sectionInfo.lineEnd;   // index in (```), Let's not modify the fence part

		// editor
		if (!this.editor) {
			new Notice("Warning: without editor!", 3000)
			return;
		}

		// change - language
		if (isUpdateLanguage) {
			this.editor.transaction({
				changes: [{
					from: {line: sectionInfo.lineStart, ch: 0},
					to: {line: sectionInfo.lineStart+1, ch: 0},
					text: this.codeblockInfo.flag + this.codeblockInfo.language_type + this.codeblockInfo.language_meta + '\n'
				}],
			});
		}

		// change - source
		if (isUpdateSource) {
			this.editor.transaction({
				changes: [{
					from: {line: sectionInfo.lineStart+1, ch: 0},
					to: {line: sectionInfo.lineEnd, ch: 0},
					text: (this.codeblockInfo.source ?? this.codeblockInfo.source_old) + '\n'
				}],
			});
		}
	}
}
