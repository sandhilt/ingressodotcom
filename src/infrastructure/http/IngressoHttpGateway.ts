import type {
  ContentGateway, EventOptions, LimitedEventOptions, PolicyOptions, CreditsOptions,
  NearOptions, TemplateKind, TemplateOptions, SessionsInput, SessionDatesInput,
} from '../../application/ports/ContentGateway.ts';
import type { City, State, Event, Theater, Session, ListResponse } from '../../domain/entities.ts';
import { InvalidInputError, NotFoundError, UpstreamError } from '../../domain/errors.ts';
import type { IngressoConfig } from '../config.ts';

type Query = Record<string, string | number | boolean | undefined>;

export interface HttpGatewayOptions {
  fetch?: typeof globalThis.fetch;
  clock?: () => number;
}

export class IngressoHttpGateway implements ContentGateway {
  private readonly config: IngressoConfig;
  private readonly fetch: typeof globalThis.fetch;
  private readonly clock: () => number;
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(config: IngressoConfig, options: HttpGatewayOptions = {}) {
    this.config = config;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.clock = options.clock ?? Date.now;
  }

  private async request<T>(segments: Array<string | number>, query: Query = {}, empty: unknown = { items: [], count: 0 }): Promise<T> {
    const path = segments.map(segment => {
      const value = String(segment);
      if (value === '.' || value === '..') {
        throw new InvalidInputError('Path segments cannot be . or ..');
      }
      return encodeURIComponent(value);
    }).join('/');
    const url = new URL(this.config.baseUrl.replace(/\/+$/, '') + '/' + path);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(name, String(value));
      }
    }

    try {
      const response = await this.fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ingressodotcom-mcp',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (response.status === 404) {
        throw new NotFoundError();
      }
      if (!response.ok) {
        throw new UpstreamError(response.status, await this.bodyExcerpt(response));
      }
      if (response.status === 204) {
        return empty as T;
      }
      return JSON.parse(await this.readBody(response)) as T;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof UpstreamError) {
        throw error;
      }
      throw new UpstreamError(0, error instanceof Error ? error.message : String(error));
    }
  }

  private async readBody(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      return '';
    }
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return body + decoder.decode();
        }
        bytes += value.byteLength;
        if (bytes > 5 * 1024 * 1024) {
          throw new UpstreamError(response.status, 'Response body exceeds 5 MB');
        }
        body += decoder.decode(value, { stream: true });
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  private async bodyExcerpt(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      return '';
    }
    const decoder = new TextDecoder();
    let excerpt = '';
    try {
      while (excerpt.length < 500) {
        const { done, value } = await reader.read();
        if (done) {
          excerpt += decoder.decode();
          break;
        }
        excerpt += decoder.decode(value, { stream: true });
      }
      return excerpt.slice(0, 500);
    } catch {
      return excerpt.slice(0, 500);
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  private async cached<T>(key: string, segments: string[]): Promise<T> {
    const entry = this.cache.get(key);
    if (entry && this.clock() < entry.expiresAt) {
      return entry.value as T;
    }
    const value = await this.request<T>(segments, {}, key === 'states' ? [] : { items: [], count: 0 });
    this.cache.set(key, { value, expiresAt: this.clock() + 60_000 });
    return value;
  }

  states(): Promise<State[]> {
    return this.cached('states', ['v0', 'states']);
  }

  stateByUf(uf: string): Promise<State> {
    return this.request(['v0', 'states', uf]);
  }

  cityById(id: string): Promise<City> {
    return this.request(['v0', 'states', 'city', id]);
  }

  cityByUrlKey(key: string): Promise<City> {
    return this.request(['v0', 'states', 'city', 'name', key]);
  }

  cityByTheaterSlug(slug: string): Promise<City> {
    return this.request(['v0', 'states', 'city', 'theater', slug]);
  }

  citiesNear(lat: number, long: number, options: NearOptions = {}): Promise<City[]> {
    return this.request(['v0', 'states', 'city', 'latlong'], { lat, lng: long, ...options }, []);
  }

  events(partnership: string, options: EventOptions = {}): Promise<ListResponse<Event>> {
    return this.request(['v0', 'events', 'partnership', partnership], { ...options });
  }

  eventById(id: string, partnership: string, options: EventOptions = {}): Promise<Event> {
    return this.request(['v0', 'events', id, 'partnership', partnership], { ...options });
  }

  eventByUrlKey(key: string, partnership: string, options: EventOptions = {}): Promise<Event> {
    return this.request(['v0', 'events', 'url-key', key, 'partnership', partnership], { ...options });
  }

  eventCredits(id: number, options: CreditsOptions = {}): Promise<unknown> {
    return this.request(['v0', 'events', id, 'credits'], { ...options });
  }

  eventsComingSoon(partnership: string, options: LimitedEventOptions = {}): Promise<ListResponse<Event>> {
    return this.request(['v0', 'events', 'coming-soon', 'partnership', partnership], { ...options });
  }

  eventsByCity(cityId: string, partnership: string, options: LimitedEventOptions = {}): Promise<ListResponse<Event>> {
    return this.request(['v0', 'events', 'city', cityId, 'partnership', partnership], { ...options });
  }

  tags(): Promise<unknown> {
    return this.cached('tags', ['v0', 'tags', 'getAllTags']);
  }

  passportPromotion(): Promise<unknown> {
    return this.request(['v0', 'passport-promotion']);
  }

  theaters(partnership: string, options: PolicyOptions = {}): Promise<ListResponse<Theater>> {
    return this.request(['v0', 'theaters', 'partnership', partnership], { ...options });
  }

  theaterById(id: string, partnership: string, options: PolicyOptions = {}): Promise<Theater> {
    return this.request(['v0', 'theaters', id, 'partnership', partnership], { ...options });
  }

  theaterByUrlKey(key: string, partnership: string, options: PolicyOptions = {}): Promise<Theater> {
    return this.request(['v0', 'theaters', 'url-key', key, 'partnership', partnership], { ...options });
  }

  theatersByCity(cityId: string, partnership: string, options: PolicyOptions = {}): Promise<ListResponse<Theater>> {
    return this.request(['v0', 'theaters', 'city', cityId, 'partnership', partnership], { ...options });
  }

  sessionById(id: string, partnership: string, options: PolicyOptions = {}): Promise<Session> {
    return this.request(['v0', 'sessions', id, 'partnership', partnership], { ...options });
  }

  sessionExistsByUrlKey(urlKey: string): Promise<unknown> {
    return this.request(['v0', 'sessions', 'url-key', urlKey, 'exists']);
  }

  eventsByTag(
    tag: { tagName?: string; tagUrlKey?: string },
    partnership: string,
    options: EventOptions = {},
  ): Promise<ListResponse<Event>> {
    const selector = tag.tagName !== undefined ? 'tagName' : 'tagUrlKey';
    const value = tag.tagName ?? tag.tagUrlKey!;
    return this.request(['v0', 'events', selector, value, 'partnership', partnership], { ...options });
  }

  templates(
    kind: TemplateKind,
    partnership: string,
    cityId?: string,
    options: TemplateOptions = {},
  ): Promise<unknown> {
    const segments = ['v0', 'templates', kind];
    if (cityId !== undefined) {
      segments.push(cityId);
    }
    segments.push('partnership', partnership);
    const query: Query = {};
    if (kind !== 'premiere') {
      query.limit = options.limit;
    }
    if (kind === 'nowplaying') {
      query.skip = options.skip;
    }
    if (kind === 'highlights') {
      query.theatersIds = options.theatersIds;
      query.justEvents = options.justEvents;
    }
    return this.request(segments, query);
  }

  sessions(input: SessionsInput): Promise<unknown> {
    const segments = ['v0', 'sessions'];
    const query: Query = {};
    if (input.cityId !== undefined) {
      segments.push('city', input.cityId);
      query.date = input.date;
    }
    if (input.theaterId !== undefined) {
      segments.push('theater', input.theaterId);
    } else if (input.theaterUrlKey !== undefined) {
      segments.push('theater', 'url-key', input.theaterUrlKey);
    } else if (input.eventId !== undefined) {
      segments.push('event', input.eventId);
    } else {
      segments.push('event', 'url-key', input.eventUrlKey!);
    }
    segments.push('partnership', input.partnership);
    if (input.groupBySessionType) {
      segments.push('groupBy', 'sessionType');
    }
    if (input.cityId !== undefined && (input.eventId !== undefined || input.eventUrlKey !== undefined)) {
      query.includeOperationPolicies = input.includeOperationPolicies;
    }
    if (input.eventUrlKey !== undefined) {
      query.sessionTypeList = input.sessionTypeList;
      query.legendList = input.legendList;
    }
    return this.request(segments, query);
  }

  sessionDates(input: SessionDatesInput): Promise<unknown> {
    const selector = input.theaterId !== undefined ? 'theater' : 'event';
    const id = input.theaterId ?? input.eventId!;
    return this.request([
      'v0', 'sessions', 'city', input.cityId, selector, id,
      'dates', 'partnership', input.partnership,
    ]);
  }
}
