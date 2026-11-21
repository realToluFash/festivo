import { describe, expect, it } from 'vitest';

import { LIVE_MARKS } from './guestProgramme.ts';
import {
  SCREEN_STATES,
  type ScreenStateName,
  clockAt,
  roomScreen,
  screenItems,
  screenTime,
} from './roomScreen.ts';

function answerAt(state: ScreenStateName) {
  const start = SCREEN_STATES[state];

  return roomScreen(
    {
      items: screenItems(),
      marks: start.marks,
      at: clockAt(start.moved),
      finished: start.finished,
      replaced: start.replaced,
    },
    start.place,
  );
}

describe('the room screen’s answer (sc-3897)', () => {
  it('gives Now with no time and the next three, rounded down to 5 minutes', () => {
    expect(answerAt('now')).toEqual({
      kind: 'live',
      event: 'Adaeze & Tunde’s wedding',
      now: { id: 'entrance', title: 'Grand entrance' },
      coming: [
        { id: 'dinner', title: 'Dinner', startsAt: '2026-11-06T17:35' },
        { id: 'speeches', title: 'Speeches', startsAt: '2026-11-06T19:15' },
        { id: 'dance', title: 'First dance', startsAt: '2026-11-06T20:00' },
      ],
    });
  });

  it('carries no owner, role, note, length, planned time or lateness', () => {
    const words = JSON.stringify(answerAt('now'));

    for (const never of ['Kemi', 'MC', 'Father of the bride', 'lasts', 'planned', 'late', 'owner'])
      expect(words).not.toContain(never);
  });

  it('leaves out what is not shown to guests', () => {
    const items = screenItems().map((one) =>
      one.id === 'dinner' ? { ...one, guests: false } : one,
    );
    const answer = roomScreen(
      { items, marks: LIVE_MARKS, at: clockAt(0), finished: false, replaced: false },
      'Ballroom',
    );

    expect(answer.kind === 'live' && answer.coming.map((one) => one.title)).toEqual([
      'Speeches',
      'First dance',
      'Dancing',
    ]);
  });

  it('shows no Now between items', () => {
    const answer = answerAt('between');

    expect(answer.kind === 'live' && answer.now).toBeNull();
    expect(answer.kind === 'live' && answer.coming[0]).toEqual({
      id: 'dinner',
      title: 'Dinner',
      startsAt: '2026-11-06T17:40',
    });
  });

  it('moves the times on when the running item overruns with no press', () => {
    const answer = answerAt('overrun');

    expect(answer.kind === 'live' && answer.coming[0]?.startsAt).toBe('2026-11-06T17:50');
  });

  it('gives the event’s name only with nothing left in the place', () => {
    expect(answerAt('nothingLeft')).toEqual({
      kind: 'nothingLeft',
      event: 'Adaeze & Tunde’s wedding',
    });
  });

  it('says nothing about the event once the link is replaced', () => {
    expect(answerAt('replaced')).toEqual({ kind: 'replaced' });
  });

  it('thanks the room once the event is Finished', () => {
    expect(answerAt('finished')).toEqual({ kind: 'finished', event: 'Adaeze & Tunde’s wedding' });
  });

  it('writes every time on the 24-hour clock, en-US included', () => {
    expect(screenTime('2026-11-06T19:40', 'en-US')).toBe('19:40');
    expect(screenTime('2026-11-06T19:40', 'fr-FR')).toBe('19:40');
  });
});
