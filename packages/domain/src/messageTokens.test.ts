import { describe, expect, it } from 'vitest';

import {
  type MessageSegment,
  fillMessage,
  greetAsLength,
  greetingOf,
  hasTypedBraces,
  messageSegments,
  messageWire,
  tokenDate,
  tokenValues,
  tokensInOrder,
} from './messageTokens.ts';

const SENT = new Date('2026-11-21T13:20:00Z');
const ZONE = 'Africa/Lagos';
const ONE_DAY = {
  startsAt: '2026-11-14T16:00:00Z',
  endsAt: '2026-11-14T21:00:00Z',
  timeZone: ZONE,
};
const DAYS = { startsAt: '2026-11-13T16:00:00Z', endsAt: '2026-11-15T20:00:00Z', timeZone: ZONE };
const NEXT_YEAR = {
  startsAt: '2027-11-13T16:00:00Z',
  endsAt: '2027-11-13T22:00:00Z',
  timeZone: ZONE,
};

const segments: MessageSegment[] = [
  { kind: 'text', text: 'Dear ' },
  { kind: 'token', token: 'greeting' },
  { kind: 'text', text: ', {event} is on ' },
  { kind: 'token', token: 'date' },
  { kind: 'text', text: '.' },
];

describe('the message as it travels (sc-3960)', () => {
  it('keeps tokens apart from typed braces, both ways', () => {
    const wire = messageWire(segments);

    expect(wire).toBe('Dear greeting, {event} is on date.');
    expect(messageSegments(wire)).toEqual(segments);
  });

  it('takes a stray mark out of typed text, and reads a mark that names no token as nothing', () => {
    expect(messageWire([{ kind: 'text', text: 'abc' }])).toBe('abc');
    expect(messageSegments('Hi table and  you')).toEqual([
      { kind: 'text', text: 'Hi  and  you' },
    ]);
  });

  it('names each token once, where it first stands', () => {
    expect(tokensInOrder(messageSegments('event greeting event'))).toEqual([
      'event',
      'greeting',
    ]);
    expect(tokensInOrder(messageSegments('No tokens here.'))).toEqual([]);
  });

  it('sees braces typed as text, and not an inserted token', () => {
    expect(hasTypedBraces(segments)).toBe(true);
    expect(hasTypedBraces([{ kind: 'token', token: 'greeting' }])).toBe(false);
  });
});

describe('{greeting}', () => {
  it('is their Greet as, or their full name when they have none or only spaces', () => {
    expect(greetingOf({ fullName: 'Bisi Adewale', greetAs: 'Auntie Bisi' })).toBe('Auntie Bisi');
    expect(greetingOf({ fullName: 'Bisi Adewale', greetAs: null })).toBe('Bisi Adewale');
    expect(greetingOf({ fullName: 'Bisi Adewale', greetAs: '   ' })).toBe('Bisi Adewale');
  });

  it('counts Greet as after trimming, an accented letter once', () => {
    expect(greetAsLength('  Auntie Bisi  ')).toBe(11);
    expect(greetAsLength('é'.repeat(60))).toBe(60);
    expect(greetAsLength(`e${'́'}`.repeat(61))).toBe(61);
  });
});

describe('{date}, in the guest’s language', () => {
  it.each([
    [
      'en',
      'Saturday, Nov 14',
      'Friday, Nov 13\u2009–\u2009Sunday, Nov 15',
      'Saturday, Nov 13, 2027',
    ],
    [
      'es',
      'sábado, 14 nov',
      'viernes, 13 nov\u2009–\u2009domingo, 15 nov',
      'sábado, 13 de nov de 2027',
    ],
    ['fr', 'samedi 14 nov.', 'vendredi 13\u2009–\u2009dimanche 15 nov.', 'samedi 13 nov. 2027'],
    [
      'pt',
      'sábado, 14 de nov.',
      'sexta-feira, 13 de nov.\u2009–\u2009domingo, 15 de nov.',
      'sábado, 13 de nov. de 2027',
    ],
  ])('in %s: one day, several days, and another year', (locale, one, several, another) => {
    expect(tokenDate(ONE_DAY, locale, SENT)).toBe(one);
    expect(tokenDate(DAYS, locale, SENT)).toBe(several);
    expect(tokenDate(NEXT_YEAR, locale, SENT)).toBe(another);
  });

  it('is the day in the event’s zone, not the reader’s', () => {
    const lateInLagos = {
      startsAt: '2026-11-14T22:30:00Z',
      endsAt: '2026-11-14T22:45:00Z',
      timeZone: ZONE,
    };

    expect(tokenDate(lateInLagos, 'en', SENT)).toBe('Saturday, Nov 14');
  });
});

describe('the message filled in for one guest', () => {
  const event = { name: 'Amara & Tobi’s wedding', hosts: ['Funmi', 'Tayo', 'Kemi'], ...ONE_DAY };

  it.each([
    ['en', 'Funmi, Tayo and Kemi'],
    ['es', 'Funmi, Tayo y Kemi'],
    ['fr', 'Funmi, Tayo et Kemi'],
    ['pt', 'Funmi, Tayo e Kemi'],
  ])('fills every token in %s, and leaves typed braces as typed', (locale, hosts) => {
    const values = tokenValues({ fullName: 'Bisi Adewale', greetAs: null }, event, locale, SENT);

    expect(values.hosts).toBe(hosts);
    expect(values.event).toBe('Amara & Tobi’s wedding');
    expect(fillMessage(segments, values)).toBe(
      `Dear Bisi Adewale, {event} is on ${tokenDate(ONE_DAY, locale, SENT)}.`,
    );
  });

  it('gives markup in a name back as text, for the page to escape', () => {
    const values = tokenValues({ fullName: 'X', greetAs: '<b>Bisi</b>' }, event, 'en', SENT);

    expect(fillMessage([{ kind: 'token', token: 'greeting' }], values)).toBe('<b>Bisi</b>');
  });

  it('sends a message with no tokens exactly as written', () => {
    const typed = 'Dinner at seven.\n\nCome hungry!';
    const values = tokenValues({ fullName: 'X' }, event, 'en', SENT);

    expect(fillMessage(messageSegments(messageWire([{ kind: 'text', text: typed }])), values)).toBe(
      typed,
    );
  });
});
