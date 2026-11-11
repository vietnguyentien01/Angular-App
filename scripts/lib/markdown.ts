import { Marked, type Tokens, type TokenizerAndRendererExtension } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';
import type { ContentBlock, TocEntry } from '../../src/app/core/content/content.models';

/**
 * Markdown → HTML cho nội dung của app.
 *
 * Quy tắc an toàn: HTML thô trong Markdown bị escape (không render).
 * Nhờ vậy HTML đầu ra chỉ do marked + shiki sinh ra, và app có thể tin tưởng nó.
 *
 * Cú pháp mở rộng:
 *   :::tip|note|warning|danger|senior [Tiêu đề]   ... :::   → khung ghi chú
 *   :::version v16 [Tiêu đề]                      ... :::   → khác biệt theo phiên bản cũ
 *   :::interview Câu hỏi phỏng vấn?               ... :::   → câu hỏi + đáp án ẩn
 *   :::demo ten-demo                                        → nhúng demo tương tác
 *   ```ts good title="app.ts"    /    ```ts bad              → khối code có nhãn
 */

const LANGS = [
  'ts',
  'typescript',
  'js',
  'javascript',
  'html',
  'css',
  'scss',
  'json',
  'bash',
  'shell',
  'yaml',
  'diff',
  'text',
];
const CALLOUTS: Record<string, string> = {
  tip: 'Mẹo',
  note: 'Ghi chú',
  warning: 'Cẩn thận',
  danger: 'Nguy hiểm',
  senior: 'Góc nhìn Senior',
  version: 'Khác biệt phiên bản',
};
const DEMO_MARKER = (name: string) => `<!--demo:${name}-->`;
const DEMO_SPLIT = /<!--demo:([a-z0-9-]+)-->/;

let highlighter: Highlighter | undefined;

export async function initHighlighter(): Promise<void> {
  highlighter ??= await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: LANGS.filter((l) => l !== 'text'),
  });
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function highlight(code: string, lang: string): string {
  const language = LANGS.includes(lang) ? lang : 'text';
  if (!highlighter || language === 'text') {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
  return highlighter.codeToHtml(code, {
    lang: language,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
}

function parseCodeInfo(info: string | undefined) {
  const raw = (info ?? '').trim();
  const lang = raw.split(/\s+/)[0] ?? '';
  const title = /title="([^"]*)"/.exec(raw)?.[1];
  const verdict = /\bgood\b/.test(raw.slice(lang.length))
    ? 'good'
    : /\bbad\b/.test(raw.slice(lang.length))
      ? 'bad'
      : undefined;
  return { lang, title, verdict };
}

interface ContainerToken extends Tokens.Generic {
  type: 'container';
  variant: string;
  title: string;
  titleTokens: Tokens.Generic[];
  tokens: Tokens.Generic[];
}

interface DemoToken extends Tokens.Generic {
  type: 'demo';
  name: string;
}

export interface RenderResult {
  blocks: ContentBlock[];
  toc: TocEntry[];
  demos: string[];
  words: number;
}

export function renderMarkdown(source: string): RenderResult {
  const toc: TocEntry[] = [];
  const usedIds = new Map<string, number>();
  const demos: string[] = [];

  const demoExt: TokenizerAndRendererExtension = {
    name: 'demo',
    level: 'block',
    start: (src) => src.match(/^:::demo/m)?.index,
    tokenizer(src) {
      const match = /^:::demo[ \t]+([a-z0-9-]+)[ \t]*(?:\n|$)/.exec(src);
      if (match) {
        return { type: 'demo', raw: match[0], name: match[1] } satisfies DemoToken;
      }
      return undefined;
    },
    renderer(token) {
      const name = (token as DemoToken).name;
      demos.push(name);
      return DEMO_MARKER(name);
    },
  };

  const containerExt: TokenizerAndRendererExtension = {
    name: 'container',
    level: 'block',
    start: (src) => src.match(/^:::/m)?.index,
    tokenizer(src) {
      const match = /^:::([a-z]+)(?:[ \t]+([^\n]*))?\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(src);
      if (!match) return undefined;
      const [, variant, title = '', body] = match;
      if (variant === 'demo') return undefined;
      if (variant !== 'interview' && !(variant in CALLOUTS)) {
        throw new Error(
          `Container không hợp lệ ":::${variant}". Cho phép: ${[...Object.keys(CALLOUTS), 'interview', 'demo'].join(', ')}`,
        );
      }
      const token: ContainerToken = {
        type: 'container',
        raw: match[0],
        variant,
        title: title.trim(),
        titleTokens: this.lexer.inlineTokens(title.trim()),
        tokens: [],
      };
      this.lexer.blockTokens(body, token.tokens);
      return token;
    },
    renderer(token) {
      const t = token as ContainerToken;
      const body = this.parser.parse(t.tokens);
      const title = this.parser.parseInline(t.titleTokens);
      if (t.variant === 'interview') {
        return `<details class="interview"><summary><span class="interview-label">Phỏng vấn</span> ${title}</summary><div class="interview-answer">${body}</div></details>\n`;
      }
      if (t.variant === 'version') {
        const [version, ...rest] = t.title.split(/\s+/);
        const label = rest.length ? escapeHtml(rest.join(' ')) : CALLOUTS['version'];
        return `<aside class="callout callout-version"><p class="callout-title"><span class="version-badge">${escapeHtml(version ?? '')}</span> ${label}</p>${body}</aside>\n`;
      }
      const heading = t.title ? title : CALLOUTS[t.variant];
      return `<aside class="callout callout-${t.variant}"><p class="callout-title">${heading}</p>${body}</aside>\n`;
    },
  };

  const marked = new Marked({ gfm: true });
  marked.use({
    extensions: [demoExt, containerExt],
    renderer: {
      html({ text }) {
        return escapeHtml(text);
      },
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        const base = slugify(text) || 'muc';
        const n = usedIds.get(base) ?? 0;
        usedIds.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        if (depth === 2 || depth === 3) toc.push({ id, text: text.replace(/[`*_]/g, ''), depth });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const info = parseCodeInfo(lang);
        const labels: string[] = [];
        if (info.verdict === 'good') labels.push('<span class="code-verdict good">✓ Nên</span>');
        if (info.verdict === 'bad')
          labels.push('<span class="code-verdict bad">✗ Không nên</span>');
        if (info.title) labels.push(`<span class="code-title">${escapeHtml(info.title)}</span>`);
        const header = labels.length ? `<div class="code-header">${labels.join('')}</div>` : '';
        const cls = info.verdict ? ` code-${info.verdict}` : '';
        return `<figure class="code-block${cls}">${header}${highlight(text, info.lang)}</figure>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const safeHref = /^(https?:|mailto:|#|\/|\.)/i.test(href) ? href : '#';
        const external = /^https?:/i.test(safeHref);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        const ext = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${escapeHtml(safeHref)}"${titleAttr}${ext}>${text}</a>`;
      },
      table(token) {
        // Bọc bảng để cuộn ngang trên màn hình nhỏ.
        const header = token.header
          .map(
            (cell) =>
              `<th${cell.align ? ` style="text-align:${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</th>`,
          )
          .join('');
        const rows = token.rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`,
          )
          .join('');
        return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });

  const html = marked.parse(source, { async: false });

  const blocks: ContentBlock[] = [];
  const parts = html.split(DEMO_SPLIT);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      blocks.push({ kind: 'demo', name: part });
    } else if (part.trim()) {
      blocks.push({ kind: 'html', html: part.trim() });
    }
  });

  const prose = source.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`:\-|[\]()]/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean).length;

  return { blocks, toc, demos, words };
}
