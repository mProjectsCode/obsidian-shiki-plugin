/**
 * General editable code blocks based on shiki/prismjs
 * 
 * This will gradually be modified into a universal module that does not rely on obsidian
 */ 

// 丢弃依赖
// import {
// 	type App,
// 	debounce,
// 	type Editor,
// 	loadPrism,
// 	type MarkdownPostProcessorContext,
// 	Notice,
// 	MarkdownRenderer,
// 	MarkdownRenderChild,
// 	MarkdownView,
// } from 'obsidian';
// import { type Settings } from 'src/settings/Settings';
// import { EditorState } from '@codemirror/state';
// import { EditorView, type ViewUpdate } from '@codemirror/view';
// import { markdown } from "@codemirror/lang-markdown";
// import { basicSetup } from "@codemirror/basic-setup";
// import { getEmbedEditor, makeFakeController } from "src/EditableEditor"

import { LLOG } from 'src/general/LLogInOb';

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

export const loadPrism2 = {
	// can override
	fn: async (): Promise<null> => { return null }
}

/**
 * Codeblock Info.
 * Life cycle: One codeblock has one.
 * Pay attention to consistency.
 */
export interface CodeblockInfo {
	// outside editor (option, use when codeblock in another editable area)
	// from ctx.getSectionInfo(el) // [!code warning] There may be indentation
	prefix: string, // `> - * + ` // [!code warning] Because of the list nest, first-line indentation is not equal to universal indentation.
	flag: string, // (```+|~~~+)
	language_meta: string, // allow both end space, allow blank
	language_type: string, // source code, can be an alias
	source: string|null,

	// inner editor
	// from obsidian callback args // [!code warning] It might be old data in oninput/onchange method
	language_old: string, // to lib, can't be an alias
	source_old: string,
}

// RAII, use: setValue -> refresh -> getValue -> reSetNull
let global_refresh_cache: null|{start:number, end:number} = null
// let global_isLiveMode_cache: boolean = true // TODO can add option, default cm or readmode // TODO add a state show: isSaved

// Class definitions in rust style, The object is separated from the implementation
export abstract class EditableCodeblock {
	el: HTMLElement;

	// 丢弃依赖
	// plugin: { app: App; settings: Settings };
	// ctx: MarkdownPostProcessorContext;
	// editor: Editor|null; // Cache to avoid focus changes. And the focus point may not be correct when creating the code block. It can be updated again when oninput
	
	// redundancy
	isReadingMode: boolean = false; // uneditable when true
	isMarkdownRendered: boolean = false;  // uneditable when true
	settings: {
		theme: string;
		renderMode: 'textarea'|'pre'|'editablePre'|'codemirror';
		renderEngine: 'shiki'|'prismjs';
		saveMode: 'onchange'|'oninput'
	} = {
		theme: 'obsidian-theme',
		renderMode: 'textarea',
		renderEngine: 'shiki',
		saveMode: 'onchange'
	}
	config: {
		useTab: boolean;
		tabSize: number;
	} = {
		useTab: true,
		tabSize: 4,
	}

	codeblockInfo: CodeblockInfo;

	constructor(language_old:string, source_old:string, el:HTMLElement) {
		// 丢弃依赖
		// this.plugin = plugin
		// this.ctx = ctx
		// this.isReadingMode = ctx.containerEl.hasClass('markdown-preview-section') || ctx.containerEl.hasClass('markdown-preview-view');
		// this.isMarkdownRendered = !ctx.el.hasClass('.cm-preview-code-block') && ctx.el.hasClass('markdown-rendered') // TODO fix: can't check codeblock in Editor codeblock

		this.el = el
		this.codeblockInfo = EditableCodeblock.createCodeBlockInfo(language_old, source_old, el)
		this.codeblockInfo.source = this.codeblockInfo.source_old
		this.update_outEditor()
	}

	/// if editableCodeBlock in a editableArea, update outside editor
	update_outEditor(): void {}

	// Data related to codeblock
	static createCodeBlockInfo(language_old:string, source_old:string, el:HTMLElement): CodeblockInfo {
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

	/**
	 * param this.settings.saveMode onchange/oninput
	 * 
	 * onCall: renderMode === 'textarea'
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
		let isComposing = false; // Is in the input method combination stage. Can fix input method (like chinese) invalid. The v-model in the Vue version also has this problem.
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
		if (this.settings.saveMode == 'onchange') {
			textarea.oninput = (ev): void => {
				if (isComposing) return
				this.update_outEditor()

				const newValue = (ev.target as HTMLTextAreaElement).value
				this.codeblockInfo.source = newValue
				void this.renderPre(span)
				div.classList.add('is-no-saved');
			}
			// TODO: fix: not emit onchange when no change, and is-no-saved class will not remove. 
			textarea.onchange = (ev): void => { // save must on oninput: avoid: textarea --update--> source update --update--> textarea (lose curosr position)
				const newValue = (ev.target as HTMLTextAreaElement).value
				this.codeblockInfo.source = newValue
				div.classList.remove('is-no-saved'); void this.saveContent_safe(false, true)
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
				this.update_outEditor()

				const newValue = (ev.target as HTMLTextAreaElement).value
				this.codeblockInfo.source = newValue
				void this.renderPre(span)

				global_refresh_cache = {
					start: textarea.selectionStart,
					end: textarea.selectionEnd,
				}
				div.classList.remove('is-no-saved'); void this.saveContent_safe(false, true)
			}
		}
		// #endregion

		// #region language-edit - async part
		if (this.settings.saveMode != 'oninput') {
			// no support
		}
		{
			editInput.oninput = (ev): void => {
				if (isComposing) return
				this.update_outEditor()

				const newValue = (ev.target as HTMLInputElement).value
				const match = /^(\S*)(\s?.*)$/.exec(newValue)
				if (!match) throw new Error('This is not a regular expression matching that may fail')
				this.codeblockInfo.language_type = match[1]
				this.codeblockInfo.language_meta = match[2]
				void this.renderPre(span)
				div.classList.add('is-no-saved'); 
			}
			editInput.onchange = (ev): void => { // save must on oninput: avoid: textarea --update--> source update --update--> textarea (lose curosr position)
				const newValue = (ev.target as HTMLInputElement).value
				const match = /^(\S*)(\s?.*)$/.exec(newValue)
				if (!match) throw new Error('This is not a regular expression matching that may fail')
				this.codeblockInfo.language_type = match[1]
				this.codeblockInfo.language_meta = match[2]
				div.classList.remove('is-no-saved'); void this.saveContent_safe(true, false)
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
	 * param this.settings.saveMode onchange/oninput
	 * 
	 * onCall: renderMode === 'editablePre'
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
		if (!pre || !code) { LLOG.error('render failed. can\'t find pre/code 1'); return }
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
		if (this.settings.saveMode == 'onchange') {
			void Promise.resolve().then(() => {
				if (!global_refresh_cache) return
				if (!pre || !code) { LLOG.error('render failed. can\'t find pre/code 11'); global_refresh_cache = null; return }
				this.renderEditablePre_restoreCursorPosition(pre, global_refresh_cache.start, global_refresh_cache.end)
				global_refresh_cache = null
			})
			code.oninput = (ev): void => {
				if (isComposing) return
				if (!pre || !code) { LLOG.error('render failed. can\'t find pre/code 12'); return }
				this.update_outEditor()

				const newValue = (ev.target as HTMLPreElement).innerText // .textContent more fast, but can't get new line by 'return' (\n yes, br no)
				this.codeblockInfo.source = newValue
				
				void Promise.resolve().then(async () => { // like vue nextTick, ensure that the cursor is behind
					pre = div.querySelector(':scope>pre')
					code = div.querySelector(':scope>pre>code')
					if (!pre || !code) { LLOG.error('render failed. can\'t find pre/code 13'); global_refresh_cache = null; return }

					// save pos
					global_refresh_cache = this.renderEditablePre_saveCursorPosition(pre)

					// pre, code
					await this.renderPre(div, code)
					div.classList.add('is-no-saved');

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
				div.classList.remove('is-no-saved'); void this.saveContent_safe(false, true)
			})
		}
		// refresh/save strategy2: cache and rebuild
		else {
			void Promise.resolve().then(() => {
				if (!global_refresh_cache) return
				if (!pre || !code) { LLOG.error('render failed. can\'t find pre/code 21'); global_refresh_cache = null; return }
				this.renderEditablePre_restoreCursorPosition(pre, global_refresh_cache.start, global_refresh_cache.end)
				global_refresh_cache = null
			})
			code.oninput = (ev): void => {
				if (isComposing) return
				if (!pre || !code) { LLOG.error('render failed. can\'t find pre/code 22'); return }
				this.update_outEditor()

				const newValue = (ev.target as HTMLPreElement).innerText // .textContent more fast, but can't get new line by 'return' (\n yes, br no)
				this.codeblockInfo.source = newValue
				void this.renderPre(div)


				global_refresh_cache = this.renderEditablePre_saveCursorPosition(pre)
				div.classList.remove('is-no-saved'); void this.saveContent_safe(false, true)
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

	// /**
	//  * @deprecated There will be a strong sense of lag, and the experience is not good.
	//  * you should use `renderPre` version
	//  */
	// renderPre_debounced = debounce(async (targetEl:HTMLElement): Promise<void> => {
	// 	void this.renderPre(targetEl)
	// 	LLOG.log('debug renderPre debounced')
	// }, 200)

	/**
	 * Render code to targetEl
	 * 
	 * onCall: renderMode === 'pre'
	 * 
	 * param this.settings.renderEngine shiki/prism
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
		if (this.settings.renderEngine == 'shiki') {
			// check theme, TODO: use more theme
			let theme = ''
			for (const item of bundledThemesInfo) {
				if (item.id == this.settings.theme) { theme = this.settings.theme; break }
			}
			if (theme === '') {
				theme = 'andromeeda'
				// LLOG.warn(`no support theme '${this.settings.theme}' temp in this render mode`) // [!code error] TODO fix
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
				if (!codeElement) { LLOG.error('shiki return preStr without code tag', doc); return }
				code.innerHTML = codeElement.innerHTML
			}
		}
		// pre html string - prism, insert `<pre>...<pre/>`
		else {
			const prism = await loadPrism2.fn() as typeof Prism|null;
			if (!prism) {
				LLOG.error('warning: withou Prism')
				return
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

	/// TODO: fix: after edit, can't up/down to root editor
	/// @param el: HTMLTextAreaElement|HTMLInputElement|HTMLPreElement
	enableTabEmitIndent(el: HTMLElement, cb_tab?: (ev: KeyboardEvent)=>void, cb_up?: (ev: KeyboardEvent)=>void, cb_down?: (ev: KeyboardEvent)=>void): void {
		if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) return

		// #region textarea - async part - keydown
		el.addEventListener('keydown', (ev: KeyboardEvent) => { // `tab` key、~~`arrow` key~~
			if (ev.key == 'Tab') {
				if (cb_tab) { cb_tab(ev); return }
				ev.preventDefault()

				// get indent
				const indent_space = ' '.repeat(this.config.tabSize)
				let indent = this.config.useTab ? '\t' : indent_space
				
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
		})
		// #endregion
	}

	abstract saveContent_safe(isUpdateLanguage: boolean, isUpdateSource: boolean): Promise<void>;

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
	abstract saveContent(isUpdateLanguage: boolean, isUpdateSource: boolean): Promise<void>;
}
