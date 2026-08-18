// Test harness: loads markedit-sort-text.js the way MarkEdit does (classic script with a
// MarkEdit global) against a mock CodeMirror doc/view, and checks sort results.
//
// Usage: node test.js [path-to-extension.js]
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const extensionPath = process.argv[2] ?? path.join(__dirname, 'markedit-sort-text.js');

class MockDoc {
  constructor(text) { this.text = text; }
  get length() { return this.text.length; }
  get lines() { return this.text.split('\n').length; }
  line(n) {
    const parts = this.text.split('\n');
    let pos = 0;
    for (let i = 0; i < n - 1; i++) pos += parts[i].length + 1;
    return { from: pos, to: pos + parts[n - 1].length, length: parts[n - 1].length };
  }
  lineAt(pos) {
    const parts = this.text.split('\n');
    let start = 0;
    for (let i = 0; i < parts.length; i++) {
      const end = start + parts[i].length;
      if (pos <= end) return { from: start, to: end, length: parts[i].length };
      start = end + 1;
    }
    throw new Error(`pos ${pos} out of range`);
  }
  sliceString(from, to) { return this.text.slice(from, to); }
}

function makeView(text, ranges = []) {
  const view = {
    state: {
      doc: new MockDoc(text),
      selection: { ranges: ranges.map(r => ({ ...r, empty: r.from === r.to })) },
    },
    result: text,
    dispatch(tr) {
      let t = text;
      for (const c of [...tr.changes].sort((a, b) => b.from - a.from)) {
        t = t.slice(0, c.from) + c.insert + t.slice(c.to);
      }
      this.result = t;
    },
    focus() {},
  };
  return view;
}

// Load the extension like MarkEdit's IIFE wrapper does
let menu = null;
let onReady = null;
global.MarkEdit = {
  editorView: null,
  onEditorReady: fn => { onReady = fn; },
  addMainMenuItem: item => { menu = item; },
};
new Function(fs.readFileSync(extensionPath, 'utf8'))();
onReady(null);

assert.strictEqual(menu.title, 'Sort Text');
assert.deepStrictEqual(menu.children.map(c => c.title), ['Sort Lines A → Z', 'Sort Lines Z → A']);
const [az, za] = menu.children;

function run(action, text, ranges) {
  const view = makeView(text, ranges);
  global.MarkEdit.editorView = view;
  action.action();
  return view.result;
}

const cases = [
  ['whole file, case-insensitive', az, 'banana\nApple\ncherry', [],
    'Apple\nbanana\ncherry'],
  ['whole file, numeric-aware', az, 'item10\nitem2\nitem1', [],
    'item1\nitem2\nitem10'],
  ['trailing newline preserved', az, 'b\na\n', [],
    'a\nb\n'],
  ['descending', za, 'a\nc\nb', [],
    'c\nb\na'],
  ['empty doc is a no-op', az, '', [], ''],
  ['single line no selection', az, 'only', [], 'only'],
  // doc: aaa(0-3) ddd(4-7) ccc(8-11) bbb(12-15); select mid of ddd..mid of ccc
  ['selection expands to whole lines', az, 'aaa\nddd\nccc\nbbb', [{ from: 5, to: 9 }],
    'aaa\nccc\nddd\nbbb'],
  // selection ends at col 0 of ccc (pos 8) -> ccc excluded, only ddd "sorted"
  ['selection ending at column 0 excludes that line', az, 'aaa\nddd\nccc\nbbb', [{ from: 5, to: 8 }],
    'aaa\nddd\nccc\nbbb'],
  // cursor only (empty range) -> whole file
  ['caret only sorts whole file', az, 'b\na', [{ from: 1, to: 1 }],
    'a\nb'],
  // two separate selections sort independently: (ddd,ccc) and (fff,eee)
  ['two selections sort independently', az, 'ddd\nccc\nzzz\nfff\neee', [{ from: 0, to: 7 }, { from: 12, to: 19 }],
    'ccc\nddd\nzzz\neee\nfff'],
  // overlapping/adjacent selections merge: lines 1-2 and 2-3 -> lines 1-3
  ['touching selections merge', az, 'ccc\nbbb\naaa\nzzz', [{ from: 0, to: 7 }, { from: 4, to: 11 }],
    'aaa\nbbb\nccc\nzzz'],
  ['accents sort with base letters', az, 'zebra\néclair\napple', [],
    'apple\néclair\nzebra'],
];

let failed = 0;
for (const [name, action, text, ranges, expected] of cases) {
  const actual = run(action, text, ranges);
  if (actual === expected) {
    console.log(`ok  - ${name}`);
  } else {
    failed++;
    console.log(`FAIL - ${name}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}
console.log(failed === 0 ? `\nAll ${cases.length} tests passed` : `\n${failed} test(s) failed`);
process.exit(failed === 0 ? 0 : 1);
