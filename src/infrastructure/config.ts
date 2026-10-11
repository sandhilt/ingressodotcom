import { DEFAULT_PARTNERSHIP } from '../application/usecases/Deps.ts';

export interface IngressoConfig {
  baseUrl: string;
  partnership: string;
  timeoutMs: number;
}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): IngressoConfig {
  const timeoutMs = env.INGRESSO_TIMEOUT_MS === undefined
    ? 15_000
    : Number(env.INGRESSO_TIMEOUT_MS);

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 4_294_967_295) {
    throw new Error('INGRESSO_TIMEOUT_MS must be a positive integer within the timer range');
  }

  const baseUrl = env.INGRESSO_BASE_URL ?? 'https://api-content.ingresso.com';
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error('INGRESSO_BASE_URL must be an HTTP(S) URL without query or fragment');
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    partnership: env.INGRESSO_PARTNERSHIP ?? DEFAULT_PARTNERSHIP,
    timeoutMs,
  };
}
