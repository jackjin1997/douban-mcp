import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
// FIXME(M3.6): implement movie tools
export function registerMovieTools(_ds: IDoubanDataSource): ToolEntry[] { return []; }
