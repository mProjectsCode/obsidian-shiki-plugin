import builtins from 'builtin-modules';
import esbuild from 'esbuild';
import { getBuildBanner } from 'build/buildBanner';

const banner = getBuildBanner('Release Build', version => version);

const build = await esbuild.build({
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
		...builtins,
	],
	format: 'cjs',
	target: 'es2018',
	logLevel: 'info',
	sourcemap: false,
	treeShaking: true,
	outfile: 'main.js',
	minify: true,
	metafile: true,
	define: {
		MB_GLOBAL_CONFIG_DEV_BUILD: 'false',
	},
	plugins: [],
});

const file = Bun.file('meta.txt');
await Bun.write(file, JSON.stringify(build.metafile, null, '\t'));

process.exit(0);
