import { describe, expect, it } from 'vitest';

import {
  type Category,
  type Inbox,
  type Ticks,
  BALANCE,
  seedOf,
  whatsAppCreditsIn,
  whoOf,
} from './messages.ts';
import {
  type Counted,
  type InviteCheck,
  NOT_YET_INVITED,
  inviteCheckOf,
  inviteReachOf,
  previewPeople,
  whatsAppInvitationOf,
} from './messagesInvite.ts';
import { WA_INVITE_STATES } from './messagesInviteWords.ts';

const ALL_THREE: Ticks = { email: true, sms: true, whatsApp: true };
const NO_SMS: Ticks = { email: true, sms: false, whatsApp: true };
const NOBODY_COUNTED: Counted = {
  counts: { email: 0, sms: 0, whatsApp: 0 },
  cantTell: 0,
  names: [],
};

function personNamed(id: string) {
  const one = previewPeople(NOT_YET_INVITED, [], 'marketing').find((person) => person.id === id);

  if (one == null) throw new Error(`no ${id}`);

  return one;
}

function checked(wa: Category, ticks: Ticks, balance = BALANCE): InviteCheck {
  const check = inviteCheckOf(NOT_YET_INVITED, ticks, false, NOBODY_COUNTED, balance, [], wa);

  if (check.kind !== 'check') throw new Error('refused');

  return check;
}

describe('the invitation by WhatsApp (sc-45251)', () => {
  it('counts each guest at their own country’s rate, never one country’s times the count', () => {
    expect(whatsAppCreditsIn('NG', 'marketing')).toBe(10);
    expect(whatsAppCreditsIn('NG', 'utility')).toBe(2);
    expect(whatsAppCreditsIn('GB', 'marketing')).toBe(12);
    expect(whatsAppCreditsIn('US', 'utility')).toBe(1);
  });

  it('offers WhatsApp unticked, and its reach line has the US part only at marketing', () => {
    const offered = inviteReachOf(NOT_YET_INVITED, 'marketing', { ...ALL_THREE, whatsApp: false });
    const marketing = inviteReachOf(NOT_YET_INVITED, 'marketing', NO_SMS);
    const utility = inviteReachOf(NOT_YET_INVITED, 'utility', NO_SMS);

    expect(offered).toEqual({ whatsApp: null, instead: null });
    expect(marketing.whatsApp).toBe(
      'WhatsApp reaches 5 of 14 · 4 have no mobile number, 1 stopped WhatsApp, 2 haven’t agreed to WhatsApp and 2 have US numbers',
    );
    expect(utility.whatsApp).toBe(
      'WhatsApp reaches 7 of 14 · 4 have no mobile number, 1 stopped WhatsApp and 2 haven’t agreed to WhatsApp',
    );
    expect(inviteReachOf(NOT_YET_INVITED, 'marketing', ALL_THREE).instead).toBe(
      '5 by WhatsApp instead of SMS',
    );
  });

  it('checks texts and WhatsApp together at marketing: US numbers texted, 230 credits', () => {
    const check = checked('marketing', ALL_THREE);

    expect(check.pills).toEqual([
      { channel: 'email', count: 12 },
      { channel: 'sms', count: 5 },
      { channel: 'whatsApp', count: 5 },
    ]);
    expect(check.cant).toBe(0);
    expect(check.credits).toBe(
      'Texts and WhatsApp messages use 230 credits. Credits after sending: 1,270.',
    );
    expect(check.waits).toBeNull();
  });

  it('sends US numbers WhatsApp at utility: 183 credits', () => {
    const check = checked('utility', ALL_THREE);

    expect(check.pills.find((pill) => pill.channel === 'whatsApp')?.count).toBe(7);
    expect(check.credits).toBe(
      'Texts and WhatsApp messages use 183 credits. Credits after sending: 1,317.',
    );
  });

  it('says WhatsApp messages alone, and holds them when credits are short while email goes', () => {
    const only = checked('marketing', { email: false, sms: false, whatsApp: true });
    const short = checked('marketing', NO_SMS, 0);

    expect(only.credits).toBe('WhatsApp messages use 54 credits. Credits after sending: 1,446.');
    expect(short.credits).toBeNull();
    expect(short.waits).toMatchObject({
      either: true,
      lines: ['5 WhatsApp messages will wait for credits.'],
      way: { word: 'Send without WhatsApp' },
    });
    expect(short.cantNames[0]).toEqual({
      name: 'Yusuf Ibrahim',
      why: ['No email address', 'SMS is off', 'Has not agreed to WhatsApp'],
    });
  });

  it('fills the template in the guest’s language, with and without a reply-by date', () => {
    const chuka = whatsAppInvitationOf(personNamed('chuka-nwankwo'), false);
    const noDate = whatsAppInvitationOf(personNamed('chuka-nwankwo'), true);
    const catarina = whatsAppInvitationOf(personNamed('catarina-reis'), false);

    expect(chuka.lines[0]).toBe('Dear Chuka Nwankwo,');
    expect(chuka.lines[1]).toContain('This is your invitation from Adaeze Obi and Tunde Bakare');
    expect(chuka.lines[2]).toMatch(/^Please reply by Wednesday,? 4 November 2026\./u);
    expect(chuka.button).toBe('Reply on your page');
    expect(noDate.lines[2]).toMatch(/^Please reply when you can\./u);
    expect(catarina.lang).toBe('pt');
    expect(catarina.lines[0]).toBe('Olá, Catarina Reis.');
    expect(catarina.lines[1]).toContain('da parte de Adaeze Obi e Tunde Bakare');
    expect(catarina.button).toBe('Responder na sua página');

    const noor = whatsAppInvitationOf(personNamed('noor-rahman'), false);
    const dami = whatsAppInvitationOf(personNamed('dami-oladipo'), false);

    expect(noor.lang).toBe('es');
    expect(noor.lines[0]).toBe('Hola, Noor Rahman:');
    expect(noor.lines[1]).toContain('de Adaeze Obi y Tunde Bakare');
    expect(noor.button).toBe('Responder en su página');
    expect(dami.lang).toBe('fr');
    expect(dami.lines[0]).toBe('Bonjour Dami Oladipo,');
    expect(dami.lines[1]).toContain('de la part de Adaeze Obi et Tunde Bakare');
    expect(dami.button).toBe('Répondre sur votre page');
  });

  it('counts Who it reached: Sent is in progress, Failed its own group, a US row offered Try SMS instead only when nothing reached them', () => {
    const inbox = seedOf('invitedReachedWhatsApp') as Inbox;
    const texted = whoOf(inbox, 'whatsAppInvite', 'invite', []);
    const untexted = whoOf(inbox, 'whatsAppInviteNoSms', 'invite', []);
    const kenji = untexted.groups
      .flatMap((group) => group.people)
      .find((one) => one.id === 'kenji-watanabe');

    expect(texted.line).toBe('12 now Invited · 1 in progress · 1 failed');
    expect(untexted.line).toBe(
      '10 now Invited · 1 in progress · 1 bounced · 1 failed · 1 can’t be told',
    );
    expect(texted.groups.find((group) => group.key === 'failed')?.people[0]?.fixes).toContain(
      'trySms',
    );
    expect(
      texted.groups
        .find((group) => group.key === 'reached')
        ?.people.find((one) => one.id === 'kenji-watanabe')?.fixes,
    ).toEqual([]);
    expect(kenji?.fixes).toContain('trySms');
    expect(kenji?.lines.map((line) => line.why)).toContain('Has a US number');
  });

  it('links its fourteen states in their own group', () => {
    for (const { key } of WA_INVITE_STATES) expect(seedOf(key), key).toBeDefined();
    expect(WA_INVITE_STATES).toHaveLength(14);
  });
});
