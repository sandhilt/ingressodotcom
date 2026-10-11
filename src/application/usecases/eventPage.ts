import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_INT32 } from '../eventLimits.ts';
import type { Event } from '../../domain/entities.ts';
import { summarizeEvent } from '../../domain/summarizeEvent.ts';
import { InvalidInputError } from '../../domain/errors.ts';

export interface EventPageInput {
  compact?: boolean;
  sort?: 'popularity' | 'api';
  limit?: number;
  skip?: number;
}

export function validateEventPage(input: EventPageInput) {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const skip = input.skip ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new InvalidInputError(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }
  if (!Number.isInteger(skip) || skip < 0 || skip > MAX_INT32) {
    throw new InvalidInputError('Invalid skip');
  }
  if (input.sort !== undefined && !['popularity', 'api'].includes(input.sort)) {
    throw new InvalidInputError('Invalid sort');
  }
  if (input.compact !== undefined && typeof input.compact !== 'boolean') {
    throw new InvalidInputError('Invalid compact');
  }
}

/** Templates may return a root array or an items envelope. */
export function eventItems(response: unknown): Event[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && 'items' in response && Array.isArray(response.items)) {
    return response.items;
  }
  return [];
}

// highlights includes an event plus showtimes; raw mode keeps that wrapper.
function movieEvent(item: Event): Event {
  return item.event && typeof item.event === 'object' ? item.event as Event : item;
}

export function eventPage(events: Event[], input: EventPageInput) {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const skip = input.skip ?? 0;
  const sorted = [...events];
  if ((input.sort ?? 'popularity') === 'popularity') {
    sorted.sort((a, b) => {
      const first = movieEvent(a);
      const second = movieEvent(b);
      return (second.countIsPlaying ?? 0) - (first.countIsPlaying ?? 0)
        || (first.title ?? '').localeCompare(second.title ?? '', 'pt-BR');
    });
  }
  const selected = sorted.slice(skip, skip + limit);
  const hasMore = skip + selected.length < events.length;
  const nextSkip = skip + selected.length;
  return {
    total: events.length,
    returned: selected.length,
    skip,
    hasMore,
    ...(hasMore ? { nextSkip } : {}),
    items: input.compact === false ? selected : selected.map(item => summarizeEvent(movieEvent(item))),
    note: hasMore
      ? `Para buscar a próxima página, repita os filtros com skip: ${nextSkip}.`
      : 'Fim da lista; não há próxima página.',
  };
}
