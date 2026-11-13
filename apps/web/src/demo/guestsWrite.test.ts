import { describe, expect, it } from 'vitest';

import { writePressed, writeSettled, writeSwitchOf } from './guestsWrite.ts';

describe('Guests can write to you, the switch (sc-3978)', () => {
  it('opens on, and each state where it is drawn', () => {
    expect(writeSwitchOf(null)).toEqual({
      saved: true,
      shown: true,
      busy: false,
      failed: false,
      canChange: true,
    });
    expect(writeSwitchOf('guestsCanWriteOff')).toMatchObject({ saved: false, shown: false });
    expect(writeSwitchOf('guestsCanWriteSaving')).toMatchObject({
      saved: true,
      shown: false,
      busy: true,
    });
    expect(writeSwitchOf('guestsCanWriteFailed')).toMatchObject({
      saved: true,
      shown: true,
      failed: true,
    });
    expect(writeSwitchOf('guestsCanWriteReadOnly')).toMatchObject({
      shown: true,
      canChange: false,
    });
  });

  it('shows the pressed value at once, busy, and keeps it once saved', () => {
    const pressed = writePressed(writeSwitchOf(null), false);

    expect(pressed).toMatchObject({ saved: true, shown: false, busy: true });
    expect(writePressed(pressed, true)).toBe(pressed);
    expect(writeSettled(pressed, true)).toMatchObject({ saved: false, shown: false, busy: false });
  });

  it('goes back to what was saved when refused, and the next press clears the alert', () => {
    const refused = writeSettled(writePressed(writeSwitchOf(null), false), false);

    expect(refused).toMatchObject({ saved: true, shown: true, busy: false, failed: true });
    expect(writePressed(refused, false)).toMatchObject({ shown: false, busy: true, failed: false });
    expect(writeSwitchOf('guestsCanWriteFailed')).toEqual(refused);
  });

  it('ignores a press from a member without messages.manage', () => {
    const fixed = writeSwitchOf('guestsCanWriteReadOnly');

    expect(writePressed(fixed, false)).toBe(fixed);
  });
});
