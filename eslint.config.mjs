import { fileURLToPath } from 'node:url';
import { createCIConfig } from '@lemons_dev/eslint-config-obsidian';

export default createCIConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	host: ['packages/obsidian/src/**'],
	workers: [],
});
