import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../src/infrastructure/config.ts';

test('configuration defaults and explicit environment values', () => {
  assert.deepEqual(loadConfig({}), {
    baseUrl: 'https://api-content.ingresso.com',
    partnership: '1',
    timeoutMs: 15_000,
  });
  assert.deepEqual(loadConfig({
    INGRESSO_BASE_URL: 'http://localhost:8080/',
    INGRESSO_PARTNERSHIP: 'custom',
    INGRESSO_TIMEOUT_MS: '42',
  }), { baseUrl: 'http://localhost:8080', partnership: 'custom', timeoutMs: 42 });
});

test('configuration rejects invalid timeouts and base URLs', () => {
  for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '4294967296']) {
    assert.throws(() => loadConfig({ INGRESSO_TIMEOUT_MS: value }));
  }
  for (const value of ['invalid', 'file:///tmp/api', 'https://example.com/?x=1', 'https://example.com/#x']) {
    assert.throws(() => loadConfig({ INGRESSO_BASE_URL: value }));
  }
});
