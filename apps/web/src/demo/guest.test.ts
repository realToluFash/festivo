import { describe, expect, it } from 'vitest';

import {
  EVENT,
  GUEST_PAGES,
  LANGUAGES,
  codePath,
  dayOf,
  eventDay,
  eventTime,
  forTheDay,
  isGuestState,
  layoutOf,
  sentWhen,
  shows,
  showsMessages,
  startOf,
  twoColumns,
  wordsFor,
} from './guest.ts';

const LINKED = GUEST_PAGES.flatMap((page) => page.states);
const STATES = LINKED.map((one) => /state=(\w+)/u.exec(one.to)?.[1] ?? '');

describe('the guest’s page states (sc-31306)', () => {
  it('links every state the boards draw once, in the boards’ four rows', () => {
    expect(GUEST_PAGES.map((page) => page.name)).toEqual([
      'Answering',
      'Coming back, and answers closing',
      'Over, gone, and the rest',
      'The hosts’ messages and the guest’s own',
    ]);
    expect(STATES).toHaveLength(44);
    expect(new Set(STATES).size).toBe(44);
    expect(STATES.every(isGuestState)).toBe(true);
    expect(LINKED.find((one) => one.to.includes('messageArrival'))?.to).toBe(
      '/demo/guest?state=messageArrival#m-3',
    );
  });

  it('opens `open` for a state it does not know', () => {
    expect(startOf('nonsense')).toEqual(startOf('open'));
    expect(startOf(null).view).toEqual({ kind: 'answer', busy: null, note: null });
  });

  it('starts each state where the spec says, with its focus target', () => {
    expect(startOf('check')).toMatchObject({ view: { kind: 'check' }, want: 'checkHead' });
    expect(startOf('changing')).toMatchObject({
      recorded: { answer: 'coming', on: '2026-10-20' },
      want: 'newHead',
    });
    expect(startOf('openNoDate').replyBy).toBeNull();
    expect(startOf('zone').readerZone).not.toBe(EVENT.timeZone);
    expect(startOf('french')).toMatchObject({ lang: 'fr', menuOpen: true });
    expect(startOf('replyFailed')).toMatchObject({ draftFailed: true, want: 'sendMessage' });
    expect(startOf('gone').page).toBe('gone');
  });

  it('keeps the door code and the calendar for Coming while there is something to attend', () => {
    expect(forTheDay(startOf('coming'))).toBe(true);
    expect(forTheDay(startOf('closed'))).toBe(true);
    expect(forTheDay(startOf('replyByClosed'))).toBe(true);
    expect(forTheDay(startOf('paused'))).toBe(false);
    expect(forTheDay(startOf('notComing'))).toBe(false);
    expect(forTheDay(startOf('finished'))).toBe(false);
    expect(forTheDay(startOf('changing'))).toBe(false);
  });

  it('drops the details and the foot for Check and send and Tell us, and the hosts when called off', () => {
    expect(shows(startOf('check'))).toMatchObject({ details: false, foot: false });
    expect(shows(startOf('tellUs'))).toMatchObject({ details: false, foot: false });
    expect(shows(startOf('open'))).toEqual({ details: true, foot: true, hosts: true });
    expect(shows(startOf('calledOff')).hosts).toBe(false);
  });

  it('shows the messages only when there are some', () => {
    expect(showsMessages(startOf('coming'))).toBe(false);
    expect(showsMessages(startOf('message'))).toBe(true);
  });
});

describe('the breakpoints (spec §3)', () => {
  const at = (width: number) =>
    layoutOf({ small: width < 360, phone: width <= 640, wide: width >= 1024, desk: width >= 1280 });

  it.each([
    [320, 'small'],
    [402, 'phone'],
    [640, 'phone'],
    [641, 'upright'],
    [834, 'upright'],
    [1023, 'upright'],
    [1024, 'side'],
    [1194, 'side'],
    [1280, 'desk'],
  ] as const)('%i wide is %s', (width, layout) => {
    expect(at(width)).toBe(layout);
  });

  it('puts two columns side by side from 1024', () => {
    expect(twoColumns(at(1023))).toBe(false);
    expect(twoColumns(at(1024))).toBe(true);
  });
});

describe('the words and dates', () => {
  it('reads main’s words and the stories’ in English', () => {
    const en = wordsFor('en');

    expect(en.invited).toBe('You are invited');
    expect(en.hostedBy).toBe('Hosted by');
    expect(en.hosts).toBe('Adaeze Obi and Tunde Bakare');
    expect(en.noAccount).toBe('You do not need an account to answer.');
    expect(en.tellThanks).toBe(
      'Thank you. Adaeze Obi and Tunde Bakare have been told and will look into it. You can close this page.',
    );
    expect(en.writeTo).toBe('Write to Adaeze Obi and Tunde Bakare');
    expect(en.answered('notSure', dayOf('2026-10-27', 'en'))).toBe(
      'You answered Not sure yet on Tuesday, October 27.',
    );
    expect(en.timeInZone('6:00 PM', 'Europe/London')).toBe('6:00 PM Europe/London');
  });

  it('writes French as the board does: main’s, #5535’s, and the bracketed proposals', () => {
    const fr = wordsFor('fr');

    expect(fr.invited).toBe('Vous avez une invitation');
    expect(wordsFor('es').invited).toBe('Tiene una invitación');
    expect(wordsFor('pt').invited).toBe('Tem um convite');
    expect(fr.yourAnswer).toBe('[Votre réponse]');
    expect(fr.replyBy(dayOf('2026-10-30', 'fr'))).toBe(
      '[Merci de répondre avant le vendredi 30 octobre. Vous pourrez modifier votre réponse d’ici là.]',
    );
    expect(fr.tell).toBe('Vous n’êtes pas Maria Fernanda Albuquerque Santos ? Dites-le-nous');
    expect(fr.hosts).toBe('Adaeze Obi et Tunde Bakare');
    expect(fr.languageCurrent('Français')).toMatch(/^Langue\s:\sFrançais$/u);
  });

  it('dates the event in its own zone and the reader’s language', () => {
    expect(eventDay('en')).toBe('Thursday, November 5, 2026');
    expect(eventTime('en').replace(/\s/u, ' ')).toBe('6:00 PM');
    expect(eventDay('fr')).toBe('jeudi 5 novembre 2026');
    expect(eventTime('fr')).toBe('18:00');
    expect(sentWhen('2026-11-02T21:14:00Z', 'en', 'Europe/London').replace(/\s/gu, ' ')).toBe(
      'Mon, Nov 2 · 9:14 PM',
    );
  });

  it('names the four languages in their own names', () => {
    expect(LANGUAGES.map((one) => one.name)).toEqual([
      'English',
      'Español',
      'Français',
      'Português',
    ]);
  });
});

describe('the door code', () => {
  it('is the same placeholder every time, with its three corner squares', () => {
    const path = codePath();

    expect(codePath()).toBe(path);
    expect(path).toContain('M2 2h1v1h-1z');
    expect(path).toContain('M26 2h1v1h-1z');
    expect(path).toContain('M2 26h1v1h-1z');
  });
});
