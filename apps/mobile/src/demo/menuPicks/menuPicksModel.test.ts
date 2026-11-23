import { describe, expect, it } from 'vitest';

import {
  HOST,
  MENU_STATES,
  TODAY,
  checkDraft,
  choose,
  chooseCourses,
  courseClose,
  courseFigures,
  courseOf,
  draftPick,
  guestSends,
  header,
  headerClose,
  hostCounts,
  hostLineWords,
  menuStart,
  needsHost,
  personOf,
  sampleMenu,
  spotOf,
  sumOf,
  whoHasnt,
} from './menuPicksModel.ts';

const world = sampleMenu();
const course = (id: string) => courseOf(world, id)!;
const person = (id: string) => personOf(world, id)!;

describe('the room of 48', () => {
  it('adds every course up to the room, in every state', () => {
    for (const name of MENU_STATES) {
      const shown = menuStart(name).world;
      if (shown == null) continue;
      for (const one of shown.courses)
        expect(sumOf(courseFigures(shown, one)), `${name} ${one.name}`).toBe(shown.people.length);
    }
  });

  it('counts a person in only once every course is answered', () => {
    expect(header(world)).toBe(
      '40 of 48 picks in · 83% of the room · picks close from Wednesday, May 26',
    );
  });
});

describe('the header’s close, sc-3905’s rule', () => {
  it('says “from” while the open courses close on different dates', () => {
    expect(headerClose(sampleMenu(TODAY.open))).toBe('picks close from Wednesday, May 26');
  });

  it('drops “from” once the open courses share a date', () => {
    expect(headerClose(sampleMenu(TODAY.oneClosed))).toBe('picks close Friday, May 28');
  });

  it('names the last close once every course has closed', () => {
    expect(headerClose(sampleMenu(TODAY.allClosed))).toBe('picks closed on Friday, May 28');
  });

  it('gives each course its own close, in words', () => {
    const later = sampleMenu(TODAY.oneClosed);
    expect(courseClose(later, course('k1'))).toEqual({
      closed: true,
      words: 'Picks closed on Wednesday, May 26',
    });
    expect(courseClose(later, course('k2'))).toEqual({
      closed: false,
      words: 'Picks close Friday, May 28',
    });
  });
});

describe('Needs the host', () => {
  it('holds whoever nothing suits and a pick an allergy recorded later rules out', () => {
    expect(needsHost(world).map(hostLineWords)).toEqual([
      'Starters: nothing on this course can be picked for them.',
      'Dessert: their pick, Chin chin, contains milk, recorded after they picked it.',
      'Main course: their pick, Suya wrap, Beef, contains sesame, recorded after they picked it.',
    ]);
  });

  it('is a count per course without Guests read', () => {
    expect(hostCounts(world)).toEqual([
      'Starters · 1 person',
      'Main course · 1 person',
      'Dessert · 1 person',
    ]);
  });

  it('stays after every course has closed', () => {
    expect(needsHost(sampleMenu(TODAY.allClosed))).toHaveLength(3);
  });
});

describe('Who hasn’t picked', () => {
  it('lists the not chosen by who replied, leaving the host’s people out', () => {
    const first = whoHasnt(world)[0]!;
    expect(first.party.replier).toBe('Bea Mensah');
    expect(first.people.map((one) => [one.person.name, one.courses.map((c) => c.name)])).toEqual([
      ['Bea Mensah', ['Starters', 'Main course', 'Dessert']],
      ['Kofi Mensah', ['Main course', 'Dessert']],
      ['Ama Mensah', ['Dessert']],
    ]);
    expect(whoHasnt(world).flatMap((w) => w.people.map((one) => one.person.id))).not.toContain(
      'ada-obi',
    );
  });

  it('is empty once everyone is in', () => {
    expect(whoHasnt(menuStart('allIn').world!)).toEqual([]);
  });
});

describe('Choose for them', () => {
  it('walks the courses the person is not in on', () => {
    expect(chooseCourses(world, person('bea-mensah')).map((one) => one.name)).toEqual([
      'Starters',
      'Main course',
      'Dessert',
    ]);
    expect(chooseCourses(world, person('kwame-asante'), 'k2').map((one) => one.id)).toEqual(['k2']);
  });

  it('refuses Save with nothing picked, or a dish with no way chosen', () => {
    expect(checkDraft(course('k2'), person('bea-mensah'), null)).toEqual({
      kind: 'blank',
      words: 'Choose main course for Bea Mensah, or let the kitchen choose.',
    });
    expect(
      checkDraft(course('k2'), person('bea-mensah'), {
        kind: 'dish',
        dishId: 'k2-jollof',
        variantId: null,
        sideId: null,
      }),
    ).toEqual({ kind: 'blank', words: 'Choose how Bea Mensah has the Jollof rice.' });
  });

  it('asks before a dish the record rules out', () => {
    const asked = checkDraft(course('k2'), person('kwame-asante'), {
      kind: 'dish',
      dishId: 'k2-jollof',
      variantId: 'v-chicken',
      sideId: null,
    });
    expect(asked).toMatchObject({
      kind: 'ruledOut',
      title: 'Kwame Asante’s record says celery. Pick it anyway?',
    });
  });

  it('records a pick made anyway with the host’s name, and moves it out of Needs the host', () => {
    const draft = { kind: 'dish', dishId: 'k3-chinchin', variantId: null, sideId: null } as const;
    const after = choose(world, 'k3', 'ada-obi', draftPick(draft, true, '19:45'));
    expect(after.picks.k3?.['ada-obi']).toMatchObject({ override: { by: HOST, at: '19:45' } });
    expect(spotOf(after, course('k3'), person('ada-obi')).kind).toBe('dish');
  });

  it('lets the kitchen choose with nothing to ask', () => {
    expect(checkDraft(course('k1'), person('kwame-asante'), { kind: 'kitchen' })).toEqual({
      kind: 'ok',
    });
  });
});

describe('the counts move while the screen is open', () => {
  it('fills the next waiting guest’s courses with what suits them', () => {
    const sent = guestSends(world)!;
    expect(sent.name).toBe('Bea Mensah');
    expect(whoHasnt(sent.world)[0]!.people.map((one) => one.person.name)).toEqual([
      'Kofi Mensah',
      'Ama Mensah',
    ]);
    expect(header(sent.world)).toContain('41 of 48 picks in');
  });
});
