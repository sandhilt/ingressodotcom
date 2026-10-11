# ingressodotcom

Plugin do Claude Code (servidor MCP + skills) para consultar a [API de conteúdo do ingresso.com](https://api-content.ingresso.com/swagger/index.html): filmes em cartaz, estreias, cinemas, cidades e sessões.

> Somente leitura. O spec público (`v0`) tem 36 operações, todas `GET`; o `v1` está vazio. Não há compra de ingressos.

## Instalação

```
/plugin marketplace add sandhilt/ingressodotcom
/plugin install ingressodotcom@sandhilt-ingressodotcom
```

Requer Node >= 24 (TypeScript nativo, sem build).

## Ferramentas MCP (14)

`list_states`, `find_city`, `list_movies`, `search_events`, `get_event`, `get_event_credits`, `list_tags`, `list_theaters`, `get_theater`, `list_sessions`, `find_showtimes`, `list_session_dates`, `get_session`, `get_passport_promotion`.

Todas carregam `annotations` MCP derivadas do método HTTP (`readOnlyHint: true`, `destructiveHint: false`).

## Configuração (env)

| Variável | Padrão |
| --- | --- |
| `INGRESSO_PARTNERSHIP` | `1` (catálogo completo; `ingresso` é uma visão restrita) |
| `INGRESSO_BASE_URL` | `https://api-content.ingresso.com` |
| `INGRESSO_TIMEOUT_MS` | `15000` |

## Desenvolvimento

```
npm install
npm test
npm run typecheck
```

Arquitetura (Clean Architecture) e regras em [`AGENTS.md`](AGENTS.md) e [`docs/design.md`](docs/design.md).

## Licença

MIT
