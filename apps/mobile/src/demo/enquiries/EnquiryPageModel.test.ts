import { describe, expect, it } from 'vitest';

import { PEOPLE } from './EnquiriesModel.ts';
import {
  PAGE_IDS,
  PAGE_STATES,
  PASSED_DATE,
  noteWhen,
  notesNewestFirst,
  pageStartOf,
  pageStateOf,
} from './EnquiryPageModel.ts';

const startOf = (state: (typeof PAGE_STATES)[number]) =>
  pageStartOf(state, PAGE_IDS[state], undefined);

describe('an enquiry’s page states', () => {
  it.each(PAGE_STATES.filter((state) => state !== 'notFound'))('%s finds its enquiry', (state) => {
    expect(startOf(state).enquiry?.id).toBe(PAGE_IDS[state]);
  });

  it('answers a Member opening another’s enquiry as not there', () => {
    const start = startOf('notFound');
    expect(start.viewer).toBe(PEOPLE.tunde);
    expect(start.enquiry).toBeNull();
  });

  it('lets a Member open their own', () => {
    expect(startOf('openMember').enquiry?.assignedTo).toBe('tunde');
  });

  it('opens Close as lost with a 201-character line, the reason kept', () => {
    expect(startOf('closeAsLostTooLong').closing).toEqual({
      reason: 'elsewhere',
      line: 'L'.repeat(201),
      tried: true,
    });
    expect(startOf('closeAsLostTooLong').enquiry?.tab).toBe('open');
  });

  it('shows Ngozi lost with no line', () => {
    expect(startOf('lostNoLine').enquiry?.lost).toEqual({ reason: 'elsewhere', line: null });
  });

  it('puts Bisi’s date in the past', () => {
    expect(startOf('datePassed').enquiry?.date).toBe(PASSED_DATE);
  });

  it('opens Folake’s own note to edit', () => {
    expect(startOf('editNote').editing).toBe('n1');
  });

  it('reads ?as= for who is looking', () => {
    expect(pageStartOf('open', 'enq-femi', 'tunde').viewer).toBe(PEOPLE.tunde);
    expect(pageStateOf('nonsense')).toBe('open');
  });
});

describe('notes', () => {
  it('reads newest first', () => {
    const ids = notesNewestFirst(startOf('withNotes').enquiry?.notesList ?? []).map((n) => n.id);
    expect(ids).toEqual(['n2', 'n1']);
  });

  it('says when, relative to now', () => {
    expect(noteWhen('2026-11-18T09:40:00Z', '2026-11-18T10:00:00Z', 'en')).toBe('20 minutes ago');
    expect(noteWhen('2026-11-17T10:00:00Z', '2026-11-18T10:00:00Z', 'en')).toBe('yesterday');
  });
});
