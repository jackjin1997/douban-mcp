import { Command } from 'commander';
import { createDataSource } from './datasources/factory.js';
import { buildToolRegistry } from './tools/registry.js';
import { applyZodOptions, parseZodOptions } from './cli/zodArgs.js';
import { renderResult, renderError, exitCodeFor } from './cli/output.js';

export async function runCli(argv: string[]): Promise<void> {
  const cookie = process.env.DOUBAN_COOKIE;
  const enableWrite = process.env.DOUBAN_ENABLE_WRITE === 'true';
  const dataSource = createDataSource({ cookie });
  const registry = buildToolRegistry({ dataSource, cookie, enableWrite });

  const program = new Command();
  program
    .name('douban-mcp')
    .description('Douban MCP server + agent-native CLI')
    .version('1.0.0-alpha.0')
    .option('--json', 'output structured JSON (for agent parsing)');

  // 派生子命令
  for (const tool of registry) {
    const cmd = program.command(tool.cliName).description(tool.description);
    applyZodOptions(cmd, tool.inputSchema);
    cmd.action(async (_inlineArg: unknown, command: Command) => {
      const jsonMode = Boolean(program.opts().json);
      try {
        const args = parseZodOptions(command.opts(), tool.inputSchema);
        const text = await tool.handler(args);
        process.stdout.write(renderResult({ ok: true, text }, jsonMode) + '\n');
      } catch (e) {
        process.stdout.write(renderError(e, jsonMode) + '\n');
        process.exit(exitCodeFor(e));
      }
    });
  }

  // 元命令：list-tools
  program.command('list-tools')
    .description('List all available tool subcommands')
    .action(() => {
      const jsonMode = Boolean(program.opts().json);
      if (jsonMode) {
        process.stdout.write(JSON.stringify(
          registry.map(t => ({ name: t.cliName, description: t.description, readOnly: t.readOnly }))
        ) + '\n');
      } else {
        for (const t of registry) {
          process.stdout.write(`${t.cliName}\t${t.description}\n`);
        }
      }
    });

  // 元命令：describe <name>
  program.command('describe <name>')
    .description('Describe a single tool (its zod schema)')
    .action((name: string) => {
      const t = registry.find(x => x.cliName === name);
      if (!t) {
        process.stderr.write(`unknown tool: ${name}\n`);
        process.exit(2);
      }
      process.stdout.write(JSON.stringify({
        name: t.cliName,
        mcpName: t.mcpName,
        description: t.description,
        readOnly: t.readOnly,
        annotations: t.annotations,
      }, null, 2) + '\n');
    });

  // 元命令：doctor
  program.command('doctor')
    .description('Diagnostics: cookie / data source / write mode')
    .action(async () => {
      const checks: { name: string; ok: boolean; detail?: string }[] = [];
      try {
        const me = cookie ? await dataSource.getCurrentUser() : null;
        checks.push({
          name: 'cookie',
          ok: !cookie || me !== null,
          detail: me?.name ?? (cookie ? 'invalid' : 'absent'),
        });
      } catch (e) {
        checks.push({ name: 'cookie', ok: false, detail: (e as Error).message });
      }
      checks.push({
        name: 'data_source',
        ok: true,
        detail: process.env.DOUBAN_DATA_SOURCE ?? 'html',
      });
      checks.push({
        name: 'write_mode',
        ok: !enableWrite || !!cookie,
        detail: enableWrite ? 'enabled' : 'disabled',
      });
      const allOk = checks.every(c => c.ok);
      process.stdout.write(JSON.stringify({ ok: allOk, checks }, null, 2) + '\n');
      if (!allOk) process.exit(1);
    });

  await program.parseAsync(argv, { from: 'user' });
}
