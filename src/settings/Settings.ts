import { OBSIDIAN_THEME_IDENTIFIER } from 'src/themes/ThemeMapper';

export interface Settings {
	disabledLanguages: string[];
	customThemeFolder: string;
	customLanguageFolder: string;
	/**
	 * @deprecated use darkTheme and lightTheme instead
	 */
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
	darkTheme: OBSIDIAN_THEME_IDENTIFIER,
	lightTheme: OBSIDIAN_THEME_IDENTIFIER,
	preferThemeColors: true,
	inlineHighlighting: true,
};
