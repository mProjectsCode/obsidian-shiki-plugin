export interface Settings {
	disabledLanguages: string[];
	theme: string;
	preferThemeColors: boolean;
	wrapGlobal: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	theme: 'obsidian-theme',
	preferThemeColors: true,
	wrapGlobal: true,
};
