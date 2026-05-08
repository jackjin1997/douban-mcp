import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';

export function registerMetaTools(ds: IDoubanDataSource): ToolEntry[] {
  return [{
    id: 'check_cookie',
    cliName: 'check',
    mcpName: 'check_cookie',
    description: '验证 DOUBAN_COOKIE 是否仍然有效',
    inputSchema: z.object({}),
    readOnly: true,
    requiresAuth: true,
    annotations: { readOnlyHint: true, title: 'Check Cookie' },
    handler: async () => {
      const me = await ds.getCurrentUser();
      const markdown = me ? `✅ cookie 有效（用户：${me.name}, uid=${me.uid}）` : '❌ cookie 已失效';
      return { markdown, data: { valid: !!me, user: me } };
    },
  }];
}
