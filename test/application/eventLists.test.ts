import test from 'node:test';
import assert from 'node:assert/strict';
import { listMovies, searchEvents } from '../../src/application/usecases/content.ts';
import { FakeContentGateway } from '../support/FakeContentGateway.ts';
import { InvalidInputError } from '../../src/domain/errors.ts';

import { rioCatalog } from '../support/eventCatalog.ts';

test('fetches all nowplaying pages before sorting and paging the compact Rio catalog', async () => {
  const gateway = new FakeContentGateway();
  const events = rioCatalog();
  gateway.templatePages = [events.slice(0, 100), events.slice(100)];
  const input = { category: 'nowplaying' as const, cityId: '2' };
  const result = await listMovies({ gateway }, input);
  assert.equal(result.total, 183);
  assert.equal(result.returned, 40);
  assert.equal(result.hasMore, true);
  assert.equal(result.nextSkip, 40);
  assert.match(result.note, /skip: 40/);
  assert.deepEqual(result.items.slice(0, 3).map(event => event.title), ['Se Eu Fosse Você 3', 'Verity', 'Vingadores: Doutor Destino']);
  assert.ok(JSON.stringify(result).length < 20_000);
  assert.deepEqual(gateway.calls.map(call => call.args), [0, 100].map(skip => [
    'nowplaying', '1', '2', { limit: 100, skip, theatersIds: undefined, justEvents: undefined },
  ]));
  const last = await listMovies({ gateway }, { ...input, skip: 180 });
  assert.equal(last.returned, 3);
  assert.equal(last.hasMore, false);
  assert.equal('nextSkip' in last, false);
  const empty = await listMovies({ gateway }, { ...input, skip: 999 });
  assert.equal(empty.returned, 0);
  assert.equal(empty.hasMore, false);
});

test('api order and raw events survive tool paging; an empty API page ends fetching', async () => {
  const gateway = new FakeContentGateway();
  const events = rioCatalog().slice(0, 100);
  gateway.templatePages = [events, []];
  const result = await listMovies({ gateway }, { category: 'nowplaying', sort: 'api', compact: false, skip: 98, limit: 200 });
  assert.deepEqual(result.items, events.slice(98));
  assert.equal(result.total, 100);
  assert.equal(gateway.calls.length, 2);
});

test('popularity ties sort by title; other categories fetch once and accept tool limit', async () => {
  const gateway = new FakeContentGateway();
  gateway.results.templates = [{ title: 'Z', countIsPlaying: 2 }, { title: 'A', countIsPlaying: 2 }];
  for (const category of ['soon', 'highlights', 'premiere'] as const) {
    const result = await listMovies({ gateway }, { category, cityId: '2', limit: 1 });
    assert.equal(result.items[0].title, 'A');
    assert.equal(result.nextSkip, 1);
    assert.equal((gateway.calls.at(-1)!.args[3] as { skip?: number }).skip, undefined);
    await assert.rejects(listMovies({ gateway }, { category, cityId: '2', skip: 1 }), InvalidInputError);
  }
  assert.equal(gateway.calls.length, 3);
});

test('hard cap fails explicitly rather than reporting an incomplete total', async () => {
  const gateway = new FakeContentGateway();
  gateway.results.templates = rioCatalog().slice(0, 100);
  await assert.rejects(listMovies({ gateway }, { category: 'nowplaying' }), /20 API pages/);
  assert.equal(gateway.calls.length, 20);
});

test('search pages the returned list without passing tool limit to the API', async () => {
  const gateway = new FakeContentGateway();
  gateway.results.eventsByCity = { items: rioCatalog(), count: 999 };
  const result = await searchEvents({ gateway }, { cityId: '2', limit: 2 });
  assert.equal(result.total, 183);
  assert.equal(result.returned, 2);
  assert.equal(result.nextSkip, 2);
  assert.equal(result.hasMore, true);
  assert.deepEqual(gateway.calls[0].args, ['2', '1', { includeCities: undefined }]);
  const raw = await searchEvents({ gateway }, { cityId: '2', compact: false, sort: 'api', skip: 180 });
  assert.deepEqual(raw.items, gateway.results.eventsByCity.items!.slice(180));
  assert.equal(raw.hasMore, false);
});

test('page validation rejects invalid inputs before I/O', async () => {
  const gateway = new FakeContentGateway();
  for (const options of [{ limit: -1 }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }, { skip: -1 }, { skip: 0.5 }]) {
    await assert.rejects(searchEvents({ gateway }, options), InvalidInputError);
    await assert.rejects(listMovies({ gateway }, { category: 'nowplaying', ...options }), InvalidInputError);
  }
  assert.equal(gateway.calls.length, 0);
});

test('highlights projects and sorts nested events while raw mode preserves showtimes', async () => {
  const gateway = new FakeContentGateway();
  const source = [
    { event: { id: '1', title: 'Old', countIsPlaying: 2 }, showtimes: ['details'] },
    { event: { id: '2', title: 'New', countIsPlaying: 397 }, showtimes: ['details'] },
  ];
  gateway.results.templates = source;
  const input = { category: 'highlights' as const, cityId: '2' };
  const compact = await listMovies({ gateway }, input);
  assert.equal(compact.items[0].title, 'New');
  assert.equal('showtimes' in compact.items[0], false);
  const raw = await listMovies({ gateway }, { ...input, compact: false });
  assert.deepEqual(raw.items, [source[1], source[0]]);
  assert.equal((gateway.calls[0].args[3] as { limit: number }).limit, 0);
});

test('empty search returns an empty page and selector paging works for tags and coming soon', async () => {
  const gateway = new FakeContentGateway();
  gateway.results.events = { items: [] };
  const empty = await searchEvents({ gateway });
  assert.equal(empty.total, 0);
  assert.equal(empty.hasMore, false);
  assert.equal(empty.returned, 0);
  assert.equal('nextSkip' in empty, false);
  gateway.results.eventsByTag = { items: rioCatalog() };
  gateway.results.eventsComingSoon = { items: rioCatalog() };
  for (const selector of [{ tagName: 'Cinema' }, { tagUrlKey: 'cinema' }, { comingSoon: true }]) {
    const page = await searchEvents({ gateway }, { ...selector, skip: 180 });
    assert.equal(page.total, 183);
    assert.equal(page.returned, 3);
    assert.equal(page.hasMore, false);
  }
});
