import { describe, expect, it } from 'vitest';

import { PEOPLE } from './enquiries.ts';
import { CURRENCY_CHOICES, type SampleEvent, sampleEvent } from './events.ts';
import {
  ENQUIRY_EVENT_PAGES,
  ENQUIRY_EVENT_STATES,
  FILLED_STATES,
  LONG_CLIENT,
  LONG_WHERE,
  MADE_STATES,
  SOURCES,
  type SourceEnquiry,
  clustersOf,
  cutVisible,
  enquiryEventStateOf,
  filledFrom,
  filledStateFor,
  filledStateOf,
  fillingOf,
  fromEnquiryShown,
  madeEvent,
  madeStateOf,
} from './enquiryToEvent.ts';
import { ORG_DEFAULTS } from './newEvent.ts';

const OFFERED = CURRENCY_CHOICES.map(([code]) => code);
const BRIDE = '\u{1F470}\u{1F3FD}‍♀️';
const EMPTY: SourceEnquiry = {
  id: 'enq-empty',
  client: 'Chinedu Eze',
  type: null,
  date: null,
  where: null,
  budget: null,
  assignee: null,
};

const fill = (enquiry: SourceEnquiry) => filledFrom(enquiry, OFFERED, ORG_DEFAULTS);

describe('cutVisible (sc-31232)', () => {
  it('counts the long samples as the spec does, by either rule', () => {
    for (const segmenter of [true, false]) {
      expect(clustersOf(LONG_CLIENT, segmenter)).toHaveLength(100);
      expect(clustersOf(LONG_CLIENT, segmenter)[59]).toBe(BRIDE);
      expect(clustersOf(LONG_WHERE, segmenter)).toHaveLength(200);
    }
  });

  it('keeps a text within the limit whole, and trims the space a cut leaves', () => {
    expect(cutVisible('Bisi Adebayo', 60)).toBe('Bisi Adebayo');
    expect(cutVisible('Bisi Adebayo', 5)).toBe('Bisi');
    expect(cutVisible('Bisi Adebayo', 5, false)).toBe('Bisi');
  });

  it('never splits the emoji at the 60th cluster, by either rule', () => {
    for (const segmenter of [true, false]) {
      const cut = cutVisible(LONG_CLIENT, 60, segmenter);

      expect(cut.endsWith(BRIDE)).toBe(true);
      expect(clustersOf(cut, segmenter)).toHaveLength(60);
    }
  });
});

describe('filledFrom (sc-31232)', () => {
  it('maps each field of Bisi Adebayo’s enquiry, and leaves the rest empty', () => {
    expect(fill(SOURCES.bisi)).toEqual({
      name: 'Bisi Adebayo · Anniversary',
      type: 'anniversary',
      hosts: ['Bisi Adebayo'],
      photo: false,
      position: 50,
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

  it('fills an empty enquiry with the client alone and the organisation’s defaults', () => {
    const filled = fill(EMPTY);

    expect(filled.name).toBe('Chinedu Eze');
    expect(filled.type).toBe('');
    expect(filled.start).toEqual({ date: '', time: '' });
    expect(filled.end).toEqual({ date: '', time: '' });
    expect(filled.venueName).toBe('');
    expect(filled.hosts).toEqual(['Chinedu Eze']);
    expect(filled.currency).toBe('NGN');
    expect(filled.currencyFrom).toBe('organisation');
    expect(filled.lead).toBeNull();
  });

  it('cuts an over-long name, venue and host', () => {
    const filled = fill(SOURCES.long);

    expect(filled.name).toBe(
      `Oluwaseun Adebayo-Williams & Chiamaka Nwosu-Okonkwo, bride ${BRIDE} and groom, both families, Lagos & Enugu · Religious celebra`,
    );
    expect(clustersOf(filled.name)).toHaveLength(120);
    expect(filled.hosts).toEqual([
      `Oluwaseun Adebayo-Williams & Chiamaka Nwosu-Okonkwo, bride ${BRIDE}`,
    ]);
    expect(filled.venueName).toBe(
      'The Civic Centre, Ozumba Mbadiwe Avenue, Victoria Island, Lagos, the main hall and the garden behind it, with the marque',
    );
    expect(filled.currencyFrom).toBe('organisation');
  });

  it('takes a budget’s currency New event offers, and the organisation’s for one it does not', () => {
    expect(fill(SOURCES.ada)).toMatchObject({ currency: 'GBP', currencyFrom: 'budget' });
    expect(fill(SOURCES.lucia)).toMatchObject({ currency: 'EUR', currencyFrom: 'budget' });
    expect(fill(SOURCES.kenji)).toMatchObject({ currency: 'NGN', currencyFrom: 'organisation' });
  });

  it('names a lead only when the assignee is a Member', () => {
    expect(fill({ ...EMPTY, assignee: PEOPLE.tunde }).lead).toBe('Tunde Bakare');
    expect(fill({ ...EMPTY, assignee: PEOPLE.folake }).lead).toBeNull();
    expect(fill({ ...EMPTY, assignee: PEOPLE.kemi }).lead).toBeNull();
    expect(fill(EMPTY).lead).toBeNull();
  });

  it('names no lead for a Member who has left', () => {
    expect(fill({ ...EMPTY, assignee: { ...PEOPLE.tunde, left: true } }).lead).toBeNull();
    expect(fill(SOURCES.femi).lead).toBeNull();
  });
});

describe('the states (sc-31232)', () => {
  it('knows every state it names, and none other', () => {
    for (const one of ENQUIRY_EVENT_STATES) expect(enquiryEventStateOf(one)).toBe(one);
    for (const one of FILLED_STATES) expect(filledStateOf(one)).toBe(one);
    for (const one of MADE_STATES) expect(madeStateOf(one)).toBe(one);
    expect(enquiryEventStateOf('idle')).toBeNull();
    expect(filledStateOf(null)).toBeNull();
    expect(madeStateOf('draft')).toBeNull();
  });

  it('links every state from the demo’s home, each once', () => {
    const links = ENQUIRY_EVENT_PAGES.flatMap((page) => page.states.map((one) => one.to));

    expect(new Set(links).size).toBe(links.length);
    for (const one of ENQUIRY_EVENT_STATES)
      expect(links).toContain(`/demo/enquiries/enq-bisi-event?state=${one}`);
    for (const one of FILLED_STATES)
      expect(links).toContain(`/demo/events/new?from=enquiry&state=${one}`);
    for (const one of MADE_STATES) expect(links).toContain(`/demo/events/evt-draft-4?state=${one}`);
  });

  it('opens New event as the spec draws each state', () => {
    expect(fillingOf('filled', OFFERED)).toMatchObject({ lead: 'Tunde Bakare', as: null });
    expect(fillingOf('sparse', OFFERED)).toMatchObject({ client: 'Chinedu Eze', lead: null });
    expect(fillingOf('lead-removed', OFFERED).leadRemoved).toBe(true);
    expect(fillingOf('lead-none', OFFERED)).toMatchObject({ lead: null, currencyFrom: 'budget' });
    expect(fillingOf('currency-not-offered', OFFERED).currencyFrom).toBe('organisation');
    expect(fillingOf('refused', OFFERED).as).toBe('refused');
    expect(fillingOf('saving', OFFERED)).toMatchObject({ as: 'creating', refusal: null });
    expect(fillingOf('saving', OFFERED).typed.start).toEqual({ date: '2027-02-14', time: '14:00' });
    expect(fillingOf('saving', OFFERED).typed.end).toEqual({ date: '2027-02-14', time: '22:00' });
    expect(fillingOf('lead-left', OFFERED)).toMatchObject({ client: 'Femi Ogunleye', lead: null });
    expect(fillingOf('not-open', OFFERED)).toMatchObject({
      as: null,
      refusal: null,
      leaves: '/demo/enquiries/enq-bisi-event?state=not-open',
    });
    expect(fillingOf('forbidden', OFFERED).leaves).toBeNull();
    expect(fillingOf('forbidden', OFFERED).refusal).toBe(
      'Not created. Only an owner or admin can create an event from an enquiry.',
    );
    expect(fillingOf('filled', OFFERED).opens).toBe('/demo/events/evt-draft-4?state=from-enquiry');
  });

  it('opens the matching New event from each enquiry', () => {
    expect(filledStateFor(SOURCES.bisi)).toBe('filled');
    expect(filledStateFor(SOURCES.chinedu)).toBe('sparse');
    expect(filledStateFor(SOURCES.kenji)).toBe('currency-not-offered');
  });

  it('makes the draft Bisi Adebayo · Anniversary, and shows where it came from only when it may', () => {
    const made = madeEvent(sampleEvent('evt-draft-4') as SampleEvent);

    expect(made).toMatchObject({
      id: 'evt-draft-4',
      name: 'Bisi Adebayo · Anniversary',
      status: 'draft',
      hosts: ['Bisi Adebayo'],
      currency: 'NGN',
      timeZone: 'Africa/Lagos',
    });
    expect(fromEnquiryShown('from-enquiry')).toBe(true);
    expect(fromEnquiryShown('from-enquiry-hidden')).toBe(false);
    expect(fromEnquiryShown('free-plan')).toBe(false);
  });
});
