import { Plugin, TFile } from 'obsidian';
import { type BundledLanguage, bundledLanguages, getHighlighter, type Highlighter, type TokensResult } from 'shiki';
import { ExpressiveCodeEngine, ExpressiveCodeTheme } from '@expressive-code/core';
import { pluginShiki } from '@expressive-code/plugin-shiki';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { ThemeMapper } from 'src/ThemeMapper';
import { EC_THEME } from 'src/ECTheme';
import { CodeBlock } from 'src/CodeBlock';
import { OBSIDIAN_THEME } from 'src/ObsidianTheme';
import { createCm6Plugin } from 'src/Cm6_ViewPlugin';

// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
const languageNameBlacklist = new Set(['c++', 'c#', 'f#']);

export default class ShikiPlugin extends Plugin {
	// @ts-expect-error TS2564
	themeMapper: ThemeMapper;
	// @ts-expect-error TS2564
	ec: ExpressiveCodeEngine;
	// @ts-expect-error TS2564
	ecElements: HTMLElement[];
	// @ts-expect-error TS2564
	activeCodeBlocks: Map<string, CodeBlock[]>;
	// @ts-expect-error TS2564
	loadedLanguages: Map<string, string>;
	// @ts-expect-error TS2564
	shiki: Highlighter;

	async onload(): Promise<void> {
		this.themeMapper = new ThemeMapper();
		this.activeCodeBlocks = new Map();
		this.loadedLanguages = new Map();

		await this.loadLanguages();

		this.shiki = await getHighlighter({
			themes: [OBSIDIAN_THEME],
			langs: Object.keys(bundledLanguages),
		});

		await this.loadEC();

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
	}

	async loadLanguages(): Promise<void> {
		for (const [shikiLanguage, registration] of Object.entries(bundledLanguages)) {
			// the last element of the array is seemingly the most recent version of the language
			const language = (await registration()).default.at(-1);

			if (language === undefined) {
				continue;
			}

			for (const alias of [language.name, ...(language.aliases ?? [])]) {
				if (!this.loadedLanguages.has(alias) && !languageNameBlacklist.has(alias)) {
					this.loadedLanguages.set(alias, shikiLanguage);
				}
			}
		}
	}

	async loadEC(): Promise<void> {
		this.ec = new ExpressiveCodeEngine({
			themes: [new ExpressiveCodeTheme(this.themeMapper.getTheme())],
			plugins: [
				pluginShiki({
					langs: Object.values(bundledLanguages),
				}),
				pluginCollapsibleSections(),
				pluginTextMarkers(),
				pluginLineNumbers(),
				pluginFrames(),
			],
			styleOverrides: EC_THEME,
			minSyntaxHighlightingColorContrast: 0,
			themeCssRoot: 'div.expressive-code',
			defaultProps: {
				showLineNumbers: false,
			},
		});

		this.ecElements = [];

		const styles = (await this.ec.getBaseStyles()) + (await this.ec.getThemeStyles());
		this.ecElements.push(document.head.createEl('style', { text: styles }));

		const jsModules = await this.ec.getJsModules();
		for (const jsModule of jsModules) {
			this.ecElements.push(document.head.createEl('script', { attr: { type: 'module' }, text: jsModule }));
		}
	}

	registerCodeBlockProcessors(): void {
		for (const [alias, language] of this.loadedLanguages) {
			this.registerMarkdownCodeBlockProcessor(
				alias,
				async (source, el, ctx) => {
					const codeBlock = new CodeBlock(this, el, source, language, alias, ctx);

					ctx.addChild(codeBlock);
				},
				-1,
			);
		}
	}

	onunload(): void {
		this.unloadEC();
	}

	unloadEC(): void {
		for (const el of this.ecElements) {
			el.remove();
		}
		this.ecElements = [];
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

	async getHighlightTokens(code: string, lang: string): Promise<TokensResult | undefined> {
		const shikiLanguage = this.loadedLanguages.get(lang);

		if (shikiLanguage === undefined) {
			return undefined;
		}

		return this.shiki.codeToTokens(code, {
			lang: shikiLanguage as BundledLanguage,
			theme: 'obsidian-theme',
		});
	}
}
