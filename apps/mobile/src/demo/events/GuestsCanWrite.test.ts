import { describe, expect, it } from 'vitest';

import { EVENT_STATES } from './EventsModel.ts';
import { W } from './EventsWords.ts';
import {
  WRITE_STATES,
  pressWrite,
  writeLines,
  writeSettled,
  writeSwitchOf,
  writeWord,
} from './GuestsCanWrite.ts';

describe('Guests can write from their page', () => {
  it('is On as the event opens, with nothing under it', () => {
    const on = writeSwitchOf(null);
    expect(on).toMatchObject({ on: true, saving: false, canChange: true });
    expect(writeWord(on)).toBe('On');
    expect(writeLines(on)).toEqual({ note: null, alert: null });
  });

  it('a press shows the pressed value, busy, and ignores presses until it saves', () => {
    const busy = pressWrite(writeSwitchOf(null));
    expect(busy).toMatchObject({ on: false, saving: true });
    expect(pressWrite(busy)).toBe(busy);

    const off = writeSettled(busy, true);
    expect(off).toMatchObject({ on: false, saved: false, saving: false });
    expect(writeWord(off)).toBe('Off');
    expect(writeLines(off)).toEqual({ note: null, alert: null });
  });

  it('a failed save goes back to what was saved, with Mute’s alert words', () => {
    const failed = writeSettled(pressWrite(writeSwitchOf(null)), false);
    expect(failed).toMatchObject({ on: true, saving: false, failed: true });
    expect(writeLines(failed)).toEqual({ note: null, alert: 'Not saved. Try again.' });
    expect(writeLines(failed).alert).toBe(W.muteNotSaved);
    expect(pressWrite(failed)).toMatchObject({ failed: false, saving: true });
  });

  it('cannot be changed without messages.manage, and says so in words', () => {
    const readOnly = writeSwitchOf('guestsCanWriteReadOnly');
    expect(pressWrite(readOnly)).toBe(readOnly);
    expect(writeWord(readOnly)).toBe('On');
    expect(writeLines(readOnly).note).toBe('Only members who manage messages can change this.');
  });

  it('seeds each of its states, each an event state', () => {
    expect(writeSwitchOf('guestsCanWriteOff')).toMatchObject({ on: false, saved: false });
    expect(writeSwitchOf('guestsCanWriteSaving')).toMatchObject({ on: false, saving: true });
    expect(writeLines(writeSwitchOf('guestsCanWriteSaving')).note).toBeNull();
    expect(writeSwitchOf('guestsCanWriteFailed')).toMatchObject({ on: true, failed: true });
    for (const state of WRITE_STATES) expect(EVENT_STATES).toContain(state);
  });
});
