import { IngressoHttpGateway } from '../../src/infrastructure/http/IngressoHttpGateway.ts';
import { loadConfig } from '../../src/infrastructure/config.ts';
import { DEFAULT_PARTNERSHIP } from '../../src/application/usecases/Deps.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/client';
import type { ContentGateway } from '../../src/application/ports/ContentGateway.ts';
import { InvalidInputError, NotFoundError, UpstreamError } from '../../src/domain/errors.ts';
import { deriveAnnotations } from '../../src/interface/mcp/ToolDefinition.ts';
import { createTools } from '../../src/interface/mcp/tools.ts';
import { createServer } from '../../src/interface/mcp/server.ts';
import { FakeContentGateway } from '../support/FakeContentGateway.ts';

async function connect(gateway: FakeContentGateway) {
  const server = createServer({ gateway, config: { partnership: 'configured' } });
  const client = new Client({ name: 'interface-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

function text(result: CallToolResult): string {
  const content = result.content[0];
  assert.equal(content.type, 'text');
  return content.text;
}

test('tools/list exposes all 14 tools, complete derived annotations and described fields', async t => {
  const gateway = new FakeContentGateway();
  const connection = await connect(gateway);
  t.after(() => connection.close());
  const { tools } = await connection.client.listTools();
  const definitions = createTools({ gateway });
  assert.equal(tools.length, 14);
  assert.deepEqual(tools.map(tool => tool.name), [
    'list_states', 'find_city', 'list_movies', 'search_events', 'get_event',
    'get_event_credits', 'list_tags', 'list_theaters', 'get_theater',
    'list_sessions', 'find_showtimes', 'list_session_dates', 'get_session', 'get_passport_promotion',
  ]);
  for (const tool of tools) {
    const definition = definitions.find(candidate => candidate.name === tool.name)!;
    assert.deepEqual(tool.annotations, deriveAnnotations(definition));
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.idempotentHint, true);
    assert.equal(tool.annotations?.openWorldHint, true);
    assert.ok(tool.annotations?.title);
    assert.match(tool.description!, /pt-BR.*Brasil/);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) {
      assert.ok((field as { description: string }).description);
      assert.doesNotMatch((field as { description: string }).description, /Conteúdo em pt-BR\/Brasil/);
    }
    if ('partnership' in definition.inputSchema.shape) {
      assert.ok(!tool.inputSchema.required?.includes('partnership'));
    }
  }
});

test('operation metadata contains exact Swagger GET paths for every reachable route', async () => {
  const swagger = JSON.parse(await readFile(new URL('../../docs/samples/swagger-v0.json', import.meta.url), 'utf8'));
  const operations = createTools({ gateway: new FakeContentGateway() }).flatMap(tool => tool.operations);
  const paths = new Set(operations.map(operation => operation.path));
  const excluded = new Set(['/v0/states/{uf}', '/v0/sessions/url-key/{urlKey}/exists']);
  assert.deepEqual([...paths].sort(), Object.keys(swagger.paths).filter(path => !excluded.has(path)).sort());
  for (const operation of operations) {
    assert.equal(operation.method, 'GET');
    assert.ok(swagger.paths[operation.path].get);
  }
});

test('annotations combine safety of all methods, including future writes and unknown methods', () => {
  const annotations = (methods: string[]) => deriveAnnotations({
    title: 'Safety test',
    operations: methods.map(method => ({ method, path: '/test' })),
  });
  assert.deepEqual(annotations(['GET', 'HEAD']), {
    title: 'Safety test', readOnlyHint: true, destructiveHint: false,
    idempotentHint: true, openWorldHint: true,
  });
  assert.equal(annotations(['GET', 'PUT']).readOnlyHint, false);
  assert.equal(annotations(['GET', 'PUT']).destructiveHint, true);
  assert.equal(annotations(['GET', 'PUT']).idempotentHint, true);
  assert.equal(annotations(['GET', 'POST']).idempotentHint, false);
  assert.equal(annotations(['UNKNOWN']).destructiveHint, true);
  assert.equal(annotations([]).readOnlyHint, false);
  assert.equal(annotations([]).destructiveHint, true);
});

test('pass-through tools round-trip through matching use cases and gateway methods', async t => {
  const gateway = new FakeContentGateway();
  const connection = await connect(gateway);
  t.after(() => connection.close());
  const cases: Array<[string, Record<string, unknown>, keyof ContentGateway, unknown[]]> = [
    ['list_states', {}, 'states', []],
    ['find_city', { id: 'city' }, 'cityById', ['city']],
    ['list_movies', { category: 'nowplaying' }, 'templates', ['nowplaying', 'configured', undefined, { limit: undefined, skip: undefined, theatersIds: undefined, justEvents: undefined }]],
    ['search_events', { cityId: 'city', partnership: 'custom', limit: 3 }, 'eventsByCity', ['city', 'custom', { includeCities: undefined, limit: 3 }]],
    ['get_event', { urlKey: 'movie' }, 'eventByUrlKey', ['movie', 'configured', { includeCities: undefined }]],
    ['get_event_credits', { id: 42, castLimit: 2 }, 'eventCredits', [42, { castLimit: 2, crewLimit: undefined }]],
    ['list_tags', {}, 'tags', []],
    ['list_theaters', { cityId: 'city' }, 'theatersByCity', ['city', 'configured', { includeOperationPolicies: undefined }]],
    ['get_theater', { id: 'theater' }, 'theaterById', ['theater', 'configured', { includeOperationPolicies: undefined }]],
    ['list_sessions', { cityId: 'city', eventId: 'event', date: '2026-10-11' }, 'sessions', [{ cityId: 'city', eventId: 'event', date: '2026-10-11', partnership: 'configured' }]],
    ['list_session_dates', { cityId: 'city', theaterId: 'theater' }, 'sessionDates', [{ cityId: 'city', theaterId: 'theater', partnership: 'configured' }]],
    ['get_session', { id: 'session' }, 'sessionById', ['session', 'configured', { includeOperationPolicies: undefined }]],
    ['get_passport_promotion', {}, 'passportPromotion', []],
  ];
  for (const [name, args, method, expectedArgs] of cases) {
    // A neutral JSON value works for these routes and proves unmodified serialization.
    Object.assign(gateway.results, { [method]: { marker: name } });
    const result = await connection.client.callTool({ name, arguments: args }) as CallToolResult;
    assert.ok(!result.isError, text(result));
    assert.deepEqual(JSON.parse(text(result)), { marker: name });
    assert.deepEqual(gateway.calls.at(-1), { method, args: expectedArgs });
  }
});

test('find_city performs accent-insensitive application search and validation stays in use cases', async t => {
  const gateway = new FakeContentGateway();
  gateway.results.states = [{ uf: 'SP', cities: [{ id: '1', name: 'São Paulo' }] }];
  const connection = await connect(gateway);
  t.after(() => connection.close());
  const city = await connection.client.callTool({ name: 'find_city', arguments: { name: 'sao paulo', uf: 'sp' } }) as CallToolResult;
  assert.deepEqual(JSON.parse(text(city)), [{ id: '1', name: 'São Paulo' }]);
  const invalid = await connection.client.callTool({ name: 'get_event', arguments: { id: '1', urlKey: 'movie' } }) as CallToolResult;
  assert.equal(invalid.isError, true);
  assert.match(text(invalid), /Invalid input: Provide exactly one/);
  assert.equal(gateway.calls.length, 1);
});

test('truncation limits root and nested arrays, reports dropped counts and preserves source data', async t => {
  const gateway = new FakeContentGateway();
  const connection = await connect(gateway);
  t.after(() => connection.close());
  for (const count of [50, 51, 75]) {
    const source = Array.from({ length: count }, (_, id) => ({ id }));
    gateway.results.tags = source;
    const result = await connection.client.callTool({ name: 'list_tags', arguments: {} }) as CallToolResult;
    const parsed = JSON.parse(text(result));
    if (count === 50) {
      assert.deepEqual(parsed, source);
    } else {
      assert.equal(parsed.data.length, 50);
      assert.match(parsed.note, /Output truncated.*Narrow the query/);
      assert.ok(parsed.note.startsWith(`${count - 50} items dropped;`));
    }
    assert.equal(source.length, count);
  }
  gateway.results.tags = { items: Array.from({ length: 55 }, () => ({ cast: Array(52).fill('actor') })) };
  const nested = await connection.client.callTool({ name: 'list_tags', arguments: {} }) as CallToolResult;
  const parsed = JSON.parse(text(nested));
  assert.equal(parsed.data.items.length, 50);
  assert.equal(parsed.data.items[0].cast.length, 50);
  assert.ok(parsed.note.startsWith('105 items dropped;'));
  assert.match(parsed.note, /Output truncated.*Narrow the query/);
});

test('domain errors are mapped and upstream bodies and unknown error details are withheld', async t => {
  const gateway = new FakeContentGateway();
  const connection = await connect(gateway);
  t.after(() => connection.close());
  const cases: Array<[Error, string]> = [
    [new InvalidInputError('bad selector'), 'Invalid input: bad selector'],
    [new NotFoundError('missing city'), 'Not found: missing city'],
    [new UpstreamError(503, 'private upstream body'), 'Upstream request failed (503).'],
    [new Error('private implementation detail'), 'An unexpected error occurred.'],
  ];
  for (const [error, expected] of cases) {
    gateway.error = error;
    const result = await connection.client.callTool({ name: 'list_tags', arguments: {} }) as CallToolResult;
    assert.equal(result.isError, true);
    assert.equal(text(result), expected);
  }
});

test('global output budget shrinks arrays before dropping strings and preserves inputs', async t => {
  const gateway = new FakeContentGateway();
  const connection = await connect(gateway);
  t.after(() => connection.close());
  const cases = [
    { items: Array.from({ length: 50 }, (_, id) => ({ id, title: 'x'.repeat(4_000) })) },
    { items: [{ id: 'keep', synopsis: 'x'.repeat(120_000) }], metadata: 'y'.repeat(120_000) },
    { items: Array.from({ length: 50 }, () => ({ nested: Array(50).fill('x'.repeat(100)) })) },
    'x'.repeat(120_000),
    { ['k'.repeat(110_000)]: 1 },
  ];
  for (const source of cases) {
    const before = JSON.stringify(source);
    gateway.results.tags = source;
    const result = await connection.client.callTool({ name: 'list_tags', arguments: {} }) as CallToolResult;
    assert.ok(!result.isError, text(result));
    assert.ok(text(result).length <= 100_000);
    const parsed = JSON.parse(text(result));
    assert.match(parsed.note, /Output truncated.*Narrow the query/);
    if (source === cases[0]) {
      assert.equal(parsed.data.items.length, 10);
      assert.equal(parsed.data.items[0].title.length, 4_000);
    }
    if (source === cases[1]) {
      assert.equal(parsed.data.items[0].id, 'keep');
      assert.ok(!('synopsis' in parsed.data.items[0]));
    }
    assert.equal(JSON.stringify(source), before);
  }
});

test('204 session results pass through use cases and produce friendly MCP empty results', async t => {
  const gateway = new IngressoHttpGateway(loadConfig({}), {
    fetch: async () => new Response(null, { status: 204 }),
  });
  const server = createServer({ gateway });
  const client = new Client({ name: 'empty-result-test', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  for (const name of ['list_sessions', 'list_session_dates']) {
    const result = await client.callTool({ name, arguments: { cityId: '1', eventId: '2' } }) as CallToolResult;
    assert.ok(!result.isError, text(result));
    const parsed = JSON.parse(text(result));
    assert.deepEqual(parsed.items, []);
    assert.equal(parsed.count, 0);
    assert.match(parsed.note, /Nenhum resultado encontrado/);
  }
});

test('tool and skill guidance accurately describe defaults and selectors', async () => {
  const definitions = createTools({ gateway: new FakeContentGateway() });
  const find = (name: string) => definitions.find(tool => tool.name === name)!;
  for (const tool of definitions) {
    assert.match(tool.inputSchema.shape.partnership.description!, new RegExp(`configurado ou ${DEFAULT_PARTNERSHIP}\\.`));
    assert.match(tool.inputSchema.shape.partnership.description!, /ingresso.*restrito/);
  }
  assert.match(find('find_city').description, /name com uf opcional; nunca por uf sozinho/);
  assert.match(find('list_sessions').description, /groupBySessionType exige cityId e theaterId ou eventId/);
  assert.match(find('list_sessions').description, /YYYY-MM-DD/);
  assert.match(find('list_session_dates').inputSchema.shape.cityId.description!, /obrigatório/);
  assert.equal(find('list_session_dates').inputSchema.shape.cityId.isOptional(), false);
  const skill = await readFile(new URL('../../skills/ingresso/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /Never search by `uf` alone/);
  assert.match(skill, /`groupBySessionType` with `cityId` plus `theaterId` or `eventId`/);
  assert.match(skill, /otherwise `1`.*`ingresso` returns a restricted catalog/);
  assert.match(skill, /YYYY-MM-DD/);
});

test('find_showtimes projects compact summaries, supports details and validates its selectors', async t => {
  const gateway = new FakeContentGateway();
  gateway.results.sessions = [{ date: '2026-10-11', dayOfWeek: 'domingo', movies: [{
    id: '1', title: 'Coração', rooms: [{ name: 'Sala 1', sessions: [{
      id: 's', time: '12:00', type: ['2D'], price: 20, siteURL: 'https://checkout.example',
    }] }],
  }] }];
  const connection = await connect(gateway);
  t.after(() => connection.close());
  const input = { cityId: 'city', theaterUrlKey: 'slug', title: 'coracao' };
  const result = await connection.client.callTool({ name: 'find_showtimes', arguments: input }) as CallToolResult;
  assert.ok(!result.isError, text(result));
  const parsed = JSON.parse(text(result));
  assert.deepEqual(parsed.event, { id: '1', title: 'Coração' });
  assert.equal(parsed.days[0].sessionCount, 1);
  assert.equal('sessions' in parsed.days[0], false);
  assert.deepEqual(gateway.calls.at(-1), { method: 'sessions', args: [{ cityId: 'city', theaterUrlKey: 'slug', partnership: 'configured' }] });
  const details = await connection.client.callTool({ name: 'find_showtimes', arguments: { ...input, includeSessions: true } }) as CallToolResult;
  assert.equal(JSON.parse(text(details)).days[0].sessions[0].checkoutUrl, 'https://checkout.example');
  const before = gateway.calls.length;
  for (const args of [{ ...input, eventId: '1' }, { ...input, theaterId: '2' }, { cityId: 'city', title: 'Movie' }, { ...input, date: '2026-02-30' }]) {
    const invalid = await connection.client.callTool({ name: 'find_showtimes', arguments: args }) as CallToolResult;
    assert.equal(invalid.isError, true);
  }
  assert.equal(gateway.calls.length, before);
});
