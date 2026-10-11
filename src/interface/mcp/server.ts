import { McpServer } from '@modelcontextprotocol/server';
import type { Deps } from '../../application/usecases/Deps.ts';
import { InvalidInputError, NotFoundError, UpstreamError } from '../../domain/errors.ts';
import type { ToolDefinition } from './ToolDefinition.ts';
import { DEFAULT_OUTPUT_PAGE_LIMIT, deriveAnnotations } from './ToolDefinition.ts';
import { createTools } from './tools.ts';

const OUTPUT_BUDGET = 100_000;
const NARROW_QUERY = 'Output truncated. Narrow the query by city, theater, event or date, or request fewer results.';

/** Bound JSON output without mutating upstream results. */
function serialize(value: unknown, pageLimit = DEFAULT_OUTPUT_PAGE_LIMIT): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const result = value as Record<string, unknown>;
    if (Array.isArray(result.items) && result.items.length === 0 && result.count === 0) {
      value = { ...result, note: 'Nenhum resultado encontrado. Tente outra data ou outros filtros.' };
    }
  }
  let truncated = false;
  let dropped = 0;
  function reduce(item: unknown, arrayLimit: number, stringLimit: number): unknown {
    if (Array.isArray(item)) {
      if (item.length > arrayLimit) {
        truncated = true;
        dropped += item.length - arrayLimit;
      }
      return item.slice(0, arrayLimit).map(child => reduce(child, arrayLimit, stringLimit));
    }
    if (item !== null && typeof item === 'object') {
      const entries = Object.entries(item).flatMap(([key, child]) => {
        if (typeof child === 'string' && child.length > stringLimit) {
          truncated = true;
          return [];
        }
        return [[key, reduce(child, arrayLimit, stringLimit)]];
      });
      return Object.fromEntries(entries);
    }
    if (typeof item === 'string' && item.length > stringLimit) {
      truncated = true;
      return null;
    }
    return item;
  }
  function encode(data: unknown): string {
    const note = dropped > 0
      ? `${dropped} items dropped; arrays limited to ${pageLimit} items. ${NARROW_QUERY}`
      : NARROW_QUERY;
    return JSON.stringify(truncated ? { data, note } : data ?? null);
  }
  for (const limit of [pageLimit, 25, 10, 5, 1]) {
    dropped = 0;
    const output = encode(reduce(value, limit, Infinity));
    if (output.length <= OUTPUT_BUDGET) {
      return output;
    }
    truncated = true;
  }
  for (const limit of [10_000, 1_000, 100, 0]) {
    dropped = 0;
    const output = encode(reduce(value, 1, limit));
    if (output.length <= OUTPUT_BUDGET) {
      return output;
    }
  }
  return JSON.stringify({ data: null, note: NARROW_QUERY });
}

function errorMessage(error: unknown): string {
  if (error instanceof InvalidInputError) {
    return `Invalid input: ${error.message}`;
  }
  if (error instanceof NotFoundError) {
    return `Not found: ${error.message}`;
  }
  if (error instanceof UpstreamError) {
    return `Upstream request failed (${error.status}).`;
  }
  return 'An unexpected error occurred.';
}

export function createServer(
  deps: Deps,
  tools: ToolDefinition[] = createTools(deps),
  version = '0.0.0-dev',
): McpServer {
  const server = new McpServer({ name: 'ingressodotcom', version });
  for (const tool of tools) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: deriveAnnotations(tool),
    }, async input => {
      try {
        const result = await tool.handler(input);
        return { content: [{ type: 'text', text: serialize(result, tool.outputPageLimit) }] };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: errorMessage(error) }] };
      }
    });
  }
  return server;
}

