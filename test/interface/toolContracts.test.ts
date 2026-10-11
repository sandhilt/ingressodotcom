import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTools } from '../../src/interface/mcp/tools.ts';
import { IngressoHttpGateway } from '../../src/infrastructure/http/IngressoHttpGateway.ts';
import { loadConfig } from '../../src/infrastructure/config.ts';
import { FakeContentGateway } from '../support/FakeContentGateway.ts';
import { rioCatalog } from '../support/eventCatalog.ts';

const inputs: Record<string, Record<string, unknown>[]> = {
  list_states: [{}],
  find_city: [{ id: '1' }, { urlKey: 'city' }, { theaterSlug: 'theater' }, { lat: 1, long: 2 }, { name: 'City' }],
  list_movies: [
    { category: 'nowplaying' }, { category: 'nowplaying', cityId: '1' },
    ...['soon', 'highlights', 'premiere'].map(category => ({ category, cityId: '1' })),
  ],
  search_events: [{}, { tagName: 'tag' }, { tagUrlKey: 'tag' }, { cityId: '1' }, { comingSoon: true }],
  get_event: [{ id: '1' }, { urlKey: 'movie' }],
  get_event_credits: [{ id: 1 }],
  list_tags: [{}],
  list_theaters: [{}, { cityId: '1' }],
  get_theater: [{ id: '1' }, { urlKey: 'theater' }],
  list_sessions: [
    { eventId: '1' },
    { cityId: '1', theaterId: '2' }, { cityId: '1', theaterUrlKey: 'theater' },
    { cityId: '1', eventId: '2' }, { cityId: '1', eventUrlKey: 'movie' },
    { cityId: '1', theaterId: '2', groupBySessionType: true },
    { cityId: '1', eventId: '2', groupBySessionType: true },
  ],
  find_showtimes: [{ cityId: '1', theaterId: '2', eventId: '3' }, { cityId: '1', theaterUrlKey: 'theater', title: 'Movie' }],
  list_session_dates: [{ cityId: '1', theaterId: '2' }, { cityId: '1', eventId: '2' }],
  get_session: [{ id: '1' }],
  get_passport_promotion: [{}],
};

function matches(template: string, path: string): boolean {
  const expected = template.split('/');
  const actual = path.split('/');
  return expected.length === actual.length && expected.every((segment, index) =>
    /^\{[^}]+\}$/.test(segment) ? actual[index].length > 0 : segment === actual[index]);
}

test('every tool accepts partnership and actual GET requests match its declared operations', async () => {
  const names = createTools({ gateway: new FakeContentGateway() }).map(tool => tool.name);
  assert.deepEqual(Object.keys(inputs).sort(), names.sort());
  for (const name of names) {
    const covered = new Set<string>();
    for (const input of inputs[name]) {
      const calls: Array<{ url: URL; method: string | undefined }> = [];
      const gateway = new IngressoHttpGateway(loadConfig({ INGRESSO_PARTNERSHIP: 'configured' }), {
        fetch: async (url, init) => {
          const parsed = new URL(String(url));
          calls.push({ url: parsed, method: init?.method });
          if (parsed.pathname.includes('/templates/nowplaying/')) {
            const skip = Number(parsed.searchParams.get('skip'));
            const limit = Number(parsed.searchParams.get('limit'));
            return Response.json(rioCatalog().slice(skip, skip + limit));
          }
          if (parsed.pathname === '/v0/states') {
            return Response.json([{ uf: 'SP', cities: [{ id: '1', name: 'City' }] }]);
          }
          return Response.json({ items: [] });
        },
      });
      const tool = createTools({ gateway }).find(tool => tool.name === name)!;
      const args = { ...input, partnership: 'explicit' };
      assert.equal(tool.inputSchema.parse(args).partnership, 'explicit', name);
      await tool.handler(args);
      assert.ok(calls.length > 0, name);
      for (const call of calls) {
        assert.equal(call.method, 'GET', name);
        const operation = tool.operations.find(operation => operation.path === call.url.pathname)
          ?? tool.operations.find(operation => matches(operation.path, call.url.pathname));
        assert.ok(operation, `${name}: ${call.url.pathname}`);
        covered.add(operation.path);
        if (operation.path.includes('{partnership}')) {
          assert.ok(call.url.pathname.includes('/partnership/explicit'), name);
        }
      }
      if (name === 'list_movies' && input.category === 'nowplaying') {
        assert.equal(calls.length, 2);
        assert.deepEqual(calls.map(call => call.url.searchParams.get('skip')), ['0', '100']);
      }
    }
    const tool = createTools({ gateway: new FakeContentGateway() }).find(tool => tool.name === name)!;
    assert.deepEqual([...covered].sort(), tool.operations.map(operation => operation.path).sort(), name);
  }
});

test('README and design document every registered tool and the correct tool count', async () => {
  const tools = createTools({ gateway: new FakeContentGateway() });
  for (const path of ['README.md', 'docs/design.md']) {
    const document = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
    for (const tool of tools) {
      assert.ok(document.includes(`\`${tool.name}\``), `${path}: ${tool.name}`);
    }
    const counts = [
      ...document.matchAll(/Ferramentas MCP\s*\((\d+)\)/gi),
      ...document.matchAll(/\b(\d+)\s+(?:ferramentas|tools)\b/gi),
    ];
    for (const count of counts) {
      assert.equal(Number(count[1]), tools.length, path);
    }
  }
});
