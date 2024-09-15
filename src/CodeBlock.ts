import { type MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import type ShikiPlugin from 'src/main';

export class CodeBlock extends MarkdownRenderChild {
	plugin: ShikiPlugin;
	source: string;
	language: string;
	ctx: MarkdownPostProcessorContext;
	cachedMetaString: string;

	constructor(plugin: ShikiPlugin, containerEl: HTMLElement, source: string, language: string, ctx: MarkdownPostProcessorContext) {
		super(containerEl);

		this.plugin = plugin;
		this.source = source;
		this.language = language;
		this.ctx = ctx;
		this.cachedMetaString = '';
	}

	private getMetaString(): string {
		const sectionInfo = this.ctx.getSectionInfo(this.containerEl);

		if (sectionInfo === null) {
			return '';
		}

		const lines = sectionInfo.text.split('\n');
		const startLine = lines[sectionInfo.lineStart];

		// regexp to match the text after the code block language
		const regex = new RegExp('^[^`~]*?(```+|~~~+)' + this.language + ' (.*)', 'g');
		const match = regex.exec(startLine);
		if (match !== null) {
			return match[2];
		} else {
			return '';
		}
	}

	private async render(metaString: string): Promise<void> {
		await this.plugin.highlighter.renderWithEc(this.source, this.language, metaString, this.containerEl);
	}

	public async rerenderOnNoteChange(): Promise<void> {
		// compare the new meta string to the cached one
		// only rerender if they are different, to avoid unnecessary work
		// since the meta string is likely to be the same most of the time
		// and if the code block content changes obsidian will rerender for us
		const newMetaString = this.getMetaString();
		if (newMetaString !== this.cachedMetaString) {
			this.cachedMetaString = newMetaString;
			await this.render(newMetaString);
		}
	}

	public async forceRerender(): Promise<void> {
		await this.render(this.cachedMetaString);
	}

	public onload(): void {
		super.onload();

		this.plugin.addActiveCodeBlock(this);

		this.cachedMetaString = this.getMetaString();
		void this.render(this.cachedMetaString);
	}

	public onunload(): void {
		super.onunload();

		this.plugin.removeActiveCodeBlock(this);

		this.containerEl.empty();
		this.containerEl.innerText = 'unloaded shiki code block';
	}
}
