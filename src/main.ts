import { loadPrism, Plugin, TFile, type MarkdownPostProcessor } from 'obsidian';
import { type BundledLanguage, type ThemedToken, type TokensResult } from 'shiki';
import { CodeBlock } from 'src/CodeBlock';
import { createCm6Plugin } from 'src/codemirror/Cm6_ViewPlugin';
import { DEFAULT_SETTINGS, type Settings } from 'src/settings/Settings';
import { ShikiSettingsTab } from 'src/settings/SettingsTab';
import { filterHighlightAllPlugin } from 'src/PrismPlugin';
import { CodeHighlighter } from 'src/Highlighter';

export const SHIKI_INLINE_REGEX = /^\{([^\s]+)\} (.*)/i; // format: `{lang} code`

export default class ShikiPlugin extends Plugin {
	highlighter!: CodeHighlighter;
	activeCodeBlocks!: Map<string, CodeBlock[]>;
	settings!: Settings;
	loadedSettings!: Settings;
	updateCm6Plugin!: () => void;

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

		this.updateCm6Plugin();
	}

	async registerPrismPlugin(): Promise<void> {
		/* eslint-disable */

		await loadPrism();

		const prism = await loadPrism();
		filterHighlightAllPlugin(prism);
		prism.plugins.filterHighlightAll.reject.addSelector('div.expressive-code pre code');
	}

	registerCodeBlockProcessors(): void {
		for (const language of this.highlighter.obsidianSafeLanguageNames()) {
			try {
				this.registerMarkdownCodeBlockProcessor(
					language,
					async (source, el, ctx) => {
						// this is so that we leave the hidden frontmatter code block in reading mode alone
						if (language === 'yaml' && ctx.frontmatter) {
							const sectionInfo = ctx.getSectionInfo(el);
							if (sectionInfo && sectionInfo.lineStart === 0) {
								el.addClass('shiki-hide-in-reading-mode');
							}
						}

						const codeBlock = new CodeBlock(this, el, source, language, ctx);

						ctx.addChild(codeBlock);
					},
					-1,
				);
			} catch (e) {
				console.warn(`Failed to register code block processor for ${language}`, e);
			}
		}
	}

	registerInlineCodeProcessor(): void {
		this.registerMarkdownPostProcessor((el, ctx) => {
			const inlineCodes = el.findAll(':not(pre) > code');
			for (let codeElm of inlineCodes) {
				let match = codeElm.textContent?.match(SHIKI_INLINE_REGEX); // format: `{lang} code`
				if (match) {
					const highlight = this.getHighlightTokens(match[2], match[1]);
					const tokens = highlight?.tokens.flat(1);
					if (!tokens?.length) {
						continue;
					}

					codeElm.empty();
					codeElm.addClass('shiki-inline');

					for (let token of tokens) {
						this.tokenToSpan(token, codeElm);
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

	getHighlightTokens(code: string, lang: string): TokensResult | undefined {
		if (!this.highlighter.obsidianSafeLanguageNames().includes(lang)) {
			return undefined;
		}

		return this.highlighter.shiki.codeToTokens(code, {
			lang: lang as BundledLanguage,
			theme: this.settings.theme,
		});
	}

	tokenToSpan(token: ThemedToken, parent: HTMLElement): void {
		const tokenStyle = this.getTokenStyle(token);
		parent.createSpan({
			text: token.content,
			cls: tokenStyle.classes.join(' '),
			attr: { style: tokenStyle.style },
		});
	}

	getTokenStyle(token: ThemedToken): { style: string; classes: string[] } {
		let fontStyle = token.fontStyle ?? 0;

		return {
			style: `color: ${token.color}`,
			classes: [
				(fontStyle & 1) !== 0 ? 'shiki-italic' : undefined,
				(fontStyle & 2) !== 0 ? 'shiki-bold' : undefined,
				(fontStyle & 4) !== 0 ? 'shiki-ul' : undefined,
			].filter(Boolean) as string[],
		};
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as Settings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
