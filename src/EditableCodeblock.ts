/**
 * General editable code blocks based on shiki/prismjs
 * 
 * This will gradually be modified into a universal module that does not rely on obsidian
 */ 

import { type App, debounce, type Editor, loadPrism, type MarkdownPostProcessorContext, Notice } from 'obsidian';
import { type Settings } from 'src/settings/Settings';

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

// Class definitions in rust style, The object is separated from the implementation
export class EditableCodeblock {
	plugin: { app: App; settings: Settings };
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	editor: Editor|undefined; // Cache to avoid focus changes. And the focus point may not be correct when creating the code block. It can be updated again when oninput
	codeblockInfo: CodeblockInfo;

	// redundancy
	isReadingMode: boolean;
	isMarkdownRendered: boolean;

	constructor(plugin: { app: App; settings: Settings }, language_old:string, source_old:string, el:HTMLElement, ctx:MarkdownPostProcessorContext) {
		this.plugin = plugin
		this.el = el
		this.ctx = ctx
		this.editor = this.plugin.app.workspace.activeEditor?.editor;

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

	/**
	 * param this.plugin.settings.saveMode onchange/oninput
	 */
	renderEditableCodeblock(): void {
		// dom
		// - div.obsidian-shiki-plugin
		//   - span > pre > code
		//   - textarea
		//   - div.language-edit
		
		// div
		const div = document.createElement('div'); this.el.appendChild(div); div.classList.add('obsidian-shiki-plugin')

		// span
		const span = document.createElement('span'); div.appendChild(span);
		this.codeblockInfo.source = this.codeblockInfo.source_old
		void this.renderPre(span)

		// textarea
		const textarea = document.createElement('textarea'); div.appendChild(textarea);
		const attributes = {
			'resize-none': '', 'autocomplete': 'off', 'autocorrect': 'off', 'autocapitalize': 'none', 'spellcheck': 'false',
		};
		Object.entries(attributes).forEach(([key, val]) => {
			textarea.setAttribute(key, val);
		});
		textarea.value = this.codeblockInfo.source;

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

				this.editor = this.plugin.app.workspace.activeEditor?.editor;

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

				this.editor = this.plugin.app.workspace.activeEditor?.editor;

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

				this.editor = this.plugin.app.workspace.activeEditor?.editor;

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
			if (selectionEnd != textarea.value.length) return

			ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange
			editInput.setSelectionRange(0, 0)
			editInput.focus()
		})
		// #endregion

		// #region language-edit - async part - keydown
		this.enableTabEmitIndent(editInput, undefined, (ev)=>{
			const selectionStart: number|null = editInput.selectionStart
			if (selectionStart === null || selectionStart != 0) return

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
		this.codeblockInfo.source = this.codeblockInfo.source_old

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

				this.editor = this.plugin.app.workspace.activeEditor?.editor;

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

				this.editor = this.plugin.app.workspace.activeEditor?.editor;

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
			else if (ev.key == 'ArrowDown' || ev.key == 'ArrowRight') {
				if (cb_down) { cb_down(ev); return }
				if (!this.editor) return

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
			else if (ev.key == 'ArrowUp' || ev.key == 'ArrowLeft') {
				if (cb_up) { cb_up(ev); return }
				if (!this.editor) return

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
			}
		})
		// #endregion
	}

	async saveContent_safe(isUpdateLanguage: boolean = true, isUpdateSource: boolean = true): Promise<void> {
		// [!code warn:3] The exception caused by the transaction cannot be caught.
		// If it fails here, there will be an error print
		// so, use double save. Ensure both speed and safety at the same time.
		// try {
		void this.saveContent(isUpdateLanguage, isUpdateSource)
		// } catch {
		void this.saveContent_debounced(isUpdateLanguage, isUpdateSource)
		// }
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
