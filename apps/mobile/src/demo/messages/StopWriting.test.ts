import { describe, expect, it } from 'vitest';

import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import { MESSAGES_STATES, reduce, startOf } from './MessagesModel.ts';
import { GUESTS } from './MessagesSample.ts';
import { STOP } from './MessagesWords.ts';
import {
  LIVE_STOP,
  NO_STOPS,
  SEEDED_STOP,
  STOP_STATES,
  chooseItem,
  closeActions,
  hasActions,
  itemLabel,
  keepWriting,
  openActions,
  press,
  settled,
  stoppedLine,
  stoppingOf,
} from './StopWriting.ts';

const INES = GUESTS.ines.name;

function start(state: (typeof STOP_STATES)[number]) {
  return startOf(state, false);
}

describe('the stopped line', () => {
  it('names who stopped them, the short weekday date and the 24-hour time', () => {
    expect(stoppedLine(SEEDED_STOP)).toBe(
      'Folake Adeyemi stopped them writing from their page on Mon, Nov 2 at 20:15.',
    );
  });

  it('a live stop reads the demo’s clock', () => {
    expect(stoppedLine(LIVE_STOP)).toBe(
      'Folake Adeyemi stopped them writing from their page on Tue, Nov 3 at 09:41.',
    );
  });

  it('follows the locale’s date, and keeps the 24-hour clock', () => {
    expect(stoppedLine(SEEDED_STOP, 'en-GB')).toBe(
      'Folake Adeyemi stopped them writing from their page on Mon 2 Nov at 20:15.',
    );
  });
});

describe('the conversation’s actions', () => {
  it('are on a matched guest’s conversation, for a member with messages.manage', () => {
    expect(hasActions(NO_STOPS, 'ines')).toBe(true);
    expect(hasActions(NO_STOPS, 'unknown')).toBe(false);
    expect(hasActions({ ...NO_STOPS, manage: false }, 'ines')).toBe(false);
  });

  it('name the stop with an ellipsis, and Let them write again once stopped', () => {
    expect(itemLabel(NO_STOPS, 'ines', INES)).toBe('Stop Inês Duarte writing from their page…');
    expect(itemLabel({ ...NO_STOPS, stopped: { ines: SEEDED_STOP } }, 'ines', INES)).toBe(
      STOP.letThemWriteAgain,
    );
  });

  it('do not open without messages.manage', () => {
    expect(openActions({ ...NO_STOPS, manage: false }).menu).toBe(false);
    expect(closeActions(openActions(NO_STOPS)).menu).toBe(false);
  });

  it('ask before a stop, and let them write again at once', () => {
    const asked = chooseItem(openActions(NO_STOPS), 'ines');
    expect(asked).toMatchObject({ menu: false, asking: true, saving: null });

    const stopped = { ...NO_STOPS, menu: true, stopped: { ines: SEEDED_STOP } };
    expect(chooseItem(stopped, 'ines')).toMatchObject({
      menu: false,
      asking: false,
      saving: 'letAgain',
    });
  });
});

describe('the stop’s save', () => {
  it('is busy once, ignoring presses, then stops them and closes the ask', () => {
    const busy = press({ ...NO_STOPS, asking: true }, 'stop');
    expect(press(busy, 'stop')).toBe(busy);
    expect(keepWriting(busy)).toBe(busy);

    const done = settled(busy, 'ines', true);
    expect(done).toMatchObject({ asking: false, saving: null, failed: null });
    expect(done.stopped.ines).toEqual(LIVE_STOP);
  });

  it('a failure keeps the ask open with its alert, and the next press clears it', () => {
    const failed = settled(press({ ...NO_STOPS, asking: true }, 'stop'), 'ines', false);
    expect(failed).toMatchObject({ asking: true, failed: 'stop', saving: null });
    expect(press(failed, 'stop')).toMatchObject({ failed: null, saving: 'stop' });
  });

  it('Let them write again takes the stop away', () => {
    const stopped = { ...NO_STOPS, stopped: { ines: SEEDED_STOP } };
    const again = settled(press(stopped, 'letAgain'), 'ines', true);
    expect(again.stopped).toEqual({});
  });

  it('Let them write again, not saved, keeps the inset', () => {
    const stopped = { ...NO_STOPS, stopped: { ines: SEEDED_STOP } };
    const failed = settled(press(stopped, 'letAgain'), 'ines', false);
    expect(failed).toMatchObject({ failed: 'letAgain', stopped: { ines: SEEDED_STOP } });
  });

  it('Let them keep writing closes the ask and its alert', () => {
    expect(keepWriting({ ...NO_STOPS, asking: true, failed: 'stop' })).toMatchObject({
      asking: false,
      failed: null,
    });
  });
});

describe('the stop’s states', () => {
  it('are each a Messages state with a board, opening Inês Duarte’s conversation', () => {
    for (const state of STOP_STATES) {
      expect(MESSAGES_STATES).toContain(state);
      expect(MESSAGES_BOARDS.find((board) => board.state === state)?.href).toBe(
        `/demo/events/evt-wed-4?area=messages&state=${state}`,
      );
      expect(start(state).open).toEqual({ kind: 'guest', key: 'ines' });
    }
  });

  it('seed what each one shows', () => {
    expect(stoppingOf(start('stopAction'))).toMatchObject({ menu: true, asking: false });
    expect(stoppingOf(start('stopAsk'))).toMatchObject({ asking: true, failed: null });
    expect(stoppingOf(start('stopFailed'))).toMatchObject({ asking: true, failed: 'stop' });
    expect(stoppingOf(start('stopped')).stopped.ines).toEqual(SEEDED_STOP);
    expect(stoppingOf(start('letAgainFailed'))).toMatchObject({ failed: 'letAgain' });
    expect(stoppingOf(start('stoppedNoManage'))).toMatchObject({
      manage: false,
      stopped: { ines: SEEDED_STOP },
    });
    expect(stoppingOf(startOf('conversation', false))).toEqual(NO_STOPS);
  });

  it('change through the model’s one action', () => {
    const m = reduce(startOf('conversation', false), { type: 'stopping', change: openActions });
    expect(stoppingOf(m).menu).toBe(true);
  });
});
