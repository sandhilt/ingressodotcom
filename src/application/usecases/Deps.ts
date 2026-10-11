import type { ContentGateway } from '../ports/ContentGateway.ts';
import { InvalidInputError } from '../../domain/errors.ts';
// "ingresso" is a restricted partner view (e.g. 4 theaters in total); "1" is the full catalog.
export const DEFAULT_PARTNERSHIP = '1';

export interface Deps {
  gateway: ContentGateway;
  config?: {
    partnership?: string;
  };
}

export interface PartnershipInput {
  partnership?: string;
}

export function partnership(deps: Deps, input: PartnershipInput): string {
  const value = input.partnership ?? deps.config?.partnership ?? DEFAULT_PARTNERSHIP;
  text(value, 'partnership');
  return value;
}

export function text(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvalidInputError(`${field} must be non-empty`);
  }
}

export function exactlyOne(input: object, keys: string[]): void {
  const values = input as Record<string, unknown>;
  if (keys.filter(key => values[key] !== undefined).length !== 1) {
    throw new InvalidInputError(`Provide exactly one of ${keys.join(', ')}`);
  }
  for (const key of keys) {
    if (values[key] !== undefined) {
      text(values[key] as string, key);
    }
  }
}
