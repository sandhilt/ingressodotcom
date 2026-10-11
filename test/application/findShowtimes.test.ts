import test from 'node:test';
import assert from 'node:assert/strict';
import { findShowtimes } from '../../src/application/usecases/findShowtimes.ts';
import { FakeContentGateway } from '../support/FakeContentGateway.ts';
import { InvalidInputError } from '../../src/domain/errors.ts';

const movie = { id: '1', title: 'Coração', originalTitle: 'Heart', rooms: [{ name: 'Sala 1', sessions: [{ id: 's', time: '12:00', type: ['2D'], price: 20, siteURL: 'https://checkout.example' }] }] };
const days = [{ date: '2026-10-11', dayOfWeek: 'domingo', movies: [movie] }];

test('findShowtimes uses only theater sessions and applies partnership precedence', async () => {
  const gateway = new FakeContentGateway();
  gateway.results.sessions = days;
  const deps = { gateway, config: { partnership: 'configured' } };
  const result = await findShowtimes(deps, { cityId: 'city', theaterId: 'theater', title: 'coracao' });
  assert.equal(result.days?.[0].sessionCount, 1);
  await findShowtimes(deps, { cityId: 'city', theaterUrlKey: 'slug', eventId: '1', date: '2026-10-11', partnership: 'explicit', includeSessions: true });
  await findShowtimes({ gateway }, { cityId: 'city', theaterId: 'theater', eventId: '1' });
  assert.deepEqual(gateway.calls, [
    { method: 'sessions', args: [{ cityId: 'city', theaterId: 'theater', partnership: 'configured' }] },
    { method: 'sessions', args: [{ cityId: 'city', theaterUrlKey: 'slug', date: '2026-10-11', partnership: 'explicit' }] },
    { method: 'sessions', args: [{ cityId: 'city', theaterId: 'theater', partnership: '1' }] },
  ]);
});

test('use case returns ambiguity and empty results without errors', async () => {
  const gateway = new FakeContentGateway();
  gateway.results.sessions = [{ ...days[0], movies: [movie, { ...movie, id: '2', title: 'Coração 2' }] }];
  const input = { cityId: 'city', theaterId: 'theater', title: 'coracao' };
  const ambiguous = await findShowtimes({ gateway }, input);
  assert.equal(ambiguous.matches?.length, 2);
  assert.equal('days' in ambiguous, false);
  gateway.results.sessions = null;
  const empty = await findShowtimes({ gateway }, input);
  assert.deepEqual(empty.days, []);
  assert.match(empty.note, /Nenhuma sessão/);
});

test('invalid selectors and dates fail before I/O', async () => {
  const gateway = new FakeContentGateway();
  const valid = { cityId: 'city', theaterId: 'theater', eventId: '1' };
  for (const input of [
    { ...valid, cityId: '' }, { ...valid, theaterId: undefined },
    { ...valid, theaterUrlKey: 'slug' }, { ...valid, title: 'Movie' },
    { ...valid, eventId: undefined }, { ...valid, date: '2026-02-30' },
    { ...valid, title: ' ', eventId: undefined },
  ]) {
    await assert.rejects(findShowtimes({ gateway }, input), InvalidInputError);
  }
  assert.equal(gateway.calls.length, 0);
});
