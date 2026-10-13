import type { SettingDefinitionItem } from 'obsidian';
import { PluginSettingTab, Platform, Notice, normalizePath } from 'obsidian';
import type ShikiPlugin from 'packages/obsidian/src/main';
import type { Settings } from 'packages/obsidian/src/settings/Settings';
import { FrameType } from 'packages/obsidian/src/settings/Settings';
import { StringSelectModal } from 'packages/obsidian/src/settings/StringSelectModal';
import { OBSIDIAN_THEME_IDENTIFIER } from 'packages/obsidian/src/themes/ThemeMapper';
import { bundledThemesInfo } from 'shiki';

export class ShikiSettingsTab extends PluginSettingTab {
	plugin: ShikiPlugin;

	constructor(plugin: ShikiPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		this.plugin.scheduleHighlighterReload();
	}

	getSettingDefinitions(): SettingDefinitionItem<keyof Settings>[] {
		const customThemes = Object.fromEntries(this.plugin.highlighter.customThemes.map(theme => [theme.name, `${theme.displayName} (${theme.type})`]));
		const builtInThemes = Object.fromEntries(bundledThemesInfo.map(theme => [theme.id, `${theme.displayName} (${theme.type})`]));
		const themes = {
			[OBSIDIAN_THEME_IDENTIFIER]: 'Obsidian built-in (both)',
			...customThemes,
			...builtInThemes,
		};

		return [
			{
				name: 'Inline syntax highlighting',
				desc: 'Enables syntax highlighting for inline code blocks via `{lang} code`.',
				control: { type: 'toggle', key: 'inlineHighlighting' },
			},
			{
				type: 'group',
				heading: 'EC defaults',
				items: [
					{
						name: 'Show line numbers',
						desc: 'Controls whether line numbers are shown by default.',
						control: { type: 'toggle', key: 'ecDefaultShowLineNumbers' },
					},
					{
						name: 'Wrap',
						desc: 'Controls whether code block lines wrap by default.',
						control: { type: 'toggle', key: 'ecDefaultWrap' },
					},
					{
						name: 'Frame',
						desc: 'Controls the default frame type for code blocks.',
						control: {
							type: 'dropdown',
							key: 'ecDefaultFrame',
							options: { [FrameType.Code]: 'Code', [FrameType.Terminal]: 'Terminal', [FrameType.None]: 'None', [FrameType.Auto]: 'Auto' },
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Theme',
				items: [
					{
						name: 'Dark theme',
						desc: "The theme for code blocks when Obsidian's base color scheme is dark.",
						control: { type: 'dropdown', key: 'darkTheme', options: themes },
					},
					{
						name: 'Light theme',
						desc: "The theme for code blocks when Obsidian's base color scheme is light.",
						control: { type: 'dropdown', key: 'lightTheme', options: themes },
					},
					{
						name: 'Custom themes folder location',
						desc: 'Folder in your vault containing custom JSON theme files.',
						control: { type: 'folder', key: 'customThemeFolder', includeRoot: true },
					},
					{
						name: 'Open custom themes folder',
						visible: Platform.isDesktopApp,
						action: () => {
							void this.openFolder(this.plugin.settings.customThemeFolder, 'themes');
						},
					},
					{
						name: 'Prefer theme colors',
						desc: 'Prefer theme colors over CSS variables for features such as the code block background.',
						control: { type: 'toggle', key: 'preferThemeColors' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Languages',
				items: [
					{
						name: 'Custom languages folder location',
						desc: 'Folder in your vault containing custom JSON language files.',
						control: { type: 'folder', key: 'customLanguageFolder', includeRoot: true },
					},
					{
						name: 'Open custom languages folder',
						visible: Platform.isDesktopApp,
						action: () => {
							void this.openFolder(this.plugin.settings.customLanguageFolder, 'languages');
						},
					},
				],
			},
			{
				type: 'list',
				heading: 'Excluded languages',
				emptyState: 'No excluded languages.',
				addItem: {
					name: 'Exclude language',
					action: () => {
						const languages = this.plugin.highlighter.supportedLanguages.filter(
							language => !this.plugin.settings.disabledLanguages.includes(language),
						);
						new StringSelectModal(this.plugin, languages, language => {
							if (!this.plugin.settings.disabledLanguages.includes(language)) {
								this.plugin.settings.disabledLanguages.push(language);
								void this.saveExcludedLanguages();
							}
						}).open();
					},
				},
				onDelete: index => {
					this.plugin.settings.disabledLanguages.splice(index, 1);
					void this.saveExcludedLanguages();
				},
				items: this.plugin.settings.disabledLanguages.map(language => ({ name: language })),
			},
		];
	}

	private async saveExcludedLanguages(): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.scheduleHighlighterReload();
		this.update();
	}

	private async openFolder(path: string, kind: string): Promise<void> {
		const folder = normalizePath(path);
		if (await this.app.vault.adapter.exists(folder)) {
			this.app.openWithDefaultApp(folder);
		} else {
			new Notice(`Unable to open custom ${kind} folder: ${folder}`, 5000);
		}
	}
}
