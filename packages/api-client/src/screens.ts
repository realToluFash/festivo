/** The room screen (sc-3897): one link for each place, and what each screen shows. */

/** `place` is null for Main. `replacedAt` is when the place's link was last replaced, RFC 3339 in the event zone's offset. */
export interface ScreenLink {
  place: string | null;
  token: string;
  replacedAt: string | null;
}

export interface ScreenComing {
  id: string;
  title: string;
  /** The expected start, rounded down to 5 minutes, RFC 3339 in the event zone's offset. */
  startsAt: string;
}

/** Each kind carries only what its screen shows; `at` is the server's clock when it answered, in the event zone's offset. */
export type RoomScreen =
  | {
      kind: 'live';
      eventId: string;
      event: string;
      locale: string;
      at: string;
      now: { id: string; title: string } | null;
      coming: ScreenComing[];
    }
  | { kind: 'nothingLeft'; eventId: string; event: string; locale: string; at: string }
  | { kind: 'finished'; eventId: string; event: string; locale: string; at: string }
  | { kind: 'replaced'; at: string };

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value != null ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function asScreenLinks(body: unknown): ScreenLink[] | null {
  const links = record(body)?.links;
  if (!Array.isArray(links)) return null;
  const read = links.map((one): ScreenLink | null => {
    const link = record(one);
    const token = text(link?.token);
    if (link == null || token == null) return null;

    return { place: text(link.place), token, replacedAt: text(link.replacedAt) };
  });

  return read.every((one) => one != null) ? (read as ScreenLink[]) : null;
}

function asComing(value: unknown): ScreenComing | null {
  const one = record(value);
  const id = text(one?.id);
  const title = text(one?.title);
  const startsAt = text(one?.startsAt);

  return id == null || title == null || startsAt == null ? null : { id, title, startsAt };
}

export function asRoomScreen(body: unknown): RoomScreen | null {
  const screen = record(body);
  const at = text(screen?.at);
  if (screen == null || at == null) return null;
  if (screen.kind === 'replaced') return { kind: 'replaced', at };

  const eventId = text(screen.eventId);
  const event = text(screen.event);
  const locale = text(screen.locale);
  if (eventId == null || event == null || locale == null) return null;
  if (screen.kind === 'nothingLeft') return { kind: 'nothingLeft', eventId, event, locale, at };
  if (screen.kind === 'finished') return { kind: 'finished', eventId, event, locale, at };
  if (screen.kind !== 'live' || !Array.isArray(screen.coming)) return null;

  const nowRecord = record(screen.now);
  const nowId = text(nowRecord?.id);
  const nowTitle = text(nowRecord?.title);
  const now = nowId == null || nowTitle == null ? null : { id: nowId, title: nowTitle };
  if (screen.now != null && now == null) return null;
  const coming = screen.coming.map(asComing);
  if (!coming.every((one) => one != null)) return null;

  return { kind: 'live', eventId, event, locale, at, now, coming: coming as ScreenComing[] };
}
