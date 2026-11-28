import { describe, expect, it } from 'vitest';

import {
  AUTO_STATES,
  type AutoState,
  type Plan,
  confirmOff,
  confirmWords,
  draftLine,
  keepOn,
  nextLine,
  planned,
  press,
  publish,
  rowOf,
  seed,
  unavailable,
  waiting,
} from './AutomaticModel.ts';

const live = seed('live');

const withGuests = (plan: Plan, guests: Plan['guests']): Plan => ({ ...plan, guests });

describe('Automatic messages (sc-3974)', () => {
  it('plans the reply reminders 7 and 1 days before replies close, and the Not sure yet ask 3 days before', () => {
    expect(planned(live.plan).map((p) => `${p.key}:${p.due}:${p.day}`)).toEqual([
      'reminders:reply:2026-12-04',
      'reminders:names:2026-12-04',
      'reminders:notSure:2026-12-08',
      'reminders:reply:2026-12-10',
      'reminders:names:2026-12-10',
      'before:reply:2026-12-18',
    ]);
  });

  it('shows the next date with who it would reach as things stand', () => {
    expect(rowOf(live, 'reminders').next).toBe(
      'Next on Friday, Dec 4, to 63 guests as things stand.',
    );
    expect(rowOf(live, 'before').next).toBe(
      'Next on Friday, Dec 18, to 12 guests as things stand.',
    );
    expect(rowOf(seed('nextOne'), 'reminders').next).toBe(
      'Next on Friday, Dec 4, to 1 guest as things stand.',
    );
    expect(rowOf(seed('nextNone'), 'reminders').next).toBe(
      'Next on Friday, Dec 4, to nobody as things stand.',
    );
  });

  it('skips a date already passed when the event is published, and keeps the next one ahead', () => {
    const late = publish(seed('publishLate'));
    expect(planned(late.plan).some((p) => p.day === '2026-12-04')).toBe(false);
    expect(rowOf(late, 'reminders').next).toBe(
      'Next on Tuesday, Dec 8, to 3 guests as things stand.',
    );
  });

  it('skips today once 10:00 has passed there', () => {
    const plan: Plan = { ...live.plan, today: '2026-12-04', pastTen: true };
    expect(planned(plan)[0]?.day).toBe('2026-12-08');
    expect(planned({ ...plan, pastTen: false })[0]?.day).toBe('2026-12-04');
  });

  it('sends a guest due two things on one day one message, reply first', () => {
    const plan = withGuests(live.plan, [
      { id: 1, answer: 'coming', namesOwed: true, mealsOwed: true },
    ]);
    const meals: Plan = { ...plan, picksClose: '2026-12-11' };
    const sends = waiting(meals, 'reminders');
    expect(sends.map((s) => `${s.day}:${s.owed.join('+')}`)).toEqual([
      '2026-12-04:names+meals',
      '2026-12-10:names+meals',
    ]);
  });

  it('sends a guest at most four per event', () => {
    const plan: Plan = {
      ...withGuests(live.plan, [{ id: 1, answer: 'coming', namesOwed: true, mealsOwed: true }]),
      picksClose: '2026-12-15',
    };
    expect(planned(plan).filter((p) => p.key === 'reminders')).toHaveLength(7);
    expect(waiting(plan, 'reminders')).toHaveLength(4);
  });

  it('asks Not sure yet guests 14 days before the event without a reply-by date, picks close or not', () => {
    for (const picksClose of [null, '2026-12-15']) {
      const plan: Plan = { ...live.plan, replyBy: null, picksClose };
      expect(planned(plan).find((p) => p.due === 'notSure')?.day).toBe('2026-12-05');
      expect(rowOf({ ...live, plan }, 'reminders').unavailable).toBeNull();
    }
    expect(rowOf(seed('noReplyBy'), 'reminders').next).toBe(
      'Next on Saturday, Dec 5, to 3 guests as things stand.',
    );
  });

  it('stays available from the dates alone, with nobody Not sure yet', () => {
    const plan = withGuests({ ...live.plan, replyBy: null }, [
      { id: 1, answer: 'coming', namesOwed: false, mealsOwed: false },
    ]);
    const row = rowOf({ ...live, plan }, 'reminders');
    expect(row.unavailable).toBeNull();
    expect(row.next).toBe('Next on Saturday, Dec 5, to nobody as things stand.');
  });

  it('is unavailable only once the 14-days date has passed with neither date set', () => {
    const row = rowOf(seed('unavailable'), 'reminders');
    expect(row.unavailable).toBe('Set a reply-by date to use this.');
    expect(row.live).toBe(false);
    expect(row.next).toBeNull();
    expect(row.when).toContain('14 days before the event.');
    const onTheDay: Plan = { ...seed('unavailable').plan, today: '2026-12-05', pastTen: false };
    expect(unavailable(onTheDay, 'reminders')).toBe(false);
    expect(unavailable({ ...onTheDay, pastTen: true }, 'reminders')).toBe(true);
    expect(unavailable({ ...onTheDay, pastTen: true, picksClose: '2026-12-15' }, 'reminders')).toBe(
      false,
    );
  });

  it('keeps both off while a draft, with one line for both, and switches both on at publish', () => {
    const draft = seed('draft');
    expect(draftLine(draft)).toBe(
      'These are off while the event is a draft, and turn on when you publish it.',
    );
    expect(press(draft, 'reminders')).toBe(draft);
    const made = publish(draft);
    expect(draftLine(made)).toBeNull();
    expect(rowOf(made, 'reminders').shownOn && rowOf(made, 'before').shownOn).toBe(true);
  });

  it('asks before cancelling waiting sends, and counts every one of them', () => {
    const asked = press(live, 'reminders');
    expect(asked.confirm).toBe('reminders');
    expect(confirmWords(asked)).toEqual({
      title: 'Turn off reminders to answer?',
      body: 'The 129 messages waiting to go are cancelled.',
    });
    expect(confirmWords(seed('confirmRemindersOne'))?.body).toBe(
      'The message waiting to go is cancelled.',
    );
    expect(confirmWords(seed('confirmBefore'))?.body).toBe(
      '12 guests who are coming will not get it.',
    );
    expect(confirmWords(seed('confirmBeforeOne'))?.body).toBe(
      '1 guest who is coming will not get it.',
    );
  });

  it('turns off on Turn off, stays on on Keep it on, and hides the next line while off', () => {
    const asked = press(live, 'reminders');
    expect(keepOn(asked).on.reminders).toBe(true);
    const off = confirmOff(asked);
    expect(off.on.reminders).toBe(false);
    expect(off.said).toBe('Reminders to answer is off.');
    expect(rowOf(off, 'reminders').next).toBeNull();
    const back = press(off, 'reminders');
    expect(back.confirm).toBeNull();
    expect(rowOf(back, 'reminders').next).toBe(
      'Next on Friday, Dec 4, to 63 guests as things stand.',
    );
  });

  it('turns off at once with nothing waiting', () => {
    const none = seed('nextNone');
    expect(waiting(none.plan, 'reminders')).toHaveLength(0);
    const off: AutoState = press(none, 'reminders');
    expect(off.confirm).toBeNull();
    expect(off.on.reminders).toBe(false);
  });

  it('seeds every state', () => {
    for (const name of AUTO_STATES) expect(seed(name).plan.guests.length).toBeGreaterThan(0);
    expect(nextLine(seed('live').plan, 'before')).not.toBeNull();
  });
});
