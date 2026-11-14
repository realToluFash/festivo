import { describe, expect, it } from 'vitest';

import { GUESTS_BOARDS } from './GuestsBoards.ts';
import {
  AGREE_STATES,
  GUESTS_STATES,
  agreedToWhatsApp,
  areaStart,
  dayWords,
  guestOf,
  guestsAt,
  roleOf,
} from './GuestsModel.ts';
import { GUESTS, TODAY } from './GuestsSample.ts';
import { HOW_AGREED } from './GuestsWords.ts';
import { NO_CONSENT, hostAgreed, howAgreedProblem, whatsAppRowOf } from './WhatsAppConsent.ts';

const EDITS = { mobile: true, edits: true };
const day = (iso: string) => dayWords(iso, 'en-US');
const WHATSAPP = [
  'whatsAppNone',
  'whatsAppAgree',
  'whatsAppAgreeBlank',
  'whatsAppAgreePicked',
  'whatsAppNotSaved',
  'whatsAppRecorded',
  'whatsAppGuestAgreed',
  'whatsAppOptedOut',
  'whatsAppNoMobile',
  'whatsAppViewer',
] as const;

function sample(key: string) {
  const found = GUESTS.find((g) => g.key === key);
  if (found == null) throw new Error(key);
  return found;
}

describe('the WhatsApp row (sc-3950)', () => {
  it('reads each consent as whatsapp-consent-spec §2 words it', () => {
    expect(whatsAppRowOf(NO_CONSENT, EDITS, day)).toEqual({
      title: 'Has not agreed to WhatsApp',
      agree: true,
      note: null,
    });
    expect(whatsAppRowOf(undefined, EDITS, day)).toEqual({
      title: 'Has not agreed to WhatsApp',
      agree: true,
      note: null,
    });
    expect(
      whatsAppRowOf(hostAgreed('Folake Adeyemi', 'In person', '2026-11-03'), EDITS, day),
    ).toEqual({
      title: 'Agreed to WhatsApp in person, recorded by Folake Adeyemi on Nov 3',
      agree: false,
      note: null,
    });
    expect(whatsAppRowOf({ kind: 'guest', day: '2026-11-02' }, EDITS, day)).toEqual({
      title: 'Agreed to WhatsApp on Nov 2',
      agree: false,
      note: null,
    });
    expect(whatsAppRowOf({ kind: 'optedOut', day: '2026-11-01' }, EDITS, day)).toEqual({
      title: 'Unsubscribed from WhatsApp on Nov 1',
      agree: false,
      note: 'Only the guest can change this.',
    });
  });

  it('reads the host’s record as one whole sentence per How? answer', () => {
    expect(
      HOW_AGREED.map(
        (how) => whatsAppRowOf(hostAgreed('Folake Adeyemi', how, TODAY), EDITS, day)?.title,
      ),
    ).toEqual([
      'Agreed to WhatsApp in person, recorded by Folake Adeyemi on Nov 3',
      'Agreed to WhatsApp by phone, recorded by Folake Adeyemi on Nov 3',
      'Agreed to WhatsApp in writing, recorded by Folake Adeyemi on Nov 3',
    ]);
  });

  it('shows only with a mobile number, and only to someone who can edit guests', () => {
    expect(whatsAppRowOf(NO_CONSENT, { mobile: false, edits: true }, day)).toBeNull();
    expect(whatsAppRowOf(NO_CONSENT, { mobile: true, edits: false }, day)).toBeNull();
    expect(roleOf('guestViewer')).toBe('viewer');
    expect(roleOf('whatsAppViewer')).toBe('viewer');
  });

  it('refuses Save with nothing picked, then records the pick', () => {
    expect(howAgreedProblem(null)).toBe('Choose how they agreed.');

    const saved = agreedToWhatsApp(sample('kwame'), 'By phone', TODAY);

    expect(howAgreedProblem('By phone')).toBeNull();
    expect(whatsAppRowOf(saved.whatsApp, EDITS, day)).toEqual({
      title: 'Agreed to WhatsApp by phone, recorded by Folake Adeyemi on Nov 3',
      agree: false,
      note: null,
    });
  });
});

describe('the WhatsApp states (sc-3950)', () => {
  it('lists every state with a board in the demo home', () => {
    const hrefs = GUESTS_BOARDS.map((board) => board.href);

    for (const state of WHATSAPP) {
      expect(GUESTS_STATES).toContain(state);
      expect(hrefs).toContain(`/demo/guests?state=${state}`);
    }
  });

  it('opens each on the guest the spec names', () => {
    expect(WHATSAPP.map((state) => guestOf(state))).toEqual([
      'kwame',
      'kwame',
      'kwame',
      'kwame',
      'kwame',
      'kwame',
      'lucia',
      'sophie',
      'ines',
      'kwame',
    ]);
    expect(sample('kwame').phone).not.toBeNull();
    expect(sample('kwame').whatsApp).toBeUndefined();
    expect(sample('lucia').whatsApp).toEqual({ kind: 'guest', day: '2026-11-02' });
    expect(sample('sophie').whatsApp).toEqual({ kind: 'optedOut', day: '2026-11-01' });
    expect(sample('sophie').phone).toBe('+33 6 41 27 88 05');
    expect(sample('ines').phone).toBeNull();
  });

  it('opens the change for the four change states, and Saved after the record', () => {
    for (const state of AGREE_STATES) expect(areaStart(state).overlay).toBe('whatsApp');
    expect(areaStart('whatsAppNone').overlay).toBeNull();
    expect(areaStart('whatsAppRecorded').toast).toBe('saved');
    expect(guestsAt('whatsAppRecorded').find((g) => g.key === 'kwame')?.whatsApp).toEqual(
      hostAgreed('Folake Adeyemi', 'In person', TODAY),
    );
  });
});
