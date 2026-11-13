export const WRITE_MS = 600;

export type WriteState =
  'guestsCanWriteOff' | 'guestsCanWriteSaving' | 'guestsCanWriteFailed' | 'guestsCanWriteReadOnly';

/** Guests can write from their page (sc-3978): what is saved, what the switch shows, and whether this member may change it. */
export interface WriteSwitch {
  saved: boolean;
  shown: boolean;
  busy: boolean;
  failed: boolean;
  canChange: boolean;
}

const ON: WriteSwitch = { saved: true, shown: true, busy: false, failed: false, canChange: true };

export function writeSwitchOf(state: string | null): WriteSwitch {
  switch (state) {
    case 'guestsCanWriteOff':
      return { ...ON, saved: false, shown: false };
    case 'guestsCanWriteSaving':
      return { ...ON, shown: false, busy: true };
    case 'guestsCanWriteFailed':
      return { ...ON, failed: true };
    case 'guestsCanWriteReadOnly':
      return { ...ON, canChange: false };
    default:
      return ON;
  }
}

/** A press shows the new value at once and saves it; ignored while saving or for a member who may not change it. */
export function writePressed(now: WriteSwitch, next: boolean): WriteSwitch {
  if (now.busy || !now.canChange) return now;

  return { ...now, shown: next, busy: true, failed: false };
}

/** Saved, the shown value stays; refused, the switch goes back to what was saved and says so. */
export function writeSettled(now: WriteSwitch, saved: boolean): WriteSwitch {
  return saved
    ? { ...now, saved: now.shown, busy: false, failed: false }
    : { ...now, shown: now.saved, busy: false, failed: true };
}
