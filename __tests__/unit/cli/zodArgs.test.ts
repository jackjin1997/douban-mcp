import { z } from 'zod';
import { Command } from 'commander';
import { applyZodOptions, parseZodOptions } from '../../../src/cli/zodArgs.js';

function runWithArgs<T extends z.ZodObject<any>>(schema: T, argv: string[]): z.infer<T> {
  const cmd = new Command();
  applyZodOptions(cmd, schema);
  cmd.exitOverride();
  cmd.parse(['node', 'cmd', ...argv], { from: 'node' });
  return parseZodOptions(cmd.opts(), schema);
}

describe('zodArgs', () => {
  it('parses --q "hello" as string', () => {
    expect(runWithArgs(z.object({ q: z.string() }), ['--q', 'hello']).q).toBe('hello');
  });

  it('coerces --count 5 as number with default', () => {
    const schema = z.object({ count: z.number().int().default(10) });
    expect(runWithArgs(schema, ['--count', '5']).count).toBe(5);
    expect(runWithArgs(schema, []).count).toBe(10);
  });

  it('treats --share-to-feed as boolean flag', () => {
    const schema = z.object({ shareToFeed: z.boolean().default(false) });
    expect(runWithArgs(schema, ['--share-to-feed']).shareToFeed).toBe(true);
    expect(runWithArgs(schema, []).shareToFeed).toBe(false);
  });

  it('parses --tags "a,b,c" as string array', () => {
    expect(runWithArgs(z.object({ tags: z.array(z.string()).optional() }), ['--tags', 'a,b,c']).tags).toEqual(['a', 'b', 'c']);
  });

  it('accepts enum value via plain string', () => {
    const schema = z.object({ kind: z.enum(['top250', 'weekly']) });
    expect(runWithArgs(schema, ['--kind', 'weekly']).kind).toBe('weekly');
  });

  it('zod throws on invalid enum value', () => {
    const schema = z.object({ kind: z.enum(['top250', 'weekly']) });
    expect(() => runWithArgs(schema, ['--kind', 'bogus'])).toThrow();
  });

  it('zod throws on out-of-range number', () => {
    const schema = z.object({ count: z.number().int().min(1).max(20) });
    expect(() => runWithArgs(schema, ['--count', '99'])).toThrow();
  });
});
