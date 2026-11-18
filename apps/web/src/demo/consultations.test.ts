import { describe, expect, it } from 'vitest';

import {
  CW,
  type Consultation,
  type Draft,
  SAMPLE,
  cancelledByLost,
  changeable,
  consultationStart,
  draftOf,
  earliestFirst,
  fixedLeaderWords,
  instantOf,
  isHttps,
  mayEdit,
  nextOf,
  openOrder,
  problemsOf,
  relativeWords,
  skipWords,
  standingOf,
  timesWords,
  nextFor,
} from './consultations.ts';
import { ENQUIRIES, NOW, PEOPLE } from './enquiries.ts';

const MIXED: Consultation[] = [SAMPLE.next, SAMPLE.underWay, SAMPLE.called];

const draft = (patch: Partial<Draft> = {}): Draft => ({
  date: '2026-11-25',
  time: '15:00',
  timeZone: 'Europe/London',
  minutes: 60,
  how: 'inPerson',
  where: '',
  link: '',
  ledBy: 'kemi',
  ...patch,
});

describe('a consultation’s standing', () => {
  it('is Held from its start, while it is still under way', () => {
    expect(standingOf(SAMPLE.underWay, MIXED)).toBe('held');
    expect(changeable(SAMPLE.underWay)).toBe(false);
  });

  it('marks Next on the earliest one not started and not cancelled', () => {
    expect(nextOf(MIXED)?.id).toBe(SAMPLE.next.id);
    expect(standingOf(SAMPLE.called, MIXED)).toBe('cancelled');
    expect(standingOf(SAMPLE.next, MIXED)).toBe('next');
    expect(standingOf(SAMPLE.later, [SAMPLE.next, SAMPLE.later])).toBe('booked');
  });

  it('stays Cancelled after its start passes, never Held', () => {
    expect(standingOf(SAMPLE.called, MIXED, '2026-11-20T09:00:00Z')).toBe('cancelled');
  });

  it('lists earliest first', () => {
    expect(earliestFirst(MIXED).map((one) => one.id)).toEqual([
      SAMPLE.underWay.id,
      SAMPLE.called.id,
      SAMPLE.next.id,
    ]);
  });
});

describe('closing as Lost', () => {
  it('cancels only the ones not yet started', () => {
    expect(cancelledByLost([SAMPLE.underWay, SAMPLE.next, SAMPLE.later, SAMPLE.called])).toBe(2);
    expect(CW.closeLostCancels(1)).toBe('It will cancel 1 consultation.');
    expect(CW.closeLostCancels(2)).toBe('It will cancel 2 consultations.');
  });
});

describe('the words on a row', () => {
  it('reads start–end on the 24-hour clock, naming another zone', () => {
    expect(timesWords(SAMPLE.next, 'en')).toBe('14:30–15:30');
    expect(timesWords(SAMPLE.madrid, 'en')).toBe('09:00–09:45 Europe/Madrid');
  });

  it('gives the Open row a relative day and time', () => {
    expect(relativeWords(SAMPLE.next, 'en')).toBe('Consultation tomorrow, 14:30');
    expect(relativeWords(SAMPLE.later, 'en')).toBe('Consultation Tuesday, 11:00');
  });
});

describe('the Open list', () => {
  it('puts a next consultation first, soonest first, then the rest by last change', () => {
    const open = ENQUIRIES.filter((one) => one.tab === 'open');

    expect(openOrder(open, nextFor).map((one) => one.id)).toEqual([
      'enq-lucia',
      'enq-femi',
      'enq-ada',
      'enq-long',
      'enq-chinedu',
      'enq-bisi',
    ]);
  });
});

describe('Book a consultation refuses before it sends', () => {
  it('asks for the date and the start time', () => {
    expect(problemsOf(draft({ date: '', time: '' }), true)).toEqual({
      date: CW.dateMissing,
      time: CW.timeMissing,
    });
  });

  it('refuses a past start only once the start was set or changed', () => {
    const past = draft({ date: '2026-11-18', time: '09:00' });

    expect(problemsOf(past, true).time).toBe(CW.passed);
    expect(problemsOf(past, false).time).toBeUndefined();
  });

  it('reads the start in the chosen zone', () => {
    const madrid = draft({ date: '2026-11-18', time: '10:30', timeZone: 'Europe/Madrid' });

    expect(problemsOf(madrid, true, NOW).time).toBe(CW.passed);
    expect(problemsOf({ ...madrid, timeZone: 'America/New_York' }, true).time).toBeUndefined();
  });

  it('keeps Where to 200 characters and a link to https', () => {
    expect(problemsOf(draft({ where: 'x'.repeat(201) }), true).where).toBe(CW.whereTooLong);
    expect(problemsOf(draft({ where: 'x'.repeat(200) }), true).where).toBeUndefined();
    expect(problemsOf(draft({ how: 'video', link: 'http://meet.example.com' }), true).link).toBe(
      CW.linkNotHttps,
    );
    expect(isHttps('https://meet.example.com/a')).toBe(true);
    expect(isHttps('meet.example.com')).toBe(false);
  });

  it('needs someone to lead it', () => {
    expect(problemsOf(draft({ ledBy: null }), true).ledBy).toBe(CW.ledByMissing);
  });
});

describe('the clocks', () => {
  it('says what a skipped start is saved as, in New event’s words', () => {
    expect(skipWords(draft({ date: '2027-03-28', time: '01:30' }), 'en')).toBe(
      'There is no 01:30 on Sun, Mar 28 in Europe/London: the clocks go forward that night. It will be saved as 02:30.',
    );
    expect(instantOf('2027-03-28', '01:30', 'Europe/London')).toBe('2027-03-28T01:30:00.000Z');
  });

  it('takes the first of a time the clocks pass twice', () => {
    expect(instantOf('2026-10-25', '01:30', 'Europe/London')).toBe('2026-10-25T00:30:00.000Z');
  });

  it('moves a skipped start past a jump outside London', () => {
    expect(instantOf('2027-03-14', '02:30', 'America/New_York')).toBe('2027-03-14T07:30:00.000Z');
    expect(instantOf('2027-03-14', '02:30', 'America/Los_Angeles')).toBe(
      '2027-03-14T10:30:00.000Z',
    );
  });

  it('takes the first of a repeated time outside London', () => {
    expect(instantOf('2026-04-05', '02:30', 'Australia/Sydney')).toBe('2026-04-04T15:30:00.000Z');
  });
});

describe('who may change them', () => {
  it('lets a Member who leads but is not assigned only read', () => {
    const start = consultationStart('leaderReadOnly');

    expect(mayEdit(start.enquiry, start.viewer)).toBe(false);
    expect(mayEdit(start.enquiry, PEOPLE.folake)).toBe(true);
  });

  it('fixes Led by to a booking Member, and defaults it to Assigned to for an Owner', () => {
    const member = consultationStart('memberBooking');
    const owner = consultationStart('ownerBooking');
    const unassigned = consultationStart('ownerNotAssigned');

    expect(member.panel.kind === 'book' && member.panel.draft.ledBy).toBe('tunde');
    expect(owner.panel.kind === 'book' && owner.panel.draft.ledBy).toBe('kemi');
    expect(unassigned.panel.kind === 'book' && unassigned.panel.draft.ledBy).toBeNull();
  });

  it('keeps Led by when a Member changes one an Owner gave to someone else', () => {
    const changed = draftOf(SAMPLE.next, ENQUIRIES[0]!, PEOPLE.tunde);

    expect(changed.ledBy).toBe('kemi');
    expect(fixedLeaderWords(changed, PEOPLE.tunde)).toBe('Kemi Ojo');
    expect(fixedLeaderWords({ ...changed, ledBy: 'tunde' }, PEOPLE.tunde)).toBe(
      CW.ledByYou('Tunde Bakare'),
    );
    expect(fixedLeaderWords({ ...changed, ledBy: null }, PEOPLE.tunde)).toBe(CW.nobodyLeading);
    expect(problemsOf({ ...changed, ledBy: null }, false, NOW, false).ledBy).toBeUndefined();
  });
});
