import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMethod } from '../../src/domain/OperationSafety.ts';
import { InvalidInputError, NotFoundError, UpstreamError } from '../../src/domain/errors.ts';
const expected = {
  GET: { readOnly: true, destructive: false, idempotent: true },
  HEAD: { readOnly: true, destructive: false, idempotent: true },
  OPTIONS: { readOnly: true, destructive: false, idempotent: true },
  PUT: { readOnly: false, destructive: true, idempotent: true },
  DELETE: { readOnly: false, destructive: true, idempotent: true },
  POST: { readOnly: false, destructive: true, idempotent: false },
  PATCH: { readOnly: false, destructive: true, idempotent: false },
  UNKNOWN: { readOnly: false, destructive: true, idempotent: false },
  get: { readOnly: false, destructive: true, idempotent: false },
};
for (const [method, safety] of Object.entries(expected)) {
  test(`classifies ${method}`, () => {
    assert.deepEqual(classifyMethod(method), safety);
  });
}
test('domain errors retain identity and bounded upstream details', () => {
  const upstream = new UpstreamError(503, 'x'.repeat(600));
  assert.equal(upstream.status, 503);
  assert.equal(upstream.bodyExcerpt.length, 500);
  for (const error of [upstream, new NotFoundError(), new InvalidInputError('bad')]) {
    assert.ok(error instanceof Error);
    assert.equal(error.name, error.constructor.name);
  }
});
