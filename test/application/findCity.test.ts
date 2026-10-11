import test from 'node:test';
import assert from 'node:assert/strict';
import { findCity } from '../../src/application/usecases/findCity.ts';
import { FakeContentGateway } from '../support/FakeContentGateway.ts';
import { InvalidInputError, NotFoundError } from '../../src/domain/errors.ts';
test('name search handles accents, case, duplicate cities, UF, null cities', async () => {
  const gateway = new FakeContentGateway();
  const city = { id: '1', name: 'São José', extra: 42 };
  gateway.results.states = [{ uf: 'SP', cities: [city] }, { uf: 'SC', cities: [{ name: 'São José' }] }, { cities: null }];
  assert.equal((await findCity({ gateway }, { name: ' SAO JOSE ' }) as unknown[]).length, 2);
  assert.deepEqual(await findCity({ gateway }, { name: 'são josé', uf: 'sp' }), [city]);
  await assert.rejects(findCity({ gateway }, { name: 'Missing' }), NotFoundError);
});
test('direct selectors and coordinates delegate without flattening responses', async () => {
  for (const [input, method, args] of [
    [{ id: '1' }, 'cityById', ['1']],
    [{ urlKey: 'sao-paulo' }, 'cityByUrlKey', ['sao-paulo']],
    [{ theaterSlug: 'cinema' }, 'cityByTheaterSlug', ['cinema']],
    [{ lat: 0, long: 0, resultCount: 2 }, 'citiesNear', [0, 0, { radiusInKilometers: undefined, resultCount: 2 }]],
  ] as const) {
    const gateway = new FakeContentGateway();
    await findCity({ gateway }, input);
    assert.deepEqual(gateway.calls, [{ method, args }]);
  }
});
test('invalid selectors and coordinates never call gateway', async () => {
  const gateway = new FakeContentGateway();
  for (const input of [{}, { name: '' }, { id: '1', name: 'A' }, { lat: 1 }, { lat: NaN, long: 0 }, { lat: 91, long: 0 }, { lat: 0, long: 181 }, { uf: 'SP' }, { id: '1', uf: 'SP' }, { lat: 0, long: 0, resultCount: 0 }]) {
    await assert.rejects(findCity({ gateway }, input), InvalidInputError);
  }
  assert.equal(gateway.calls.length, 0);
});
