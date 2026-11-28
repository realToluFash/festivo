import { ApiError, ApiUnreachableError, type ShiftClockCard } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  actionOf,
  answerOf,
  hoursWords,
  lineWords,
  recordedWords,
  timeWords,
} from './shiftClock.ts';

const i18n = createInstance();

beforeAll(() =>
  i18n.init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const ZONE = 'Africa/Lagos';
const LOCALE = 'en-GB';
const SATURDAY = new Date('2026-11-28T16:10:00Z');
const SUNDAY = new Date('2026-11-29T02:05:00Z');

const CARD: ShiftClockCard = {
  phase: 'on',
  opensAt: '2026-11-28T16:00:00+01:00',
  closesAt: '2026-11-29T01:00:00+01:00',
  clockedInAt: '2026-11-28T16:58:00+01:00',
  clockedOutAt: null,
  outUntil: '2026-11-29T07:00:00+01:00',
  workedMinutes: null,
};

describe('a time on the clock card', () => {
  it('reads alone today in the event’s zone and with its weekday on another day, never the date', () => {
    expect(timeWords(i18n.t, CARD.clockedInAt!, SATURDAY, ZONE, LOCALE)).toBe('16:58');
    expect(timeWords(i18n.t, CARD.clockedInAt!, SUNDAY, ZONE, LOCALE)).toBe('Saturday 16:58');
  });

  it('counts hours and minutes as the card words them', () => {
    expect(hoursWords(i18n.t, 524)).toBe('8 h 44 min');
    expect(hoursWords(i18n.t, 480)).toBe('8 h');
    expect(hoursWords(i18n.t, 44)).toBe('44 min');
    expect(hoursWords(i18n.t, 0)).toBe('0 h');
  });
});

describe('a tap on the card', () => {
  it('clocks in while the window is open and out while on, nothing otherwise', () => {
    expect(actionOf({ ...CARD, phase: 'ready' })).toBe('in');
    expect(actionOf(CARD)).toBe('out');
    expect(actionOf({ ...CARD, phase: 'before' })).toBeNull();
    expect(actionOf({ ...CARD, phase: 'closed' })).toBeNull();
  });

  it('shows the card as recorded, and says so when nothing changed', () => {
    expect(
      answerOf('in', { outcome: { outcome: 'recorded', clock: CARD, signedOut: false } }),
    ).toEqual({ kind: 'shown', clock: CARD, line: null });
    expect(
      answerOf('in', { outcome: { outcome: 'already', clock: CARD, signedOut: false } }),
    ).toEqual({ kind: 'shown', clock: CARD, line: 'alreadyIn' });
    expect(
      answerOf('out', { outcome: { outcome: 'already', clock: CARD, signedOut: false } }),
    ).toEqual({ kind: 'shown', clock: CARD, line: 'alreadyOut' });
  });

  it('keeps the button as the retry with no connection, and reads the night again on a refusal', () => {
    expect(answerOf('out', { error: new ApiUnreachableError() })).toEqual({
      kind: 'offline',
      line: 'offOut',
    });
    const conflict = new ApiError({ type: 'conflict', title: 'Conflict', status: 409 });
    expect(answerOf('in', { error: conflict })).toEqual({ kind: 'reread' });
  });

  it('words its lines, each time by the weekday rule', () => {
    const out = { ...CARD, phase: 'off' as const, clockedOutAt: '2026-11-29T01:42:00+01:00' };

    expect(lineWords(i18n.t, 'alreadyIn', CARD, SUNDAY, ZONE, LOCALE)).toBe(
      'You had already clocked in at Saturday 16:58. Nothing has changed.',
    );
    expect(lineWords(i18n.t, 'alreadyOut', out, SUNDAY, ZONE, LOCALE)).toBe(
      'You had already clocked out at 01:42. Nothing has changed.',
    );
    expect(lineWords(i18n.t, 'offIn', CARD, SUNDAY, ZONE, LOCALE)).toMatch(/^Could not clock in/u);
    expect(lineWords(i18n.t, null, CARD, SUNDAY, ZONE, LOCALE)).toBeNull();
    expect(recordedWords(i18n.t, CARD, SATURDAY, ZONE, LOCALE)).toBe('Clocked in at 16:58');
    expect(recordedWords(i18n.t, out, SUNDAY, ZONE, LOCALE)).toBe('Clocked out at 01:42');
  });
});
