import { type MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import type ShikiPlugin from 'src/main';

export class InlineCodeBlock extends MarkdownRenderChild {
	plugin: ShikiPlugin;
	source: string;
	language: string;
	ctx: MarkdownPostProcessorContext;

	constructor(plugin: ShikiPlugin, containerEl: HTMLElement, source: string, language: string, ctx: MarkdownPostProcessorContext) {
		super(containerEl);

		this.plugin = plugin;
		this.source = source;
		this.language = language;
		this.ctx = ctx;
	}

	private async render(): Promise<void> {
		this.containerEl.empty();
		this.containerEl.classList.add('shiki-inline');

		const highlight = await this.plugin.highlighter.getHighlightTokens(this.source, this.language);
		const tokens = highlight?.tokens.flat(1);
		if (!tokens?.length) {
			return;
		}

		this.plugin.highlighter.renderTokens(tokens, this.containerEl);
	}

	public async rerenderOnNoteChange(): Promise<void> {
		// noop for inline code blocks
	}

	public async forceRerender(): Promise<void> {
		await this.render();
	}

	public onload(): void {
		super.onload();

		this.plugin.addActiveCodeBlock(this);

		void this.render();
	}

	public onunload(): void {
		super.onunload();

		this.plugin.removeActiveCodeBlock(this);

		this.containerEl.empty();
		this.containerEl.innerText = 'unloaded shiki inline code block';
	}
}
