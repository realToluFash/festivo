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
): Promise<{ line: string; body: unknown }[]> {
  const sent: { line: string; body: unknown }[] = [];
  signedIn();

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });
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
    expect(
      within(cards[1] as HTMLElement).getAllByText('Contains: Celery', { selector: 'p' }),
    ).toHaveLength(2);
    expect(within(cards[1] as HTMLElement).getByText('Halal')).toBeDefined();
  });

  it('has no ready line once every course has a dish', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN) });

    expect(await screen.findByText('2 courses · 3 dishes')).toBeDefined();
    expect(screen.queryByText(/courses ready/)).toBeNull();
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

  it('offers Everyone gets the same only with exactly one dish', async () => {
    await onMenu({ 'GET /api/events/ev_1/menu': menuOf(STARTER, MAIN) });

    const radios = await screen.findAllByRole('radio', { name: 'Everyone gets the same' });
    expect(radios[0]?.getAttribute('aria-disabled')).toBeNull();
    expect(radios[1]?.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByText('Everyone gets the same needs exactly one dish.')).toHaveLength(1);
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

  it('answers a member without menu.read as a page that does not exist', async () => {
    const sent = await onMenu({}, ['events.read']);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page does not exist' }),
    ).toBeDefined();
    expect(sent.some((one) => one.line === 'GET /api/events/ev_1/menu')).toBe(false);
  });
});
