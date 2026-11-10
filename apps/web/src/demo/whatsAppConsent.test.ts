import { describe, expect, it } from 'vitest';

import {
  GUESTS_STATES,
  agreeToWhatsApp,
  dayOf,
  guestsStart,
  sampleGuests,
  WEDDING,
} from './guests.ts';
import {
  HOW_AGREED,
  NO_CONSENT,
  howAgreedProblem,
  hostAgreed,
  whatsAppRowOf,
} from './whatsAppConsent.ts';

const EDITS = { mobile: true, edits: true };

describe('the WhatsApp row (sc-3950)', () => {
  it('reads each consent as whatsapp-consent-spec §2 words it', () => {
    expect(whatsAppRowOf(NO_CONSENT, EDITS, dayOf)).toEqual({
      title: 'Has not agreed to WhatsApp',
      agree: true,
      note: null,
    });
    expect(
      whatsAppRowOf(hostAgreed('Folake Adeyemi', 'In person', '2026-11-03'), EDITS, dayOf),
    ).toEqual({
      title: 'Agreed to WhatsApp in person, recorded by Folake Adeyemi on Nov 3',
      agree: false,
      note: null,
    });
    expect(whatsAppRowOf({ kind: 'guest', on: '2026-11-02' }, EDITS, dayOf)).toEqual({
      title: 'Agreed to WhatsApp on Nov 2',
      agree: false,
      note: null,
    });
    expect(whatsAppRowOf({ kind: 'optedOut', on: '2026-11-05' }, EDITS, dayOf)).toEqual({
      title: 'Unsubscribed from WhatsApp on Nov 5',
      agree: false,
      note: 'Only the guest can change this.',
    });
  });

  it('reads the host’s record as one whole sentence per How? answer', () => {
    const titles = HOW_AGREED.map(
      (how) => whatsAppRowOf(hostAgreed('Folake Adeyemi', how, '2026-11-03'), EDITS, dayOf)?.title,
    );

    expect(titles).toEqual([
      'Agreed to WhatsApp in person, recorded by Folake Adeyemi on Nov 3',
      'Agreed to WhatsApp by phone, recorded by Folake Adeyemi on Nov 3',
      'Agreed to WhatsApp in writing, recorded by Folake Adeyemi on Nov 3',
    ]);
  });

  it('shows only with a mobile number, and only to someone who can edit guests', () => {
    expect(whatsAppRowOf(NO_CONSENT, { mobile: false, edits: true }, dayOf)).toBeNull();
    expect(whatsAppRowOf(NO_CONSENT, { mobile: true, edits: false }, dayOf)).toBeNull();
    expect(
      whatsAppRowOf({ kind: 'guest', on: '2026-11-02' }, { mobile: true, edits: false }, dayOf),
    ).toBeNull();
  });

  it('needs how they agreed before it saves', () => {
    expect(howAgreedProblem(null)).toBe('Choose how they agreed.');
    for (const how of HOW_AGREED) expect(howAgreedProblem(how)).toBeNull();
  });
});

describe('the WhatsApp sample and states (sc-3950)', () => {
  const list = sampleGuests(WEDDING);
  const one = (id: string) => list.find((guest) => guest.id === id);

  it('draws the four guests the spec names from the Guests sample', () => {
    expect(one('kwame')?.whatsApp).toEqual({ kind: 'none' });
    expect(one('kwame')?.phone).not.toBeNull();
    expect(one('lucia')?.whatsApp).toEqual({ kind: 'guest', on: '2026-11-02' });
    expect(one('sophie')?.whatsApp).toEqual({ kind: 'optedOut', on: '2026-11-05' });
    expect(one('sophie')?.phone).toEqual({ country: 'FR', number: '6 41 27 88 05' });
    expect(one('ines')?.phone).toBeNull();
  });

  it('records the host’s answer on that guest alone', () => {
    const after = agreeToWhatsApp(list, 'kwame', 'By phone', '2026-11-03');

    expect(after.find((guest) => guest.id === 'kwame')?.whatsApp).toEqual(
      hostAgreed('Folake Adeyemi', 'By phone', '2026-11-03'),
    );
    expect(after.filter((guest, at) => guest !== list[at])).toHaveLength(1);
  });

  it('opens each state on its guest, the change where the spec draws it', () => {
    const keys = GUESTS_STATES.map((state) => state.key).filter((key) =>
      key.startsWith('whatsApp'),
    );
    const open = (key: (typeof keys)[number]) => guestsStart(key, new URLSearchParams()).pane;

    expect(keys).toEqual([
      'whatsAppNone',
      'whatsAppAgree',
      'whatsAppAgreeBlank',
      'whatsAppAgreePicked',
      'whatsAppNotSaved',
      'whatsAppRecorded',
      'whatsAppGuestAgreed',
      'whatsAppOptedOut',
      'whatsAppNoMobile',
    ]);
    expect(open('whatsAppNone')).toEqual({ kind: 'guest', id: 'kwame' });
    expect(open('whatsAppAgree')).toEqual({ kind: 'whatsApp', id: 'kwame', start: {} });
    expect(open('whatsAppAgreeBlank')).toEqual({
      kind: 'whatsApp',
      id: 'kwame',
      start: { tried: true },
    });
    expect(open('whatsAppAgreePicked')).toEqual({
      kind: 'whatsApp',
      id: 'kwame',
      start: { how: 'In person' },
    });
    expect(open('whatsAppNotSaved')).toEqual({
      kind: 'whatsApp',
      id: 'kwame',
      start: { how: 'In person', notSaved: true },
    });
    expect(open('whatsAppGuestAgreed')).toEqual({ kind: 'guest', id: 'lucia' });
    expect(open('whatsAppOptedOut')).toEqual({ kind: 'guest', id: 'sophie' });
    expect(open('whatsAppNoMobile')).toEqual({ kind: 'guest', id: 'ines' });

    const recorded = guestsStart('whatsAppRecorded', new URLSearchParams());

    expect(recorded.told).toBe('Saved');
    expect(recorded.list.find((guest) => guest.id === 'kwame')?.whatsApp.kind).toBe('host');
  });
});
