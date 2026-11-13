import { describe, expect, it } from 'vitest';

import {
  type Messages,
  badgeOf,
  badgeShown,
  noticeCostOf,
  noticeCreditsOf,
  reduce,
  sectionsOf,
  startOf,
  tellNowBy,
  tellingBy,
} from './MessagesModel.ts';
import { EVENT, HOSTS } from './MessagesSample.ts';
import { say } from './MessagesWords.ts';
import {
  NOTICE_STATES,
  guestOf,
  languageOf,
  markOf,
  noticeSmsOf,
  notSentWhy,
  quietLine,
  reasonOf,
  refusalOf,
} from './NoticeStates.ts';
import { sayNotice } from './NoticeWords.ts';
import { stoppingOf } from './StopWriting.ts';

const opened = (m: Messages) => (m.open?.kind === 'guest' ? m.open.key : null);
const answered = (m: Messages, key: 'ines' | 'lucia' | 'kwame' | 'valentina') =>
  reduce(m, { type: 'answer', key, text: m.typed[key] ?? 'Yes.' });

describe('a guest’s conversation, its refusals and waits (sc-3976)', () => {
  it('opens each state on its guest, with the answer typed where the design has it', () => {
    expect(NOTICE_STATES.map((state) => opened(startOf(state, false)))).toEqual([
      'kwame',
      'lucia',
      'lucia',
      'kwame',
      'ines',
      'ines',
      'ines',
      'lucia',
      'lucia',
      'valentina',
      'lucia',
      'lucia',
      'lucia',
      'kwame',
      'unknown',
      'kwame',
      'ines',
    ]);
    expect(startOf('noticeNoConsent', false).typed.kwame).toBe(
      'Formal: suits and long dresses are welcome.',
    );
    expect(startOf('textsBackOn', false).typed.kwame).toBeUndefined();
    expect(startOf('attachmentsNotKept', false).matched).toBe('Camille Dubois');
  });

  it('writes Soirely’s text as l10n settled it, counted with the link as built', () => {
    const later = noticeSmsOf(HOSTS, EVENT);
    const first = noticeSmsOf(HOSTS, EVENT, true);

    expect(later.text).toBe(
      "Adaeze Obi and Tunde Bakare: a new message about Adaeze & Tunde's wedding. Read it here: [their own link]",
    );
    expect([later.chars, later.parts]).toEqual([154, 1]);
    expect(first.text.endsWith('\nReply STOP to opt out.')).toBe(true);
    expect([first.chars, first.parts]).toEqual([177, 2]);
    expect(say.smsParts(later.parts)).toBe('SMS · 1 part');
  });

  it('prices a text by its parts and a WhatsApp message by the number’s country', () => {
    expect(noticeCreditsOf('kwame', 'sms')).toBe(9);
    expect(noticeCreditsOf('lucia', 'sms')).toBe(14);
    expect(noticeCreditsOf('valentina', 'wa')).toBe(2);
    expect(noticeCreditsOf('ines', 'email')).toBe(0);
  });

  it('gives each refusal its reason, its short reason and Who it reached’s mark', () => {
    const blocks = [
      'notAgreed',
      'noTemplate',
      'stoppedWhatsApp',
      'textedStop',
      'bouncing',
      'spam',
      'unsubscribed',
    ] as const;

    expect(blocks.map((block) => reasonOf(block, 'Spanish'))).toEqual([
      'Has not agreed to WhatsApp',
      'Soirely’s WhatsApp message cannot be sent in Spanish at the moment.',
      'Stopped WhatsApp',
      'Texted STOP on Mon, Nov 2 at 21:40. Texting START brings texts back.',
      'Address is bouncing',
      'Reported an earlier email as spam',
      'Unsubscribed',
    ]);
    expect(blocks.map((block) => notSentWhy(block, 'Spanish'))).toEqual([
      'Has not agreed to WhatsApp',
      'WhatsApp message unavailable in Spanish',
      'Stopped WhatsApp',
      'Texted STOP',
      'Address is bouncing',
      'Reported an earlier email as spam',
      'Unsubscribed',
    ]);
    expect(blocks.map(markOf)).toEqual([
      'notsent',
      'notsent',
      'optout',
      'optout',
      'notsent',
      'notsent',
      'optout',
    ]);
    expect(languageOf('lucia')).toBe('Spanish');
    expect(languageOf('lucia', 'pt')).toBe('espanhol');
  });

  it('offers the other channels that can tell them now, or none', () => {
    expect(refusalOf('wa', { wa: 'notAgreed' }, ['email', 'sms'], 'English')?.others).toEqual([
      'email',
      'sms',
    ]);
    expect(refusalOf('email', { email: 'bouncing' }, [], 'Portuguese')?.others).toEqual([]);
    expect(
      refusalOf('wa', { wa: 'noTemplate' }, ['email', 'sms'], 'Spanish', (one) => one === 'email')
        ?.others,
    ).toEqual(['email']);
    expect(refusalOf('email', { sms: 'textedStop' }, ['sms'], 'English')).toBeNull();
  });

  it('turns Kwame to WhatsApp in noticeNoConsent, and a picked channel puts its cost back', () => {
    const m = startOf('noticeNoConsent', false);

    expect(tellingBy(m, 'kwame')).toBe('wa');
    expect(guestOf(m, 'kwame').asked.day).toBe('2026-11-01');
    const sms = reduce(m, { type: 'tellBy', key: 'kwame', channel: 'sms' });

    expect(noticeCostOf(sms, 'kwame')).toEqual({
      channel: 'sms',
      credits: 9,
      after: 1491,
      waits: false,
    });
  });

  it('puts the answer on their page as Not sent when sent without a channel', () => {
    const sent = answered(startOf('noticeStopped', false), 'kwame');
    const answer = sent.answers.kwame;

    expect(answer?.refused).toEqual({ reason: 'Texted STOP', mark: 'optout' });
    expect(sent.balance).toBe(startOf('noticeStopped', false).balance);
    expect(sent.typed.kwame).toBe('');
    expect(answered(startOf('noticeNoTemplate', false), 'lucia').answers.lucia?.refused).toEqual({
      reason: 'WhatsApp message unavailable in Spanish',
      mark: 'notsent',
    });
  });

  it('sends as the template once the 24 hours closed, and the alert goes', () => {
    const m = startOf('noticeWindowClosed', false);

    expect(m.notice?.windowClosed).toBe(true);
    expect(noticeCostOf(m, 'lucia')?.after).toBe(1496);
    const sent = answered(m, 'lucia');

    expect(sent.notice?.windowClosed).toBe(false);
    expect(sent.answers.lucia?.refused).toBeUndefined();
    expect(sent.balance).toBe(1496);
  });

  it('lets a notice wait for quiet hours, and still takes its credits', () => {
    const m = startOf('noticeQuiet', false);

    expect(quietLine('wa', '09:00')).toBe('This WhatsApp message waits until 09:00, their time.');
    expect(quietLine('sms', '09:00')).toBe('This text waits until 09:00, their time.');
    expect(quietLine('email', '09:00')).toBeNull();
    const sent = answered(m, 'valentina');

    expect(sent.answers.valentina?.waits).toBe('Waiting until 09:00, their time');
    expect(sent.balance).toBe(m.balance - 2);
  });

  it('puts Valentina third in Needs you, and Lucía’s question of yesterday last', () => {
    const quiet = sectionsOf(startOf('noticeQuiet', false)).needs.map((id) =>
      id.kind === 'draft' ? id.id : id.key,
    );
    const closed = sectionsOf(startOf('noticeWindowClosed', false)).needs.map((id) =>
      id.kind === 'draft' ? id.id : id.key,
    );

    expect(quiet.slice(0, 4)).toEqual(['ines', 'lucia', 'valentina', 'kwame']);
    expect(closed.at(-1)).toBe('lucia');
    expect(badgeOf(startOf('noticeQuiet', false))).toEqual({
      waiting: 4,
      notMatched: 1,
      total: 5,
    });
  });

  it('keeps noticeWaits’ wait for Ask an owner, with Email to tell them now', () => {
    const m = startOf('noticeAskOwner', false);

    expect(m.balance).toBe(2);
    expect(m.reader).toBe('Bisi Okafor');
    expect(noticeCostOf(m, 'lucia')?.waits).toBe(true);
    expect(tellNowBy(m, 'lucia')).toEqual(['email']);
    expect(startOf('noticeAskFailed', false).notice?.ask).toBe('failed');
  });

  it('gives a Read-only member no actions, and the conversation’s lines their words', () => {
    const m = startOf('readOnly', false);

    expect(stoppingOf(m).manage).toBe(false);
    expect(m.reader).toBe('Kofi Mensah');
    expect(sayNotice.sharedBy('+44 7700 900412', 2)).toBe('+44 7700 900412 · shared by 2 guests');
    expect(sayNotice.attachmentsNotKept(1)).toBe('1 attachment not kept');
    expect(sayNotice.attachmentsNotKept(2)).toBe('2 attachments not kept');
    expect(sayNotice.stoppedTexts('Kwame Mensah', '21:40')).toBe(
      'Kwame Mensah stopped texts · 21:40',
    );
  });

  it('leaves out a part of the badge that is 0, and shows no badge at 0', () => {
    expect(say.counts(0, 1)).toBe('1 not matched');
    expect(say.badgeName(0, 1)).toBe('Messages, 1 not matched');
    expect(say.badgeName(3, 0)).toBe('Messages, 3 waiting');
    expect(say.counts(3, 1)).toBe('3 waiting · 1 not matched');
    const none = ['ines', 'lucia', 'kwame', 'unknown'].reduce(
      (m, key) => reduce(m, { type: 'markDone', key: key as 'ines' }),
      startOf(null, false),
    );

    expect(badgeOf(none)?.total).toBe(0);
    expect(badgeShown(none)).toBeNull();
  });
});
