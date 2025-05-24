export interface Settings {
	disabledLanguages: string[];
	customThemeFolder: string;
	customLanguageFolder: string;
	theme: string;
	renderMode: 'textarea'|'pre'|'editablePre'|'codemirror';
	renderEngine: 'shiki'|'prismjs';
	saveMode: 'onchange'|'oninput',
	preferThemeColors: boolean;
	inlineHighlighting: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	customThemeFolder: '',
	customLanguageFolder: '',
	theme: 'obsidian-theme',
	renderMode: 'textarea',
	renderEngine: 'shiki',
	saveMode: 'onchange',
	preferThemeColors: true,
	inlineHighlighting: true,
};
