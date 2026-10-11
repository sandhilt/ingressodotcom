export interface ShowtimesSelection {
  eventId?: string;
  title?: string;
  date?: string;
  includeSessions?: boolean;
}

interface SessionData {
  id: string;
  time: string;
  room?: string;
  type: string[];
  price: number | null;
  siteURL: string;
}

interface MovieData {
  id: string;
  title: string;
  originalTitle?: string;
  rooms?: Array<{ name: string; sessions?: SessionData[] }>;
}

interface DayData {
  date: string;
  dayOfWeek: string;
  movies?: MovieData[];
}

interface SessionSummary {
  id: string;
  time: string;
  room: string;
  type: string[];
  price: number | null;
  checkoutUrl: string;
}

interface DaySummary {
  date: string;
  dayOfWeek: string;
  sessionCount: number;
  priceMin: number | null;
  priceMax: number | null;
  formats: string[];
  sessions?: SessionSummary[];
}

const availabilityNote = 'A API pública informa preço por sessão, mas não disponibilidade de assentos.';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Pure projection of the theater-session payload; does not mutate upstream data. */
export function summarizeShowtimes(payload: unknown, input: ShowtimesSelection) {
  const source: DayData[] = Array.isArray(payload) ? payload : [];
  const candidates = new Map<string, { id: string; title: string }>();
  for (const day of source) {
    for (const movie of day.movies ?? []) {
      const matches = input.eventId !== undefined
        ? movie.id === input.eventId
        : [movie.title, movie.originalTitle ?? ''].some(title => normalize(title).includes(normalize(input.title ?? '')));
      if (matches) candidates.set(movie.id, { id: movie.id, title: movie.title });
    }
  }
  if (candidates.size > 1) {
    return {
      matches: [...candidates.values()],
      note: `Mais de um filme corresponde ao título; escolha um eventId. ${availabilityNote}`,
    };
  }

  const event = candidates.values().next().value ?? { id: input.eventId ?? '', title: input.title ?? '' };
  const grouped = new Map<string, { dayOfWeek: string; sessions: SessionSummary[] }>();
  for (const day of source) {
    if (input.date !== undefined && day.date !== input.date) continue;
    for (const movie of day.movies ?? []) {
      if (movie.id !== event.id) continue;
      for (const room of movie.rooms ?? []) {
        for (const session of room.sessions ?? []) {
          let group = grouped.get(day.date);
          if (!group) {
            group = { dayOfWeek: day.dayOfWeek, sessions: [] };
            grouped.set(day.date, group);
          }
          group.sessions.push({
            id: session.id,
            time: session.time,
            room: session.room ?? room.name,
            type: [...(session.type ?? [])],
            price: typeof session.price === 'number' && Number.isFinite(session.price) ? session.price : null,
            checkoutUrl: session.siteURL,
          });
        }
      }
    }
  }
  const days: DaySummary[] = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => {
    const prices = group.sessions.flatMap(session => session.price === null ? [] : [session.price]);
    return {
      date,
      dayOfWeek: group.dayOfWeek,
      sessionCount: group.sessions.length,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      formats: [...new Set(group.sessions.map(session => [...new Set(session.type)].sort().join(' / ')))],
      ...(input.includeSessions ? { sessions: group.sessions } : {}),
    };
  });
  return {
    event,
    days,
    note: `${days.length ? '' : 'Nenhuma sessão encontrada para este filme no cinema e período consultados. '}${availabilityNote}`,
  };
}
