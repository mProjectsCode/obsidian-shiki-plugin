import { type EditorState, type EditorSelection } from '@codemirror/state';
import { type DecorationSet } from '@codemirror/view';

export class Cm6_Util {
	/**
	 * Checks if two ranges overlap.
	 *
	 * @param fromA
	 * @param toA
	 * @param fromB
	 * @param toB
	 */
	static checkRangeOverlap(fromA: number, toA: number, fromB: number, toB: number): boolean {
		return fromA <= toB && fromB <= toA;
	}

	/**
	 * Checks if editor selection and the given range overlap.
	 *
	 * @param selection
	 * @param from
	 * @param to
	 */
	static checkSelectionAndRangeOverlap(selection: EditorSelection, from: number, to: number): boolean {
		for (const range of selection.ranges) {
			if (Cm6_Util.checkRangeOverlap(range.from, range.to, from, to)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Gets the editor content of a given range.
	 *
	 * @param state
	 * @param from
	 * @param to
	 */
	static getContent(state: EditorState, from: number, to: number): string {
		return state.sliceDoc(from, to);
	}

	/**
	 * Checks if a decoration exists in a given range.
	 *
	 * @param decorations
	 * @param from
	 * @param to
	 */
	static existsDecorationBetween(decorations: DecorationSet, from: number, to: number): boolean {
		let exists = false;
		decorations.between(from, to, () => {
			exists = true;
		});
		return exists;
	}
}
