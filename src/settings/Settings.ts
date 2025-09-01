export interface Settings {
	disabledLanguages: string[];
	customThemeFolder: string;
	customLanguageFolder: string;
	theme: string | undefined;
	darkTheme: string;
	lightTheme: string;
	preferThemeColors: boolean;
	inlineHighlighting: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	customThemeFolder: '',
	customLanguageFolder: '',
	theme: undefined,
	darkTheme: 'obsidian-theme',
	lightTheme: 'obsidian-theme',
	preferThemeColors: true,
	inlineHighlighting: true,
};
