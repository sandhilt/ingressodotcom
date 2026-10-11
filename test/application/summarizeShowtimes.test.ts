import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeShowtimes } from '../../src/application/usecases/summarizeShowtimes.ts';

const session = { id: 's1', time: '21:30', type: ['IMAX', 'Legendado'], price: 59.27, siteURL: 'https://checkout.example/s1', enabled: false };
const payload = [
  { date: '2026-10-12', dayOfWeek: 'segunda', movies: [{ id: '1', title: 'A Odisseia', originalTitle: 'The Odyssey', rooms: [{ name: 'Sala 4', sessions: [session] }] }] },
  { date: '2026-10-11', dayOfWeek: 'domingo', movies: [
    { id: '1', title: 'A Odisseia', originalTitle: 'The Odyssey', rooms: [
      { name: 'Sala 4', sessions: [session, { ...session, id: 's2', type: ['Legendado', 'IMAX'], price: 0 }] },
      { name: 'Sala 5', sessions: [{ ...session, id: 's3', type: ['Dublado', '2D'], price: 40 }] },
    ] },
    { id: '2', title: 'Outro filme', rooms: [{ name: 'Sala 6', sessions: [{ ...session, price: 999 }] }] },
  ] },
];

test('pure summary groups only the chosen movie, sorts days and canonicalizes type combinations', () => {
  const before = JSON.stringify(payload);
  const result = summarizeShowtimes(payload, { title: 'ODÍSSEIA' });
  assert.deepEqual(result.event, { id: '1', title: 'A Odisseia' });
  assert.deepEqual(result.days?.[0], {
    date: '2026-10-11', dayOfWeek: 'domingo', sessionCount: 3,
    priceMin: 0, priceMax: 59.27, formats: ['IMAX / Legendado', '2D / Dublado'],
  });
  assert.equal(result.days?.[1].sessionCount, 1);
  assert.match(result.note, /não disponibilidade de assentos/);
  assert.equal(JSON.stringify(payload), before);
});

test('original title, date restriction and optional session projection', () => {
  const result = summarizeShowtimes(payload, { title: 'odyssey', date: '2026-10-12', includeSessions: true });
  assert.equal(result.days?.length, 1);
  assert.deepEqual(result.days?.[0].sessions, [{
    id: 's1', time: '21:30', room: 'Sala 4', type: ['IMAX', 'Legendado'], price: 59.27,
    checkoutUrl: 'https://checkout.example/s1',
  }]);
});

test('distinct matches return identifiers and titles without sessions or days', () => {
  const result = summarizeShowtimes(payload, { title: 'o', includeSessions: true });
  assert.deepEqual(result.matches, [{ id: '1', title: 'A Odisseia' }, { id: '2', title: 'Outro filme' }]);
  assert.equal('days' in result, false);
  assert.equal('sessions' in result, false);
});

test('empty payload, absent movie and absent date return friendly empty days', () => {
  for (const [source, input] of [
    [null, { eventId: '1' }], [[], { title: 'missing' }],
    [payload, { eventId: 'missing' }], [payload, { eventId: '1', date: '2027-01-01' }],
  ] as const) {
    const result = summarizeShowtimes(source, input);
    assert.deepEqual(result.days, []);
    assert.match(result.note, /Nenhuma sessão encontrada/);
  }
});

test('repeated date entries merge and unavailable prices do not invent zero prices', () => {
  const day = { date: '2026-10-11', dayOfWeek: 'domingo', movies: [{ id: '1', title: 'Movie', rooms: [{ name: 'Room', sessions: [{ ...session, price: null }] }] }] };
  const result = summarizeShowtimes([day, day], { eventId: '1' });
  assert.equal(result.days?.[0].sessionCount, 2);
  assert.equal(result.days?.[0].priceMin, null);
  assert.equal(result.days?.[0].priceMax, null);
});
