---
name: ingresso
description: Use when the user asks about movies, showtimes (sessões), theaters (cinemas), cities, premieres or "em cartaz" in Brazil via ingresso.com. Guides the use of the ingressodotcom MCP tools to resolve a city, find an event and list its sessions.
---

# ingresso.com

All tools are **read-only** (public content API, no login, no purchases). Content is Brazilian (pt-BR).

## Workflow

1. **Resolve the city first.** Almost everything is scoped by `cityId`. Call `find_city` with a name ("Curitiba") and optional `uf`, lat/long, or a theater slug. Never search by `uf` alone. Never guess an id.
2. **Find the event.** `list_movies` (category `nowplaying` | `soon` | `highlights` | `premiere`) for a city, or `search_events` / `get_event` (by `id` or `urlKey`). `get_event_credits` gives cast and crew.
3. **Find the theater** (optional): `list_theaters` with `cityId`, `get_theater`.
4. **Summarize one movie at one theater first.** Prefer `find_showtimes` to answer “has tickets for X at theater Y and how much”: provide `cityId`, exactly one of `theaterId`/`theaterUrlKey`, and exactly one of `eventId`/`title`. A title substring matches without accents or case; if `matches` is returned, ask the user to choose and retry with `eventId`. Use optional `date` (`YYYY-MM-DD`); `includeSessions` defaults to false, set it to true for details and `checkoutUrl`. Report prices and scheduled sessions, but never claim seat availability: the public API does not expose it.
5. **List raw sessions when needed.** `list_sessions` with `cityId` plus a `theaterId`/`theaterUrlKey` or `eventId`/`eventUrlKey`. Use `list_session_dates` first to see which days have sessions, and `groupBySessionType` with `cityId` plus `theaterId` or `eventId` (not URL keys) to separate session types. Dates use `YYYY-MM-DD`.
6. Give the user the `checkoutUrl` or `siteURL` returned for the event/session so they can buy on ingresso.com. This plugin cannot buy tickets.

## Notes

- `partnership` is optional on every tool; the default is configured by `INGRESSO_PARTNERSHIP`, otherwise `1` (full catalog). `ingresso` returns a restricted catalog.
- Large lists are truncated by the server; narrow with city/theater/event instead of asking for "everything".
- Identify sessions by id only after listing them; do not invent ids.
