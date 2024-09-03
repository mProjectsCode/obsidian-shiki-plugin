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

		// sort custom themes by their display name
		this.plugin.customThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));

		const customThemes = Object.fromEntries(this.plugin.customThemes.map(theme => [theme.name, `${theme.displayName} (${theme.type})`]));
		const builtInThemes = Object.fromEntries(bundledThemesInfo.map(theme => [theme.id, `${theme.displayName} (${theme.type})`]));
		const themes = {
			'obsidian-theme': 'Obsidian built-in (both)',
			...customThemes,
			...builtInThemes,
		};

		new Setting(this.containerEl)
			.setName('Theme')
			.setDesc('Select the theme for the code blocks. RESTART REQUIRED AFTER CHANGES.')
			.addDropdown(dropdown => {
				dropdown.addOptions(themes);
				dropdown.setValue(this.plugin.settings.theme).onChange(async value => {
					this.plugin.settings.theme = value;
					await this.plugin.saveSettings();
				});
			});

		if (Platform.isDesktopApp) {
			new Setting(this.containerEl)
				.setName('Custom themes folder location')
				.setDesc('Folder relative to your Vault where custom JSON theme files are located. RESTART REQUIRED AFTER CHANGES.')
				.addText(textbox => {
					textbox
						.setValue(this.plugin.settings.customThemeFolder)
						.onChange(async value => {
							this.plugin.settings.customThemeFolder = value;
							await this.plugin.saveSettings();
						})
						.then(textbox => {
							textbox.inputEl.style.width = '250px';
						});
				})
				.addExtraButton(button => {
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
		}

		new Setting(this.containerEl)
			.setName('Prefer theme colors')
			.setDesc(
				'When enabled the plugin will prefer theme colors over CSS variables for things like the code block background. RESTART REQUIRED AFTER CHANGES.',
			)
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

		new Setting(this.containerEl)
			.setName('Excluded Languages')
			.setDesc('Configure language to exclude. RESTART REQUIRED AFTER CHANGES.')
			.addButton(button => {
				button.setButtonText('Add Language Rule').onClick(() => {
					const modal = new StringSelectModal(this.plugin, Array.from(this.plugin.loadedLanguages.keys()), language => {
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
