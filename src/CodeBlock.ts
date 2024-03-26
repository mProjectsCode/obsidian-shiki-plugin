import { MarkdownRenderChild, type MarkdownSectionInformation } from 'obsidian';
import type ShikiPlugin from 'src/main';
import { toHtml } from 'hast-util-to-html';

export class CodeBlock extends MarkdownRenderChild {
	plugin: ShikiPlugin;
	source: string;
	language: string;
	languageShorthand: string;
	sectionInfo: MarkdownSectionInformation | null;

	constructor(
		plugin: ShikiPlugin,
		containerEl: HTMLElement,
		source: string,
		language: string,
		languageShorthand: string,
		sectionInfo: MarkdownSectionInformation | null,
	) {
		super(containerEl);

		this.plugin = plugin;
		this.source = source;
		this.language = language;
		this.languageShorthand = languageShorthand;
		this.sectionInfo = sectionInfo;
	}

	getMetaString(): string {
		if (this.sectionInfo === null) {
			return '';
		}

		const lines = this.sectionInfo.text.split('\n');
		const startLine = lines[this.sectionInfo.lineStart];

		// regexp to match the text after the code block language
		const regex = new RegExp('^[^`~]*?(```+|~~~+)' + this.languageShorthand + ' (.*)', 'g');
		const match = regex.exec(startLine);
		if (match !== null) {
			return match[2];
		} else {
			return '';
		}
	}

	public async onload(): Promise<void> {
		super.onload();

		const metaString = this.getMetaString();

		const renderResult = await this.plugin.ec.render({
			code: this.source,
			language: this.language,
			meta: metaString,
		});

		const ast = this.plugin.themeMapper.fixAST(renderResult.renderedGroupAst);

		// yes, this is innerHTML, but we trust hast
		this.containerEl.innerHTML = toHtml(ast);
	}

	public onunload(): void {
		this.containerEl.empty();
		this.containerEl.innerText = 'unloaded shiki code block';
	}
}
