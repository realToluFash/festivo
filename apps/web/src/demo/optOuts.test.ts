import { describe, expect, it } from 'vitest';

import {
  GUESTS_PAGES,
  GUESTS_STATES,
  type Guest,
  type GuestsState,
  WEDDING,
  dayOf,
  guestsStart,
  recordOptOuts,
  sampleGuests,
  saveGuest,
  valuesOf,
} from './guests.ts';
import { NO_OPT_OUTS, optOutRowsOf } from './optOuts.ts';
import { whatsAppRowOf } from './whatsAppConsent.ts';

const EDITS = { edits: true };
const ONLY = 'Only the guest can change this.';
const OPT_OUT_STATES = [
  'optOutEmail',
  'optOutTexts',
  'optOutTextsWhatsApp',
  'optOutAll',
  'optOutNoMobile',
  'optOutViewer',
] as const;

function opened(state: GuestsState): { guest: Guest; edits: boolean } {
  const start = guestsStart(state, new URLSearchParams());
  const id = start.pane.kind === 'guest' ? start.pane.id : null;
  const guest = start.list.find((one) => one.id === id);
  if (guest == null) throw new Error(state);

  return { guest, edits: start.role === 'owner' };
}

function rowsAt(state: GuestsState) {
  const { guest, edits } = opened(state);

  return optOutRowsOf(guest, { edits }, dayOf);
}

function whatsAppAt(state: GuestsState) {
  const { guest, edits } = opened(state);

  return whatsAppRowOf(guest.whatsApp, { mobile: guest.phone != null, edits }, dayOf);
}

const withoutOptOuts = (list: readonly Guest[]) =>
  list.map((guest) => ({ ...guest, optOuts: NO_OPT_OUTS }));

describe('the opt-out rows (sc-3969)', () => {
  const list = sampleGuests(WEDDING);
  const one = (id: string) => list.find((guest) => guest.id === id) as Guest;
  const kwame = one('kwame');
  const sophie = one('sophie');

  it('shows nothing for a guest with no opt-out on record', () => {
    expect(optOutRowsOf(kwame, EDITS, dayOf)).toEqual({ email: null, texts: null });
  });

  it('closes the email’s line always, and the texts’ unless WhatsApp is opted out', () => {
    const [both] = recordOptOuts([kwame], 'kwame', { email: '2026-10-22', texts: '2026-10-29' });

    expect(optOutRowsOf(both as Guest, EDITS, dayOf)).toEqual({
      email: { title: 'Unsubscribed from email on Oct 22', note: ONLY },
      texts: { title: 'Unsubscribed from texts on Oct 29', note: ONLY },
    });

    const [all] = recordOptOuts([sophie], 'sophie', { email: '2026-10-20', texts: '2026-10-27' });

    expect(optOutRowsOf(all as Guest, EDITS, dayOf)).toEqual({
      email: { title: 'Unsubscribed from email on Oct 20', note: ONLY },
      texts: { title: 'Unsubscribed from texts on Oct 27', note: null },
    });
  });

  it('shows nothing to someone who cannot edit guests', () => {
    const [both] = recordOptOuts([sophie], 'sophie', { email: '2026-10-20', texts: '2026-10-27' });

    expect(optOutRowsOf(both as Guest, { edits: false }, dayOf)).toEqual({
      email: null,
      texts: null,
    });
  });

  it('has no line on a row that reads None', () => {
    const [both] = recordOptOuts([kwame], 'kwame', { email: '2026-10-22', texts: '2026-10-29' });
    const cleared = { ...(both as Guest), email: null, phone: null };

    expect(optOutRowsOf(cleared, EDITS, dayOf)).toEqual({ email: null, texts: null });
  });

  it('drops a line once Edit puts another address on its row, and keeps it for the same one', () => {
    const seeded = recordOptOuts(list, 'kwame', { email: '2026-10-22', texts: '2026-10-29' });
    const values = valuesOf(seeded.find((guest) => guest.id === 'kwame') ?? null);
    const rowsAfter = (changed: Partial<typeof values>) => {
      const saved = saveGuest(seeded, 'kwame', { ...values, ...changed });

      return optOutRowsOf(saved.find((guest) => guest.id === 'kwame') as Guest, EDITS, dayOf);
    };

    expect(rowsAfter({})).toEqual({
      email: { title: 'Unsubscribed from email on Oct 22', note: ONLY },
      texts: { title: 'Unsubscribed from texts on Oct 29', note: ONLY },
    });
    expect(rowsAfter({ email: 'kwame@mensah.co.uk' }).email).toBeNull();
    expect(rowsAfter({ email: 'kwame@mensah.co.uk' }).texts).not.toBeNull();
    expect(rowsAfter({ number: '7700 900999' }).texts).toBeNull();
    expect(rowsAfter({ number: '' }).texts).toBeNull();
  });

  it('takes the same number typed with or without its spaces as the same number', () => {
    const [both] = recordOptOuts([kwame], 'kwame', { email: '2026-10-22', texts: '2026-10-29' });
    const typed = (number: string) =>
      optOutRowsOf({ ...(both as Guest), phone: { country: 'GB', number } }, EDITS, dayOf).texts;

    expect(both?.phone).toEqual({ country: 'GB', number: '7700 900412' });
    expect(typed('7700900412')).not.toBeNull();
    expect(typed(' 7700  900 412 ')).not.toBeNull();
    expect(typed('7700900999')).toBeNull();
  });
});

describe('the opt-out states (sc-3969)', () => {
  it('lists the six after the WhatsApp states, each linked from the demo’s home', () => {
    const keys = GUESTS_STATES.map((state) => state.key);
    const after = keys.indexOf('whatsAppViewer') + 1;
    const linked = GUESTS_PAGES.flatMap((page) => page.states.map((state) => state.to));

    expect(keys.slice(after, after + 6)).toEqual(OPT_OUT_STATES);
    for (const state of OPT_OUT_STATES) expect(linked).toContain(`/demo/guests?state=${state}`);
  });

  it('opens each on the guest the board draws, with its rows', () => {
    expect(OPT_OUT_STATES.map((state) => opened(state).guest.id)).toEqual([
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
      const whatsApp = whatsAppAt(state);
      const underEmail = [rows.email?.note].filter((note) => note === ONLY);
      const underMobile = [rows.texts?.note, whatsApp?.note].filter((note) => note === ONLY);

      expect(underEmail).toHaveLength(rows.email == null ? 0 : 1);
      expect(underMobile.length).toBeLessThanOrEqual(1);
      if (rows.texts != null) expect(underMobile).toHaveLength(1);
    }
  });

  it('holds the opt-out for a view-only role and shows it nothing, as whatsAppViewer', () => {
    const viewer = guestsStart('optOutViewer', new URLSearchParams());
    const plain = guestsStart('whatsAppViewer', new URLSearchParams());

    expect(opened('optOutViewer').guest.optOuts.email).toEqual({
      address: 'kwame.mensah@outlook.com',
      on: '2026-10-22',
    });
    expect({ ...viewer, list: withoutOptOuts(viewer.list) }).toEqual({
      ...plain,
      list: withoutOptOuts(plain.list),
    });
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
    const plain = withoutOptOuts(sampleGuests(WEDDING));

    for (const state of OPT_OUT_STATES)
      expect(withoutOptOuts(guestsStart(state, new URLSearchParams()).list)).toEqual(plain);

    for (const { key } of GUESTS_STATES) {
      if ((OPT_OUT_STATES as readonly string[]).includes(key)) continue;
      const start = guestsStart(key, new URLSearchParams());

      for (const guest of start.list)
        expect(guest.optOuts, `${key} ${guest.id}`).toEqual(NO_OPT_OUTS);
    }
  });
});
