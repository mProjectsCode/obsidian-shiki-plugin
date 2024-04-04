import { type ThemeRegistration } from 'shiki';

export const OBSIDIAN_THEME = {
	displayName: 'Obsidian Theme',
	name: 'obsidian-theme',
	semanticHighlighting: true,
	tokenColors: [
		{
			scope: ['emphasis'],
			settings: {
				fontStyle: 'italic',
			},
		},
		{
			scope: ['strong'],
			settings: {
				fontStyle: 'bold',
			},
		},
		{
			scope: ['header'],
			settings: {
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['meta.diff', 'meta.diff.header'],
			settings: {
				foreground: 'var(--shiki-code-comment)',
			},
		},
		{
			scope: ['markup.inserted'],
			settings: {
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: ['markup.deleted'],
			settings: {
				foreground: 'var(--text-error)',
			},
		},
		{
			scope: ['markup.changed'],
			settings: {
				foreground: 'var(--shiki-code-important)',
			},
		},
		{
			scope: ['invalid'],
			settings: {
				fontStyle: 'underline italic',
				foreground: 'var(--text-error)',
			},
		},
		{
			scope: ['invalid.deprecated'],
			settings: {
				fontStyle: 'underline italic',
				foreground: 'var(--shiki-code-normal)',
			},
		},
		{
			scope: ['entity.name.filename'],
			settings: {
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['markup.error'],
			settings: {
				foreground: 'var(--text-error)',
			},
		},
		{
			scope: ['markup.underline'],
			settings: {
				fontStyle: 'underline',
			},
		},
		{
			scope: ['markup.bold'],
			settings: {
				fontStyle: 'bold',
				foreground: 'var(--shiki-code-important)',
			},
		},
		{
			scope: ['markup.heading'],
			settings: {
				fontStyle: 'bold',
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['markup.italic'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: [
				'beginning.punctuation.definition.list.markdown',
				'beginning.punctuation.definition.quote.markdown',
				'punctuation.definition.link.restructuredtext',
			],
			settings: {
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: ['markup.inline.raw', 'markup.raw.restructuredtext'],
			settings: {
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: ['markup.underline.link', 'markup.underline.link.image'],
			settings: {
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: [
				'meta.link.reference.def.restructuredtext',
				'punctuation.definition.directive.restructuredtext',
				'string.other.link.description',
				'string.other.link.title',
			],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['entity.name.directive.restructuredtext', 'markup.quote'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['meta.separator.markdown'],
			settings: {
				foreground: 'var(--shiki-code-comment)',
			},
		},
		{
			scope: ['fenced_code.block.language', 'markup.raw.inner.restructuredtext', 'markup.fenced_code.block.markdown punctuation.definition.markdown'],
			settings: {
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: ['punctuation.definition.constant.restructuredtext'],
			settings: {
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['markup.heading.markdown punctuation.definition.string.begin', 'markup.heading.markdown punctuation.definition.string.end'],
			settings: {
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['meta.paragraph.markdown punctuation.definition.string.begin', 'meta.paragraph.markdown punctuation.definition.string.end'],
			settings: {
				foreground: 'var(--shiki-code-normal)',
			},
		},
		{
			scope: [
				'markup.quote.markdown meta.paragraph.markdown punctuation.definition.string.begin',
				'markup.quote.markdown meta.paragraph.markdown punctuation.definition.string.end',
			],
			settings: {
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['entity.name.type.class', 'entity.name.class'],
			settings: {
				fontStyle: 'normal',
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: [
				'keyword.expressions-and-types.swift',
				'keyword.other.this',
				'variable.language',
				'variable.language punctuation.definition.variable.php',
				'variable.other.readwrite.instance.ruby',
				'variable.parameter.function.language.special',
			],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['entity.other.inherited-class'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: ['comment', 'punctuation.definition.comment', 'unused.comment', 'wildcard.comment'],
			settings: {
				foreground: 'var(--shiki-code-comment)',
			},
		},
		{
			scope: ['comment keyword.codetag.notation', 'comment.block.documentation keyword', 'comment.block.documentation storage.type.class'],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['comment.block.documentation entity.name.type'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: ['comment.block.documentation entity.name.type punctuation.definition.bracket'],
			settings: {
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: ['comment.block.documentation variable'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-important)',
			},
		},
		{
			scope: ['constant', 'variable.other.constant'],
			settings: {
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['constant.character.escape', 'constant.character.string.escape', 'constant.regexp'],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['entity.name.tag'],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['entity.other.attribute-name.parent-selector'],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['entity.other.attribute-name'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: [
				'entity.name.function',
				'meta.function-call.object',
				'meta.function-call.php',
				'meta.function-call.static',
				'meta.method-call.java meta.method',
				'meta.method.groovy',
				'support.function.any-method.lua',
				'keyword.operator.function.infix',
			],
			settings: {
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: [
				'entity.name.variable.parameter',
				'meta.at-rule.function variable',
				'meta.at-rule.mixin variable',
				'meta.function.arguments variable.other.php',
				'meta.selectionset.graphql meta.arguments.graphql variable.arguments.graphql',
				'variable.parameter',
			],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-important)',
			},
		},
		{
			scope: ['meta.decorator variable.other.readwrite', 'meta.decorator variable.other.property'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: ['meta.decorator variable.other.object'],
			settings: {
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: ['keyword', 'punctuation.definition.keyword'],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['keyword.control.new', 'keyword.operator.new'],
			settings: {
				fontStyle: 'bold',
			},
		},
		{
			scope: ['meta.selector'],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['support'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: ['support.function.magic', 'support.variable', 'variable.other.predefined'],
			settings: {
				fontStyle: 'regular',
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['support.function', 'support.type.property-name'],
			settings: {
				fontStyle: 'regular',
			},
		},
		{
			scope: [
				'constant.other.symbol.hashkey punctuation.definition.constant.ruby',
				'entity.other.attribute-name.placeholder punctuation',
				'entity.other.attribute-name.pseudo-class punctuation',
				'entity.other.attribute-name.pseudo-element punctuation',
				'meta.group.double.toml',
				'meta.group.toml',
				'meta.object-binding-pattern-variable punctuation.destructuring',
				'punctuation.colon.graphql',
				'punctuation.definition.block.scalar.folded.yaml',
				'punctuation.definition.block.scalar.literal.yaml',
				'punctuation.definition.block.sequence.item.yaml',
				'punctuation.definition.entity.other.inherited-class',
				'punctuation.function.swift',
				'punctuation.separator.dictionary.key-value',
				'punctuation.separator.hash',
				'punctuation.separator.inheritance',
				'punctuation.separator.key-value',
				'punctuation.separator.key-value.mapping.yaml',
				'punctuation.separator.namespace',
				'punctuation.separator.pointer-access',
				'punctuation.separator.slice',
				'string.unquoted.heredoc punctuation.definition.string',
				'support.other.chomping-indicator.yaml',
				'punctuation.separator.annotation',
			],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: [
				'keyword.operator.other.powershell',
				'keyword.other.statement-separator.powershell',
				'meta.brace.round',
				'meta.function-call punctuation',
				'punctuation.definition.arguments.begin',
				'punctuation.definition.arguments.end',
				'punctuation.definition.entity.begin',
				'punctuation.definition.entity.end',
				'punctuation.definition.tag.cs',
				'punctuation.definition.type.begin',
				'punctuation.definition.type.end',
				'punctuation.section.scope.begin',
				'punctuation.section.scope.end',
				'punctuation.terminator.expression.php',
				'storage.type.generic.java',
				'string.template meta.brace',
				'string.template punctuation.accessor',
			],
			settings: {
				foreground: 'var(--shiki-code-punctuation)',
			},
		},
		{
			scope: [
				'meta.string-contents.quoted.double punctuation.definition.variable',
				'punctuation.definition.interpolation.begin',
				'punctuation.definition.interpolation.end',
				'punctuation.definition.template-expression.begin',
				'punctuation.definition.template-expression.end',
				'punctuation.section.embedded.begin',
				'punctuation.section.embedded.coffee',
				'punctuation.section.embedded.end',
				'punctuation.section.embedded.end source.php',
				'punctuation.section.embedded.end source.ruby',
				'punctuation.definition.variable.makefile',
			],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['entity.name.function.target.makefile', 'entity.name.section.toml', 'entity.name.tag.yaml', 'variable.other.key.toml'],
			settings: {
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: ['constant.other.date', 'constant.other.timestamp'],
			settings: {
				foreground: 'var(--shiki-code-important)',
			},
		},
		{
			scope: ['variable.other.alias.yaml'],
			settings: {
				fontStyle: 'italic underline',
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: ['storage', 'meta.implementation storage.type.objc', 'meta.interface-or-protocol storage.type.objc', 'source.groovy storage.type.def'],
			settings: {
				fontStyle: 'regular',
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: [
				'entity.name.type',
				'keyword.primitive-datatypes.swift',
				'keyword.type.cs',
				'meta.protocol-list.objc',
				'meta.return-type.objc',
				'source.go storage.type',
				'source.groovy storage.type',
				'source.java storage.type',
				'source.powershell entity.other.attribute-name',
				'storage.class.std.rust',
				'storage.type.attribute.swift',
				'storage.type.c',
				'storage.type.core.rust',
				'storage.type.cs',
				'storage.type.groovy',
				'storage.type.objc',
				'storage.type.php',
				'storage.type.haskell',
				'storage.type.ocaml',
			],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: ['entity.name.type.type-parameter', 'meta.indexer.mappedtype.declaration entity.name.type', 'meta.type.parameters entity.name.type'],
			settings: {
				foreground: 'var(--shiki-code-important)',
			},
		},
		{
			scope: ['storage.modifier'],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['string.regexp', 'constant.other.character-class.set.regexp', 'constant.character.escape.backslash.regexp'],
			settings: {
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['punctuation.definition.group.capture.regexp'],
			settings: {
				foreground: 'var(--shiki-code-keyword)',
			},
		},
		{
			scope: ['string.regexp punctuation.definition.string.begin', 'string.regexp punctuation.definition.string.end'],
			settings: {
				foreground: 'var(--text-error)',
			},
		},
		{
			scope: ['punctuation.definition.character-class.regexp'],
			settings: {
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: ['punctuation.definition.group.regexp'],
			settings: {
				foreground: 'var(--shiki-code-important)',
			},
		},
		{
			scope: ['punctuation.definition.group.assertion.regexp', 'keyword.operator.negation.regexp'],
			settings: {
				foreground: 'var(--text-error)',
			},
		},
		{
			scope: ['meta.assertion.look-ahead.regexp'],
			settings: {
				foreground: 'var(--shiki-code-function)',
			},
		},
		{
			scope: ['string'],
			settings: {
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['punctuation.definition.string.begin', 'punctuation.definition.string.end'],
			settings: {
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['punctuation.support.type.property-name.begin', 'punctuation.support.type.property-name.end'],
			settings: {
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: [
				'string.quoted.docstring.multi',
				'string.quoted.docstring.multi.python punctuation.definition.string.begin',
				'string.quoted.docstring.multi.python punctuation.definition.string.end',
				'string.quoted.docstring.multi.python constant.character.escape',
			],
			settings: {
				foreground: 'var(--shiki-code-comment)',
			},
		},
		{
			scope: [
				'variable',
				'constant.other.key.perl',
				'support.variable.property',
				'variable.other.constant.js',
				'variable.other.constant.ts',
				'variable.other.constant.tsx',
			],
			settings: {
				foreground: 'var(--shiki-code-normal)',
			},
		},
		{
			scope: ['meta.import variable.other.readwrite', 'meta.variable.assignment.destructured.object.coffee variable'],
			settings: {
				fontStyle: 'italic',
				foreground: 'var(--shiki-code-important)',
			},
		},
		{
			scope: [
				'meta.import variable.other.readwrite.alias',
				'meta.export variable.other.readwrite.alias',
				'meta.variable.assignment.destructured.object.coffee variable variable',
			],
			settings: {
				fontStyle: 'normal',
				foreground: 'var(--shiki-code-normal)',
			},
		},
		{
			scope: ['meta.selectionset.graphql variable'],
			settings: {
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['meta.selectionset.graphql meta.arguments variable'],
			settings: {
				foreground: 'var(--shiki-code-normal)',
			},
		},
		{
			scope: ['entity.name.fragment.graphql', 'variable.fragment.graphql'],
			settings: {
				foreground: 'var(--shiki-code-property)',
			},
		},
		{
			scope: [
				'constant.other.symbol.hashkey.ruby',
				'keyword.operator.dereference.java',
				'keyword.operator.navigation.groovy',
				'meta.scope.for-loop.shell punctuation.definition.string.begin',
				'meta.scope.for-loop.shell punctuation.definition.string.end',
				'meta.scope.for-loop.shell string',
				'storage.modifier.import',
				'punctuation.section.embedded.begin.tsx',
				'punctuation.section.embedded.end.tsx',
				'punctuation.section.embedded.begin.jsx',
				'punctuation.section.embedded.end.jsx',
				'punctuation.separator.list.comma.css',
				'constant.language.empty-list.haskell',
			],
			settings: {
				foreground: 'var(--shiki-code-punctuation)',
			},
		},
		{
			scope: ['source.shell variable.other'],
			settings: {
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['support.constant'],
			settings: {
				fontStyle: 'normal',
				foreground: 'var(--shiki-code-value)',
			},
		},
		{
			scope: ['meta.scope.prerequisites.makefile'],
			settings: {
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['meta.attribute-selector.scss'],
			settings: {
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['punctuation.definition.attribute-selector.end.bracket.square.scss', 'punctuation.definition.attribute-selector.begin.bracket.square.scss'],
			settings: {
				foreground: 'var(--shiki-code-punctuation)',
			},
		},
		{
			scope: ['meta.preprocessor.haskell'],
			settings: {
				foreground: 'var(--shiki-code-comment)',
			},
		},
		{
			scope: ['log.error'],
			settings: {
				fontStyle: 'bold',
				foreground: 'var(--text-error)',
			},
		},
		{
			scope: ['log.warning'],
			settings: {
				fontStyle: 'bold',
				foreground: 'var(--shiki-code-string)',
			},
		},
		{
			scope: ['punctuation'],
			settings: {
				foreground: 'var(--shiki-code-punctuation)',
			},
		},
	],
	type: 'dark',
} satisfies ThemeRegistration;
