export interface Settings {
	disabledLanguages: string[];
	customThemeFolder: string;
	customLanguageFolder: string;
	theme: string;
	preferThemeColors: boolean;
	inlineHighlighting: boolean;
	wrap: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	customThemeFolder: '',
	customLanguageFolder: '',
	theme: 'obsidian-theme',
	preferThemeColors: true,
	inlineHighlighting: true,
	wrap: true,
};
