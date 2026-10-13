import { fileURLToPath } from 'node:url';
import { createReviewConfig } from '@lemons_dev/eslint-config-obsidian';

export default createReviewConfig({ root: fileURLToPath(new URL('.', import.meta.url)) });
