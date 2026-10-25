# Changelog

# Unreleased

Changes

- Migrated settings to the new Obsidian settings API. This requires Obsidian version 1.13.0 or higher.
- Settings changes now apply automatically after a short delay, without manually reloading the highlighter
- Added folder pickers for custom themes and languages
- Improved compatibility with IME text input, including Korean on Windows

Bug Fixes

- Improved reliability when reloading the highlighter or changing several settings in quick succession
- Fixed excluded and custom languages not updating correctly in open Reading views after reloading
- Fixed custom theme choices not refreshing after reloading
- Fixed fallback to the default theme when the active custom theme cannot be loaded
- Prevented adding the same language to the excluded languages list more than once

Misc

- Various internal improvements and dependency updates
- Fixed Obsidian review findings
