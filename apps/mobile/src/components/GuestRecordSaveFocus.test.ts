import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const guests = readFileSync(join('src', 'components', 'EventGuests.tsx'), 'utf8');
const saved = guests.slice(guests.indexOf('onSaved={(tagged) => {'));
const onSaved = saved.slice(0, saved.indexOf('/>'));

describe('saving a reply for a guest nobody has invited focuses Record a reply (sc-52829)', () => {
  it('moves focus to Record a reply once the sheet has gone, not through the opener', () => {
    expect(onSaved).toContain("const invites = shownReply(recording.guest) === 'notYetInvited';");
    expect(onSaved).toContain('opener.current = guestName.current;');
    expect(onSaved).not.toMatch(/opener\.current\s*=[^;]*recordButton/u);
    expect(onSaved).toMatch(
      /if \(invites\)\s+setTimeout\(\(\) => moveScreenReaderFocus\(recordButton\.current\), FOCUS_AFTER_MS\);/u,
    );
  });

  it('keys each sheet apart, so one never reuses another', () => {
    const keys = [...guests.matchAll(/key=\{`(\w+)\.\$\{(?:marking\.)?round\}`\}/gu)].map(
      (m) => m[1],
    );
    expect(keys).toEqual(['mark', 'whose', 'record', 'form']);
  });
});
