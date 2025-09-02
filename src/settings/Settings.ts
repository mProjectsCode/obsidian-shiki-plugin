import { OBSIDIAN_THEME_IDENTIFIER } from 'src/themes/ThemeMapper';

export enum FrameType {
	Code = 'code',
	Terminal = 'terminal',
	None = 'none',
	Auto = 'auto',
}

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
	ecDefaultShowLineNumbers: boolean;
	ecDefaultWrap: boolean;
	ecDefaultFrame: FrameType;
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
	ecDefaultShowLineNumbers: false,
	ecDefaultWrap: false,
	ecDefaultFrame: FrameType.Auto,
};
