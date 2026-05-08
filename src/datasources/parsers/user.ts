import * as cheerio from 'cheerio';
import type { Collection, CollectionStatus, Doulist, UserProfile } from '../types.js';
import { ParseError } from '../../errors.js';

export function parseUserCollections(
  html: string,
  category: 'movie' | 'book',
  status: CollectionStatus
): Collection[] {
  const $ = cheerio.load(html);
  const out: Collection[] = [];
  const baseUrl = category === 'movie' ? 'https://movie.douban.com' : 'https://book.douban.com';

  // 旧版 .grid-view .item（多年主流）；新版 .subject-list .subject-item 兜底
  const items = $('.grid-view .item, .subject-list .subject-item, .item-show');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items.each((_: any, el: any) => {
    // 标题链接：.title a（旧版 li.title > a），兜底 a[href*="/subject/"]
    const titleLi = $(el).find('li.title');
    const a = titleLi.find('a').first().length
      ? titleLi.find('a').first()
      : $(el).find('a[href*="/subject/"]').first();

    const url = a.attr('href') ?? '';
    const m = url.match(/\/subject\/(\d+)/);
    if (!m) return;

    // 标题优先取 em 内容（去掉 / 后的英文名），否则取 a 全文
    const rawTitle = a.find('em').first().text().trim() || a.text().trim();
    // 去掉 " / 英文名" 后缀，只保留中文名
    const title = rawTitle.split(' / ')[0].trim();

    // rating：span class 如 "rating5-t"
    const ratingClass = $(el).find('[class*="rating"]').attr('class') ?? '';
    const ratingMatch = ratingClass.match(/rating(\d)-t/);

    // tags
    const tagsText = $(el).find('.tags').text();
    const tags = tagsText.replace(/^标签:\s*/, '').split(/\s+/).filter(Boolean);

    out.push({
      subject: {
        id: m[1],
        title,
        url: url.startsWith('http') ? url : `${baseUrl}${url}`,
        cover: $(el).find('img').attr('src') || undefined,
      },
      status,
      rating: ratingMatch ? parseInt(ratingMatch[1], 10) : undefined,
      comment: $(el).find('.comment').text().trim() || undefined,
      tags,
      markedAt: $(el).find('.date').text().trim(),
    });
  });
  return out;
}

export function parseUserProfile(html: string): UserProfile {
  const $ = cheerio.load(html);

  // 优先从内嵌 JS people_info 提取 id 和 name（最可靠）
  let uid = '';
  let name = '';
  const scriptText = $('script').map((_: any, el: any) => $(el).html() ?? '').get().join('\n');
  const peopleInfoMatch = scriptText.match(/people_info\s*=\s*\{[^}]*"id"\s*:\s*"(\d+)"[^}]*"name"\s*:\s*"([^"]+)"/);
  if (peopleInfoMatch) {
    uid = peopleInfoMatch[1];
    name = peopleInfoMatch[2];
  }

  // 兜底：name 从 h1，uid 从 canonical/og:url/链接计数
  if (!name) {
    const nameNode = $('#db-usr-profile .info h1, .user-info .info h1, .info h1, h1').first();
    name = nameNode.text().trim().split('\n')[0].trim();
  }
  if (!uid) {
    const canon = $('link[rel="canonical"]').attr('href') ?? '';
    const og = $('meta[property="og:url"]').attr('content') ?? '';
    for (const c of [canon, og]) {
      const m = c.match(/\/people\/([^\/]+)/);
      if (m) { uid = m[1]; break; }
    }
  }
  if (!uid) {
    // 链接计数兜底
    const counts = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $('a[href*="/people/"]').each((_: any, el: any) => {
      const href = $(el).attr('href') ?? '';
      const m = href.match(/\/people\/([^\/]+)/);
      if (m && m[1] !== 'mine') counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    });
    let max = 0;
    for (const [k, v] of counts) { if (v > max) { max = v; uid = k; } }
  }

  if (!name) throw new ParseError('Cannot parse user profile: name missing');

  return {
    uid,
    name,
    avatar: $('#db-usr-profile .pic img, .basic-info img, .user-info img, .pic img').first().attr('src') ?? '',
    signature: $('.user-info .pl, .signature, .intro').first().text().trim() || undefined,
  };
}

export function parseUserDoulist(html: string): Doulist[] {
  const $ = cheerio.load(html);
  const out: Doulist[] = [];

  // 豆列条目可能出现在多种选择器下
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('.doulist-item, .doulist .item, ul.doulists li, .list-view .item').each((_: any, el: any) => {
    const a = $(el).find('.title a, .bd a, a[href*="/doulist/"]').first();
    const url = a.attr('href') ?? '';
    const m = url.match(/\/doulist\/(\d+)/);
    if (!m) return;
    out.push({
      id: m[1],
      title: a.text().trim(),
      description: $(el).find('.intro').text().trim(),
      itemCount: parseInt($(el).find('.count').text(), 10) || 0,
      url: url.startsWith('http') ? url : `https://www.douban.com${url}`,
    });
  });
  return out;
}
