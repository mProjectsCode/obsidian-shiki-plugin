import type ShikiPlugin from 'src/main';
import { SHIKI_INLINE_REGEX } from 'src/main';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type EditorState, type Range } from '@codemirror/state';
import { type SyntaxNode } from '@lezer/common';
import { syntaxTree } from '@codemirror/language';
import { Cm6_Util } from 'src/codemirror/Cm6_Util';
import { type ThemedToken } from 'shiki';
import { editorLivePreviewField } from 'obsidian';

enum DecorationUpdateType {
	Insert,
	Remove,
}

type DecorationUpdate = InsertDecoration | RemoveDecoration;

interface InsertDecoration {
	type: DecorationUpdateType.Insert;
	from: number;
	to: number;
	lang: string;
	content: string;
	hideLang?: boolean;
	hideTo?: number;
}

interface RemoveDecoration {
	type: DecorationUpdateType.Remove;
	from: number;
	to: number;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createCm6Plugin(plugin: ShikiPlugin) {
	return ViewPlugin.fromClass(
		class Cm6ViewPlugin {
			decorations: DecorationSet;
			view: EditorView;

			constructor(view: EditorView) {
				this.view = view;
				this.decorations = Decoration.none;
				void this.updateWidgets(view);

				plugin.updateCm6Plugin = (): Promise<void> => {
					return this.updateWidgets(this.view);
				};
			}

			/**
			 * Triggered by codemirror when the view updates.
			 * Depending on the update type, the decorations are either updated or recreated.
			 *
			 * @param update
			 */
			update(update: ViewUpdate): void {
				this.decorations = this.decorations.map(update.changes);

				// we handle doc changes and selection changes here
				if (update.docChanged || update.selectionSet) {
					this.view = update.view;
					void this.updateWidgets(update.view, update.docChanged);
				}
			}

			isLivePreview(state: EditorState): boolean {
				// @ts-ignore some strange private field not being assignable
				return state.field(editorLivePreviewField);
			}

			/**
			 * Updates all the widgets by traversing the syntax tree.
			 *
			 * @param view
			 * @param docChanged
			 */
			async updateWidgets(view: EditorView, docChanged: boolean = true): Promise<void> {
				let lang = '';
				let state: SyntaxNode[] = [];
				const decorationUpdates: DecorationUpdate[] = [];

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

							if (content.startsWith('{') && plugin.settings.inlineHighlighting) {
								const match = content.match(SHIKI_INLINE_REGEX); // format: `{lang} code`
								if (match) {
									const hasSelectionOverlap = Cm6_Util.checkSelectionAndRangeOverlap(view.state.selection, node.from - 1, node.to + 1);

									decorationUpdates.push({
										type: DecorationUpdateType.Insert,
										from: node.from,
										to: node.to,
										lang: match[1],
										content: match[2],
										hideLang: this.isLivePreview(view.state) && !hasSelectionOverlap,
										hideTo: node.from + match[1].length + 3, // hide `{lang} `
									});
								}
							} else {
								// we don't want to highlight normal inline code blocks, thus we remove any of our decorations
								// we could check if we even have any decorations at this node, but it's not necessary
								this.removeDecoration(node.from, node.to);
							}
							return;
						}

						// if !docChanged, then this change was a selection change.
						// We only care about inline code blocks in this case, so we can skip the rest.
						if (!docChanged) {
							return;
						}

						if (props.has('HyperMD-codeblock') && !props.has('HyperMD-codeblock-begin') && !props.has('HyperMD-codeblock-end')) {
							state.push(node);
							return;
						}

						if (props.has('HyperMD-codeblock-begin')) {
							const content = Cm6_Util.getContent(view.state, node.from, node.to);

							lang = /^```\s*(\S+)/.exec(content)?.[1] ?? '';
						}

						if (props.has('HyperMD-codeblock-end')) {
							if (state.length > 0 && lang !== '') {
								const start = state[0].from;
								const end = state[state.length - 1].to;

								decorationUpdates.push({
									type: DecorationUpdateType.Insert,
									from: start,
									to: end,
									lang,
									content: Cm6_Util.getContent(view.state, start, end),
								});
							}

							if (state.length > 0 && lang === '') {
								const start = state[0].from;
								const end = state[state.length - 1].to;

								decorationUpdates.push({
									type: DecorationUpdateType.Remove,
									from: start,
									to: end,
								});
							}

							lang = '';
							state = [];
						}
					},
				});

				for (const node of decorationUpdates) {
					try {
						if (node.type === DecorationUpdateType.Remove) {
							this.removeDecoration(node.from, node.to);
						} else if (node.type === DecorationUpdateType.Insert) {
							const decorations = await this.buildDecorations(node.hideTo ?? node.from, node.to, node.lang, node.content);
							this.removeDecoration(node.from, node.to);
							if (node.hideLang) {
								// add the decoration that hides the language tag
								decorations.unshift(Decoration.replace({}).range(node.from, node.hideTo));
							}
							// add the highlight decorations
							this.addDecoration(node.from, node.to, decorations);
						}
					} catch (e) {
						console.error(e);
					}
				}

				if (decorationUpdates.length > 0) {
					this.view.dispatch(this.view.state.update({}));
				}

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
			 * Builds mark decorations for a given range, laguage and content.
			 *
			 * @param from
			 * @param to
			 * @param language
			 * @param content
			 */
			async buildDecorations(from: number, to: number, language: string, content: string): Promise<Range<Decoration>[]> {
				if (language === '') {
					return [];
				}

				const highlight = await plugin.highlighter.getHighlightTokens(content, language.toLowerCase());

				if (!highlight) {
					return [];
				}

				const tokens = highlight.tokens.flat(1);

				const decorations: Range<Decoration>[] = [];

				for (let i = 0; i < tokens.length; i++) {
					const token = tokens[i];
					const nextToken: ThemedToken | undefined = tokens[i + 1];

					const tokenStyle = plugin.highlighter.getTokenStyle(token);

					decorations.push(
						Decoration.mark({
							attributes: {
								style: tokenStyle.style,
								class: tokenStyle.classes.join(' '),
							},
						}).range(from + token.offset, nextToken ? from + nextToken.offset : to),
					);
				}

				return decorations;
			}

			/**
			 * Triggered by codemirror when the view plugin is destroyed.
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
