# Lemons Plugin Template

## Setup

This uses [bun](https://bun.sh/), not node. So you need that installed. If you are on windows use WSL, if that does not work... good luck.

Things to change Checklist:

-   [ ] `manifest.json`
-   [ ] `package.json`
-   [ ] `versions.json`
-   [ ] `automation/config.js`
-   [ ] `.github/workflows/release.yml`
-   [ ] rename `exampleVault/.obsidian/lemons-plugin-template`

If and **only if** you completed these steps, you can run `bun install` and `bun run dev` to start your plugin jorney.

## Scripts Explained

-   `dev` - build into the example vault with hot reload
-   `build` - build for release
-   `tsc` - run type checker
-   `test` - run your tests
-   `test:log` - run your tests with console output enabled
-   `format` - format your code
-   `format:check` - check the formatting of your code
-   `lint` - lint your code
-   `lint:fix` - lint your code and fix auto fixable mistakes
-   `check` - check for formatting, linting, type errors and run the tests
-   `check:fix` - fix formatting and linting errors, check for type errors and run the tests
-   `release` - run the script to release a new version

## References

-   Sample plugin repo: https://github.com/obsidianmd/obsidian-sample-plugin
-   Obsidian help: https://help.obsidian.md/Home
-   Obsidian docs: https://docs.obsidian.md/Home
-   Obsidian API: https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
