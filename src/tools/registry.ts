import type { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import { registerMetaTools } from './meta.js';
import { registerMovieTools } from './movie.js';
import { registerBookTools } from './book.js';
import { registerUserTools } from './user.js';
import { registerMutationTools } from './mutation.js';

export interface ToolEntry {
  id: string;
  cliName: string;
  mcpName: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  readOnly: boolean;
  requiresAuth: boolean;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; title?: string };
  handler: (args: any) => Promise<string>;
}

export interface RegistryOpts {
  dataSource: IDoubanDataSource;
  cookie: string | undefined;
  enableWrite: boolean;
}

export function buildToolRegistry(opts: RegistryOpts): ToolEntry[] {
  const entries: ToolEntry[] = [];
  if (opts.cookie) entries.push(...registerMetaTools(opts.dataSource));
  entries.push(...registerMovieTools(opts.dataSource));
  entries.push(...registerBookTools(opts.dataSource));
  entries.push(...registerUserTools(opts.dataSource, { cookie: opts.cookie }));
  if (opts.enableWrite) entries.push(...registerMutationTools(opts.dataSource));
  return entries;
}
