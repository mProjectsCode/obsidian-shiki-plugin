import type { MarkdownPostProcessor } from 'obsidian';
import { debounce, loadPrism, MarkdownPreviewRenderer, MarkdownView, Plugin, TFile } from 'obsidian';
import { CodeBlock } from 'packages/obsidian/src/CodeBlock';
import { createCm6Plugin } from 'packages/obsidian/src/codemirror/Cm6_ViewPlugin';
import { CodeHighlighter } from 'packages/obsidian/src/Highlighter';
import { InlineCodeBlock } from 'packages/obsidian/src/InlineCodeBlock';
import type { PrismWithFilterHighlightAll } from 'packages/obsidian/src/PrismPlugin';
import { filterHighlightAllPlugin } from 'packages/obsidian/src/PrismPlugin';
import type { Settings } from 'packages/obsidian/src/settings/Settings';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';
import { ShikiSettingsTab } from 'packages/obsidian/src/settings/SettingsTab';

import 'packages/obsidian/src/styles.css';
import 'virtual:ec-styles.css';
import 'virtual:ec-runtime';

export const SHIKI_INLINE_REGEX = /^\{([^\s]+)\} (.*)/i; // format: `{lang} code`

export default class ShikiPlugin extends Plugin {
	highlighter!: CodeHighlighter;
	activeCodeBlocks!: Map<string, (CodeBlock | InlineCodeBlock)[]>;
	declare settings: Settings;
	loadedSettings!: Settings;
	updateCm6Plugin?: () => Promise<void>;

	private codeBlockProcessors = new Map<string, MarkdownPostProcessor>();
	private settingTab!: ShikiSettingsTab;
	private isUnloading = false;
	private reloadTask: Promise<void> = Promise.resolve();
	readonly scheduleHighlighterReload = debounce(
		() => {
			void this.reloadHighlighter().catch(error => console.error('Failed to reload highlighter.', error));
		},
		1000,
		true,
	);

	async onload(): Promise<void> {
		await this.loadSettings();
		this.loadedSettings = structuredClone(this.settings);

		this.highlighter = new CodeHighlighter(this);
		await this.highlighter.load();

		this.settingTab = new ShikiSettingsTab(this);
		this.addSettingTab(this.settingTab);
		this.register(() => this.scheduleHighlighterReload.cancel());

		this.activeCodeBlocks = new Map();

		this.registerInlineCodeProcessor();
		this.registerCodeBlockProcessors();
		this.register(() => {
			for (const processor of this.codeBlockProcessors.values()) {
				MarkdownPreviewRenderer.unregisterPostProcessor(processor);
			}
			this.codeBlockProcessors.clear();
		});

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

		this.registerEvent(this.app.workspace.on('css-change', () => this.scheduleHighlighterReload()));

		this.addCommand({
			id: 'reload-highlighter',
			name: 'Reload highlighter',
			callback: () => {
				this.scheduleHighlighterReload.cancel();
				void this.reloadHighlighter().catch(error => console.error('Failed to reload highlighter.', error));
			},
		});

		await this.registerPrismPlugin();
	}

	reloadHighlighter(): Promise<void> {
		// Serialize reloads so settings and CSS changes cannot unload an engine being rebuilt.
		const task = this.reloadTask.then(async () => {
			if (this.isUnloading) {
				return;
			}
			await this.highlighter.unload();
			this.loadedSettings = structuredClone(this.settings);
			await this.highlighter.load();
			if (this.isUnloading) {
				return;
			}

			const registrationsChanged = this.registerCodeBlockProcessors();

			for (const codeBlocks of this.activeCodeBlocks.values()) {
				for (const codeBlock of codeBlocks) {
					if (codeBlock instanceof CodeBlock && !this.codeBlockProcessors.has(codeBlock.language)) {
						continue;
					}
					await codeBlock.forceRerender();
				}
			}

			if (registrationsChanged) {
				for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
					if (leaf.view instanceof MarkdownView) {
						leaf.view.previewMode.rerender(true);
					}
				}
			}

			await this.updateCm6Plugin?.();
			this.settingTab.update();
		});
		// Keep the queue usable after a failed reload; the caller receives the error.
		this.reloadTask = task.catch(() => {});
		return task;
	}

	async registerPrismPlugin(): Promise<void> {
		const prism = (await loadPrism()) as PrismWithFilterHighlightAll;
		const filterHighlightAll = filterHighlightAllPlugin(prism);
		filterHighlightAll?.reject.addSelector('div.expressive-code pre code');
	}

	registerCodeBlockProcessors(): boolean {
		const languages = new Set(this.highlighter.obsidianSafeLanguageNames());
		let changed = false;
		for (const [language, processor] of this.codeBlockProcessors) {
			if (!languages.has(language)) {
				MarkdownPreviewRenderer.unregisterPostProcessor(processor);
				this.codeBlockProcessors.delete(language);
				changed = true;
			}
		}

		for (const language of languages) {
			if (this.codeBlockProcessors.has(language)) {
				continue;
			}
			try {
				const processor = MarkdownPreviewRenderer.createCodeBlockPostProcessor(language, async (source, el, ctx) => {
					// we need to avoid making the hidden frontmatter code block visible
					if (el.parentElement?.classList.contains('mod-frontmatter')) {
						return;
					}

					const codeBlock = new CodeBlock(this, el, source, language, ctx);

					ctx.addChild(codeBlock);
				});
				MarkdownPreviewRenderer.registerPostProcessor(processor, 1000);
				this.codeBlockProcessors.set(language, processor);
				changed = true;
			} catch (e) {
				console.warn(`Failed to register code block processor for ${language}.`, e);
			}
		}
		return changed;
	}

	registerInlineCodeProcessor(): void {
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			const inlineCodes = el.findAll(':not(pre) > code');
			for (const codeElm of inlineCodes) {
				const match = SHIKI_INLINE_REGEX.exec(codeElm.textContent ?? ''); // format: `{lang} code`
				if (!match) {
					continue;
				}

				const codeBlock = new InlineCodeBlock(this, codeElm, match[2], match[1], ctx);

				ctx.addChild(codeBlock);
			}
		});
	}

	onunload(): void {
		this.isUnloading = true;
		this.scheduleHighlighterReload.cancel();
		void this.reloadTask.then(() => this.highlighter.unload());
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
