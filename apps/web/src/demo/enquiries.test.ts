import { describe, expect, it } from 'vitest';

import {
  ENQUIRIES,
  NOW,
  PEOPLE,
  byTab,
  changedWords,
  enquiryStateOf,
  matches,
  phoneOf,
  resultsOf,
  startOf,
  type Viewer,
  visibleTo,
  whatLine,
} from './enquiries.ts';

const OWNER: Viewer = { person: PEOPLE.folake, mine: false };
const ADA = ENQUIRIES.find((enquiry) => enquiry.id === 'enq-ada')!;
const NGOZI = ENQUIRIES.find((enquiry) => enquiry.id === 'enq-ngozi')!;
const ids = (typed: string, viewer: Viewer = OWNER) =>
  resultsOf(ENQUIRIES, viewer, typed).groups.flatMap((group) =>
    group.enquiries.map((enquiry) => enquiry.id),
  );

describe('a phone number, read with the organisation’s country', () => {
  it.each([
    '07400 123456',
    '+44 7400 123456',
    '447400123456',
    '0044 7400 123456',
    '(07400) 123-456',
  ])('finds +44 7400 123456 from %s', (typed) => {
    expect(phoneOf(typed)).toBe('+447400123456');
    expect(matches(ADA, typed)).toBe(true);
  });

  it('matches another country’s number on its own code', () => {
    expect(matches(NGOZI, '+234 803 555 0142')).toBe(true);
  });

  it('reads another country’s national format as the organisation’s, and finds nothing', () => {
    expect(phoneOf('0803 555 0142')).toBe('+448035550142');
    expect(ids('0803 555 0142')).toEqual([]);
  });

  it('never matches part of a number', () => {
    expect(ids('7400 123')).toEqual([]);
  });
});

describe('a name and an email', () => {
  it('finds any part of a word, case and accents ignored', () => {
    expect(ids('oka')).toEqual(['enq-ada', 'enq-femi', 'enq-ada-lost']);
    expect(ids('lucia')).toEqual(['enq-lucia']);
  });

  it('takes a curly apostrophe and a straight one as the same, as Events does', () => {
    const obrien = { ...ADA, client: 'Tunde O’Brien' };

    expect(matches(obrien, "o'brien")).toBe(true);
    expect(matches({ ...ADA, client: "Tunde O'Brien" }, 'O’Brien')).toBe(true);
  });

  it('finds a whole email in another case, and nothing from part of one', () => {
    expect(ids('ADA@Example.com ')).toEqual(['enq-ada']);
    expect(ids('example.com')).toEqual([]);
    expect(ids('ada@')).toEqual([]);
  });

  it('never searches the notes', () => {
    expect(ids('Chantilly')).toEqual([]);
  });

  it('ignores a search under two characters', () => {
    expect(matches(ADA, ' o ')).toBe(true);
    expect(resultsOf(ENQUIRIES, OWNER, 'o').count).toBe(ENQUIRIES.length);
  });
});

describe('the results', () => {
  it('groups Open, Won and Lost in that order and leaves out an empty group', () => {
    const results = resultsOf(ENQUIRIES, OWNER, 'oka');

    expect(results.count).toBe(3);
    expect(results.groups.map((group) => [group.tab, group.enquiries.length])).toEqual([
      ['open', 2],
      ['lost', 1],
    ]);
  });

  it('narrows to the person’s own with Assigned to me', () => {
    expect(ids('oka', { person: PEOPLE.folake, mine: true })).toEqual(['enq-ada']);
  });

  it('shows a Member only their own, in the rows and the counts', () => {
    const member = { person: PEOPLE.tunde, mine: false };

    expect(ids('oka', member)).toEqual(['enq-femi', 'enq-ada-lost']);
    expect(ids('07400 123456', member)).toEqual([]);
    expect(byTab(visibleTo(ENQUIRIES, member)).open).toHaveLength(2);
  });
});

describe('the rows', () => {
  const typeWord = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

  it('says the type and the date, or No date yet', () => {
    expect(whatLine(ADA, typeWord, 'No date yet', NOW, 'en-US')).toBe(
      'Wedding · Saturday, Jun 12, 2027',
    );
    expect(whatLine({ ...ADA, date: null }, typeWord, 'No date yet', NOW, 'en-US')).toBe(
      'Wedding · No date yet',
    );
    expect(whatLine({ ...ADA, type: null, date: null }, typeWord, 'No date yet', NOW, 'en')).toBe(
      'No date yet',
    );
  });

  it('says the last change as a relative time', () => {
    expect(changedWords('2026-11-18T08:15:00Z', NOW, 'en')).toBe('2 hours ago');
    expect(changedWords('2026-11-17T09:40:00Z', NOW, 'en')).toBe('Yesterday');
    expect(changedWords('2026-10-02T15:45:00Z', NOW, 'en')).toBe('2 months ago');
  });
});

describe('the states', () => {
  it('starts each named state, and an unknown one at rest', () => {
    expect(startOf(enquiryStateOf('results')).typed).toBe('oka');
    expect(startOf(enquiryStateOf('member')).viewer.person.role).toBe('member');
    expect(enquiryStateOf('nonsense')).toBe('idle');
  });
});
