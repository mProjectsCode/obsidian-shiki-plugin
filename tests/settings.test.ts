import { expect, mock, spyOn, test } from 'bun:test';
import type { App, Command, MarkdownPostProcessor, PluginManifest, WorkspaceLeaf } from 'obsidian';

const registeredProcessors = new Map<MarkdownPostProcessor, string>();
const processorLanguages = new WeakMap<MarkdownPostProcessor, string>();

void mock.module('obsidian', () => ({
	Plugin: class {
		async saveData(): Promise<void> {}
	},
	PluginSettingTab: class {
		plugin: { settings: Record<string, unknown>; saveData: (data: unknown) => Promise<void> };
		constructor(_app: unknown, plugin: { settings: Record<string, unknown>; saveData: (data: unknown) => Promise<void> }) {
			this.plugin = plugin;
		}
		async setControlValue(key: string, value: unknown): Promise<void> {
			this.plugin.settings[key] = value;
			await this.plugin.saveData(this.plugin.settings);
		}
		update(): void {}
	},
	FuzzySuggestModal: class {},
	MarkdownRenderChild: class {},
	MarkdownView: class {
		previewMode = { rerender: mock(() => {}) };
	},
	MarkdownPreviewRenderer: {
		createCodeBlockPostProcessor: (language: string): MarkdownPostProcessor => {
			const processor: MarkdownPostProcessor = () => {};
			processorLanguages.set(processor, language);
			return processor;
		},
		registerPostProcessor: (processor: MarkdownPostProcessor) => {
			registeredProcessors.set(processor, processorLanguages.get(processor)!);
		},
		unregisterPostProcessor: (processor: MarkdownPostProcessor) => {
			registeredProcessors.delete(processor);
		},
	},
	Platform: { isDesktopApp: false },
	Notice: class {},
	TFile: class {},
	editorLivePreviewField: {},
	loadPrism: async () => ({}),
	normalizePath: (path: string) => path,
	debounce: (callback: () => void, timeout: number, resetTimer: boolean) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const run = (): void => {
			if (timer && !resetTimer) {
				return;
			}
			clearTimeout(timer);
			timer = setTimeout(() => {
				timer = undefined;
				callback();
			}, timeout);
		};
		run.cancel = (): void => {
			clearTimeout(timer);
			timer = undefined;
		};
		return run;
	},
}));
void mock.module('virtual:ec-styles.css', () => ({}));
void mock.module('virtual:ec-runtime', () => ({}));

const { default: ShikiPlugin } = await import('../packages/obsidian/src/main');
const { ShikiSettingsTab } = await import('../packages/obsidian/src/settings/SettingsTab');
const { DEFAULT_SETTINGS } = await import('../packages/obsidian/src/settings/Settings');
const { CodeHighlighter } = await import('../packages/obsidian/src/Highlighter');
const { MarkdownView } = await import('obsidian');

function createPlugin(): InstanceType<typeof ShikiPlugin> {
	const plugin = new ShikiPlugin({} as App, {} as PluginManifest);
	plugin.settings = structuredClone(DEFAULT_SETTINGS);
	return plugin;
}

test('control changes persist immediately and reload once after the last change', async () => {
	const plugin = createPlugin();
	const save = mock(async () => {});
	const reload = mock(async () => {});
	plugin.saveData = save;
	plugin.reloadHighlighter = reload;
	const tab = new ShikiSettingsTab(plugin);
	try {
		await tab.setControlValue('ecDefaultWrap', true);
		expect(plugin.settings.ecDefaultWrap).toBe(true);
		expect(save).toHaveBeenCalledTimes(1);
		await Bun.sleep(600);
		await tab.setControlValue('inlineHighlighting', false);
		await Bun.sleep(600);
		expect(reload).toHaveBeenCalledTimes(0);
		await Bun.sleep(500);
		expect(reload).toHaveBeenCalledTimes(1);
	} finally {
		plugin.scheduleHighlighterReload.cancel();
	}
});

test('unloading cancels a pending settings reload', async () => {
	const plugin = createPlugin();
	const reload = mock(async () => {});
	const unload = mock(async () => {});
	plugin.reloadHighlighter = reload;
	plugin.highlighter = { unload } as unknown as typeof plugin.highlighter;
	plugin.scheduleHighlighterReload();
	plugin.onunload();
	await Bun.sleep(1100);
	expect(reload).toHaveBeenCalledTimes(0);
	expect(unload).toHaveBeenCalledTimes(1);
});

test('overlapping reloads without an editor rebuild sequentially and refresh theme choices', async () => {
	const plugin = createPlugin();
	const events: string[] = [];
	plugin.highlighter = {
		unload: async () => {
			events.push('unload');
		},
		obsidianSafeLanguageNames: () => [],
		load: async () => {
			events.push('load');
			await Bun.sleep(10);
			events.push('loaded');
		},
	} as unknown as typeof plugin.highlighter;
	plugin.activeCodeBlocks = new Map();
	expect(plugin.updateCm6Plugin).toBeUndefined();
	// onload normally installs the tab; avoid loading the real engines in this test.
	Reflect.set(plugin, 'settingTab', { update: () => events.push('update') });
	await Promise.all([plugin.reloadHighlighter(), plugin.reloadHighlighter()]);
	expect(events).toEqual(['unload', 'load', 'loaded', 'update', 'unload', 'load', 'loaded', 'update']);
});

test('deleting an excluded language persists it and refreshes the list', async () => {
	const plugin = createPlugin();
	plugin.settings.disabledLanguages = ['rust', 'typescript'];
	plugin.highlighter = { customThemes: [], supportedLanguages: ['rust', 'typescript'] } as unknown as typeof plugin.highlighter;
	const save = mock(async () => {});
	plugin.saveData = save;
	const tab = new ShikiSettingsTab(plugin);
	const refresh = mock(() => {});
	const list = tab.getSettingDefinitions().find(item => 'type' in item && item.type === 'list');
	if (!list || !('onDelete' in list)) {
		throw new Error('Excluded languages list missing');
	}
	const updated = new Promise<void>(resolve => {
		tab.update = () => {
			refresh();
			resolve();
		};
	});
	try {
		list.onDelete!(0);
		await updated;
		expect(plugin.settings.disabledLanguages).toEqual(['typescript']);
		expect(save).toHaveBeenCalledTimes(1);
		expect(refresh).toHaveBeenCalledTimes(1);
	} finally {
		plugin.scheduleHighlighterReload.cancel();
	}
});

test('reloads refresh excluded and custom language registrations and open Reading views', async () => {
	registeredProcessors.clear();
	const plugin = createPlugin();
	plugin.settings.disabledLanguages = ['rust'];
	plugin.loadedSettings = structuredClone(plugin.settings);
	let languages = ['rust', 'typescript'];
	plugin.highlighter = {
		unload: async () => {},
		load: async () => {},
		obsidianSafeLanguageNames: () => languages.filter(language => !plugin.loadedSettings.disabledLanguages.includes(language)),
	} as unknown as typeof plugin.highlighter;
	plugin.activeCodeBlocks = new Map();
	const view = new MarkdownView({} as WorkspaceLeaf);
	const rerender = mock(() => {});
	view.previewMode.rerender = rerender;
	plugin.app = { workspace: { getLeavesOfType: () => [{ view }] } } as unknown as App;
	const refresh = mock(() => {});
	Reflect.set(plugin, 'settingTab', { update: refresh });
	plugin.registerCodeBlockProcessors();
	expect([...registeredProcessors.values()]).toEqual(['typescript']);

	plugin.settings.disabledLanguages = [];
	await plugin.reloadHighlighter();
	expect([...registeredProcessors.values()].sort()).toEqual(['rust', 'typescript']);

	plugin.settings.disabledLanguages = ['typescript'];
	await plugin.reloadHighlighter();
	expect([...registeredProcessors.values()]).toEqual(['rust']);

	languages = ['rust', 'custom'];
	await plugin.reloadHighlighter();
	expect([...registeredProcessors.values()].sort()).toEqual(['custom', 'rust']);
	expect(rerender).toHaveBeenCalledTimes(3);
	expect(refresh).toHaveBeenCalledTimes(3);

	await plugin.reloadHighlighter();
	expect(registeredProcessors.size).toBe(2);
	expect(rerender).toHaveBeenCalledTimes(3);
});

test('the original reload command is registered and reloads immediately', async () => {
	const plugin = createPlugin();
	plugin.app = {
		vault: { on: () => ({}) },
		workspace: { on: () => ({}) },
	} as unknown as App;
	plugin.loadSettings = async () => {};
	plugin.addSettingTab = mock(() => {});
	plugin.register = mock(() => {});
	plugin.registerInlineCodeProcessor = mock(() => {});
	plugin.registerCodeBlockProcessors = mock(() => false);
	plugin.registerEditorExtension = mock(() => {});
	plugin.registerEvent = mock(() => {});
	plugin.registerPrismPlugin = mock(async () => {});
	const addCommand = mock((command: Command) => command);
	plugin.addCommand = addCommand;
	const load = spyOn(CodeHighlighter.prototype, 'load').mockResolvedValue();
	const reload = mock(async () => {});
	plugin.reloadHighlighter = reload;
	try {
		await plugin.onload();
		const command = addCommand.mock.calls[0][0];
		expect(command.id).toBe('reload-highlighter');
		plugin.scheduleHighlighterReload();
		command.callback!();
		expect(reload).toHaveBeenCalledTimes(1);
		await Bun.sleep(1100);
		expect(reload).toHaveBeenCalledTimes(1);
	} finally {
		load.mockRestore();
		plugin.scheduleHighlighterReload.cancel();
	}
});
