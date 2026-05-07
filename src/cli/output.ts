import { AuthError, NotFoundError, RateLimitError, WriteDisabledError, ParseError, NetworkError } from '../errors.js';
import { formatError, errorToCode } from '../tools/_boundary.js';
import type { ToolResult } from '../tools/registry.js';

export function renderResult(r: ToolResult, jsonMode: boolean): string {
  if (jsonMode) return JSON.stringify(r.data);
  return r.markdown;
}

export function renderError(e: unknown, jsonMode: boolean): string {
  if (jsonMode) {
    return JSON.stringify({
      error: { code: errorToCode(e), message: e instanceof Error ? e.message : String(e) },
    });
  }
  return formatError(e);
}

export function exitCodeFor(e: unknown): number {
  if (e instanceof AuthError || e instanceof WriteDisabledError) return 1;
  if (e instanceof NotFoundError) return 2;
  if (e instanceof RateLimitError) return 3;
  if (e instanceof ParseError || e instanceof NetworkError) return 4;
  return 4;
}
