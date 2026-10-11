export interface City {
  id?: string | null;
  name?: string | null;
  uf?: string | null;
  urlKey?: string | null;
  [key: string]: unknown;
}

export interface State {
  name?: string | null;
  uf?: string | null;
  cities?: City[] | null;
  [key: string]: unknown;
}

export interface Event {
  id?: string | null;
  title?: string | null;
  urlKey?: string | null;
  [key: string]: unknown;
}

export interface Theater {
  id?: string | null;
  name?: string | null;
  urlKey?: string | null;
  [key: string]: unknown;
}

export interface Session {
  id?: string | null;
  event?: Event;
  theater?: Theater;
  [key: string]: unknown;
}

export interface ListResponse<T> {
  items?: T[] | null;
  count?: number;
  [key: string]: unknown;
}
