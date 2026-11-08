import { describe, expect, it } from 'vitest';

import {
  joinedWithLine,
  listed,
  rowLine,
  seesEveryEvent,
  sheetLine,
} from '../people/PeopleSample.ts';
import { DOOR_CODE_BOARDS } from './DoorCodeBoards.ts';
import {
  BAR_CODE,
  capProblem,
  atWords,
  cardLine,
  cardStep,
  codeStatus,
  type DoorStart,
  doorMembers,
  doorStartOf,
  earlierEnds,
  endsProblem,
  endsRowLine,
  everyone,
  firstProblem,
  formFrom,
  formProblems,
  HOLD_STATES,
  INES,
  JOAO_ID,
  MAKE_STATES,
  madeCode,
  nextCode,
  ORGANISATION,
  PEOPLE_DOOR_STATES,
  renewed,
  underCard,
} from './DoorCodeModel.ts';
import { cameIn, codeSaid, doorCodeSaid, newLine, qrSaid, stopLine, W } from './DoorCodeWords.ts';
import { REDEEM_STATES } from './RedeemModel.ts';

const LOCALE = 'en-US';

function opened(state: string | undefined, code?: string, hold?: string): DoorStart {
  const start = doorStartOf(state, code, hold);
  if (start == null) throw new Error(`${String(state ?? code ?? hold)} is a door code state.`);

  return start;
}

const lines = (start: DoorStart) =>
  start.codes.map((code) => cardLine(code, LOCALE, start.now.date));

describe('People with a door code, by state (spec §5)', () => {
  it('leaves People’s own states and any other link alone', () => {
    for (const state of [undefined, 'people', 'readOnly', 'loading', 'failed', 'lead', 'nope'])
      expect(doorStartOf(state, undefined, undefined)).toBeNull();
  });

  it('opens the working code on Lumen Feiras’ wedding, Inês looking, eighteen on the event', () => {
    const start = opened('code');

    expect(start.people.world?.organisation).toBe('Lumen Feiras');
    expect(start.people.world?.event).toBe('Joana & Rui’s wedding');
    expect(start.people.viewer).toEqual(INES);
    expect(start.people.onEvent).toHaveLength(18);
    expect(start.codes.map((code) => code.code)).toEqual(['Q7KM 4XP2']);
    expect(lines(start)).toEqual(['14 of 30 used · until 23:30']);
  });

  it('has no code and nobody in by one before a code is made', () => {
    const start = opened('code-none');

    expect(start.codes).toEqual([]);
    expect(start.people.onEvent.some((one) => one.byCode != null)).toBe(false);
  });

  it('shows a card per code, newest last', () => {
    expect(lines(opened('code-two'))).toEqual([
      '14 of 30 used · until 23:30',
      '3 of 5 used · until 23:30',
    ]);
  });

  it('lists as many people in by each code as its card counts (pm, 7 Nov)', () => {
    for (const state of PEOPLE_DOOR_STATES) {
      const start = opened(state);
      const removed = state === 'code-removed' ? 1 : 0;

      for (const code of start.codes) {
        const listedHere = start.people.onEvent.filter((one) => one.byCode?.code === code.code);

        expect(listedHere.length + removed, `${state}, ${code.code}`).toBe(code.used);
      }
    }
    expect(opened('code-two').people.onEvent).toHaveLength(21);
    expect(opened('code-full').people.onEvent).toHaveLength(9);
  });

  it('says full, stopped and ran out with the card’s own line', () => {
    expect(opened('code-full').codes.map(codeStatus)).toEqual(['full']);
    expect(opened('code-full').codes.map((code) => code.code)).toEqual(['M4TB 7KQ8']);
    expect(lines(opened('code-full'))).toEqual(['5 of 5 used · until 23:30']);
    expect(lines(opened('code-stopped'))).toEqual([
      '14 people came in with it. They keep their access.',
    ]);
    expect(lines(opened('code-expired'))).toEqual(['14 of 30 used · ended at 15:00']);
  });

  it('lands a made code at nought used, with the toast', () => {
    const start = opened('code-made');

    expect(lines(start)).toEqual(['0 of 30 used · until Sat, Nov 14, 23:30']);
    expect(start.people.toast).toBe('Door code made.');
  });

  it('opens João’s sheet, his Remove asking, and sending', () => {
    expect(opened('code-person').people.opened).toEqual({ id: JOAO_ID, removing: null });
    expect(opened('code-remove').people.opened).toEqual({ id: JOAO_ID, removing: 'ask' });
    expect(opened('code-removing').people.opened).toEqual({ id: JOAO_ID, removing: 'sending' });
  });

  it('takes João off, seventeen left and the code still working', () => {
    const start = opened('code-removed');

    expect(start.people.onEvent).toHaveLength(17);
    expect(start.people.toast).toBe('João Pereira is off this event.');
    expect(start.codes.map(codeStatus)).toEqual(['working']);
  });

  it('gives each state its step and what goes under the card', () => {
    expect(cardStep('working')).toBe('hold');
    expect(['full', 'stopped', 'expired'].map((one) => cardStep(one as 'full'))).toEqual([
      'makeNew',
      'makeNew',
      'makeNew',
    ]);
    expect(underCard('working')).toEqual(['makeNew', 'stop']);
    expect(underCard('full')).toEqual(['stop']);
    expect(underCard('stopped')).toEqual([]);
    expect(underCard('expired')).toEqual([]);
  });
});

describe('who is on People, and how they are there', () => {
  const people = everyone();
  const joao = people.find((one) => one.id === JOAO_ID);

  it('ends the line of each person a code let in with “Door code” (l10n, #32341)', () => {
    if (joao?.byCode == null) throw new Error('João is on the event by the code.');

    expect(rowLine(joao, INES)).toBe('Can check guests in · Bar and drinks · Door code');
    expect(sheetLine(joao, ORGANISATION)).toBe('From outside Lumen Feiras · Bar and drinks');
    expect(joinedWithLine(joao.byCode, LOCALE, '2026-11-14')).toBe(
      'Joined with the door code Q7KM 4XP2 at 13:34.',
    );
    expect(joinedWithLine(joao.byCode, LOCALE, '2026-11-07')).toBe(
      'Joined with the door code Q7KM 4XP2 at Sat, Nov 14, 13:34.',
    );
  });

  it('lists by role, then name', () => {
    expect(
      listed(people)
        .slice(0, 5)
        .map((one) => one.name),
    ).toEqual(['Duarte Sousa', 'Rita Marques', 'Teresa Matos', 'Amara Diallo', 'Beatriz Santos']);
  });

  it('names Lumen Feiras’ owner and admin at the foot', () => {
    expect(seesEveryEvent(doorMembers(), ORGANISATION)).toBe(
      'Inês Carvalho and Julien Moreau see every event, as owner and admin of Lumen Feiras.',
    );
  });
});

describe('making a code (spec §2.2)', () => {
  it('starts on Can view with no number and the event’s end', () => {
    expect(formFrom(null)).toEqual({ role: 'Can view', job: '', cap: '', ends: { kind: 'event' } });
    expect(endsRowLine({ kind: 'event' }, LOCALE)).toBe('When the event ends · Sat, Nov 14, 23:30');
  });

  it('needs a whole number from 1 to 500', () => {
    expect(capProblem('')).toBe(W.capBlank);
    expect(capProblem('  ')).toBe(W.capBlank);
    for (const typed of ['3000', '0', '2.5', '-1', '501', 'ten'])
      expect(capProblem(typed)).toBe(W.capRange);
    for (const typed of ['1', '30', '500', ' 30 ']) expect(capProblem(typed)).toBeNull();
  });

  it('refuses an end that has passed, and never offers one after the event', () => {
    expect(endsProblem({ kind: 'earlier', date: '2026-11-07', time: '09:00' })).toBe(W.past);
    expect(endsProblem({ kind: 'earlier', date: '2026-11-14', time: '18:00' })).toBeNull();
    expect(endsProblem({ kind: 'event' })).toBeNull();
    expect(earlierEnds('2026-11-15', '01:00')).toEqual({ kind: 'event' });
    expect(earlierEnds('2026-11-14', '18:00')).toEqual({
      kind: 'earlier',
      date: '2026-11-14',
      time: '18:00',
    });
    expect(endsRowLine(earlierEnds('2026-11-14', '18:00'), LOCALE)).toBe(
      'Earlier · Sat, Nov 14, 18:00',
    );
  });

  it('checks every field and names the first wrong one', () => {
    const blank = formProblems(formFrom(null));

    expect(blank).toEqual({ cap: W.capBlank, ends: null });
    expect(firstProblem(blank)).toBe('cap');
    expect(
      firstProblem(
        formProblems({
          role: 'Can view',
          job: '',
          cap: '30',
          ends: { kind: 'earlier', date: '2026-11-01', time: '10:00' },
        }),
      ),
    ).toBe('ends');
  });

  it('opens each making state as the boards draw it', () => {
    const made = (state: string) => opened(undefined, state).make;

    expect(MAKE_STATES.map((state) => made(state) != null)).toEqual(MAKE_STATES.map(() => true));
    expect(made('blank')?.problems.cap).toBe(W.capBlank);
    expect(made('malformed')?.form.cap).toBe('3000');
    expect(made('malformed')?.problems.cap).toBe(W.capRange);
    expect(made('ends')?.endsDraft).toEqual({ kind: 'earlier', date: '2026-11-14', time: '18:00' });
    expect(made('past')?.problems.ends).toBe(W.past);
    expect(made('making')?.sending).toBe('held');
    expect(made('failed')?.failed).toBe(true);
    expect(opened(undefined, 'open').codes).toEqual([]);
  });

  it('makes the next code nobody has had, at nought used', () => {
    const code = madeCode(
      { role: 'Can check guests in', job: ' Bar and drinks ', cap: '30', ends: { kind: 'event' } },
      [],
    );

    expect(code).toMatchObject({ code: 'Q7KM 4XP2', job: 'Bar and drinks', cap: 30, used: 0 });
    expect(madeCode(formFrom(null), []).job).toBeNull();
    expect(nextCode(['Q7KM 4XP2'])).toBe('H3WD 9RN6');
  });
});

describe('holding it up, a new code and stopping (spec §2.3, §2.4)', () => {
  it('holds the working code up', () => {
    for (const state of HOLD_STATES)
      expect(opened(undefined, undefined, state).hold).not.toBeNull();
    expect(opened(undefined, undefined, 'open').hold).toMatchObject({ ask: null, joins: false });
    expect(opened(undefined, undefined, 'counted').hold?.joins).toBe(true);
  });

  it('asks before a new code and before stopping, and says who keeps their access', () => {
    expect(opened(undefined, undefined, 'new-ask').hold?.ask).toBe('new');
    expect(opened(undefined, undefined, 'stop-ask').hold?.ask).toBe('stop');
    expect(opened(undefined, undefined, 'stopping').hold).toMatchObject({
      ask: 'stop',
      stopping: true,
    });
    expect(opened(undefined, undefined, 'stop-failed').hold).toMatchObject({
      ask: 'stop',
      failed: true,
    });
    expect(newLine('Q7KM 4XP2', 14)).toBe(
      'Q7KM 4XP2 stops working. The 14 people already in keep their access.',
    );
    expect(stopLine(14)).toBe('Nobody new can use it. The 14 people already in keep their access.');
  });

  it('says one person in the singular, and at nought that nobody has used it (pm, 8 Nov)', () => {
    expect(stopLine(1)).toBe('Nobody new can use it. The 1 person already in keeps their access.');
    expect(newLine('H3WD 9RN6', 0)).toBe('H3WD 9RN6 stops working. Nobody has used it yet.');
    expect(stopLine(0)).toBe('Nobody new can use it. Nobody has used it yet.');
    expect(cameIn(1)).toBe('1 person came in with it. They keep their access.');
  });

  it('says a stopped or ran-out card nobody used came in with nobody (pm, 7 Nov)', () => {
    const unused = { ...BAR_CODE, used: 0 };

    const day = '2026-11-14';
    const expired = { ...BAR_CODE, ends: { kind: 'earlier', date: day, time: '15:00' } } as const;

    expect(cardLine({ ...unused, stopped: true }, LOCALE, day)).toBe('Nobody came in with it.');
    expect(cardLine({ ...expired, used: 0, endedAt: '15:00' }, LOCALE, day)).toBe(
      'Nobody came in with it.',
    );
    expect(cardLine({ ...expired, endedAt: '15:00' }, LOCALE, day)).toBe(
      '14 of 30 used · ended at 15:00',
    );
  });

  it('gives a new code the same role, job label, cap and end, from nought', () => {
    const start = opened(undefined, undefined, 'new');
    const code = renewed(BAR_CODE, [BAR_CODE.code]);

    expect(code).toMatchObject({
      code: 'H3WD 9RN6',
      role: 'Can check guests in',
      job: 'Bar and drinks',
      cap: 30,
      used: 0,
    });
    expect(start.codes.map((one) => one.code)).toEqual(['H3WD 9RN6']);
    expect(start.hold?.codeId).toBe(code.id);
    expect(lines(start)).toEqual(['0 of 30 used · until 23:30']);
  });

  it('reads the code in its groups, and names the QR', () => {
    expect(codeSaid('Q7KM 4XP2')).toBe('Q 7 K M, 4 X P 2');
    expect(doorCodeSaid('Q7KM 4XP2')).toBe('Door code Q 7 K M, 4 X P 2');
    expect(qrSaid('Q7KM 4XP2')).toBe('QR code for the door code Q 7 K M, 4 X P 2');
  });

  it('names the day of a time that is not today (pm, 8 Nov)', () => {
    expect(atWords({ date: '2026-11-14', time: '23:30' }, LOCALE, '2026-11-14')).toBe('23:30');
    expect(atWords({ date: '2026-11-14', time: '23:30' }, LOCALE, '2026-11-07')).toBe(
      'Sat, Nov 14, 23:30',
    );
    expect(atWords({ date: '2026-11-14', time: '23:30' }, 'en-GB', '2026-11-07')).toBe(
      'Sat 14 Nov, 23:30',
    );
  });

  it('takes l10n’s settled English (#32341)', () => {
    expect(W.show).toBe('Show the code');
    expect(W.expired).toBe('Expired');
    expect(W.stopConfirm).toBe('Stop the code');
    expect(W.makeFailed).toBe('The door code was not made. Check your connection and try again.');
    expect(W.stopFailed).toBe(
      'The code was not stopped, so it still works. Check your connection and try again.',
    );
    expect(W.noneLine).toBe(
      'One code lets a crew in on the day. Each person gives their name and mobile number.',
    );
  });

  it('keeps the old links: ran out opens Expired, and ?hold= is ?show=', () => {
    expect(doorStartOf('code-ran-out', undefined, undefined)?.codes.map(codeStatus)).toEqual([
      'expired',
    ]);
    expect(doorStartOf(undefined, undefined, 'open')?.hold).not.toBeNull();
  });
});

describe('the demo home’s Door code group', () => {
  const hrefs = DOOR_CODE_BOARDS.map((board) => board.href);

  it('links every app state the spec names, once', () => {
    expect(hrefs).toEqual(
      expect.arrayContaining([
        ...[...PEOPLE_DOOR_STATES, 'loading', 'failed', 'readOnly'].map(
          (state) => `/demo/people?state=${state}`,
        ),
        ...MAKE_STATES.map((state) => `/demo/people?code=${state}`),
        ...HOLD_STATES.map((state) => `/demo/people?show=${state}`),
        ...REDEEM_STATES.map((state) => `/demo/redeem?state=${state}`),
      ]),
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toHaveLength(14 + 7 + 7 + 26);
  });

  it('titles each one apart', () => {
    const titles = DOOR_CODE_BOARDS.map((board) => board.title);

    expect(new Set(titles).size).toBe(titles.length);
  });
});
