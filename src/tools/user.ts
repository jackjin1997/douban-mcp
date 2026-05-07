import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
// FIXME(M3.8): implement user tools
export function registerUserTools(_ds: IDoubanDataSource, _opts: { cookie?: string }): ToolEntry[] { return []; }
