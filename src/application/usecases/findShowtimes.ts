import type { Deps, PartnershipInput } from './Deps.ts';
import type { ShowtimesSelection } from './summarizeShowtimes.ts';
import { exactlyOne, text } from './Deps.ts';
import { listSessions } from './content.ts';
import { summarizeShowtimes } from './summarizeShowtimes.ts';
import { InvalidInputError } from '../../domain/errors.ts';

export interface FindShowtimesInput extends ShowtimesSelection, PartnershipInput {
  cityId: string;
  theaterId?: string;
  theaterUrlKey?: string;
}

export async function findShowtimes(deps: Deps, input: FindShowtimesInput) {
  text(input.cityId, 'cityId');
  exactlyOne(input, ['theaterId', 'theaterUrlKey']);
  exactlyOne(input, ['eventId', 'title']);
  if (input.includeSessions !== undefined && typeof input.includeSessions !== 'boolean') {
    throw new InvalidInputError('includeSessions must be boolean');
  }
  const payload = await listSessions(deps, {
    cityId: input.cityId,
    ...(input.theaterId !== undefined ? { theaterId: input.theaterId } : { theaterUrlKey: input.theaterUrlKey }),
    ...(input.date !== undefined ? { date: input.date } : {}),
    ...(input.partnership !== undefined ? { partnership: input.partnership } : {}),
  });
  return summarizeShowtimes(payload, input);
}
