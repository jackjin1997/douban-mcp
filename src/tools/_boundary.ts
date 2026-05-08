import { AuthError, NotFoundError, RateLimitError, ParseError, WriteDisabledError, NetworkError } from '../errors.js';
import { logger } from '../utils/logger.js';
import type { ToolResult } from './registry.js';

type MCPResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

export function withErrorBoundary<TArgs>(handler: (args: TArgs) => Promise<ToolResult>) {
  return async (args: TArgs): Promise<MCPResult> => {
    try {
      const r = await handler(args);
      return { content: [{ type: 'text', text: r.markdown }] };
    }
    catch (e) {
      const msg = formatError(e);
      return { content: [{ type: 'text', text: msg }], isError: true };
    }
  };
}

export function formatError(e: unknown): string {
  if (e instanceof AuthError) {
    // Frodo 签名问题不是用户能解决的 cookie 失效，给真实消息
    if (e.message.includes('Frodo') || e.message.includes('签名')) return `❌ ${e.message}`;
    return '❌ 豆瓣 cookie 已失效。请更新 DOUBAN_COOKIE 环境变量后重启 MCP 服务。';
  }
  if (e instanceof NotFoundError)     return '❌ 找不到对应资源（id 不存在或已删除）。';
  if (e instanceof RateLimitError) {
    if (e.message.includes('PoW') || e.message.includes('sec.douban.com'))
      return '⚠️ 豆瓣对该页面触发了风控（详情页常见）。请配置 DOUBAN_COOKIE 后重试。';
    return '⚠️ 触发豆瓣访问限流，请等待 1 分钟后重试。';
  }
  if (e instanceof ParseError)        return '❌ 豆瓣页面结构变化导致解析失败。请到 GitHub 提交 issue：https://github.com/jackjin1997/douban-mcp/issues';
  if (e instanceof WriteDisabledError)return '❌ 写操作未启用。请设置环境变量 DOUBAN_ENABLE_WRITE=true 并重启服务。';
  if (e instanceof NetworkError)      return '⚠️ 网络错误，请检查网络后重试。';
  logger.error(e, '未分类错误');
  return `❌ 未知错误：${e instanceof Error ? e.message : String(e)}`;
}

export function errorToCode(e: unknown): string {
  if (e instanceof AuthError) return 'AUTH_FAILED';
  if (e instanceof NotFoundError) return 'NOT_FOUND';
  if (e instanceof RateLimitError) return 'RATE_LIMITED';
  if (e instanceof ParseError) return 'PARSE_FAILED';
  if (e instanceof WriteDisabledError) return 'WRITE_DISABLED';
  if (e instanceof NetworkError) return 'NETWORK_ERROR';
  return 'UNKNOWN';
}
