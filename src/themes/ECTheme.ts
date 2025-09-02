import { type ExpressiveCodeEngineConfig, type ExpressiveCodeTheme, type StyleValueOrValues, type UnresolvedStyleValue } from '@expressive-code/core';

export function getECTheme(useThemeColors: boolean): ExpressiveCodeEngineConfig['styleOverrides'] {
	let backgroundColor: UnresolvedStyleValue;
	let foregroundColor: UnresolvedStyleValue;
	let gutterBorderColor: UnresolvedStyleValue;
	let gutterTextColor: UnresolvedStyleValue;
	let gutterTextActiveColor: UnresolvedStyleValue;

	if (useThemeColors) {
		backgroundColor = ({ theme }: { theme: ExpressiveCodeTheme }): StyleValueOrValues =>
			theme.colors['editor.background'] ?? 'var(--shiki-code-background)';
		foregroundColor = ({ theme }: { theme: ExpressiveCodeTheme }): StyleValueOrValues => theme.colors['editor.foreground'] ?? 'var(--shiki-code-normal)';
		gutterBorderColor = ({ theme }: { theme: ExpressiveCodeTheme }): StyleValueOrValues =>
			theme.colors['editorLineNumber.foreground'] ?? 'var(--shiki-gutter-border-color)';
		gutterTextColor = ({ theme }: { theme: ExpressiveCodeTheme }): StyleValueOrValues =>
			theme.colors['editorLineNumber.foreground'] ?? 'var(--shiki-gutter-text-color)';
		gutterTextActiveColor = ({ theme }: { theme: ExpressiveCodeTheme }): StyleValueOrValues =>
			(theme.colors['editorLineNumber.activeForeground'] || theme.colors['editorLineNumber.foreground']) ?? 'var(--shiki-gutter-text-color-highlight)';
	} else {
		backgroundColor = 'var(--shiki-code-background)';
		foregroundColor = 'var(--shiki-code-normal)';
		gutterBorderColor = 'var(--shiki-gutter-border-color)';
		gutterTextColor = 'var(--shiki-gutter-text-color)';
		gutterTextActiveColor = 'var(--shiki-gutter-text-color-highlight)';
	}

	return {
		borderColor: 'var(--shiki-code-block-border-color)',
		borderRadius: 'var(--shiki-code-block-border-radius)',
		borderWidth: 'var(--shiki-code-block-border-width)',
		codeBackground: backgroundColor,
		codeFontFamily: 'var(--font-monospace)',
		codeFontSize: 'var(--code-size)',
		codeFontWeight: 'var(--font-normal)',
		codeForeground: foregroundColor,
		codeLineHeight: 'var(--line-height-normal)',
		codePaddingBlock: 'var(--size-4-3)',
		codePaddingInline: 'var(--size-4-4)',
		codeSelectionBackground: 'var(--text-selection)',
		focusBorder: 'var(--background-modifier-border)',
		scrollbarThumbColor: 'var(--scrollbar-thumb-bg)',
		scrollbarThumbHoverColor: 'var(--scrollbar-active-thumb-bg)',
		uiFontFamily: 'var(--font-interface)',
		uiFontSize: 'var(--font-text-size)',
		uiFontWeight: 'var(--font-normal)',
		uiLineHeight: 'var(--line-height-normal)',
		uiPaddingBlock: 'var(--size-4-2)',
		uiPaddingInline: 'var(--size-4-4)',
		uiSelectionBackground: 'var(--text-selection)',
		uiSelectionForeground: 'var(--text-normal)',
		gutterBorderColor: gutterBorderColor,
		gutterBorderWidth: 'var(--shiki-gutter-border-width)',
		gutterForeground: gutterTextColor,
		gutterHighlightForeground: gutterTextActiveColor,
		textMarkers: {
			delBackground: 'var(--shiki-highlight-red-background)',
			delBorderColor: 'var(--shiki-highlight-red)',
			delDiffIndicatorColor: 'var(--shiki-highlight-red)',
			inlineMarkerBorderWidth: 'var(--border-width)',
			insBackground: 'var(--shiki-highlight-green-background)',
			insBorderColor: 'var(--shiki-highlight-green)',
			insDiffIndicatorColor: 'var(--shiki-highlight-green)',
			lineDiffIndicatorMarginLeft: '0.3rem',
			lineMarkerAccentMargin: '0rem',
			lineMarkerAccentWidth: '0.15rem',
			lineMarkerLabelColor: 'white',
			lineMarkerLabelPaddingInline: '0.2rem',
			markBackground: 'var(--shiki-highlight-neutral-background)',
			markBorderColor: 'var(--shiki-highlight-neutral)',
		},
		frames: {
			editorActiveTabBackground: backgroundColor,
			editorActiveTabBorderColor: 'transparent',
			editorActiveTabForeground: 'var(--text-normal)',
			editorActiveTabIndicatorBottomColor: 'transparent',
			editorActiveTabIndicatorHeight: 'var(--shiki-active-tab-border-width)',
			editorActiveTabIndicatorTopColor: 'var(--shiki-active-tab-border-color)',
			editorBackground: backgroundColor,
			editorTabBarBackground: 'var(--color-primary)',
			editorTabBarBorderBottomColor: 'transparent',
			editorTabBarBorderColor: 'transparent',
			editorTabBorderRadius: 'var(--shiki-code-border-radius)',
			editorTabsMarginBlockStart: '0',
			editorTabsMarginInlineStart: '0',
			frameBoxShadowCssValue: 'none',
			inlineButtonBackground: 'var(--background-modifier-hover)',
			inlineButtonBackgroundActiveOpacity: '1',
			inlineButtonBackgroundHoverOrFocusOpacity: '1',
			inlineButtonBackgroundIdleOpacity: '0',
			inlineButtonBorder: 'var(--shiki-code-border-color)',
			inlineButtonBorderOpacity: '1',
			inlineButtonForeground: 'var(--text-normal)',
			shadowColor: 'transparent',
			terminalBackground: backgroundColor,
			terminalTitlebarBackground: backgroundColor,
			terminalTitlebarBorderBottomColor: 'transparent',
			terminalTitlebarDotsForeground: 'var(--shiki-terminal-dots-color)',
			terminalTitlebarDotsOpacity: '1',
			terminalTitlebarForeground: 'var(--text-normal)',
			tooltipSuccessBackground: 'var(--shiki-tooltip-background)',
			tooltipSuccessForeground: 'var(--shiki-tooltip-text-color)',
		},
	};
}
