import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_INT32, TEMPLATE_KINDS } from '../../application/eventLimits.ts';
import * as z from 'zod/v4';
import * as usecases from '../../application/usecases/index.ts';
import { DEFAULT_PARTNERSHIP } from '../../application/usecases/Deps.ts';
import type { Deps } from '../../application/usecases/Deps.ts';
import type { ToolDefinition } from './ToolDefinition.ts';

const guidance: Record<string, string> = {
  list_states: 'Consulte estados e suas cidades.',
  find_city: 'Busque por name com uf opcional; nunca por uf sozinho. Ou use ID, urlKey, coordenadas ou slug de cinema.',
  list_movies: 'Use cityId; apenas nowplaying permite omiti-lo. Resumo compacto por padrão, ordenado por tamanho de exibição (popularity). limit e skip paginam a lista ordenada; quando hasMore, repita com nextSkip.',
  search_events: 'Escolha tagName, tagUrlKey, cityId, comingSoon ou all. Resumo compacto por padrão; sort, limit e skip ordenam e paginam a lista recebida. Quando hasMore, repita com nextSkip.',
  get_event: 'Informe id ou urlKey do evento.',
  get_event_credits: 'Informe o ID numérico do evento para consultar elenco e equipe.',
  list_tags: 'Consulte categorias antes de filtrar eventos.',
  list_theaters: 'Use cityId para limitar os cinemas à cidade.',
  get_theater: 'Informe id ou urlKey do cinema.',
  find_showtimes: 'Informe cidade, cinema e filme para resumir sessões e preços; não informa disponibilidade de assentos.',
  list_sessions: 'Escolha um cinema ou evento. groupBySessionType exige cityId e theaterId ou eventId; use date no formato YYYY-MM-DD.',
  list_session_dates: 'Informe cityId obrigatório e theaterId ou eventId para consultar dias disponíveis.',
  get_session: 'Use um ID obtido ao listar sessões.',
  get_passport_promotion: 'Consulte a promoção de passaporte disponível.',
};

function partnershipField() {
  return z.string().optional().describe(
    `Parceiro opcional; usa o padrão configurado ou ${DEFAULT_PARTNERSHIP}. ingresso retorna um catálogo restrito.`,
  );
}

function resourceSelectors() {
  return {
    id: z.string().optional().describe("Identificador do recurso."),
    urlKey: z.string().optional().describe("Chave de URL do recurso, alternativa ao ID."),
  };
}

function includeCitiesField() {
  return z.boolean().optional().describe("Incluir cidades nos eventos retornados.");
}

function includeOperationPoliciesField() {
  return z.boolean().optional().describe("Incluir políticas de operação do cinema.");
}

function define<S extends z.ZodRawShape>(
  name: string,
  title: string,
  inputSchema: S,
  paths: string[],
  handler: (input: z.infer<z.ZodObject<S>> & { partnership?: string }) => Promise<unknown>,
  outputPageLimit?: number,
): ToolDefinition {
  const schema = z.object({
    ...inputSchema,
    partnership: partnershipField(),
  });
  const tool: ToolDefinition = {
    name,
    outputPageLimit,
    title,
    description: `${guidance[name]} ${title} na API ingresso.com, com conteúdo em pt-BR para o Brasil. Escolha apenas um seletor quando houver alternativas.`,
    inputSchema: schema,
    operations: paths.map(path => ({ method: 'GET', path })),
    handler: input => handler(tool.inputSchema.parse(input) as z.infer<z.ZodObject<S>> & { partnership?: string }),
  };
  return tool;
}

export function createTools(deps: Deps): ToolDefinition[] {
  const showtimes = define('find_showtimes', 'Resumir sessões de um filme', {
    cityId: z.string().trim().min(1).describe('ID obrigatório da cidade.'),
    theaterId: z.string().trim().min(1).optional().describe('ID do cinema; informe exatamente um entre theaterId e theaterUrlKey.'),
    theaterUrlKey: z.string().trim().min(1).optional().describe('Chave de URL do cinema, alternativa a theaterId.'),
    eventId: z.string().trim().min(1).optional().describe('ID do filme; informe exatamente um entre eventId e title.'),
    title: z.string().trim().min(1).optional().describe('Trecho do título ou título original, sem distinção de acentos ou maiúsculas; ambiguidades retornam matches para escolher eventId.'),
    date: z.iso.date().optional().describe('Data opcional no formato YYYY-MM-DD para restringir a um dia.'),
    includeSessions: z.boolean().default(false).describe('Incluir detalhes de cada sessão; padrão false retorna apenas o resumo diário.'),
  }, [
    '/v0/sessions/city/{cityId}/theater/{theaterId}/partnership/{partnership}',
    '/v0/sessions/city/{cityId}/theater/url-key/{theaterUrlKey}/partnership/{partnership}',
  ], input => usecases.findShowtimes(deps, input));
  showtimes.inputSchema = showtimes.inputSchema
    .refine(input => [input.theaterId, input.theaterUrlKey].filter(value => value !== undefined).length === 1,
      { message: 'Informe exatamente um entre theaterId e theaterUrlKey.' })
    .refine(input => [input.eventId, input.title].filter(value => value !== undefined).length === 1,
      { message: 'Informe exatamente um entre eventId e title.' });
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
      ...resourceSelectors(),
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
      category: z.enum(TEMPLATE_KINDS).describe("Categoria: nowplaying, soon, highlights ou premiere; todas exceto nowplaying exigem cityId."),
      cityId: z.string().optional().describe("ID da cidade; opcional apenas em nowplaying."),
      compact: z.boolean().default(true).describe('Resumo sem sinopse, imagens ou trailers; false retorna eventos completos.'),
      sort: z.enum(['popularity', 'api']).default('popularity').describe('popularity: tamanho de exibição decrescente e título; api: ordem original.'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe(`Itens retornados por página da ferramenta; padrão ${DEFAULT_PAGE_SIZE}, máximo ${MAX_PAGE_SIZE}.`),
      skip: z.number().int().min(0).max(MAX_INT32).optional().describe('Offset na lista ordenada, padrão 0; somente nowplaying. Use nextSkip quando hasMore.'),
      theatersIds: z.string().optional().describe("IDs de cinemas para highlights, no formato aceito pela API."),
      justEvents: z.boolean().optional().describe("Retornar apenas eventos; somente highlights."),
    }, [
      '/v0/templates/soon/{cityId}/partnership/{partnership}',
      '/v0/templates/highlights/{cityId}/partnership/{partnership}',
      '/v0/templates/nowplaying/partnership/{partnership}',
      '/v0/templates/nowplaying/{cityId}/partnership/{partnership}',
      '/v0/templates/premiere/{cityId}/partnership/{partnership}',
    ], input => usecases.listMovies(deps, input), MAX_PAGE_SIZE),
    define('search_events', 'Buscar eventos', {
      tagName: z.string().optional().describe("Nome da categoria de eventos."),
      tagUrlKey: z.string().optional().describe("Chave de URL da categoria de eventos."),
      cityId: z.string().optional().describe("ID da cidade para filtrar os resultados."),
      comingSoon: z.boolean().optional().describe("Consultar próximos lançamentos, sem outro seletor."),
      all: z.boolean().optional().describe("Consultar todos os eventos, sem outro seletor."),
      includeCities: includeCitiesField(),
      skip: z.number().int().min(0).max(MAX_INT32).default(0).describe('Offset na lista ordenada; use nextSkip quando hasMore.'),
      compact: z.boolean().default(true).describe('Resumo sem sinopse, imagens ou trailers; false retorna eventos completos.'),
      sort: z.enum(['popularity', 'api']).default('popularity').describe('popularity: tamanho de exibição decrescente e título; api: ordem original.'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe(`Itens retornados por página da ferramenta; padrão ${DEFAULT_PAGE_SIZE}, máximo ${MAX_PAGE_SIZE}.`),
    }, [
      '/v0/events/partnership/{partnership}',
      '/v0/events/tagName/{tagName}/partnership/{partnership}',
      '/v0/events/tagUrlKey/{tagUrlKey}/partnership/{partnership}',
      '/v0/events/coming-soon/partnership/{partnership}',
      '/v0/events/city/{cityId}/partnership/{partnership}',
    ], input => usecases.searchEvents(deps, input), MAX_PAGE_SIZE),
    define('get_event', 'Consultar evento', {
      ...resourceSelectors(),
      includeCities: includeCitiesField(),
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
      includeOperationPolicies: includeOperationPoliciesField(),
    }, [
      '/v0/theaters/partnership/{partnership}',
      '/v0/theaters/city/{cityId}/partnership/{partnership}',
    ], input => usecases.listTheaters(deps, input)),
    define('get_theater', 'Consultar cinema', {
      ...resourceSelectors(),
      includeOperationPolicies: includeOperationPoliciesField(),
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
      groupBySessionType: z.boolean().optional().describe("Agrupar por tipo de sessão; exige ID de cinema ou evento."),
      date: z.string().optional().describe("Data no formato YYYY-MM-DD."),
      includeOperationPolicies: includeOperationPoliciesField(),
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
    showtimes,
    define('list_session_dates', 'Listar datas de sessões', {
      cityId: z.string().describe("ID obrigatório da cidade."),
      theaterId: z.string().optional().describe("ID do cinema, alternativa aos outros seletores."),
      eventId: z.string().optional().describe("ID do evento, alternativa aos outros seletores."),
    }, [
      '/v0/sessions/city/{cityId}/theater/{theaterId}/dates/partnership/{partnership}',
      '/v0/sessions/city/{cityId}/event/{eventId}/dates/partnership/{partnership}',
    ], input => usecases.listSessionDates(deps, input)),
    define('get_session', 'Consultar sessão', {
      id: z.string().describe("Identificador do recurso."),
      includeOperationPolicies: includeOperationPoliciesField(),
    }, [
      '/v0/sessions/{id}/partnership/{partnership}',
    ], input => usecases.getSession(deps, input)),
    define('get_passport_promotion', 'Consultar promoção Passaporte', {
    }, [
      '/v0/passport-promotion',
    ], () => usecases.getPassportPromotion(deps)),
  ];
}
