import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExpressiveCodeEngine } from '@expressive-code/core';
import { createObsidianPluginConfig } from '@lemons_dev/lemons-obsidian-plugin-automation';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { createCssVariableThemeBundle, createEcEngineConfig, EC_VIRTUAL_SETTINGS } from './packages/ec-core/src/Config';
import { OBSIDIAN_THEME } from './packages/ec-core/src/ObsidianTheme';

const root = fileURLToPath(new URL('.', import.meta.url));
const EC_RUNTIME_MODULE_ID = 'virtual:ec-runtime';
const EC_STYLES_MODULE_ID = 'virtual:ec-styles.css';
const EC_RUNTIME_RESOLVED_ID = `\0${EC_RUNTIME_MODULE_ID}`;
const EC_STYLES_RESOLVED_ID = `\0${EC_STYLES_MODULE_ID}`;

function expressiveCodeBundlePlugin() {
	let bundlePromise: Promise<{ runtimeModule: string; styles: string }> | undefined;

	const getBundle = async (): Promise<{ runtimeModule: string; styles: string }> => {
		if (!bundlePromise) {
			bundlePromise = (async () => {
				const cssVariableTheme = createCssVariableThemeBundle(OBSIDIAN_THEME);
				const ec = new ExpressiveCodeEngine(
					createEcEngineConfig({
						theme: cssVariableTheme.theme,
						customLanguages: [],
						settings: EC_VIRTUAL_SETTINGS,
						usingObsidianTheme: true,
					}),
				);

				const [baseStyles, jsModules] = await Promise.all([ec.getBaseStyles(), ec.getJsModules()]);

				return {
					runtimeModule: jsModules.join('\n'),
					styles: cssVariableTheme.restoreCssVariables(baseStyles),
				};
			})();
		}

		return bundlePromise;
	};

	return {
		name: 'expressive-code-bundle',
		resolveId(id: string): string | undefined {
			if (id === EC_RUNTIME_MODULE_ID) {
				return EC_RUNTIME_RESOLVED_ID;
			}
			if (id === EC_STYLES_MODULE_ID) {
				return EC_STYLES_RESOLVED_ID;
			}

			return undefined;
		},
		async load(id: string): Promise<string | undefined> {
			if (id !== EC_RUNTIME_RESOLVED_ID && id !== EC_STYLES_RESOLVED_ID) {
				return undefined;
			}

			const bundle = await getBundle();

			if (id === EC_RUNTIME_RESOLVED_ID) {
				return bundle.runtimeModule;
			}

			return bundle.styles;
		},
	};
}

export default defineConfig(({ mode }) =>
	createObsidianPluginConfig({
		root,
		mode,
		entry: 'packages/obsidian/src/main.ts',
		resolve: { alias: { packages: path.join(root, 'packages') } },
		polyfilledBuiltins: ['fs', 'path', 'url'],
		plugins: [nodePolyfills({ include: ['fs', 'path', 'url'], protocolImports: true }), expressiveCodeBundlePlugin()],
	}),
);
