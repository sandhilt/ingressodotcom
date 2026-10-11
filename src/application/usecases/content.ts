import type { Event } from '../../domain/entities.ts';
import type { EventPageInput } from './eventPage.ts';
import { eventItems, eventPage, validateEventPage } from './eventPage.ts';
import type { Deps, PartnershipInput } from './Deps.ts';
import type {
  EventOptions, PolicyOptions, CreditsOptions,
  TemplateKind, SessionsInput, SessionDatesInput,
} from '../ports/ContentGateway.ts';
import { partnership, text, exactlyOne } from './Deps.ts';
import { InvalidInputError } from '../../domain/errors.ts';

function integers(input: object, keys: string[]) {
  const values = input as Record<string, unknown>;
  for (const key of keys) {
    if (values[key] !== undefined && (
      !Number.isInteger(values[key])
      || (values[key] as number) < 0
      || (values[key] as number) > 2147483647
    )) {
      throw new InvalidInputError(`Invalid ${key}`);
    }
  }
}

export async function listStates(deps: Deps) {
  return deps.gateway.states();
}

export async function getState(deps: Deps, input: {
  uf: string;
}) {
  text(input.uf, 'uf');
  return deps.gateway.stateByUf(input.uf);
}

export async function listTags(deps: Deps) {
  return deps.gateway.tags();
}

export async function getPassportPromotion(deps: Deps) {
  return deps.gateway.passportPromotion();
}

export async function getEvent(deps: Deps, input: PartnershipInput & EventOptions & {
  id?: string;
  urlKey?: string;
}) {
  exactlyOne(input, ['id', 'urlKey']);
  const p = partnership(deps, input);
  return input.id !== undefined
    ? deps.gateway.eventById(input.id, p, { includeCities: input.includeCities })
    : deps.gateway.eventByUrlKey(input.urlKey!, p, { includeCities: input.includeCities });
}

export async function getEventCredits(deps: Deps, input: CreditsOptions & {
  id: number;
}) {
  if (!Number.isInteger(input.id) || input.id < 1 || input.id > 2147483647) {
    throw new InvalidInputError('Invalid event id');
  }
  integers(input, ['castLimit', 'crewLimit']);
  return deps.gateway.eventCredits(input.id, { castLimit: input.castLimit, crewLimit: input.crewLimit });
}

export async function searchEvents(deps: Deps, input: PartnershipInput & EventOptions & EventPageInput & {
  tagName?: string;
  tagUrlKey?: string;
  cityId?: string;
  comingSoon?: boolean;
  all?: boolean;
} = {}) {
  const selectors = ['tagName', 'tagUrlKey', 'cityId'].filter(key => (input as Record<string, unknown>)[key] !== undefined);
  if (selectors.length + Number(input.comingSoon === true) + Number(input.all === true) > 1) {
    throw new InvalidInputError('Conflicting event selectors');
  }
  for (const key of selectors) {
    text((input as Record<string, string>)[key], key);
  }
  validateEventPage(input);
  const p = partnership(deps, input);
  const options = { includeCities: input.includeCities };
  let response;
  if (input.tagName !== undefined || input.tagUrlKey !== undefined) {
    response = await deps.gateway.eventsByTag({ tagName: input.tagName, tagUrlKey: input.tagUrlKey }, p, options);
  } else if (input.cityId !== undefined) {
    response = await deps.gateway.eventsByCity(input.cityId, p, options);
  } else if (input.comingSoon) {
    response = await deps.gateway.eventsComingSoon(p, options);
  } else {
    response = await deps.gateway.events(p, options);
  }
  return eventPage(eventItems(response), input);
}

export async function listMovies(deps: Deps, input: PartnershipInput & EventPageInput & {
  theatersIds?: string;
  justEvents?: boolean;
  category: TemplateKind;
  cityId?: string;
}) {
  if (!['nowplaying', 'soon', 'highlights', 'premiere'].includes(input.category)) {
    throw new InvalidInputError('Invalid category');
  }
  if (input.category !== 'nowplaying' || input.cityId !== undefined) {
    text(input.cityId!, 'cityId');
  }
  validateEventPage(input);
  if (input.skip !== undefined && input.category !== 'nowplaying') {
    throw new InvalidInputError('skip requires nowplaying');
  }
  if ((input.theatersIds !== undefined || input.justEvents !== undefined) && input.category !== 'highlights') {
    throw new InvalidInputError('Highlight options require highlights');
  }
  const p = partnership(deps, input);
  const events: Event[] = [];
  const pageSize = 100;
  const maxPages = input.category === 'nowplaying' ? 20 : 1;
  for (let page = 0; page < maxPages; page++) {
    const response = await deps.gateway.templates(input.category, p, input.cityId, {
      limit: input.category === 'nowplaying' ? pageSize
        : input.category === 'highlights' ? 0 : undefined,
      skip: input.category === 'nowplaying' ? page * pageSize : undefined,
      theatersIds: input.theatersIds,
      justEvents: input.justEvents,
    });
    const items = eventItems(response);
    events.push(...items);
    if (items.length < pageSize || input.category !== 'nowplaying') {
      return eventPage(events, input);
    }
  }
  throw new InvalidInputError('Catalog exceeds the safety cap of 20 API pages; narrow the city or partnership.');
}

export async function listTheaters(deps: Deps, input: PartnershipInput & PolicyOptions & {
  cityId?: string;
} = {}) {
  const p = partnership(deps, input);
  const options = { includeOperationPolicies: input.includeOperationPolicies };
  if (input.cityId !== undefined) {
    text(input.cityId, 'cityId');
    return deps.gateway.theatersByCity(input.cityId, p, options);
  }
  return deps.gateway.theaters(p, options);
}

export async function getTheater(deps: Deps, input: PartnershipInput & PolicyOptions & {
  id?: string;
  urlKey?: string;
}) {
  exactlyOne(input, ['id', 'urlKey']);
  const p = partnership(deps, input);
  const options = { includeOperationPolicies: input.includeOperationPolicies };
  return input.id !== undefined
    ? deps.gateway.theaterById(input.id, p, options)
    : deps.gateway.theaterByUrlKey(input.urlKey!, p, options);
}

export async function getSession(deps: Deps, input: PartnershipInput & PolicyOptions & {
  id: string;
}) {
  text(input.id, 'id');
  return deps.gateway.sessionById(input.id, partnership(deps, input), { includeOperationPolicies: input.includeOperationPolicies });
}

export async function listSessions(deps: Deps, input: Omit<SessionsInput, 'partnership'> & PartnershipInput) {
  exactlyOne(input, ['theaterId', 'theaterUrlKey', 'eventId', 'eventUrlKey']);
  if (input.cityId !== undefined) {
    text(input.cityId, 'cityId');
  } else if (input.eventId === undefined || input.date !== undefined || input.groupBySessionType || input.includeOperationPolicies !== undefined) {
    throw new InvalidInputError('This session route requires cityId');
  }
  if (input.groupBySessionType && (input.eventUrlKey !== undefined || input.theaterUrlKey !== undefined)) {
    throw new InvalidInputError('Grouping requires an id');
  }
  if (input.includeOperationPolicies !== undefined && input.eventId === undefined && input.eventUrlKey === undefined) {
    throw new InvalidInputError('Policies require an event route');
  }
  if ((input.sessionTypeList !== undefined || input.legendList !== undefined) && input.eventUrlKey === undefined) {
    throw new InvalidInputError('Session filters require eventUrlKey');
  }
  if (input.cityId === undefined && (input.eventId!.length > 11 || partnership(deps, input).length > 255)) {
    throw new InvalidInputError('Event-only route parameter too long');
  }
  if (input.date !== undefined && (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
    || !Number.isFinite(Date.parse(input.date))
    || new Date(input.date).toISOString().slice(0, 10) !== input.date
  )) {
    throw new InvalidInputError('Invalid date; use YYYY-MM-DD');
  }
  return deps.gateway.sessions({ ...input, partnership: partnership(deps, input) });
}

export async function listSessionDates(deps: Deps, input: Omit<SessionDatesInput, 'partnership'> & PartnershipInput) {
  text(input.cityId, 'cityId');
  exactlyOne(input, ['theaterId', 'eventId']);
  return deps.gateway.sessionDates({ ...input, partnership: partnership(deps, input) });
}

export async function sessionExistsByUrlKey(deps: Deps, input: {
  urlKey: string;
}) {
  text(input.urlKey, 'urlKey');
  return deps.gateway.sessionExistsByUrlKey(input.urlKey);
}
