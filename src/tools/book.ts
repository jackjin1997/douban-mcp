import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
import { formatSubjectList, formatBookDetail, formatReviews } from '../formatters/markdown.js';

export function registerBookTools(ds: IDoubanDataSource): ToolEntry[] {
  return [
    {
      id: 'search_book', cliName: 'search-book', mcpName: 'search_book',
      description: '按关键词搜索豆瓣图书。',
      inputSchema: z.object({
        q: z.string().min(1, 'q 不能为空'),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Search Books' },
      handler: async ({ q, count }: { q: string; count: number }) => {
        const data = await ds.searchBook(q, count);
        return { markdown: formatSubjectList(data), data };
      },
    },
    {
      id: 'get_book', cliName: 'get-book', mcpName: 'get_book',
      description: '获取图书详情（作者、出版、ISBN、简介等）。id 是豆瓣图书 subject id（数字）。',
      inputSchema: z.object({ id: z.string().regex(/^\d+$/, 'id 必须是数字字符串') }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Get Book Detail' },
      handler: async ({ id }: { id: string }) => {
        const data = await ds.getBook(id);
        return { markdown: formatBookDetail(data), data };
      },
    },
    {
      id: 'get_book_reviews', cliName: 'list-book-reviews', mcpName: 'get_book_reviews',
      description: '获取图书的短评列表。',
      inputSchema: z.object({
        id: z.string().regex(/^\d+$/),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'List Book Reviews' },
      handler: async ({ id, count }: { id: string; count: number }) => {
        const data = await ds.getBookReviews(id, count);
        return { markdown: formatReviews(data), data };
      },
    },
    {
      id: 'get_book_chart', cliName: 'book-chart', mcpName: 'get_book_chart',
      description: '获取图书榜单。kind: fiction (小说)、non_fiction (随笔)、new (新书速递)。',
      inputSchema: z.object({
        kind: z.enum(['fiction', 'non_fiction', 'new']),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Book Chart' },
      handler: async ({ kind, count }: { kind: 'fiction' | 'non_fiction' | 'new'; count: number }) => {
        const data = await ds.getBookChart(kind, count);
        return { markdown: formatSubjectList(data), data };
      },
    },
  ];
}
