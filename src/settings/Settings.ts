export interface Settings {
	disabledLanguages: string[];
	theme: string;
	preferThemeColors: boolean;
	inlineHighlighting: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	theme: 'obsidian-theme',
	preferThemeColors: true,
	inlineHighlighting: true,
};
