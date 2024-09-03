export {};

declare module 'obsidian' {
	interface App {
        // opens a file or folder with the default application
		openWithDefaultApp(path: string): void;
	}
}
