const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const scriptPath = path.join(__dirname, '../scripts/reader.js');

function page(body, options = {}) {
  const dom = new JSDOM(`<main class="content">${body}</main>`, {
    url: 'https://example.test/book/chapter/section.html', runScripts: 'outside-only'
  });
  const { window } = dom;
  if (options.search) window.fuseSearch = options.search;
  // jsdom has no native modal rendering; exercise the lifecycle around it.
  if (options.dialog !== false) {
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new window.Event('close'));
    };
  }
  if (fs.existsSync(scriptPath)) window.eval(fs.readFileSync(scriptPath, 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

test('table preserves text, markup and empty answers, protects short bit cells only', () => {
  const dom = page('<table><thead><tr><th>位</th><th>说明</th><th>答案</th></tr></thead><tbody><tr><td>0 00 00</td><td>这是一段需要正常换行的文字说明，不能让整个段落撑宽表格。</td><td></td></tr><tr><td><code>5 [101]</code></td><td>2<sup>E</sup></td><td></td></tr></tbody></table>');
  const doc = dom.window.document;
  const table = doc.querySelector('table');
  assert.ok(table.parentElement.classList.contains('reader-table'));
  assert.equal(table.parentElement.tabIndex, 0);
  assert.equal(table.rows[1].cells[0].textContent, '0 00 00');
  assert.ok(table.rows[1].cells[0].classList.contains('reader-compact'));
  assert.ok(!table.rows[1].cells[1].classList.contains('reader-compact'));
  assert.equal(table.rows[1].cells[2].innerHTML, '');
  assert.equal(table.rows[2].cells[1].innerHTML, '2<sup>E</sup>');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  assert.equal(doc.querySelectorAll('.reader-table').length, 1);
  dom.window.close();
});

test('image opens an accessible dialog, zooms, closes and restores focus', () => {
  const dom = page('<img class="reader-figure" src="../assets/figure.png" alt="Figure" width="1000" height="500">');
  const { document: doc, MouseEvent } = dom.window;
  const link = doc.querySelector('a.reader-image');
  assert.ok(link, 'Figure must have a direct original-image link');
  assert.equal(link.href, 'https://example.test/book/assets/figure.png');
  link.focus();
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  const dialog = doc.querySelector('dialog');
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector('img').alt, 'Figure');
  assert.equal(dialog.querySelector('img').src, link.href);
  dialog.querySelector('[data-reader-zoom]').click();
  assert.equal(dialog.querySelector('[data-reader-zoom]').getAttribute('aria-pressed'), 'true');
  dialog.querySelector('[data-reader-close]').click();
  assert.equal(dialog.open, false);
  assert.equal(doc.activeElement, link);
  assert.equal(doc.body.style.overflow, '');
  dom.window.close();
});

test('existing links remain intact and modified clicks keep browser navigation', () => {
  const dom = page('<a href="/download"><img src="x.png" alt="Linked"></a><img class="reader-figure" src="y.png" alt="Plain">');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('a[href="/download"]').getAttribute('href'), '/download');
  assert.equal(doc.querySelectorAll('a a').length, 0);
  const link = doc.querySelector('.reader-image');
  assert.ok(link);
  const click = new dom.window.MouseEvent('click', { ctrlKey: true, cancelable: true });
  link.dispatchEvent(click);
  assert.equal(click.defaultPrevented, false);
  assert.ok(!doc.querySelector('dialog')?.open);
  dom.window.close();
});

test('without dialog support the original-image link still works', () => {
  const dom = page('<img class="reader-figure" src="x.png" alt="Figure">', { dialog: false });
  const link = dom.window.document.querySelector('.reader-image');
  assert.ok(link);
  const click = new dom.window.MouseEvent('click', { cancelable: true });
  link.dispatchEvent(click);
  assert.equal(click.defaultPrevented, false);
  dom.window.close();
});

test('closing through the native lifecycle resets scroll lock and reopening resets zoom', () => {
  const dom = page('<img class="reader-figure" src="one.png" alt="One"><img class="reader-figure" src="two.png" alt="Two">');
  const doc = dom.window.document;
  doc.body.style.overflow = 'auto';
  const links = doc.querySelectorAll('.reader-image');
  links[0].click();
  const dialog = doc.querySelector('dialog');
  dialog.querySelector('[data-reader-zoom]').click();
  dialog.close();
  assert.equal(doc.body.style.overflow, 'auto');
  links[1].click();
  assert.equal(doc.querySelectorAll('dialog').length, 1);
  assert.equal(dialog.querySelector('img').alt, 'Two');
  assert.equal(dialog.querySelector('[data-reader-zoom]').getAttribute('aria-pressed'), 'false');
  assert.ok(!dialog.classList.contains('reader-fullsize'));
  dialog.close();
  assert.equal(doc.activeElement, links[1]);
  dom.window.close();
});

test('an exact section number precedes substring matches without changing keyword search', async () => {
  const matches = [
    {title: '12.4.3 共享变量', href: 'chapter-12/12.4.3.html'},
    {title: '2.4.3 数字示例', href: 'chapter-02/2.4.3.html#example'},
    {title: '2.4.3 数字示例', href: 'chapter-02/2.4.3.html'},
    {title: '2.4.30 Another section', href: 'other.html'}
  ];
  const dom = page('', {search: async () => matches});
  const ranked = await dom.window.fuseSearch('2.4.3', {}, {});
  assert.equal(ranked[0].href, 'chapter-02/2.4.3.html');
  assert.equal(ranked[1].href, 'chapter-02/2.4.3.html#example');
  assert.equal(ranked[2], matches[0]);
  assert.deepEqual(await dom.window.fuseSearch('虚拟内存', {}, {}), matches);
  assert.equal(matches[0].title, '12.4.3 共享变量', 'Original result array must not be mutated');
  dom.window.close();
});
