import * as cheerio from 'cheerio';
import type { MovieDetail, SubjectSummary, Person } from '../types.js';
import { ParseError } from '../../errors.js';

export function parseMovieDetail(html: string, id: string): MovieDetail {
  const $ = cheerio.load(html);

  const title = $('span[property="v:itemreviewed"]').text().trim();
  if (!title) throw new ParseError(`Cannot parse movie detail: title missing for id=${id}`);

  const yearText = $('h1 span.year').text().replace(/[()]/g, '').trim();

  const rating = parseFloat($('strong[property="v:average"]').text()) || undefined;
  const ratingCount = parseInt($('span[property="v:votes"]').text().replace(/,/g, ''), 10) || 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directors: Person[] = $('a[rel="v:directedBy"]').map((_: number, el: any) => personFromAnchor($, el)).get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const casts: Person[] = $('a[rel="v:starring"]').map((_: number, el: any) => personFromAnchor($, el)).get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genres: string[] = $('span[property="v:genre"]').map((_: number, el: any) => $(el).text().trim()).get();

  const countries = collectInfoLine($, '制片国家/地区');
  const releaseDate = $('span[property="v:initialReleaseDate"]').first().attr('content')
    ?? $('span[property="v:initialReleaseDate"]').first().text()
    ?? undefined;
  const duration = $('span[property="v:runtime"]').attr('content')
    ?? $('span[property="v:runtime"]').text()
    ?? undefined;
  const imdbId = collectInfoLine($, 'IMDb')[0];

  const summary = $('span[property="v:summary"]').text().trim().replace(/\s+/g, ' ')
    || $('#link-report .all span').text().trim().replace(/\s+/g, ' ');

  const cover = $('#mainpic img').attr('src') || $('#mainpic img').attr('data-src') || undefined;

  const ratingDistribution = parseRatingDistribution($);

  return {
    id,
    title,
    year: yearText || undefined,
    originalTitle: undefined,
    rating,
    ratingCount,
    ratingDistribution,
    url: `https://movie.douban.com/subject/${id}/`,
    cover,
    directors,
    casts,
    genres,
    countries,
    releaseDate,
    duration,
    imdbId,
    summary,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function personFromAnchor($: cheerio.CheerioAPI, el: any): Person {
  const a = $(el);
  const href = a.attr('href') ?? '';
  const m = href.match(/\/(?:celebrity|personage)\/(\d+)/);
  const id = m?.[1] ?? '';
  const url = href.startsWith('http') ? href : `https://movie.douban.com${href}`;
  return { id, name: a.text().trim(), url };
}

function collectInfoLine($: cheerio.CheerioAPI, label: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const node = $('#info span.pl, div#info span.pl').filter((_: number, el: any) => $(el).text().trim().startsWith(label)).first();
  if (!node.length) {
    // fallback: search without #info scope
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallback = $('span.pl').filter((_: number, el: any) => $(el).text().trim().startsWith(label)).first();
    if (!fallback.length) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawText = (fallback[0] as any).nextSibling?.data ?? '';
    return rawText.split('/').map((s: string) => s.trim()).filter(Boolean);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawText = (node[0] as any).nextSibling?.data ?? '';
  return rawText.split('/').map((s: string) => s.trim()).filter(Boolean);
}

function parseRatingDistribution($: cheerio.CheerioAPI): MovieDetail['ratingDistribution'] {
  const items = $('.ratings-on-weight .item');
  if (items.length < 5) return undefined;
  const pct = (i: number): number => {
    const perStr = $(items[i]).find('.rating_per').text();
    return parseFloat(perStr) / 100 || 0;
  };
  return { 5: pct(0), 4: pct(1), 3: pct(2), 2: pct(3), 1: pct(4) };
}

/** 豆瓣搜索页把结果放在 window.__DATA__ JSON 中 */
export function parseMovieSearch(html: string): SubjectSummary[] {
  const m = html.match(/window\.__DATA__\s*=\s*(\{[\s\S]*?\});\s*\n/);
  if (m) {
    try {
      const data = JSON.parse(m[1]) as {
        items?: Array<{
          id: number;
          title: string;
          url: string;
          cover_url?: string;
          rating?: { value?: number };
        }>;
      };
      if (Array.isArray(data.items)) {
        return data.items
          .filter(item => item.url?.includes('movie.douban.com/subject/'))
          .map(item => ({
            id: String(item.id),
            title: item.title.replace(/‎/g, '').trim(),
            url: item.url,
            rating: item.rating?.value ?? undefined,
            cover: item.cover_url ?? undefined,
          }));
      }
    } catch {
      // fall through to HTML parsing
    }
  }

  // fallback: HTML-rendered results
  const $ = cheerio.load(html);
  const out: SubjectSummary[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('.search-result .item-root, .search_result .item-root').each((_: number, el: any) => {
    const titleA = $(el).find('a.title-text').first();
    const url = titleA.attr('href') ?? '';
    const match = url.match(/\/subject\/(\d+)/);
    if (!match) return;
    out.push({
      id: match[1],
      title: titleA.text().trim(),
      url,
      rating: parseFloat($(el).find('.rating_nums').first().text()) || undefined,
      cover: $(el).find('img').attr('src') || undefined,
    });
  });
  return out;
}

export function parseTop250(html: string): SubjectSummary[] {
  const $ = cheerio.load(html);
  const out: SubjectSummary[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('ol.grid_view li').each((_: number, el: any) => {
    const item = $(el).find('.item').first();
    const titleA = item.find('.hd a').first();
    const url = titleA.attr('href') ?? '';
    const match = url.match(/\/subject\/(\d+)/);
    if (!match) return;
    out.push({
      id: match[1],
      title: item.find('.title').first().text().trim(),
      url,
      rating: parseFloat(item.find('.rating_num').first().text()) || undefined,
      cover: item.find('img').attr('src') || undefined,
    });
  });
  return out;
}
