import type { EventChanges, OrganisationEvent, TaggedEvent } from '@soirely/api-client';
import { type EventSaveRefusal, type HostRow, eventSaveRefusal } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { EditPart } from './eventNav.ts';

export type SavedPart = Exclude<EditPart, 'cover'>;

/** What each part's screen edits: only these, changed by somebody else since the page was read, stop its save. */
export const PART_FIELDS: Readonly<Record<SavedPart, readonly (keyof OrganisationEvent)[]>> = {
  dates: ['startsAt', 'endsAt', 'timeZone'],
  replyBy: ['replyBy'],
  venue: ['venue', 'arrivalNote', 'timeZone'],
  hosts: ['hosts'],
  type: ['type'],
  currency: ['currency'],
  name: ['name'],
};

export function partChangedElsewhere(
  part: SavedPart,
  shown: OrganisationEvent,
  read: OrganisationEvent,
): boolean {
  return PART_FIELDS[part].some(
    (field) => JSON.stringify(shown[field]) !== JSON.stringify(read[field]),
  );
}

/** The read a screen makes as it opens, held for its save; a read that failed is made again. */
export function heldRead(read: () => Promise<TaggedEvent>): () => Promise<TaggedEvent> {
  let held: Promise<TaggedEvent> | null = null;

  return () => {
    if (held != null) return held.catch(() => (held = read()));

    held = read();
    held.catch(() => undefined);

    return held;
  };
}

export interface PartSaveApi {
  updateEvent: (eventId: string, changes: EventChanges, tag: string) => Promise<TaggedEvent>;
}

export type PartSent =
  { kind: 'unchanged' } | { kind: 'saved'; event: OrganisationEvent } | EventSaveRefusal;

/** One part's save: nothing when nothing changed, and only that part under the tag read at open, unless somebody else has changed it since the page was read. */
export async function sendPart(
  {
    api,
    part,
    shown,
    changes,
    read,
  }: {
    api: PartSaveApi;
    part: SavedPart;
    shown: OrganisationEvent;
    changes: EventChanges;
    read: () => Promise<TaggedEvent>;
  },
  t: TFunction,
  rows: readonly HostRow[] = [],
): Promise<PartSent> {
  if (Object.keys(changes).length === 0) return { kind: 'unchanged' };

  try {
    const opened = await read();
    if (partChangedElsewhere(part, shown, opened.event)) return { kind: 'changed' };

    const saved = await api.updateEvent(shown.id, changes, opened.tag);

    return { kind: 'saved', event: saved.event };
  } catch (error) {
    return eventSaveRefusal(error, rows, t);
  }
}
