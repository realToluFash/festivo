import { describe, expect, it } from 'vitest';

import {
  FIRE_STATES,
  NOTHING_TICKED,
  OFFLINE_BEFORE_LINE,
  OFFLINE_LINE,
  askNext,
  closeFire,
  confirm,
  controls,
  courseOffer,
  cues,
  dismissPrompt,
  fireFrom,
  fireLabel,
  fireStateOf,
  openFire,
  pickCourse,
  pickScope,
  pressFire,
  prompting,
  scopeCount,
  seed,
  serveAll,
  serviceLine,
  share,
  startService,
  step,
  steppable,
  suggesting,
  suggestionLine,
  toggle,
  validThreshold,
} from './ServiceFireModel.ts';

const label = (s: ReturnType<typeof seed>) => (s.fire == null ? '' : fireLabel(s, s.fire));

const fired = (s: ReturnType<typeof seed>, name: string, course: number) =>
  s.tables.find((t) => t.name === name)?.fired[course];

describe('serviceFire (sc-4009)', () => {
  it('seeds every state, and an unknown one as started', () => {
    for (const name of FIRE_STATES) expect(seed(name).tables.length).toBe(15);
    expect(fireStateOf('nope')).toBe('started');
  });

  it('offers Start service only with a menu, and nothing without service.manage', () => {
    expect(controls(seed('notStarted')).start).toBe(true);
    expect(controls(seed('notStartedPaused')).start).toBe(true);
    expect(controls(seed('noMenu'))).toMatchObject({ start: false, noMenu: true });
    expect(Object.values(controls(seed('noManage'))).some(Boolean)).toBe(false);
  });

  it('starts on the first course, with the time it started', () => {
    const s = startService(seed('notStarted'));
    expect(s.phase).toBe('on');
    expect(serviceLine(s)).toBe('Service · Starter · course 1 of 4 since 20:24');
  });

  it('counts only tables still to fire on the button, and refuses the one with no one seated', () => {
    const s = openFire(seed('started'));
    expect(label(s)).toBe('Fire mains at 3 tables');
    expect(scopeCount(s, 1, 'C')).toBe(2);
    expect(scopeCount(s, 1, 'A')).toBe(0);
    const after = pressFire(s);
    expect(after.result).toEqual([
      'Mains fired at 3 tables.',
      'Table 14 was not fired: no one is seated there.',
    ]);
    expect(fired(after, 'Table 15', 1)).toBe('20:24');
    expect(after.current).toBe(1);
  });

  it('keeps a fired table ticked and locked, and sends nothing with nothing ticked', () => {
    let s = pickScope(openFire(seed('started')), 'choose');
    expect(toggle(s, 'Table 1')).toBe(s);
    expect(toggle(s, 'Table 14')).toBe(s);
    const none = pressFire(s);
    expect(none.fire?.error).toBe(true);
    expect(none.say).toBe(NOTHING_TICKED);
    expect(none.tables).toBe(s.tables);
    s = toggle(s, 'Table 12');
    expect(label(s)).toBe('Fire mains at 1 table');
  });

  it('fires an earlier course only where it never was, and leaves the room where it is', () => {
    const s = pickCourse(openFire(seed('started')), 0);
    expect(courseOffer(s, 0)).toBe('Earlier · 1 table never had it');
    expect(label(s)).toBe('Fire starter at 1 table');
    const after = pressFire(s);
    expect(fired(after, 'Table 15', 0)).toBe('20:24');
    expect(serviceLine(after)).toBe('Service · Mains · course 2 of 4 since 20:10');
  });

  it('moves the room on when a later course is fired', () => {
    const after = pressFire(pickCourse(openFire(seed('started')), 2));
    expect(serviceLine(after)).toBe('Service · Dessert · course 3 of 4 since 20:24');
    expect(after.result.at(-1)).toBe('The room is on dessert now.');
  });

  it('suggests at the threshold, leaving out a table with nobody due and one still owed', () => {
    const s = seed('suggestion');
    expect(share(s)).toEqual({ served: 8, of: 10 });
    expect(suggestionLine(s)).toBe('8 of 10 tables served mains');
    expect(suggesting(s)).toBe(true);
    expect(suggesting(step(s, 2, 1))).toBe(false);
    expect(suggesting(step(step(s, 2, 1), 2, -1))).toBe(true);
    expect(suggesting(seed('notYet'))).toBe(false);
    expect(suggesting(seed('lastCourse'))).toBe(false);
    expect(suggesting(seed('offline'))).toBe(false);
  });

  it('steps thresholds from 50% to 100% by 10 on courses not yet fired', () => {
    const s = seed('thresholds');
    expect(steppable(s)).toEqual([2, 3]);
    let x = s;
    for (let i = 0; i < 9; i += 1) x = step(x, 2, 1);
    expect(x.thresholds[2]).toBe(100);
    for (let i = 0; i < 9; i += 1) x = step(x, 2, -1);
    expect(x.thresholds[2]).toBe(50);
    expect([85, 110, 40].some(validThreshold)).toBe(false);
    expect(validThreshold(70)).toBe(true);
  });

  it('prompts once, never once its course is fired at every seated table', () => {
    expect(prompting(seed('prompt'))).toBe(true);
    expect(prompting(seed('started'))).toBe(false);
    const allDessert = pressFire(pickCourse(openFire(seed('prompt')), 2));
    expect(prompting(allDessert)).toBe(false);
  });

  it('opens the choice from a cue and never fires, keeping the cue until a fire answers it', () => {
    const s = seed('prompt');
    const opened = fireFrom(s, 2, true);
    expect(opened.fire).toMatchObject({ course: 2, scope: 'all' });
    expect(opened.tables).toBe(s.tables);
    expect(cues(closeFire(opened)).prompt).toBe(true);
    const sectionC = pressFire(pickScope(opened, 'C'));
    expect(cues(sectionC).prompt).toBe(false);
  });

  it('shows only the prompt when it names the suggestion’s course, and Not now holds both back', () => {
    const s = seed('prompt');
    expect(suggesting(s)).toBe(true);
    expect(cues(s)).toEqual({ prompt: true, suggest: false });
    const later = dismissPrompt(s);
    expect(cues(later)).toEqual({ prompt: false, suggest: false });
    expect(later.notYetUntil).toBe('20:29');
  });

  it('moves on without firing, and ends service from the last course', () => {
    const moved = confirm(askNext(seed('started')));
    expect(serviceLine(moved)).toBe('Service · Dessert · course 3 of 4 since 20:24');
    expect(fired(moved, 'Table 1', 2)).toBeUndefined();
    const ending = askNext(seed('lastCourse'));
    expect(ending.confirm).toBe('end');
    const ended = confirm(ending);
    expect(ended.phase).toBe('ended');
    expect(Object.values(controls(ended)).some(Boolean)).toBe(false);
  });

  it('queues nothing with no connection', () => {
    const s = seed('offline');
    const tried = pressFire(openFire(s));
    expect(tried.say).toBe(OFFLINE_LINE);
    expect(tried.tables).toBe(s.tables);
    const before = startService(seed('offlineBefore'));
    expect(before.phase).toBe('notStarted');
    expect(before.say).toBe(OFFLINE_BEFORE_LINE);
    expect(askNext(s).confirm).toBeNull();
    expect(prompting(s)).toBe(false);
  });

  it('counts a table served once every guest due there is served', () => {
    expect(share(serveAll(seed('started')))).toEqual({ served: 10, of: 10 });
  });
});
