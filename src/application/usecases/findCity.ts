import type { Deps } from './Deps.ts';
import type { NearOptions } from '../ports/ContentGateway.ts';
import { text } from './Deps.ts';
import { InvalidInputError, NotFoundError } from '../../domain/errors.ts';

export interface FindCityInput extends NearOptions {
  name?: string;
  uf?: string;
  lat?: number;
  long?: number;
  id?: string;
  urlKey?: string;
  theaterSlug?: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}


export async function findCity(deps: Deps, input: FindCityInput) {
  const coordinates = input.lat !== undefined || input.long !== undefined;
  if (['name', 'id', 'urlKey', 'theaterSlug'].filter(key => input[key as keyof FindCityInput] !== undefined).length + Number(coordinates) !== 1) {
    throw new InvalidInputError('Provide one city selector');
  }
  if (input.uf !== undefined) {
    text(input.uf, 'uf');
    if (input.name === undefined) {
      throw new InvalidInputError('uf requires name');
    }
  }
  if (input.id !== undefined) {
    text(input.id, 'id');
    return deps.gateway.cityById(input.id);
  }
  if (input.urlKey !== undefined) {
    text(input.urlKey, 'urlKey');
    return deps.gateway.cityByUrlKey(input.urlKey);
  }
  if (input.theaterSlug !== undefined) {
    text(input.theaterSlug, 'theaterSlug');
    return deps.gateway.cityByTheaterSlug(input.theaterSlug);
  }
  if (coordinates) {
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.long) || Math.abs(input.lat!) > 90 || Math.abs(input.long!) > 180) {
      throw new InvalidInputError('Provide valid lat and long');
    }
    if (input.radiusInKilometers !== undefined && (!Number.isFinite(input.radiusInKilometers) || input.radiusInKilometers <= 0)) {
      throw new InvalidInputError('Invalid radius');
    }
    if (input.resultCount !== undefined && (!Number.isInteger(input.resultCount) || input.resultCount <= 0)) {
      throw new InvalidInputError('Invalid resultCount');
    }
    return deps.gateway.citiesNear(input.lat!, input.long!, {
      radiusInKilometers: input.radiusInKilometers,
      resultCount: input.resultCount,
    });
  }
  text(input.name!, 'name');
  const cities = (await deps.gateway.states())
    .filter(state => !input.uf || normalize(state.uf ?? '') === normalize(input.uf))
    .flatMap(state => state.cities ?? [])
    .filter(city => normalize(city.name ?? '') === normalize(input.name!));
  if (!cities.length) {
    throw new NotFoundError('City not found');
  }
  return cities;
}
