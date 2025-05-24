export interface Settings {
	disabledLanguages: string[];
	customThemeFolder: string;
	customLanguageFolder: string;
	theme: string;
	renderMode: 'textarea'|'pre'|'editablePre'|'codemirror';
	renderEngine: 'shiki'|'prismjs';
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
	preferThemeColors: true,
	inlineHighlighting: true,
};
