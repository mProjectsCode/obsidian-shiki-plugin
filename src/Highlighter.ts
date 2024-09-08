import { ExpressiveCodeEngine, ExpressiveCodeTheme } from '@expressive-code/core';
import type ShikiPlugin from 'src/main';
import { LoadedLanguage } from 'src/LoadedLanguage';
import { bundledLanguages, createHighlighter, type Highlighter } from 'shiki/index.mjs';
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
	loadedLanguages!: Map<string, LoadedLanguage>;
	shiki!: Highlighter;
	customThemes!: CustomTheme[];

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;
		this.themeMapper = new ThemeMapper(this.plugin);
	}

	async load(): Promise<void> {
		await this.loadCustomThemes();

		await this.loadLanguages();

		await this.loadEC();
		await this.loadShiki();
	}

	async unload(): Promise<void> {
		this.unloadEC();
	}

	async loadLanguages(): Promise<void> {
		this.loadedLanguages = new Map();

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

		for (const disabledLanguage of this.plugin.loadedSettings.disabledLanguages) {
			this.loadedLanguages.delete(disabledLanguage);
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
					langs: Object.values(bundledLanguages),
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
			langs: Object.keys(bundledLanguages),
		});
	}

	usesCustomTheme(): boolean {
		return this.plugin.loadedSettings.theme.endsWith('.json');
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
}
