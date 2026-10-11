import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMethod } from '../../src/domain/OperationSafety.ts';
import { InvalidInputError, NotFoundError, UpstreamError } from '../../src/domain/errors.ts';
for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'POST', 'PATCH', 'UNKNOWN', 'get']) {
  test(`classifies ${method}`, () => {
    const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    assert.deepEqual(classifyMethod(method), { readOnly, destructive: !readOnly, idempotent: readOnly || ['PUT', 'DELETE'].includes(method) });
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
