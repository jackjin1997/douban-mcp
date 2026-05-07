import pino from 'pino';

const COOKIE_KEYS = ['bid', 'dbcl2', 'ck'];

export function redactCookie(input: string): string {
  let out = input;
  for (const key of COOKIE_KEYS) {
    out = out.replace(new RegExp(`(${key})=("?)[^;"]*("?)`, 'g'), '$1=$2***$3');
  }
  return out;
}

export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

export function createLogger(): Logger {
  const level = (process.env.DOUBAN_LOG_LEVEL ?? 'info') as pino.LevelWithSilent;
  return pino({ level, transport: { target: 'pino/file', options: { destination: 2 } } }) as unknown as Logger;
}

export const logger = createLogger();
