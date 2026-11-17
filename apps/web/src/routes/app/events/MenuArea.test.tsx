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

function problem(code: string, status: number): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type Answer = (body: unknown) => Response | Promise<Response>;

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
    ...more,
  };
}

function course(id: string, name: string, dishes: unknown[], more: Record<string, unknown> = {}) {
  return { id, name, servedAt: null, answer: 'choose', skippable: false, dishes, ...more };
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
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
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
    expect(screen.getByText('2 of 3 ready').closest('a')?.getAttribute('href')).toBe(
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

  it('refuses at once to remove a dish guests have picked, and asks first for one they have not', async () => {
    const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(MAIN) });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Jollof rice…' }));
    expect(screen.getByText('Guests have picked this dish.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('DELETE'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Asun…' }));
    expect(
      screen.getByText('Remove Asun from Main? It is only on this event, so it goes for good.'),
    ).toBeDefined();
    expect(screen.queryByText('Guests have picked this dish.')).toBeNull();
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
      'GET /api/orgs/org_1/dishes': (body) => (tries.shift() ?? tries[0]!)(body),
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

  it('saves an allergen added to a picked dish with the line counting who has it recorded', async () => {
    const sent = await onMenu({
      'GET /api/events/ev_1/menu': menuOf(MAIN),
      'PUT /api/events/ev_1/menu/dishes/d_jollof': () =>
        json({
          menu: { courses: [MAIN] },
          dishId: 'd_jollof',
          unwarned: { count: 4, allergens: ['sesame', 'peanuts'] },
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Jollof rice' }));
    const panel = await screen.findByRole('complementary', { name: 'Edit dish' });
    fireEvent.click(within(panel).getByLabelText('Sesame'));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Jollof rice saved.')).toBeDefined();
    expect(
      screen.getByText(
        '4 guests who picked Jollof rice have Peanuts and Sesame recorded, and nobody has told them.',
      ),
    ).toBeDefined();
    expect(
      sent.find((one) => one.line === 'PUT /api/events/ev_1/menu/dishes/d_jollof')?.body,
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

    it('opens nothing on a picked dish without variants and says why under the row', async () => {
      const sent = await onMenu({ 'GET /api/events/ev_1/menu': menuOf(MAIN) });

      fireEvent.click(await screen.findByRole('button', { name: 'Add variant to Jollof rice' }));

      expect(await screen.findByText('Guests have picked this dish.')).toBeDefined();
      expect(
        screen.queryByRole('complementary', { name: 'Add variants to Jollof rice' }),
      ).toBeNull();
      expect(sent.some((one) => one.line.includes('/variants'))).toBe(false);
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

    it('shows kitchen prep, and refuses Remove… and a new choice once guests have answered', async () => {
      const sent = await onMenu({
        'GET /api/events/ev_1/menu': menuOf(
          course('c_main', 'Main', [dish('d_asun', 'Asun', { choices: [side()] })]),
        ),
      });

      expect(await screen.findByText('Kitchen prep: 41 plantain, 33 garden salad')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Remove “And a side?”…' }));
      expect(await screen.findByText('Guests have answered this choice.')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Add a choice to Asun' }));
      expect(await screen.findByText('Guests have picked this dish.')).toBeDefined();
      expect(sent.some((one) => one.line.startsWith('DELETE'))).toBe(false);
      expect(sent.some((one) => one.line.includes('/choices'))).toBe(false);
    });

    it('names who picked an option whose allergens were just added', async () => {
      await onMenu({
        'GET /api/events/ev_1/menu': menuOf(
          course('c_main', 'Main', [dish('d_asun', 'Asun', { choices: [side()] })]),
        ),
        'PUT /api/events/ev_1/menu/choices/ch_side': () =>
          json({
            menu: {
              courses: [course('c_main', 'Main', [dish('d_asun', 'Asun', { choices: [side()] })])],
            },
            choiceId: 'ch_side',
            unwarnedOptions: [
              { optionId: 'o_salad', option: 'Garden salad', count: 2, allergens: ['celery'] },
            ],
          }),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Edit “And a side?”' }));
      const panel = await screen.findByRole('complementary', { name: 'Edit “And a side?”' });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save choice' }));

      expect(await screen.findByText('“And a side?” saved.')).toBeDefined();
      expect(
        screen.getByText(
          '2 guests who picked Garden salad have celery recorded, and nobody has told them.',
        ),
      ).toBeDefined();
    });
  });
});
