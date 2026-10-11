import type { City, State, Event, Theater, Session, ListResponse } from '../../src/domain/entities.ts';
import type { ContentGateway, EventOptions, LimitedEventOptions, PolicyOptions, CreditsOptions, NearOptions, TemplateKind, TemplateOptions, SessionsInput, SessionDatesInput } from '../../src/application/ports/ContentGateway.ts';
export class FakeContentGateway implements ContentGateway {
  calls: Array<{ method: keyof ContentGateway; args: unknown[] }> = [];
  results: Partial<{ [K in keyof ContentGateway]: Awaited<ReturnType<ContentGateway[K]>> }> = {};
  error?: Error;
  templatePages?: unknown[];
  private invoke<T>(method: keyof ContentGateway, args: unknown[]): Promise<T> { this.calls.push({ method, args }); if (this.error) return Promise.reject(this.error); return Promise.resolve(this.results[method] as T); }
  states(): Promise<State[]> { return this.invoke('states', []); }
  stateByUf(uf: string): Promise<State> { return this.invoke('stateByUf', [uf]); }
  cityById(id: string): Promise<City> { return this.invoke('cityById', [id]); }
  cityByUrlKey(key: string): Promise<City> { return this.invoke('cityByUrlKey', [key]); }
  cityByTheaterSlug(slug: string): Promise<City> { return this.invoke('cityByTheaterSlug', [slug]); }
  citiesNear(lat: number, long: number, options?: NearOptions): Promise<City[]> { return this.invoke('citiesNear', [lat, long, options]); }
  events(partnership: string, options?: EventOptions): Promise<ListResponse<Event>> { return this.invoke('events', [partnership, options]); }
  eventsByTag(tag: { tagName?: string; tagUrlKey?: string }, partnership: string, options?: EventOptions): Promise<ListResponse<Event>> { return this.invoke('eventsByTag', [tag, partnership, options]); }
  eventById(id: string, partnership: string, options?: EventOptions): Promise<Event> { return this.invoke('eventById', [id, partnership, options]); }
  eventByUrlKey(key: string, partnership: string, options?: EventOptions): Promise<Event> { return this.invoke('eventByUrlKey', [key, partnership, options]); }
  eventCredits(id: number, options?: CreditsOptions): Promise<unknown> { return this.invoke('eventCredits', [id, options]); }
  eventsComingSoon(partnership: string, options?: LimitedEventOptions): Promise<ListResponse<Event>> { return this.invoke('eventsComingSoon', [partnership, options]); }
  eventsByCity(cityId: string, partnership: string, options?: LimitedEventOptions): Promise<ListResponse<Event>> { return this.invoke('eventsByCity', [cityId, partnership, options]); }
  tags(): Promise<unknown> { return this.invoke('tags', []); }
  passportPromotion(): Promise<unknown> { return this.invoke('passportPromotion', []); }
  templates(
    kind: TemplateKind,
    partnership: string,
    cityId?: string,
    options?: TemplateOptions,
  ): Promise<unknown> {
    if (this.templatePages) {
      this.results.templates = this.templatePages[Math.floor((options?.skip ?? 0) / 100)] ?? [];
    }
    return this.invoke('templates', [kind, partnership, cityId, options]);
  }
  theaters(partnership: string, options?: PolicyOptions): Promise<ListResponse<Theater>> { return this.invoke('theaters', [partnership, options]); }
  theaterById(id: string, partnership: string, options?: PolicyOptions): Promise<Theater> { return this.invoke('theaterById', [id, partnership, options]); }
  theaterByUrlKey(key: string, partnership: string, options?: PolicyOptions): Promise<Theater> { return this.invoke('theaterByUrlKey', [key, partnership, options]); }
  theatersByCity(cityId: string, partnership: string, options?: PolicyOptions): Promise<ListResponse<Theater>> { return this.invoke('theatersByCity', [cityId, partnership, options]); }
  sessionById(id: string, partnership: string, options?: PolicyOptions): Promise<Session> { return this.invoke('sessionById', [id, partnership, options]); }
  sessions(input: SessionsInput): Promise<unknown> { return this.invoke('sessions', [input]); }
  sessionDates(input: SessionDatesInput): Promise<unknown> { return this.invoke('sessionDates', [input]); }
  sessionExistsByUrlKey(urlKey: string): Promise<unknown> { return this.invoke('sessionExistsByUrlKey', [urlKey]); }
}
