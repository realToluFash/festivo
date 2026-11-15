import { describe, expect, it } from 'vitest';

import {
  type Draft,
  RW,
  draftOf,
  entryFrom,
  linkOf,
  memberOf,
  nextLine,
  problemsOf,
  sample,
  sharesNumber,
  sorted,
} from './roster.ts';

const draft = (o: Partial<Draft>): Draft => ({ ...draftOf(null), ...o });
const byId = (id: string) => sample().find((one) => one.id === id)!;

describe('the roster (sc-3906)', () => {
  it('sorts by shift start, then name, with nobody on a shift last', () => {
    const names = sorted(sample()).map((one) => one.name);
    expect(names.slice(0, 3)).toEqual(['Ada Nnaji', 'Bisi Okon', 'Tayo Bamidele']);
    expect(names.at(-1)).toBe('Chinedu Eze');
  });

  it('sorts a shift starting after midnight after the evening’s', () => {
    const [ada, bisi] = sample();
    const names = sorted([
      { ...ada!, name: 'Late', shift: '00:30 to 06:00' },
      { ...bisi!, name: 'Early', shift: '15:00 to 23:00' },
    ]).map((one) => one.name);
    expect(names).toEqual(['Early', 'Late']);
  });

  it('reads Add a mobile number with no number, and every row as removed after the erasure', () => {
    expect(linkOf(byId('ada'), false)).toBe('noMobile');
    expect(linkOf(byId('amina'), false)).toBe('copied');
    expect(linkOf(byId('grace'), true)).toBe('erased');
  });

  it('checks the name, the number’s length for its country and the email’s shape', () => {
    expect(problemsOf(draft({}), true)).toEqual({ name: RW.blank });
    expect(problemsOf(draft({ name: 'Kemi', number: '0803 111' }), true).number).toBe(
      'That number looks too short for Nigeria. Check it and try again.',
    );
    expect(problemsOf(draft({ name: 'Kemi', number: '0803 111 0013 44556' }), true).number).toBe(
      'That number looks too long for Nigeria. Check it and try again.',
    );
    expect(problemsOf(draft({ name: 'Kemi', email: 'kemi@' }), true).email).toBe(RW.emailShape);
    expect(problemsOf(draft({ name: 'Kemi', email: 'kemi@' }), false)).toEqual({});
  });

  it('warns on Add for a number another entry uses, compared as E.164', () => {
    const shared = sharesNumber(sample(), draft({ name: 'Funmi', number: '0803111 0009' }), null);
    expect(shared?.name).toBe('Kunle Ajayi');
    expect(sharesNumber(sample(), draft({ name: 'Funmi', number: '0803 111 0099' }), null)).toBe(
      null,
    );
  });

  it('names the first other entry in roster order when more than one shares it', () => {
    const entries = [
      ...sample(),
      { ...byId('kunle'), id: 'early', name: 'Zainab Early', shift: '15:00 to 23:00' },
    ];
    expect(sharesNumber(entries, draft({ name: 'X', number: '0803 111 0009' }), null)?.name).toBe(
      'Zainab Early',
    );
  });

  it('warns on Edit only when the number changed, a number typed where none was included', () => {
    const kunle = byId('kunle');
    const tolu = byId('tolu');
    const ada = byId('ada');
    const entries = [...sample(), { ...tolu, id: 'twin', name: 'Twin', mobile: kunle.mobile }];
    expect(sharesNumber(entries, draftOf(kunle), kunle)).toBe(null);
    expect(sharesNumber(entries, { ...draftOf(tolu), number: '0803 111 0008' }, tolu)?.name).toBe(
      'Grace Udo',
    );
    expect(sharesNumber(entries, { ...draftOf(ada), number: '0803 111 0008' }, ada)?.name).toBe(
      'Grace Udo',
    );
  });

  it('links a member by number or email, and keeps the typed name', () => {
    const typed = draft({ name: 'Mara Obi', email: 'Amara.Obi@ireevents.com' });
    expect(memberOf(typed)).toBe('Amara Obi');
    expect(memberOf(draft({ name: 'Mara', number: '0803 555 0142' }))).toBe('Amara Obi');
    expect(entryFrom(typed, null).name).toBe('Mara Obi');
  });

  it('asks to send links while anyone with a number has none, and for hours once finished', () => {
    expect(nextLine(sample(), false)).toBe(RW.nextSend);
    expect(nextLine([byId('grace')], false)).toBe(null);
    expect(nextLine(sample(), true)).toBe(RW.nextHours);
  });
});
