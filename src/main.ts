import { Plugin } from 'obsidian';
import { bundledLanguages } from 'shiki';
import { ThemeMapper } from 'src/ObsidianTheme';
import { ExpressiveCodeEngine, ExpressiveCodeTheme } from '@expressive-code/core';
import { pluginShiki } from '@expressive-code/plugin-shiki';
import { toHtml } from 'hast-util-to-html';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';

// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
const languageNameBlacklist = new Set(['c++', 'c#', 'f#']);

export default class ShikiPlugin extends Plugin {
	async onload(): Promise<void> {
		const themeMapper = new ThemeMapper();

		const ec = new ExpressiveCodeEngine({
			themes: [new ExpressiveCodeTheme(themeMapper.getTheme())],
			plugins: [
				pluginShiki({
					langs: Object.values(bundledLanguages),
				}),
				// pluginCollapsibleSections(),
				pluginTextMarkers(),
				// pluginLineNumbers(),
			],
			minSyntaxHighlightingColorContrast: 0,
		});

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
					const rederResult = await ec.render({
						code: source,
						language: shikiLanguage,
						// TODO: parse from code block
						meta: '{1-2}',
					});

					const ast = themeMapper.fixAST(rederResult.renderedGroupAst);

					// yes, this is innerHTML, but we trust hast
					el.innerHTML = toHtml(ast);
				});
			}
		}
	}

	onunload(): void {}
}
