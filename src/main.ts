import { loadPrism, Plugin, TFile, type MarkdownPostProcessor, MarkdownPostProcessorContext, Notice } from 'obsidian';
import { CodeBlock } from 'src/CodeBlock';
import { createCm6Plugin } from 'src/codemirror/Cm6_ViewPlugin';
import { DEFAULT_SETTINGS, type Settings } from 'src/settings/Settings';
import { ShikiSettingsTab } from 'src/settings/SettingsTab';
import { filterHighlightAllPlugin } from 'src/PrismPlugin';
import { CodeHighlighter } from 'src/Highlighter';

import {
	transformerNotationDiff,
	transformerNotationHighlight,
	transformerNotationFocus,
	transformerNotationErrorLevel,
	transformerNotationWordHighlight,

	transformerMetaHighlight,
	transformerMetaWordHighlight,
} from '@shikijs/transformers';
import { codeToHtml } from 'shiki'; // 8.6MB

export const SHIKI_INLINE_REGEX = /^\{([^\s]+)\} (.*)/i; // format: `{lang} code`

export default class ShikiPlugin extends Plugin {
	highlighter!: CodeHighlighter;
	activeCodeBlocks!: Map<string, CodeBlock[]>;
	settings!: Settings;
	loadedSettings!: Settings;
	updateCm6Plugin!: () => Promise<void>;

	codeBlockProcessors: MarkdownPostProcessor[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();
		this.loadedSettings = structuredClone(this.settings);
		this.addSettingTab(new ShikiSettingsTab(this));

		this.highlighter = new CodeHighlighter(this);
		await this.highlighter.load();

		this.activeCodeBlocks = new Map();

		this.registerInlineCodeProcessor();
		this.registerCodeBlockProcessors();

		this.registerEditorExtension([createCm6Plugin(this)]);

		// this is a workaround for the fact that obsidian does not rerender the code block
		// when the start line with the language changes, and we need that for the EC meta string
		this.registerEvent(
			this.app.vault.on('modify', async file => {
				// sleep 0 so that the code block context is updated before we rerender
				await sleep(100);

				if (file instanceof TFile) {
					if (this.activeCodeBlocks.has(file.path)) {
						for (const codeBlock of this.activeCodeBlocks.get(file.path)!) {
							void codeBlock.rerenderOnNoteChange();
						}
					}
				}
			}),
		);

		await this.registerPrismPlugin();
	}

	async reloadHighlighter(): Promise<void> {
		await this.highlighter.unload();

		this.loadedSettings = structuredClone(this.settings);

		await this.highlighter.load();

		for (const [_, codeBlocks] of this.activeCodeBlocks) {
			for (const codeBlock of codeBlocks) {
				await codeBlock.forceRerender();
			}
		}

		await this.updateCm6Plugin();
	}

	async registerPrismPlugin(): Promise<void> {
		/* eslint-disable */

		await loadPrism();

		const prism = await loadPrism();
		filterHighlightAllPlugin(prism);
		prism.plugins.filterHighlightAll.reject.addSelector('div.expressive-code pre code');
	}

	registerCodeBlockProcessors(): void {
		const languages = this.highlighter.obsidianSafeLanguageNames();

		for (const language of languages) {
			try {
				this.registerMarkdownCodeBlockProcessor(
					language,
					async (source, el, ctx) => {
						// @ts-expect-error
						const isReadingMode = ctx.containerEl.hasClass('markdown-preview-section') || ctx.containerEl.hasClass('markdown-preview-view');
						// this seems to indicate whether we are in the pdf export mode
						// sadly there is no section info in this mode
						// thus we can't check if the codeblock is at the start of the note and thus frontmatter
						// const isPdfExport = ctx.displayMode === true;

						// this is so that we leave the hidden frontmatter code block in reading mode alone
						if (language === 'yaml' && isReadingMode && ctx.frontmatter) {
							const sectionInfo = ctx.getSectionInfo(el);

							if (sectionInfo && sectionInfo.lineStart === 0) {
								return;
							}
						}
						
						// able edit live
						// disadvantage: First screen CLS (Page jitter)
						if (this.settings.renderMode === 'textarea') {
							// - div
							//   - span
							//     - pre
							// - textarea
							const div = document.createElement('div'); el.appendChild(div); div.classList.add('obsidian-shiki-plugin')
							div.setAttribute('relative', ''); div.setAttribute('float-left', ''); div.setAttribute('min-w-full', ''); // div.setAttribute('min-h-100', '');
							const span = document.createElement('span'); div.appendChild(span);
							const textarea = document.createElement('textarea'); div.appendChild(textarea); textarea.classList.add('line-height-$vp-code-line-height', 'font-$vp-font-family-mono', 'text-size-$vp-code-font-size');
							// TODO
							// These attributes are very strange. I copied the attributes on `shiki.style`.
							// But what supports all these are many css selectors like '[absolute=""]'
							// Perhaps it is for the convenience of style overlay
							// 
							// But in obsidian, I don't think it's necessary to do so.
							const attributes = {
								'whitespace-pre': '',
								'overflow-auto': '',
								'w-full': '',
								'h-full': '',
								'font-mono': '',
								'bg-transparent': '',
								'absolute': '',
								'inset-0': '',
								'py-20px': '',
								'px-24px': '',
								'text-transparent': '',
								'carent-gray': '',
								'tab-4': '',
								'resize-none': '',
								'z-10': '',
								'autocomplete': 'off',
								'autocorrect': 'off',
								'autocapitalize': 'none',
								'spellcheck': 'false',
							};
							Object.entries(attributes).forEach(([key, val]) => {
								textarea.setAttribute(key, val);
							});
							// async part
							this.codeblock_renderPre(language, source, el, ctx, span)
							textarea.value = source;
							textarea.oninput = (ev) => {
								const newValue = (ev.target as HTMLTextAreaElement).value
								this.codeblock_renderPre(language, newValue, el, ctx, span)
							}
							textarea.onchange = (ev) => {
								const newValue = (ev.target as HTMLTextAreaElement).value
								// on oninput: avoid: textarea --update--> source update --update--> textarea (lose curosr position)
								this.codeblock_saveContent(language, newValue, el, ctx)
							}
						}
						else if (this.settings.renderMode === 'pre') {
							this.codeblock_renderPre(language, source, el, ctx, el);
						}
						else {
							const codeBlock = new CodeBlock(this, el, source, language, ctx);
							ctx.addChild(codeBlock);
						}
					},
					1000,
				);
			} catch (e) {
				console.warn(`Failed to register code block processor for ${language}.`, e);
			}
		}
	}

	/**
	 * Render code to targetEl
	 * 
	 * @param language (does not contain meta information)
	 * @param source same as registerMarkdownCodeBlockProcessor args
	 * @param el     same as registerMarkdownCodeBlockProcessor args
	 * @param ctx    same as registerMarkdownCodeBlockProcessor args
	 * @param targetEl in which element should the result be rendered
	 */
	async codeblock_renderPre(language:string, source:string, el:HTMLElement, ctx:MarkdownPostProcessorContext, targetEl:HTMLElement): Promise<void> {
		// lanugageMeta (allow both ends space, allow null string)
		let languageMeta:string = ''
		const sectionInfo = ctx.getSectionInfo(el); // rerender without
		if (sectionInfo) { // allow without (when rerender)
			const lines = sectionInfo.text.split('\n')
			if (lines.length < sectionInfo.lineStart + 1) {
				new Notice("Warning: el ctx error!", 3000)
				throw('Warning: el ctx error!')
			}
			// If an alias is used, `lines[sectionInfo.lineStart]` may not necessarily contain `language`
			languageMeta = lines[sectionInfo.lineStart].replace(/^[`~]+\S*\s?/, '')
		}

		// pre html string
		const pre:string = await codeToHtml(source, {
			lang: language,
			theme: this.settings.theme,
			meta: { __raw: languageMeta },
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
		targetEl.innerHTML = pre
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
	 * 
	 * Universal
	 * - This should be a universal module. It has nothing to do with the logic of the plugin.
	 */
	async codeblock_saveContent(language:string, source:string, el:HTMLElement, ctx:MarkdownPostProcessorContext): Promise<void> {
		// range
		const sectionInfo = ctx.getSectionInfo(el);
		if (!sectionInfo) {
			new Notice("Warning: without el section!", 3000)
			return;
		}
		// sectionInfo.lineStart; // index in (```<language>)
		// sectionInfo.lineEnd;   // index in (```), Let's not modify the fence part

		// editor
		const editor = this.app.workspace.activeEditor?.editor;
		if (!editor) {
			new Notice("Warning: without editor!", 3000)
			return;
		}

		// change
		editor.transaction({ // EditorTransaction
			// replaceSelection,
			changes: [{
				from: {line: sectionInfo.lineStart+1, ch: 0},
				to: {line: sectionInfo.lineEnd, ch: 0},
				text: source + '\n'
			}],
			// selections,
			// selection
		});
	}

	registerInlineCodeProcessor(): void {
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			const inlineCodes = el.findAll(':not(pre) > code');
			for (let codeElm of inlineCodes) {
				let match = codeElm.textContent?.match(SHIKI_INLINE_REGEX); // format: `{lang} code`
				if (match) {
					const highlight = await this.highlighter.getHighlightTokens(match[2], match[1]);
					const tokens = highlight?.tokens.flat(1);
					if (!tokens?.length) {
						continue;
					}

					codeElm.empty();
					codeElm.addClass('shiki-inline');

					for (let token of tokens) {
						this.highlighter.tokenToSpan(token, codeElm);
					}
				}
			}
		});
	}

	onunload(): void {
		this.highlighter.unload();
	}

	addActiveCodeBlock(codeBlock: CodeBlock): void {
		const filePath = codeBlock.ctx.sourcePath;

		if (!this.activeCodeBlocks.has(filePath)) {
			this.activeCodeBlocks.set(filePath, [codeBlock]);
		} else {
			this.activeCodeBlocks.get(filePath)!.push(codeBlock);
		}
	}

	removeActiveCodeBlock(codeBlock: CodeBlock): void {
		const filePath = codeBlock.ctx.sourcePath;

		if (this.activeCodeBlocks.has(filePath)) {
			const index = this.activeCodeBlocks.get(filePath)!.indexOf(codeBlock);
			if (index !== -1) {
				this.activeCodeBlocks.get(filePath)!.splice(index, 1);
			}
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as Settings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
