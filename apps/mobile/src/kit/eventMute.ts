import type { EventMute } from '@soirely/api-client';

export type MuteState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; muted: boolean; saving: boolean; unsaved: boolean };

export interface MutesEvents {
  eventMuted(eventId: string): Promise<boolean>;
  muteEvent(eventId: string, muted: boolean): Promise<EventMute>;
}

/** Mute this event (sc-3980): a state that did not load leaves the switch off-limits, never guessed. */
export async function readMute(client: MutesEvents, eventId: string): Promise<MuteState> {
  try {
    return {
      status: 'loaded',
      muted: await client.eventMuted(eventId),
      saving: false,
      unsaved: false,
    };
  } catch {
    return { status: 'failed' };
  }
}

/** A change that did not save puts the switch back where it was; one that did comes with what the bell marks. */
export async function saveMute(
  client: MutesEvents,
  eventId: string,
  next: boolean,
): Promise<{ state: MuteState; saved: EventMute | null }> {
  try {
    const saved = await client.muteEvent(eventId, next);

    return {
      state: { status: 'loaded', muted: saved.muted, saving: false, unsaved: false },
      saved,
    };
  } catch {
    return { state: { status: 'loaded', muted: !next, saving: false, unsaved: true }, saved: null };
  }
}
