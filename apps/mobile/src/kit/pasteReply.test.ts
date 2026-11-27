import type { Guest } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  QUOTE_LINES,
  clipQuote,
  hasText,
  pasteBeside,
  pasteShown,
  whoseRows,
} from './pasteReply.ts';

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});
const t = i18n.t.bind(i18n);

function guest(id: string, fullName: string, more: Partial<Guest> = {}): Guest {
  return {
    id,
    fullName,
    greetAs: null,
    group: null,
    email: null,
    mobile: null,
    language: null,
    chosenLanguage: null,
    messageLanguage: null,
    reply: 'noReply',
    repliedAt: null,
    invitation: { at: '2026-11-12T10:00:00+01:00', how: 'whatsapp', by: 'Folake Adeyemi' },
    companions: [],
    ...more,
  };
}

const rows = (guests: Guest[], typed = '') =>
  whoseRows(guests, typed, t, 'Europe/London', 'en-GB', 'en').map((row) => [
    row.guest.fullName,
    row.line,
  ]);

describe('a copied message', () => {
  it('counts only with more than spaces and line breaks in it', () => {
    expect(hasText('Yes, we’ll be there')).toBe(true);
    expect(hasText(' \n\t ')).toBe(false);
    expect(hasText('')).toBe(false);
    expect(hasText(null)).toBe(false);
  });
});

describe('Paste a reply', () => {
  it('shows with guests.manage while replies are open, once somebody is invited', () => {
    expect(pasteShown(true, null, 1)).toBe(true);
    expect(pasteShown(false, null, 1)).toBe(false);
    expect(pasteShown(true, '2026-11-05', 1)).toBe(false);
    expect(pasteShown(true, null, 0)).toBe(false);
  });
});

describe('Whose reply is this?', () => {
  const emeka = guest('g1', 'Emeka Obi');
  const bisi = guest('g2', 'Bisi Ade', { invitation: null });
  const ada = guest('g3', 'Ada Okon', {
    invitation: { at: '2026-11-14T09:00:00+01:00', how: 'soirelyMessage', by: null },
  });
  const zara = guest('g4', 'Zara Okon');
  const ngozi = guest('g5', 'Ngozi Okon', {
    reply: 'coming',
    repliedAt: '2026-11-13T09:00:00+01:00',
    invitation: { at: '2026-11-13T09:00:00+01:00', how: 'reply', by: null },
  });

  it('lists the guests still waiting, newest invitation first and the same moment A to Z, in sc-3788’s words without who marked them', () => {
    expect(rows([zara, emeka, bisi, ada, ngozi])).toEqual([
      ['Ada Okon', 'No reply · Invited by Soirely’s message, 14 Nov'],
      ['Emeka Obi', 'No reply · Invited, WhatsApp, 12 Nov'],
      ['Zara Okon', 'No reply · Invited, WhatsApp, 12 Nov'],
    ]);
  });

  it('finds any invited guest, those who replied too, but never one not yet invited or a companion', () => {
    const host = guest('g6', 'Femi Okon', {
      companions: [
        { id: 'c1', fullName: 'Okon Junior', state: 'held', coming: false, namedByGuest: false },
      ],
    });

    expect(
      rows([zara, ada, ngozi, host, guest('g7', 'Okon Bassey', { invitation: null })], 'okon'),
    ).toEqual([
      ['Ada Okon', 'No reply · Invited by Soirely’s message, 14 Nov'],
      ['Ngozi Okon', 'Coming · Invited when they replied, 13 Nov'],
      ['Femi Okon', 'No reply · Invited, WhatsApp, 12 Nov'],
      ['Zara Okon', 'No reply · Invited, WhatsApp, 12 Nov'],
    ]);
    expect(rows([bisi], 'bisi')).toEqual([]);
  });
});

describe('Their message, clipped (sc-54450)', () => {
  it('ends in … however its sixth line ends', () => {
    const mid = ['one ', 'two ', 'three ', 'four ', 'five ', 'six and ', 'seven'];
    expect(clipQuote(mid)).toBe('one two three four five six and…');
    const atBreak = ['one\n', 'two\n', 'three\n', 'four\n', 'five\n', 'six\n', 'seven'];
    expect(clipQuote(atBreak)).toBe('one\ntwo\nthree\nfour\nfive\nsix…');
  });

  it('puts the … after the last words when the sixth line is blank', () => {
    const blank = ['one\n', 'two\n', 'three\n', 'four\n', 'five\n', '\n', 'seven'];
    expect(clipQuote(blank)).toBe('one\ntwo\nthree\nfour\nfive…');
  });

  it('leaves a quote that fits whole', () => {
    expect(
      clipQuote(['one', 'two', 'three', 'four', 'five', 'six'].slice(0, QUOTE_LINES)),
    ).toBeNull();
  });
});

describe('pasteBeside', () => {
  it('keeps Paste beside Find a guest on an upright iPad below AX1', () => {
    expect(pasteBeside('tabletPortrait', 1)).toBe(true);
    expect(pasteBeside('tabletPortrait', 1.5)).toBe(true);
  });

  it('moves Paste to a row of its own on an upright iPad from AX1 on', () => {
    expect(pasteBeside('tabletPortrait', 2)).toBe(false);
    expect(pasteBeside('tabletPortrait', 3.1)).toBe(false);
  });

  it('never puts Paste beside on a phone or an iPad on its side', () => {
    expect(pasteBeside('phone', 1)).toBe(false);
    expect(pasteBeside('tabletLandscape', 1)).toBe(false);
  });
});
