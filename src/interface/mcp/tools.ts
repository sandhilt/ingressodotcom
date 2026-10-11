import * as z from 'zod/v4';
import * as usecases from '../../application/usecases/index.ts';
import { DEFAULT_PARTNERSHIP } from '../../application/usecases/Deps.ts';
import type { Deps } from '../../application/usecases/Deps.ts';
import type { ToolDefinition } from './ToolDefinition.ts';

const guidance: Record<string, string> = {
  list_states: 'Consulte estados e suas cidades.',
  find_city: 'Busque por name com uf opcional; nunca por uf sozinho. Ou use ID, urlKey, coordenadas ou slug de cinema.',
  list_movies: 'Use cityId; apenas nowplaying permite omiti-lo.',
  search_events: 'Escolha tagName, tagUrlKey, cityId, comingSoon ou all; limit exige cityId ou comingSoon.',
  get_event: 'Informe id ou urlKey do evento.',
  get_event_credits: 'Informe o ID numérico do evento para consultar elenco e equipe.',
  list_tags: 'Consulte categorias antes de filtrar eventos.',
  list_theaters: 'Use cityId para limitar os cinemas à cidade.',
  get_theater: 'Informe id ou urlKey do cinema.',
  list_sessions: 'Escolha um cinema ou evento. groupBySessionType exige cityId e theaterId ou eventId; use date no formato YYYY-MM-DD.',
  list_session_dates: 'Informe cityId obrigatório e theaterId ou eventId para consultar dias disponíveis.',
  get_session: 'Use um ID obtido ao listar sessões.',
  get_passport_promotion: 'Consulte a promoção de passaporte disponível.',
};

function define<S extends z.ZodRawShape>(
  name: string,
  title: string,
  inputSchema: S,
  paths: string[],
  handler: (input: z.infer<z.ZodObject<S>>) => Promise<unknown>,
): ToolDefinition {
  const schema = z.object({
    ...inputSchema,
    partnership: z.string().optional().describe(
      `Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`,
    ),
  });
  return {
    name,
    title,
    description: `${guidance[name]} ${title} na API ingresso.com, com conteúdo em pt-BR para o Brasil. Escolha apenas um seletor quando houver alternativas.`,
    inputSchema: schema,
    operations: paths.map(path => ({ method: 'GET', path })),
    handler: input => handler(z.object(inputSchema).parse(input)),
  };
}

export function createTools(deps: Deps): ToolDefinition[] {
  return [
    define('list_states', 'Listar estados', {
    }, [
      '/v0/states',
    ], () => usecases.listStates(deps)),
    define('find_city', 'Encontrar cidade', {
      name: z.string().optional().describe("Nome da cidade, com busca sem distinção de acentos ou maiúsculas."),
      uf: z.string().optional().describe("UF para restringir a busca por nome."),
      lat: z.number().optional().describe("Latitude da localização, usada junto com long."),
      long: z.number().optional().describe("Longitude, enviada como lng à API."),
      id: z.string().optional().describe("Identificador do recurso."),
      urlKey: z.string().optional().describe("Chave de URL do recurso, alternativa ao ID."),
      theaterSlug: z.string().optional().describe("Slug do cinema para resolver a cidade."),
      radiusInKilometers: z.number().optional().describe("Raio em quilômetros para a busca por coordenadas."),
      resultCount: z.number().optional().describe("Quantidade de cidades retornadas pela busca por coordenadas."),
    }, [
      '/v0/states',
      '/v0/states/city/{id}',
      '/v0/states/city/name/{urlKey}',
      '/v0/states/city/latlong',
      '/v0/states/city/theater/{theaterSlug}',
    ], input => usecases.findCity(deps, input)),
    define('list_movies', 'Listar filmes', {
      category: z.enum(['nowplaying', 'soon', 'highlights', 'premiere']).describe("Categoria: nowplaying, soon, highlights ou premiere; todas exceto nowplaying exigem cityId."),
      cityId: z.string().optional().describe("ID da cidade; opcional apenas em nowplaying."),
      partnership: z.string().optional().describe(`Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`),
      limit: z.number().optional().describe("Limite de resultados nas rotas que aceitam paginação."),
      skip: z.number().optional().describe("Quantidade de resultados a pular; somente nowplaying."),
      theatersIds: z.string().optional().describe("IDs de cinemas para highlights, no formato aceito pela API."),
      justEvents: z.boolean().optional().describe("Retornar apenas eventos; somente highlights."),
    }, [
      '/v0/templates/soon/{cityId}/partnership/{partnership}',
      '/v0/templates/highlights/{cityId}/partnership/{partnership}',
      '/v0/templates/nowplaying/partnership/{partnership}',
      '/v0/templates/nowplaying/{cityId}/partnership/{partnership}',
      '/v0/templates/premiere/{cityId}/partnership/{partnership}',
    ], input => usecases.listMovies(deps, input)),
    define('search_events', 'Buscar eventos', {
      tagName: z.string().optional().describe("Nome da categoria de eventos."),
      tagUrlKey: z.string().optional().describe("Chave de URL da categoria de eventos."),
      cityId: z.string().optional().describe("ID da cidade para filtrar os resultados."),
      comingSoon: z.boolean().optional().describe("Consultar próximos lançamentos, sem outro seletor."),
      all: z.boolean().optional().describe("Consultar todos os eventos, sem outro seletor."),
      partnership: z.string().optional().describe(`Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`),
      includeCities: z.boolean().optional().describe("Incluir cidades nos eventos retornados."),
      limit: z.number().optional().describe("Limite de resultados nas rotas que aceitam paginação."),
    }, [
      '/v0/events/partnership/{partnership}',
      '/v0/events/tagName/{tagName}/partnership/{partnership}',
      '/v0/events/tagUrlKey/{tagUrlKey}/partnership/{partnership}',
      '/v0/events/coming-soon/partnership/{partnership}',
      '/v0/events/city/{cityId}/partnership/{partnership}',
    ], input => usecases.searchEvents(deps, input)),
    define('get_event', 'Consultar evento', {
      id: z.string().optional().describe("Identificador do recurso."),
      urlKey: z.string().optional().describe("Chave de URL do recurso, alternativa ao ID."),
      partnership: z.string().optional().describe(`Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`),
      includeCities: z.boolean().optional().describe("Incluir cidades nos eventos retornados."),
    }, [
      '/v0/events/{id}/partnership/{partnership}',
      '/v0/events/url-key/{urlKey}/partnership/{partnership}',
    ], input => usecases.getEvent(deps, input)),
    define('get_event_credits', 'Consultar créditos', {
      id: z.number().describe("Identificador do recurso."),
      castLimit: z.number().optional().describe("Limite de integrantes do elenco."),
      crewLimit: z.number().optional().describe("Limite de integrantes da equipe."),
    }, [
      '/v0/events/{id}/credits',
    ], input => usecases.getEventCredits(deps, input)),
    define('list_tags', 'Listar categorias', {
    }, [
      '/v0/tags/getAllTags',
    ], () => usecases.listTags(deps)),
    define('list_theaters', 'Listar cinemas', {
      cityId: z.string().optional().describe("ID da cidade para filtrar os resultados."),
      partnership: z.string().optional().describe(`Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`),
      includeOperationPolicies: z.boolean().optional().describe("Incluir políticas de operação do cinema."),
    }, [
      '/v0/theaters/partnership/{partnership}',
      '/v0/theaters/city/{cityId}/partnership/{partnership}',
    ], input => usecases.listTheaters(deps, input)),
    define('get_theater', 'Consultar cinema', {
      id: z.string().optional().describe("Identificador do recurso."),
      urlKey: z.string().optional().describe("Chave de URL do recurso, alternativa ao ID."),
      partnership: z.string().optional().describe(`Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`),
      includeOperationPolicies: z.boolean().optional().describe("Incluir políticas de operação do cinema."),
    }, [
      '/v0/theaters/{id}/partnership/{partnership}',
      '/v0/theaters/url-key/{urlKey}/partnership/{partnership}',
    ], input => usecases.getTheater(deps, input)),
    define('list_sessions', 'Listar sessões', {
      cityId: z.string().optional().describe("ID da cidade; opcional apenas para eventId sem data, agrupamento ou políticas."),
      theaterId: z.string().optional().describe("ID do cinema, alternativa aos outros seletores."),
      theaterUrlKey: z.string().optional().describe("Chave de URL do cinema, alternativa aos outros seletores."),
      eventId: z.string().optional().describe("ID do evento, alternativa aos outros seletores."),
      eventUrlKey: z.string().optional().describe("Chave de URL do evento, alternativa aos outros seletores."),
      partnership: z.string().optional().describe(`Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`),
      groupBySessionType: z.boolean().optional().describe("Agrupar por tipo de sessão; exige ID de cinema ou evento."),
      date: z.string().optional().describe("Data no formato YYYY-MM-DD."),
      includeOperationPolicies: z.boolean().optional().describe("Incluir políticas de operação do cinema."),
      sessionTypeList: z.string().optional().describe("Filtro de tipos de sessão; somente com eventUrlKey."),
      legendList: z.string().optional().describe("Filtro de legendas; somente com eventUrlKey."),
    }, [
      '/v0/sessions/city/{cityId}/theater/{theaterId}/partnership/{partnership}',
      '/v0/sessions/city/{cityId}/theater/{theaterId}/partnership/{partnership}/groupBy/sessionType',
      '/v0/sessions/city/{cityId}/theater/url-key/{theaterUrlKey}/partnership/{partnership}',
      '/v0/sessions/city/{cityId}/event/{eventId}/partnership/{partnership}',
      '/v0/sessions/city/{cityId}/event/{eventId}/partnership/{partnership}/groupBy/sessionType',
      '/v0/sessions/event/{eventId}/partnership/{partnership}',
      '/v0/sessions/city/{cityId}/event/url-key/{eventUrlKey}/partnership/{partnership}',
    ], input => usecases.listSessions(deps, input)),
    define('list_session_dates', 'Listar datas de sessões', {
      cityId: z.string().describe("ID obrigatório da cidade."),
      theaterId: z.string().optional().describe("ID do cinema, alternativa aos outros seletores."),
      eventId: z.string().optional().describe("ID do evento, alternativa aos outros seletores."),
      partnership: z.string().optional().describe(`Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`),
    }, [
      '/v0/sessions/city/{cityId}/theater/{theaterId}/dates/partnership/{partnership}',
      '/v0/sessions/city/{cityId}/event/{eventId}/dates/partnership/{partnership}',
    ], input => usecases.listSessionDates(deps, input)),
    define('get_session', 'Consultar sessão', {
      id: z.string().describe("Identificador do recurso."),
      partnership: z.string().optional().describe(`Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`),
      includeOperationPolicies: z.boolean().optional().describe("Incluir políticas de operação do cinema."),
    }, [
      '/v0/sessions/{id}/partnership/{partnership}',
    ], input => usecases.getSession(deps, input)),
    define('get_passport_promotion', 'Consultar promoção Passaporte', {
    }, [
      '/v0/passport-promotion',
    ], () => usecases.getPassportPromotion(deps)),
  ];
}
