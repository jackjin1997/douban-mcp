import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
// FIXME(M3.7): implement book tools
export function registerBookTools(_ds: IDoubanDataSource): ToolEntry[] { return []; }
