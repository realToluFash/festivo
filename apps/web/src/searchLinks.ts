import type { SearchRow } from '@soirely/domain';

/** Settings › Members' parameter for the row Search opened (sc-39534). */
export const SEARCHED_MEMBER = 'member';

/** Where a match opens: the event's page, that guest's details on that event, or their row in Settings › Members. */
export function searchLink(row: SearchRow): string {
  switch (row.kind) {
    case 'event':
      return `/app/events/${encodeURIComponent(row.id)}`;
    case 'guest':
      return `/app/events/${encodeURIComponent(row.event)}/guests?${new URLSearchParams({ guest: row.id }).toString()}`;
    case 'member':
      return `/app/settings/members?${new URLSearchParams({ [SEARCHED_MEMBER]: row.id }).toString()}`;
  }
}

/** Show all in Events: Events with the same search applied. */
export function eventsSearchLink(term: string): string {
  return `/app/events?${new URLSearchParams({ q: term.trim() }).toString()}`;
}

/** The sidebar's key hint for the reader's keyboard. */
export function keyHint(platform: string | undefined): string {
  return /mac|iphone|ipad|ipod/i.test(platform ?? '') ? '⌘K' : 'Ctrl K';
}
