// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import only_warn from 'eslint-plugin-only-warn';
import no_relative_import_paths from 'eslint-plugin-no-relative-import-paths';

export default tseslint.config(
	{
		ignores: ['npm/', 'node_modules/', 'exampleVault/', 'automation/', 'main.js', '*.svelte'],
	},
	{
		files: ['src/**/*.ts'],
		extends: [
			eslint.configs.recommended,
			...tseslint.configs.recommended,
			...tseslint.configs.recommendedTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
		],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: true,
			},
		},
		plugins: {
			// @ts-ignore
			'only-warn': only_warn,
			'no-relative-import-paths': no_relative_import_paths,
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off', // ['warn'],
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',


			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],

			'@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
			'@typescript-eslint/restrict-template-expressions': 'off',

			'no-relative-import-paths/no-relative-import-paths': ['warn', { allowSameFolder: false }],

			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-inferrable-types': 'off',
			'@typescript-eslint/explicit-function-return-type': ['warn'],
			'@typescript-eslint/require-await': 'off',
		},
	},
);
