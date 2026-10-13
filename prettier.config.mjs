import shared from '@lemons_dev/eslint-config-obsidian/prettier';
export default { ...shared, ...{ printWidth: 160, useTabs: true, tabWidth: 4, semi: true, singleQuote: true, arrowParens: 'avoid' } };
