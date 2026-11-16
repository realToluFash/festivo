import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events', currency: 'NGN' });

const DISHES = [
  {
    id: 'd_jollof',
    name: 'Jollof rice',
    description: 'Long-grain rice in a tomato and pepper base.',
    allergens: ['celery'],
    diets: ['vegetarian', 'vegan'],
    usedByEvent: true,
    archivedAt: null,
    lastPrice: { amount: '4500.00', currency: 'NGN' },
  },
  {
    id: 'd_chin',
    name: 'Chin chin',
    description: null,
    allergens: ['gluten', 'eggs', 'milk'],
    diets: [],
    usedByEvent: false,
    archivedAt: null,
    lastPrice: null,
  },
  {
    id: 'd_asun',
    name: 'Asun',
    description: null,
    allergens: null,
    diets: [],
    usedByEvent: false,
    archivedAt: null,
    lastPrice: null,
  },
  {
    id: 'd_zobo',
    name: 'Zobo sorbet',
    description: null,
    allergens: [],
    diets: [],
    usedByEvent: false,
    archivedAt: null,
    lastPrice: null,
  },
  {
    id: 'd_puff',
    name: 'Puff puff',
    description: null,
    allergens: ['gluten', 'milk'],
    diets: ['vegetarian'],
    usedByEvent: true,
    archivedAt: '2026-11-01T10:00:00+00:00',
    lastPrice: null,
  },
];

interface Sent {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

function signedIn(): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u1',
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

function answering(
  library: { status?: number; canManage?: boolean; seesPrices?: boolean } = {},
  answer: (sent: Sent) => Response | null = () => null,
): Sent[] {
  const sent: Sent[] = [];
  const prices = library.seesPrices ?? true;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;

    if (!url.pathname.startsWith('/api/orgs/org_1/dishes'))
      return new Response(JSON.stringify({ events: [], total: 0 }), { status: 200 });

    const one: Sent = { method, path: url.pathname, body };
    sent.push(one);
    const answered = answer(one);
    if (answered != null) return answered;

    if (method === 'GET') {
      if (library.status != null)
        return new Response(
          JSON.stringify({ type: 'permission_required', status: library.status, title: 'No' }),
          {
            status: library.status,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        );

      return new Response(
        JSON.stringify({
          dishes: prices ? DISHES : DISHES.map(({ lastPrice: _, ...dish }) => dish),
          canManage: library.canManage ?? true,
          seesPrices: prices,
        }),
        { status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        dish: {
          id: 'd_new',
          name: String(body?.name ?? ''),
          description: null,
          allergens: body?.allergens ?? [],
          diets: body?.diets ?? [],
          usedByEvent: false,
          archivedAt: null,
          ...(prices ? { lastPrice: body?.lastPrice ?? null } : {}),
        },
      }),
      { status: method === 'POST' ? 201 : 200 },
    );
  });

  return sent;
}

function at(path: string): void {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

const WAIT = { timeout: 8000 };
const SLOW = { timeout: 20000 };

async function loaded(): Promise<HTMLElement> {
  return screen.findByRole('tabpanel', {}, WAIT);
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Menu library (sc-3901)', () => {
  it('lists the dishes A to Z with what each contains, in the navigation', SLOW, async () => {
    signedIn();
    answering();
    at('/app/menu-library');
    const panel = await loaded();

    expect(screen.getByRole('link', { name: 'Menu library' }).getAttribute('href')).toBe(
      '/app/menu-library',
    );
    expect(
      within(panel)
        .getAllByRole('heading', { level: 3 })
        .map((one) => one.textContent),
    ).toEqual(['Asun', 'Chin chin', 'Jollof rice', 'Zobo sorbet']);
    expect(panel.textContent).toContain('Allergens not stated');
    expect(panel.textContent).toContain('Contains none of the 14 allergens');
    expect(panel.textContent).toContain('Contains: Cereals containing gluten · Eggs · Milk');
    expect(panel.textContent).toContain('Used by an event');
    expect(screen.getByRole('button', { name: 'Archive Jollof rice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Chin chin…' })).toBeTruthy();
    expect(screen.queryByText('4,500.00')).toBeNull();
  });

  it('finds a dish ignoring case and accents, and filters by diet', SLOW, async () => {
    signedIn();
    answering();
    at('/app/menu-library');
    const panel = await loaded();

    type('Find a dish', 'CHÍN');
    expect(
      within(panel)
        .getAllByRole('heading', { level: 3 })
        .map((one) => one.textContent),
    ).toEqual(['Chin chin']);
    expect(panel.textContent).toContain('1 of 4 dishes');

    fireEvent.click(screen.getByRole('button', { name: 'Clear the search and filters' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Vegan' }));
    expect(
      within(panel)
        .getAllByRole('heading', { level: 3 })
        .map((one) => one.textContent),
    ).toEqual(['Jollof rice']);
  });

  it('refuses a blank save beside its fields, focus on the first', SLOW, async () => {
    signedIn();
    const sent = answering();
    at('/app/menu-library');
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save dish' }));

    expect(screen.getByText('Enter the dish’s name.')).toBeTruthy();
    expect(screen.getByText('Tick what it contains, or Contains none of these.')).toBeTruthy();
    expect(document.activeElement?.id).toBe('lib-name');
    expect(sent.filter((one) => one.method !== 'GET')).toEqual([]);
  });

  it('refuses the diets a dish clashes with, one line each', SLOW, async () => {
    signedIn();
    answering();
    at('/app/menu-library');
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    type('Name', 'Seafood okra');
    fireEvent.click(screen.getByLabelText('Crustaceans'));
    fireEvent.click(screen.getByLabelText('Eggs'));
    const diets = screen.getByRole('group', { name: 'Suitable for Optional' });
    fireEvent.click(within(diets).getByLabelText('Vegetarian'));
    fireEvent.click(within(diets).getByLabelText('Vegan'));
    fireEvent.click(screen.getByRole('button', { name: 'Save dish' }));

    expect(
      screen.getByText('Vegetarian dishes cannot contain fish, crustaceans or molluscs.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Vegan dishes cannot contain milk, eggs, fish, crustaceans or molluscs.'),
    ).toBeTruthy();
    expect(document.activeElement?.id).toBe('lib-diet-vegetarian');
  });

  it('asks before adding a name already in the library, naming the stored one', SLOW, async () => {
    signedIn();
    const sent = answering();
    at('/app/menu-library');
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    type('Name', 'PUFF puff');
    fireEvent.click(screen.getByLabelText('Contains none of these'));
    fireEvent.click(screen.getByRole('button', { name: 'Save dish' }));

    expect(
      screen.getByText('There is already a dish called Puff puff. It is under Archived.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add anyway' }));

    await waitFor(() => expect(sent.some((one) => one.method === 'POST')).toBe(true));
    expect(sent.find((one) => one.method === 'POST')?.body).toMatchObject({
      name: 'PUFF puff',
      containsNone: true,
      allowShared: true,
      lastPrice: null,
    });
    expect(await screen.findByText('PUFF puff added.')).toBeTruthy();
  });

  it('reads a last price in the interface language and refuses one it cannot', SLOW, async () => {
    signedIn();
    const sent = answering();
    at('/app/menu-library');
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    type('Name', 'Ofada stew');
    fireEvent.click(screen.getByLabelText('Celery'));
    type('Amount', '12,50');
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'GBP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save dish' }));

    expect(screen.getByText('Enter the last price as a number, like 12.50.')).toBeTruthy();
    expect(document.activeElement?.id).toBe('lib-amount');

    type('Amount', '4,500');
    fireEvent.click(screen.getByRole('button', { name: 'Save dish' }));

    await waitFor(() => expect(sent.some((one) => one.method === 'POST')).toBe(true));
    expect(sent.find((one) => one.method === 'POST')?.body?.lastPrice).toEqual({
      amount: '4500.00',
      currency: 'GBP',
    });
  });

  it('without budget.read shows no Last price, and an edit sends none', SLOW, async () => {
    signedIn();
    const sent = answering({ seesPrices: false });
    at('/app/menu-library');
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Jollof rice' }));
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.getByText('Events already using this dish keep their own copy.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save dish' }));

    await waitFor(() => expect(sent.some((one) => one.method === 'PUT')).toBe(true));
    expect(sent.find((one) => one.method === 'PUT')?.body).not.toHaveProperty('lastPrice');
  });

  it('asks once in the row before deleting an unused dish', SLOW, async () => {
    signedIn();
    const sent = answering({}, (one) =>
      one.method === 'DELETE' ? new Response(null, { status: 204 }) : null,
    );
    at('/app/menu-library');
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Chin chin…' }));
    expect(
      screen.getByText('Delete Chin chin? No event uses it, and it cannot be undone.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete dish' }));

    expect(await screen.findByText('Chin chin deleted.')).toBeTruthy();
    expect(
      sent.some((one) => one.method === 'DELETE' && one.path === '/api/orgs/org_1/dishes/d_chin'),
    ).toBe(true);
  });

  it('shows the lock note and no changes without menu.manage', SLOW, async () => {
    signedIn();
    answering({ canManage: false });
    at('/app/menu-library');
    await loaded();

    expect(screen.getByText(/can see the menu library but not change it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add dish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Jollof rice' })).toBeNull();
  });

  it('shows the web’s own 403 page without menu.read', SLOW, async () => {
    signedIn();
    answering({ status: 403 });
    at('/app/menu-library');

    expect(await screen.findByText('You do not have access to this', {}, WAIT)).toBeTruthy();
  });
});
