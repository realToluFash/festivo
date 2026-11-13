import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  EVENT,
  GUEST_PAGES,
  answersClosedByDate,
  LANGUAGES,
  agreesOnSend,
  codePath,
  dayOf,
  eventDay,
  eventTime,
  forTheDay,
  isGuestState,
  layoutOf,
  offersWhatsApp,
  sameAnswer,
  sentAnswer,
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
  it('links every state the boards draw once, in the boards’ seven groups', () => {
    expect(GUEST_PAGES.map((page) => page.name)).toEqual([
      'Answering',
      'Coming back, and answers closing',
      'Over, gone, and the rest',
      'In the guest’s own language (sc-3790)',
      'The hosts’ messages and the guest’s own',
      'The hosts’ notes, entries in Messages (sc-3971)',
      'Your messages, opened from the guest’s page (sc-3969, sc-3950)',
      'Your messages, from an email’s link (sc-3969)',
    ]);
    expect(STATES).toHaveLength(89);
    expect(new Set(STATES).size).toBe(89);
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

  it('closes answers by the date with the same instant as Guests: 23:59:59 in the event’s zone', () => {
    const open = startOf('open');

    expect(answersClosedByDate(open)).toBe(false);
    expect(answersClosedByDate({ ...open, now: '2026-10-30T23:59:59Z' })).toBe(false);
    expect(answersClosedByDate({ ...open, now: '2026-10-31T00:00:00Z' })).toBe(true);
    expect(answersClosedByDate({ ...open, now: '2026-11-02T00:00:00Z', replyBy: null })).toBe(
      false,
    );
    expect(answersClosedByDate(startOf('replyByClosed'))).toBe(true);
    expect(answersClosedByDate(startOf('replyByClosedNever'))).toBe(true);
  });

  it('keeps the door code and the calendar for Coming while there is something to attend', () => {
    expect(forTheDay(startOf('coming'))).toBe(true);
    expect(forTheDay(startOf('closed'))).toBe(true);
    expect(forTheDay(startOf('replyByClosed'))).toBe(true);
    expect(forTheDay(startOf('replyByClosedSaved'))).toBe(true);
    expect(forTheDay(startOf('hostRecorded'))).toBe(true);
    expect(forTheDay(startOf('replyByClosedNotComing'))).toBe(false);
    expect(forTheDay(startOf('replyByClosedNever'))).toBe(false);
    expect(forTheDay(startOf('paused'))).toBe(false);
    expect(forTheDay(startOf('notComing'))).toBe(false);
    expect(forTheDay(startOf('finished'))).toBe(false);
    expect(forTheDay(startOf('changing'))).toBe(false);
  });

  it('drops the details and the foot for Check and send and Tell us, and the hosts when called off', () => {
    expect(shows(startOf('check'))).toMatchObject({ details: false, foot: false });
    expect(shows(startOf('tellUs'))).toMatchObject({ details: false, foot: false });
    expect(shows(startOf('open'))).toEqual({
      details: true,
      foot: true,
      hosts: true,
      noAccount: true,
    });
    expect(shows(startOf('closed')).noAccount).toBe(false);
    expect(shows(startOf('replyByClosed')).noAccount).toBe(false);
    expect(shows(startOf('paused')).noAccount).toBe(false);
    expect(shows(startOf('calledOff')).noAccount).toBe(false);
    expect(shows(startOf('calledOff')).hosts).toBe(false);
  });

  it('shows the messages only when there are some', () => {
    expect(showsMessages(startOf('coming'))).toBe(false);
    expect(showsMessages(startOf('message'))).toBe(true);
  });
});

describe('the frame’s targets at a desk (qa2, #33736: the 44 floor at every width)', () => {
  const css = readFileSync(join(import.meta.dirname, 'guest.css'), 'utf8');
  const desk = /\.gp\.is-desk \{([^}]*)\}/u.exec(css)?.[1] ?? '';
  const px = (name: string) => Number(new RegExp(`${name}: (\\d+)px`, 'u').exec(desk)?.[1]);

  it('draws the language button, its menu’s rows and Terms and Privacy 44 high at 1280', () => {
    expect(px('--gpLang')).toBe(44);
    expect(px('--gpItem')).toBe(44);
    expect(px('--gpFootLink')).toBe(44);
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
    expect(en.timeInZone('18:00', 'Europe/London')).toBe('18:00 Europe/London');
    expect(en.greeting('notSure')).toBe(
      'Thanks for letting us know, Maria Fernanda Albuquerque Santos.',
    );
    expect(en.calendarLine).toBe(
      'Your calendar updates by itself if the date, time or place changes.',
    );
    expect(en.doorLine(2)).toBe('It lets you and your companions in. A screenshot works too.');
    expect(en.doorLine(0)).toBe('A screenshot works too.');
    expect(en.messageCount(1042)).toBe('1,042 of 1,000 characters');
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
    expect(eventTime('en').replace(/\s/u, ' ')).toBe('18:00');
    expect(eventDay('fr')).toBe('jeudi 5 novembre 2026');
    expect(eventTime('fr')).toBe('18:00');
    expect(sentWhen('2026-11-02T21:14:00Z', 'en', 'Europe/London').replace(/\s/gu, ' ')).toBe(
      'Mon, Nov 2 · 21:14',
    );
  });

  it('writes one closed heading per answer, with no slot (l10n, sc-30739)', () => {
    const en = wordsFor('en');
    const day = dayOf('2026-10-27', 'en');

    expect(en.answered('coming', day)).toBe('You answered Coming on Tuesday, October 27.');
    expect(en.answered('notComing', day)).toBe('You answered Not coming on Tuesday, October 27.');
    expect(wordsFor('fr').answered('notComing', dayOf('2026-10-27', 'fr'))).toBe(
      '[Vous avez répondu Absent le mardi 27 octobre.]',
    );
  });

  it('says who recorded a reply for the guest, and only them (sc-3787)', () => {
    const en = wordsFor('en');

    expect(en.answerIs('coming')).toBe('Your answer is Coming.');
    expect(en.answerIs('notComing')).toBe('Your answer is Not coming.');
    expect(en.answerIs('notSure')).toBe('Your answer is Not sure yet.');
    expect(en.recordedFor('Folake Adeyemi', dayOf('2026-10-20', 'en'))).toBe(
      'Folake Adeyemi recorded this answer for you on Tuesday, October 20. If it isn’t right, change it here.',
    );
    expect(startOf('hostRecorded').recorded).toEqual({
      answer: 'coming',
      on: '2026-10-20',
      by: 'Folake Adeyemi',
    });
  });

  it('never counts a reply a host recorded as the guest’s own answer sent again', () => {
    expect(sameAnswer({ answer: 'coming', on: '2026-10-20' }, 'coming')).toBe(true);
    expect(sameAnswer({ answer: 'coming', on: '2026-10-20', by: 'Folake Adeyemi' }, 'coming')).toBe(
      false,
    );
    expect(sameAnswer(null, 'coming')).toBe(false);
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

describe('WhatsApp updates on Check and send (sc-3950)', () => {
  it('offers the box only to a guest with a mobile number and no agreement in force', () => {
    expect(offersWhatsApp({ mobile: true, whatsApp: 'none' })).toBe(true);
    expect(offersWhatsApp({ mobile: true, whatsApp: 'stopped' })).toBe(true);
    expect(offersWhatsApp({ mobile: true, whatsApp: 'agreed' })).toBe(false);
    expect(offersWhatsApp({ mobile: true, whatsApp: 'hostRecorded' })).toBe(false);
    expect(offersWhatsApp({ mobile: false, whatsApp: 'none' })).toBe(false);
    expect(offersWhatsApp(startOf('check'))).toBe(false);
    expect(offersWhatsApp(startOf('checkWhatsApp'))).toBe(true);
  });

  it('records the agreement only from a box shown and ticked', () => {
    expect(agreesOnSend(startOf('checkWhatsApp'))).toBe(false);
    expect(agreesOnSend(startOf('checkWhatsAppTicked'))).toBe(true);
    expect(agreesOnSend({ mobile: false, whatsApp: 'none', ticked: true })).toBe(false);
    expect(agreesOnSend({ mobile: true, whatsApp: 'agreed', ticked: true })).toBe(false);
    expect(agreesOnSend({ mobile: true, whatsApp: 'hostRecorded', ticked: true })).toBe(false);
  });

  it('records one agreement however often Coming is sent, and keeps offering the box when unticked', () => {
    const ticked = startOf('checkWhatsAppTicked');
    const once = { ...ticked, ...sentAnswer(ticked, 'coming') };
    const twice = sentAnswer({ ...once, view: ticked.view }, 'coming');

    expect(offersWhatsApp(once)).toBe(false);
    expect(agreesOnSend(once)).toBe(false);
    expect(twice.whatsApp).toBeUndefined();
    expect(twice.recorded).toBe(once.recorded);

    const unticked = startOf('checkWhatsApp');
    const sent = { ...unticked, ...sentAnswer(unticked, 'coming') };
    expect(sent.whatsApp).toBe('none');
    expect(offersWhatsApp(sent)).toBe(true);
  });

  it('starts unticked, ticked, and answered with the line', () => {
    expect(startOf('checkWhatsApp')).toMatchObject({
      view: { kind: 'check' },
      mobile: true,
      ticked: false,
      want: 'checkHead',
    });
    expect(startOf('checkWhatsAppTicked')).toMatchObject({ ticked: true, want: 'checkHead' });
    expect(startOf('comingWhatsApp')).toMatchObject({
      recorded: { answer: 'coming', whatsApp: true },
      whatsApp: 'agreed',
      want: 'greeting',
    });
    expect(startOf('coming').recorded?.whatsApp).toBeUndefined();
    expect(startOf('check')).toMatchObject({ mobile: false, ticked: false });
  });

  it('sends Coming with the agreement when ticked, and only the answer when not', () => {
    expect(sentAnswer(startOf('checkWhatsAppTicked'), 'coming')).toEqual({
      recorded: { answer: 'coming', on: '2026-10-27', whatsApp: true },
      view: { kind: 'recorded', same: false },
      whatsApp: 'agreed',
      ask: null,
    });
    expect(sentAnswer(startOf('checkWhatsApp'), 'coming')).toEqual({
      recorded: { answer: 'coming', on: '2026-10-27' },
      view: { kind: 'recorded', same: false },
      ask: null,
    });
  });

  it('writes the box and its line with the organisation, l10n’s English (#36823)', () => {
    const words = wordsFor('en');

    expect(words.whatsAppBox).toBe('Send me updates on WhatsApp');
    expect(words.whatsAppHint).toBe(
      'Soirely sends them on behalf of Ire Events. Reply STOP at any time to end them.',
    );
  });
});

describe('the words stay in the demo (SHARED.md, Step three)', () => {
  it('adds nothing to the product’s catalogues', () => {
    expect(Object.keys(en)).not.toContain('guestPage');
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
