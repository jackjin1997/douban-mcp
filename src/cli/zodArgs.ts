import { Command } from 'commander';
import { z, ZodTypeAny } from 'zod';

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

function unwrap(s: ZodTypeAny): ZodTypeAny {
  if (s instanceof z.ZodOptional) return unwrap((s as any)._def.innerType);
  if (s instanceof z.ZodDefault) return unwrap((s as any)._def.innerType);
  return s;
}

export function applyZodOptions(cmd: Command, schema: z.ZodObject<any>): void {
  const shape = schema.shape;
  for (const key of Object.keys(shape)) {
    const flag = `--${camelToKebab(key)}`;
    const inner = unwrap(shape[key]);
    if (inner instanceof z.ZodBoolean) {
      cmd.option(flag, key);
    } else if (inner instanceof z.ZodNumber) {
      cmd.option(`${flag} <n>`, key);
    } else if (inner instanceof z.ZodArray) {
      cmd.option(`${flag} <csv>`, `${key} (comma-separated)`);
    } else if (inner instanceof z.ZodEnum) {
      const values = (inner as any)._def.values as string[];
      cmd.option(`${flag} <value>`, `${key} (${values.join('|')})`);
    } else {
      cmd.option(`${flag} <value>`, key);
    }
  }
}

export function parseZodOptions<T extends z.ZodObject<any>>(opts: Record<string, unknown>, schema: T): z.infer<T> {
  const shape = schema.shape;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    // commander maps --share-to-feed → opts.shareToFeed (camelCase)
    const raw = opts[key];
    if (raw === undefined) continue;
    const inner = unwrap(shape[key]);
    if (inner instanceof z.ZodBoolean) out[key] = Boolean(raw);
    else if (inner instanceof z.ZodNumber) out[key] = Number(raw);
    else if (inner instanceof z.ZodArray) out[key] = String(raw).split(',').map(s => s.trim()).filter(Boolean);
    else out[key] = raw;
  }
  return schema.parse(out);
}
