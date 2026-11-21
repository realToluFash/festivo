import { describe, expect, it } from 'vitest';

import { PEOPLE } from './EnquiriesModel.ts';
import { NEW_STATES, TODAY, newStartOf, newStateOf, savedEnquiry } from './EnquiryFormModel.ts';
import { firstRefused, refusalsOf } from './EnquiryRules.ts';

describe('New enquiry’s states', () => {
  it.each(
    NEW_STATES.filter((state) => state.startsWith('invalid') || state.startsWith('phoneToo')),
  )('%s refuses exactly its own field', (state) => {
    const start = newStartOf(state);
    const found = refusalsOf(start.typed, TODAY);
    expect(Object.keys(found)).toEqual([start.refused]);
    expect(firstRefused(found)).toBe(start.refused === 'contact' ? 'phone' : start.refused);
  });

  it.each(['nameAndPhone', 'fixedLine', 'noConnection', 'saving'] as const)(
    '%s passes',
    (state) => {
      expect(refusalsOf(newStartOf(state).typed, TODAY)).toEqual({});
    },
  );

  it('opens as Tunde for a Member', () => {
    expect(newStartOf('member').viewer).toBe(PEOPLE.tunde);
    expect(newStartOf('duplicateMember').viewer).toBe(PEOPLE.tunde);
    expect(newStartOf('duplicateAdmin').viewer).toBe(PEOPLE.folake);
  });

  it('falls back to blank', () => {
    expect(newStateOf('nonsense')).toBe('blank');
  });
});

describe('what Save makes', () => {
  const typed = { ...newStartOf('nameAndPhone').typed, mind: '  A June wedding.  ' };

  it('keeps the phone in E.164 and the mind as the first note', () => {
    const made = savedEnquiry(typed, PEOPLE.folake, null, 'enq-made-1');
    expect(made.phone).toBe('+447700900456');
    expect(made.tab).toBe('open');
    expect(made.notesList).toEqual([
      expect.objectContaining({ author: 'folake', text: 'A June wedding.', edited: false }),
    ]);
  });

  it('saves no note when the mind is blank', () => {
    expect(savedEnquiry({ ...typed, mind: '   ' }, PEOPLE.folake, null, 'x').notesList).toEqual([]);
  });

  it('assigns a Member’s own enquiry to them', () => {
    const made = savedEnquiry({ ...typed, assignedTo: 'kemi' }, PEOPLE.tunde, null, 'x');
    expect(made.assignedTo).toBe('tunde');
  });
});
