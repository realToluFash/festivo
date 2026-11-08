import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BAR,
  capLine,
  clockOf,
  countLine,
  dayLabel,
  DOOR_PAGES,
  DOOR_STATES,
  doorStartOf,
  endDays,
  endsLine,
  endTimes,
  endsWords,
  formFrom,
  HOLD_STATES,
  inWithLine,
  doorCodeSaid,
  MAKE_STATES,
  makeLines,
  newLine,
  nextCode,
  normalCode,
  renewed,
  roleLine,
  saidCode,
  shownCode,
  stopLine,
  untilWords,
} from './doorCode.ts';
import { listed, rowLine } from './people.ts';
import { qrPath, qrSeed } from './security.ts';

afterEach(() => vi.restoreAllMocks());

const start = (query: Partial<Record<'state' | 'code' | 'hold' | 'print', string>>) =>
  doorStartOf({ state: null, code: null, hold: null, print: null, ...query });

describe('the door code’s words and checks (sc-72)', () => {
  it('shows the code in two groups, says it one character at a time, and takes it any way typed', () => {
    expect(shownCode('Q7KM4XP2')).toBe('Q7KM 4XP2');
    expect(saidCode('Q7KM4XP2')).toBe('Q 7 K M, 4 X P 2');
    expect(doorCodeSaid('Q7KM4XP2')).toBe('Door code Q 7 K M, 4 X P 2');
    expect(normalCode(' q7km-4xp2 ')).toBe('Q7KM4XP2');
  });

  it('asks for how many people, a whole number from 1 to 500', () => {
    expect(capLine('')).toBe('Enter how many people can use this code.');
    for (const wrong of ['0', '501', '3000', '2.5', 'ten']) {
      expect(capLine(wrong), wrong).toBe('Use a whole number from 1 to 500.');
    }
    expect(capLine(' 30 ')).toBeNull();
    expect(capLine('500')).toBeNull();
  });

  it('refuses an end that has passed, and never offers one after the event', () => {
    expect(endsLine({ kind: 'earlier', day: '2026-11-07', time: '09:00' })).toBe(
      'Choose a time that hasn’t passed yet.',
    );
    expect(endsLine({ kind: 'earlier', day: '2026-11-14', time: '18:00' })).toBeNull();
    expect(endsLine({ kind: 'event' })).toBeNull();
    expect(endDays()).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ]);
    expect(endTimes('2026-11-14').at(-1)).toBe('23:00');
    expect(endTimes('2026-11-13').at(-1)).toBe('23:30');
    expect(makeLines({ role: 'Can view', label: '', cap: '', ends: { kind: 'event' } })).toEqual({
      cap: 'Enter how many people can use this code.',
    });
  });

  it('writes every time on the 24-hour clock', () => {
    expect(untilWords({ kind: 'event' })).toBe('Sat, Nov 14, 23:30');
    expect(untilWords({ kind: 'event' }, '2026-11-14T13:31:00Z')).toBe('23:30');
    expect(endsWords({ kind: 'event' })).toBe('When the event ends · Sat, Nov 14, 23:30');
    expect(endsWords({ kind: 'earlier', day: '2026-11-07', time: '09:00' })).toBe(
      'Earlier · Sat, Nov 7, 09:00',
    );
    expect(countLine(BAR)).toBe('14 of 30 used · until Sat, Nov 14, 23:30');
    expect(inWithLine({ code: 'Q7KM4XP2', at: '13:34' })).toBe(
      'Joined with the door code Q7KM 4XP2 at 13:34.',
    );
  });

  it('says what a new code and Stop keep, for everyone already in', () => {
    expect(roleLine(BAR)).toBe('Door code · Can check guests in · Bar and drinks');
    expect(newLine(BAR)).toBe(
      'Q7KM 4XP2 stops working. The 14 people already in keep their access.',
    );
    expect(stopLine(BAR)).toBe(
      'Nobody new can use it. The 14 people already in keep their access.',
    );
    expect(countLine({ ...BAR, state: 'stopped' })).toBe(
      '14 people came in with it. They keep their access.',
    );
    expect(countLine({ ...BAR, state: 'ranOut', endedAt: '15:00' })).toBe(
      '14 of 30 used · ended at 15:00',
    );
    expect(countLine({ ...BAR, state: 'stopped', used: 0 })).toBe('Nobody came in with it.');
    expect(newLine({ ...BAR, used: 0 })).toBe('Q7KM 4XP2 stops working. Nobody has used it yet.');
    expect(stopLine({ ...BAR, used: 0 })).toBe('Nobody new can use it. Nobody has used it yet.');
  });

  it('gives a new code the same role, label, cap and end, counting from 0', () => {
    expect(renewed(BAR, 'H3WD9RN6')).toEqual({ ...BAR, code: 'H3WD9RN6', used: 0 });
    expect(nextCode(['Q7KM4XP2'])).toBe('H3WD9RN6');
    const ranOut = { ...BAR, ends: { kind: 'earlier', day: '2026-11-07', time: '15:00' } } as const;
    expect(formFrom(ranOut).ends).toEqual({ kind: 'event' });
  });

  it('draws each code with the demo’s one stand-in QR, the same every time, inside its quiet zone', () => {
    const one = qrPath(29, qrSeed('Q7KM4XP2'), 3);
    expect(qrPath(29, qrSeed('Q7KM4XP2'), 3)).toBe(one);
    expect(qrPath(29, qrSeed('H3WD9RN6'), 3)).not.toBe(one);
    expect(one).toContain('M3 3h7v7h-7z');
    expect(one).toContain('M25 3h7v7h-7z');
    expect(one).not.toMatch(/M[0-2] /u);
    expect(qrPath()).toBe(qrPath(21, 4, 0));
  });

  it('lets the reader’s region refine the English day, never replace its language', () => {
    const reading = (tag: string) => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(tag);

      return [dayLabel('2026-11-14'), untilWords({ kind: 'event' })];
    };

    expect(reading('en-US')).toEqual(['Sat, Nov 14', 'Sat, Nov 14, 23:30']);
    expect(reading('en-GB')).toEqual(['Sat 14 Nov', 'Sat 14 Nov, 23:30']);
    expect(reading('pt-PT')).toEqual(['Sat, Nov 14', 'Sat, Nov 14, 23:30']);
    expect(reading('fr-FR')).toEqual(['Sat, Nov 14', 'Sat, Nov 14, 23:30']);
    expect(clockOf('2026-11-14T23:30:00Z')).toBe('23:30');
  });
});

describe('the door code’s states on People at a desk', () => {
  it('names a door code state, and leaves People’s own states alone', () => {
    expect(start({ state: 'people' })).toBeNull();
    expect(start({ state: 'readOnly' })).toBeNull();
    expect(start({ state: 'code' })?.codes).toEqual([BAR]);
    expect(start({ print: '1' })?.print).toBe(true);
  });

  it('lists everyone a code let in, by role then name, each line ending “door code”', () => {
    const people = listed(start({ state: 'code' })?.onEvent ?? []);
    expect(people).toHaveLength(18);
    expect(people.slice(0, 3).map((one) => one.name)).toEqual([
      'Duarte Sousa',
      'Rita Marques',
      'Teresa Matos',
    ]);
    const joao = people.find((one) => one.name === 'João Pereira');
    if (joao == null) throw new Error('João is in by the code');
    expect(rowLine(joao, { id: 'ines' })).toBe('Can check guests in · Bar and drinks · Door code');
    expect(joao.door).toEqual({ code: 'Q7KM4XP2', at: '13:34' });
  });

  it('keeps the list true to each code’s count', () => {
    const count = (state: string) => start({ state })?.onEvent.length;
    expect(count('code-none')).toBe(4);
    expect(count('code-two')).toBe(21);
    expect(count('code-full')).toBe(34);
    expect(count('code-removed')).toBe(17);
  });

  it('keeps the old names opening the same states as the app’s new ones', () => {
    expect(start({ state: 'code-ran-out' })).toEqual(start({ state: 'code-expired' }));
    expect(start({ state: 'code-expired' })?.codes[0]?.state).toBe('ranOut');
  });

  it('opens every state the spec names', () => {
    for (const state of DOOR_STATES) expect(start({ state }), state).not.toBeNull();
    for (const code of MAKE_STATES) expect(start({ code })?.make, code).not.toBeNull();
    for (const hold of HOLD_STATES) expect(start({ hold })?.held, hold).toBe(0);
    expect(start({ code: 'malformed' })?.make?.form.cap).toBe('3000');
    expect(start({ hold: 'stop-failed' })?.ask).toMatchObject({ kind: 'stop', phase: 'failed' });
    expect(start({ state: 'code-removing' })).toMatchObject({ remove: 'held' });
  });

  it('links each of them from the demo’s home', () => {
    const linked = DOOR_PAGES.flatMap((page) => page.states.map((one) => one.to));
    for (const state of DOOR_STATES) expect(linked).toContain(`/demo/people?state=${state}`);
    for (const code of MAKE_STATES) expect(linked).toContain(`/demo/people?code=${code}`);
    for (const hold of HOLD_STATES) expect(linked).toContain(`/demo/people?show=${hold}`);
    expect(linked.filter((to) => /hold=|code-ran-out/u.test(to))).toEqual([]);
    for (const state of ['loading', 'failed', 'readOnly', 'print=1']) {
      expect(linked.some((to) => to.endsWith(state))).toBe(true);
    }
  });
});
