import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { initHighlighter, renderMarkdown, slugify } from './markdown';

before(async () => {
  await initHighlighter();
});

const html = (src: string) =>
  renderMarkdown(src)
    .blocks.map((b) => (b.kind === 'html' ? b.html : `[demo:${b.name}]`))
    .join('');

describe('renderMarkdown', () => {
  it('escape HTML thô để nội dung luôn an toàn', () => {
    const out = html('Xin chào <script>alert(1)</script> <img src=x onerror=alert(1)>');
    assert.ok(!out.includes('<script>'));
    assert.ok(!out.includes('<img'));
    assert.ok(out.includes('&lt;script&gt;'));
  });

  it('chặn link javascript:', () => {
    assert.ok(!html('[x](javascript:alert(1))').includes('javascript:'));
  });

  it('link ngoài mở tab mới', () => {
    assert.match(html('[docs](https://angular.dev)'), /target="_blank" rel="noopener noreferrer"/);
  });

  it('tách demo thành block riêng', () => {
    const { blocks, demos } = renderMarkdown('Trước\n\n:::demo signals-counter\n\nSau');
    assert.deepEqual(
      blocks.map((b) => b.kind),
      ['html', 'demo', 'html'],
    );
    assert.deepEqual(demos, ['signals-counter']);
  });

  it('render callout, version và interview', () => {
    const out = html(
      ':::tip\nNội dung\n:::\n\n:::version v16 Ở bản cũ\nKhác\n:::\n\n:::interview Câu hỏi?\nĐáp án\n:::',
    );
    assert.match(out, /callout-tip/);
    assert.match(out, /<span class="version-badge">v16<\/span> Ở bản cũ/);
    assert.match(out, /<details class="interview"><summary>.*Câu hỏi\?<\/summary>/);
  });

  it('báo lỗi container không hợp lệ', () => {
    assert.throws(() => renderMarkdown(':::abc\nx\n:::'), /Container không hợp lệ/);
  });

  it('sinh mục lục với id không dấu và không trùng', () => {
    const { toc } = renderMarkdown('## Thay đổi\n\n### Chi tiết\n\n## Thay đổi');
    assert.deepEqual(
      toc.map((t) => t.id),
      ['thay-doi', 'chi-tiet', 'thay-doi-1'],
    );
  });

  it('gắn nhãn khối code good/bad và tiêu đề', () => {
    const out = html('```ts good title="app.ts"\nconst a = 1;\n```');
    assert.match(out, /code-good/);
    assert.match(out, /✓ Nên/);
    assert.match(out, /app\.ts/);
    assert.match(out, /--shiki-dark/);
  });
});

describe('slugify', () => {
  it('bỏ dấu tiếng Việt', () => {
    assert.equal(slugify('Đồng bộ dữ liệu'), 'dong-bo-du-lieu');
  });
});
