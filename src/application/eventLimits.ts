export const DEFAULT_PAGE_SIZE = 40;
export const MAX_PAGE_SIZE = 200;
export const MAX_INT32 = 2_147_483_647;
export const TEMPLATE_KINDS = ['nowplaying', 'soon', 'highlights', 'premiere'] as const;
export type TemplateKind = typeof TEMPLATE_KINDS[number];
