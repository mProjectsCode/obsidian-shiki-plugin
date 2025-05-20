export interface Settings {
	disabledLanguages: string[];
	customThemeFolder: string;
	customLanguageFolder: string;
	theme: string;
	renderMode: 'textarea'|'pre'|'codemirror';
	preferThemeColors: boolean;
	inlineHighlighting: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	customThemeFolder: '',
	customLanguageFolder: '',
	theme: 'obsidian-theme',
	renderMode: 'textarea',
	preferThemeColors: true,
	inlineHighlighting: true,
};
