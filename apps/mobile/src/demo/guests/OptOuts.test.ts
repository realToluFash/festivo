import { describe, expect, it } from 'vitest';

import { GUESTS_BOARDS } from './GuestsBoards.ts';
import {
  GUESTS_STATES,
  type GuestsState,
  areaStart,
  dayWords,
  guestOf,
  guestsAt,
  roleOf,
} from './GuestsModel.ts';
import { GUESTS, type SampleGuest } from './GuestsSample.ts';
import { NO_OPT_OUTS, optOutRowsOf, withOptOuts } from './OptOuts.ts';
import { whatsAppRowOf } from './WhatsAppConsent.ts';

const EDITS = { edits: true };
const ONLY = 'Only the guest can change this.';
const day = (iso: string) => dayWords(iso, 'en-US');
const OPT_OUT_STATES = [
  'optOutEmail',
  'optOutTexts',
  'optOutTextsWhatsApp',
  'optOutAll',
  'optOutNoMobile',
  'optOutViewer',
] as const;

function sample(key: string): SampleGuest {
  const found = GUESTS.find((g) => g.key === key);
  if (found == null) throw new Error(key);
  return found;
}

function opened(state: GuestsState): { g: SampleGuest; edits: boolean } {
  const g = guestsAt(state).find((one) => one.key === guestOf(state));
  if (g == null) throw new Error(state);
  return { g, edits: roleOf(state) === 'owner' };
}

function rowsAt(state: GuestsState) {
  const { g, edits } = opened(state);
  return optOutRowsOf(g, { edits }, day);
}

function whatsAppAt(state: GuestsState) {
  const { g, edits } = opened(state);
  return whatsAppRowOf(g.whatsApp, { mobile: g.phone != null, edits }, day);
}

const withoutOptOuts = (list: readonly SampleGuest[]) =>
  list.map((g) => ({ ...g, optOuts: NO_OPT_OUTS }));

describe('the opt-out rows (sc-3969)', () => {
  it('shows nothing for a guest with no opt-out on record', () => {
    expect(optOutRowsOf(sample('kwame'), EDITS, day)).toEqual({ email: null, texts: null });
  });

  it('closes the email’s line always, and the texts’ unless WhatsApp is opted out', () => {
    const kwame = withOptOuts(sample('kwame'), { email: '2026-10-22', texts: '2026-10-29' });
    const sophie = withOptOuts(sample('sophie'), { email: '2026-10-20', texts: '2026-10-27' });

    expect(optOutRowsOf(kwame, EDITS, day)).toEqual({
      email: { title: 'Unsubscribed from email on Oct 22', note: ONLY },
      texts: { title: 'Unsubscribed from texts on Oct 29', note: ONLY },
    });
    expect(optOutRowsOf(sophie, EDITS, day)).toEqual({
      email: { title: 'Unsubscribed from email on Oct 20', note: ONLY },
      texts: { title: 'Unsubscribed from texts on Oct 27', note: null },
    });
  });

  it('shows nothing to someone who cannot edit guests', () => {
    const sophie = withOptOuts(sample('sophie'), { email: '2026-10-20', texts: '2026-10-27' });

    expect(optOutRowsOf(sophie, { edits: false }, day)).toEqual({ email: null, texts: null });
  });

  it('has no line on a row that reads None, and drops one when Edit changes its address', () => {
    const kwame = withOptOuts(sample('kwame'), { email: '2026-10-22', texts: '2026-10-29' });

    expect(optOutRowsOf({ ...kwame, email: null, phone: null }, EDITS, day)).toEqual({
      email: null,
      texts: null,
    });
    expect(optOutRowsOf({ ...kwame, email: 'kwame@mensah.co.uk' }, EDITS, day).email).toBeNull();
    expect(optOutRowsOf({ ...kwame, phone: '+44 7700 900999' }, EDITS, day).texts).toBeNull();
    expect(optOutRowsOf({ ...kwame, phone: '+44 7700 900412' }, EDITS, day).texts).not.toBeNull();
  });
});

describe('the opt-out states (sc-3969)', () => {
  it('lists the six after the WhatsApp states, each with a board in the demo home', () => {
    const after = GUESTS_STATES.indexOf('whatsAppViewer') + 1;
    const hrefs = GUESTS_BOARDS.map((board) => board.href);
    const at = hrefs.indexOf('/demo/guests?state=whatsAppViewer') + 1;

    expect(GUESTS_STATES.slice(after, after + 6)).toEqual(OPT_OUT_STATES);
    expect(hrefs.slice(at, at + 6)).toEqual(
      OPT_OUT_STATES.map((state) => `/demo/guests?state=${state}`),
    );
  });

  it('opens each on the guest the board draws, with its rows', () => {
    expect(OPT_OUT_STATES.map((state) => guestOf(state))).toEqual([
      'kwame',
      'kwame',
      'sophie',
      'sophie',
      'ines',
      'kwame',
    ]);
    expect(rowsAt('optOutEmail')).toEqual({
      email: { title: 'Unsubscribed from email on Oct 22', note: ONLY },
      texts: null,
    });
    expect(rowsAt('optOutTexts')).toEqual({
      email: null,
      texts: { title: 'Unsubscribed from texts on Oct 29', note: ONLY },
    });
    expect(rowsAt('optOutTextsWhatsApp')).toEqual({
      email: null,
      texts: { title: 'Unsubscribed from texts on Oct 27', note: null },
    });
    expect(rowsAt('optOutAll')).toEqual({
      email: { title: 'Unsubscribed from email on Oct 20', note: ONLY },
      texts: { title: 'Unsubscribed from texts on Oct 27', note: null },
    });
    expect(rowsAt('optOutNoMobile')).toEqual({
      email: { title: 'Unsubscribed from email on Oct 25', note: ONLY },
      texts: null,
    });
    expect(rowsAt('optOutViewer')).toEqual({ email: null, texts: null });
  });

  it('reads the closing sentence once per contact row that has a line', () => {
    for (const state of OPT_OUT_STATES) {
      const rows = rowsAt(state);
      const underMobile = [rows.texts?.note, whatsAppAt(state)?.note].filter((n) => n === ONLY);

      expect(rows.email == null || rows.email.note === ONLY).toBe(true);
      expect(underMobile.length).toBeLessThanOrEqual(1);
      if (rows.texts != null) expect(underMobile).toHaveLength(1);
    }
  });

  it('holds the opt-out for a view-only role and opens exactly as whatsAppViewer', () => {
    expect(opened('optOutViewer').g.optOuts?.email).toEqual({
      address: 'kwame.mensah@outlook.com',
      day: '2026-10-22',
    });
    expect(roleOf('optOutViewer')).toBe('viewer');
    expect(guestOf('optOutViewer')).toBe(guestOf('whatsAppViewer'));
    expect(areaStart('optOutViewer')).toEqual(areaStart('whatsAppViewer'));
    expect(withoutOptOuts(guestsAt('optOutViewer'))).toEqual(
      withoutOptOuts(guestsAt('whatsAppViewer')),
    );
    expect(whatsAppAt('optOutViewer')).toBeNull();
  });

  it('keeps the WhatsApp row as each state’s sc-3950 state has it', () => {
    expect(whatsAppAt('optOutEmail')).toEqual(whatsAppAt('whatsAppNone'));
    expect(whatsAppAt('optOutTexts')).toEqual(whatsAppAt('whatsAppNone'));
    expect(whatsAppAt('optOutTextsWhatsApp')).toEqual(whatsAppAt('whatsAppOptedOut'));
    expect(whatsAppAt('optOutAll')).toEqual(whatsAppAt('whatsAppOptedOut'));
    expect(whatsAppAt('optOutNoMobile')).toEqual(whatsAppAt('whatsAppNoMobile'));
    expect(whatsAppAt('optOutViewer')).toEqual(whatsAppAt('whatsAppViewer'));
    expect(whatsAppAt('optOutTexts')).toEqual({
      title: 'Has not agreed to WhatsApp',
      agree: true,
      note: null,
    });
    expect(whatsAppAt('optOutAll')).toEqual({
      title: 'Unsubscribed from WhatsApp on Nov 1',
      agree: false,
      note: ONLY,
    });
  });

  it('changes nothing but the opt-outs, and leaves every other state without one', () => {
    for (const state of OPT_OUT_STATES) {
      expect(withoutOptOuts(guestsAt(state))).toEqual(withoutOptOuts(GUESTS));
      expect(areaStart(state).overlay).toBeNull();
    }
    for (const state of GUESTS_STATES) {
      if ((OPT_OUT_STATES as readonly string[]).includes(state)) continue;
      for (const g of guestsAt(state))
        expect(g.optOuts ?? NO_OPT_OUTS, `${state} ${g.key}`).toEqual(NO_OPT_OUTS);
    }
  });
});
