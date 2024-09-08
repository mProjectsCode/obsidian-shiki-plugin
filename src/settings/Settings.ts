export interface Settings {
	disabledLanguages: string[];
	customThemeFolder: string;
	theme: string;
	preferThemeColors: boolean;
	inlineHighlighting: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	customThemeFolder: '',
	theme: 'obsidian-theme',
	preferThemeColors: true,
	inlineHighlighting: true,
};
