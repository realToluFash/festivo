import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { currentPlace, openerLabel, sessionFor, waitingOf } from '../OrgSwitcherModel.ts';
import { pausedIn } from './PausedSample.ts';

const ENGLISH = /Monday|Wednesday|Nov|Dec| at /u;

/** One function's text, from its declaration to the closing brace at the start of a line. */
function bodyOf(file: string, name: string): string {
  const source = readFileSync(join(import.meta.dirname, file), 'utf8');
  const start = source.indexOf(`function ${name}(`);

  expect(start).toBeGreaterThan(-1);

  return source.slice(start, source.indexOf('\n}\n', start));
}

describe('sc-83881: the paused page in the reader language, its pill, the bell on its side', () => {
  it.each(['es', 'fr', 'pt'])('writes the suspension dates in %s with no English', (language) => {
    const { suspension } = pausedIn(language);

    expect(suspension.since.written).not.toMatch(ENGLISH);
    expect(suspension.removesAt?.written).not.toMatch(ENGLISH);
    expect(suspension.since.written).toContain('10:00 WAT');
  });

  it('keeps English for English and for a language it has no words for', () => {
    expect(pausedIn('en').suspension.since.written).toBe('Monday, Nov 2 at 10:00 WAT');
    expect(pausedIn('de').suspension.since.written).toBe('Monday, Nov 2 at 10:00 WAT');
  });

  it('labels the paused pill with access paused in place of a role, still naming the switch it opens', () => {
    const session = sessionFor('populated');
    const place = currentPlace(session);

    expect(place.name).toBe(pausedIn('en').name);
    expect(openerLabel(place, 0, true)).toBe(
      'Organisation: Ire Events, access paused. Switch organisation',
    );
    expect(openerLabel(place, waitingOf(session), true)).toBe(
      'Organisation: Ire Events, access paused. Switch organisation. 2 invitations waiting',
    );
    expect(openerLabel(place, 1, true)).toBe(
      'Organisation: Ire Events, access paused. Switch organisation. 1 invitation waiting',
    );
  });

  it('gives the openers the paused label on the paused page only', () => {
    expect(bodyOf('SettingsHome.tsx', 'SettingsHome')).toContain(
      "<PausedHere.Provider value={held === 'paused'}>",
    );
    expect(bodyOf('../OrgSwitcher.tsx', 'useOrgOpener')).toContain(
      'openerLabel(place, waiting, paused)',
    );
  });

  it('draws no page title on the held page, and the bell on its side', () => {
    const held = bodyOf('SettingsHome.tsx', 'HeldSettings');
    const side = held.slice(0, held.indexOf("shell.layout === 'portrait'"));

    expect(held).not.toMatch(/<Title\b|accessibilityRole="header"|settings\.title/u);
    expect(side).toContain("shell.layout === 'landscape'");
    expect(side).toContain('<Bell tell={shell.tell} />');
  });
});
