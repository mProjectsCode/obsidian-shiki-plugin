/*
 * Taken from https://github.com/PrismJS/prism/blob/master/plugins/filter-highlight-all/prism-filter-highlight-all.js
 */

export function filterHighlightAllPlugin(Prism: any): void {
	if (typeof Prism === 'undefined' || typeof document === 'undefined') {
		return;
	}

	const script = Prism.util.currentScript();

	/**
	 * @type {Array<(element: HTMLElement) => boolean>}
	 */
	const filters: any[] = [];

	const config: any = (Prism.plugins.filterHighlightAll = {
		/**
		 * Adds a new filter for the elements of `highlightAll` and `highlightAllUnder` such that only elements for
		 * which the given function returns `true` will be highlighted.
		 *
		 * @param {(value: { element: HTMLElement, language: string }) => boolean} condition
		 */
		add: function (condition: any): void {
			filters.push(function (element: any) {
				return condition({
					element: element,
					language: Prism.util.getLanguage(element),
				});
			});
		},

		/**
		 * Adds a new filter for the elements of `highlightAll` and `highlightAllUnder` such that only elements that
		 * match the given CSS selection will be highlighted.
		 *
		 * @param {string} selector
		 */
		addSelector: function (selector: any): void {
			filters.push(function (element: any) {
				return element.matches(selector);
			});
		},

		reject: {
			/**
			 * Adds a new filter for the elements of `highlightAll` and `highlightAllUnder` such that only elements for
			 * which the given function returns `false` will be highlighted.
			 *
			 * @param {(value: { element: HTMLElement, language: string }) => boolean} condition
			 */
			add: function (condition: any): void {
				filters.push(function (element: any) {
					return !condition({
						element: element,
						language: Prism.util.getLanguage(element),
					});
				});
			},

			/**
			 * Adds a new filter for the elements of `highlightAll` and `highlightAllUnder` such that only elements that do
			 * not match the given CSS selection will be highlighted.
			 *
			 * @param {string} selector
			 */
			addSelector: function (selector: any): void {
				filters.push(function (element: any) {
					return !element.matches(selector);
				});
			},
		},

		/**
		 * Filters the elements of `highlightAll` and `highlightAllUnder` such that only elements with a known language
		 * will be highlighted. All elements with an unset or unknown language will be ignored.
		 *
		 * __Note:__ This will effectively disable the AutoLoader plugin.
		 *
		 * @type {boolean}
		 */
		filterKnown: !!script && script.hasAttribute('data-filter-known'),
	});

	config.add(function filterKnown(env: any) {
		return !config.filterKnown || typeof Prism.languages[env.language] === 'object';
	});

	if (script) {
		let attr;
		attr = script.getAttribute('data-filter-selector');
		if (attr) {
			config.addSelector(attr);
		}
		attr = script.getAttribute('data-reject-selector');
		if (attr) {
			config.reject.addSelector(attr);
		}
	}

	/**
	 * Applies all filters to the given element and returns true if and only if every filter returned true on the
	 * given element.
	 *
	 * @param {HTMLElement} element
	 * @returns {boolean}
	 */
	function combinedFilter(element: any): boolean {
		for (let i: number = 0, l = filters.length; i < l; i++) {
			if (!filters[i](element)) {
				return false;
			}
		}
		return true;
	}

	Prism.hooks.add('before-all-elements-highlight', function (env: any) {
		env.elements = env.elements.filter(combinedFilter);
	});
}
