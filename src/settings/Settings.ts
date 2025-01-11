export interface Settings {
	disabledLanguages: string[];
	customThemeFolder: string;
	customLanguageFolder: string;
	theme: string;
	preferThemeColors: boolean;
	inlineHighlighting: boolean;
	rowEditButtons: boolean;
	hideNativeBlockEdit: boolean;
	hideNativeCopy: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	customThemeFolder: '',
	customLanguageFolder: '',
	theme: 'obsidian-theme',
	preferThemeColors: true,
	inlineHighlighting: true,
	rowEditButtons: false,
	hideNativeBlockEdit: false,
	hideNativeCopy: false
};
