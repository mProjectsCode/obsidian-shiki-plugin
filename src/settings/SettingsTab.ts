import { PluginSettingTab, Setting } from 'obsidian';
import type ShikiPlugin from 'src/main';
import { StringSelectModal } from 'src/settings/StringSelectModal';
import { bundledThemesInfo } from 'shiki';

const needsARestart = '<strong style="color: var(--text-accent)">Requires restart of Obsidian to take effect.</strong>'
export class ShikiSettingsTab extends PluginSettingTab {
	plugin: ShikiPlugin;

	constructor(plugin: ShikiPlugin) {
		super(plugin.app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		// Theme
		const ThemeDesc = new DocumentFragment()
		ThemeDesc.createSpan({}, span => {
			span.innerHTML = `Select the theme for the code blocks.<br/>        
				⚠️ ${needsARestart}
        		`
    		})
		const themes = Object.fromEntries(bundledThemesInfo.map(theme => [theme.id, `${theme.displayName} (${theme.type})`]));
		themes['obsidian-theme'] = 'Obsidian built-in (both)';

		new Setting(this.containerEl)
			.setName('Theme')
			.setDesc(ThemeDesc)
			.addDropdown(dropdown => {
				dropdown.addOptions(themes);
				dropdown.setValue(this.plugin.settings.theme).onChange(async value => {
					this.plugin.settings.theme = value;
					await this.plugin.saveSettings();
				});
			});

		// Prefer theme colors
		const preferThemeColorsDesc = new DocumentFragment()
		preferThemeColorsDesc.createSpan({}, span => {
			span.innerHTML = `When enabled the plugin will prefer theme colors over CSS variables for things like the code block background.<br/>        
				⚠️ ${needsARestart}
        		`
    		})
		new Setting(this.containerEl)
			.setName('Prefer theme colors')
			.setDesc(preferThemeColorsDesc)
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.preferThemeColors).onChange(async value => {
					this.plugin.settings.preferThemeColors = value;
					await this.plugin.saveSettings();
				});
			});

		// Wrap code in blocks
		const wrapCodeDesc = new DocumentFragment()
		wrapCodeDesc.createSpan({}, span => {
			span.innerHTML = `Set the default value for word wrap in all code blocks globally.<br/>
				<a href=https://expressive-code.com/key-features/word-wrap/>This can be manually overridden per block with these instructions</a>.<br/>        
				⚠️ ${needsARestart}
        		`
    		})
		new Setting(this.containerEl)
			.setName('Wrap code in blocks')
			.setDesc(wrapCodeDesc)
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.wrapGlobal).onChange(async value => {
					this.plugin.settings.wrapGlobal = value;
					await this.plugin.saveSettings();
				});
			});

		// Excluded Languages
		const excLangDesc = new DocumentFragment()
		excLangDesc.createSpan({}, span => {
			span.innerHTML = `Configure language to exclude.<br/>        
				⚠️ ${needsARestart}
        		`
    		})
		new Setting(this.containerEl)
			.setName('Excluded Languages')
			.setDesc(excLangDesc)
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
