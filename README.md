# ingressodotcom

Plugin do Claude Code (servidor MCP + skills) para consultar a [API de conteúdo do ingresso.com](https://api-content.ingresso.com/swagger/index.html): filmes em cartaz, estreias, cinemas, cidades e sessões.

> Somente leitura. O spec público (`v0`) tem 36 operações, todas `GET`; o `v1` está vazio. Não há compra de ingressos.

## Instalação

```
/plugin marketplace add sandhilt/ingressodotcom
/plugin install ingressodotcom@sandhilt-ingressodotcom
```

Requer Node >= 24 (TypeScript nativo, sem build).

## Onde funciona

- **Claude Code** (terminal, extensões de IDE) com **Node 24+** no PATH: skill e ferramentas MCP.
- **claude.ai (chat web)**: só a skill é carregada; o servidor MCP local **não** é iniciado e as ferramentas não aparecem (verificado em teste). Para esse ambiente seria preciso um servidor MCP remoto (HTTP), que este repositório ainda não oferece.
- Claude Desktop e Cowork: não verificado.

## Ferramentas MCP (14)

`list_states`, `find_city`, `list_movies`, `search_events`, `get_event`, `get_event_credits`, `list_tags`, `list_theaters`, `get_theater`, `list_sessions`, `find_showtimes`, `list_session_dates`, `get_session`, `get_passport_promotion`.

Todas carregam `annotations` MCP derivadas do método HTTP (`readOnlyHint: true`, `destructiveHint: false`).

## Listas de filmes

`list_movies` e `search_events` retornam resumos por padrão (`compact: true`), sem sinopses, imagens ou trailers. `compact: false` retorna eventos completos; para detalhes de um filme, prefira `get_event`.

`sort: "popularity"` (padrão) ordena por `showSize` (`countIsPlaying`, tamanho de exibição) decrescente e depois título; `sort: "api"` preserva a ordem da API. A página tem `limit: 40` por padrão (1–200) e retorna `total`, `returned`, `skip`, `hasMore`, `nextSkip` quando aplicável, `items` e `note`. Quando `hasMore`, repita os filtros com `skip: nextSkip`.

Em `list_movies`, `skip` continua exclusivo de `nowplaying`; outras categorias aceitam `limit`, mas não `skip`. O caso de uso busca todas as páginas de `nowplaying` (100 eventos por chamada, até 20 páginas) antes de ordenar e paginar; exceder esse teto causa erro explícito. Outras categorias são buscadas uma vez. `search_events` pagina somente a lista recebida da API. `limit` e `skip` das ferramentas não são repassados como paginação da API. Resultados completos ainda estão sujeitos ao orçamento de saída.

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
