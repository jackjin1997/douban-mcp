import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
import { formatSubjectList, formatMovieDetail, formatReviews } from '../formatters/markdown.js';

export function registerMovieTools(ds: IDoubanDataSource): ToolEntry[] {
  return [
    {
      id: 'search_movie',
      cliName: 'search-movie',
      mcpName: 'search_movie',
      description: '按关键词搜索豆瓣电影。返回标题/年份/评分/链接的 markdown 列表。',
      inputSchema: z.object({
        q: z.string().min(1, 'q 不能为空'),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true,
      requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Search Movies' },
      handler: async ({ q, count }: { q: string; count: number }) =>
        formatSubjectList(await ds.searchMovie(q, count)),
    },
    {
      id: 'get_movie',
      cliName: 'get-movie',
      mcpName: 'get_movie',
      description: '获取一部电影的详细信息（导演、演员、评分、简介等）。id 是豆瓣电影 subject id（数字）。',
      inputSchema: z.object({
        id: z.string().regex(/^\d+$/, 'id 必须是数字字符串'),
      }),
      readOnly: true,
      requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Get Movie Detail' },
      handler: async ({ id }: { id: string }) =>
        formatMovieDetail(await ds.getMovie(id)),
    },
    {
      id: 'get_movie_reviews',
      cliName: 'list-movie-reviews',
      mcpName: 'get_movie_reviews',
      description: '获取一部电影的短评列表（不含长评）。',
      inputSchema: z.object({
        id: z.string().regex(/^\d+$/),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true,
      requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'List Movie Reviews' },
      handler: async ({ id, count }: { id: string; count: number }) =>
        formatReviews(await ds.getMovieReviews(id, count)),
    },
    {
      id: 'get_movie_chart',
      cliName: 'movie-chart',
      mcpName: 'get_movie_chart',
      description: '获取电影榜单。kind: top250 (Top250)、weekly (一周口碑榜)、new (近期上映)。',
      inputSchema: z.object({
        kind: z.enum(['top250', 'weekly', 'new']),
        start: z.number().int().min(0).default(0),
        count: z.number().int().min(1).max(25).default(10),
      }),
      readOnly: true,
      requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Movie Chart' },
      handler: async ({ kind, start, count }: { kind: 'top250' | 'weekly' | 'new'; start: number; count: number }) =>
        formatSubjectList(await ds.getMovieChart(kind, start, count)),
    },
  ];
}
