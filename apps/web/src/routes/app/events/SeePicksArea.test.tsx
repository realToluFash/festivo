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

type Answer = (body: unknown) => Response;

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
            courses: [{ ...main, rows: [...main.rows, small] }],
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
