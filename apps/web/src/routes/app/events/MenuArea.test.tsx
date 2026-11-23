import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { cssRule, stylesheet } from '../../../test-styles.ts';

const MENU_CSS = stylesheet(import.meta.dirname, 'menu.css');

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

function signedIn(organisation = IRE): void {
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
    organisation,
    organisations: [organisation],
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

/** sc-3913's 409 until the change is sent again with `askAgain`, then the menu as saved. */
const asksFirst =
  (more: Record<string, unknown>, saved: Record<string, unknown>): Answer =>
  (_body, search) =>
    search.includes('askAgain=1')
      ? json(saved)
      : problem('menu_change_asks', 409, { count: 0, allergens: [], ...more });

type Answer = (body: unknown, search: string) => Response | Promise<Response>;

/** A dish and a course exactly as MenuSerialiser writes them (sc-3902). */
function dish(id: string, name: string, more: Record<string, unknown> = {}) {
  return {
    id,
    name,
    description: null,
    allergens: ['celery'],
    diets: [],
    libraryDishId: null,
    picked: false,
    variants: [],
    choices: [],
    offered: true,
    items: [],
    ...more,
  };
}

function course(id: string, name: string, dishes: unknown[], more: Record<string, unknown> = {}) {
  return {
    id,
    name,
    servedAt: null,
    answer: 'choose',
    skippable: false,
    dishes,
    ownItems: [],
    items: [],
    ...more,
  };
}

const JOLLOF = dish('d_jollof', 'Jollof rice', { picked: true, diets: ['halal'] });
const STARTER = course('c_starter', 'Starter', [dish('d_soup', 'Pepper soup')], {
  servedAt: '18:30',
  answer: 'same',
});
const MAIN = course('c_main', 'Main', [JOLLOF, dish('d_asun', 'Asun')], { servedAt: '20:00' });
const LATE = course('c_late', 'Late-night bites', []);

async function onMenu(
  answers: Record<string, Answer>,
  permissions: string[] = OWNER_PERMISSIONS,
  {
    organisation = IRE,
    roleOnEvent = null,
  }: { organisation?: typeof IRE; roleOnEvent?: string | null } = {},
): Promise<{ line: string; body: unknown }[]> {
  const sent: { line: string; body: unknown }[] = [];
  signedIn(organisation);

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const line = `${init?.method ?? 'GET'} ${url.pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line: `${line}${url.search}`, body });

    const answer = answers[line];
    if (answer != null) return answer(body, url.search);
    if (line === 'GET /api/events/ev_1')
      return json({ event: { ...EVENT, permissions, roleOnEvent } });
    if (line === 'GET /api/orgs/org_1/dishes')
      return json({ dishes: [], canManage: true, seesPrices: false });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/menu'] })}
    />,
  );

  return sent;
}

const menuOf =
  (...courses: unknown[]) =>
  () =>
    json({ menu: { courses } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('The event’s Menu (sc-3902)', () => {
  it('shows each course in order with its place, served time, state and dishes, and the header’s counts', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN, LATE) });

    const cards = await screen.findAllByRole('listitem', { name: /Starter|Main|Late-night/ });
    expect(
      cards.map((card) => within(card).getByRole('heading', { level: 2 }).textContent),
    ).toEqual(['Starter', 'Main', 'Late-night bites']);
    expect(cards[0]?.textContent).toContain('Course 1 of 3 · served 18:30');
    expect(cards[2]?.textContent).toContain('Course 3 of 3');
    expect(cards[2]?.textContent).not.toContain('served');
    expect(cards[0]?.textContent).toContain('Ready');
    expect(cards[2]?.textContent).toContain('Empty · not shown to guests');
    expect(screen.getByText('3 courses · 3 dishes')).toBeDefined();
    expect(screen.getByText('2 of 3 courses ready')).toBeDefined();
    expect((await screen.findByText('2 of 3 ready')).closest('a')?.getAttribute('href')).toBe(
      '/app/events/ev_1/menu',
    );
    expect(
      within(cards[1] as HTMLElement).getAllByText('Contains: Celery', { selector: 'p' }),
    ).toHaveLength(2);
    expect(within(cards[1] as HTMLElement).getByText('Halal')).toBeDefined();
  });

  it('spaces its crumbs, header and panel 12 px apart as the demo does, not the event area’s 18', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN) });

    const counts = await screen.findByText('2 courses · 3 dishes');
    expect(counts.closest('.mc .ev-wide.mn-page')).not.toBeNull();
    expect(cssRule('.mc .mn-page', MENU_CSS)).toContain('gap: var(--spaceLg);');
  });

  it('has no ready line once every course has a dish', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN) });

    expect(await screen.findByText('2 courses · 3 dishes')).toBeDefined();
    expect(screen.queryByText(/courses ready/)).toBeNull();
    expect(screen.queryByText('2 of 2 ready')).toBeNull();
  });

  it('says No menu yet with Add course when there are no courses', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf() });

    expect(await screen.findByRole('heading', { name: 'No menu yet' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add course' })).toBeDefined();
  });

  it('refuses a blank course name beside the field, and adds a course with its time as the API keeps it', async () => {
    const sent = await onMenu({
      'GET /api/events/ev_1/menu': menuOf(STARTER),
      'POST /api/events/ev_1/menu/courses': () =>
        json(
          {
            menu: { courses: [STARTER, course('c_new', 'Main', [], { servedAt: '08:05' })] },
            courseId: 'c_new',
          },
          201,
        ),
    });

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Add course' }))[0] as HTMLElement,
    );
    const panel = await screen.findByRole('complementary', { name: 'Add course' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add course' }));
    expect(within(panel).getByText('Enter the course’s name.')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/menu/courses')).toBe(false);

    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Main' } });
    fireEvent.change(within(panel).getByLabelText(/Served at/), { target: { value: '8:05' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add course' }));

    expect(await screen.findByText('Main added as course 2 of 2.')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/menu/courses')?.body).toEqual({
      name: 'Main',
      servedAt: '08:05',
    });
  });

  it('opens nothing at ten courses, and says why beside the button pressed', async () => {
    const ten = Array.from({ length: 10 }, (_, n) => course(`c_${n}`, `Course ${n}`, []));
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(...ten) });

    const [top] = await screen.findAllByRole('button', { name: 'Add course' });
    fireEvent.click(top as HTMLElement);

    expect(screen.queryByRole('complementary', { name: 'Add course' })).toBeNull();
    expect(document.getElementById('mc-limit-top')?.textContent).toContain(
      'A menu can have at most 10 courses.',
    );
  });

  it('moves a course with Move up, keeps focus on the button, and says where it went', async () => {
    const sent = await onMenu({
      'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN),
      'POST /api/events/ev_1/menu/courses/c_main/move': menuOf(MAIN, STARTER),
    });

    const up = await screen.findByRole('button', { name: 'Move Main up' });
    up.focus();
    fireEvent.click(up);

    expect(await screen.findByText('Main moved to course 1 of 2.')).toBeDefined();
    expect(sent.find((one) => one.line.endsWith('/move'))?.body).toEqual({ to: 0 });
    await waitFor(() => expect(document.activeElement?.id).toBe('mc-up-c_main'));
    expect(screen.getByRole('button', { name: 'Move Main up' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('says nothing moved when the move fails', async () => {
    await onMenu({
      'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN),
      'POST /api/events/ev_1/menu/courses/c_main/move': () => problem('internal_error', 500),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Move Main up' }));

    expect(
      await screen.findByText(
        'Nothing was moved: Main is still course 2 of 2. Check your connection, then try again.',
      ),
    ).toBeDefined();
  });

  it('asks the host first to remove a dish guests have picked, naming who and the course', async () => {
    const sent = await onMenu({
      'GET /api/events/ev_1/menu': menuOf(MAIN),
      'DELETE /api/events/ev_1/menu/dishes/d_jollof': asksFirst(
        { count: 10, course: { id: 'c_main', name: 'Main' }, whom: 'picked' },
        { menu: { courses: [course('c_main', 'Main', [dish('d_asun', 'Asun')])] } },
      ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Jollof rice…' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Jollof rice from Main?',
    });
    expect(
      within(dialog).getByText(
        '10 guests picked this dish. They’ll be asked to pick again for Main.',
      ),
    ).toBeDefined();
    expect(within(dialog).getByText('Nobody is messaged from here.')).toBeDefined();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Jollof rice…' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Jollof rice…' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Change and ask them',
      }),
    );

    expect(
      await screen.findByText(
        'Jollof rice removed from Main. 10 guests will be asked to pick again.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(sent.map((one) => one.line)).toContain(
      'DELETE /api/events/ev_1/menu/dishes/d_jollof?askAgain=1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Asun…' }));
    expect(
      screen.getByText('Remove Asun from Main? It is only on this event, so it goes for good.'),
    ).toBeDefined();
  });

  it('shows the past date inside the dialog, with only Close, and changes nothing', async () => {
    let asked = 0;
    await onMenu({
      'GET /api/events/ev_1/menu': menuOf(MAIN),
      'DELETE /api/events/ev_1/menu/dishes/d_jollof': (_body, search) => {
        asked += 1;

        return search.includes('askAgain=1')
          ? problem('menu_event_over', 409)
          : problem('menu_change_asks', 409, {
              count: 2,
              course: { id: 'c_main', name: 'Main' },
              whom: 'picked',
            });
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Jollof rice…' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change and ask them' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('Not changed');
    expect(alert.textContent).toContain('Adaeze and Tunde was on');
    expect(alert.textContent).toContain('Nothing was changed.');
    expect(within(dialog).queryByRole('button', { name: 'Change and ask them' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(asked).toBe(2);
  });

  it('refuses at once to delete a course guests have picked from', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(MAIN) });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Main…' }));

    expect(screen.getByText('Guests have picked from this course.')).toBeDefined();
  });

  it('keeps Remove dish asking when the remove fails, the line under it and focus on it', async () => {
    await onMenu({
      'GET /api/events/ev_1/menu': menuOf(MAIN),
      'DELETE /api/events/ev_1/menu/dishes/d_asun': () => problem('internal_error', 500),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Asun…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove dish' }));

    const line = await screen.findByText(
      'Nothing was removed. Check your connection, then press Remove dish again.',
    );
    await waitFor(() => expect(document.activeElement).toBe(line));
    expect(
      screen.getByText('Remove Asun from Main? It is only on this event, so it goes for good.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove dish' })).toBeDefined();
  });

  it('keeps Delete course asking when the delete fails, the line under it and focus on it', async () => {
    await onMenu({
      'GET /api/events/ev_1/menu': menuOf(LATE),
      'DELETE /api/events/ev_1/menu/courses/c_late': () => problem('internal_error', 500),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Late-night bites…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete course' }));

    const line = await screen.findByText(
      'Nothing was deleted. Check your connection, then press Delete course again.',
    );
    await waitFor(() => expect(document.activeElement).toBe(line));
    expect(screen.getByRole('button', { name: 'Delete course' })).toBeDefined();
  });

  it('shows the menu as it now stands, with no failure line, when another page added the library dish first', async () => {
    const library = {
      id: 'lib_suya',
      name: 'Suya wrap',
      description: null,
      allergens: ['peanuts'],
      diets: [],
      usedByEvent: true,
      archivedAt: null,
      lastPrice: null,
      variants: [],
    };
    let menu = menuOf(LATE);
    const sent = await onMenu({
      'GET /api/events/ev_1/menu': () => menu(),
      'GET /api/orgs/org_1/dishes': () =>
        json({ dishes: [library], canManage: true, seesPrices: false }),
      'POST /api/events/ev_1/menu/courses/c_late/dishes': () => {
        menu = menuOf({
          ...LATE,
          dishes: [dish('d_suya', 'Suya wrap', { libraryDishId: 'lib_suya' })],
        });
        return problem('menu_dish_on_course', 409);
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add dish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Suya wrap' }));

    expect(await screen.findByText('On this course')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add Suya wrap' })).toBeNull();
    expect(screen.queryByText(/Nothing was saved/)).toBeNull();
    expect(
      sent.filter((one) => one.line === 'POST /api/events/ev_1/menu/courses/c_late/dishes'),
    ).toEqual([
      {
        line: 'POST /api/events/ev_1/menu/courses/c_late/dishes',
        body: { libraryDishId: 'lib_suya' },
      },
    ]);
  });

  it('says the library is loading, and quotes no search, until it has loaded', async () => {
    await onMenu({
      'GET /api/events/ev_1/menu': menuOf(LATE),
      'GET /api/orgs/org_1/dishes': () => new Promise<Response>(() => undefined),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add dish' }));

    expect(document.getElementById('mc-found')?.textContent).toBe('Loading the menu library…');
    expect(screen.queryByText(/No dish name has/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Start a new dish/ })).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Find a dish' })).toBeDefined();
  });

  it('says a library that did not load did not, never that it is empty, and Try again loads it, failing back as often as it fails', async () => {
    const tries: Answer[] = [
      () => problem('internal_error', 500),
      () => problem('internal_error', 500),
      () =>
        json({
          dishes: [
            {
              id: 'lib_suya',
              name: 'Suya wrap',
              description: null,
              allergens: [],
              diets: [],
              usedByEvent: false,
              archivedAt: null,
              lastPrice: null,
              variants: [],
            },
          ],
          canManage: true,
          seesPrices: false,
        }),
    ];
    await onMenu({
      'GET /api/events/ev_1/menu': menuOf(LATE),
      'GET /api/orgs/org_1/dishes': (body, search) => (tries.shift() ?? tries[0]!)(body, search),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add dish' }));

    expect(await screen.findByText('Check your connection, then try again.')).toBeDefined();
    expect(document.getElementById('mc-found')?.textContent).toBe('The menu library did not load.');
    expect(screen.queryByText('The menu library has no dishes yet.')).toBeNull();
    expect(screen.queryByRole('button', { name: /Start a new dish/ })).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Find a dish' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(document.activeElement?.id).toBe('mc-find');
    expect(await screen.findByText('Check your connection, then try again.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(document.getElementById('mc-found')?.textContent).toBe('Loading the menu library…');
    expect(await screen.findByText('Suya wrap')).toBeDefined();
    expect(screen.queryByText('The menu library did not load.')).toBeNull();
  });

  it('says an empty library has no dishes, and starts a new dish with no name', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(LATE) });

    fireEvent.click(await screen.findByRole('button', { name: 'Add dish' }));

    expect(await screen.findByText('The menu library has no dishes yet.')).toBeDefined();
    expect(screen.queryByText(/No dish name has/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start a new dish' }));
    expect(screen.getByRole('tab', { name: 'New dish' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('offers Everyone gets the same only with exactly one dish', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN) });

    const radios = await screen.findAllByRole('radio', { name: 'Everyone gets the same' });
    expect(radios[0]?.getAttribute('aria-disabled')).toBeNull();
    expect(radios[1]?.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByText('“Everyone gets the same” needs exactly one dish.')).toHaveLength(1);
  });

  it('asks first to add an allergen to a picked dish, counting who has it recorded', async () => {
    const sent = await onMenu({
      'GET /api/events/ev_1/menu': menuOf(MAIN),
      'PUT /api/events/ev_1/menu/dishes/d_jollof': asksFirst(
        {
          count: 4,
          course: { id: 'c_main', name: 'Main' },
          whom: 'allergen',
          allergens: ['sesame'],
        },
        { menu: { courses: [MAIN] }, dishId: 'd_jollof' },
      ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Jollof rice' }));
    const panel = await screen.findByRole('complementary', { name: 'Edit dish' });
    fireEvent.click(within(panel).getByLabelText('Sesame'));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Add sesame to Jollof rice?' });
    expect(
      within(dialog).getByText(
        '4 guests who picked this dish have sesame recorded. They’ll be asked to pick again for Main, and will appear in Needs the host.',
      ),
    ).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change and ask them' }));

    expect(
      await screen.findByText('Jollof rice saved. 4 guests will be asked to pick again.'),
    ).toBeDefined();
    expect(
      sent.find((one) => one.line === 'PUT /api/events/ev_1/menu/dishes/d_jollof?askAgain=1')?.body,
    ).toEqual(expect.objectContaining({ allergens: ['celery', 'sesame'], containsNone: false }));
  });

  it('has no line when the save counts nobody', async () => {
    await onMenu({
      'GET /api/events/ev_1/menu': menuOf(MAIN),
      'PUT /api/events/ev_1/menu/dishes/d_jollof': () =>
        json({ menu: { courses: [MAIN] }, dishId: 'd_jollof', unwarned: null }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Jollof rice' }));
    const panel = await screen.findByRole('complementary', { name: 'Edit dish' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Jollof rice saved.')).toBeDefined();
    expect(screen.queryByText(/nobody has told them/)).toBeNull();
  });

  it('reads only without menu.manage: the settings as text and no controls', async () => {
    await onMenu(
      { 'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN) },
      OWNER_PERMISSIONS.filter((one) => one !== 'menu.manage'),
    );

    expect(await screen.findByText(/can see this menu but not change it/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add course' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('Everyone gets the same')).toBeDefined();
    expect(screen.getByText('Guests choose')).toBeDefined();
  });

  it.each([
    ['can_view', 'Can view'],
    ['can_check_in', 'Can check guests in'],
  ])(
    'names a Member’s role on the event, %s, in the read-only line (sc-59617)',
    async (role, name) => {
      await onMenu({ 'GET /api/events/ev_1/menu': menuOf(STARTER) }, ['events.read', 'menu.read'], {
        organisation: membership({ role: { id: 'role_m', seededAs: 'member', name: null } }),
        roleOnEvent: role,
      });

      expect(
        await screen.findByText(
          `Your role on this event, ${name}, can see this menu but not change it. Someone whose role can change Menu can.`,
        ),
      ).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add course' })).toBeNull();
    },
  );

  it('names a custom organisation role, not a role on the event, when the event’s answer carries none (sc-59617)', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(STARTER) }, ['events.read', 'menu.read'], {
      organisation: membership({ role: { id: 'role_c', seededAs: null, name: 'Coordinator' } }),
    });

    expect(
      await screen.findByText(
        'Your role, Coordinator, can see this menu but not change it. Someone whose role can change Menu can.',
      ),
    ).toBeDefined();
  });

  it('answers a member without menu.read as a page that does not exist, under a crumb that stops at Events', async () => {
    const sent = await onMenu({}, ['events.read']);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page does not exist' }),
    ).toBeDefined();
    const crumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumb.getAllByRole('listitem').map((part) => part.textContent)).toEqual(['Events']);
    expect(sent.some((one) => one.line === 'GET /api/events/ev_1/menu')).toBe(false);
  });

  describe('when picks close (sc-3905)', () => {
    const byReplyBy = { at: '2026-10-19T23:59:59+01:00', source: 'replyBy', closed: false };

    it('heads the Menu with the close, and gives each course that asks guests its pill and where the date comes from', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(
          { ...STARTER, picksClose: null },
          { ...MAIN, picksClose: byReplyBy },
          LATE,
        ),
      });

      const cards = await screen.findAllByRole('listitem', { name: /Starter|Main|Late-night/ });
      expect(screen.getByText('picks close Monday, Oct 19')).toBeDefined();
      expect(cards[1]?.textContent).toContain('Picks close Monday, Oct 19');
      expect(cards[1]?.textContent).toContain(
        'Set by the event’s reply-by date. Closes at 23:59, Lagos time.',
      );
      expect(cards[0]?.textContent).not.toContain('Picks close');
      expect(cards[2]?.textContent).not.toContain('Picks close');
      expect(cards[1]?.textContent).not.toContain('can no longer change');
    });

    it('says picks closed on the date once every course has closed, and that guests can no longer change theirs, the course named as typed', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf({
          ...MAIN,
          picksClose: { at: '2026-11-14T16:00:00+01:00', source: 'start', closed: true },
        }),
      });

      const card = await screen.findByRole('listitem', { name: 'Main' });
      expect(screen.getByText('picks closed on Saturday, Nov 14')).toBeDefined();
      expect(card.textContent).toContain('Picks closed on Saturday, Nov 14');
      expect(card.textContent).toContain('Set by the event’s start. Closed at 16:00, Lagos time.');
      expect(card.textContent).toContain('Guests can no longer change their Main pick.');
    });
  });

  describe('variants of a dish (sc-3903)', () => {
    const variant = (id: string, name: string, chosen: 'everyone' | 'children') => ({
      id,
      name,
      for: chosen,
      allergens: ['celery'],
      diets: [],
      picked: false,
    });
    const WAYS = dish('d_ways', 'Jollof rice', {
      variants: [
        variant('v_chicken', 'Chicken', 'everyone'),
        variant('v_portion', 'Children’s portion', 'children'),
        variant('v_plain', 'Children’s plain', 'children'),
      ],
    });
    const TWO = dish('d_two', 'Coconut rice', {
      variants: [variant('v_fish', 'Fish', 'everyone'), variant('v_hen', 'Chicken', 'everyone')],
    });
    const TWO_ONE = dish('d_one', 'Coconut rice', {
      variants: [
        variant('v_goat', 'Goat', 'everyone'),
        variant('v_kids', 'Children’s portion', 'children'),
      ],
    });

    it('asks for two at once, and refuses both Children only beside each For before sending', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [dish('d_asun', 'Asun')])),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Add variant to Asun' }));
      const panel = await screen.findByRole('complementary', { name: 'Add variants to Asun' });
      const names = within(panel).getAllByLabelText('Name');
      fireEvent.change(names[0]!, { target: { value: 'Small' } });
      fireEvent.change(names[1]!, { target: { value: 'Plain' } });
      for (const radio of within(panel).getAllByLabelText('Children only')) fireEvent.click(radio);
      for (const none of within(panel).getAllByLabelText('Contains none of these'))
        fireEvent.click(none);
      fireEvent.click(within(panel).getByRole('button', { name: 'Add variants' }));

      expect(within(panel).getAllByText('At least one variant must be for Everyone.')).toHaveLength(
        2,
      );
      await waitFor(() => expect(document.activeElement?.id).toBe('vb0-for-children'));
      expect(sent.some((one) => one.line.includes('/variants'))).toBe(false);
    });

    it('adds the first two and says the dish now comes two ways', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [dish('d_asun', 'Asun')])),
        'POST /api/events/ev_1/menu/dishes/d_asun/variants': () =>
          json({ menu: { courses: [course('c_main', 'Main', [TWO])] } }, 201),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Add variant to Asun' }));
      const panel = await screen.findByRole('complementary', { name: 'Add variants to Asun' });
      const names = within(panel).getAllByLabelText('Name');
      fireEvent.change(names[0]!, { target: { value: 'Goat' } });
      fireEvent.change(names[1]!, { target: { value: 'Beef' } });
      for (const none of within(panel).getAllByLabelText('Contains none of these'))
        fireEvent.click(none);
      fireEvent.click(within(panel).getByRole('button', { name: 'Add variants' }));

      expect(await screen.findByText('Asun now comes 2 ways: Goat and Beef.')).toBeDefined();
      expect(
        sent.find((one) => one.line === 'POST /api/events/ev_1/menu/dishes/d_asun/variants')?.body,
      ).toEqual({
        variants: [
          expect.objectContaining({ name: 'Goat', for: 'everyone', containsNone: true }),
          expect.objectContaining({ name: 'Beef', for: 'everyone', containsNone: true }),
        ],
      });
    });

    it('asks first to make a picked dish come two ways, naming who picked it', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(MAIN),
        'POST /api/events/ev_1/menu/dishes/d_jollof/variants': asksFirst(
          { count: 10, course: { id: 'c_main', name: 'Main' }, whom: 'picked' },
          { menu: { courses: [MAIN] } },
        ),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Add variant to Jollof rice' }));
      const panel = await screen.findByRole('complementary', {
        name: 'Add variants to Jollof rice',
      });
      const names = within(panel).getAllByLabelText('Name');
      fireEvent.change(names[0]!, { target: { value: 'Chicken' } });
      fireEvent.change(names[1]!, { target: { value: 'Fish' } });
      for (const none of within(panel).getAllByLabelText('Contains none of these'))
        fireEvent.click(none);
      fireEvent.click(within(panel).getByRole('button', { name: 'Add variants' }));

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Make Jollof rice come 2 ways?',
      });
      expect(
        within(dialog).getByText(
          '10 guests picked this dish. They’ll be asked to pick again for Main.',
        ),
      ).toBeDefined();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change and ask them' }));

      expect(
        await screen.findByText(
          'Jollof rice now comes 2 ways. 10 guests will be asked to pick again.',
        ),
      ).toBeDefined();
      expect(sent.map((one) => one.line)).toContain(
        'POST /api/events/ev_1/menu/dishes/d_jollof/variants?askAgain=1',
      );
    });

    it('asks everyone coming when a variant makes an Everyone gets the same course ask', async () => {
      const SAME = course('c_main', 'Main', [TWO_ONE], { answer: 'same' });
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(SAME),
        'POST /api/events/ev_1/menu/dishes/d_one/variants': asksFirst(
          { count: 48, course: { id: 'c_main', name: 'Main' }, whom: 'everyone' },
          { menu: { courses: [SAME] } },
        ),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Add variant to Coconut rice' }));
      const panel = await screen.findByRole('complementary', {
        name: 'Add a variant to Coconut rice',
      });
      fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Beef' } });
      fireEvent.click(within(panel).getByLabelText('Contains none of these'));
      fireEvent.click(within(panel).getByRole('button', { name: 'Add variant' }));

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Add Beef to Coconut rice?',
      });
      expect(
        within(dialog).getByText('All 48 guests coming will be asked to pick for Main.'),
      ).toBeDefined();
      expect(
        within(dialog).getByText('Only Main is asked. Everything else they answered stays.'),
      ).toBeDefined();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change and ask them' }));
      expect(
        await screen.findByText('Beef added to Coconut rice. 48 guests will be asked to pick.'),
      ).toBeDefined();
    });

    it('reads the dish as its ways, and refuses Remove… on the last Everyone variant under its row', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [WAYS])),
      });

      expect(await screen.findByRole('heading', { name: 'Jollof rice · 3 ways' })).toBeDefined();
      const remove = screen.getByRole('button', { name: 'Remove Chicken…' });
      fireEvent.click(remove);

      expect(
        await screen.findByText(
          'Chicken is the only variant for Everyone. Make another variant for Everyone first.',
        ),
      ).toBeDefined();
      expect(sent.some((one) => one.line.startsWith('DELETE'))).toBe(false);
    });

    it('lights only the variant on Edit variant, never its dish row', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [WAYS])),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Chicken' }));
      await screen.findByRole('complementary', { name: 'Edit Chicken' });

      expect(document.querySelector('.mn-dish.is-lit')).toBeNull();
      expect(document.querySelectorAll('.vr-inset.is-lit')).toHaveLength(1);
    });

    it('asks first to add an allergen to a picked variant', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [WAYS])),
        'PUT /api/events/ev_1/menu/variants/v_chicken': asksFirst(
          {
            count: 2,
            course: { id: 'c_main', name: 'Main' },
            whom: 'allergen',
            allergens: ['milk'],
          },
          { menu: { courses: [course('c_main', 'Main', [WAYS])] } },
        ),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Chicken' }));
      const panel = await screen.findByRole('complementary', { name: 'Edit Chicken' });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save variant' }));

      const dialog = await screen.findByRole('alertdialog', { name: 'Add milk to Jollof rice?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change and ask them' }));
      expect(
        await screen.findByText('Jollof rice saved. 2 guests will be asked to pick again.'),
      ).toBeDefined();
    });

    it('folds the last two into a single dish once asked', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [TWO])),
        'DELETE /api/events/ev_1/menu/variants/v_hen': () =>
          json({ menu: { courses: [course('c_main', 'Main', [dish('d_two', 'Coconut rice')])] } }),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Remove Chicken…' }));
      expect(await screen.findByText('Make this a single dish?')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Make it a single dish' }));

      expect(
        await screen.findByText(
          'Coconut rice is a single dish again, with Fish’s allergens, diets and cost.',
        ),
      ).toBeDefined();
      expect(sent.some((one) => one.line === 'DELETE /api/events/ev_1/menu/variants/v_hen')).toBe(
        true,
      );
    });

    it('closes the fold question when it fails and says so in the status line', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [TWO])),
        'DELETE /api/events/ev_1/menu/variants/v_hen': () => json({ title: 'No' }, 500),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Remove Chicken…' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Make it a single dish' }));

      const line = await screen.findByText(
        'Nothing was changed: Coconut rice still comes 2 ways. Check your connection, then try again.',
      );
      expect(line.closest('[role="status"]')).not.toBeNull();
      expect(screen.queryByText('Make this a single dish?')).toBeNull();
    });

    it('keeps Everyone gets the same on a set course and says guests pick the way', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [TWO], { answer: 'same' })),
      });

      expect(
        await screen.findByText('Everyone gets Coconut rice. Guests pick the way.'),
      ).toBeDefined();
      const same = screen.getByRole('radio', { name: 'Everyone gets the same' });
      expect((same as HTMLInputElement).checked).toBe(true);
    });
  });
  describe('choices inside a dish (sc-3904)', () => {
    const option = (id: string, name: string, allergens: string[], picks = 0) => ({
      id,
      name,
      allergens,
      picks,
    });
    const side = (more: Record<string, unknown> = {}) => ({
      id: 'ch_side',
      question: 'And a side?',
      pick: 1,
      required: true,
      draft: false,
      noneAnswers: 0,
      options: [
        option('o_plantain', 'Plantain', [], 41),
        option('o_salad', 'Garden salad', ['mustard'], 33),
      ],
      ...more,
    });
    const DRAFT = {
      id: 'ch_draft',
      question: '',
      pick: 1,
      required: true,
      draft: true,
      noneAnswers: 0,
      options: [option('o_only', 'Plantain', [])],
    };

    it('adds a finished choice and says so', async () => {
      const added = dish('d_asun', 'Asun', { choices: [side({ options: [] })] });
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [dish('d_asun', 'Asun')])),
        'POST /api/events/ev_1/menu/dishes/d_asun/choices': () =>
          json(
            { menu: { courses: [course('c_main', 'Main', [added])] }, choiceId: 'ch_side' },
            201,
          ),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Add a choice to Asun' }));
      const panel = await screen.findByRole('complementary', { name: 'Add a choice' });
      fireEvent.change(within(panel).getByLabelText('Question guests see'), {
        target: { value: 'And a side?' },
      });
      const names = within(panel).getAllByLabelText('Name');
      fireEvent.change(names[0]!, { target: { value: 'Plantain' } });
      fireEvent.change(names[1]!, { target: { value: 'Garden salad' } });
      for (const set of within(panel).getAllByRole('button', { name: 'Set allergens' })) {
        fireEvent.click(set);
        fireEvent.click(within(panel).getByLabelText('Contains none of these'));
      }
      fireEvent.click(within(panel).getByRole('button', { name: 'Add choice' }));

      expect(await screen.findByText('“And a side?” added to Asun.')).toBeDefined();
      expect(
        sent.find((one) => one.line === 'POST /api/events/ev_1/menu/dishes/d_asun/choices')?.body,
      ).toEqual({
        question: 'And a side?',
        options: [
          { name: 'Plantain', allergens: [], containsNone: true },
          { name: 'Garden salad', allergens: [], containsNone: true },
        ],
        pick: 1,
        required: true,
      });
    });

    it('offers to save an unfinished choice as a draft, saying what it lacks', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [dish('d_asun', 'Asun')])),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Add a choice to Asun' }));
      const panel = await screen.findByRole('complementary', { name: 'Add a choice' });

      expect(within(panel).getByText('Add the question guests see.')).toBeDefined();
      expect(within(panel).getByText('Add at least 2 options.')).toBeDefined();
      expect(within(panel).getByRole('button', { name: 'Save as a draft' })).toBeDefined();
    });

    it('marks a dish its draft hides, and a course of only such dishes as not shown', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(
          course('c_main', 'Main', [dish('d_asun', 'Asun', { choices: [DRAFT], offered: false })]),
        ),
      });

      expect(await screen.findByText('Not offered to guests')).toBeDefined();
      expect(screen.getByText('No finished dish · not shown to guests')).toBeDefined();
      expect(screen.getByText('Choice 1, no question yet')).toBeDefined();
      expect(
        screen.getByRole('button', { name: 'Finish Choice 1, no question yet' }),
      ).toBeDefined();
    });

    const ANSWERED = course('c_main', 'Main', [dish('d_asun', 'Asun', { choices: [side()] })]);
    const asksMain = (count: number, whom = 'picked') => ({
      count,
      course: { id: 'c_main', name: 'Main' },
      whom,
    });

    async function editSide() {
      fireEvent.click(await screen.findByRole('button', { name: 'Edit “And a side?”' }));
      return screen.findByRole('complementary', { name: 'Edit “And a side?”' });
    }

    async function confirmed(title: string, count: string, done: string) {
      const dialog = await screen.findByRole('alertdialog', { name: title });
      expect(within(dialog).getByText(count)).toBeDefined();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change and ask them' }));
      expect(await screen.findByText(done)).toBeDefined();
    }

    it('shows kitchen prep, and asks first to remove a choice guests have answered', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(ANSWERED),
        'DELETE /api/events/ev_1/menu/choices/ch_side': asksFirst(asksMain(74), {
          menu: { courses: [course('c_main', 'Main', [dish('d_asun', 'Asun')])] },
        }),
      });

      expect(await screen.findByText('Kitchen prep: 41 plantain, 33 garden salad')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Remove “And a side?”…' }));
      expect(screen.queryByText('Guests have answered this choice.')).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'Remove choice' }));

      await confirmed(
        'Remove “And a side?” from Asun?',
        '74 guests answered this choice. They’ll be asked to pick again for Main.',
        '“And a side?” removed from Asun. 74 guests will be asked to pick again.',
      );
      expect(sent.map((one) => one.line)).toContain(
        'DELETE /api/events/ev_1/menu/choices/ch_side?askAgain=1',
      );
    });

    it('asks first to add a choice to a dish guests picked', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(ANSWERED),
        'POST /api/events/ev_1/menu/dishes/d_asun/choices': asksFirst(asksMain(74), {
          menu: { courses: [ANSWERED] },
          choiceId: 'ch_sauce',
        }),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Add a choice to Asun' }));
      const panel = await screen.findByRole('complementary', { name: 'Add a choice' });
      fireEvent.change(within(panel).getByLabelText('Question guests see'), {
        target: { value: 'And a sauce?' },
      });
      const names = within(panel).getAllByLabelText('Name');
      fireEvent.change(names[0]!, { target: { value: 'Pepper' } });
      fireEvent.change(names[1]!, { target: { value: 'Stew' } });
      for (const set of within(panel).getAllByRole('button', { name: 'Set allergens' })) {
        fireEvent.click(set);
        fireEvent.click(within(panel).getByLabelText('Contains none of these'));
      }
      fireEvent.click(within(panel).getByRole('button', { name: 'Add choice' }));

      await confirmed(
        'Add “And a sauce?” to Asun?',
        '74 guests picked this dish. They’ll be asked to pick again for Main.',
        '“And a sauce?” added to Asun. 74 guests will be asked to pick again.',
      );
      expect(sent.map((one) => one.line)).toContain(
        'POST /api/events/ev_1/menu/dishes/d_asun/choices?askAgain=1',
      );
    });

    it('asks first to change how many guests pick on an answered choice', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(ANSWERED),
        'PUT /api/events/ev_1/menu/choices/ch_side': asksFirst(asksMain(74), {
          menu: { courses: [ANSWERED] },
          choiceId: 'ch_side',
        }),
      });

      const panel = await editSide();
      fireEvent.click(within(panel).getByRole('button', { name: 'One more' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Save choice' }));

      await confirmed(
        'Let guests pick 2 options in “And a side?”?',
        '74 guests answered this choice. They’ll be asked to pick again for Main.',
        '“And a side?” saved. 74 guests will be asked to pick again.',
      );
    });

    it('asks first to make an answered choice required, counting None for me', async () => {
      const optional = course('c_main', 'Main', [
        dish('d_asun', 'Asun', { choices: [side({ required: false, noneAnswers: 4 })] }),
      ]);
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(optional),
        'PUT /api/events/ev_1/menu/choices/ch_side': asksFirst(asksMain(4), {
          menu: { courses: [optional] },
          choiceId: 'ch_side',
        }),
      });

      const panel = await editSide();
      fireEvent.click(within(panel).getByLabelText('Required'));
      fireEvent.click(within(panel).getByRole('button', { name: 'Save choice' }));

      await confirmed(
        'Make “And a side?” required?',
        '4 guests answered None for me. They’ll be asked to pick again for Main.',
        '“And a side?” saved. 4 guests will be asked to pick again.',
      );
    });

    it('asks first to remove an option guests picked', async () => {
      const three = course('c_main', 'Main', [
        dish('d_asun', 'Asun', {
          choices: [
            side({
              options: [
                option('o_plantain', 'Plantain', [], 41),
                option('o_salad', 'Garden salad', ['mustard'], 33),
                option('o_moimoi', 'Moi moi', ['eggs'], 12),
              ],
            }),
          ],
        }),
      ]);
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(three),
        'PUT /api/events/ev_1/menu/choices/ch_side': asksFirst(asksMain(12), {
          menu: { courses: [three] },
          choiceId: 'ch_side',
        }),
      });

      const panel = await editSide();
      fireEvent.click(within(panel).getByRole('button', { name: 'Remove Moi moi' }));
      expect(within(panel).getAllByLabelText('Name')).toHaveLength(2);
      fireEvent.click(within(panel).getByRole('button', { name: 'Save choice' }));

      await confirmed(
        'Remove Moi moi from “And a side?”?',
        '12 guests picked this option. They’ll be asked to pick again for Main.',
        '“And a side?” saved. 12 guests will be asked to pick again.',
      );
      expect(sent.map((one) => one.line)).toContain(
        'PUT /api/events/ev_1/menu/choices/ch_side?askAgain=1',
      );
    });

    it('asks first to add an allergen to an option guests picked', async () => {
      const asun = course('c_main', 'Main', [dish('d_asun', 'Asun', { choices: [side()] })]);
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(asun),
        'PUT /api/events/ev_1/menu/choices/ch_side': asksFirst(
          {
            count: 2,
            course: { id: 'c_main', name: 'Main' },
            whom: 'allergen',
            allergens: ['celery'],
          },
          { menu: { courses: [asun] }, choiceId: 'ch_side' },
        ),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit “And a side?”' }));
      const panel = await screen.findByRole('complementary', { name: 'Edit “And a side?”' });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save choice' }));

      const dialog = await screen.findByRole('alertdialog', { name: 'Add celery to Asun?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change and ask them' }));
      expect(
        await screen.findByText('Asun saved. 2 guests will be asked to pick again.'),
      ).toBeDefined();
    });
  });

  describe('a dish’s items and Served with this course (sc-34230)', () => {
    const SIDE = {
      id: 'ch_side',
      question: 'And a side?',
      pick: 1,
      required: true,
      draft: false,
      noneAnswers: 0,
      options: [{ id: 'o_plantain', name: 'Plantain', allergens: [], picks: 0 }],
    };
    const fixedItem = (name: string) => ({ kind: 'fixed', name });
    const WITH_ITEMS = dish('d_jollof', 'Jollof rice', {
      choices: [SIDE],
      items: [fixedItem('Rice'), fixedItem('Chicken'), { kind: 'choice', choiceId: 'ch_side' }],
    });
    const PLAIN = dish('d_jollof', 'Jollof rice', { choices: [SIDE] });
    const saved =
      (dishes: unknown[], more: Record<string, unknown> = {}) =>
      () =>
        json({ menu: { courses: [course('c_main', 'Main', dishes, more)] }, dishId: 'd_jollof' });

    async function editJollof() {
      fireEvent.click(await screen.findByRole('button', { name: 'Edit Jollof rice' }));
      return screen.findByRole('complementary', { name: 'Edit dish' });
    }

    it('shows a dish’s items as numbered chips, and nothing new for a dish with none', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(
          course('c_main', 'Main', [WITH_ITEMS, dish('d_asun', 'Asun')], {
            ownItems: ['Bread roll'],
          }),
        ),
      });

      const chips = await screen.findByRole('list', { name: 'Items · Jollof rice' });
      expect(
        within(chips)
          .getAllByRole('listitem')
          .map((one) => one.textContent),
      ).toEqual(['Rice', 'Chicken', 'And a side?']);
      expect(screen.queryByRole('list', { name: 'Items · Asun' })).toBeNull();
      expect(screen.getByText('Served with this course')).toBeDefined();
      expect(screen.getByText('Bread roll')).toBeDefined();
    });

    it('adds fixed items and a choice, and saves them in order', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [PLAIN])),
        'PUT /api/events/ev_1/menu/dishes/d_jollof': saved([WITH_ITEMS]),
      });

      const panel = await editJollof();
      expect(within(panel).getByText(/Items add nothing to Contains\./)).toBeDefined();
      fireEvent.click(within(panel).getByRole('button', { name: 'Add an item' }));
      fireEvent.change(within(panel).getByLabelText('Item 1'), { target: { value: ' Rice ' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Add an item' }));
      fireEvent.change(within(panel).getByLabelText('Item 2'), { target: { value: 'Chicken' } });
      fireEvent.click(within(panel).getByRole('button', { name: /And a side\?/ }));
      expect(within(panel).queryByText('Or add one from this dish')).toBeNull();
      fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Jollof rice saved.')).toBeDefined();
      expect(
        sent.find((one) => one.line === 'PUT /api/events/ev_1/menu/dishes/d_jollof')?.body,
      ).toEqual(
        expect.objectContaining({
          items: [
            { kind: 'fixed', name: 'Rice' },
            { kind: 'fixed', name: 'Chicken' },
            { kind: 'choice', choiceId: 'ch_side' },
          ],
        }),
      );
    });

    it('refuses a single item on Save beside the list, and sends nothing', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [PLAIN])),
      });

      const panel = await editJollof();
      fireEvent.click(within(panel).getByRole('button', { name: 'Add an item' }));
      fireEvent.change(within(panel).getByLabelText('Item 1'), { target: { value: 'Rice' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

      expect(await within(panel).findByText('List 2 items or more, or none.')).toBeDefined();
      expect(document.activeElement?.id).toBe('mc-add-item');
      expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);
    });

    it('refuses the later of two same names, a blank and one over 40 beside each row', async () => {
      await onMenu({ 'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [PLAIN])) });

      const panel = await editJollof();
      for (const name of ['Rice', ' rice ', '', 'x'.repeat(41)]) {
        fireEvent.click(within(panel).getByRole('button', { name: 'Add an item' }));
        const rows = within(panel).getAllByLabelText(/^Item \d$/);
        fireEvent.change(rows[rows.length - 1] as HTMLElement, { target: { value: name } });
      }
      fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

      expect(await within(panel).findByText('Each item needs its own name.')).toBeDefined();
      expect(within(panel).getByText('Give each item a name.')).toBeDefined();
      expect(within(panel).getByText('An item’s name can be at most 40 characters.')).toBeDefined();
      expect(document.activeElement).toBe(within(panel).getByLabelText('Item 2'));
    });

    it('refuses a 7th item beside Add and adds nothing', async () => {
      const six = dish('d_jollof', 'Jollof rice', {
        items: ['A', 'B', 'C', 'D', 'E', 'F'].map(fixedItem),
      });
      await onMenu({ 'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [six])) });

      const panel = await editJollof();
      fireEvent.click(within(panel).getByRole('button', { name: 'Add an item' }));

      expect(within(panel).getByText('A dish can have at most 6 items.')).toBeDefined();
      expect(within(panel).getAllByLabelText(/^Item \d$/)).toHaveLength(6);
    });

    it('moves an item and says where it went, with the first Move up greyed', async () => {
      await onMenu({ 'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [WITH_ITEMS])) });

      const panel = await editJollof();
      expect(
        within(panel).getByRole('button', { name: 'Move Rice up' }).getAttribute('aria-disabled'),
      ).toBe('true');
      fireEvent.click(within(panel).getByRole('button', { name: 'Move Chicken up' }));

      expect(within(panel).getByText('Chicken moved to item 1 of 3')).toBeDefined();
      expect((within(panel).getByLabelText('Item 1') as HTMLInputElement).value).toBe('Chicken');
    });

    it('offers the variants by their names as an or list', async () => {
      const ways = dish('d_jollof', 'Grilled fish', {
        variants: [
          { id: 'v_c', name: 'Croaker', for: 'everyone', allergens: [], diets: [], picked: false },
          { id: 'v_t', name: 'Tilapia', for: 'everyone', allergens: [], diets: [], picked: false },
        ],
      });
      await onMenu({ 'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [ways])) });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Grilled fish' }));
      const panel = await screen.findByRole('complementary', { name: 'Edit dish' });
      expect(within(panel).getByText(/These items are the same for every variant\./)).toBeDefined();
      expect(within(panel).getByRole('button', { name: /Croaker or Tilapia/ })).toBeDefined();
    });

    it('does not offer a choice with no question, and names an item whose choice lost it', async () => {
      const draft = { ...SIDE, id: 'ch_draft', question: '', draft: true };
      const kept = dish('d_jollof', 'Jollof rice', {
        choices: [draft],
        items: [fixedItem('Rice'), { kind: 'choice', choiceId: 'ch_draft' }],
      });
      await onMenu({ 'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [kept])) });

      const chips = await screen.findByRole('list', { name: 'Items · Jollof rice' });
      expect(within(chips).getByText(/Choice 1, no question yet/)).toBeDefined();
      const panel = await editJollof();
      expect(within(panel).queryByText('Or add one from this dish')).toBeNull();
    });

    it('asks to remove a choice that is an item with the added line', async () => {
      await onMenu({ 'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [WITH_ITEMS])) });

      fireEvent.click(await screen.findByRole('button', { name: 'Remove “And a side?”…' }));

      expect(
        await screen.findByText(
          'Remove “And a side?” from Jollof rice? “And a side?” is also one of Jollof rice’s items.',
        ),
      ).toBeDefined();
    });

    it.each([
      [[{ kind: 'variants' }, fixedItem('Rice')], true],
      [[], false],
    ] as const)(
      'asks to fold the variants with the added line only when they are an item',
      async (items, added) => {
        const two = dish('d_two', 'Coconut rice', {
          variants: [
            {
              id: 'v_fish',
              name: 'Fish',
              for: 'everyone',
              allergens: [],
              diets: [],
              picked: false,
            },
            {
              id: 'v_hen',
              name: 'Chicken',
              for: 'everyone',
              allergens: [],
              diets: [],
              picked: false,
            },
          ],
          items: [...items],
        });
        await onMenu({ 'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [two])) });

        fireEvent.click(await screen.findByRole('button', { name: 'Remove Chicken…' }));
        expect(await screen.findByText('Make this a single dish?')).toBeDefined();

        expect(
          screen.queryByText('The variants are also one of Coconut rice’s items.') != null,
        ).toBe(added);
      },
    );

    it('saves Served with this course on Edit course, and refuses a 4th beside Add', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(course('c_main', 'Main', [PLAIN])),
        'PUT /api/events/ev_1/menu/courses/c_main': () =>
          json({ menu: { courses: [course('c_main', 'Main', [PLAIN])] }, courseId: 'c_main' }),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Main' }));
      const panel = await screen.findByRole('complementary', { name: 'Edit course' });
      for (const name of ['Bread roll', 'Water', 'Side salad']) {
        fireEvent.click(within(panel).getByRole('button', { name: 'Add a course item' }));
        const rows = within(panel).getAllByLabelText(/^Course item \d$/);
        fireEvent.change(rows[rows.length - 1] as HTMLElement, { target: { value: name } });
      }
      fireEvent.click(within(panel).getByRole('button', { name: 'Add a course item' }));
      expect(
        within(panel).getByText('A course can have at most 3 items of its own.'),
      ).toBeDefined();
      fireEvent.click(within(panel).getByRole('button', { name: 'Move Water up' }));
      expect(within(panel).getByText('Water moved to item 1 of 3')).toBeDefined();
      fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Main saved.')).toBeDefined();
      expect(
        sent.find((one) => one.line === 'PUT /api/events/ev_1/menu/courses/c_main')?.body,
      ).toEqual(expect.objectContaining({ ownItems: ['Water', 'Bread roll', 'Side salad'] }));
    });

    it('reads only without menu.manage: the items as text and no item controls', async () => {
      await onMenu(
        {
          'GET /api/events/ev_1/menu': menuOf(
            course('c_main', 'Main', [WITH_ITEMS], { ownItems: ['Bread roll'] }),
          ),
        },
        OWNER_PERMISSIONS.filter((one) => one !== 'menu.manage'),
      );

      expect(await screen.findByRole('list', { name: 'Items · Jollof rice' })).toBeDefined();
      expect(screen.getByText('Bread roll')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Edit Jollof rice' })).toBeNull();
    });
  });

  describe('a course’s default and choose-by date (sc-1362)', () => {
    const open = { at: '2030-11-15T18:00:00+01:00', source: 'start', closed: false };
    const STEW = dish('d_stew', 'Rice and stew', {
      variants: [
        { id: 'v_plate', name: 'Plate', for: 'everyone', allergens: [], diets: [], picked: false },
        {
          id: 'v_kids',
          name: 'Kids plate',
          for: 'children',
          allergens: [],
          diets: [],
          picked: false,
        },
      ],
    });
    const ASKING = course('c_main', 'Main', [JOLLOF, STEW], { picksClose: open });
    const GIVEN = {
      ...ASKING,
      picksClose: { at: '2030-11-10T23:59:59+01:00', source: 'chooseBy', closed: false },
      default: { dish: 'd_jollof', variant: null, options: [], chooseBy: '2030-11-10' },
    };

    it('refuses only one of the pair beside its field, and sends nothing', async () => {
      const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(ASKING) });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Main' }));
      const panel = await screen.findByRole('complementary', { name: 'Edit course' });
      fireEvent.click(within(panel).getByRole('radio', { name: 'Jollof rice' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

      expect(
        within(panel).getByText('Enter a choose-by date, or set the default to No default.'),
      ).toBeDefined();
      expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);
    });

    it('offers only a dish’s Everyone variants, and saves the whole pick with its date', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(ASKING),
        'PUT /api/events/ev_1/menu/courses/c_main': () =>
          json({ menu: { courses: [ASKING] }, courseId: 'c_main' }),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Main' }));
      const panel = await screen.findByRole('complementary', { name: 'Edit course' });
      fireEvent.click(within(panel).getByRole('radio', { name: 'Rice and stew' }));
      expect(within(panel).queryByRole('radio', { name: 'Kids plate' })).toBeNull();
      expect(within(panel).getByRole('radio', { name: 'Plate' })).toHaveProperty('checked', true);
      fireEvent.change(within(panel).getByLabelText('Choose by'), {
        target: { value: '2030-11-10' },
      });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Main saved.')).toBeDefined();
      expect(
        sent.find((one) => one.line === 'PUT /api/events/ev_1/menu/courses/c_main')?.body,
      ).toEqual(
        expect.objectContaining({
          default: { dish: 'd_stew', variant: 'v_plate', options: [], chooseBy: '2030-11-10' },
        }),
      );
    });

    it('names the default on the course card, and where its close comes from', async () => {
      await onMenu({ 'GET /api/events/ev_1/menu': menuOf(GIVEN) });

      const card = await screen.findByRole('listitem', { name: 'Main' });
      expect(card.textContent).toContain(
        'Set by Main’s own choose-by date. Closes at 23:59, Lagos time.',
      );
      expect(card.textContent).toContain(
        'Default: Jollof rice. Given on Sunday, Nov 10 to anyone coming who hasn’t answered.',
      );
    });

    it('refuses Remove… on the default dish at once, saying to choose another default first', async () => {
      const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(GIVEN) });

      fireEvent.click(await screen.findByRole('button', { name: 'Remove Jollof rice…' }));
      expect(screen.queryByText('Guests have picked this dish.')).toBeNull();

      expect(
        await screen.findByText(
          'Jollof rice is Main’s default. Choose another default first, in Edit course.',
        ),
      ).toBeDefined();
      expect(sent.some((one) => one.line.startsWith('DELETE'))).toBe(false);
    });

    describe('an edit that would leave the default unfinished (Decided, 23 Nov)', () => {
      const option = (id: string, name: string) => ({ id, name, allergens: [], picks: 0 });
      const HEAT = {
        id: 'ch_heat',
        question: 'How hot?',
        pick: 1,
        required: true,
        draft: false,
        noneAnswers: 0,
        options: [option('o_mild', 'Mild'), option('o_hot', 'Hot'), option('o_very', 'Very hot')],
      };
      const SIDE = {
        ...HEAT,
        id: 'ch_side',
        question: 'And a side?',
        required: false,
        options: [option('o_plantain', 'Plantain'), option('o_salad', 'Salad')],
      };
      const OFADA = dish('d_ofada', 'Ofada rice', { choices: [HEAT, SIDE] });
      const SET = course('c_main', 'Main', [OFADA, STEW], {
        picksClose: { at: '2030-11-10T23:59:59+01:00', source: 'chooseBy', closed: false },
        default: { dish: 'd_ofada', variant: null, options: ['o_mild'], chooseBy: '2030-11-10' },
      });
      const LINE = 'Ofada rice is Main’s default. Choose another default first, in Edit course.';
      const nothingSent = (sent: { line: string }[]) =>
        expect(sent.some((one) => one.line.startsWith('PUT') || one.line.startsWith('POST'))).toBe(
          false,
        );

      it('refuses the bin on a default option in Edit choice, in its status line', async () => {
        await onMenu({ 'GET /api/events/ev_1/menu': menuOf(SET) });

        fireEvent.click(await screen.findByRole('button', { name: 'Edit “How hot?”' }));
        const panel = await screen.findByRole('complementary', { name: 'Edit “How hot?”' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Remove Mild' }));

        expect(
          within(panel).getByText(
            'Mild is part of Main’s default. Choose another default first, in Edit course.',
          ),
        ).toBeDefined();
        expect(within(panel).getAllByLabelText('Name')).toHaveLength(3);
      });

      it('refuses Required turned on beside Required, and sends nothing', async () => {
        const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(SET) });

        fireEvent.click(await screen.findByRole('button', { name: 'Edit “And a side?”' }));
        const panel = await screen.findByRole('complementary', { name: 'Edit “And a side?”' });
        fireEvent.click(within(panel).getByLabelText('Required'));
        fireEvent.click(within(panel).getByRole('button', { name: 'Save choice' }));

        expect(within(panel).getByText(LINE).id).toBe('ch-required-error');
        await waitFor(() => expect(document.activeElement?.id).toBe('ch-required'));
        nothingSent(sent);
      });

      it('refuses a new Guests pick exactly on a required choice beside the stepper', async () => {
        const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(SET) });

        fireEvent.click(await screen.findByRole('button', { name: 'Edit “How hot?”' }));
        const panel = await screen.findByRole('complementary', { name: 'Edit “How hot?”' });
        fireEvent.click(within(panel).getByRole('button', { name: 'One more' }));
        fireEvent.click(within(panel).getByRole('button', { name: 'Save choice' }));

        expect(within(panel).getByText(LINE).closest('#ch-pick-error')).not.toBeNull();
        nothingSent(sent);
      });

      it('refuses a choice saved as a draft in its status, and a required choice added', async () => {
        const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(SET) });

        fireEvent.click(await screen.findByRole('button', { name: 'Add a choice to Ofada rice' }));
        let panel = await screen.findByRole('complementary', { name: 'Add a choice' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Save as a draft' }));
        expect(within(panel).getByText(LINE).closest('#ch-stays')).not.toBeNull();

        fireEvent.change(within(panel).getByLabelText('Question guests see'), {
          target: { value: 'A drink?' },
        });
        const names = within(panel).getAllByLabelText('Name');
        fireEvent.change(names[0]!, { target: { value: 'Water' } });
        fireEvent.change(names[1]!, { target: { value: 'Zobo' } });
        for (const set of within(panel).getAllByRole('button', { name: 'Set allergens' })) {
          fireEvent.click(set);
          fireEvent.click(within(panel).getByLabelText('Contains none of these'));
        }
        fireEvent.click(within(panel).getByRole('button', { name: 'Add choice' }));
        panel = screen.getByRole('complementary', { name: 'Add a choice' });
        expect(within(panel).getByText(LINE).id).toBe('ch-required-error');
        nothingSent(sent);
      });

      it('saves a finished optional choice on the default as usual', async () => {
        const sent = await onMenu({
          'GET /api/events/ev_1/menu': menuOf(SET),
          'POST /api/events/ev_1/menu/dishes/d_ofada/choices': () =>
            json({ menu: { courses: [SET] }, choiceId: 'ch_new' }, 201),
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Add a choice to Ofada rice' }));
        const panel = await screen.findByRole('complementary', { name: 'Add a choice' });
        fireEvent.change(within(panel).getByLabelText('Question guests see'), {
          target: { value: 'A drink?' },
        });
        const names = within(panel).getAllByLabelText('Name');
        fireEvent.change(names[0]!, { target: { value: 'Water' } });
        fireEvent.change(names[1]!, { target: { value: 'Zobo' } });
        for (const set of within(panel).getAllByRole('button', { name: 'Set allergens' })) {
          fireEvent.click(set);
          fireEvent.click(within(panel).getByLabelText('Contains none of these'));
        }
        fireEvent.click(within(panel).getByLabelText('Required'));
        fireEvent.click(within(panel).getByRole('button', { name: 'Add choice' }));

        expect(await screen.findByText('“A drink?” added to Ofada rice.')).toBeDefined();
        expect(
          sent.find((one) => one.line === 'POST /api/events/ev_1/menu/dishes/d_ofada/choices')
            ?.body,
        ).toEqual(expect.objectContaining({ required: false }));
      });

      it('refuses Add variant on a default dish with none under its row, opening nothing', async () => {
        const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(SET) });

        fireEvent.click(await screen.findByRole('button', { name: 'Add variant to Ofada rice' }));

        expect(await screen.findByText(LINE)).toBeDefined();
        expect(
          screen.queryByRole('complementary', { name: 'Add variants to Ofada rice' }),
        ).toBeNull();
        nothingSent(sent);
      });

      it('refuses the default variant’s For turned to Children only beside For', async () => {
        const party = {
          id: 'v_party',
          name: 'Party plate',
          for: 'everyone',
          allergens: [],
          diets: [],
          picked: false,
        };
        const stewed = {
          ...SET,
          dishes: [OFADA, { ...STEW, variants: [...(STEW.variants as unknown[]), party] }],
          default: { dish: 'd_stew', variant: 'v_plate', options: [], chooseBy: '2030-11-10' },
        };
        const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(stewed) });

        fireEvent.click(await screen.findByRole('button', { name: 'Edit Plate' }));
        const panel = await screen.findByRole('complementary', { name: 'Edit Plate' });
        fireEvent.click(within(panel).getByLabelText('Children only'));
        fireEvent.click(within(panel).getByRole('button', { name: 'Save variant' }));

        expect(
          within(panel).getByText(
            'Rice and stew is Main’s default. Choose another default first, in Edit course.',
          ).id,
        ).toBe('vb0-for-error');
        await waitFor(() => expect(document.activeElement?.id).toBe('vb0-for-children'));
        nothingSent(sent);
      });
    });

    it('asks before moving the people given the default after the date, and moves them once confirmed', async () => {
      const closed = {
        ...GIVEN,
        picksClose: { ...GIVEN.picksClose, closed: true },
      };
      let asked = 0;
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(closed),
        'PUT /api/events/ev_1/menu/courses/c_main': (body) => {
          if ((body as { confirmMove?: boolean }).confirmMove !== true) {
            asked += 1;

            return new Response(
              JSON.stringify({
                type: 'https://soirely.com/errors/menu_default_move',
                title: 'menu_default_move',
                status: 409,
                move: 21,
                back: 2,
              }),
              { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
            );
          }

          return json({ menu: { courses: [closed] }, courseId: 'c_main' });
        },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Main' }));
      const panel = await screen.findByRole('complementary', { name: 'Edit course' });
      expect(within(panel).queryByRole('radio', { name: 'No default' })).toBeNull();
      expect(
        within(panel).getByText('Sunday, Nov 10 has passed, so the date is locked.'),
      ).toBeDefined();
      fireEvent.click(within(panel).getByRole('radio', { name: 'Rice and stew' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Move 21 guests to Rice and stew, Plate?',
      });
      expect(dialog.textContent).toContain('2 go back to not chosen');
      expect(document.activeElement?.textContent).toBe('Cancel');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Move 21 guests' }));

      expect(
        await screen.findByText(
          '21 guests moved to Rice and stew, Plate. 2 are back to not chosen.',
        ),
      ).toBeDefined();
      expect(asked).toBe(1);
      expect(
        sent.filter((one) => one.line === 'PUT /api/events/ev_1/menu/courses/c_main').at(-1)?.body,
      ).toEqual(expect.objectContaining({ confirmMove: true }));
    });
  });
});
