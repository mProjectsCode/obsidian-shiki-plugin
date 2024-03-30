import { FuzzySuggestModal } from 'obsidian';
import type ShikiPlugin from 'src/main';

export class StringSelectModal extends FuzzySuggestModal<string> {
	items: string[];
	onSelect: (item: string) => void;

	constructor(plugin: ShikiPlugin, items: string[], onSelect: (item: string) => void) {
		super(plugin.app);

		this.items = items;
		this.onSelect = onSelect;
	}

	public getItemText(item: string): string {
		return item;
	}

	public getItems(): string[] {
		return this.items;
	}

	public onChooseItem(item: string, _evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(item);
	}
}
