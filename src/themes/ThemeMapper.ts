import { type BundledTheme, bundledThemes, type ThemeRegistration } from 'shiki';
import type * as hast_types from 'hast';
import { OBSIDIAN_THEME } from 'src/themes/ObsidianTheme';
import type ShikiPlugin from 'src/main';

export class ThemeMapper {
	plugin: ShikiPlugin;
	mapCounter: number;
	mapping: Map<string, string>;

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;

		this.mapCounter = 0;
		this.mapping = new Map();
	}

	async getThemeForEC(): Promise<ThemeRegistration> {
		if (this.plugin.theme.endsWith('.json')) {
			return this.plugin.highlighter.customThemes.find(theme => theme.name === this.plugin.theme) as ThemeRegistration;
		} else if (this.plugin.theme !== 'obsidian-theme') {
			return (await bundledThemes[this.plugin.theme as BundledTheme]()).default;
		}

		return {
			displayName: OBSIDIAN_THEME.displayName,
			name: OBSIDIAN_THEME.name,
			semanticHighlighting: OBSIDIAN_THEME.semanticHighlighting,
			colors: Object.fromEntries(Object.entries(OBSIDIAN_THEME.colors).map(([key, value]) => [key, this.mapColor(value)])),
			tokenColors: OBSIDIAN_THEME.tokenColors.map(token => {
				const newToken = { ...token };

				if (newToken.settings) {
					newToken.settings = { ...newToken.settings };
				}

				if (newToken.settings.foreground) {
					newToken.settings.foreground = this.mapColor(newToken.settings.foreground);
				}

				return newToken;
			}),
		};
	}

	async getTheme(): Promise<ThemeRegistration> {
		if (this.plugin.theme.endsWith('.json')) {
			return this.plugin.highlighter.customThemes.find(theme => theme.name === this.plugin.theme) as ThemeRegistration;
		} else if (this.plugin.theme !== 'obsidian-theme') {
			return (await bundledThemes[this.plugin.theme as BundledTheme]()).default;
		}

		return OBSIDIAN_THEME;
	}

	/**
	 * Maps a color or CSS variable to a hex color.
	 */
	mapColor(color: string): string {
		if (this.mapping.has(color)) {
			return this.mapping.get(color)!;
		} else {
			const newColor = `#${this.mapCounter.toString(16).padStart(6, '0').toUpperCase()}`;
			this.mapCounter += 1;
			this.mapping.set(color, newColor);
			return newColor;
		}
	}

	/**
	 * Maps the placeholder colors in the AST to CSS variables.
	 */
	fixAST(ast: hast_types.Parents): hast_types.Parents {
		if (this.plugin.theme !== 'obsidian-theme') {
			return ast;
		}

		ast.children = ast.children.map(child => {
			if (child.type === 'element') {
				return this.fixNode(child);
			} else {
				return child;
			}
		});

		return ast;
	}

	private fixNode(node: hast_types.Element): hast_types.Element {
		if (node.properties?.style) {
			let style = node.properties.style as string;
			for (const [key, value] of this.mapping) {
				style = style.replaceAll(value, key);
			}
			node.properties.style = style;
		}

		for (const child of node.children) {
			if (child.type === 'element') {
				this.fixNode(child);
			}
		}

		return node;
	}
}
