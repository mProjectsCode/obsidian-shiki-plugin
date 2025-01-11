import { type MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Notice } from 'obsidian';
import type ShikiPlugin from 'src/main';

// css class name of obsidian edit block button in live preview
const EDIT_BLOCK_CLASSNAME = '.edit-block-button';

export class CodeBlock extends MarkdownRenderChild {
	plugin: ShikiPlugin;
	source: string;
	language: string;
	ctx: MarkdownPostProcessorContext;
	cachedMetaString: string;
	lineStart?: number;

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

		this.lineStart = sectionInfo.lineStart;
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
		this.addRowEditButtons();
		this.hideCopyButtons();
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

	/**
	 * In live preview, add a row edit button
	 * to each line of code block to improve editability,
	 * except lines in collapsible section summary.
	 */
	private addRowEditButtons(): void {
		if (!this.plugin.settings.rowEditButtons)
			return;
		
		const lineStart = this.lineStart;
		const editBlock = this.containerEl.parentElement?.find(EDIT_BLOCK_CLASSNAME);
		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		
		if (lineStart && editBlock && view?.getMode() === 'source') {
			const lines = this.containerEl.getElementsByClassName('ec-line');
			for (let i = 0, lineNo = 0; i < lines.length; i++) {
				// ignore lines in collapsible section summary
				if (lines[i].parentElement?.tagName === 'SUMMARY')
					continue;
				const editBtn = lines[i].createEl("div", { cls: "ec-edit-btn", attr: { "data-line": lineNo+1 } });
				editBtn.addEventListener("click", (e: Event) => {
					const lineNo = (e.currentTarget as HTMLElement).getAttribute("data-line");
					if (!lineNo) return;

					// a workaround to break the non-editable state
					// of embed code block by clicking this 'edit block' button
					editBlock.click();

					// select the row in editor
					let _i = lineStart + parseInt(lineNo);
					let _from = { line: _i, ch: 0 };
					let _to = { line: _i, ch: view.editor.getLine(_i).length };
					view.editor.setSelection(_from, _to);
				});
				lineNo++;
			}
			// Hide native buttons to avoid blocking row edit buttons
			if (this.plugin.settings.hideNativeBlockEdit) {
				editBlock.style.display = 'none';
			}
		}
	}

	/**
	 * Hide copy buttons for shiki code blocks.
	 * Now right-click on a code block to copy the entire code.
	 */
	private hideCopyButtons(): void {
		if (!this.plugin.settings.hideNativeCopy)
			return;
		const copyBtn = this.containerEl.find('.copy>button');
		if (copyBtn) {
			copyBtn.style.display = 'none';
			this.containerEl.addEventListener('contextmenu', () => {
				// only copy entire code when there is no selection.
				// if there is selection, obsidian will show a "Ctrl+C" context menu.
				if (!window.getSelection()?.toString()) {
					copyBtn.click();
				}
			});
		}
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
