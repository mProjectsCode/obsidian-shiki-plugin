import { loadPrism, Plugin, TFile, type MarkdownPostProcessor } from 'obsidian';
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
  transformerMetaHighlight,
} from '@shikijs/transformers';
import { codeToHtml } from 'shiki';

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

						let option: 'pre'|'old'|'area' = 'pre' // TODO as a new setting option
						
						// @ts-ignore
						if (option === 'area') {
							// - div
							//   - span
							//     - pre
							// - textarea
							const div = document.createElement('div'); el.appendChild(div); div.classList.add('obsidian-shiki-plugin')
							div.setAttribute('relative', ''); div.setAttribute('min-h-100', ''); div.setAttribute('float-left', ''); div.setAttribute('min-w-full', ''); 
							const span = document.createElement('span'); div.appendChild(span);
							const textarea = document.createElement('textarea'); div.appendChild(textarea); textarea.classList.add('line-height-$vp-code-line-height', 'font-$vp-font-family-mono', 'text-size-$vp-code-font-size');
							// 这些属性很奇怪，我抄了shiki.style上的属性。但支撑这些的，是许多类似 `[absolute=""]` 这样选择器的css
							// 也许是为了方便样式覆盖
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
							this.getPre(language, source).then(pre => span.innerHTML = pre);
							textarea.value = source;
							textarea.oninput = (ev) => {
								const newValue = (ev.target as HTMLTextAreaElement).value
								this.getPre(language, newValue).then(pre => span.innerHTML = pre);
							}
						}
						// @ts-ignore
						else if (option === 'pre') {
							this.getPre(language, source).then(pre => el.innerHTML = pre);
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

	async getPre(language:string, source:string): Promise<string> {
		const pre:string = await codeToHtml(source, {
			lang: language,
			theme: this.settings.theme,
			transformers: [
				transformerNotationDiff(), 
				transformerNotationDiff({ matchAlgorithm: 'v3' }),
				transformerNotationHighlight(),
				transformerNotationFocus(),
				transformerNotationErrorLevel(),
				transformerMetaHighlight(),
			],
		})
		return pre
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
