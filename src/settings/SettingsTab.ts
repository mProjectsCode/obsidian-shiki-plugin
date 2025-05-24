import { PluginSettingTab, Setting, Platform, Notice, normalizePath } from 'obsidian';
import type ShikiPlugin from 'src/main';
import { StringSelectModal } from 'src/settings/StringSelectModal';
import { bundledThemesInfo } from 'shiki';

export class ShikiSettingsTab extends PluginSettingTab {
	plugin: ShikiPlugin;

	constructor(plugin: ShikiPlugin) {
		super(plugin.app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		const customThemes = Object.fromEntries(this.plugin.highlighter.customThemes.map(theme => [theme.name, `${theme.displayName} (${theme.type})`]));
		const builtInThemes = Object.fromEntries(bundledThemesInfo.map(theme => [theme.id, `${theme.displayName} (${theme.type})`]));
		const themes = {
			'obsidian-theme': 'Obsidian built-in (both)',
			...customThemes,
			...builtInThemes,
		};

		this.containerEl.createEl('a', {
			text: 'Settings Panel Document',
			href: 'https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/master/docs/README.md'
		});

		new Setting(this.containerEl)
			.setName('Reload Highlighter')
			.setDesc('Reload the syntax highlighter. REQUIRED AFTER SETTINGS CHANGES.')
			.addButton(button => {
				button
					.setCta()
					.setButtonText('Reload Highlighter')
					.onClick(async () => {
						button.setDisabled(true);
						await this.plugin.reloadHighlighter();
						button.setDisabled(false);
					});
			});

		new Setting(this.containerEl)
			.setName('Theme')
			.setDesc('Select the theme for the code blocks (shiki).')
			.addDropdown(dropdown => {
				dropdown.addOptions(themes);
				dropdown.setValue(this.plugin.settings.theme).onChange(async value => {
					this.plugin.settings.theme = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Render Engine')
			.setDesc('Select the render engine for the code blocks.')
			.addDropdown(dropdown => {
				dropdown.addOptions({
					'shiki': 'Shiki',
					'prismjs': 'PrismJs',
				});
				dropdown.setValue(this.plugin.settings.renderEngine).onChange(async value => {
					this.plugin.settings.renderEngine = value as 'shiki'|'prismjs';
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Render Mode')
			.setDesc('Select the render mode for the code blocks.')
			.addDropdown(dropdown => {
				dropdown.addOptions({
					'textarea': 'textarea',
					'pre': 'pre',
					'editablePre': 'editable pre (beta)',
					'codemirror': 'codemirror',
				});
				dropdown.setValue(this.plugin.settings.renderMode).onChange(async value => {
					this.plugin.settings.renderMode = value as 'textarea'|'pre'|'editablePre'|'codemirror';
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Auto Save Mode')
			.setDesc('Select the auto save mode for the code blocks.')
			.addDropdown(dropdown => {
				dropdown.addOptions({
					'onchange': 'when change',
					'oninput': 'when input',
				});
				dropdown.setValue(this.plugin.settings.saveMode).onChange(async value => {
					this.plugin.settings.saveMode = value as 'onchange'|'oninput';
					await this.plugin.saveSettings();
				});
			});

		const customThemeFolderSetting = new Setting(this.containerEl)
			.setName('Custom themes folder location')
			.setDesc('Folder relative to your Vault where custom JSON theme files are located.')
			.addText(textbox => {
				textbox
					.setValue(this.plugin.settings.customThemeFolder)
					.onChange(async value => {
						this.plugin.settings.customThemeFolder = value;
						await this.plugin.saveSettings();
					})
					.then(textbox => {
						textbox.inputEl.addClass('shiki-custom-theme-folder');
					});
			});

		const customLanguageFolderSetting = new Setting(this.containerEl)
			.setName('Custom languages folder location')
			.setDesc('Folder relative to your Vault where custom JSON language files are located. RESTART REQUIRED AFTER CHANGES.')
			.addText(textbox => {
				textbox
					.setValue(this.plugin.settings.customLanguageFolder)
					.onChange(async value => {
						this.plugin.settings.customLanguageFolder = value;
						await this.plugin.saveSettings();
					})
					.then(textbox => {
						textbox.inputEl.addClass('shiki-custom-language-folder');
					});
			});

		if (Platform.isDesktopApp) {
			customThemeFolderSetting.addExtraButton(button => {
				button
					.setIcon('folder-open')
					.setTooltip('Open custom themes folder')
					.onClick(async () => {
						const themeFolder = normalizePath(this.plugin.settings.customThemeFolder);
						if (await this.app.vault.adapter.exists(themeFolder)) {
							this.plugin.app.openWithDefaultApp(themeFolder);
						} else {
							new Notice(`Unable to open custom themes folder: ${themeFolder}`, 5000);
						}
					});
			});

			customLanguageFolderSetting.addExtraButton(button => {
				button
					.setIcon('folder-open')
					.setTooltip('Open custom languages folder')
					.onClick(async () => {
						const languageFolder = normalizePath(this.plugin.settings.customLanguageFolder);
						if (await this.app.vault.adapter.exists(languageFolder)) {
							this.plugin.app.openWithDefaultApp(languageFolder);
						} else {
							new Notice(`Unable to open custom languages folder: ${languageFolder}`, 5000);
						}
					});
			});
		}

		new Setting(this.containerEl)
			.setName('Prefer theme colors')
			.setDesc('When enabled the plugin will prefer theme colors over CSS variables for things like the code block background.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.preferThemeColors).onChange(async value => {
					this.plugin.settings.preferThemeColors = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Inline Syntax Highlighting')
			.setDesc('Enables syntax highlighting for inline code blocks via `{lang} code`.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.inlineHighlighting).onChange(async value => {
					this.plugin.settings.inlineHighlighting = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl).setHeading().setName('Language Settings').setDesc('Configure language settings. RESTART REQUIRED AFTER CHANGES.');

		new Setting(this.containerEl)
			.setName('Excluded Languages')
			.setDesc('Configure language to exclude.')
			.addButton(button => {
				button.setButtonText('Add Language Rule').onClick(() => {
					const modal = new StringSelectModal(this.plugin, this.plugin.highlighter.supportedLanguages, language => {
						this.plugin.settings.disabledLanguages.push(language);
						void this.plugin.saveSettings();
						this.display();
					});
					modal.open();
				});
			});

		for (const language of this.plugin.settings.disabledLanguages) {
			new Setting(this.containerEl).setName(language).addButton(button => {
				button
					.setIcon('trash')
					.setWarning()
					.onClick(() => {
						this.plugin.settings.disabledLanguages = this.plugin.settings.disabledLanguages.filter(x => x !== language);
						void this.plugin.saveSettings();
						this.display();
					});
			});
		}
	}
}
