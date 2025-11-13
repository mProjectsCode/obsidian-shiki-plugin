# Shiki Icons Integration Plan

Objective: Add VS Code-style language icons to code block headers in the `obsidian-shiki-plugin` fork. Icons should appear for code blocks with `title="file.py"` and for language-only fences (e.g., ```python). Use a local bundled set of high-fidelity VS Code colored SVGs (~50 core languages) to avoid dependency and bundling risks. Icons must preserve all existing features (Shiki highlighting, custom JSON themes, line numbers, copy, folding) and be BRAT-installable.

---

## Summary of Approach

Preferred option: B — Local mapping + SVG bundle + DOM post-injection.
- Rationale: Minimal dependency churn, no `@expressive-code/*` version mismatch risk, smaller bundle control, safe Obsidian/Electron runtime behavior.
- Implementation pattern: After Expressive Code / Shiki renders a code frame (the HTML inserted by the highlighter), post-process the frame DOM to insert an icon element into the frame title area. Icons are provided by a small local bundle (`src/icons/*`) where each icon is an inline SVG string exported from a TS module to avoid asset-loader complexity.

---

## Phases (high-level)

Phase 1 — Assets & mapping (TDD: create infra + compile)
- Add `src/icons/svgs.ts` exporting a minimal map of `iconId -> svgString` for ~50 core language icons. (Start with a curated subset; expand later.)
- Add `src/icons/iconNames.json` mapping file extensions + language ids to `iconId`.
- Add `src/icons/iconRenderer.ts` with a helper `renderIconElement(iconId, opts?)` that returns an `HTMLElement` with the SVG inserted via `innerHTML` on a detached `div` and returns `div.firstElementChild` (safely).
- Add `src/icons/icons.css` or implement JS style injection helper to ensure consistent sizing & spacing.
- TS config change: add `"resolveJsonModule": true` in `tsconfig.json` if not present (so the `.json` mapping can be imported in TS).

Artifacts to create:
- `src/icons/svgs.ts` (export const ICON_SVGS: Record<string,string>)
- `src/icons/iconNames.json` (mapping from ext/language -> iconId)
- `src/icons/iconRenderer.ts`
- `src/icons/icons.css` or inline style injection helper

Phase 2 — Icon rendering helper and tests (TDD: unit test + tsc)
- Implement `iconRenderer` functions.
- Add unit smoke tests (or simple runtime check script) that import `iconRenderer` and create an element for several iconIds to ensure no TypeScript/bundler errors.
- Run `bun run tsc` and `bun run build` to ensure no type errors.

Phase 3 — Integrate with Highlighter (TDD: build + runtime smoke)
- Edit `src/Highlighter.ts` (primary integration point) to call the icon injector immediately after Expressive Code renders the frame and before it is attached to final container or when it has been inserted into the DOM (select the safer of the two options depending on code flow in `Highlighter.ts`).
- Implementation detail (safe insertion strategy):
  1. Detect the frame's title element — typically `.ec-frame-title`, `.ec-frame-header`, or a container the plugin uses. Use query selectors that currently exist in the rendered HTML.
  2. Extract file name from title text (`titleText`) or, if missing, use language id passed into the renderer.
  3. Determine `iconId` using `iconNames.json` mapping (strip extensions from filename to get ext). If none found, fallback to a `language->iconId` mapping.
  4. Create element via `renderIconElement(iconId)` and `titleEl.prepend(iconEl)`.
  5. Ensure keyboard/accessibility/backwards compatibility — icon is decorative (aria-hidden) and doesn't change code frame semantics.

Phase 4 — Styling, theme-adaptation, and fallbacks (TDD: visual checks)
- Ensure icons align with frame titles across both light/dark themes.
- Implement optional CSS to apply a monochrome fallback when required (e.g., force `filter: grayscale(100%)` on icons when user selects that option, or adapt via `prefers-color-scheme`).
- Ensure custom JSON token overrides and Shiki theming remain intact (no class name collisions).

Phase 5 — Packaging, build validation, BRAT readiness (TDD: build + manual Obsidian install)
- Run full build: `bun run tsc` then `bun run build` (esbuild pipeline).
- Validate `dist/main.js` and `manifest.json` entries are correct for Obsidian BRAT installation.
- Manual runtime test in Obsidian (or a minimal Electron renderer harness): load plugin, open a note with sample code blocks (title + language), verify: icons present, line numbers, copy button, folding, custom theme tokens (e.g., `self` color override) render correctly.
- Prepare final commit message and BRAT install path.

Phase 6 — Optional UX toggles & documentation (post-release)
- Add plugin Settings toggle to enable/disable icons, toggle monochrome vs colored, or limit icons to titled code blocks only.
- Update `README.md` with test code block examples and BRAT install instructions.

---

## Exact file paths to modify / add
- Edit: `src/Highlighter.ts` — add post-render DOM injection logic (primary change).
- Add: `src/icons/svgs.ts` — exports SVG string map.
- Add: `src/icons/iconNames.json` — extension/lang -> iconId mapping.
- Add: `src/icons/iconRenderer.ts` — helper to create DOM nodes with SVG content.
- Add or Edit: `src/icons/icons.css` or inject styles from `iconRenderer.ts`.
- Edit: `tsconfig.json` — add `"resolveJsonModule": true` if needed.
- Optionally Edit: `automation/build/esbuild.config.ts` if a bundling tweak is necessary (e.g., to prevent asset externalization), but plan assumes TS files export raw strings (no extra loader required).

---

## Implementation notes and example snippet for `Highlighter.ts`

Location: `src/Highlighter.ts` (the Expressive Code highlighter pipeline). The ideal insertion point is after the expressive code `render` call and before/during DOM insertion. Pseudocode:

```ts
// After expressive code produced `frameHtml` or inserted DOM `frameEl`:
const titleEl = frameEl.querySelector('.ec-frame-title, .ec-frame-header');
if (titleEl) {
  const filename = extractFileNameFromTitle(titleEl.textContent || '');
  const iconId = getIconIdForFilenameOrLanguage(filename, languageId);
  if (iconId) {
    const iconEl = renderIconElement(iconId);
    iconEl.classList.add('shiki-vscode-icon');
    iconEl.setAttribute('aria-hidden', 'true');
    titleEl.prepend(iconEl);
  }
}
```

Risks: If `frameEl` is only available as string HTML at this point, prefer creating a temporary DOM node (`const tmp = document.createElement('div'); tmp.innerHTML = frameHtml;`) then mutate and read back `tmp.innerHTML`. But prefer direct DOM insertion (safer) when `frameEl` exists.

---

## Build risks & mitigations
- SVG imports: Instead of importing raw `.svg` files (which may need an esbuild loader), export SVG text from `src/icons/svgs.ts` as string constants — avoids loader config changes.
- Duplicate `@expressive-code/*` versions: Avoid installing external `expressive-code-file-icons`. Using local mapping avoids this risk.
- Bundle size: embedding ~50 SVG strings will increase bundle size; keep icons optimized (minified, remove metadata). Start with ~20 core icons then expand.
- TypeScript JSON imports: ensure `resolveJsonModule` is enabled.
- DOM environment: Obsidian plugins run in Electron renderer. Avoid Node-only APIs and `fs` at runtime.

---

## Tests to run (TDD checklist)
- `bun run tsc` — no type errors.
- `bun run build` — successful esbuild bundling.
- Dev watch: `bun run dev` — smoke test for missing imports.
- Manual Obsidian test (recommended):
  - Create a note in `exampleVault/` with the sample blocks below, load the plugin in Obsidian, and verify icons + other features behave as expected.

Sample test code block for verification:

```markdown
```python title="script.py"
import sys
print('hello')
```

```js
// language-only fence
console.log('hello')
```
```

---

## BRAT packaging / install path
- The plugin packages to a standard Obsidian plugin directory: after build, the folder to upload via BRAT should be the repo root dist/ output; typical BRAT install expects a plugin folder containing `manifest.json`, `main.js` or `main.ts` transpiled to `main.js`, and assets. Confirm build output (`dist/`) contains these files.
- Final BRAT path to provide: `<repo-root>/dist` (to be validated after build).

---

## Estimation & milestones
- Phase 1 (assets + mapping): 1–2 hours (create initial ~20 icons as test set).
- Phase 2 (renderer + test): 0.5–1 hour.
- Phase 3 (Highlighter integration): 1–2 hours (including careful DOM wiring and testing).
- Phase 4 (styling + theme adaptation): 0.5–1 hour.
- Phase 5 (build & BRAT test): 0.5–1 hour.

---

## Questions & confirmations
1. Confirmed: local mapping approach (you chose local mapping). Good.
2. Confirmed: high-fidelity VS Code colored SVGs (~50 core languages). Plan will start with a smaller curated set and expand.
3. Confirmed: show icons for language-only blocks automatically. We'll implement that default behavior.

---

If this plan looks good, I will proceed to implement Phase 1 (create `src/icons/*` files and update `tsconfig.json`), then run `bun run tsc` and `bun run build` to validate. If you'd like me to proceed, reply "Approve plan — implement Phase 1" or ask for adjustments.
