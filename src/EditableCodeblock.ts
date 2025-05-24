/**
 * General editable code blocks based on shiki/prismjs
 * 
 * This will gradually be modified into a universal module that does not rely on obsidian
 */ 

import { type App, loadPrism, type MarkdownPostProcessorContext, Notice } from 'obsidian';
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

// Class definitions in rust style, The object is separated from the implementation
export class EditableCodeblock {
	plugin: { app: App; settings: Settings };
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	codeblockInfo: CodeblockInfo;

	constructor(plugin: { app: App; settings: Settings }, language_old:string, source_old:string, el:HTMLElement, ctx:MarkdownPostProcessorContext) {
		this.plugin = plugin
		this.el = el
		this.ctx = ctx
		this.codeblockInfo = EditableCodeblock.getCodeBlockInfo(language_old, source_old, el, ctx)
	}

	// Data related to codeblock
	static getCodeBlockInfo(language_old:string, source_old:string, el:HTMLElement, ctx:MarkdownPostProcessorContext): CodeblockInfo {
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
		void this.renderPre(span).then().catch()

		// #region textarea
		const textarea = document.createElement('textarea'); div.appendChild(textarea);
		const attributes = {
			'resize-none': '', 'autocomplete': 'off', 'autocorrect': 'off', 'autocapitalize': 'none', 'spellcheck': 'false',
		};
		Object.entries(attributes).forEach(([key, val]) => {
			textarea.setAttribute(key, val);
		});
		textarea.value = this.codeblockInfo.source;
		// textarea - async part
		textarea.oninput = (ev): void => {
			const newValue = (ev.target as HTMLTextAreaElement).value
			this.codeblockInfo.source = newValue
			void this.renderPre(span)
		}
		textarea.onchange = (ev): void => { // save must on oninput: avoid: textarea --update--> source update --update--> textarea (lose curosr position)
			const newValue = (ev.target as HTMLTextAreaElement).value
			this.codeblockInfo.source = newValue
			void this.saveContent(false, true)
		}
		// textarea - `tab` key、`arrow` key
		textarea.addEventListener('keydown', (ev: KeyboardEvent) => {
			if (ev.key == 'Tab') {
				ev.preventDefault()
				const value = textarea.value
				const selectionStart: number = textarea.selectionStart
				const selectionEnd: number = textarea.selectionEnd
				const lineStart: number = value.lastIndexOf('\n', selectionStart - 1) + 1
				const lineEnd: number = value.indexOf('\n', selectionStart)
				const lineCurrent: string = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd)
				// TODO enhamce: determine whether to insert the tab directly or the entire line of tabs based on the cursor

				// get indent, auto indent
				const configUseTab = this.plugin.app.vault.getConfig('useTab')
				const configTabSize = this.plugin.app.vault.getConfig('tabSize')
				const indent_space = ' '.repeat(configTabSize)
				let indent = configUseTab ? '\t' : indent_space
				if (lineCurrent.startsWith('\t')) indent = '\t'
				else if (lineCurrent.startsWith(' ')) indent = indent_space
				
				// change
				// new value: cursorBefore + tab + cusrorAfter
				textarea.value = textarea.value.substring(0, selectionStart) + indent + textarea.value.substring(selectionEnd)
				// new cursor pos
				textarea.selectionStart = textarea.selectionEnd = selectionStart + indent.length;
				textarea.dispatchEvent(new InputEvent('input', {
					inputType: 'insertText',
					data: indent,
					bubbles: true,
					cancelable: true
				}))
			}
			else if (ev.key == 'ArrowDown' || ev.key == 'ArrowRight') {
				const selectionEnd: number = textarea.selectionEnd
				if (selectionEnd != textarea.value.length) return

				const editor = this.plugin.app.workspace.activeEditor?.editor;
				if (!editor) return

				const sectionInfo = this.ctx.getSectionInfo(this.el);
				if (!sectionInfo) return

				ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange`
				const toLine = sectionInfo.lineEnd + 1
				if (toLine > editor.lineCount() - 1) { // when codeblock on the last line
					// strategy1: only move to end
					// toLine--

					// strategy2: insert a blank line
					const lastLineIndex = editor.lineCount() - 1
					const lastLineContent = editor.getLine(lastLineIndex)
					editor.replaceRange("\n", { line: lastLineIndex, ch: lastLineContent.length })
					
				}
				editor.setCursor(toLine, 0)
				editor.focus()
			}
			else if (ev.key == 'ArrowUp' || ev.key == 'ArrowLeft') {
				const selectionStart: number = textarea.selectionStart
				if (selectionStart != 0) return

				const editor = this.plugin.app.workspace.activeEditor?.editor;
				if (!editor) return

				const sectionInfo = this.ctx.getSectionInfo(this.el);
				if (!sectionInfo) return

				ev.preventDefault() // safe: tested: `prevent` can still trigger `onChange`
				let toLine = sectionInfo.lineStart - 1
				if (toLine < 0) { // when codeblock on the frist line
					// strategy1: only move to start
					// toLine = 0

					// strategy2: insert a blank line
					toLine = 0
					editor.replaceRange("\n", { line: 0, ch: 0 })
				}
				editor.setCursor(toLine, 0)
				editor.focus()
			}
		})
		// #endregion

		// #region language-edit
		// language-edit
		const editEl = document.createElement('div'); div.appendChild(editEl); editEl.classList.add('language-edit');
		editEl.setAttribute('align', 'right'); editEl.setAttribute('contenteditable', '');
		const editInput = document.createElement('input'); editEl.appendChild(editInput);
		editInput.value = this.codeblockInfo.language_type + this.codeblockInfo.language_meta
		// language-edit - async part
		editInput.oninput = (ev): void => {
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
			void this.saveContent(true, false)
		}
		// #endregion
	}

	/**
	 * Render code to targetEl
	 * 
	 * @param targetEl in which element should the result be rendered
	 */
	async renderPre(targetEl:HTMLElement): Promise<void> {
		// source correct.
		// When the last line of the source is blank (with no Spaces either),
		// prismjs and shiki will both ignore the line,
		// this causes `textarea` and `pre` to fail to align.
		let source: string = this.codeblockInfo.source ?? this.codeblockInfo.source_old
		if (source.endsWith('\n')) source += '\n'

		// pre html string - shiki
		if (this.plugin.settings.renderEngine == 'shiki') {
			// check theme, TODO: use more theme
			let theme = ''
			for (const item of bundledThemesInfo) {
				if (item.id == this.plugin.settings.theme) { theme = this.plugin.settings.theme; break }
			}
			if (theme === '') {
				theme = 'andromeeda'
				console.warn(`no support theme '${this.plugin.settings.theme}' temp in this render mode`)
			}

			const pre:string = await codeToHtml(source, {
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
			targetEl.innerHTML = pre // prism use textContent and shiki use innerHTML, Their escapes from `</>` are different
		}
		// pre html string - prism
		else {
			const prism = await loadPrism() as typeof Prism;
			if (!prism) {
				new Notice('warning: withou Prism')
				throw new Error('warning: withou Prism')
			}
			targetEl.innerHTML = ''
			const pre = document.createElement('pre'); targetEl.appendChild(pre);
			const code = document.createElement('code'); pre.appendChild(code); code.classList.add('language-'+this.codeblockInfo.language_type);
			code.textContent = source; // prism use textContent and shiki use innerHTML, Their escapes from `</>` are different
			prism.highlightElement(code)
		}
	}

	/**
	 * Save textarea text content to codeBlock markdown source
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
		const editor = this.plugin.app.workspace.activeEditor?.editor;
		if (!editor) {
			new Notice("Warning: without editor!", 3000)
			return;
		}

		// change - language
		if (isUpdateLanguage) {
			editor.transaction({
				changes: [{
					from: {line: sectionInfo.lineStart, ch: 0},
					to: {line: sectionInfo.lineStart+1, ch: 0},
					text: this.codeblockInfo.flag + this.codeblockInfo.language_type + this.codeblockInfo.language_meta + '\n'
				}],
			});
		}

		// change - source
		if (isUpdateSource) {
			editor.transaction({
				changes: [{
					from: {line: sectionInfo.lineStart+1, ch: 0},
					to: {line: sectionInfo.lineEnd, ch: 0},
					text: (this.codeblockInfo.source ?? this.codeblockInfo.source_old) + '\n'
				}],
			});
		}
	}
}
