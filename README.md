# Sort Text — a MarkEdit extension

See my original blog post for more background: <https://www.cantoni.org/2026/08/19/markedit-sort-text-extension/>

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

**One-click (MarkEdit 1.34+):** open the [project page](https://bcantoni.github.io/markedit-sort-text/) and click **Add to MarkEdit**. (GitHub doesn't link custom URL schemes, but anywhere that does, the deep link is `markedit://install-extension?url=https%3A%2F%2Fbcantoni.github.io%2Fmarkedit-sort-text%2Fmarkedit-sort-text.js`.) MarkEdit shows a confirmation, downloads the script, pins its sha256, and offers a relaunch.

**From a URL (MarkEdit 1.34+):** in MarkEdit, open the **Extensions** window, choose **Actions → Install from URL…**, and paste:

```
https://bcantoni.github.io/markedit-sort-text/markedit-sort-text.js
```

**Manually (any version):** MarkEdit loads every user extension as a single `.js` file from its sandboxed scripts folder:

```sh
cp markedit-sort-text.js ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
```

However you install, **relaunch MarkEdit** afterwards — user scripts are attached when an editor window's web view is created, so a running app won't pick up changes. On 1.34+ the extension appears in the Extensions window (id `markedit-sort-text`, derived from the filename) where it can be enabled/disabled; on 1.33.x and earlier, every `.js` file in `scripts/` is injected unconditionally and removing the file is the only off switch.

## Toolbar icon

Extensions themselves don't have a toolbar API, but MarkEdit lets you pin any main-menu item, including ones added by extensions, to the toolbar via a custom `editor.customToolbarItems` entry in `settings.json`:

1. Open `settings.json` with `Shift-Command-Comma`.
2. Add an entry under `editor.customToolbarItems` referencing the menu by title — either the whole **Sort Text** submenu as one dropdown icon:

   ```json
   "editor.customToolbarItems": [
     { "title": "Sort Text", "icon": "arrow.up.arrow.down", "menuName": "Sort Text" }
   ]
   ```

   or each direction as its own one-click icon:

   ```json
   "editor.customToolbarItems": [
     { "title": "Sort A→Z", "icon": "arrow.up", "actionName": "Sort Lines A → Z" },
     { "title": "Sort Z→A", "icon": "arrow.down", "actionName": "Sort Lines Z → A" }
   ]
   ```

3. Relaunch MarkEdit, then right-click the toolbar → **Customize Toolbar…** and drag the new item in.

See the [Customization wiki](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization#editorcustomtoolbaritems) for the full `customToolbarItems` reference.

## Development

The whole extension is one hand-written file, `markedit-sort-text.js` — plain classic JavaScript, no dependencies, no build step. MarkEdit wraps each script in an IIFE with a CommonJS shim and injects it as a `WKUserScript`, so top-level ESM `import`/`export` won't work; everything comes from the global `MarkEdit` object instead.

Edit → deploy loop:

```sh
cp markedit-sort-text.js ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/ && \
  osascript -e 'tell app "MarkEdit" to quit' && sleep 1 && open -a MarkEdit
```

Debugging: right-click the editor → **Inspect Element** (or Option-Cmd-I) opens the WebKit inspector; `console.log` and errors from the script land there.

### Tests

`test.js` is a Node harness that loads `markedit-sort-text.js` exactly the way MarkEdit injects it (classic script + `MarkEdit` global) against a mock CodeMirror document, and asserts the sort behavior including all the edge cases above:

```sh
node test.js
```

No MarkEdit or npm install required.

### API surface used

- `MarkEdit.onEditorReady(fn)` — defer setup until the editor exists.
- `MarkEdit.addMainMenuItem(item)` — adds the submenu; `MenuItem` supports `title`, `action`, `key`, `modifiers` (`'Shift' | 'Control' | 'Option' | 'Command'`), `children`, `icon` (SF Symbol name). Adding a keyboard shortcut is a one-line change, e.g. `{ title: 'Sort Lines A → Z', key: 's', modifiers: ['Command', 'Option'], action: ... }`.
- `MarkEdit.editorView` — the live CodeMirror 6 `EditorView`; sorting reads `state.doc` / `state.selection` and applies a single `view.dispatch({ changes })` transaction.

References: [Customization wiki](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization) · [MarkEdit-api](https://github.com/MarkEdit-app/MarkEdit-api) (full `index.d.ts` of the `MarkEdit` global).

## Distribution

The extension is distributed from this repo's GitHub Pages site (served straight from the `main` branch root, so the install URL always tracks `main`):

- Landing page with an install button: <https://bcantoni.github.io/markedit-sort-text/>
- Raw script (the URL MarkEdit installs from): <https://bcantoni.github.io/markedit-sort-text/markedit-sort-text.js>

How MarkEdit's URL install works (per `ExtensionInstaller`/`ExtensionDownloader` in the MarkEdit source): the URL must be a direct HTTPS link to the `.js` file; the id derives from the filename (`markedit-sort-text.js` → `markedit-sort-text`); the app confirms with the user, records the sha256 of the downloaded bytes, and writes `scripts/<id>.js`. URL-installed extensions show as "Local" and don't auto-update — reinstalling from the same URL overwrites in place.

### Registry submission

For an in-app **Discover** listing with auto-updates, the extension needs an entry in the community registry, [MarkEdit-app/extensions](https://github.com/MarkEdit-app/extensions). `registry/markedit-sort-text.json` in this repo is a ready-to-submit entry (validated against the registry's `extension.schema.json`): open a PR that adds it as `extensions/markedit-sort-text.json` in that repo. Its version URL is pinned to the immutable `v1.0.0` tag with the matching sha256; refresh the `date` field at submission time (the schema wants the UTC hour the version is checked into the registry).

### Releasing a new version

1. Edit `markedit-sort-text.js` and run the tests:

   ```sh
   node test.js
   ```

2. Commit and push to `main`. That alone updates the Pages install URL — new URL installs get the new code immediately. (Existing URL installs don't auto-update; reinstalling from the landing page overwrites in place.)

3. Tag and cut a GitHub release (bump per semver):

   ```sh
   git tag v1.1.0 && git push origin v1.1.0
   gh release create v1.1.0 --title "v1.1.0" --notes "What changed." markedit-sort-text.js
   ```

4. Hash the exact bytes at the immutable tag URL (this is what MarkEdit verifies):

   ```sh
   curl -fsSL https://raw.githubusercontent.com/bcantoni/markedit-sort-text/v1.1.0/markedit-sort-text.js | shasum -a 256
   ```

5. Prepend a new entry to `versions` in `registry/markedit-sort-text.json` — `version`, `date` (`date -u +"%Y-%m-%dT%H:00:00Z"`), the tag's raw URL, the sha256 from step 4, and short `notes`. The registry keeps only the newest 5 entries. Commit and push.

6. PR the updated file to [MarkEdit-app/extensions](https://github.com/MarkEdit-app/extensions) as `extensions/markedit-sort-text.json`. Once merged, registry installs see the update per each user's update-behavior setting.

Steps 3–6 only matter for the registry lane; steps 1–2 are a complete release for URL installs.

### Possible future work

- **TypeScript conversion**: for type-checked development, restructure as a Vite project with `"markedit-api": "https://github.com/MarkEdit-app/MarkEdit-api#v0.30.0"` in `devDependencies`, MarkEdit/CodeMirror imports marked `external`, and a single-file CommonJS bundle as output (see the MarkEdit-api README). For a script this size, plain JS is a fine place to stay.
- Feature ideas: keyboard shortcuts, "Reverse Lines", "Sort A → Z removing duplicates", case-sensitive variant, sorting Markdown list items by text rather than raw line.
