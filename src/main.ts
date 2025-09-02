import { loadPrism, Plugin, TFile, type MarkdownPostProcessor } from 'obsidian';
import { CodeBlock } from 'src/CodeBlock';
import { createCm6Plugin } from 'src/codemirror/Cm6_ViewPlugin';
import { DEFAULT_SETTINGS, type Settings } from 'src/settings/Settings';
import { ShikiSettingsTab } from 'src/settings/SettingsTab';
import { filterHighlightAllPlugin } from 'src/PrismPlugin';
import { CodeHighlighter } from 'src/Highlighter';
import { InlineCodeBlock } from 'src/InlineCodeBlock';

export const SHIKI_INLINE_REGEX = /^\{([^\s]+)\} (.*)/i; // format: `{lang} code`

export default class ShikiPlugin extends Plugin {
	highlighter!: CodeHighlighter;
	activeCodeBlocks!: Map<string, (CodeBlock | InlineCodeBlock)[]>;
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

		this.registerEvent(
			this.app.workspace.on('css-change', () => {
				void this.reloadHighlighter();
			}),
		);

		this.addCommand({
			id: 'reload-highlighter',
			name: 'Reload highlighter',
			callback: () => {
				void this.reloadHighlighter();
			},
		});

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
						// we need to avoid making the hidden frontmatter code block visible
						if (el.parentElement?.classList.contains('mod-frontmatter')) {
							return;
						}

						const codeBlock = new CodeBlock(this, el, source, language, ctx);

						ctx.addChild(codeBlock);
					},
					1000,
				);
			} catch (e) {
				console.warn(`Failed to register code block processor for ${language}.`, e);
			}
		}
	}

	registerInlineCodeProcessor(): void {
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			const inlineCodes = el.findAll(':not(pre) > code');
			for (let codeElm of inlineCodes) {
				let match = codeElm.textContent?.match(SHIKI_INLINE_REGEX); // format: `{lang} code`
				if (!match) {
					continue;
				}

				const codeBlock = new InlineCodeBlock(this, codeElm, match[2], match[1], ctx);

				ctx.addChild(codeBlock);
			}
		});
	}

	onunload(): void {
		this.highlighter.unload();
	}

	addActiveCodeBlock(codeBlock: CodeBlock | InlineCodeBlock): void {
		const filePath = codeBlock.ctx.sourcePath;

		if (!this.activeCodeBlocks.has(filePath)) {
			this.activeCodeBlocks.set(filePath, [codeBlock]);
		} else {
			this.activeCodeBlocks.get(filePath)!.push(codeBlock);
		}
	}

	removeActiveCodeBlock(codeBlock: CodeBlock | InlineCodeBlock): void {
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

		// migrate the theme to darkTheme and lightTheme
		if (this.settings.theme !== undefined) {
			this.settings.darkTheme = this.settings.theme;
			this.settings.lightTheme = this.settings.theme;
			this.settings.theme = undefined;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
