import { PluginSettingTab, Setting, Platform } from 'obsidian';
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

		const customThemes = Object.fromEntries(this.plugin.customThemes.map(theme => [theme.id, `${theme.displayName} (${theme.type})`]));
		const builtInThemes = Object.fromEntries(bundledThemesInfo.map(theme => [theme.id, `${theme.displayName} (${theme.type})`]));
		const themes = {
			'obsidian-theme': 'Obsidian built-in (both)',
			...customThemes,
			...builtInThemes
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
				.setName('Custom themes')
				.setDesc('Click to open the folder where you can add your custom JSON theme files. RESTART REQUIRED AFTER CHANGES.')
				.addButton(button => {
					button.setButtonText('Custom themes...').onClick(() => {
						// @ts-expect-error TS2339
						const themePath = this.plugin.app.vault.adapter.path.join(this.plugin.app.vault.configDir, 'plugins', this.plugin.manifest.id, 'themes');
						// @ts-expect-error TS2339
						this.plugin.app.openWithDefaultApp(themePath);
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
