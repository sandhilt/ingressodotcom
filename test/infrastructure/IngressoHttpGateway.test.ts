import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IngressoHttpGateway } from '../../src/infrastructure/http/IngressoHttpGateway.ts';
import { loadConfig } from '../../src/infrastructure/config.ts';
import { InvalidInputError, NotFoundError, UpstreamError } from '../../src/domain/errors.ts';

function fixture(options: { clock?: () => number; fetch?: typeof fetch; timeoutMs?: number } = {}) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const stub: typeof fetch = async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    return Response.json({ arbitrary: ['preserved'] });
  };
  const gateway = new IngressoHttpGateway({
    ...loadConfig({}),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  }, { fetch: options.fetch ?? stub, clock: options.clock });
  return { gateway, calls };
}

test('all 36 Swagger routes and their supported query parameters', async () => {
  const { gateway: g, calls } = fixture();
  const event = { includeCities: false };
  const policy = { includeOperationPolicies: false };
  const limited = { includeCities: true, limit: 0 };
  const cases: Array<[() => Promise<unknown>, string, Record<string, string>?]> = [
    [() => g.states(), '/v0/states'],
    [() => g.stateByUf('SP'), '/v0/states/SP'],
    [() => g.cityById('1'), '/v0/states/city/1'],
    [() => g.cityByUrlKey('key'), '/v0/states/city/name/key'],
    [() => g.cityByTheaterSlug('slug'), '/v0/states/city/theater/slug'],
    [() => g.citiesNear(-23, -46, { radiusInKilometers: 10, resultCount: 0 }), '/v0/states/city/latlong',
      { lat: '-23', lng: '-46', radiusInKilometers: '10', resultCount: '0' }],
    [() => g.events('p', event), '/v0/events/partnership/p', { includeCities: 'false' }],
    [() => g.eventsByTag({ tagName: 'tag' }, 'p', event), '/v0/events/tagName/tag/partnership/p', { includeCities: 'false' }],
    [() => g.eventsByTag({ tagUrlKey: 'tag' }, 'p', event), '/v0/events/tagUrlKey/tag/partnership/p', { includeCities: 'false' }],
    [() => g.eventById('1', 'p', event), '/v0/events/1/partnership/p', { includeCities: 'false' }],
    [() => g.eventByUrlKey('key', 'p', event), '/v0/events/url-key/key/partnership/p', { includeCities: 'false' }],
    [() => g.eventCredits(1, { castLimit: 0, crewLimit: 2 }), '/v0/events/1/credits', { castLimit: '0', crewLimit: '2' }],
    [() => g.eventsComingSoon('p', limited), '/v0/events/coming-soon/partnership/p', { includeCities: 'true', limit: '0' }],
    [() => g.eventsByCity('1', 'p', limited), '/v0/events/city/1/partnership/p', { includeCities: 'true', limit: '0' }],
    [() => g.tags(), '/v0/tags/getAllTags'],
    [() => g.passportPromotion(), '/v0/passport-promotion'],
    [() => g.templates('nowplaying', 'p', undefined, { limit: 0, skip: 2 }), '/v0/templates/nowplaying/partnership/p', { limit: '0', skip: '2' }],
    [() => g.templates('nowplaying', 'p', '1', { limit: 0, skip: 2 }), '/v0/templates/nowplaying/1/partnership/p', { limit: '0', skip: '2' }],
    [() => g.templates('soon', 'p', '1', { limit: 3 }), '/v0/templates/soon/1/partnership/p', { limit: '3' }],
    [() => g.templates('highlights', 'p', '1', { limit: 3, theatersIds: '1,2', justEvents: false }),
      '/v0/templates/highlights/1/partnership/p', { limit: '3', theatersIds: '1,2', justEvents: 'false' }],
    [() => g.templates('premiere', 'p', '1'), '/v0/templates/premiere/1/partnership/p'],
    [() => g.theaters('p', policy), '/v0/theaters/partnership/p', { includeOperationPolicies: 'false' }],
    [() => g.theaterById('1', 'p', policy), '/v0/theaters/1/partnership/p', { includeOperationPolicies: 'false' }],
    [() => g.theaterByUrlKey('key', 'p', policy), '/v0/theaters/url-key/key/partnership/p', { includeOperationPolicies: 'false' }],
    [() => g.theatersByCity('1', 'p', policy), '/v0/theaters/city/1/partnership/p', { includeOperationPolicies: 'false' }],
    [() => g.sessionById('1', 'p', policy), '/v0/sessions/1/partnership/p', { includeOperationPolicies: 'false' }],
    [() => g.sessions({ cityId: '1', theaterId: '2', partnership: 'p', date: '2026-10-11' }),
      '/v0/sessions/city/1/theater/2/partnership/p', { date: '2026-10-11' }],
    [() => g.sessions({ cityId: '1', theaterId: '2', partnership: 'p', groupBySessionType: true, date: '2026-10-11' }),
      '/v0/sessions/city/1/theater/2/partnership/p/groupBy/sessionType', { date: '2026-10-11' }],
    [() => g.sessions({ cityId: '1', theaterUrlKey: 'key', partnership: 'p', date: '2026-10-11' }),
      '/v0/sessions/city/1/theater/url-key/key/partnership/p', { date: '2026-10-11' }],
    [() => g.sessions({ cityId: '1', eventId: '2', partnership: 'p', date: '2026-10-11', ...policy }),
      '/v0/sessions/city/1/event/2/partnership/p', { date: '2026-10-11', includeOperationPolicies: 'false' }],
    [() => g.sessions({ cityId: '1', eventId: '2', partnership: 'p', groupBySessionType: true, date: '2026-10-11', ...policy }),
      '/v0/sessions/city/1/event/2/partnership/p/groupBy/sessionType', { date: '2026-10-11', includeOperationPolicies: 'false' }],
    [() => g.sessions({ eventId: '2', partnership: 'p' }), '/v0/sessions/event/2/partnership/p'],
    [() => g.sessions({ cityId: '1', eventUrlKey: 'key', partnership: 'p', date: '2026-10-11',
      sessionTypeList: 'IMAX,3D', legendList: 'dub,sub', ...policy }),
      '/v0/sessions/city/1/event/url-key/key/partnership/p',
      { date: '2026-10-11', sessionTypeList: 'IMAX,3D', legendList: 'dub,sub', includeOperationPolicies: 'false' }],
    [() => g.sessionDates({ cityId: '1', theaterId: '2', partnership: 'p' }), '/v0/sessions/city/1/theater/2/dates/partnership/p'],
    [() => g.sessionDates({ cityId: '1', eventId: '2', partnership: 'p' }), '/v0/sessions/city/1/event/2/dates/partnership/p'],
    [() => g.sessionExistsByUrlKey('key'), '/v0/sessions/url-key/key/exists'],
  ];
  const swagger = JSON.parse(readFileSync(new URL('../../docs/samples/swagger-v0.json', import.meta.url), 'utf8'));
  const covered = new Set<string>();
  for (const [invoke, path, query = {}] of cases) {
    assert.deepEqual(await invoke(), { arbitrary: ['preserved'] });
    const call = calls.at(-1)!;
    assert.equal(call.url.origin, 'https://api-content.ingresso.com');
    assert.equal(call.url.pathname, path);
    assert.deepEqual(Object.fromEntries(call.url.searchParams), query);
    const schemaPath = Object.keys(swagger.paths).sort((a, b) =>
      (a.match(/\{/g)?.length ?? 0) - (b.match(/\{/g)?.length ?? 0),
    ).find(template => {
      const pattern = '^' + template.replace(/\{[^}]+\}/g, '[^/]+') + '$';
      return new RegExp(pattern).test(path);
    })!;
    assert.ok(schemaPath, path);
    covered.add(schemaPath);
    const allowed = swagger.paths[schemaPath].get.parameters ?? [];
    for (const key of Object.keys(query)) {
      assert.ok(allowed.some((p: { in: string; name: string }) => p.in === 'query' && p.name === key), key);
    }
    assert.equal(call.init?.method, 'GET');
    assert.deepEqual(call.init?.headers, { Accept: 'application/json', 'User-Agent': 'ingressodotcom-mcp' });
    assert.ok(call.init?.signal instanceof AbortSignal);
  }
  assert.equal(covered.size, 36);
});

test('dynamic path segments and query values are encoded without becoming URL structure', async () => {
  const { gateway, calls } = fixture();
  const value = 'São /?#%&+';
  await gateway.sessions({
    cityId: value, eventUrlKey: value, partnership: value,
    sessionTypeList: value, legendList: value,
  });
  const url = calls[0].url;
  const encoded = encodeURIComponent(value);
  assert.equal(url.pathname, '/v0/sessions/city/' + encoded + '/event/url-key/' + encoded + '/partnership/' + encoded);
  assert.equal(url.searchParams.get('sessionTypeList'), value);
  assert.equal(url.searchParams.get('legendList'), value);
  assert.equal(url.hash, '');
  await gateway.eventsByTag({ tagName: value }, value);
  assert.equal(calls[1].url.pathname, '/v0/events/tagName/' + encoded + '/partnership/' + encoded);
});

test('404 maps to NotFoundError and other HTTP errors retain status with bounded excerpts', async () => {
  for (const status of [404, 500, 429]) {
    const { gateway } = fixture({ fetch: async () => new Response('x'.repeat(2_000), { status }) });
    await assert.rejects(gateway.passportPromotion(), error => {
      if (status === 404) {
        assert.ok(error instanceof NotFoundError);
      } else {
        assert.ok(error instanceof UpstreamError);
        assert.equal(error.status, status);
        assert.equal(error.bodyExcerpt, 'x'.repeat(500));
      }
      return true;
    });
  }
});

test('network and malformed JSON failures map to UpstreamError', async () => {
  for (const stub of [
    async () => { throw new TypeError('network unavailable'); },
    async () => new Response('invalid JSON'),
  ]) {
    const { gateway } = fixture({ fetch: stub });
    await assert.rejects(gateway.states(), error => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.status, 0);
      assert.ok(error.bodyExcerpt.length > 0);
      return true;
    });
  }
});

test('AbortSignal.timeout aborts a pending fetch and maps to UpstreamError', async () => {
  const stub: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
  });
  // Native timeout signals are unref'ed; keep the event loop alive while the stub waits.
  const keepAlive = setTimeout(() => undefined, 1_000);
  try {
    const { gateway } = fixture({ fetch: stub, timeoutMs: 5 });
    await assert.rejects(gateway.states(), error => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.status, 0);
      assert.match(error.bodyExcerpt, /timeout/i);
      return true;
    });
  } finally {
    clearTimeout(keepAlive);
  }
});

test('only states and tags cache successful responses for exactly 60 seconds', async () => {
  let now = 1_000;
  const { gateway, calls } = fixture({ clock: () => now });
  for (const invoke of [() => gateway.states(), () => gateway.tags()]) {
    const before = calls.length;
    const first = await invoke();
    now += 59_999;
    assert.strictEqual(await invoke(), first);
    assert.equal(calls.length, before + 1);
    now += 1;
    await invoke();
    assert.equal(calls.length, before + 2);
  }
  await gateway.cityById('1');
  await gateway.cityById('1');
  await gateway.events('p');
  await gateway.events('p');
  assert.equal(calls.length, 8);
});

test('failed cacheable requests are retried and caches are isolated per gateway', async () => {
  let count = 0;
  const stub: typeof fetch = async () => {
    count += 1;
    return count === 1 ? new Response('failed', { status: 500 }) : Response.json([]);
  };
  const first = fixture({ fetch: stub }).gateway;
  await assert.rejects(first.states(), UpstreamError);
  await first.states();
  await first.states();
  const second = fixture({ fetch: stub }).gateway;
  await second.states();
  assert.equal(count, 3);
});

test('204 skips JSON parsing and returns empty collections consistently', async () => {
  const { gateway } = fixture({ fetch: async () => {
    const response = new Response(null, { status: 204 });
    response.json = async () => { throw new Error('Must not parse a 204'); };
    return response;
  } });
  const empty = { items: [], count: 0 };
  assert.deepEqual(await gateway.sessions({ cityId: '1', eventId: '2', partnership: '1' }), empty);
  assert.deepEqual(await gateway.sessionDates({ cityId: '1', eventId: '2', partnership: '1' }), empty);
  assert.deepEqual(await gateway.events('1'), empty);
  assert.deepEqual(await gateway.theaters('1'), empty);
  assert.deepEqual(await gateway.templates('nowplaying', '1'), empty);
  assert.deepEqual(await gateway.states(), []);
  assert.deepEqual(await gateway.citiesNear(0, 0), []);
});

test('successful bodies are capped by bytes and overflow cancels the reader', async () => {
  let cancelled = false;
  let reads = 0;
  const { gateway } = fixture({ fetch: async () => new Response(new ReadableStream({
    pull(controller) {
      reads += 1;
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
    cancel() { cancelled = true; },
  })) });
  await assert.rejects(gateway.tags(), error => {
    assert.ok(error instanceof UpstreamError);
    assert.equal(error.status, 200);
    assert.match(error.bodyExcerpt, /exceeds 5 MB/);
    return true;
  });
  assert.equal(cancelled, true);
  assert.ok(reads <= 7);
});

test('bounded JSON reading preserves multibyte text across stream chunks', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ title: 'São 🎬' }));
  const { gateway } = fixture({ fetch: async () => new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) {
        controller.enqueue(Uint8Array.of(byte));
      }
      controller.close();
    },
  })) });
  assert.deepEqual(await gateway.tags(), { title: 'São 🎬' });
});

test('dot path segments are rejected before fetch for every dynamic selector', async () => {
  const { gateway, calls } = fixture();
  for (const segment of ['.', '..']) {
    for (const invoke of [
      () => gateway.cityById(segment),
      () => gateway.eventByUrlKey(segment, '1'),
      () => gateway.events(segment),
      () => gateway.sessions({ cityId: '1', theaterId: segment, partnership: '1' }),
      () => gateway.sessionDates({ cityId: segment, eventId: '2', partnership: '1' }),
      () => gateway.eventCredits({ toString: () => segment } as unknown as number),
    ]) {
      await assert.rejects(invoke(), InvalidInputError);
    }
  }
  assert.equal(calls.length, 0);
  await gateway.cityById('a..b');
  await gateway.cityById('%2e');
  assert.equal(calls[1].url.pathname, '/v0/states/city/%252e');
});

test('response body accepts exactly 5 MB and rejects one byte more', async () => {
  const maximum = 5 * 1024 * 1024;
  for (const size of [maximum, maximum + 1]) {
    const body = '"' + 'a'.repeat(size - 2) + '"';
    const { gateway } = fixture({ fetch: async () => new Response(body) });
    if (size === maximum) {
      assert.equal((await gateway.tags() as string).length, maximum - 2);
    } else {
      await assert.rejects(gateway.tags(), UpstreamError);
    }
  }
});
