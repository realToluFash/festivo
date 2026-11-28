import type { DoorCodeCard } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  BLANK_FORM,
  type CodeClock,
  cardStep,
  countLine,
  earlierEnds,
  earlierStart,
  endsWords,
  firstLine,
  formFrom,
  heldLine,
  inMadeOrder,
  makeLines,
  makeNewAsks,
  newCode,
  renewal,
  roleLine,
  saidCode,
  shownCode,
  underCard,
} from './doorCodes.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

/** As DoorCodesController::card answers it (packages/api-client's client test holds the same). */
const CARD: DoorCodeCard = {
  id: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
  code: 'K7P2QX9M',
  link: 'https://soirely.test/d/K7P2QX9M',
  qrSvg: '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  role: 'can_check_in',
  jobLabel: 'Bar and drinks',
  useCap: 30,
  used: 14,
  status: 'working',
  expiresAt: '2026-11-14T23:30:00+00:00',
  stoppedAt: null,
  createdAt: '2026-11-07T16:00:00+00:00',
};

const ON_THE_DAY: CodeClock = {
  endsAt: '2026-11-14T23:30:00+00:00',
  timeZone: 'Europe/Lisbon',
  locale: 'en-GB',
  now: new Date('2026-11-14T13:45:00Z'),
};
const A_WEEK_BEFORE: CodeClock = { ...ON_THE_DAY, now: new Date('2026-11-07T09:41:00Z') };

describe('the code as it is read', () => {
  it('is shown in two groups of four and spelt out to a screen reader', () => {
    expect(shownCode('K7P2QX9M')).toBe('K7P2 QX9M');
    expect(saidCode('K7P2QX9M')).toBe('K 7 P 2, Q X 9 M');
  });

  it('starts with Door code, then the role and the label', () => {
    expect(roleLine(CARD, t)).toBe('Door code · Can check guests in · Bar and drinks');
    expect(heldLine({ role: 'can_view', jobLabel: null }, t)).toBe('Can view');
  });
});

describe('the count line', () => {
  it('says the time alone on the event’s day and names the day before it', () => {
    expect(countLine(CARD, ON_THE_DAY, t)).toBe('14 of 30 used · until 23:30');
    expect(countLine(CARD, A_WEEK_BEFORE, t)).toBe('14 of 30 used · until Sat 14 Nov, 23:30');
  });

  it('counts who came in once a code is stopped, and says so at 0 and 1', () => {
    const stopped = { ...CARD, status: 'stopped' as const };

    expect(countLine(stopped, ON_THE_DAY, t)).toBe(
      '14 people came in with this code. They keep their access.',
    );
    expect(countLine({ ...stopped, used: 1 }, ON_THE_DAY, t)).toBe(
      '1 person came in with this code. They keep their access.',
    );
    expect(countLine({ ...stopped, used: 0 }, ON_THE_DAY, t)).toBe(
      'Nobody came in with this code.',
    );
  });

  it('says when an expired code ended', () => {
    const expired = { ...CARD, status: 'expired' as const, expiresAt: '2026-11-14T15:00:00+00:00' };

    expect(countLine(expired, ON_THE_DAY, t)).toBe('14 of 30 used · ended at 15:00');
    expect(countLine({ ...expired, used: 0 }, ON_THE_DAY, t)).toBe(
      'Nobody came in with this code.',
    );
  });
});

describe('the card’s steps', () => {
  it('shows a working code and makes a new one for any other', () => {
    expect(cardStep('working')).toBe('show');
    expect(cardStep('full')).toBe('makeNew');
    expect(cardStep('stopped')).toBe('makeNew');
    expect(cardStep('expired')).toBe('makeNew');
  });

  it('offers both under a working card, Stop under a full one, and nothing under the rest', () => {
    expect(underCard('working')).toEqual(['makeNew', 'stop']);
    expect(underCard('full')).toEqual(['stop']);
    expect(underCard('stopped')).toEqual([]);
    expect(underCard('expired')).toEqual([]);
  });

  it('asks before a new code only while the old one still lets people in', () => {
    expect(makeNewAsks('working')).toBe(true);
    expect(makeNewAsks('full')).toBe(true);
    expect(makeNewAsks('stopped')).toBe(false);
    expect(makeNewAsks('expired')).toBe(false);
  });

  it('keeps the codes in the order they were made, the API listing the newest first', () => {
    const older = { ...CARD, id: 'older' };
    const newer = { ...CARD, id: 'newer' };

    expect(inMadeOrder([newer, older]).map((one) => one.id)).toEqual(['older', 'newer']);
  });
});

describe('Make', () => {
  it('starts on Can view, the least access, ending when the event ends', () => {
    expect(BLANK_FORM).toEqual({ role: 'can_view', label: '', cap: '', ends: { kind: 'event' } });
  });

  it('needs a whole number from 1 to 500', () => {
    const lines = (cap: string) => makeLines({ ...BLANK_FORM, cap }, ON_THE_DAY, t).cap;

    expect(lines('')).toBe('Enter how many people can use this code.');
    expect(lines('  ')).toBe('Enter how many people can use this code.');
    expect(lines('0')).toBe('Use a whole number from 1 to 500.');
    expect(lines('501')).toBe('Use a whole number from 1 to 500.');
    expect(lines('2.5')).toBe('Use a whole number from 1 to 500.');
    expect(lines('3000')).toBe('Use a whole number from 1 to 500.');
    expect(lines(' 30 ')).toBeNull();
    expect(lines('500')).toBeNull();
    expect(lines('1')).toBeNull();
  });

  it('refuses an earlier end that has passed, on the event’s clock', () => {
    const past = makeLines(
      { ...BLANK_FORM, cap: '30', ends: { kind: 'earlier', date: '2026-11-14', time: '13:30' } },
      ON_THE_DAY,
      t,
    );
    const ahead = makeLines(
      { ...BLANK_FORM, cap: '30', ends: { kind: 'earlier', date: '2026-11-14', time: '18:00' } },
      ON_THE_DAY,
      t,
    );

    expect(past).toEqual({ cap: null, ends: 'Choose a time that has not passed yet.' });
    expect(ahead).toEqual({ cap: null, ends: null });
    expect(firstLine(past)).toBe('ends');
    expect(firstLine({ cap: 'x', ends: 'y' })).toBe('cap');
  });

  it('sends the instant with its offset, the label trimmed or null, and what it replaces', () => {
    expect(
      newCode(
        {
          role: 'can_check_in',
          label: '  Bar  ',
          cap: '30',
          ends: { kind: 'earlier', date: '2026-07-14', time: '18:00' },
        },
        { ...ON_THE_DAY, now: new Date('2026-07-01T00:00:00Z') },
        'old',
      ),
    ).toEqual({
      role: 'can_check_in',
      jobLabel: 'Bar',
      useCap: 30,
      expiresAt: '2026-07-14T17:00:00.000Z',
      replaces: 'old',
    });
    expect(newCode({ ...BLANK_FORM, cap: '5' }, ON_THE_DAY, null)).toEqual({
      role: 'can_view',
      jobLabel: null,
      useCap: 5,
      expiresAt: '2026-11-14T23:30:00.000Z',
    });
  });

  it('turns an earlier end at or past the event’s into When the event ends', () => {
    expect(earlierEnds('2026-11-14', '23:30', ON_THE_DAY)).toEqual({ kind: 'event' });
    expect(earlierEnds('2026-11-15', '01:00', ON_THE_DAY)).toEqual({ kind: 'event' });
    expect(earlierEnds('2026-11-14', '23:00', ON_THE_DAY)).toEqual({
      kind: 'earlier',
      date: '2026-11-14',
      time: '23:00',
    });
  });

  it('first offers the half hour before the event ends', () => {
    expect(earlierStart(ON_THE_DAY)).toEqual({
      kind: 'earlier',
      date: '2026-11-14',
      time: '23:00',
    });
    expect(earlierStart({ ...ON_THE_DAY, endsAt: '2026-11-14T23:45:00+00:00' })).toEqual({
      kind: 'earlier',
      date: '2026-11-14',
      time: '23:00',
    });
  });

  it('writes the Ends row with its day', () => {
    expect(endsWords({ kind: 'event' }, ON_THE_DAY, t)).toBe(
      'When the event ends · Sat 14 Nov, 23:30',
    );
    expect(endsWords({ kind: 'earlier', date: '2026-11-14', time: '18:00' }, ON_THE_DAY, t)).toBe(
      'Earlier · Sat 14 Nov, 18:00',
    );
  });
});

describe('a new code in place of an old one', () => {
  it('opens Make from a stopped code with its role, label and number, ending with the event', () => {
    expect(
      formFrom({ ...CARD, status: 'stopped', expiresAt: '2026-11-14T20:00:00+00:00' }),
    ).toEqual({
      role: 'can_check_in',
      label: 'Bar and drinks',
      cap: '30',
      ends: { kind: 'event' },
    });
  });

  it('keeps the old end while it is ahead, and takes the event’s once it has passed', () => {
    expect(renewal(CARD, ON_THE_DAY)).toEqual({
      role: 'can_check_in',
      jobLabel: 'Bar and drinks',
      useCap: 30,
      expiresAt: CARD.expiresAt,
      replaces: CARD.id,
    });
    expect(renewal({ ...CARD, expiresAt: '2026-11-14T12:00:00+00:00' }, ON_THE_DAY).expiresAt).toBe(
      ON_THE_DAY.endsAt,
    );
  });
});
