import { ExpressiveCodeEngine, ExpressiveCodeTheme } from '@expressive-code/core';
import type ShikiPlugin from 'src/main';
import {
	bundledLanguages,
	createHighlighter,
	type DynamicImportLanguageRegistration,
	type LanguageRegistration,
	type Highlighter,
	type TokensResult,
	type BundledLanguage,
	type ThemedToken,
} from 'shiki/index.mjs';
import { ThemeMapper } from 'src/themes/ThemeMapper';
import { pluginShiki } from '@expressive-code/plugin-shiki';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { getECTheme } from 'src/themes/ECTheme';
import { normalizePath, Notice } from 'obsidian';
import { DEFAULT_SETTINGS } from 'src/settings/Settings';
import { toHtml } from '@expressive-code/core/hast';

interface CustomTheme {
	name: string;
	displayName: string;
	type: string;
	colors?: Record<string, unknown>[];
	tokenColors?: Record<string, unknown>[];
}

// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
const languageNameBlacklist = new Set(['c++', 'c#', 'f#', 'mermaid']);

export class CodeHighlighter {
	plugin: ShikiPlugin;
	themeMapper: ThemeMapper;

	ec!: ExpressiveCodeEngine;
	ecElements!: HTMLElement[];
	supportedLanguages!: string[];
	shiki!: Highlighter;
	customThemes!: CustomTheme[];
	customLanguages!: LanguageRegistration[];

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;
		this.themeMapper = new ThemeMapper(this.plugin);
	}

	async load(): Promise<void> {
		await this.loadCustomThemes();
		await this.loadCustomLanguages();

		await this.loadEC();
		await this.loadShiki();

		this.supportedLanguages = [
			...Object.keys(bundledLanguages),
			...this.customLanguages.map(i => i.name)
		];
	}

	async unload(): Promise<void> {
		this.unloadEC();
	}

	async loadCustomLanguages(): Promise<void> {
		this.customLanguages = [];

		if (!this.plugin.loadedSettings.customLanguageFolder) return;

		const languageFolder = normalizePath(this.plugin.loadedSettings.customLanguageFolder);
		if (!(await this.plugin.app.vault.adapter.exists(languageFolder))) {
			new Notice(`${this.plugin.manifest.name}\nUnable to open custom languages folder: ${languageFolder}`, 5000);
			return;
		}

		const languageList = await this.plugin.app.vault.adapter.list(languageFolder);
		const languageFiles = languageList.files.filter(f => f.toLowerCase().endsWith('.json'));

		for (const languageFile of languageFiles) {
			try {
				const language = JSON.parse(await this.plugin.app.vault.adapter.read(languageFile)) as LanguageRegistration;
				// validate that language file JSON can be parsed and contains at a minimum a scopeName
				if (!language.name) {
					throw Error('Invalid JSON language file is missing a name property.');
				}

				this.customLanguages.push(language);
			} catch (e) {
				new Notice(`${this.plugin.manifest.name}\nUnable to load custom language: ${languageFile}`, 5000);
				console.warn(`Unable to load custom language: ${languageFile}`, e);
			}
		}
	}

	async loadCustomThemes(): Promise<void> {
		this.customThemes = [];

		// custom themes are disabled unless users specify a folder for them in plugin settings
		if (!this.plugin.loadedSettings.customThemeFolder) return;

		const themeFolder = normalizePath(this.plugin.loadedSettings.customThemeFolder);
		if (!(await this.plugin.app.vault.adapter.exists(themeFolder))) {
			new Notice(`${this.plugin.manifest.name}\nUnable to open custom themes folder: ${themeFolder}`, 5000);
			return;
		}

		const themeList = await this.plugin.app.vault.adapter.list(themeFolder);
		const themeFiles = themeList.files.filter(f => f.toLowerCase().endsWith('.json'));

		for (const themeFile of themeFiles) {
			const baseName = themeFile.substring(`${themeFolder}/`.length);
			try {
				const theme = JSON.parse(await this.plugin.app.vault.adapter.read(themeFile)) as CustomTheme;
				// validate that theme file JSON can be parsed and contains colors at a minimum
				if (!theme.colors && !theme.tokenColors) {
					throw Error('Invalid JSON theme file.');
				}
				// what metadata is available in the theme file depends on how it was created
				theme.displayName = theme.displayName ?? theme.name ?? baseName;
				theme.name = baseName.toLowerCase();
				theme.type = theme.type ?? 'both';

				this.customThemes.push(theme);
			} catch (e) {
				new Notice(`${this.plugin.manifest.name}\nUnable to load custom theme: ${themeFile}`, 5000);
				console.warn(`Unable to load custom theme: ${themeFile}`, e);
			}
		}

		// if the user's set theme cannot be loaded (e.g. it was deleted), fall back to default theme
		if (this.usesCustomTheme() && !this.customThemes.find(theme => theme.name === this.plugin.loadedSettings.theme)) {
			this.plugin.settings.theme = DEFAULT_SETTINGS.theme;
			this.plugin.loadedSettings.theme = DEFAULT_SETTINGS.theme;

			await this.plugin.saveSettings();
		}

		this.customThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}

	async loadEC(): Promise<void> {
		this.ec = new ExpressiveCodeEngine({
			themes: [new ExpressiveCodeTheme(await this.themeMapper.getThemeForEC())],
			plugins: [
				pluginShiki({
					langs: this.customLanguages,
				}),
				pluginCollapsibleSections(),
				pluginTextMarkers(),
				pluginLineNumbers(),
				pluginFrames(),
			],
			styleOverrides: getECTheme(this.plugin.loadedSettings),
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

	unloadEC(): void {
		for (const el of this.ecElements) {
			el.remove();
		}
		this.ecElements = [];
	}

	async loadShiki(): Promise<void> {
		this.shiki = await createHighlighter({
			themes: [await this.themeMapper.getTheme()],
			langs: this.customLanguages,
		});
	}

	usesCustomTheme(): boolean {
		return this.plugin.loadedSettings.theme.endsWith('.json');
	}

	/**
	 * All languages that are safe to use with Obsidian's `registerMarkdownCodeBlockProcessor`.
	 */
	obsidianSafeLanguageNames(): string[] {
		return this.supportedLanguages.filter(lang => !languageNameBlacklist.has(lang) && !this.plugin.loadedSettings.disabledLanguages.includes(lang));
		// .concat(this.customLanguages.map(lang => lang.name));
	}

	/**
	 * Highlights code with EC and renders it to the passed container element.
	 */
	async renderWithEc(code: string, language: string, meta: string, container: HTMLElement): Promise<void> {
		const result = await this.ec.render({
			code,
			language,
			meta,
		});

		container.innerHTML = toHtml(this.themeMapper.fixAST(result.renderedGroupAst));
	}

	async getHighlightTokens(code: string, lang: string): Promise<TokensResult | undefined> {
		if (!this.obsidianSafeLanguageNames().includes(lang)) {
			return undefined;
		}
		// load bundled language ​​when needed
		try {
			this.shiki.getLanguage(lang);
		} catch (e) {
			await this.shiki.loadLanguage(lang as BundledLanguage);
		}
		return this.shiki.codeToTokens(code, {
			lang: lang as BundledLanguage,
			theme: this.plugin.settings.theme,
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
		const fontStyle = token.fontStyle ?? 0;

		return {
			style: `color: ${token.color}`,
			classes: [
				(fontStyle & 1) !== 0 ? 'shiki-italic' : undefined,
				(fontStyle & 2) !== 0 ? 'shiki-bold' : undefined,
				(fontStyle & 4) !== 0 ? 'shiki-ul' : undefined,
			].filter(Boolean) as string[],
		};
	}
}
