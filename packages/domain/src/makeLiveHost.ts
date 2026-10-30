import { ApiError, type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';

import { type Translate } from './eventWords.ts';
import { hostNameOf, hostsSent, needsHost } from './hosts.ts';
import { type HostRow, hostErrorsOf } from './hostWords.ts';

/** New event's lone empty Host 1 is no host at all (sc-22143); with more rows, every empty one is refused as on Edit details. */
export function newEventHosts(rows: readonly HostRow[]): readonly HostRow[] {
  const [only] = rows;

  return rows.length === 1 && only != null && hostNameOf(only.name) === '' ? [] : rows;
}

/** Make live's Host 1, checked before anything is sent: empty asks for the host, and a name breaking sc-6713's rules has that rule's message. */
export function makeLiveHostError(typed: string, t: Translate): string | null {
  if (hostNameOf(typed) === '') return t('eventLive.hostEmpty');

  return hostErrorsOf([{ key: 0, name: typed }], t)[0] ?? null;
}

export interface MakeLiveCalls {
  updateEvent(eventId: string, changes: { hosts: string[] }, tag: string): Promise<TaggedEvent>;
  makeLive(eventId: string): Promise<TaggedEvent>;
}

/**
 * `stale` reads the event again (a 412 on the save, or somebody acting between the two requests).
 * `saved` is the host's save when it went through, so a retry sends with its version.
 */
export type MakeLiveStep =
  | { kind: 'live'; tagged: TaggedEvent }
  | { kind: 'stale' }
  | { kind: 'hostRefused'; message: string }
  | { kind: 'refused'; error: unknown; saved: TaggedEvent | null };

/** A draft with no host saves `typed` as its one host, then goes live; one with a host only goes live. */
export async function makeLiveWithHost(
  calls: MakeLiveCalls,
  opened: TaggedEvent,
  typed: string,
): Promise<MakeLiveStep> {
  let saved: TaggedEvent | null = null;

  if (needsHost(opened.event)) {
    try {
      saved = await calls.updateEvent(opened.event.id, { hosts: hostsSent([typed]) }, opened.tag);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 412 || error.is('event_state_invalid')))
        return { kind: 'stale' };

      const message =
        error instanceof ApiError && error.status === 422
          ? Object.values(error.fieldErrors())[0]
          : undefined;

      return message == null
        ? { kind: 'refused', error, saved: null }
        : { kind: 'hostRefused', message };
    }
  }

  try {
    return { kind: 'live', tagged: await calls.makeLive(opened.event.id) };
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.is('event_state_invalid') || error.is('event_host_required'))
    )
      return { kind: 'stale' };

    return { kind: 'refused', error, saved };
  }
}

export type Reread = 'noHost' | 'hosted' | 'notDraft';

/** What the confirmation becomes once a stale save has read the event again (sc-22143). */
export function rereadOf(event: Pick<OrganisationEvent, 'status' | 'hosts'>): Reread {
  if (event.status !== 'draft') return 'notDraft';

  return needsHost(event) ? 'noHost' : 'hosted';
}
