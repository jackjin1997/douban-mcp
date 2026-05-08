import type {
  SubjectSummary, MovieDetail, BookDetail, Review,
  Collection, Doulist, UserProfile,
} from '../datasources/types.js';

export function formatSubjectList(items: SubjectSummary[]): string {
  if (items.length === 0) return '未找到结果。';
  return items.map((s, i) => {
    const rating = s.rating ? ` ⭐${s.rating}` : '';
    const year = s.year ? `（${s.year}）` : '';
    return `${i + 1}. **${s.title}**${year}${rating}\n   🔗 ${s.url}`;
  }).join('\n\n');
}

export function formatMovieDetail(m: MovieDetail): string {
  const lines = [
    `# ${m.title}${m.year ? `（${m.year}）` : ''}${m.rating ? ` ⭐${m.rating}` : ''}`,
    m.originalTitle ? `**原名**：${m.originalTitle}` : '',
    `**导演**：${m.directors.map(d => d.name).join(' / ') || '—'}`,
    `**主演**：${m.casts.slice(0, 5).map(c => c.name).join(' / ') || '—'}`,
    `**类型**：${m.genres.join(' / ')}`,
    `**国家/地区**：${m.countries.join(' / ')}`,
    m.releaseDate ? `**上映**：${m.releaseDate}` : '',
    m.duration ? `**片长**：${m.duration}` : '',
    `**评分**：${m.rating ?? '—'}（${m.ratingCount} 人评）`,
    '',
    `## 简介\n${m.summary}`,
    '',
    `🔗 ${m.url}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function formatBookDetail(b: BookDetail): string {
  const lines = [
    `# ${b.title}${b.rating ? ` ⭐${b.rating}` : ''}`,
    `**作者**：${b.authors.join(' / ')}`,
    b.translators?.length ? `**译者**：${b.translators.join(' / ')}` : '',
    b.publisher ? `**出版社**：${b.publisher}` : '',
    b.publishDate ? `**出版年**：${b.publishDate}` : '',
    b.pages ? `**页数**：${b.pages}` : '',
    b.price ? `**定价**：${b.price}` : '',
    b.isbn ? `**ISBN**：${b.isbn}` : '',
    `**评分**：${b.rating ?? '—'}（${b.ratingCount} 人评）`,
    '',
    `## 简介\n${b.summary}`,
    '',
    `🔗 ${b.url}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function formatReviews(reviews: Review[]): string {
  if (reviews.length === 0) return '暂无短评。';
  return reviews.map((r, i) => {
    const star = r.rating ? ` ⭐${r.rating}` : '';
    return `${i + 1}. **${r.author}**${star}（${r.publishedAt}，👍 ${r.usefulCount}）\n   ${r.content}`;
  }).join('\n\n');
}

export function formatCollections(items: Collection[]): string {
  if (items.length === 0) return '该列表为空。';
  return items.map((c, i) => {
    const star = c.rating ? ` ⭐${c.rating}` : '';
    const tags = c.tags.length ? ` #${c.tags.join(' #')}` : '';
    const note = c.comment ? `\n   📝 ${c.comment}` : '';
    return `${i + 1}. **${c.subject.title}**${star}（标记于 ${c.markedAt}）${tags}\n   🔗 ${c.subject.url}${note}`;
  }).join('\n\n');
}

export function formatDoulists(items: Doulist[]): string {
  if (items.length === 0) return '该用户没有公开豆列。';
  return items.map((d, i) =>
    `${i + 1}. **${d.title}**（${d.itemCount} 项）\n   ${d.description}\n   🔗 ${d.url}`
  ).join('\n\n');
}

export function formatProfile(p: UserProfile): string {
  const counts = p.counts
    ? `\n**想看 / 在看 / 看过**：${p.counts.wished} / ${p.counts.doing} / ${p.counts.collected}`
    : '';
  return `# ${p.name} (uid=${p.uid})${counts}\n\n${p.signature ?? ''}`.trim();
}

export function formatMarkResult(action: 'mark' | 'unmark', category: 'movie' | 'book', id: string): string {
  const verb = action === 'mark' ? '已标记' : '已取消标记';
  const cat = category === 'movie' ? '电影' : '图书';
  return `✅ ${verb}${cat} (id=${id})`;
}
