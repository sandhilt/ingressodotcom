import test from 'node:test';
import assert from 'node:assert/strict';
import * as usecases from '../../src/application/usecases/content.ts';
import { FakeContentGateway } from '../support/FakeContentGateway.ts';
import { InvalidInputError, UpstreamError } from '../../src/domain/errors.ts';

test('partnership precedence, pass-through response and upstream errors', async () => {
  const gateway = new FakeContentGateway();
  const response = { items: [{ id: '1', custom: true }], count: 1 };
  gateway.results.events = response;
  assert.equal(await usecases.searchEvents({ gateway }), response);
  await usecases.searchEvents({ gateway, config: { partnership: 'configured' } });
  await usecases.searchEvents({ gateway, config: { partnership: 'configured' } }, { partnership: 'explicit' });
  assert.deepEqual(gateway.calls.map(call => call.args[0]), ['1', 'configured', 'explicit']);
  await assert.rejects(usecases.searchEvents({ gateway }, { partnership: '' }), InvalidInputError);
  const error = new UpstreamError(500, 'failure'); gateway.error = error;
  await assert.rejects(usecases.listTags({ gateway }), actual => actual === error);
});
test('all content concerns dispatch to their gateway methods', async () => {
  const gateway = new FakeContentGateway(); const deps = { gateway };
  await usecases.listStates(deps);
  await usecases.getState(deps, { uf: 'SP' });
  await usecases.listTags(deps);
  await usecases.getPassportPromotion(deps);
  await usecases.getEvent(deps, { id: '1' });
  await usecases.getEvent(deps, { urlKey: 'movie' });
  await usecases.getEventCredits(deps, { id: 1, castLimit: 5 });
  await usecases.searchEvents(deps, { tagName: 'Cinema' });
  await usecases.searchEvents(deps, { tagUrlKey: 'cinema' });
  await usecases.searchEvents(deps, { comingSoon: true, limit: 2 });
  await usecases.searchEvents(deps, { cityId: '1' });
  for (const category of ['nowplaying', 'soon', 'highlights', 'premiere'] as const) await usecases.listMovies(deps, { category, cityId: '1' });
  await usecases.listTheaters(deps);
  await usecases.listTheaters(deps, { cityId: '1' });
  await usecases.getTheater(deps, { id: '1' });
  await usecases.getTheater(deps, { urlKey: 'cinema' });
  await usecases.getSession(deps, { id: '1' });
  await usecases.listSessionDates(deps, { cityId: '1', theaterId: '2' });
  await usecases.listSessionDates(deps, { cityId: '1', eventId: '2' });
  await usecases.sessionExistsByUrlKey(deps, { urlKey: 'movie' });
  assert.deepEqual(gateway.calls.map(call => call.method), ['states', 'stateByUf', 'tags', 'passportPromotion', 'eventById', 'eventByUrlKey', 'eventCredits', 'eventsByTag', 'eventsByTag', 'eventsComingSoon', 'eventsByCity', 'templates', 'templates', 'templates', 'templates', 'theaters', 'theatersByCity', 'theaterById', 'theaterByUrlKey', 'sessionById', 'sessionDates', 'sessionDates', 'sessionExistsByUrlKey']);
});
test('session variants preserve date, grouping, policies and slug filters', async () => {
  const gateway = new FakeContentGateway();
  for (const selector of [{ theaterId: '2' }, { theaterUrlKey: 'cinema' }, { eventId: '3' }, { eventUrlKey: 'movie', sessionTypeList: 'IMAX', legendList: 'DUB', includeOperationPolicies: true }, { theaterId: '2', groupBySessionType: true }, { eventId: '3', groupBySessionType: true }]) {
    const input = { cityId: '1', date: '2026-10-11', ...selector };
    await usecases.listSessions({ gateway }, input);
    assert.deepEqual(gateway.calls.at(-1), { method: 'sessions', args: [{ ...input, partnership: '1' }] });
  }
  await usecases.listSessions({ gateway }, { eventId: '3' });
  assert.deepEqual(gateway.calls.at(-1)?.args, [{ eventId: '3', partnership: '1' }]);
});
test('invalid route combinations are rejected before I/O', async () => {
  const gateway = new FakeContentGateway(); const deps = { gateway };
  const calls = [
    () => usecases.getEvent(deps, {}),
    () => usecases.getTheater(deps, { id: '1', urlKey: 'x' }),
    () => usecases.getEventCredits(deps, { id: 1.5 }),
    () => usecases.searchEvents(deps, { tagName: 'x', cityId: '1' }),
    () => usecases.searchEvents(deps, { limit: 1 }),
    () => usecases.listMovies(deps, { category: 'soon' }),
    () => usecases.listMovies(deps, { category: 'premiere', cityId: '1', limit: 1 }),
    () => usecases.listMovies(deps, { category: 'soon', cityId: '1', skip: 0 }),
    () => usecases.listSessionDates(deps, { cityId: '1' }),
    ...[{}, { theaterId: '2' }, { cityId: '1', theaterId: '2', eventId: '3' }, { cityId: '1', eventUrlKey: 'x', groupBySessionType: true }, { cityId: '1', theaterId: '2', includeOperationPolicies: true }, { cityId: '1', eventId: '2', date: '2026-02-30' }, { eventId: '2', date: '2026-10-11' }, { cityId: '1', eventId: '2', legendList: 'DUB' }].map(input => () => usecases.listSessions(deps, input)),
  ];
  for (const call of calls) await assert.rejects(call(), InvalidInputError);
  assert.equal(gateway.calls.length, 0);
});
