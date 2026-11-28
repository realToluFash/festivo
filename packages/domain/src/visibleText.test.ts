import { describe, expect, it } from 'vitest';

import { arrivalNoteLength, eventNameLength, venueProblems } from './events.ts';
import { nameLength } from './guestForm.ts';
import { groupNameLength } from './guestGroups.ts';
import { needsLength } from './guestNeeds.ts';
import { hostNameLength, hostProblems } from './hosts.ts';
import { newOrganisationProblem } from './organisations.ts';
import { clusterLength, visibleLength } from './visibleText.ts';

const YORUBA = 'Ẹ̀gbẹ́ Ọ̀rẹ́ Ìyàwó Àgbà';
const EMOJI = '👨‍👩‍👧 🇳🇬';
const marked = (n: number): string => 'e\u0323\u0300'.repeat(n);

describe('a visible character (sc-54292)', () => {
  for (const [name, count] of [
    ['visibleLength', visibleLength],
    ['the fallback without Intl.Segmenter', clusterLength],
  ] as const) {
    describe(name, () => {
      it('counts a Yoruba name as its reader does, composed or decomposed', () => {
        expect(count(YORUBA.normalize('NFC'))).toBe(19);
        expect(count(YORUBA.normalize('NFD'))).toBe(19);
      });

      it('counts a family and a flag as one each', () => {
        expect(count(EMOJI)).toBe(3);
        expect(count('👍🏽')).toBe(1);
      });

      it('counts Latin text and a line break as before', () => {
        expect(count('Adaeze')).toBe(6);
        expect(count('a\r\nb')).toBe(3);
        expect(count('')).toBe(0);
      });

      it('agrees with Intl.Segmenter on letters with a dot and a tone', () => {
        expect(count(marked(30))).toBe(30);
        expect(count('\u1EB9\u0300'.repeat(30))).toBe(30);
      });
    });
  }
});

describe('each limit counts visible characters', () => {
  const fields: [string, (typed: string) => number, number][] = [
    ['a host name', hostNameLength, 60],
    ['an event name', eventNameLength, 120],
    ['an arrival note', arrivalNoteLength, 500],
    ['a guest or companion name', nameLength, 200],
    ['a guest group name', groupNameLength, 60],
    ['a need’s Other words and note', needsLength, 500],
  ];

  for (const [field, length, most] of fields) {
    it(`${field}: ${most} marked letters count ${most}, Yoruba 19, emoji 3`, () => {
      expect(length(marked(most))).toBe(most);
      expect(length(marked(most).normalize('NFC'))).toBe(most);
      expect(length(YORUBA.normalize('NFD'))).toBe(19);
      expect(length(EMOJI)).toBe(3);
    });
  }

  it('refuses a host name only past 60 letters, quoting the letters typed', () => {
    expect(hostProblems([marked(60)])).toEqual([null]);
    expect(hostProblems([marked(61)])).toEqual([{ problem: 'hostTooLong', length: 61 }]);
  });

  it('refuses a venue name and address only past their letters', () => {
    const venue = { name: marked(120), address: marked(300), addressId: null, note: marked(500) };

    expect(venueProblems(venue)).toEqual([]);
    expect(
      venueProblems({ ...venue, name: marked(121), address: marked(301), note: marked(501) }),
    ).toEqual([
      { field: 'venueName', problem: 'venueNameTooLong' },
      { field: 'venueAddress', problem: 'venueAddressTooLong' },
      { field: 'arrivalNote', problem: 'arrivalNoteTooLong' },
    ]);
  });

  it('refuses an organisation name only past 100 letters, quoting the letters typed', () => {
    expect(newOrganisationProblem('name', marked(100))).toBeNull();
    expect(newOrganisationProblem('name', marked(101))).toEqual({ kind: 'nameLong', length: 101 });
  });
});
