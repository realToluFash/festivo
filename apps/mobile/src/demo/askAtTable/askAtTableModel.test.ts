import { describe, expect, it } from 'vitest';

import { ASK_AT_TABLE_BOARDS } from './AskAtTableBoards.ts';
import {
  ASKING_LINE,
  ASK_STATES,
  AVAILABLE_LINE,
  AVAILABLE_REFUSED,
  HELD_LINE,
  NO_ASKS,
  OFFLINE_RECORD,
  OFFLINE_ROOM,
  answer,
  askOf,
  askStateOf,
  askTitle,
  asks,
  canChange,
  cancelChange,
  conflict,
  dishingLine,
  floorSeats,
  guestOf,
  heldRows,
  leadAsks,
  leadChooses,
  leadChoseLine,
  markAvailable,
  nextItems,
  openChange,
  options,
  seatOf,
  seed,
  setStage,
} from './askAtTableModel.ts';

const kinds = (s: ReturnType<typeof seed>) =>
  nextItems(s).map((i) =>
    i.kind === 'ask'
      ? `ask ${i.ask.table}`
      : i.kind === 'request'
        ? 'request'
        : `${i.kind} ${i.tray.table}`,
  );

describe('the asks on Next', () => {
  it('come after the tray in hand and the given tray, by age with requests, before the next tray', () => {
    expect(kinds(seed('askNext'))).toEqual([
      'inHand 3',
      'given 8',
      'ask 9',
      'request',
      'ask 14',
      'nextTray 10',
    ]);
  });

  it('take their age from the earliest guest still to answer', () => {
    const s = answer(seed('askOpen'), 'fa', '');
    expect(askOf(s, 9)?.since).toBe('20:14');
    expect(kinds(s).slice(2, 5)).toEqual(['request', 'ask 9', 'ask 14']);
  });

  it('are one per table and run-out item, counting the guests still to answer', () => {
    const s = seed('askNext');
    expect(asks(s).map((a) => [a.table, a.item, a.seats.length])).toEqual([
      [9, 'Chicken', 4],
      [14, 'Chicken', 1],
    ]);
    expect(asks(s).map(askTitle)).toEqual([
      'Table 9 · Chicken has run out · ask 4 guests',
      'Table 14 · Chicken has run out · ask 1 guest',
    ]);
  });

  it('list the asked guests in seat order', () => {
    expect(askOf(seed('askNext'), 9)?.seats.map((x) => guestOf(x.guest).seat)).toEqual([
      1, 2, 4, 6,
    ]);
  });

  it('grow when the floor lead asks one more guest at the table, and say so', () => {
    const s = leadAsks(seed('askNext'), 'eo');
    expect(askOf(s, 14)?.seats.length).toBe(2);
    expect(asks(s)).toHaveLength(2);
    expect(s.say).toBe('Emeka Obi added to Table 14 · Chicken has run out · ask 2 guests');
  });

  it('read out a new ask when none was open at the table', () => {
    const s = leadAsks(seed('askNone'), 'eo');
    expect(s.say).toBe('New ask: Table 14 · Chicken has run out · ask 1 guest');
  });

  it('read No asks open. when nobody is asked', () => {
    expect(asks(seed('askNone'))).toEqual([]);
    expect(NO_ASKS).toBe('No asks open.');
  });
});

describe('an answer', () => {
  it('applies the choice, ends the guest’s ask and leaves the count at 3', () => {
    const s = answer(seed('askOpen'), 'tb', 'Beef');
    const tb = seatOf(s, 'tb');
    expect(tb).toMatchObject({ asked: false, everAsked: true, by: 'guest', to: 'Beef' });
    expect(askOf(s, 9)?.seats.length).toBe(3);
    expect(s).toEqual(seed('askAnswered'));
  });

  it('records without the item only when something else is on the plate', () => {
    const tb = seatOf(seed('askOpen'), 'tb');
    expect(tb && options(tb).map((o) => o.label)).toEqual([
      'Serve Beef',
      'Serve Grilled fish',
      'Serve without Chicken',
    ]);
    const bare = tb && { ...tb, plate: ['Chicken'] };
    expect(bare && options(bare).map((o) => o.label)).toEqual([
      'Serve Jollof rice',
      'Serve Beef',
      'Serve Grilled fish',
    ]);
  });

  it('takes the ask off Next once nobody in it is still asked', () => {
    let s = seed('askFlagged');
    expect(askOf(s, 9)?.seats.length).toBe(1);
    s = answer(s, 'fa', '');
    expect(askOf(s, 9)).toBeUndefined();
    expect(s.open).toBeNull();
    expect(s.screen).toBe('next');
    expect(kinds(s)).not.toContain('ask 9');
  });

  it('is refused for a conflicting item, and nothing changes', () => {
    const s = seed('askOpen');
    const fish = answer(s, 'fa', 'Grilled fish');
    expect(fish.refused).toBe('Not for Funke Adeyemi · Fish allergy. Nothing changed.');
    expect(fish.seats).toEqual(s.seats);
    expect(answer(s, 'fa', 'Beef').seats).toEqual(s.seats);
  });

  it('is refused offline and nothing is kept', () => {
    const s = { ...seed('askOpen'), online: false };
    const after = answer(s, 'tb', 'Beef');
    expect(after.refused).toBe(OFFLINE_RECORD);
    expect(after.seats).toEqual(s.seats);
    expect(after.refused).toBe(
      'Needs a connection to record an answer. Nothing is kept to send later.',
    );
  });

  it('refuses a change offline and keeps nothing', () => {
    const s = { ...seed('askChange'), online: false };
    const after = answer(s, 'tb', 'Grilled fish');
    expect(after.refused).toBe(OFFLINE_RECORD);
    expect(seatOf(after, 'tb')?.to).toBe('Beef');
  });
});

describe('the conflict rule', () => {
  it('refuses an item with the allergen, and an item whose allergens are not stated', () => {
    const fa = guestOf('fa');
    expect(conflict(fa, 'Grilled fish')).toEqual({
      line: 'Not for Funke Adeyemi · Fish allergy',
      note: '',
    });
    expect(conflict(fa, 'Beef')).toEqual({
      line: 'Not for Funke Adeyemi · Fish allergy',
      note: 'Beef’s allergens aren’t stated',
    });
  });

  it('refuses nothing for a diet or an Other allergy', () => {
    for (const id of ['hs', 'ae'])
      for (const item of ['Beef', 'Grilled fish']) expect(conflict(guestOf(id), item)).toBeNull();
  });
});

describe('Change', () => {
  it('is offered only while the plate is To serve and the guest’s own answer stands', () => {
    const s = seed('askLeadChose');
    expect(floorSeats(s, 9).map((f) => [f.guest.id, f.now, f.change])).toEqual([
      ['fa', '', false],
      ['hs', '', false],
      ['tb', 'Now Beef', true],
      ['ya', 'Now Beef', false],
    ]);
    const tb = seatOf(setStage(s, 'tb', 'Dishing'), 'tb');
    expect(tb && canChange(tb)).toBe(false);
  });

  it('marks the current answer Now and Cancel leaves it as it was', () => {
    const s = seed('askChange');
    const tb = seatOf(s, 'tb');
    expect(
      tb &&
        options(tb)
          .filter((o) => o.now)
          .map((o) => o.to),
    ).toEqual(['Beef']);
    const cancelled = cancelChange(s);
    expect(cancelled.changing).toBeNull();
    expect(cancelled.seats).toEqual(s.seats);
  });

  it('records a new answer from To serve', () => {
    const s = answer(seed('askChange'), 'tb', '');
    expect(seatOf(s, 'tb')).toMatchObject({ to: '', by: 'guest' });
    expect(floorSeats(s, 9)[2]?.now).toBe('Without Chicken');
    expect(s.changing).toBeNull();
  });

  it('is refused from Dishing, nothing changes and Change goes', () => {
    const s = setStage(seed('askChange'), 'tb', 'Dishing');
    const after = answer(s, 'tb', 'Grilled fish');
    expect(after.refused).toBe(dishingLine('Tunde Bakare'));
    expect(after.refused).toBe(
      'Tunde Bakare’s plate is Dishing now, so it can’t change. Nothing changed.',
    );
    expect(seatOf(after, 'tb')?.to).toBe('Beef');
    expect(after.changing).toBeNull();
    expect(floorSeats(after, 9)[2]?.change).toBe(false);
    expect(openChange(after, 'tb').changing).toBeNull();
  });

  it('is gone once the floor lead chose, and a stale change is refused', () => {
    const s = leadChooses(seed('askChange'), 'tb', 'Grilled fish');
    expect(seatOf(s, 'tb')?.by).toBe('guest');
    const lead = {
      ...seed('askChange'),
      seats: seed('askChange').seats.map((x) =>
        x.guest === 'tb' ? { ...x, by: 'lead' as const } : x,
      ),
    };
    const after = answer(lead, 'tb', 'Grilled fish');
    expect(after.refused).toBe(leadChoseLine('Tunde Bakare'));
    expect(seatOf(after, 'tb')?.to).toBe('Beef');
  });
});

describe('the floor lead choosing for an asked guest', () => {
  it('ends their ask with no Change', () => {
    const s = leadChooses(seed('askOpen'), 'ya', 'Beef');
    expect(seatOf(s, 'ya')).toMatchObject({ asked: false, by: 'lead', to: 'Beef' });
    expect(askOf(s, 9)?.seats.length).toBe(3);
    expect(floorSeats(s, 9)[3]?.change).toBe(false);
  });

  it('shows only once this phone reconnects', () => {
    const s = { ...seed('askOpen'), online: false };
    const after = leadChooses(s, 'ya', 'Beef');
    expect(after.note).toBe(OFFLINE_ROOM);
    expect(after.seats).toEqual(s.seats);
  });
});

describe('the held block', () => {
  it('reads asking at the table for an asked guest, waiting for the floor lead otherwise', () => {
    expect(heldRows(seed('askHeld')).map((r) => [r.guest.name, r.line])).toEqual([
      ['Funke Adeyemi', ASKING_LINE],
      ['Hauwa Sani', ASKING_LINE],
      ['Yemi Alabi', ASKING_LINE],
      ['Adaora Eze', ASKING_LINE],
      ['Emeka Obi', HELD_LINE],
    ]);
    expect(ASKING_LINE).toBe('Chicken has run out · asking at the table');
  });
});

describe('Mark available again', () => {
  it('ends every ask, keeps answers, and says the item is available again', () => {
    const s = markAvailable(seed('askAnswered'));
    expect(asks(s)).toEqual([]);
    expect(s.seats.every((x) => !x.asked)).toBe(true);
    expect(seatOf(s, 'tb')).toMatchObject({ to: 'Beef', by: 'guest' });
    expect(s.say).toBe(AVAILABLE_LINE);
    expect(AVAILABLE_LINE).toBe('Chicken is available again');
    expect(s.screen).toBe('next');
    expect(heldRows(s)).toEqual([]);
  });

  it('takes Change away, and refuses an answer sent after it', () => {
    const s = seed('askAvailable');
    expect(floorSeats(s, 9)[2]?.change).toBe(false);
    expect(openChange(s, 'tb').changing).toBeNull();
    const stale = markAvailable(seed('askChange'));
    expect(stale.changing).toBe('tb');
    const after = answer(stale, 'tb', 'Grilled fish');
    expect(after.refused).toBe(AVAILABLE_REFUSED);
    expect(AVAILABLE_REFUSED).toBe(
      'Chicken is available again, so answers can’t change. Nothing changed.',
    );
    expect(seatOf(after, 'tb')?.to).toBe('Beef');
    expect(after.changing).toBeNull();
    const asked = answer(markAvailable(seed('askOpen')), 'ya', 'Beef');
    expect(asked.refused).toBe(AVAILABLE_REFUSED);
    expect(seatOf(asked, 'ya')?.to).toBeNull();
  });

  it('asks nobody once the item is available again', () => {
    const s = leadAsks(markAvailable(seed('askNext')), 'eo');
    expect(asks(s)).toEqual([]);
  });
});

describe('the states', () => {
  it('open each link in the state it names, once each', () => {
    expect(ASK_AT_TABLE_BOARDS.map((b) => b.href)).toEqual(
      ASK_STATES.map((st) => `/demo/ask-at-table?state=${st}`),
    );
    for (const b of ASK_AT_TABLE_BOARDS) {
      const param = new URLSearchParams(b.href.split('?')[1]).get('state') ?? undefined;
      expect(ASK_STATES).toContain(askStateOf(param));
    }
    expect(askStateOf('nope')).toBe('askNext');
  });

  it('seed every state with what its what-line says', () => {
    expect(seed('askOpen').open).toBe(9);
    expect(seed('askDishing').refused).toBe(dishingLine('Tunde Bakare'));
    expect(seed('askOffline')).toMatchObject({ online: false, refused: OFFLINE_RECORD });
    expect(seed('askAvailable').available).toBe(true);
    expect(seed('askChange').changing).toBe('tb');
  });
});
