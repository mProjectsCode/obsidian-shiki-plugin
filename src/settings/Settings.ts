export interface Settings {
	disabledLanguages: string[];
	theme: string;
	preferThemeColors: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	disabledLanguages: [],
	theme: 'obsidian-theme',
	preferThemeColors: true,
};
