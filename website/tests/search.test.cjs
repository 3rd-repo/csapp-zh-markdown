/* Run after Quarto render: verify the adapter against Quarto's actual engine. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const site = path.join(__dirname, '../build/_site');

test('generated search keeps exact chapter numbers first and finds Chinese terms', async () => {
  const Fuse = require(path.join(site, 'site_libs/quarto-search/fuse.min.js'));
  const docs = JSON.parse(fs.readFileSync(path.join(site, 'search.json'), 'utf8'));
  const index = new Fuse(docs, {
    keys: [{name: 'title', weight: 20}, {name: 'section', weight: 20}, {name: 'text', weight: 10}],
    ignoreLocation: true, threshold: 0.1
  });
  const dom = new JSDOM('<main class="content"></main>', {
    url: 'https://example.test/csapp-zh-markdown/', runScripts: 'outside-only'
  });
  try {
    dom.window.Fuse = Fuse;
    dom.window.eval(fs.readFileSync(path.join(site, 'site_libs/quarto-search/quarto-search.js'), 'utf8'));
    assert.equal(typeof dom.window.fuseSearch, 'function', 'Review reader.js adapter when upgrading Quarto');
    dom.window.eval(fs.readFileSync(path.join(site, 'reader.js'), 'utf8'));
    const queries = [
      ['2.4.3', 'chapter-02/2.4/2.4.3-numeric-examples.html'],
      ['虚拟内存', 'chapter-09/'], ['高速缓存', 'chapter-06/'],
      ['链接', 'chapter-07/'], ['并发', 'chapter-12/'],
      ['Data Lab', 'labs/datalab-zh/'], ['练习题答案', 'answers.html']
    ];
    for (const [query, expected] of queries) {
      const hits = await dom.window.fuseSearch(query, index, {limit: 20});
      assert.ok(hits.some(hit => hit.href.includes(expected)), query);
      if (query === '2.4.3') assert.ok(hits[0].href.startsWith(expected), 'Exact section must come first');
    }
    assert.ok(!docs.some(doc => /(?:^|\/)chapter\.html(?:#|$)/.test(doc.href)), 'Duplicate whole-chapter entry');
    assert.ok(!docs.some(doc => /(?:chapter-\d+|preface|appendix|labs)\/index\.html(?:#|$)/.test(doc.href)), 'Duplicate directory entry');
  } finally {
    dom.window.close();
  }
});
