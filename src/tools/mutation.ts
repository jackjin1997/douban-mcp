import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
// FIXME(M4.3): implement mutation tools
export function registerMutationTools(_ds: IDoubanDataSource): ToolEntry[] { return []; }
