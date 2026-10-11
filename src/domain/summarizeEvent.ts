import type { Event } from './entities.ts';

/** Public discovery fields, without heavy synopsis, images or trailers. */
export function summarizeEvent(event: Event) {
  return {
    id: event.id,
    title: event.title,
    ...(event.originalTitle && event.originalTitle !== event.title
      ? { originalTitle: event.originalTitle } : {}),
    genres: event.genres ?? [],
    contentRating: event.contentRating,
    duration: event.duration,
    premiere: event.premiereDate?.localDate?.slice(0, 10),
    inPreSale: event.inPreSale ?? false,
    isReexhibition: event.isReexhibition ?? false,
    isComingSoon: event.isComingSoon ?? false,
    showSize: event.countIsPlaying ?? 0,
    siteURL: event.siteURL,
  };
}
