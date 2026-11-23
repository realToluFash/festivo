import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-15T18:00:00+01:00',
  endsAt: '2030-11-16T02:00:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 1,
  currency: 'NGN',
  cover: null,
  venue: null,
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

function signedIn(): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u_folake',
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations: [IRE],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number, more: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...more }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const dish = (id: string, name: string, allergens: string[]) => ({
  id,
  name,
  description: null,
  allergens,
  diets: [],
  libraryDishId: null,
  picked: false,
  variants: [],
  choices: [],
  offered: true,
  items: [],
});

const MENU = {
  menu: {
    courses: [
      {
        id: 'c_main',
        name: 'Main',
        servedAt: null,
        answer: 'choose',
        skippable: false,
        dishes: [dish('d_jollof', 'Jollof rice', ['celery']), dish('d_egusi', 'Egusi', ['fish'])],
        ownItems: [],
        items: [],
        picksClose: { at: '2030-11-15T18:00:00+01:00', source: 'start', closed: false },
      },
    ],
  },
};

const row = (id: string, name: string, chosen: number) => ({
  id,
  kind: 'dish',
  name,
  chosen,
  defaulted: 0,
});

function picksOf(more: Record<string, unknown> = {}) {
  return {
    picks: {
      updatedAt: '2030-11-10T19:42:00+01:00',
      room: 4,
      held: 0,
      answered: 2,
      percent: 50,
      allIn: false,
      courses: [
        {
          id: 'c_main',
          name: 'Main',
          asksNothing: false,
          skippable: false,
          closed: false,
          rows: [row('d_jollof', 'Jollof rice', 1), row('d_egusi', 'Egusi', 0)],
          kitchen: 1,
          skipped: 0,
          needsHost: 0,
          notChosen: 2,
          room: 4,
          answered: 2,
        },
      ],
      needsHost: [],
      waiting: [
        {
          id: 'g_bisi',
          replier: 'Bisi Adewale',
          people: [
            { id: 'g_kwame', name: 'Kwame Mensah', courses: ['c_main'] },
            { id: 'g_ada', name: 'Ada Obi', courses: ['c_main'] },
          ],
        },
      ],
      people: [
        { id: 'g_kwame', name: 'Kwame Mensah', party: 'g_bisi', allergens: ['celery'] },
        { id: 'g_ada', name: 'Ada Obi', party: 'g_bisi', allergens: [] },
      ],
      parties: [{ id: 'g_bisi', replier: 'Bisi Adewale' }],
      canChoose: true,
      ...more,
    },
  };
}

type Answer = (body: unknown) => Response | Promise<Response>;

function onPicks(
  answers: Record<string, Answer>,
  at = '/app/events/ev_1/menu/picks',
): { line: string; body: unknown }[] {
  const sent: { line: string; body: unknown }[] = [];
  signedIn();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });
    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: EVENT });
    if (line === 'GET /api/events/ev_1/menu') return json(MENU);

    return json({});
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);

  return sent;
}

const PICKS = '/api/events/ev_1/menu/picks';
const CHOOSE_KWAME = 'PUT /api/events/ev_1/menu/picks/people/g_kwame/courses/c_main';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('See picks (sc-3909)', () => {
  it('shows the header and each course adding up to the room', async () => {
    onPicks({ [`GET ${PICKS}`]: () => json(picksOf()) });

    expect(await screen.findByText('2 of 4 picks in · 50% of the room')).toBeDefined();
    const card = screen.getByRole('region', { name: 'Main' });
    const tables = within(card).getAllByRole('table');
    expect(
      within(tables[0] as HTMLElement).getByRole('columnheader', { name: 'Chosen' }),
    ).toBeDefined();
    expect(
      within(tables[0] as HTMLElement).queryByRole('columnheader', { name: 'Defaulted' }),
    ).toBeNull();
    expect(
      within(tables[1] as HTMLElement).getByRole('rowheader', { name: 'The room' }),
    ).toBeDefined();
    expect(within(card).getByText('2 of 4 answered')).toBeDefined();
    expect(screen.getByText('Replied by Bisi Adewale · 2 people')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Choose for Kwame Mensah' })).toBeDefined();
  });

  it('shows counts only without Guests read', async () => {
    onPicks({
      [`GET ${PICKS}`]: () =>
        json(
          picksOf({
            waiting: null,
            people: null,
            parties: null,
            canChoose: false,
            needsHost: null,
            courses: [{ ...picksOf().picks.courses[0], needsHost: 1, notChosen: 1 }],
          }),
        ),
    });

    expect(await screen.findByText('Names need Guests read. These are counts only.')).toBeDefined();
    expect(screen.getByText('Main · 1 person')).toBeDefined();
    expect(screen.queryByText('Who hasn’t picked')).toBeNull();
    expect(screen.queryByRole('button', { name: /Choose for/ })).toBeNull();
  });

  it('has no Choose for them without Guests manage', async () => {
    onPicks({ [`GET ${PICKS}`]: () => json(picksOf({ canChoose: false })) });

    expect(await screen.findByText('Choosing for a guest needs Guests manage.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Choose for/ })).toBeNull();
  });

  it('asks before a pick the record rules out, and sends it with anyway once confirmed', async () => {
    const sent = onPicks({
      [`GET ${PICKS}`]: () => json(picksOf()),
      [CHOOSE_KWAME]: () => json(picksOf()),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Choose for Kwame Mensah' }));
    const dialog = screen.getByRole('dialog', { name: 'Choosing for Kwame Mensah' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      within(dialog).getByText('Choose main for Kwame Mensah, or let the kitchen choose.'),
    ).toBeDefined();

    fireEvent.click(within(dialog).getByRole('radio', { name: /Jollof rice/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    const ask = screen.getByRole('alertdialog');
    expect(within(ask).getByRole('button', { name: 'Choose another dish' })).toBe(
      document.activeElement,
    );
    expect(
      within(ask).getByText('Kwame Mensah’s record says celery. Pick it anyway?'),
    ).toBeDefined();
    expect(sent.some((one) => one.line === CHOOSE_KWAME)).toBe(false);

    fireEvent.click(within(ask).getByRole('button', { name: 'Pick it anyway' }));
    await waitFor(() =>
      expect(sent.find((one) => one.line === CHOOSE_KWAME)?.body).toEqual({
        answer: 'chosen',
        dish: 'd_jollof',
        variant: null,
        options: [],
        anyway: true,
      }),
    );
    expect(await screen.findByText('Main chosen for Kwame Mensah: Jollof rice.')).toBeDefined();
  });

  it('lists every course a guest has not chosen as words, not commas', async () => {
    const main = picksOf().picks.courses[0];
    onPicks({
      [`GET ${PICKS}`]: () =>
        json(
          picksOf({
            courses: [{ ...main, id: 'c_starter', name: 'Starter' }, main],
            waiting: [
              {
                id: 'g_bisi',
                replier: 'Bisi Adewale',
                people: [{ id: 'g_ada', name: 'Ada Obi', courses: ['c_starter', 'c_main'] }],
              },
            ],
          }),
        ),
    });

    expect(await screen.findByText('Not chosen: Starter and Main')).toBeDefined();
  });

  it('names everyone a variant rules out as words when asking to give it anyway', async () => {
    const main = picksOf().picks.courses[0];
    const small = {
      id: 'v_small',
      kind: 'variant',
      name: 'Small plate',
      dish: 'd_jollof',
      for: 'children',
      allergens: ['celery'],
      chosen: 0,
      defaulted: 0,
      holders: [],
    };
    onPicks({
      [`GET ${PICKS}`]: () =>
        json(
          picksOf({
            courses: [{ ...main, rows: [...(main?.rows ?? []), small] }],
            people: [
              { id: 'g_kwame', name: 'Kwame Mensah', party: 'g_bisi', allergens: ['celery'] },
              { id: 'g_ada', name: 'Ada Obi', party: 'g_bisi', allergens: ['celery'] },
            ],
          }),
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Choose who gets Small plate/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose who gets Small plate' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Kwame Mensah' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Ada Obi' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    const ask = screen.getByRole('alertdialog');
    expect(
      within(ask).getByText('Kwame Mensah and Ada Obi: give Small plate anyway?'),
    ).toBeDefined();
  });

  it('focuses Save when Choose who gets it fails to save', async () => {
    let fail: (answer: Response) => void = () => undefined;
    const saving = new Promise<Response>((resolve) => {
      fail = resolve;
    });
    const main = picksOf().picks.courses[0];
    const small = {
      id: 'v_small',
      kind: 'variant',
      name: 'Small plate',
      dish: 'd_jollof',
      for: 'children',
      allergens: [],
      chosen: 0,
      defaulted: 0,
      holders: [],
    };
    onPicks({
      [`GET ${PICKS}`]: () =>
        json(picksOf({ courses: [{ ...main, rows: [...(main?.rows ?? []), small] }] })),
      ['PUT /api/events/ev_1/menu/picks/variants/v_small']: () => saving,
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Choose who gets Small plate/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose who gets Small plate' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Ada Obi' }));
    const save = within(dialog).getByRole('button', { name: 'Save' });
    fireEvent.click(save);

    await waitFor(() => expect(save.getAttribute('aria-disabled')).toBe('true'));
    expect(save).toHaveProperty('disabled', false);
    fail(problem('server_error', 500));

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Nothing was saved. Check your connection, then press Save again.',
    );
    expect(within(dialog).getByRole('checkbox', { name: 'Ada Obi' })).toHaveProperty(
      'checked',
      true,
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Save' })),
    );
  });

  it('says nothing was saved when the role lost Guests manage', async () => {
    onPicks({
      [`GET ${PICKS}`]: () => json(picksOf()),
      ['PUT /api/events/ev_1/menu/picks/people/g_ada/courses/c_main']: () =>
        problem('permission_required', 403),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Choose for Ada Obi' }));
    const dialog = screen.getByRole('dialog', { name: 'Choosing for Ada Obi' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Egusi' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByRole('alert')).toBeDefined();
    expect(within(dialog).getByText(/Nothing was saved/)).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: 'Save' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeDefined();
  });
});

describe('A dish whose allergens were never stated, on See picks (sc-87421)', () => {
  const NOT_STATED_MENU = {
    menu: {
      courses: [
        {
          ...MENU.menu.courses[0],
          dishes: [
            dish('d_jollof', 'Jollof rice', ['celery']),
            { ...dish('d_puff', 'Puff-puff', []), allergens: null },
          ],
        },
      ],
    },
  };
  const onNotStated = (more: Record<string, Answer> = {}) =>
    onPicks({
      [`GET ${PICKS}`]: () => json(picksOf()),
      'GET /api/events/ev_1/menu': () => json(NOT_STATED_MENU),
      ...more,
    });
  const chooseFor = async (name: string) => {
    fireEvent.click(await screen.findByRole('button', { name: `Choose for ${name}` }));

    return screen.getByRole('dialog', { name: `Choosing for ${name}` });
  };

  it('rules it out for a person with one of the 14, saying nobody stated it', async () => {
    onNotStated();
    const dialog = await chooseFor('Kwame Mensah');

    const puff = within(dialog).getByRole('radio', { name: /Puff-puff/ });
    expect(puff.getAttribute('aria-describedby')).not.toBeNull();
    const ruled = document.getElementById(puff.getAttribute('aria-describedby') ?? '');
    expect(ruled?.textContent).toBe('AllergyAllergens not stated. You can still pick it.');
    expect(within(dialog).queryByText(/Contains celery, which Kwame Mensah/)).not.toBeNull();
    expect(within(dialog).queryAllByText(/Contains/)).toHaveLength(1);
  });

  it('does not rule it out for a person with none of the 14 recorded', async () => {
    onNotStated();
    const dialog = await chooseFor('Ada Obi');

    expect(
      within(dialog)
        .getByRole('radio', { name: /Puff-puff/ })
        .getAttribute('aria-describedby'),
    ).toBeNull();
    expect(within(dialog).queryByText('Allergy')).toBeNull();
  });

  it('asks without saying what it contains, and saves a line that says nobody stated it', async () => {
    const sent = onNotStated({ [CHOOSE_KWAME]: () => json(picksOf()) });
    const dialog = await chooseFor('Kwame Mensah');

    fireEvent.click(within(dialog).getByRole('radio', { name: /Puff-puff/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    const ask = screen.getByRole('alertdialog');
    expect(
      within(ask).getByText('Kwame Mensah’s record says celery. Pick it anyway?'),
    ).toBeDefined();
    expect(
      within(ask).getByText(
        'Nobody has stated what’s in Puff-puff. If you know it is safe for Kwame Mensah, the pick is saved with your name and the time you confirmed it.',
      ),
    ).toBeDefined();

    fireEvent.click(within(ask).getByRole('button', { name: 'Pick it anyway' }));
    expect(
      await screen.findByText(
        'Recorded as your pick for Kwame Mensah, though nobody has stated what’s in Puff-puff.',
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.line === CHOOSE_KWAME)?.body).toMatchObject({ anyway: true });
  });

  it('keeps a stated dish’s words when it is picked anyway', async () => {
    onNotStated({ [CHOOSE_KWAME]: () => json(picksOf()) });
    const dialog = await chooseFor('Kwame Mensah');

    fireEvent.click(within(dialog).getByRole('radio', { name: /Jollof rice/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    const ask = screen.getByRole('alertdialog');
    expect(
      within(ask).getByText(
        'Jollof rice contains celery. If Kwame Mensah’s record is out of date, the pick is saved with your name and the time you confirmed it.',
      ),
    ).toBeDefined();

    fireEvent.click(within(ask).getByRole('button', { name: 'Pick it anyway' }));
    expect(
      await screen.findByText(
        'Recorded as your pick for Kwame Mensah, despite the record: Jollof rice contains celery.',
      ),
    ).toBeDefined();
  });

  it('says under Needs the host that the pick has no allergens stated', async () => {
    const host = (pick: string, notStated: boolean) => ({
      person: { id: 'g_kwame', name: 'Kwame Mensah' },
      course: 'c_main',
      reason: 'allergy',
      pick,
      allergens: ['celery'],
      notStated,
    });
    onPicks({
      [`GET ${PICKS}`]: () =>
        json(
          picksOf({
            needsHost: [host('Puff-puff', true), host('Jollof rice', false)],
            courses: [{ ...picksOf().picks.courses[0], needsHost: 2 }],
          }),
        ),
      'GET /api/events/ev_1/menu': () => json(NOT_STATED_MENU),
    });

    expect(
      await screen.findByText(
        'Main: their pick, Puff-puff, has no allergens stated, and celery was recorded after they picked it.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Main: their pick, Jollof rice, contains celery, recorded after they picked it.',
      ),
    ).toBeDefined();
  });
});

describe('A course’s default on See picks (sc-1362)', () => {
  const DEFAULT = { dish: 'd_egusi', variant: null, options: [], chooseBy: '2030-11-10' };
  const MENU_DEFAULT = {
    menu: { courses: [{ ...MENU.menu.courses[0], default: DEFAULT }] },
  };
  const withDefault = (closed: boolean, defaulted: number, more: Record<string, unknown> = {}) => {
    const base = picksOf().picks;

    return picksOf({
      courses: [
        {
          ...base.courses[0],
          closed,
          default: DEFAULT,
          rows: [row('d_jollof', 'Jollof rice', 1), { ...row('d_egusi', 'Egusi', 0), defaulted }],
        },
      ],
      ...more,
    });
  };
  const ADA_GIVEN = [
    {
      id: 'g_bisi',
      replier: 'Bisi Adewale',
      people: [
        {
          id: 'g_ada',
          name: 'Ada Obi',
          courses: [{ course: 'c_main', dish: 'd_egusi', variant: null, options: [] }],
        },
      ],
    },
  ];
  const KWAME_WAITING = [
    {
      id: 'g_bisi',
      replier: 'Bisi Adewale',
      people: [
        {
          id: 'g_kwame',
          name: 'Kwame Mensah',
          courses: ['c_main'],
          excluded: [{ course: 'c_main', reason: 'allergy' }],
        },
      ],
    },
  ];

  it('shows Defaulted and names the default before its date', async () => {
    onPicks({
      [`GET ${PICKS}`]: () => json(withDefault(false, 0)),
      'GET /api/events/ev_1/menu': () => json(MENU_DEFAULT),
    });

    const card = await screen.findByRole('region', { name: 'Main' });
    const table = within(card).getAllByRole('table')[0] as HTMLElement;
    expect(within(table).getByRole('columnheader', { name: 'Defaulted' })).toBeDefined();
    expect(
      within(card).getByText(
        /^Default: Egusi\. Given on .+ to anyone coming who hasn’t answered\.$/,
      ),
    ).toBeDefined();
  });

  it('lists the people never given the default first, with why', async () => {
    onPicks({
      [`GET ${PICKS}`]: () =>
        json(
          withDefault(false, 0, {
            waiting: [
              {
                id: 'g_bisi',
                replier: 'Bisi Adewale',
                people: [
                  {
                    id: 'g_kwame',
                    name: 'Kwame Mensah',
                    courses: ['c_main'],
                    excluded: [{ course: 'c_main', reason: 'allergy' }],
                  },
                  {
                    id: 'g_ada',
                    name: 'Ada Obi',
                    courses: ['c_main'],
                    excluded: [{ course: 'c_main', reason: 'vegetarian' }],
                  },
                  { id: 'g_tolu', name: 'Tolu Bello', courses: ['c_main'], excluded: [] },
                ],
              },
            ],
          }),
        ),
      'GET /api/events/ev_1/menu': () => json(MENU_DEFAULT),
    });

    expect(await screen.findByText('Never given the default · 2 people')).toBeDefined();
    expect(screen.getByText('Not chosen: Main · allergy')).toBeDefined();
    expect(screen.getByText('Not chosen: Main · Vegetarian')).toBeDefined();
    expect(screen.getByText('Replied by Bisi Adewale · 1 person')).toBeDefined();
  });

  it('lists who was given the default, and Choose for them starts at it', async () => {
    const sent = onPicks({
      [`GET ${PICKS}`]: () =>
        json(withDefault(true, 1, { waiting: KWAME_WAITING, given: ADA_GIVEN })),
      'GET /api/events/ev_1/menu': () => json(MENU_DEFAULT),
      'PUT /api/events/ev_1/menu/picks/people/g_ada/courses/c_main': () =>
        json(withDefault(true, 0, { waiting: KWAME_WAITING, given: [] })),
    });

    const given = await screen.findByRole('region', { name: 'Given the default · 1 person' });
    expect(within(given).getByText('Main: Egusi')).toBeDefined();
    expect(within(given).getByText('(default)')).toBeDefined();
    expect(
      screen.getByText(/^Default: Egusi\. Given on .+ to 1 guest who hadn’t answered\.$/),
    ).toBeDefined();

    fireEvent.click(within(given).getByRole('button', { name: 'Choose for Ada Obi' }));
    const dialog = screen.getByRole('dialog', { name: 'Choosing for Ada Obi' });
    expect((within(dialog).getByRole('radio', { name: /Egusi/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(
        sent.find(
          (one) => one.line === 'PUT /api/events/ev_1/menu/picks/people/g_ada/courses/c_main',
        )?.body,
      ).toEqual({ answer: 'chosen', dish: 'd_egusi', variant: null, options: [], anyway: false }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Given the default · 1 person' })).toBeNull(),
    );
  });

  it('hides Given the default without Guests read', async () => {
    onPicks({
      [`GET ${PICKS}`]: () =>
        json(withDefault(true, 1, { waiting: null, people: null, parties: null, given: null })),
      'GET /api/events/ev_1/menu': () => json(MENU_DEFAULT),
    });

    expect(await screen.findByRole('region', { name: 'Main' })).toBeDefined();
    expect(screen.queryByText(/Given the default/)).toBeNull();
  });
});

describe('See picks narrowed to one course (sc-3909)', () => {
  const NARROWED = '/app/events/ev_1/menu/picks?course=c_main';
  const twoCourses = {
    menu: {
      courses: [
        { ...MENU.menu.courses[0], id: 'c_starter', name: 'Starter' },
        MENU.menu.courses[0],
      ],
    },
  };
  const bothWaiting = picksOf({
    waiting: [
      {
        id: 'g_bisi',
        replier: 'Bisi Adewale',
        people: [{ id: 'g_ada', name: 'Ada Obi', courses: ['c_starter', 'c_main'] }],
      },
    ],
  });

  it('moves the focus to the narrowed heading', async () => {
    onPicks({ [`GET ${PICKS}`]: () => json(picksOf()) }, NARROWED);

    const heading = await screen.findByRole('heading', { name: 'Who hasn’t picked · Main' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('says everyone has picked that course when nobody is left on it', async () => {
    onPicks({ [`GET ${PICKS}`]: () => json(picksOf({ waiting: [] })) }, NARROWED);

    expect(
      await screen.findByText('Everyone coming has picked Main, or is with the host above.'),
    ).toBeDefined();
    expect(screen.queryByText(/picked every course/)).toBeNull();
  });

  it('opens Choose for them on the narrowed course, then goes on to the others', async () => {
    onPicks(
      {
        [`GET ${PICKS}`]: () => json(bothWaiting),
        ['GET /api/events/ev_1/menu']: () => json(twoCourses),
      },
      NARROWED,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Choose for Ada Obi' }));
    const dialog = screen.getByRole('dialog', { name: 'Choosing for Ada Obi' });
    expect(within(dialog).getByRole('button', { name: 'Save and go on' })).toBeDefined();
    expect(within(dialog).getByText('Main', { selector: 'legend' })).toBeDefined();
  });

  it('names the button that was pressed when a save fails', async () => {
    onPicks(
      {
        [`GET ${PICKS}`]: () => json(bothWaiting),
        ['GET /api/events/ev_1/menu']: () => json(twoCourses),
        ['PUT /api/events/ev_1/menu/picks/people/g_ada/courses/c_main']: () =>
          problem('server_error', 500),
      },
      NARROWED,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Choose for Ada Obi' }));
    const dialog = screen.getByRole('dialog', { name: 'Choosing for Ada Obi' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Egusi' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and go on' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Nothing was saved. Check your connection, then press Save and go on again.',
    );
    expect(within(dialog).getByRole('radio', { name: 'Egusi' })).toHaveProperty('checked', true);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: 'Save and go on' }),
      ),
    );
  });

  it('keeps the focus in the dialog when Pick it anyway goes on to the next course', async () => {
    onPicks(
      {
        [`GET ${PICKS}`]: () =>
          json(
            picksOf({
              waiting: [
                {
                  id: 'g_bisi',
                  replier: 'Bisi Adewale',
                  people: [
                    { id: 'g_kwame', name: 'Kwame Mensah', courses: ['c_starter', 'c_main'] },
                  ],
                },
              ],
            }),
          ),
        ['GET /api/events/ev_1/menu']: () => json(twoCourses),
        [CHOOSE_KWAME]: () => json(picksOf()),
      },
      NARROWED,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Choose for Kwame Mensah' }));
    const dialog = screen.getByRole('dialog', { name: 'Choosing for Kwame Mensah' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Jollof rice/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and go on' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Pick it anyway' }),
    );

    expect(await within(dialog).findByText('Starter · 2 of 2')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });
});

describe('The picks on the event’s Menu (sc-3909)', () => {
  const closedMenu = {
    menu: {
      courses: [
        {
          ...MENU.menu.courses[0],
          picksClose: { at: '2030-11-14T18:00:00+01:00', source: 'start', closed: true },
        },
      ],
    },
  };

  it('shows each dish row’s picks, See picks on the course and the Picks card', async () => {
    onPicks(
      {
        [`GET ${PICKS}`]: () => json(picksOf()),
        ['GET /api/events/ev_1/menu']: () => json(closedMenu),
      },
      '/app/events/ev_1/menu',
    );

    expect(await screen.findByText('1 pick · 25% of the room')).toBeDefined();
    expect(screen.getByText('0 picks · 0% of the room')).toBeDefined();
    expect(screen.getByRole('link', { name: 'See picks · Main' }).getAttribute('href')).toBe(
      '/app/events/ev_1/menu/picks#pk-c_main',
    );
    const card = screen.getByRole('complementary', { name: 'Picks' });
    expect(within(card).getByText('2 of 4 picks in · 50% of the room')).toBeDefined();
    expect(within(card).getByText('Who hasn’t picked · 2')).toBeDefined();
    expect(screen.getByText(/You can still choose for any guest\./)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Who hasn’t picked Main' }).getAttribute('href')).toBe(
      '/app/events/ev_1/menu/picks?course=c_main',
    );
  });

  it('keeps a closed course’s line as it was without Guests manage', async () => {
    onPicks(
      {
        [`GET ${PICKS}`]: () => json(picksOf({ canChoose: false })),
        ['GET /api/events/ev_1/menu']: () => json(closedMenu),
      },
      '/app/events/ev_1/menu',
    );

    expect(await screen.findByText('1 pick · 25% of the room')).toBeDefined();
    expect(screen.queryByText(/You can still choose/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Who hasn’t picked Main' })).toBeNull();
  });
});
