import esbuild from 'esbuild';
import copy from 'esbuild-plugin-copy-watch';
import manifest from '../../manifest.json' assert { type: 'json' };
import { getBuildBanner } from 'build/buildBanner';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';

const banner = getBuildBanner('Dev Build', _ => 'Dev Build');

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ['src/main.ts'],
	bundle: true,
	external: [
		'obsidian',
		'electron',
		'@codemirror/autocomplete',
		'@codemirror/collab',
		'@codemirror/commands',
		'@codemirror/language',
		'@codemirror/lint',
		'@codemirror/search',
		'@codemirror/state',
		'@codemirror/view',
		'@lezer/common',
		'@lezer/highlight',
		'@lezer/lr',
	],
	format: 'cjs',
	target: 'es2018',
	logLevel: 'info',
	sourcemap: 'inline',
	treeShaking: true,
	outdir: `exampleVault/.obsidian/plugins/${manifest.id}/`,
	outbase: 'src',
	define: {
		MB_GLOBAL_CONFIG_DEV_BUILD: 'true',
	},
	plugins: [
		copy({
			paths: [
				{
					from: './styles.css',
					to: '',
				},
				{
					from: './manifest.json',
					to: '',
				},
			],
		}),
		nodeModulesPolyfillPlugin({
			modules: {
				fs: true,
				path: true,
				url: true,
			},
		}),
	],
});

await context.watch();
