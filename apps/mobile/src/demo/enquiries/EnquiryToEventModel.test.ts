import { afterEach, describe, expect, it } from 'vitest';

import { ORG_DEFAULTS, checkOf } from '../events/NewEventModel.ts';
import { currencyRows } from '../events/EventsSample.ts';
import { PEOPLE } from './EnquiriesModel.ts';
import {
  EVENT_ENQUIRIES,
  type EventEnquiry,
  FORM_ENQUIRY,
  FORM_STATES,
  LONG_CLIENT,
  LONG_WHERE,
  ORIGIN_STATES,
  PAGE_STATES,
  cutVisible,
  eventEnquiryOf,
  filledFrom,
  formStateOf,
  fromEnquiry,
  originStateOf,
  pageStateOf,
} from './EnquiryToEventModel.ts';

const BRIDE = '\u{1F470}\u{1F3FD}‍♀️';
const OFFERED = ['NGN', 'GBP', 'EUR', 'USD'];
const fill = (enquiry: EventEnquiry, offered: readonly string[] = OFFERED) =>
  filledFrom(enquiry, offered, ORG_DEFAULTS);
const segmenter = Intl.Segmenter;

function withoutSegmenter(run: () => void) {
  Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(Intl, 'Segmenter', { value: segmenter, configurable: true });
  }
}

afterEach(() => {
  Object.defineProperty(Intl, 'Segmenter', { value: segmenter, configurable: true });
});

describe('cutVisible', () => {
  it.each([
    ['Intl.Segmenter', (run: () => void) => run()],
    ['the Hermes fallback', withoutSegmenter],
  ])('counts clusters with %s', (_, using) => {
    using(() => {
      expect(cutVisible(LONG_CLIENT, 1000)).toBe(LONG_CLIENT);
      expect(cutVisible(LONG_CLIENT, 59).endsWith('bride')).toBe(true);
      expect(cutVisible(LONG_CLIENT, 60)).toBe(
        `Oluwaseun Adebayo-Williams & Chiamaka Nwosu-Okonkwo, bride ${BRIDE}`,
      );
      expect(cutVisible(LONG_CLIENT, 99)).toBe(LONG_CLIENT.slice(0, -1));
      expect(cutVisible(LONG_CLIENT, 100)).toBe(LONG_CLIENT);
      expect(cutVisible(LONG_WHERE, 199)).toBe(LONG_WHERE.slice(0, -1));
      expect(cutVisible(LONG_WHERE, 200)).toBe(LONG_WHERE);
    });
  });

  it('trims the spaces a cut leaves, and only those', () => {
    expect(cutVisible('Bisi Adebayo', 5)).toBe('Bisi');
    expect(cutVisible('Bisi ', 10)).toBe('Bisi ');
  });
});

describe('filledFrom', () => {
  it('fills each field from the enquiry', () => {
    expect(fill(EVENT_ENQUIRIES.bisi)).toEqual({
      name: 'Bisi Adebayo · Anniversary',
      type: 'anniversary',
      hosts: [{ key: 0, name: 'Bisi Adebayo' }],
      photo: false,
      position: 'middle',
      described: '',
      start: { date: '2027-02-14', time: '' },
      end: { date: '2027-02-14', time: '' },
      venueName: 'Victoria Island, Lagos',
      venueAddress: '',
      note: '',
      timeZone: 'Africa/Lagos',
      currency: 'NGN',
      lead: 'Tunde Bakare',
      currencyFrom: 'budget',
    });
  });

  it('leaves blank what a sparse enquiry does not say', () => {
    expect(fill(EVENT_ENQUIRIES.chinedu)).toMatchObject({
      name: 'Chinedu Eze',
      type: '',
      hosts: [{ key: 0, name: 'Chinedu Eze' }],
      start: { date: '', time: '' },
      end: { date: '', time: '' },
      venueName: '',
      currency: 'NGN',
      lead: null,
      currencyFrom: 'organisation',
    });
  });

  it('fills nothing from an empty enquiry', () => {
    const empty: EventEnquiry = {
      id: 'enq-empty',
      client: '',
      type: null,
      date: null,
      where: null,
      budget: null,
      assignedTo: null,
    };

    expect(fill(empty)).toMatchObject({
      name: '',
      type: '',
      hosts: [{ key: 0, name: '' }],
      venueName: '',
      ...ORG_DEFAULTS,
      lead: null,
    });
  });

  it('cuts an over-long name, venue and host, the bride kept whole', () => {
    const long = fill(EVENT_ENQUIRIES.long);

    expect(long.name).toBe(`${LONG_CLIENT} · Religious celebra`);
    expect(long.venueName).toBe(
      'The Civic Centre, Ozumba Mbadiwe Avenue, Victoria Island, Lagos, the main hall and the garden behind it, with the marque',
    );
    expect(long.hosts).toEqual([
      { key: 0, name: `Oluwaseun Adebayo-Williams & Chiamaka Nwosu-Okonkwo, bride ${BRIDE}` },
    ]);
    expect(checkOf(long).refusals.name).toBeUndefined();
  });

  it('takes the budget’s currency when New event offers it', () => {
    expect(fill(EVENT_ENQUIRIES.ada)).toMatchObject({ currency: 'GBP', currencyFrom: 'budget' });
    expect(fill(EVENT_ENQUIRIES.lucia)).toMatchObject({ currency: 'EUR', currencyFrom: 'budget' });
  });

  it('falls back to the organisation’s currency when the budget’s is not offered', () => {
    expect(fill(EVENT_ENQUIRIES.kenji)).toMatchObject({
      currency: 'NGN',
      currencyFrom: 'organisation',
    });
  });

  it('offers every currency the API accepts in the app, JPY among them', () => {
    const rows = currencyRows('').map((row) => row.code);

    expect(fill(EVENT_ENQUIRIES.kenji, rows)).toMatchObject({
      currency: 'JPY',
      currencyFrom: 'budget',
    });
  });

  it('names a lead only for an assigned Member', () => {
    expect(fill(EVENT_ENQUIRIES.bisi).lead).toBe('Tunde Bakare');
    expect(fill({ ...EVENT_ENQUIRIES.bisi, assignedTo: PEOPLE.folake }).lead).toBeNull();
    expect(fill({ ...EVENT_ENQUIRIES.bisi, assignedTo: PEOPLE.kemi }).lead).toBeNull();
    expect(fill({ ...EVENT_ENQUIRIES.bisi, assignedTo: null }).lead).toBeNull();
    expect(
      fill({ ...EVENT_ENQUIRIES.bisi, assignedTo: { ...PEOPLE.tunde, left: true } }).lead,
    ).toBeNull();
    expect(fill(EVENT_ENQUIRIES.femi).lead).toBeNull();
    expect(
      fromEnquiry(EVENT_ENQUIRIES.femi, OFFERED, ORG_DEFAULTS, 'lead-left').from.lead,
    ).toBeNull();
  });
});

describe('the board’s states', () => {
  it('reads each list and nothing else', () => {
    for (const state of PAGE_STATES) expect(pageStateOf(state)).toBe(state);
    for (const state of FORM_STATES) expect(formStateOf(state)).toBe(state);
    for (const state of ORIGIN_STATES) expect(originStateOf(state)).toBe(state);
    expect(pageStateOf('filled')).toBeNull();
    expect(formStateOf(undefined)).toBeNull();
    expect(originStateOf('draft')).toBeNull();
  });

  it('opens every form state on a sample enquiry', () => {
    for (const state of FORM_STATES)
      expect(eventEnquiryOf(EVENT_ENQUIRIES[FORM_ENQUIRY[state]].id)).not.toBeNull();
  });

  it('refuses the filled form’s Create until times are chosen', () => {
    const { from, start } = fromEnquiry(EVENT_ENQUIRIES.bisi, OFFERED, ORG_DEFAULTS, 'refused');
    const check = checkOf(from.typed);

    expect(start).toBe('newRefused');
    expect(Object.keys(check.refusals)).toEqual(['startsAt', 'endsAt']);
    expect(check.summary).toBe('2 fields need fixing, so nothing was sent.');
  });

  it('chooses 14:00 to 22:00 for the states after Create', () => {
    for (const state of ['saving', 'not-open', 'forbidden'] as const) {
      const { from } = fromEnquiry(EVENT_ENQUIRIES.bisi, OFFERED, ORG_DEFAULTS, state);

      expect(checkOf(from.typed).count).toBe(0);
      expect(from.typed.start).toEqual({ date: '2027-02-14', time: '14:00' });
    }
    const notOpen = fromEnquiry(EVENT_ENQUIRIES.bisi, OFFERED, ORG_DEFAULTS, 'not-open');
    expect(notOpen.from.refusal).toBe('notOpen');
    expect(notOpen.start).toBeNull();
    expect(fromEnquiry(EVENT_ENQUIRIES.bisi, OFFERED, ORG_DEFAULTS, 'forbidden').start).toBe(
      'newNotCreated',
    );
    expect(fromEnquiry(EVENT_ENQUIRIES.bisi, OFFERED, ORG_DEFAULTS, 'forbidden').from.refusal).toBe(
      'forbidden',
    );
  });

  it('keeps who was removed as the lead', () => {
    const { from } = fromEnquiry(EVENT_ENQUIRIES.bisi, OFFERED, ORG_DEFAULTS, 'lead-removed');

    expect(from.lead).toEqual({ name: null, was: 'Tunde Bakare' });
    expect(fromEnquiry(EVENT_ENQUIRIES.lucia, OFFERED, ORG_DEFAULTS).from.lead).toBeNull();
  });

  it('keeps Kunle’s passed date, with no warning of its own', () => {
    const { from } = fromEnquiry(EVENT_ENQUIRIES.kunle, OFFERED, ORG_DEFAULTS, 'date-passed');

    expect(from.typed.start).toEqual({ date: '2026-11-14', time: '' });
    expect(from.typed.end).toEqual({ date: '2026-11-14', time: '' });
  });
});
