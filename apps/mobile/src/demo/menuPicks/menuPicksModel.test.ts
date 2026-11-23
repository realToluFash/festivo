import { describe, expect, it } from 'vitest';

import {
  HOST,
  MENU_STATES,
  TODAY,
  checkDraft,
  choose,
  chooseCourses,
  containsWords,
  courseClose,
  courseFigures,
  courseOf,
  draftPick,
  givenDefault,
  goesBackWords,
  guestSends,
  hasVariant,
  header,
  headerClose,
  hostCounts,
  hostLineWords,
  menuStart,
  needsHost,
  neverGiven,
  openWords,
  personOf,
  sampleMenu,
  setStarter,
  settle,
  spotOf,
  startDraft,
  sumOf,
  tickedOf,
  whoHasnt,
  whoOutcome,
  withDefaults,
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

  it('lists Menu changed under the party with the course and the pick they kept, and opens Choose for them there (sc-3913)', () => {
    const changed = menuStart('menuChanged').world!;
    const listed = whoHasnt(changed)
      .flatMap((w) => w.people)
      .filter((one) => one.changed.length > 0);

    expect(listed.map((one) => one.person.id)).toEqual([
      'lucia-ruiz',
      'louis-martin',
      'femi-adeyemi',
    ]);
    expect(listed[0]!.changed.map((one) => [one.course.id, one.picked])).toEqual([
      ['k3', 'Puff puff'],
    ]);
    expect(listed[0]!.open).toEqual([]);
    expect(listed[0]!.courses.map((one) => one.id)).toEqual(['k3']);
    expect(chooseCourses(changed, personOf(changed, 'lucia-ruiz')!).map((one) => one.id)).toEqual([
      'k3',
    ]);
    expect(courseFigures(changed, courseOf(changed, 'k3')!).changed).toBe(3);
  });

  it('counts only a stored Menu changed, never a dish pick whose dish has gone (sc-3913)', () => {
    const world = menuStart('menuChanged').world!;
    const k2 = world.picks.k2 ?? {};
    const [who, pick] = Object.entries(k2).find(([, one]) => one.kind === 'dish') ?? [];
    if (who == null || pick?.kind !== 'dish') throw new Error('no dish pick on Main');
    const gone = {
      ...world,
      picks: { ...world.picks, k2: { ...k2, [who]: { ...pick, dishId: 'gone' } } },
    };

    expect(spotOf(gone, courseOf(gone, 'k2')!, personOf(gone, who)!).kind).not.toBe('changed');
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

describe('a course’s default (sc-1362)', () => {
  const before = withDefaults(sampleMenu());
  const after = withDefaults(sampleMenu(TODAY.allClosed));
  const both = withDefaults(sampleMenu(TODAY.allClosed), true);
  const main = (shown = after) => courseOf(shown, 'k2')!;

  it('names the default under the course, before and after its close', () => {
    expect(courseFigures(before, main(before)).defaultLine).toBe(
      'Default: Jollof rice, Chicken. Given on Friday, May 28 to anyone coming who hasn’t answered.',
    );
    expect(courseFigures(after, main()).defaultLine).toBe(
      'Default: Jollof rice, Chicken. Given on Friday, May 28 to 2 guests who hadn’t answered.',
    );
  });

  it('counts the defaulted beside the chosen, never inside them', () => {
    const jollof = courseFigures(after, main()).rows.find((row) => row.id === 'v-chicken')!;
    const without = courseFigures(sampleMenu(TODAY.allClosed), main()).rows.find(
      (row) => row.id === 'v-chicken',
    )!;
    expect(jollof).toMatchObject({ chosen: without.chosen, defaulted: 2 });
    expect(sumOf(courseFigures(after, main()))).toBe(48);
  });

  it('lists the people never given the default first, with the reason', () => {
    expect(neverGiven(before).map(({ person, open }) => [person.name, openWords(open)])).toEqual([
      ['Bea Mensah', 'Not chosen: Starters, Main course · Vegetarian and Dessert'],
      ['Kwame Asante', 'Not chosen: Main course · allergy'],
      ['Nadia Petrova', 'Not chosen: Starters, Main course · Other diet and Dessert'],
    ]);
    const rest = whoHasnt(before).flatMap((group) => group.people.map((one) => one.person.id));
    expect(rest).not.toContain('bea-mensah');
    expect(rest).toContain('kofi-mensah');
  });

  it('keeps the people never given it after the close, when everyone else is defaulted', () => {
    expect(neverGiven(both).map((one) => one.person.name)).toEqual([
      'Bea Mensah',
      'Kwame Asante',
      'Nadia Petrova',
    ]);
  });

  it('lists Given the default by party, and only while someone is defaulted', () => {
    expect(givenDefault(before)).toEqual([]);
    expect(
      givenDefault(both).flatMap((group) =>
        group.people.map(({ person, courses }) => [
          person.name,
          courses.map((one) => `${one.course.name}: ${one.pick}`),
        ]),
      ),
    ).toEqual([
      ['Bea Mensah', ['Dessert: Zobo sorbet']],
      ['Kofi Mensah', ['Main course: Jollof rice, Chicken', 'Dessert: Zobo sorbet']],
      ['Ama Mensah', ['Dessert: Zobo sorbet']],
      ['Ivan Petrov', ['Main course: Jollof rice, Chicken']],
    ]);
  });

  it('opens Choose for them at the default, and saving takes the person off for that course', () => {
    const kofi = personOf(after, 'kofi-mensah')!;
    expect(startDraft(after, main(), kofi)).toEqual({
      kind: 'dish',
      dishId: 'k2-jollof',
      variantId: 'v-chicken',
      sideId: null,
    });
    const saved = settle(menuStart('chooseForDefaultedSaved'));
    expect(saved.said).toEqual(['Main course chosen for Kofi Mensah: Suya wrap, Beef.']);
    expect(givenDefault(saved.world!).flatMap((g) => g.people.map((one) => one.person.id))).toEqual(
      ['ivan-petrov'],
    );
  });
});

describe('Choose who gets it, on a Children only variant (sc-3909)', () => {
  const kids = { courseId: 'k2', dishId: 'k2-jollof', variantId: 'v-kids' } as const;

  it('ticks whoever has the variant now', () => {
    expect([...tickedOf(world, kids)]).toEqual(['tobi-bello', 'ife-adeyemi']);
  });

  it('asks the override question for anyone newly ticked it rules out', () => {
    const ticked = new Set(['tobi-bello', 'ife-adeyemi', 'kojo-asante']);
    expect(whoOutcome(world, kids, ticked, false, '19:45')).toMatchObject({
      kind: 'ask',
      title: 'Kojo Asante: give Children’s portion anyway?',
    });
  });

  it('gives it as the host’s pick, recorded despite the record when confirmed', () => {
    const saved = settle(menuStart('chooseWhoSaved'));
    expect(saved.said).toEqual([
      'Children’s portion, Jollof rice: 3 people now.',
      'Kojo Asante recorded as your pick despite the record.',
    ]);
    expect(saved.world!.picks.k2?.['kojo-asante']).toMatchObject({
      variantId: 'v-kids',
      override: { by: HOST },
    });
  });

  it('sends an unticked person to not chosen on a course guests choose', () => {
    const out = whoOutcome(world, kids, new Set(['tobi-bello']), false, '19:45');
    if (out.kind !== 'saved') throw new Error(out.kind);
    expect(spotOf(out.next, course('k2'), person('ife-adeyemi')).kind).toBe('none');
    expect(goesBackWords(course('k2'), person('ife-adeyemi'))).toBe('Goes back to not chosen.');
  });

  it('sends an unticked person back to the Everyone variant on a course that asks nothing', () => {
    const set = setStarter(world);
    const starter = courseOf(set, 'k1')!;
    const small = { courseId: 'k1', dishId: 'k1-pepper', variantId: 'v-small' } as const;
    const out = whoOutcome(set, small, new Set(['tobi-bello', 'ife-adeyemi']), false, '19:45');
    if (out.kind !== 'saved') throw new Error(out.kind);
    expect(hasVariant(out.next, starter, person('sasha-petrova'), 'v-small')).toBe(false);
    expect(spotOf(out.next, starter, person('sasha-petrova'))).toMatchObject({
      kind: 'dish',
      variantId: 'v-full',
    });
    expect(goesBackWords(starter, person('sasha-petrova'))).toBe('Goes back to Full bowl.');
    expect(goesBackWords(starter, person('kojo-asante'))).toBe('Goes back to Needs the host.');
  });

  it('refuses with a 403 and saves nothing', () => {
    const ticked = tickedOf(world, { ...kids, toggle: ['ife-adeyemi'] });
    expect(whoOutcome(world, { ...kids, refuses: true }, ticked, false, '19:45')).toEqual({
      kind: 'refused',
    });
  });

  it('is never offered to a guest picking for themselves', () => {
    const sent = guestSends(world)!;
    expect(sent.world.picks.k2?.['bea-mensah']).toMatchObject({ variantId: 'v-chicken' });
  });
});

describe('a dish whose allergens were never stated (lead, #3654)', () => {
  it('says so in its Contains line, apart from a dish with none of the 14', () => {
    const rows = courseFigures(world, course('k3')).rows;
    const row = (id: string) => rows.find((one) => one.id === id)!;

    expect(row('k3-puff').contains).toBeNull();
    expect(containsWords(row('k3-puff').contains)).toBe('Allergens not stated');
    expect(containsWords(row('k3-zobo').contains)).toBeNull();
  });
});
