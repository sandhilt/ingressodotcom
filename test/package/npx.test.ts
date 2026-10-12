import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const run = promisify(execFile);
const repo = fileURLToPath(new URL('../../', import.meta.url));

test('packed npx launcher runs native TypeScript under node_modules without network', {
  timeout: 30_000,
}, async t => {
  const temp = await mkdtemp(join(tmpdir(), 'ingressodotcom-npx-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  // Regular files and shell pipes avoid Node's socket-backed child stdio in sandboxes.
  const packOutput = join(temp, 'pack.json');
  await run('sh', ['-c', 'output=$1; shift; exec "$@" > "$output"', 'package-test',
    packOutput, 'npm', 'pack', '--json', '--ignore-scripts', '--pack-destination', temp], {
    cwd: repo,
    env: { ...process.env, npm_config_cache: join(temp, 'npm-cache'), npm_config_offline: 'true' },
    timeout: 15_000,
  });
  const stdout = await readFile(packOutput, 'utf8');
  const [pack] = JSON.parse(stdout) as Array<{ filename: string; files: Array<{ path: string }> }>;
  const sources = await readdir(join(repo, 'src'), { recursive: true, withFileTypes: true });
  const expected = ['LICENSE', 'README.md', 'package.json', 'launcher.mjs',
    ...sources.filter(entry => entry.isFile()).map(entry =>
      `src/${join(entry.parentPath, entry.name).slice(join(repo, 'src').length + 1)}`),
  ].sort();
  assert.deepEqual(pack.files.map(file => file.path).sort(), expected);

  const modules = join(temp, 'node_modules');
  const extracted = join(modules, '@sandhilt', 'ingressodotcom-mcp');
  await mkdir(extracted, { recursive: true });
  await run('tar', ['-xzf', join(temp, pack.filename), '--strip-components=1', '-C', extracted]);
  for (const dependency of ['@modelcontextprotocol', 'zod']) {
    await symlink(join(repo, 'node_modules', dependency), join(modules, dependency), 'dir');
  }

  await assert.rejects(run(process.execPath, [join(extracted, 'src/main.ts')], {
    cwd: temp,
    timeout: 5_000,
  }), (error: unknown) => {
    assert.ok(error instanceof Error && 'stderr' in error);
    assert.match(String(error.stderr), /ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/);
    return true;
  });

  const transport = new StdioClientTransport({
    command: 'sh',
    args: ['-c', 'cat | "$1" "$2" | cat', 'package-test', process.execPath, join(extracted, 'launcher.mjs')],
    cwd: temp,
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  const client = new Client({ name: 'package-test', version: '1.0.0' });
  t.after(async () => {
    try {
      await client.close();
    } finally {
      await transport.close();
    }
  });
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 14, stderr);
  for (const tool of tools) assert.equal(tool.annotations?.readOnlyHint, true);
});
