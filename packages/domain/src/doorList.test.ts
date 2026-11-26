import type { CheckIn, CheckInGuest } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  countLine,
  doorMatch,
  doorRows,
  listedAs,
  sameName,
  seatWords,
  walkInProblem,
} from './doorList.ts';
import { type Translate } from './eventWords.ts';
const t = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as Translate;

const ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

function guest(id: string, fullName: string, more: Partial<CheckInGuest> = {}): CheckInGuest {
  return {
    id,
    fullName,
    reply: 'coming',
    repliedAt: null,
    code: null,
    walkIn: false,
    arrival: null,
    seat: null,
    companions: [],
    ...more,
  };
}

const LIST: CheckIn = {
  state: 'open',
  opensAt: '2026-11-21T16:00:00+01:00',
  timeZone: 'Africa/Lagos',
  seated: false,
  count: { attended: 1, expected: 4 },
  guests: [
    guest('g_z', 'Zainab Bello'),
    guest('g_a', ADAEZE, {
      companions: [
        { id: 'c_1', fullName: 'Rui Duarte', state: 'coming', arrival: null, seat: null },
        { id: 'c_2', fullName: null, state: 'coming', arrival: null, seat: null },
        { id: 'c_3', fullName: null, state: 'coming', arrival: null, seat: null },
      ],
    }),
    guest('g_e', 'Émile Ávila', { walkIn: true, reply: 'noReply' }),
  ],
};

const OLUWASEUN = 'Olúwaseun Adébáyọ̀';
const FOLASADE = 'Chief Mrs Folasade Okonkwo-Williams';

const DOOR: CheckIn = {
  ...LIST,
  guests: [
    guest('d_s', 'Seun Bello'),
    guest('d_w', OLUWASEUN),
    guest('d_f', FOLASADE),
    guest('d_c', 'Chinedu Eze'),
    guest('d_k', 'Kemi Okafor', {
      companions: [
        { id: 'd_o', fullName: 'Olusegun Eze', state: 'coming', arrival: null, seat: null },
      ],
    }),
  ],
};

const found = (typed: string) => doorRows(t, DOOR, typed, 'en').map((row) => row.name);
describe('finding a guest inside a word of their name (sc-85893)', () => {
  it('lists the names that start with what was typed, then those that only hold it', () => {
    expect(found('seun')).toEqual(['Seun Bello', OLUWASEUN]);
    expect(found('seun adebayo')).toEqual([OLUWASEUN]);
    expect(found('okon fola')).toEqual([FOLASADE]);
  });

  it('sorts each group A to Z', () => {
    expect(found('eun')).toEqual([OLUWASEUN, 'Seun Bello']);
  });

  it('finds inside a word only from 3 letters', () => {
    expect(found('kwo')).toEqual([FOLASADE]);
    expect(found('sade williams')).toEqual([FOLASADE]);
    expect(found('nedu')).toEqual(['Chinedu Eze']);
    expect(found('ne')).toEqual([]);
    expect(doorMatch('Chinedu Eze', 'ned')).toBe('inside');
    expect(doorMatch('Chinedu Eze', 'ed eze')).toBeNull();
  });

  it('shows a companion found inside a word under their host, in the group they were found by', () => {
    expect(doorRows(t, DOOR, 'segun', 'en').map((row) => [row.id, row.companion])).toEqual([
      ['d_k', false],
      ['d_o', true],
    ]);
  });

  it('keeps a host and the companions shown under them in the first group either belongs to', () => {
    const both: CheckIn = {
      ...DOOR,
      guests: [
        guest('d_a', 'Abiola Okeze'),
        guest('d_z', 'Zara Bello', {
          companions: [
            { id: 'd_y', fullName: 'Eze Ade', state: 'coming', arrival: null, seat: null },
          ],
        }),
      ],
    };
    expect(doorRows(t, both, 'eze', 'en').map((row) => row.id)).toEqual(['d_z', 'd_y', 'd_a']);
  });
});

describe('finding a guest at the door (sc-1454)', () => {
  it('matches every typed word as the start of a word in the name, any order, ignoring case and accents', () => {
    expect(doorMatch(ADAEZE, 'okon ada')).toBe('start');
    expect(doorMatch(ADAEZE, 'WILL')).toBe('start');
    expect(doorMatch('Émile Ávila', 'emile avi')).toBe('start');
  });

  it('lists everyone A to Z, each companion under their host, an unnamed one as the guest of their host, numbered', () => {
    expect(doorRows(t, LIST, '', 'en').map((row) => row.name)).toEqual([
      ADAEZE,
      'Rui Duarte',
      `guestList.guestOf {"host":"${ADAEZE}"}`,
      `guestList.guestOfNth {"host":"${ADAEZE}","nth":2}`,
      'Émile Ávila',
      'Zainab Bello',
    ]);
  });

  it('finds a companion by their own name and shows them under their host', () => {
    expect(doorRows(t, LIST, 'rui', 'en').map((row) => [row.id, row.companion])).toEqual([
      ['g_a', false],
      ['c_1', true],
    ]);
  });

  it('reads Walk-in in place of a walk-in’s reply', () => {
    expect(doorRows(t, LIST, 'emile', 'en')[0]?.reply).toBe('walkIn');
  });
});

describe('the count', () => {
  it('reads attended of expected, and attended alone with nobody expected', () => {
    expect(countLine(t, LIST.count)).toBe('checkIn.count {"count":1,"expected":4}');
    expect(countLine(t, { attended: 37, expected: 0 })).toBe('checkIn.countAlone {"count":37}');
  });
});
describe('a walk-in', () => {
  it('needs a name of at most 200 characters, trimmed', () => {
    expect(walkInProblem('   ')).toBe('blank');
    expect(walkInProblem('a'.repeat(201))).toBe('long');
    expect(walkInProblem(` ${'a'.repeat(200)} `)).toBeNull();
  });

  it('asks about the first guest Search by name would find when no name is the same (sc-85893)', () => {
    expect(listedAs(t, DOOR, 'Seun Adebayo', 'en')?.name).toBe(OLUWASEUN);
    expect(listedAs(t, DOOR, 'seun', 'en')?.id).toBe('d_s');
    expect(listedAs(t, DOOR, 'segun', 'en')).toMatchObject({ id: 'd_o', name: 'Olusegun Eze' });
    expect(listedAs(t, DOOR, 'Kofi Asante', 'en')).toBeNull();
    expect(listedAs(t, DOOR, '  ', 'en')).toBeNull();
  });

  it('names the companion who matched, never the host shown above them (sc-85893, 23 Nov)', () => {
    expect(listedAs(t, DOOR, 'Segun Eze', 'en')).toMatchObject({
      id: 'd_o',
      name: 'Olusegun Eze',
      companion: true,
    });
  });

  it('names the guest with the same name before the first one a search finds', () => {
    const both: CheckIn = { ...DOOR, guests: [...DOOR.guests, guest('d_x', 'Aseun Bello')] };
    expect(listedAs(t, both, 'aseun bello', 'en')?.id).toBe('d_x');
  });

  it('counts a name as a person sees it, as the API does', () => {
    expect(walkInProblem('👍🏾'.repeat(120))).toBeNull();
    expect(walkInProblem('Ọ̀'.repeat(200))).toBeNull();
    expect(walkInProblem('👍🏾'.repeat(201))).toBe('long');
  });

  it('finds the same name on the list, ignoring case and accents', () => {
    expect(sameName(t, LIST, 'chief mrs adaeze okonkwo-williams')?.id).toBe('g_a');
    expect(sameName(t, LIST, 'RUI DUARTE')?.id).toBe('c_1');
    expect(sameName(t, LIST, 'Kofi Asante')).toBeNull();
  });
});

const words = ((key: string, values?: Record<string, string | number>) => {
  const said: Record<string, string> = {
    'checkIn.seatInRow': `Row ${values?.row}, seat ${values?.seat}`,
    'checkIn.seatPlaced': `${values?.place} · ${values?.section}`,
    'checkIn.noSeat': 'No seat yet',
  };

  return said[key] ?? key;
}) as unknown as Translate;

describe('the seat under each name at the door (sc-60684)', () => {
  it('words each kind of seat by the host’s own names, with its section or none', () => {
    expect(seatWords(words, { kind: 'table', name: 'Table 4', section: 'Main hall' })).toBe(
      'Table 4 · Main hall',
    );
    expect(seatWords(words, { kind: 'table', name: 'Table 4', section: null })).toBe('Table 4');
    expect(
      seatWords(words, { kind: 'row', name: 'C', seat: 14, section: 'Upper balcony east' }),
    ).toBe('Row C, seat 14 · Upper balcony east');
    expect(seatWords(words, { kind: 'row', name: 'C', seat: 4, section: null })).toBe(
      'Row C, seat 4',
    );
    expect(seatWords(words, { kind: 'seat', name: 'Seat 12', section: 'By the bar' })).toBe(
      'Seat 12 · By the bar',
    );
    expect(seatWords(words, { kind: 'seat', name: 'Seat 12', section: null })).toBe('Seat 12');
  });

  it('gives each person their own line, and No seat yet to anyone without one', () => {
    const seated: CheckIn = {
      ...LIST,
      seated: true,
      guests: [
        guest('g_a', ADAEZE, {
          seat: { kind: 'table', name: 'Table 4', section: 'Main hall' },
          companions: [
            {
              id: 'c_1',
              fullName: 'Rui Duarte',
              state: 'coming',
              arrival: null,
              seat: { kind: 'table', name: 'Table 4', section: 'Main hall' },
            },
            { id: 'c_2', fullName: null, state: 'held', arrival: null, seat: null },
          ],
        }),
        guest('g_k', 'Kofi Asante', { walkIn: true }),
      ],
    };

    expect(doorRows(words, seated, '', 'en').map((row) => row.seat)).toEqual([
      'Table 4 · Main hall',
      'Table 4 · Main hall',
      'No seat yet',
      'No seat yet',
    ]);
    expect(sameName(words, seated, 'kofi asante')?.seat).toBe('No seat yet');
  });

  it('shows no line on an event nobody is seated on', () => {
    expect(doorRows(words, LIST, '', 'en').every((row) => row.seat == null)).toBe(true);
  });
});
