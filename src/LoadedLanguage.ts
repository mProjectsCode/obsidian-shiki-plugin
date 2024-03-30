import { type BundledLanguage, type SpecialLanguage } from 'shiki';

export class LoadedLanguage {
	alias: string;
	defaultLanguage: BundledLanguage | SpecialLanguage | undefined;
	languages: (BundledLanguage | SpecialLanguage)[];

	constructor(alias: string) {
		this.alias = alias;
		this.defaultLanguage = undefined;
		this.languages = [];
	}

	addLanguage(language: BundledLanguage | SpecialLanguage): void {
		if (!this.languages.includes(language)) {
			this.languages.push(language);
		}
	}

	setDefaultLanguage(language: BundledLanguage | SpecialLanguage): void {
		if (!this.languages.includes(language)) {
			throw new Error(`Language ${language} is not included in the loaded languages for ${this.alias}`);
		}

		this.defaultLanguage = language;
	}

	getDefaultLanguage(): BundledLanguage | SpecialLanguage {
		if (this.defaultLanguage === undefined) {
			throw new Error(`No default language set for ${this.alias}`);
		}

		return this.defaultLanguage;
	}
}
