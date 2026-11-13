import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GUESTS_BOARDS } from './GuestsBoards.ts';
import {
  GREET_AS_MAX,
  type GuestsState,
  addedGuest,
  areaStart,
  greetAsCount,
  greetAsProblem,
  greetAsSaved,
  guestOf,
  guestsAt,
  roleOf,
} from './GuestsModel.ts';
import { GUESTS } from './GuestsSample.ts';
import { W, say } from './GuestsWords.ts';

const LONG = 'Auntie Bisi, who taught every one of us to dance at weddings!';
const source = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

describe('Greet as on the guest (sc-3960)', () => {
  it('opens each state on Bisi Adewale, Greet as empty on Kwame Mensah, Edit’s three in the form', () => {
    const bisi: GuestsState[] = [
      'greetAs',
      'greetAsEdit',
      'greetAsLong',
      'greetAsSpaces',
      'greetAsViewer',
    ];
    for (const state of bisi) expect(guestOf(state)).toBe('bisi');
    expect(guestOf('greetAsEmpty')).toBe('kwame');
    expect(areaStart('greetAsEmpty').overlay).toBe('edit');
    expect(areaStart('greetAsEdit').overlay).toBe('edit');
    expect(areaStart('greetAsLong').overlay).toBe('edit');
    expect(areaStart('greetAs').overlay).toBeNull();
    expect(areaStart('greetAsSpaces')).toMatchObject({ overlay: null, toast: 'saved' });
    expect(roleOf('greetAsViewer')).toBe('viewer');
    expect(roleOf('greetAs')).toBe('owner');
  });

  it('lists each state on the demo home', () => {
    const hrefs = GUESTS_BOARDS.map((board) => board.href);
    for (const state of [
      'greetAs',
      'greetAsEmpty',
      'greetAsEdit',
      'greetAsLong',
      'greetAsSpaces',
      'greetAsViewer',
    ])
      expect(hrefs).toContain(`/demo/guests?state=${state}`);
  });

  it('counts code points after trimming, so the counter never reads 60 of 60 for one refused', () => {
    expect(say.ofMax(greetAsCount(''), GREET_AS_MAX)).toBe('0 of 60');
    expect(say.ofMax(greetAsCount('  Auntie Bisi  '), GREET_AS_MAX)).toBe('11 of 60');
    expect(greetAsCount('Élodie')).toBe(6);
    expect(greetAsCount(LONG)).toBe(61);
    expect(greetAsProblem(LONG)).toBe('Shorten Greet as to 60 characters or fewer.');
    expect(greetAsProblem(`  ${LONG.slice(0, 60)}  `)).toBeNull();
  });

  it('saves only spaces as none, so the details greet them by their full name', () => {
    expect(greetAsSaved('   ')).toBeNull();
    expect(greetAsSaved('  Auntie Bisi  ')).toBe('Auntie Bisi');
    expect(GUESTS.find((g) => g.key === 'bisi')?.greetAs).toBe('Auntie Bisi');
    expect(guestsAt('greetAsSpaces').find((g) => g.key === 'bisi')?.greetAs).toBeNull();
  });

  it('words the field and the details row as the copy settled them', () => {
    expect(W.greetAs).toBe('Greet as');
    expect(W.greetAsHint).toBe(
      'How messages greet them, such as Auntie Bisi or Dr. Okafor. Leave it blank to use their full name.',
    );
    expect(say.greetsAs('Auntie Bisi')).toBe('Messages greet them as “Auntie Bisi”.');
    expect(W.greetedByName).toBe('Messages greet them by their full name.');
  });

  it('keeps a Greet as typed on Add guest, trimmed, and none when blank', () => {
    const typed = { email: '', phone: null, language: null, companions: [] };

    expect(addedGuest('a', { ...typed, name: 'Bisi', greetAs: ' Auntie Bisi ' }).greetAs).toBe(
      'Auntie Bisi',
    );
    expect(addedGuest('b', { ...typed, name: 'Bisi' }).greetAs).toBeNull();
  });

  it('sits under Full name, takes the keys in its states, and takes focus when refused', () => {
    const edit = source('GuestEdit.tsx');
    const at = (testID: string) => edit.indexOf(`testID="guest.edit.${testID}"`);

    expect(at('name')).toBeLessThan(at('greetAs'));
    expect(at('greetAs')).toBeLessThan(at('email'));
    expect(edit).toContain('autoFocus={GREET_AS_STARTS.includes(start)}');
    expect(edit).toContain('if (problems.greetAs != null) return focusChecked(greetAsRef);');
  });

  it('shows the row to every role that reads the guest, and Edit only to who manages', () => {
    const page = source('GuestPage.tsx');

    expect(page).toContain("{ key: 'greetAs', inset: 40, row: <GreetAsRow g={g} /> }");
    expect(page).not.toContain('(owner || g.companions.length > 0) &&');
    expect(page).toMatch(/owner \? \(\s*<TextAction[\s\S]*testID="guest\.edit"/u);
  });
});
