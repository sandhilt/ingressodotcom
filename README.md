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

Segundo a [matriz oficial de suporte a plugins](https://claude.com/docs/plugins/platform-support):

| Superfície | Skill | Ferramentas MCP (servidor local, `node`) |
| --- | --- | --- |
| Claude Code (terminal, IDE, aba Code do app desktop), com Node 24+ no PATH | sim | sim |
| Cowork (app desktop), sessão rodando no seu computador | sim | sim, com Node 24+ no PATH |
| Chat (claude.ai web, chat do app desktop e mobile) | sim | **não**: servidores MCP locais de plugin são ignorados |

Para usar no Chat seria preciso um servidor MCP remoto (HTTP) adicionado como conector, que este repositório ainda não oferece.

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

Com Nix, o `flake.nix` e o `.envrc` fornecem o Node 24: rode `direnv allow` (ou `nix develop`).

### Testar o servidor MCP com o Inspector

Na raiz do repositório, com Node 24:

```
npx @modelcontextprotocol/inspector node src/main.ts
```

Ele imprime uma URL local (`http://127.0.0.1:6274?...`) e abre o navegador. Em **Tools**, liste as ferramentas (cada uma deve mostrar `readOnlyHint: true`) e chame uma, por exemplo `find_city` com `name: "Rio de Janeiro"`.

Sem navegador, pelo modo CLI:

```
npx @modelcontextprotocol/inspector --cli node src/main.ts --method tools/list
npx @modelcontextprotocol/inspector --cli node src/main.ts --method tools/call \
  --tool-name find_city --tool-arg name="Rio de Janeiro" --tool-arg uf=RJ
```

Dicas:

- Para testar outro catálogo, defina a variável: `INGRESSO_PARTNERSHIP=ingresso npx @modelcontextprotocol/inspector node src/main.ts`.
- Sem keychain do sistema (como no WSL), o Inspector grava o token da sessão em `~/.mcp-inspector/secrets.json`. Use `MCP_INSPECTOR_SECRET_STORE=memory` para não deixar nada em disco.
- O Inspector escreve avisos no stderr. Se encadear com `jq`, descarte-o (`2>/dev/null`).

Arquitetura (Clean Architecture) e regras em [`AGENTS.md`](AGENTS.md) e [`docs/design.md`](docs/design.md).

## Licença

MIT
