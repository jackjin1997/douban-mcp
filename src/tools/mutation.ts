import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
import { formatMarkResult } from '../formatters/markdown.js';

const markSchema = z.object({
  id: z.string().regex(/^\d+$/),
  status: z.enum(['wish', 'do', 'collect']),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(140).optional(),
  tags: z.array(z.string()).max(10).optional(),
  shareToFeed: z.boolean().default(false),
});
const unmarkSchema = z.object({ id: z.string().regex(/^\d+$/) });

type MarkArgs = z.infer<typeof markSchema>;

function makeMark(ds: IDoubanDataSource, category: 'movie' | 'book'): ToolEntry {
  return {
    id: `mark_${category}`,
    cliName: `mark-${category}`,
    mcpName: `mark_${category}`,
    description: `标记一${category === 'movie' ? '部电影' : '本书'}（想看/在看/看过），可选打分、备注、标签。需要 cookie + DOUBAN_ENABLE_WRITE。shareToFeed 默认 false（不广播）。`,
    inputSchema: markSchema,
    readOnly: false,
    requiresAuth: true,
    annotations: { destructiveHint: true, title: `Mark ${category}` },
    handler: async (args: MarkArgs) => {
      await ds.markSubject(category, args.id, args.status, {
        rating: args.rating as 1 | 2 | 3 | 4 | 5 | undefined,
        comment: args.comment,
        tags: args.tags,
        shareToFeed: args.shareToFeed,
      });
      return {
        markdown: formatMarkResult('mark', category, args.id),
        data: { ok: true, action: 'mark', category, id: args.id, status: args.status },
      };
    },
  };
}

function makeUnmark(ds: IDoubanDataSource, category: 'movie' | 'book'): ToolEntry {
  return {
    id: `unmark_${category}`,
    cliName: `unmark-${category}`,
    mcpName: `unmark_${category}`,
    description: `取消对一${category === 'movie' ? '部电影' : '本书'}的标记。`,
    inputSchema: unmarkSchema,
    readOnly: false,
    requiresAuth: true,
    annotations: { destructiveHint: true, title: `Unmark ${category}` },
    handler: async (args: { id: string }) => {
      await ds.unmarkSubject(category, args.id);
      return {
        markdown: formatMarkResult('unmark', category, args.id),
        data: { ok: true, action: 'unmark', category, id: args.id },
      };
    },
  };
}

export function registerMutationTools(ds: IDoubanDataSource): ToolEntry[] {
  return [makeMark(ds, 'movie'), makeUnmark(ds, 'movie'), makeMark(ds, 'book'), makeUnmark(ds, 'book')];
}
