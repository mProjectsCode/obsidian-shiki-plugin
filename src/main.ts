import { loadPrism, Plugin, TFile } from 'obsidian';
import { bundledLanguages, getHighlighter, type ThemedToken, type Highlighter, type TokensResult } from 'shiki';
import { ExpressiveCodeEngine, ExpressiveCodeTheme } from '@expressive-code/core';
import { pluginShiki } from '@expressive-code/plugin-shiki';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { ThemeMapper } from 'src/themes/ThemeMapper';
import { CodeBlock } from 'src/CodeBlock';
import { createCm6Plugin } from 'src/codemirror/Cm6_ViewPlugin';
import { DEFAULT_SETTINGS, type Settings } from 'src/settings/Settings';
import { ShikiSettingsTab } from 'src/settings/SettingsTab';
import { filterHighlightAllPlugin } from 'src/PrismPlugin';
import { LoadedLanguage } from 'src/LoadedLanguage';
import { getECTheme } from 'src/themes/ECTheme';

// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
const languageNameBlacklist = new Set(['c++', 'c#', 'f#', 'mermaid']);

export const SHIKI_INLINE_REGEX = /^\{([^\s]+)\} (.*)/i; // format: `{lang} code`

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
	loadedLanguages: Map<string, LoadedLanguage>;
	// @ts-expect-error TS2564
	shiki: Highlighter;
	// @ts-expect-error TS2564
	settings: Settings;
	// @ts-expect-error TS2564
	loadedSettings: Settings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.loadedSettings = structuredClone(this.settings);

		this.addSettingTab(new ShikiSettingsTab(this));

		this.themeMapper = new ThemeMapper(this);
		this.activeCodeBlocks = new Map();
		this.loadedLanguages = new Map();

		await this.loadLanguages();

		await this.loadEC();
		await this.loadShiki();

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

	async loadLanguages(): Promise<void> {
		for (const [shikiLanguage, registration] of Object.entries(bundledLanguages)) {
			// the last element of the array is seemingly the most recent version of the language
			const language = (await registration()).default.at(-1);
			const shikiLanguageName = shikiLanguage as keyof typeof bundledLanguages;

			if (language === undefined) {
				continue;
			}

			for (const alias of [language.name, ...(language.aliases ?? [])]) {
				if (languageNameBlacklist.has(alias)) {
					continue;
				}

				if (!this.loadedLanguages.has(alias)) {
					const newLanguage = new LoadedLanguage(alias);
					newLanguage.addLanguage(shikiLanguageName);

					this.loadedLanguages.set(alias, newLanguage);
				}

				this.loadedLanguages.get(alias)!.addLanguage(shikiLanguageName);
			}
		}

		for (const [alias, language] of this.loadedLanguages) {
			if (language.languages.length === 1) {
				language.setDefaultLanguage(language.languages[0]);
			} else {
				const defaultLanguage = language.languages.find(lang => lang === alias);
				if (defaultLanguage !== undefined) {
					language.setDefaultLanguage(defaultLanguage);
				} else {
					console.warn(`No default language found for ${alias}, using the first language in the list`);
					language.setDefaultLanguage(language.languages[0]);
				}
			}
		}

		for (const disabledLanguage of this.loadedSettings.disabledLanguages) {
			this.loadedLanguages.delete(disabledLanguage);
		}
	}

	async loadEC(): Promise<void> {
		this.ec = new ExpressiveCodeEngine({
			themes: [new ExpressiveCodeTheme(await this.themeMapper.getThemeForEC())],
			plugins: [
				pluginShiki({
					langs: Object.values(bundledLanguages),
				}),
				pluginCollapsibleSections(),
				pluginTextMarkers(),
				pluginLineNumbers(),
				pluginFrames(),
			],
			styleOverrides: getECTheme(this.loadedSettings),
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

	async loadShiki(): Promise<void> {
		this.shiki = await getHighlighter({
			themes: [await this.themeMapper.getTheme()],
			langs: Object.keys(bundledLanguages),
		});
	}

	async registerPrismPlugin(): Promise<void> {
		/* eslint-disable */

		await loadPrism();

		const prism = await loadPrism();
		filterHighlightAllPlugin(prism);
		prism.plugins.filterHighlightAll.reject.addSelector('div.expressive-code pre code');
	}

	registerCodeBlockProcessors(): void {
		for (const [alias, language] of this.loadedLanguages) {
			try {
				this.registerMarkdownCodeBlockProcessor(
					alias,
					async (source, el, ctx) => {
						// this is so that we leave the hidden frontmatter code block in reading mode alone
						if (alias === 'yaml' && ctx.frontmatter) {
							const sectionInfo = ctx.getSectionInfo(el);
							if (sectionInfo && sectionInfo.lineStart === 0) {
								el.addClass('shiki-hide-in-reading-mode');
							}
						}

						const codeBlock = new CodeBlock(this, el, source, language.getDefaultLanguage(), alias, ctx);

						ctx.addChild(codeBlock);
					},
					-1,
				);
			} catch (e) {
				console.warn(`Failed to register code block processor for ${alias}`, e);
			}
		}
	}

	registerInlineCodeProcessor(): void {
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			const inlineCodes = el.findAll(':not(pre) > code');
			for (let codeElm of inlineCodes) {
				let match = codeElm.textContent?.match(SHIKI_INLINE_REGEX); // format: `{lang} code`
				if (match) {
					const highlight = await this.getHighlightTokens(match[2], match[1]);
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

	getHighlightTokens(code: string, lang: string): TokensResult | undefined {
		const shikiLanguage = this.loadedLanguages.get(lang);

		if (shikiLanguage === undefined) {
			return undefined;
		}

		return this.shiki.codeToTokens(code, {
			lang: shikiLanguage.getDefaultLanguage(),
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
