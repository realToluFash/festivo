import { W } from './EventsWords.ts';

export interface WriteSwitch {
  on: boolean;
  saved: boolean;
  saving: boolean;
  failed: boolean;
  canChange: boolean;
}

export const WRITE_MS = 600;

export const WRITE_STATES = [
  'guestsCanWriteOff',
  'guestsCanWriteSaving',
  'guestsCanWriteFailed',
  'guestsCanWriteReadOnly',
] as const;

const ON: WriteSwitch = { on: true, saved: true, saving: false, failed: false, canChange: true };

const STARTS: Record<(typeof WRITE_STATES)[number], WriteSwitch> = {
  guestsCanWriteOff: { ...ON, on: false, saved: false },
  guestsCanWriteSaving: { ...ON, on: false, saving: true },
  guestsCanWriteFailed: { ...ON, failed: true },
  guestsCanWriteReadOnly: { ...ON, canChange: false },
};

export function writeSwitchOf(state: string | null): WriteSwitch {
  const start = WRITE_STATES.find((one) => one === state);

  return start == null ? ON : STARTS[start];
}

/** It saves at once: the pressed value shows, busy, and a press meanwhile is ignored. */
export function pressWrite(s: WriteSwitch): WriteSwitch {
  if (s.saving || !s.canChange) return s;

  return { ...s, on: !s.on, saving: true, failed: false };
}

export function writeSettled(s: WriteSwitch, ok: boolean): WriteSwitch {
  if (!s.saving) return s;

  return ok
    ? { ...s, saved: s.on, saving: false }
    : { ...s, on: s.saved, saving: false, failed: true };
}

export function writeLines(s: WriteSwitch): { note: string | null; alert: string | null } {
  if (!s.canChange) return { note: W.guestsCanWriteReadOnly, alert: null };
  if (s.failed) return { note: null, alert: W.muteNotSaved };

  return { note: s.on || s.saving ? null : W.guestsCanWriteOffNote, alert: null };
}

export function writeWord(s: WriteSwitch): string {
  return s.on ? W.on : W.off;
}
