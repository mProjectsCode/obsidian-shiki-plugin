import { Plugin } from 'obsidian';
import { bundledLanguages } from 'shiki';
import { ExpressiveCodeEngine, ExpressiveCodeTheme } from '@expressive-code/core';
import { pluginShiki } from '@expressive-code/plugin-shiki';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { ThemeMapper } from 'src/ThemeMapper';
import { EC_THEME } from 'src/ECTheme';
import { CodeBlock } from 'src/CodeBlock';

// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
const languageNameBlacklist = new Set(['c++', 'c#', 'f#']);

export default class ShikiPlugin extends Plugin {
	// @ts-expect-error TS2564
	themeMapper: ThemeMapper;
	// @ts-expect-error TS2564
	ec: ExpressiveCodeEngine;
	// @ts-expect-error TS2564
	ecElements: HTMLElement[];

	async onload(): Promise<void> {
		this.themeMapper = new ThemeMapper();

		await this.loadEC();

		await this.registerCodeBlockProcessors();
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
		});

		this.ecElements = [];

		const styles = (await this.ec.getBaseStyles()) + (await this.ec.getThemeStyles());
		this.ecElements.push(document.head.createEl('style', { text: styles }));

		const jsModules = await this.ec.getJsModules();
		for (const jsModule of jsModules) {
			this.ecElements.push(document.head.createEl('script', { attr: { type: 'module' }, text: jsModule }));
		}
	}

	async registerCodeBlockProcessors(): Promise<void> {
		const registeredLanguages = new Set<string>();

		for (const [shikiLanguage, registration] of Object.entries(bundledLanguages)) {
			// the last element of the array is seemingly the most recent version of the language
			const language = (await registration()).default.at(-1);

			if (language === undefined) {
				continue;
			}

			// get the language name and the aliases
			const languageAliases = [language.name];
			if (language.aliases !== undefined) {
				languageAliases.push(...language.aliases);
			}

			for (const languageAlias of languageAliases) {
				// if we already registered this language, or it's in the blacklist, skip it
				if (registeredLanguages.has(languageAlias) || languageNameBlacklist.has(languageAlias)) {
					continue;
				}

				registeredLanguages.add(languageAlias);

				// register the language with obsidian
				this.registerMarkdownCodeBlockProcessor(languageAlias, async (source, el, ctx) => {
					const codeBlock = new CodeBlock(this, el, source, shikiLanguage, languageAlias, ctx.getSectionInfo(el));

					ctx.addChild(codeBlock);
				});
			}
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
}
