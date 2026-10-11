# Design

Read `AGENTS.md` first (stack + layer rules). Spec: `docs/samples/swagger-v0.json` (36 GET operations, base URL `https://api-content.ingresso.com`, no auth required). Responses are plain JSON; keep them loosely typed (only type fields the tools need, pass the rest through).

## Domain (`src/domain/`)
- `HttpMethod`, `OperationSafety` = `{ readOnly, destructive, idempotent }` and `classifyMethod(method)`: GET/HEAD/OPTIONS -> readOnly+idempotent; PUT/DELETE -> destructive+idempotent; POST/PATCH -> destructive, not idempotent. Unknown -> destructive.
- Entity types: `City`, `State`, `Event`, `Theater`, `Session` (minimal fields, index signature for the rest).
- Errors: `NotFoundError`, `UpstreamError` (status, body excerpt), `InvalidInputError`.

## Application (`src/application/`)
- `ports/ContentGateway.ts`: one method per upstream concern, all take already-validated plain args and return parsed JSON (`unknown`-ish domain types). All methods that need it accept `partnership: string`.
  states(), stateByUf(uf), cityById(id), cityByUrlKey(key), cityByTheaterSlug(slug), citiesNear(lat, long),
  events(partnership), eventsByTag(tagName|tagUrlKey), eventById(id), eventByUrlKey(key), eventCredits(id), eventsComingSoon(), eventsByCity(cityId),
  tags(), passportPromotion(),
  templates(kind: 'nowplaying'|'soon'|'highlights'|'premiere', cityId?),
  theaters(), theaterById(id), theaterByUrlKey(key), theatersByCity(cityId),
  sessionById(id), sessions({ cityId?, theaterId?|theaterUrlKey?, eventId?|eventUrlKey?, groupBySessionType?, date? }), sessionDates({ cityId, theaterId?|eventId? }), sessionExistsByUrlKey(urlKey).
  Check the swagger for exact paths and query params (e.g. date filters) — do not guess.
- `usecases/`: thin functions `(deps, input) => Promise<result>` that apply defaults (partnership), validate invariants, and call the gateway. Add `findCity({ name?, uf?, lat?, long?, id?, urlKey?, theaterSlug? })` which resolves a city by whichever input is given (name = case/accent-insensitive search over `states()`).

## Infrastructure (`src/infrastructure/`)
- `http/IngressoHttpGateway.ts` implements `ContentGateway` with global `fetch`, `AbortSignal.timeout` (default 15 s, env `INGRESSO_TIMEOUT_MS`), `encodeURIComponent` on every path segment, 404 -> `NotFoundError`, other non-2xx -> `UpstreamError`, small in-memory TTL cache (60 s) for `states()` and `tags()` only.
- `config.ts`: reads env `INGRESSO_BASE_URL` (default `https://api-content.ingresso.com`), `INGRESSO_PARTNERSHIP` (default `1`), `INGRESSO_TIMEOUT_MS`.

## Interface (`src/interface/mcp/`)
- `ToolDefinition` = `{ name, title, description, inputSchema (zod `z.object`), operations: Array<{method, path}>, handler(input) }`. `annotations` are DERIVED: `readOnlyHint`/`destructiveHint`/`idempotentHint` from `classifyMethod` over `operations` (readOnly only if all are), `openWorldHint: true`.
- `server.ts`: builds `McpServer` from `@modelcontextprotocol/server` v2 (`registerTool` with `inputSchema: z.object({...})`, raw shapes are deprecated; stdio entry via `serveStdio(createServer)` from `@modelcontextprotocol/server/stdio` (factory must be cheap and side-effect free), as in the SDK `examples/server-quickstart`), registers all tools, maps domain errors to `{ isError: true, content: [{type:'text', text}] }`, returns JSON text content (compact, truncate arrays over ~50 items with a note saying how many were dropped, to protect model context). stdio via `StdioServerTransport`. Never write to stdout except through the transport (log to stderr).
- Tools (snake_case, Portuguese-friendly descriptions mentioning that content is pt-BR/Brazil):
  `list_states`, `find_city`, `list_movies` (category: nowplaying|soon|highlights|premiere, optional cityId), `search_events` (by tagName | tagUrlKey | cityId | comingSoon | all), `get_event` (id | urlKey), `get_event_credits`, `list_tags`, `list_theaters` (all | cityId), `get_theater` (id | urlKey), `find_showtimes` (cityId + theaterId|theaterUrlKey e eventId|title, date opcional, includeSessions padrão false), `list_sessions` (cityId + theaterId|theaterUrlKey|eventId|eventUrlKey, optional groupBySessionType, date), `list_session_dates`, `get_session`, `get_passport_promotion`.
  Every tool takes optional `partnership`.

## Composition (`src/main.ts`)
Shebang-less ESM entry; loads config, builds gateway, use cases, tools, starts the stdio server. Must work with `node src/main.ts`.

## Tests (`test/`, `node:test` + `node:assert/strict`)
- domain: `classifyMethod`.
- application: use cases with an in-memory fake gateway (incl. `findCity` accent-insensitive search).
- infrastructure: gateway with stubbed `globalThis.fetch` (URL building/encoding, 404, 500, timeout, cache).
- interface: every tool has full annotations and none is destructive; truncation; error mapping; an end-to-end test spawning `node src/main.ts` with `INGRESSO_BASE_URL` pointing at a local `node:http` stub server and speaking MCP over stdio (initialize, tools/list, tools/call) using `Client` + `StdioClientTransport` from `@modelcontextprotocol/client` (and `/stdio`).

## Plugin packaging (done by coordinator, not part of Codex tasks)
`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.mcp.json`, `skills/`, `README.md`.

## Resumo de sessões
As 14 ferramentas incluem `find_showtimes`: o caso de uso usa apenas as rotas GET de sessões de um cinema. `summarizeShowtimes` é uma função pura que resolve o filme por ID ou trecho do título/título original sem acentos ou distinção de maiúsculas, retorna `matches` sem sessões quando há ambiguidade e agrupa contagens, preços e combinações de tipos por dia. Detalhes individuais são opcionais; resultados vazios são amigáveis. A API informa preços por sessão, mas não disponibilidade de assentos.
