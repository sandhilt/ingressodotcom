import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readJson(path: string): Promise<{ version: string; packages?: Record<string, { version: string }> }> {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('package.json, package-lock.json and plugin.json share one version', async () => {
  const pkg = await readJson('package.json');
  const lock = await readJson('package-lock.json');
  const plugin = await readJson('.claude-plugin/plugin.json');

  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages?.['']?.version, pkg.version);
  assert.equal(plugin.version, pkg.version);
});
