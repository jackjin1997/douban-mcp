import pino, { DestinationStream } from 'pino';

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
  error(obj: unknown, msg?: string, ...args: unknown[]): void;
}

const REDACT_PATHS = [
  // top-level object passed to logger
  'headers.Cookie',
  'headers.cookie',
  'config.headers.Cookie',
  'config.headers.cookie',
  'request.headers.Cookie',
  'request.headers.cookie',
  'response.config.headers.Cookie',
  'response.config.headers.cookie',
  'cookie',
  'Cookie',
  // when an Error (with extra props) is passed as first arg, pino serializes it under `err`
  'err.headers.Cookie',
  'err.headers.cookie',
  'err.config.headers.Cookie',
  'err.config.headers.cookie',
  'err.request.headers.Cookie',
  'err.request.headers.cookie',
  'err.response.config.headers.Cookie',
  'err.response.config.headers.cookie',
  'err.cookie',
  'err.Cookie',
];

export function createLogger(destination?: DestinationStream): Logger {
  const level = (process.env.DOUBAN_LOG_LEVEL ?? 'info') as pino.LevelWithSilent;
  const dest = destination ?? pino.destination(2);
  return pino(
    {
      level,
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
      },
    },
    dest,
  ) as unknown as Logger;
}

export const logger = createLogger();
