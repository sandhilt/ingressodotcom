import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('stdio initializes, lists safe tools and calls list_states against a local HTTP stub', {
  timeout: 15_000,
}, async t => {
  const states = [{ uf: 'SP', name: 'São Paulo', cities: [] }];
  const requests: Array<{ method: string | undefined; url: string | undefined }> = [];
  const stub = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'GET' && request.url === '/v0/states') {
      response.end(JSON.stringify(states));
    } else {
      response.writeHead(404);
      response.end('{}');
    }
  });
  t.after(() => new Promise<void>((resolve, reject) => {
    stub.close(error => error ? reject(error) : resolve());
    stub.closeAllConnections();
  }));
  stub.listen(0, '127.0.0.1');
  await once(stub, 'listening');
  const address = stub.address();
  assert.ok(address && typeof address !== 'string');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['src/main.ts'],
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { INGRESSO_BASE_URL: `http://127.0.0.1:${address.port}` },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });
  t.after(async () => {
    await client.close();
    await transport.close();
  });

  // connect performs the initialize exchange before returning.
  await client.connect(transport);
  assert.equal(client.getServerVersion()?.name, 'ingressodotcom');
  const { tools } = await client.listTools();
  assert.equal(tools.length, 14);
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
  }
  const result = await client.callTool({ name: 'list_states', arguments: {} });
  assert.ok(!result.isError, stderr);
  const content = result.content[0];
  assert.equal(content.type, 'text');
  assert.deepEqual(JSON.parse(content.text), states);
  assert.deepEqual(requests, [{ method: 'GET', url: '/v0/states' }]);
  assert.equal(stderr, '');
});
