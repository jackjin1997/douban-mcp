import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
import { formatCollections, formatDoulists, formatProfile } from '../formatters/markdown.js';

export function registerUserTools(ds: IDoubanDataSource, opts: { cookie?: string }): ToolEntry[] {
  // uid optional when cookie is present (datasource resolves to own uid);
  // required otherwise.
  const uidSchema = opts.cookie
    ? z.string().optional()
    : z.string({ required_error: '未配置 cookie 时必须传入 uid' });

  return [
    {
      id: 'get_user_collections',
      cliName: 'user-collections',
      mcpName: 'get_user_collections',
      description: '获取某用户的"想看/在看/看过"列表。无 cookie 时必须传 uid。',
      inputSchema: z.object({
        uid: uidSchema,
        category: z.enum(['movie', 'book']),
        status: z.enum(['wish', 'do', 'collect']),
        start: z.number().int().min(0).default(0),
        count: z.number().int().min(1).max(30).default(15),
      }),
      readOnly: true,
      requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'User Collections' },
      handler: async (args: {
        uid?: string;
        category: 'movie' | 'book';
        status: 'wish' | 'do' | 'collect';
        start: number;
        count: number;
      }) =>
        formatCollections(
          await ds.getUserCollections(args.uid ?? null, args.category, args.status, args.start, args.count),
        ),
    },
    {
      id: 'get_user_doulist',
      cliName: 'user-doulist',
      mcpName: 'get_user_doulist',
      description: '获取某用户的豆列清单。无 cookie 时必须传 uid。',
      inputSchema: z.object({ uid: uidSchema }),
      readOnly: true,
      requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'User Doulists' },
      handler: async (args: { uid?: string }) =>
        formatDoulists(await ds.getUserDoulist(args.uid ?? null)),
    },
    {
      id: 'get_user_profile',
      cliName: 'user-profile',
      mcpName: 'get_user_profile',
      description: '获取某用户的基本信息。无 cookie 时必须传 uid。',
      inputSchema: z.object({ uid: uidSchema }),
      readOnly: true,
      requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'User Profile' },
      handler: async (args: { uid?: string }) =>
        formatProfile(await ds.getUserProfile(args.uid ?? null)),
    },
  ];
}
