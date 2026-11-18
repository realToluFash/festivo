import { describe, expect, it } from 'vitest';

import {
  type PicksWorld,
  PICKS_PAGES,
  asksNothing,
  chooseFor,
  courseFigures,
  giveVariant,
  header,
  isPicksState,
  menuFigures,
  needsHost,
  openFor,
  percentOf,
  picksStart,
  samplePicks,
  shownCourses,
  spotOf,
  sumOf,
  whoHasnt,
} from './seePicks.ts';

const course = (world: PicksWorld, id: string) =>
  world.courses.find((one) => one.id === id) as PicksWorld['courses'][number];
const person = (world: PicksWorld, id: string) =>
  world.people.find((one) => one.id === id) as PicksWorld['people'][number];
const row = (world: PicksWorld, courseId: string, id: string) =>
  courseFigures(world, course(world, courseId)).rows.find((one) => one.id === id);
const at = { by: 'Kemi Adebayo', at: '18 Nov, 19:40' };

const states = PICKS_PAGES.flatMap((page) => page.states)
  .map((link) => new URL(link.to, 'http://demo').searchParams.get('state'))
  .filter(isPicksState);

describe('See picks figures', () => {
  it('add up to the room on every course, in every state', () => {
    expect(states.length).toBeGreaterThan(20);
    for (const state of states) {
      const { world } = picksStart(state);
      for (const one of shownCourses(world))
        expect(sumOf(courseFigures(world, one)), `${state} · ${one.name}`).toBe(
          world.people.length,
        );
    }
  });

  it('read 39 of 48 picks in, 81%, rounding down', () => {
    expect(header(samplePicks())).toEqual({ answered: 39, room: 48, percent: 81 });
    expect(percentOf(47, 48)).toBe(97);
    expect(header(picksStart('picksAllIn').world).percent).toBe(100);
  });

  it('count a course that asks nothing as everyone chosen, its Children only variant apart, and not in picks in', () => {
    const world = samplePicks();
    expect(asksNothing(course(world, 'k1'))).toBe(true);
    expect(row(world, 'k1', 'k1-pepper')?.chosen).toBe(48);
    expect(row(world, 'k1', 'v-full')?.chosen).toBe(45);
    expect(row(world, 'k1', 'v-small')?.chosen).toBe(3);
    expect(
      whoHasnt(world)
        .flatMap((one) => one.people)
        .some((one) => one.courses.some((c) => c.id === 'k1')),
    ).toBe(false);
  });

  it('keeps held places out of the room', () => {
    const world = picksStart('picksHeld').world;
    expect(world.held).toBe(6);
    expect(header(world).room).toBe(48);
  });

  it('counts options per pick, inside their dish', () => {
    const world = samplePicks();
    const sides = ['c-side-plantain', 'c-side-salad', 'c-side-moimoi'].map(
      (id) => row(world, 'k2', id)?.chosen ?? 0,
    );
    expect(sides.reduce((a, b) => a + b, 0)).toBe(row(world, 'k2', 'k2-coconut')?.chosen);
  });

  it('gives the Menu rows the same figures as See picks', () => {
    const figures = menuFigures(samplePicks());
    expect(figures.get('k2-jollof')).toEqual({ count: 17, share: 35 });
    expect(figures.get('v-chicken')).toEqual({ count: 14, share: 29 });
    expect(figures.get('v-small')).toEqual({ count: 3, share: 6 });
  });
});

describe('Needs the host', () => {
  it('names nothing pickable, and a pick an allergy recorded later rules out', () => {
    const lines = needsHost(samplePicks()).map(
      (one) => `${one.person.name} · ${one.course.name} · ${one.reason.kind}`,
    );
    expect(lines).toEqual([
      'Kwame Asante · Main · nothing',
      'Ada Obi · Dessert · allergy',
      'Elena Rossi · Main · allergy',
    ]);
  });

  it('moves a pick from its dish to the host once an allergy it contains is saved, and back once it is removed', () => {
    const world = samplePicks();
    const before = row(world, 'k3', 'k3-chinchin')?.chosen ?? 0;
    const allergic = {
      ...world,
      people: world.people.map((one) =>
        one.id === 'chidi-obi' ? { ...one, allergies: ['eggs' as const] } : one,
      ),
    };
    expect(row(allergic, 'k3', 'k3-chinchin')?.chosen).toBe(before - 1);
    expect(courseFigures(allergic, course(allergic, 'k3')).host).toBe(2);
    expect(sumOf(courseFigures(allergic, course(allergic, 'k3')))).toBe(48);

    const cleared = {
      ...allergic,
      people: allergic.people.map((one) =>
        one.id === 'chidi-obi' ? { ...one, allergies: [] } : one,
      ),
    };
    expect(row(cleared, 'k3', 'k3-chinchin')?.chosen).toBe(before);
  });
});

describe('Choose for them', () => {
  it('opens only the courses still open for the person', () => {
    const world = samplePicks();
    expect(openFor(world, person(world, 'bea-mensah')).map((one) => one.id)).toEqual(['k2', 'k3']);
    expect(openFor(world, person(world, 'kwame-asante')).map((one) => one.id)).toEqual(['k2']);
  });

  it('records a ruled-out pick with who confirmed it, and counts it under its dish', () => {
    const world = chooseFor(samplePicks(), 'k2', 'kwame-asante', {
      kind: 'dish',
      dishId: 'k2-jollof',
      variantId: 'v-chicken',
      optionIds: [],
      how: 'host',
      override: at,
    });
    expect(spotOf(world, course(world, 'k2'), person(world, 'kwame-asante')).kind).toBe('dish');
    expect(world.picks.k2?.['kwame-asante']).toMatchObject({ how: 'host', override: at });
    expect(row(world, 'k2', 'v-chicken')?.chosen).toBe(15);
  });

  it('without the override, a ruled-out pick stays with the host', () => {
    const world = chooseFor(samplePicks(), 'k2', 'kwame-asante', {
      kind: 'dish',
      dishId: 'k2-jollof',
      variantId: 'v-chicken',
      optionIds: [],
      how: 'host',
    });
    expect(spotOf(world, course(world, 'k2'), person(world, 'kwame-asante')).kind).toBe('host');
  });
});

describe('Choose who gets it', () => {
  const ticked = (world: PicksWorld, courseId: string, variantId: string) =>
    new Set(
      world.people
        .filter((one) => {
          const pick = world.picks[courseId]?.[one.id];
          return pick?.kind === 'dish' && pick.variantId === variantId;
        })
        .map((one) => one.id),
    );

  it('gives and takes back a Children only variant on a course that asks nothing', () => {
    const world = samplePicks();
    const k1 = course(world, 'k1');
    const now = ticked(world, 'k1', 'v-small');
    now.add('kojo-asante');
    now.delete('sasha-petrova');
    const next = giveVariant(world, k1, 'k1-pepper', 'v-small', now, null);
    expect(row(next, 'k1', 'v-small')?.chosen).toBe(3);
    expect(spotOf(next, k1, person(next, 'sasha-petrova'))).toMatchObject({ variantId: 'v-full' });
    expect(next.picks.k1?.['kojo-asante']).toMatchObject({ how: 'host', variantId: 'v-small' });
    expect(sumOf(courseFigures(next, k1))).toBe(48);
  });

  it('gives and takes back one on a course guests choose, the unticked going to not chosen', () => {
    const world = samplePicks();
    const k2 = course(world, 'k2');
    const now = ticked(world, 'k2', 'v-kids');
    now.delete('tobi-bello');
    now.add('bea-mensah');
    const next = giveVariant(world, k2, 'k2-jollof', 'v-kids', now, null);
    expect(spotOf(next, k2, person(next, 'tobi-bello')).kind).toBe('none');
    expect(spotOf(next, k2, person(next, 'bea-mensah')).kind).toBe('dish');
    expect(sumOf(courseFigures(next, k2))).toBe(48);
  });

  it('records the override for someone ruled out', () => {
    const world = samplePicks();
    const k2 = course(world, 'k2');
    const now = ticked(world, 'k2', 'v-kids');
    now.add('kojo-asante');
    const next = giveVariant(world, k2, 'k2-jollof', 'v-kids', now, at);
    expect(spotOf(next, k2, person(next, 'kojo-asante')).kind).toBe('dish');
    expect(next.picks.k2?.['kojo-asante']).toMatchObject({ override: at });
  });
});

describe('who sees what', () => {
  it('has a state for each access level', () => {
    expect(picksStart('picks').access).toBe('manage');
    expect(picksStart('picksReadOnly').access).toBe('read');
    expect(picksStart('picksCountsOnly').access).toBe('counts');
  });

  it('refuses on the states that show a 403', () => {
    expect(picksStart('chooseForRefused').opened).toMatchObject({ refuses: true });
    expect(picksStart('chooseWhoRefused').opened).toMatchObject({ refuses: true });
  });
});
