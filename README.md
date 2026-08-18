# Sort Text — a MarkEdit extension

Adds a **Sort Text** submenu to [MarkEdit](https://github.com/MarkEdit-app/MarkEdit)'s **Extensions** menu with two commands:

- **Sort Lines A → Z**
- **Sort Lines Z → A**

Both act on the selected lines when there is a selection, otherwise on the whole file. Sorting is case-insensitive, locale-aware, and numeric-aware (`item2` sorts before `item10`, `éclair` sorts with `e`), via `localeCompare(..., { sensitivity: 'base', numeric: true })`. A whole sort is one undo step (Cmd+Z restores everything).

Edge cases handled:

- A selection is expanded to whole-line bounds, but a selection ending at column 0 does **not** drag in that line (standard editor behavior).
- Multiple selections (multi-cursor) sort independently; overlapping or touching ranges are merged first so the edit never conflicts.
- A trailing newline at the end of the file stays there instead of becoming a blank line sorted to the top.
- `Array.prototype.sort` is stable, so lines equal under the case-insensitive compare keep their relative order.

## Install

MarkEdit loads every user extension as a single `.js` file from its sandboxed scripts folder:

```sh
cp sort-text.js ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
```

Then **relaunch MarkEdit** — user scripts are attached when an editor window's web view is created, so a running app won't pick up changes.

Version notes:

- **MarkEdit 1.33.x** (current release): every `.js` file in `scripts/` is injected unconditionally. No registration step exists; there is no way to disable a script other than removing the file.
- **MarkEdit 1.34+**: the app keeps an `extensions.json` registry next to the scripts folder. A new file is auto-adopted on launch (id derived from the filename: `sort-text.js` → `sort-text`) and can be enabled/disabled from the Extensions window. No action needed when upgrading.

## Development

The whole extension is one hand-written file, `sort-text.js` — plain classic JavaScript, no dependencies, no build step. MarkEdit wraps each script in an IIFE with a CommonJS shim and injects it as a `WKUserScript`, so top-level ESM `import`/`export` won't work; everything comes from the global `MarkEdit` object instead.

Edit → deploy loop:

```sh
cp sort-text.js ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/ && \
  osascript -e 'tell app "MarkEdit" to quit' && sleep 1 && open -a MarkEdit
```

Debugging: right-click the editor → **Inspect Element** (or Option-Cmd-I) opens the WebKit inspector; `console.log` and errors from the script land there.

### Tests

`test.js` is a Node harness that loads `sort-text.js` exactly the way MarkEdit injects it (classic script + `MarkEdit` global) against a mock CodeMirror document, and asserts the sort behavior including all the edge cases above:

```sh
node test.js
```

No MarkEdit or npm install required.

### API surface used

- `MarkEdit.onEditorReady(fn)` — defer setup until the editor exists.
- `MarkEdit.addMainMenuItem(item)` — adds the submenu; `MenuItem` supports `title`, `action`, `key`, `modifiers` (`'Shift' | 'Control' | 'Option' | 'Command'`), `children`, `icon` (SF Symbol name). Adding a keyboard shortcut is a one-line change, e.g. `{ title: 'Sort Lines A → Z', key: 's', modifiers: ['Command', 'Option'], action: ... }`.
- `MarkEdit.editorView` — the live CodeMirror 6 `EditorView`; sorting reads `state.doc` / `state.selection` and applies a single `view.dispatch({ changes })` transaction.

References: [Customization wiki](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization) · [MarkEdit-api](https://github.com/MarkEdit-app/MarkEdit-api) (full `index.d.ts` of the `MarkEdit` global).

## Toward a standalone, distributable extension

Roughly in order:

1. **Housekeeping**: add a license (MIT is typical for MarkEdit extensions), commit, push to GitHub (e.g. `brian/markedit-sort-text`), and cut a tagged release whose asset is the raw `sort-text.js`.
2. **Manual URL install (MarkEdit 1.34+)**: anyone can install from a link — `markedit://install-extension?url=<https-url-to-sort-text.js>`. The app shows a confirmation, pins the file's sha256, and offers a relaunch. Compute the hash with `shasum -a 256 sort-text.js`.
3. **Registry listing (MarkEdit 1.34+)**: the app's Extensions window browses a community index built by CI from [MarkEdit-app/extensions](https://github.com/MarkEdit-app/extensions). Getting listed means a PR adding an entry; per the app's `ExtensionRegistry` model (schema v1) an entry carries `id`, `name`, `description`, `author`, `homepage`, `category` (`extension`), and a release with `version`, `url`, `sha256`, optional `minAppVersion` and `notes`. Check that repo's contributing guide for the exact submission format once 1.34 ships.
4. **Optional TypeScript conversion**: for type-checked development, restructure as a Vite project with `"markedit-api": "https://github.com/MarkEdit-app/MarkEdit-api#v0.30.0"` in `devDependencies`, MarkEdit/CodeMirror imports marked `external`, and a single-file CommonJS bundle as output (see the MarkEdit-api README). For a script this size, plain JS is a fine place to stay.

Possible feature ideas: keyboard shortcuts, "Reverse Lines", "Sort A → Z removing duplicates", case-sensitive variant, sorting Markdown list items by text rather than raw line.
