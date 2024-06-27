import type ShikiPlugin from 'src/main';
import { SHIKI_INLINE_REGEX } from 'src/main';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type Range } from '@codemirror/state';
import { type SyntaxNode } from '@lezer/common';
import { syntaxTree } from '@codemirror/language';
import { Cm6_Util } from 'src/codemirror/Cm6_Util';
import { type ThemedToken } from 'shiki';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCm6Plugin(plugin: ShikiPlugin): ViewPlugin<any> {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = Decoration.none;
				this.updateWidgets(view);
			}

			/**
			 * Triggered by codemirror when the view updates.
			 * Depending on the update type, the decorations are either updated or recreated.
			 *
			 * @param update
			 */
			update(update: ViewUpdate): void {
				this.decorations = this.decorations.map(update.changes);

				if (update.docChanged || update.selectionSet) {
					this.updateWidgets(update.view, update.docChanged);
				}
			}

			/**
			 * Updates all the widgets by traversing the syntax tree.
			 *
			 * @param view
			 */
			updateWidgets(view: EditorView, docChanged: boolean = true): void {
				let lang = '';
				let state: SyntaxNode[] = [];

				// const t1 = performance.now();

				syntaxTree(view.state).iterate({
					enter: nodeRef => {
						const node = nodeRef.node;

						const props: Set<string> = new Set<string>(node.type.name?.split('_'));

						if (props.has('formatting')) {
							return;
						}

						if (props.has('inline-code')) {
							const content = Cm6_Util.getContent(view.state, node.from, node.to);
							if (content.startsWith('{')) {
								const match = content.match(SHIKI_INLINE_REGEX);  // format: `{lang} code`
								if (match) {
									// check if selection and this node overlaps
									if (Cm6_Util.checkSelectionAndRangeOverlap(view.state.selection, node.from, node.to)) {
										this.removeDecoration(node.from, node.to);
										return;
									}
									const hideTo = node.from + match[1].length + 3;  // hide `{lang} `
									this.renderWidget(hideTo, node.to, match[1], match[2])
										.then(decorations => {
											this.removeDecoration(node.from, node.to);
											decorations.unshift(Decoration.replace({}).range(node.from, hideTo));
											this.addDecoration(node.from, node.to, decorations);
										})
										.catch(console.error);
								}
							} else {
								this.removeDecoration(node.from, node.to);
							}
							return;
						}
						if (!docChanged) return;

						if (props.has('HyperMD-codeblock') && !props.has('HyperMD-codeblock-begin') && !props.has('HyperMD-codeblock-end')) {
							state.push(node);
							return;
						}

						if (props.has('HyperMD-codeblock-begin')) {
							const content = Cm6_Util.getContent(view.state, node.from, node.to);

							lang = content.match(/^```(\S+)/)?.[1] ?? '';
						}

						if (props.has('HyperMD-codeblock-end')) {
							if (state.length > 0) {
								const start = state[0].from;
								const end = state[state.length - 1].to;

								const content = Cm6_Util.getContent(view.state, start, end);

								// const t2 = performance.now();

								this.renderWidget(start, end, lang, content)
									.then(decorations => {
										this.removeDecoration(start, end);
										this.addDecoration(start, end, decorations);
										// console.log('Highlighted widget in', performance.now() - t2, 'ms');
									})
									.catch(console.error);
							}

							lang = '';
							state = [];
						}
					},
				});

				// console.log('Traversed syntax tree in', performance.now() - t1, 'ms');
			}

			/**
			 * Removes all decorations at a given node.
			 *
			 * @param from
			 * @param to
			 */
			removeDecoration(from: number, to: number): void {
				this.decorations = this.decorations.update({
					filterFrom: from,
					filterTo: to,
					filter: (_from3, _to3, _decoration) => {
						return false;
					},
				});
			}

			/**
			 * Adds a widget at a given node if it does not exist yet.
			 *
			 * @param from
			 * @param to
			 * @param newDecorations
			 */
			addDecoration(from: number, to: number, newDecorations: Range<Decoration>[]): void {
				// check if the decoration already exists and only add it if it does not exist
				if (Cm6_Util.existsDecorationBetween(this.decorations, from, to)) {
					return;
				}

				if (newDecorations.length === 0) {
					return;
				}

				this.decorations = this.decorations.update({
					add: newDecorations,
				});
			}

			/**
			 * Renders a singe widget of the given widget type at a given node.
			 *
			 * @param from
			 * @param to
			 * @param language
			 * @param content
			 */
			async renderWidget(from: number, to: number, language: string, content: string): Promise<Range<Decoration>[]> {
				const highlight = await plugin.getHighlightTokens(content, language);

				if (!highlight) {
					return [];
				}

				const tokens = highlight.tokens.flat(1);

				const decorations: Range<Decoration>[] = [];

				for (let i = 0; i < tokens.length; i++) {
					const token = tokens[i];
					const nextToken: ThemedToken | undefined = tokens[i + 1];

					decorations.push(
						Decoration.mark({
							attributes: {
								style: `color: ${token.color}`,
							},
						}).range(from + token.offset, nextToken ? from + nextToken.offset : to),
					);
				}

				return decorations;
			}

			/**
			 * Triggered by codemirror when the view plugin is destroyed.
			 * Unloads all widgets.
			 */
			destroy(): void {
				this.decorations = Decoration.none;
			}
		},
		{
			decorations: v => v.decorations,
		},
	);
}
