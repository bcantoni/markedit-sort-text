// Sort Text — a MarkEdit extension.
//
// Adds "Sort Text" to the Extensions menu with two commands that sort lines
// alphabetically (case-insensitive, locale- and number-aware). Commands act on
// the selected lines when there is a selection, otherwise on the whole file.
//
// Install (MarkEdit 1.34+): in MarkEdit, Extensions → Actions → Install from URL…
// with https://bcantoni.github.io/markedit-sort-text/markedit-sort-text.js
// Or copy this file to ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
// Relaunch MarkEdit after installing.

MarkEdit.onEditorReady(() => {
  MarkEdit.addMainMenuItem({
    title: 'Sort Text',
    children: [
      { title: 'Sort Lines A → Z', action: () => sortLines(false) },
      { title: 'Sort Lines Z → A', action: () => sortLines(true) },
    ],
  });
});

function sortLines(descending) {
  const view = MarkEdit.editorView;
  const { doc } = view.state;

  const compare = (a, b) => a.localeCompare(b, undefined, {
    sensitivity: 'base',
    numeric: true,
  });

  const changes = lineRangesToSort(doc).map(({ from, to }) => {
    const lines = doc.sliceString(from, to).split('\n');
    lines.sort(descending ? (a, b) => compare(b, a) : compare);
    return { from, to, insert: lines.join('\n') };
  });

  view.dispatch({ changes });
  view.focus();
}

// Whole-line ranges to sort: each non-empty selection expanded to line bounds
// (merged when they overlap or touch), or the entire document when there is no
// selection.
function lineRangesToSort(doc) {
  const expanded = MarkEdit.editorView.state.selection.ranges
    .filter(range => !range.empty)
    .map(range => {
      const endLine = doc.lineAt(range.to);
      return {
        from: doc.lineAt(range.from).from,
        // A selection ending at column 0 doesn't include that line
        to: range.to === endLine.from ? range.to - 1 : endLine.to,
      };
    })
    .sort((a, b) => a.from - b.from);

  if (expanded.length === 0) {
    const lastLine = doc.line(doc.lines);
    return [{
      from: 0,
      // Keep a trailing newline at the end of the file instead of sorting the
      // empty last line to the top
      to: lastLine.length === 0 && doc.lines > 1 ? lastLine.from - 1 : doc.length,
    }];
  }

  const merged = [expanded[0]];
  for (const range of expanded.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.from <= last.to + 1) {
      last.to = Math.max(last.to, range.to);
    } else {
      merged.push(range);
    }
  }
  return merged;
}
