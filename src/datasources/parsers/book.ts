import * as cheerio from 'cheerio';
import type { BookDetail, SubjectSummary, Review } from '../types.js';
import { ParseError } from '../../errors.js';

/**
 * 从 #info 中按 label 文字找到其后的内容（文本节点 + a 链接文本）。
 * 策略：找到 span.pl 后，收集其父节点 contents() 中该 span 之后的节点，
 * 直到遇到 <br> 或另一个 span.pl 为止。
 */
function pickInfoValue($: cheerio.CheerioAPI, label: string): string | undefined {
  let result: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('#info span.pl').each((_: number, el: any) => {
    const plText = $(el).text().replace(/\s/g, '');
    if (!plText.includes(label.replace(/\s/g, ''))) return;

    // 收集 el 父节点内容中 el 之后的节点文本
    const parent = $(el).parent();
    const nodes = parent.contents().toArray();
    const plIdx = nodes.indexOf(el);
    let val = '';
    for (let i = plIdx + 1; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === 'tag' && (node.name === 'br' || $(node).is('span.pl'))) break;
      val += $(node).text();
    }
    result = val.trim().replace(/^:\s*/, '');
    return false; // break each
  });
  return result || undefined;
}

/** 取 #info 中 label 后的所有链接文本（用于作者/译者多个值） */
function pickInfoLinks($: cheerio.CheerioAPI, label: string): string[] {
  const results: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('#info span.pl').each((_: number, el: any) => {
    const plText = $(el).text().replace(/\s/g, '');
    if (!plText.includes(label.replace(/\s/g, ''))) return;

    // 找父节点 contents 中 el 之后到 <br> 为止的 <a> 元素
    const parent = $(el).parent();
    const nodes = parent.contents().toArray();
    const plIdx = nodes.indexOf(el);
    for (let i = plIdx + 1; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === 'tag' && node.name === 'br') break;
      if (node.type === 'tag' && node.name === 'a') {
        const name = $(node).text().trim();
        if (name) results.push(name);
      }
    }
    return false; // break each
  });
  return results;
}

export function parseBookDetail(html: string, id: string): BookDetail {
  const $ = cheerio.load(html);

  const title = $('h1 span[property="v:itemreviewed"]').first().text().trim()
    || $('h1 span').first().text().trim();
  if (!title) throw new ParseError(`Cannot parse book detail: title missing id=${id}`);

  const rating = parseFloat($('strong.rating_num').text()) || undefined;
  const ratingCount = parseInt($('a.rating_people span').text().replace(/,/g, ''), 10) || 0;

  const summary = $('#link-report .intro').first().text().trim()
    || $('.related_info .intro').first().text().trim();

  // 作者：span.pl 包含"作者"，之后的 <a> 链接
  const authors = pickInfoLinks($, '作者');
  const translators = pickInfoLinks($, '译者');

  const publisher = pickInfoValue($, '出版社');
  const publishDate = pickInfoValue($, '出版年');
  const pagesStr = pickInfoValue($, '页数');
  const pages = pagesStr ? (parseInt(pagesStr, 10) || undefined) : undefined;
  const price = pickInfoValue($, '定价');
  const isbn = pickInfoValue($, 'ISBN');

  const cover = $('#mainpic img').attr('src') || undefined;

  return {
    id,
    title,
    url: `https://book.douban.com/subject/${id}/`,
    cover,
    rating,
    ratingCount,
    authors,
    translators: translators.length > 0 ? translators : undefined,
    publisher: publisher || undefined,
    publishDate,
    pages,
    price,
    isbn,
    summary: summary.replace(/\s+/g, ' '),
  };
}

export function parseBookSearch(html: string): SubjectSummary[] {
  // 豆瓣搜索页数据嵌在 <script>window.__DATA__ = {...}</script>
  const scriptMatch = html.match(/window\.__DATA__\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:<\/script>|\n)/);
  if (scriptMatch) {
    try {
      const data = JSON.parse(scriptMatch[1]);
      const items: SubjectSummary[] = [];
      const rawItems: unknown[] = data?.items ?? data?.payload?.items ?? [];
      for (const it of rawItems as Record<string, unknown>[]) {
        // 只取图书 subject 条目（tpl_name === 'search_subject'）
        if (it.tpl_name !== 'search_subject') continue;
        if (!it.id) continue;
        const rating = it.rating as Record<string, unknown> | undefined;
        items.push({
          id: String(it.id),
          title: String(it.title ?? ''),
          url: String(it.url ?? `https://book.douban.com/subject/${it.id}/`),
          rating: typeof rating?.value === 'number' ? rating.value : undefined,
          cover: it.cover_url ? String(it.cover_url) : undefined,
        });
      }
      if (items.length > 0) return items;
    } catch {
      // fall through to DOM parsing
    }
  }

  // Fallback DOM 解析
  const $ = cheerio.load(html);
  const out: SubjectSummary[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('.search-result .item-root, .item-root').each((_: number, el: any) => {
    const titleA = $(el).find('a.title-text, a.title').first();
    const url = titleA.attr('href') ?? '';
    const m = url.match(/\/subject\/(\d+)/);
    if (!m) return;
    out.push({
      id: m[1],
      title: titleA.text().trim(),
      url,
      rating: parseFloat($(el).find('.rating_nums').first().text()) || undefined,
      cover: $(el).find('img').attr('src') || undefined,
    });
  });
  return out;
}

export function parseBookReviewsFromHtml(html: string): Review[] {
  const $ = cheerio.load(html);
  const out: Review[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('.comment-item').each((_: any, el: any) => {
    const author = $(el).find('.comment-info a').first();
    const ratingClass = $(el).find('.user-stars').attr('class') ?? '';
    const ratingMatch = ratingClass.match(/allstar(\d)0/);
    out.push({
      author: author.text().trim(),
      authorUid: (author.attr('href') ?? '').match(/\/people\/([^/]+)/)?.[1] ?? '',
      rating: ratingMatch ? parseInt(ratingMatch[1], 10) : undefined,
      content: $(el).find('.short').text().trim(),
      publishedAt: $(el).find('.comment-time').attr('title') ?? $(el).find('.comment-time').text().trim(),
      usefulCount: parseInt($(el).find('.vote-count').text(), 10) || 0,
    });
  });
  return out;
}
