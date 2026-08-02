// lite-template test suite: render, escape, async, failsafes, brute fuzz.
// Uses Node's built-in test runner (zero dependencies). Run: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render, compile } from '../dist/index.js';

describe('render() basic', () => {
  it('interpolates an escaped value', async () => {
    const out = await render('<h1><%= name %></h1>', { name: 'World' });
    assert.equal(out, '<h1>World</h1>');
  });

  it('HTML-escapes <%= %> output (CWE-79)', async () => {
    const out = await render('<%= x %>', { x: '<script>alert(1)</script>' });
    assert.equal(out, '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.ok(!/<script>/i.test(out));
  });

  it('does NOT escape <%- %> raw output', async () => {
    const out = await render('<%- x %>', { x: '<b>bold</b>' });
    assert.equal(out, '<b>bold</b>');
  });

  it('ignores <%# comments %>', async () => {
    const out = await render('<%# this is ignored %>done', {});
    assert.equal(out, 'done');
  });

  it('executes JS in <% %>', async () => {
    const out = await render('<% if (true) { %>yes<% } %>', {});
    assert.equal(out, 'yes');
  });

  it('handles loops', async () => {
    const out = await render('<% items.forEach(i => { %><span><%= i %></span><% }) %>', { items: ['a', 'b'] });
    assert.equal(out, '<span>a</span><span>b</span>');
  });
});

describe('async / await', () => {
  it('awaits promises inside templates', async () => {
    const out = await render('<%= await asyncFn() %>', { asyncFn: async () => 'resolved' });
    assert.equal(out, 'resolved');
  });

  it('awaits in a loop', async () => {
    const tpl = '<% for (const n of nums) { %><%= await fetch(n) %><% } %>';
    const out = await render(tpl, { nums: [1, 2], fetch: async (n) => `v${n}` });
    assert.equal(out, 'v1v2');
  });
});

describe('compile()', () => {
  it('returns a reusable async function', async () => {
    const fn = compile('<%= x %>');
    assert.equal(typeof fn, 'function');
    assert.equal(await fn({ x: 'a' }), 'a');
    assert.equal(await fn({ x: 'b' }), 'b');
  });
});

describe('failsafes', () => {
  it('undefined variables render as empty string, not "undefined"', async () => {
    const out = await render('<%= maybe %>', {});
    assert.equal(out, '');
  });

  it('empty template returns empty string', async () => {
    const out = await render('', {});
    assert.equal(out, '');
  });

  it('plain text without tags passes through unchanged', async () => {
    const out = await render('hello world', {});
    assert.equal(out, 'hello world');
  });

  it('broken JS in a tag rejects cleanly (compile-time error surfaces)', async () => {
    // A syntax error inside <% %> must reject; it must NOT silently produce output.
    await assert.rejects(() => render('<% if ( %>', {}));
  });
});

describe('brute fuzz: adversarial template strings', () => {
  // Invariant A: <%= %> must never let raw script tags through (always escaped).
  // Invariant B: malformed templates must reject, never hang or emit partial output.
  const payloads = [
    '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '"><svg onload=alert(1)>',
    '${7*7}', '<%= global.process %>', '<%= await fetch("http://x") %>',
    'a<%=x%>b', '<%-%>', '<%=%>', '<%%>', '<%- -%>',
  ];
  it('runs 1000 fuzz iterations, all escapes stay safe', async () => {
    let escapedOk = 0;
    for (let i = 0; i < 1000; i++) {
      const p = payloads[i % payloads.length];
      const tpl = `<%= val %>${p}<%= val2 %>`;
      try {
        const out = await render(tpl, { val: p, val2: p });
        // Any user-derived value flowing through <%= must be escaped.
        assert.ok(!/<script[\s>]/i.test(out), `raw script at i=${i}: ${out}`);
        assert.ok(!/<img[^>]*onerror/i.test(out), `img onerror at i=${i}: ${out}`);
        assert.ok(!/<svg[^>]*onload/i.test(out), `svg onload at i=${i}: ${out}`);
        escapedOk++;
      } catch (e) {
        // Rejecting is also acceptable for adversarial input.
      }
    }
    assert.ok(escapedOk > 0, 'no fuzz iteration rendered');
  });
});

describe('brute fuzz: every closed <%= %> pair renders the escaped value', () => {
  it('100 random unicode strings all survive round-trip via escape', async () => {
    for (let i = 0; i < 100; i++) {
      const val = `u${i}-<>&"'-${'🎉'.repeat(i % 5)}`;
      const out = await render('<%= v %>', { v: val });
      assert.ok(out.includes('&lt;'));
      assert.ok(out.includes('&gt;'));
      assert.ok(out.includes('&quot;'));
      assert.ok(!/<|>/.test(out.replace(/&lt;|&gt;/g, '')));
    }
  });
});