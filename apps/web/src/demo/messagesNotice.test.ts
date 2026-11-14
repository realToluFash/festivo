import { describe, expect, it } from 'vitest';

import { EVENT_NAME, HOSTS, noticeOf, noticePrice, sectionsOf, seedOf } from './messages.ts';
import {
  NOTICE_STATES,
  attachmentsWords,
  languageOf,
  markOf,
  noticeCaseOf,
  noticeSmsOf,
  notSentWhy,
  quietLine,
  readerOf,
  reasonOf,
  refusalOf,
} from './messagesNotice.ts';

describe('a guest’s conversation, its refusals and waits (sc-3976)', () => {
  it('has seventeen states, each opening its guest’s conversation', () => {
    expect(NOTICE_STATES.map((one) => one.key)).toEqual([
      'noticeNoConsent',
      'noticeNoTemplate',
      'noticeStoppedWhatsApp',
      'noticeStopped',
      'noticeBouncing',
      'noticeSpam',
      'noticeUnsubscribed',
      'noticeWindowClosed',
      'noticeWindowRefused',
      'noticeQuiet',
      'noticeAskOwner',
      'noticeAskSent',
      'noticeAskFailed',
      'textsBackOn',
      'attachmentsNotKept',
      'sharedNumber',
      'readOnly',
    ]);
    const opened = NOTICE_STATES.map((one) => {
      const pane = seedOf(one.key).pane;

      return pane.kind === 'convo' ? pane.id : null;
    });

    expect(opened).toEqual([
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
  });

  it('is read by a member without billing in Ask an owner, and by Read-only', () => {
    expect(readerOf('noticeAskOwner')).toEqual({
      name: 'Bisi Okafor',
      initials: 'BO',
      role: 'Admin',
    });
    expect(readerOf('readOnly')?.role).toBe('Read-only');
    expect(readerOf('noticeQuiet')).toBeUndefined();
  });

  it('writes Soirely’s text as l10n settled it, counted with the link as built', () => {
    const later = noticeSmsOf(HOSTS, EVENT_NAME);
    const first = noticeSmsOf(HOSTS, EVENT_NAME, true);

    expect(later.text).toBe(
      "Adaeze Obi and Tunde Bakare: a new message about Adaeze & Tunde's wedding. Read it here: [their own link]",
    );
    expect([later.chars, later.parts]).toEqual([154, 1]);
    expect(first.text.endsWith('\nReply STOP to opt out.')).toBe(true);
    expect([first.chars, first.parts]).toEqual([177, 2]);
  });

  it('prices a text by its parts, a WhatsApp message by the number’s country', () => {
    expect(noticePrice('kwame', 'sms')).toBe(9);
    expect(noticePrice('lucia', 'sms')).toBe(14);
    expect(noticePrice('lucia', 'whatsApp')).toBe(4);
    expect(noticePrice('valentina', 'whatsApp')).toBe(2);
    expect(noticePrice('ines', 'email')).toBe(0);
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
      'Stopped texts',
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
  });

  it('names the guest’s language in the reader’s own', () => {
    expect(languageOf('lucia')).toBe('Spanish');
    expect(languageOf('lucia', 'fr')).toBe('espagnol');
    expect(languageOf('ines')).toBe('Portuguese');
  });

  it('offers the other channels that can tell them now, or none', () => {
    expect(
      refusalOf('whatsApp', { whatsApp: 'notAgreed' }, ['email', 'sms'], 'English')?.others,
    ).toEqual(['email', 'sms']);
    expect(refusalOf('sms', { sms: 'textedStop' }, ['email'], 'English')?.others).toEqual([
      'email',
    ]);
    expect(refusalOf('email', { email: 'bouncing' }, [], 'Portuguese')?.others).toEqual([]);
    expect(
      refusalOf('whatsApp', { whatsApp: 'noTemplate' }, ['email', 'sms'], 'Spanish', (one) => {
        return one === 'email';
      })?.others,
    ).toEqual(['email']);
    expect(refusalOf('email', { sms: 'textedStop' }, ['sms'], 'English')).toBeNull();
  });

  it('says how long a notice waits for quiet hours, but never for email', () => {
    expect(quietLine('whatsApp', '09:00')).toBe(
      'This WhatsApp message waits until 09:00, their time.',
    );
    expect(quietLine('sms', '09:00')).toBe('This text waits until 09:00, their time.');
    expect(quietLine('email', '09:00')).toBeNull();
  });

  it('counts the attachments it did not keep, one and many', () => {
    expect(attachmentsWords(1)).toBe('1 attachment not kept');
    expect(attachmentsWords(2)).toBe('2 attachments not kept');
  });

  it('puts Valentina’s question third in Needs you, and Lucía’s of yesterday last', () => {
    const quiet = sectionsOf(seedOf('noticeQuiet'), []).needs.map((one) => one.id);
    const closed = sectionsOf(seedOf('noticeWindowClosed'), []).needs.map((one) => one.id);

    expect(quiet.slice(0, 4)).toEqual(['ines', 'lucia', 'valentina', 'kwame']);
    expect(closed.at(-1)).toBe('lucia');
  });

  it('keeps Ask an owner’s wait as noticeWaits has it', () => {
    const inbox = seedOf('noticeAskOwner');

    expect(inbox.balance).toBe(2);
    expect(noticeOf('lucia', 'whatsApp', inbox.balance, ['email', 'sms']).waits).toBe(
      '1 WhatsApp message will wait for credits.',
    );
    expect(noticeCaseOf('noticeAskFailed')?.ask).toBe('failed');
  });
});
