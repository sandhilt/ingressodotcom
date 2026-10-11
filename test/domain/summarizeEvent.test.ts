import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEvent } from '../../src/domain/summarizeEvent.ts';

test('projects discovery fields and removes heavy payloads without mutation', () => {
  const event = {
    id: '1', title: 'Filme', originalTitle: 'Movie', genres: ['Drama'],
    contentRating: '14', duration: '120', premiereDate: { localDate: '2026-10-11T00:00:00' },
    inPreSale: true, isReexhibition: true, isComingSoon: true,
    countIsPlaying: 393, siteURL: 'https://example.com', synopsis: 'heavy', images: ['image'],
  };
  const before = JSON.stringify(event);
  assert.deepEqual(summarizeEvent(event), {
    id: '1', title: 'Filme', originalTitle: 'Movie', genres: ['Drama'],
    contentRating: '14', duration: '120', premiere: '2026-10-11',
    inPreSale: true, isReexhibition: true, isComingSoon: true,
    showSize: 393, siteURL: 'https://example.com',
  });
  assert.equal(JSON.stringify(event), before);
});

test('omits identical or absent original titles and handles missing fields', () => {
  for (const originalTitle of ['Filme', null, undefined]) {
    const result = summarizeEvent({ title: 'Filme', originalTitle, premiereDate: null });
    assert.equal('originalTitle' in result, false);
    assert.equal(result.premiere, undefined);
    assert.deepEqual(result.genres, []);
    assert.equal(result.showSize, 0);
    assert.equal(result.inPreSale, false);
    assert.equal(result.isReexhibition, false);
    assert.equal(result.isComingSoon, false);
  }
});
