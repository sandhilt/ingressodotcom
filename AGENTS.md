# AGENTS.md

MCP server + Claude Code plugin for the public ingresso.com content API
(`https://api-content.ingresso.com`, spec: `/swagger/v0/swagger.json`; `v1` is empty).

## Stack
- Node >= 24, TypeScript run natively (type stripping, no build step). Use `node src/main.ts`.
- Because of type stripping: no `enum`, no `namespace`, no constructor parameter properties; import local files with the `.ts` extension; use `import type` for types.
- Runtime deps are limited to the MCP SDK v2 (`@modelcontextprotocol/server`; `@modelcontextprotocol/client` is a devDependency for tests only) and `zod` (>=4.2, imported as `import * as z from "zod/v4"`). Do NOT use the v1 `@modelcontextprotocol/sdk` package. Everything else must be Node built-ins (`fetch`, `node:test`, `node:assert`, ...). Do not add dependencies without asking.
- Tests use `node:test` only: `npm test`. Type check: `npm run typecheck`.

## Architecture (Clean Architecture)
Dependencies point inward only: `interface` -> `application` -> `domain`; `infrastructure` -> `application` (implements ports) -> `domain`.

- `src/domain/` — entities, value objects, domain errors, operation safety classification. No I/O, no imports from other layers.
- `src/application/` — use cases (`usecases/`) and ports (`ports/`, e.g. `ContentGateway`). Depends on domain only.
- `src/infrastructure/` — adapters implementing ports (`http/` = fetch-based gateway, config from env).
- `src/interface/mcp/` — MCP tool definitions (name, zod input schema, annotations, handler -> use case), server wiring, error mapping. No business logic.
- `src/main.ts` — composition root; the only place that wires layers together.
- `test/` mirrors `src/`. Domain/application tests use in-memory fakes of the ports; infrastructure tests stub `fetch`; never hit the real API in tests.

## MCP tool rules
- Every tool MUST set `annotations`: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` (and a human `title`). The values come from the domain safety classification of the underlying HTTP method, never hand-picked per tool.
- Today all 36 API operations are `GET` => every tool is `readOnlyHint: true, destructiveHint: false`. Any future write operation must be classified `destructive` unless proven otherwise and documented in `docs/safety.md`.
- `partnership` is an optional tool arg; default from `INGRESSO_PARTNERSHIP` env, else `1`. It is NOT irrelevant: `ingresso` returns a restricted catalog (4 theaters vs 443; 0 theaters in Curitiba vs 16), while `1` and unknown values like `web` return the full one.

## Workflow
- Claude coordinates and reviews; Codex (`codex:codex-rescue`) is the companion that reads/writes code per layer. Cross-check Codex output against the code before accepting.
- Commits in English. Never include session links in commits/PRs.

## Releases
- Bump the version on EVERY release that changes behavior, in all three places, in the same commit: `package.json` and `package-lock.json` (`npm version <x.y.z> --no-git-tag-version`) plus `.claude-plugin/plugin.json`. The MCP server reads its version from `package.json` in `src/main.ts`; `test/release.test.ts` fails if the three files disagree. Claude Code caches installed plugins by version, so without a bump users never receive the update.
- Use semver (new tool or option = minor, fix = patch). Tag the release (`vX.Y.Z`) and push the tag.
- After pushing, update the installed copy with `claude plugin update ingressodotcom@sandhilt-ingressodotcom`.
