import type { City, State, Event, Theater, Session, ListResponse } from '../../domain/entities.ts';

export interface EventOptions {
  includeCities?: boolean;
}

export interface LimitedEventOptions extends EventOptions {
  limit?: number;
}

export interface PolicyOptions {
  includeOperationPolicies?: boolean;
}

export interface CreditsOptions {
  castLimit?: number;
  crewLimit?: number;
}

export interface NearOptions {
  radiusInKilometers?: number;
  resultCount?: number;
}

export type TemplateKind = 'nowplaying' | 'soon' | 'highlights' | 'premiere';

export interface TemplateOptions {
  limit?: number;
  skip?: number;
  theatersIds?: string;
  justEvents?: boolean;
}

export interface SessionsInput extends PolicyOptions {
  partnership: string;
  cityId?: string;
  theaterId?: string;
  theaterUrlKey?: string;
  eventId?: string;
  eventUrlKey?: string;
  groupBySessionType?: boolean;
  date?: string;
  sessionTypeList?: string;
  legendList?: string;
}

export interface SessionDatesInput {
  partnership: string;
  cityId: string;
  theaterId?: string;
  eventId?: string;
}

export interface ContentGateway {
  states(): Promise<State[]>;
  stateByUf(uf: string): Promise<State>;
  cityById(id: string): Promise<City>;
  cityByUrlKey(key: string): Promise<City>;
  cityByTheaterSlug(slug: string): Promise<City>;
  /** long maps to Swagger's lng query parameter. */
  citiesNear(lat: number, long: number, options?: NearOptions): Promise<City[]>;
  events(partnership: string, options?: EventOptions): Promise<ListResponse<Event>>;
  eventsByTag(tag: {
    tagName?: string;
    tagUrlKey?: string;
  }, partnership: string, options?: EventOptions): Promise<ListResponse<Event>>;
  eventById(id: string, partnership: string, options?: EventOptions): Promise<Event>;
  eventByUrlKey(key: string, partnership: string, options?: EventOptions): Promise<Event>;
  eventCredits(id: number, options?: CreditsOptions): Promise<unknown>;
  eventsComingSoon(partnership: string, options?: LimitedEventOptions): Promise<ListResponse<Event>>;
  eventsByCity(cityId: string, partnership: string, options?: LimitedEventOptions): Promise<ListResponse<Event>>;
  tags(): Promise<unknown>;
  passportPromotion(): Promise<unknown>;
  templates(kind: TemplateKind, partnership: string, cityId?: string, options?: TemplateOptions): Promise<unknown>;
  theaters(partnership: string, options?: PolicyOptions): Promise<ListResponse<Theater>>;
  theaterById(id: string, partnership: string, options?: PolicyOptions): Promise<Theater>;
  theaterByUrlKey(key: string, partnership: string, options?: PolicyOptions): Promise<Theater>;
  theatersByCity(cityId: string, partnership: string, options?: PolicyOptions): Promise<ListResponse<Theater>>;
  sessionById(id: string, partnership: string, options?: PolicyOptions): Promise<Session>;
  sessions(input: SessionsInput): Promise<unknown>;
  sessionDates(input: SessionDatesInput): Promise<unknown>;
  sessionExistsByUrlKey(urlKey: string): Promise<unknown>;
}
