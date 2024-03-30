import { PluginSettingTab, Setting } from 'obsidian';
import type ShikiPlugin from 'src/main';
import { StringSelectModal } from 'src/settings/StringSelectModal';

export class ShikiSettingsTab extends PluginSettingTab {
	plugin: ShikiPlugin;

	constructor(plugin: ShikiPlugin) {
		super(plugin.app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

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
