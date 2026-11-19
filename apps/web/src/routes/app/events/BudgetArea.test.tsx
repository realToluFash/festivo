import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  startsAt: '2030-11-14T16:00:00+00:00',
  endsAt: '2030-11-16T02:00:00+00:00',
  timeZone: 'Europe/London',
  dayCount: 3,
  currency: 'GBP',
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

const QUANTITIES = {
  per_head: { count: 96, source: 'accepted', reason: null },
  per_table: { count: 0, source: 'seating_tables', reason: 'no_seating_plan' },
  per_staff_hour: { count: 0, source: 'staff_hours', reason: 'no_staff_hours' },
  per_day: { count: 3, source: 'event_days', reason: null },
  fixed: { count: 1, source: 'fixed', reason: null },
};

function costed(
  id: string,
  label: string,
  fields: Record<string, unknown>,
  settled: string,
  ifAll = settled,
) {
  return {
    id,
    label,
    category: 'catering',
    basis: 'per_head',
    rate: null,
    amount: null,
    currency: 'GBP',
    note: null,
    quantity: QUANTITIES.per_head,
    createdAt: '2026-11-01T09:00:00+00:00',
    updatedAt: '2026-11-01T09:00:00+00:00',
    ...fields,
    cost: { confirmed: settled, potential: ifAll },
  };
}

const DINNER = costed('dinner', 'Dinner', { rate: '68.00' }, '6528.00', '9044.00');
const ARCH = costed(
  'arch',
  'Aisle arch',
  { category: 'flowers', basis: 'fixed', amount: '0.00', quantity: QUANTITIES.fixed },
  '0.00',
);
const CENTRE = costed(
  'centre',
  'Centrepieces',
  { category: 'flowers', basis: 'per_table', rate: '25.00', quantity: QUANTITIES.per_table },
  '0.00',
);

function budget(fields: Record<string, unknown> = {}) {
  return {
    currency: 'GBP',
    confirmed: '6528.00',
    potential: '9044.00',
    perHead: {
      confirmed: { amount: '68.00', heads: 96 },
      potential: { amount: '68.00', heads: 133 },
    },
    notPriced: 1,
    quantities: QUANTITIES,
    lines: [DINNER, ARCH, CENTRE],
    ...fields,
  };
}

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

type Answer = (body: unknown) => Response | Promise<Response>;

function serve(
  answers: Record<string, Answer>,
  { permissions = OWNER_PERMISSIONS, at = '/app/events/ev_1/budget' } = {},
): { line: string; body: unknown }[] {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });
    if (line === 'GET /api/events/ev_1/budget') return json(budget());

    return json({});
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);

  return sent;
}

const problem = (status: number, type: string, violations: unknown[] = []) =>
  new Response(
    JSON.stringify({ type: `https://soirely.app/errors/${type}`, title: type, status, violations }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reading an event’s Budget (sc-85)', () => {
  it('opens from Budget in the event’s navigation, headed Budget, with Add a cost', async () => {
    signedIn();
    serve({}, { at: '/app/events/ev_1' });

    const link = await screen.findByRole('link', { name: 'Budget' });
    expect(link.getAttribute('href')).toBe('/app/events/ev_1/budget');
    fireEvent.click(link);

    expect(await screen.findByRole('heading', { level: 1, name: 'Budget' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a cost' })).toBeTruthy();
  });

  it('puts the range, per head with its heads and the count not priced first', async () => {
    signedIn();
    serve({});

    const card = await screen.findByRole('region', { name: 'Budget' });
    expect(within(card).getByText('This event will cost')).toBeTruthy();
    expect(within(card).getByText('£6,528 to £9,044')).toBeTruthy();
    expect(within(card).getByText('Per head, settled')).toBeTruthy();
    expect(within(card).getByText('96 coming')).toBeTruthy();
    expect(within(card).getByText('133 coming')).toBeTruthy();
    expect(within(card).getAllByText('£68')).toHaveLength(2);
    expect(within(card).getByText('1 cost not priced yet')).toBeTruthy();
  });

  it('shows no per-head figure with nobody to divide by, never £0', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget': () =>
        json(
          budget({
            confirmed: '0.00',
            perHead: {
              confirmed: { amount: null, heads: 0 },
              potential: { amount: '68.00', heads: 133 },
            },
          }),
        ),
    });

    const card = await screen.findByRole('region', { name: 'Budget' });
    expect(within(card).getByText('No figure yet')).toBeTruthy();
    expect(within(card).getByText('Nobody has said yes')).toBeTruthy();
    expect(within(card).queryByText('£0')).toBeNull();
  });

  it('lists the costs under their categories, each saying where its quantity comes from', async () => {
    signedIn();
    serve({});

    await screen.findByRole('heading', { level: 2, name: 'Costs' });
    expect(screen.getAllByRole('heading', { level: 3 }).map((one) => one.textContent)).toEqual([
      'Catering',
      'Flowers',
    ]);

    const dinner = screen.getByRole('button', { name: /^Dinner\./u });
    expect(dinner.getAttribute('aria-label')).toBe(
      'Dinner. Rate: £68.00 a head. Quantity: 96, said yes, from the guest list. Settled: £6,528',
    );
    expect(
      within(dinner).getByText('£68.00 a head × 96 · said yes, from the guest list'),
    ).toBeTruthy();

    const arch = screen.getByRole('button', { name: /^Aisle arch\./u });
    expect(within(arch).getByText('Not priced')).toBeTruthy();
    expect(within(arch).queryByText(/£0/u)).toBeNull();

    const centre = screen.getByRole('button', { name: /^Centrepieces\./u });
    expect(within(centre).getByText('Not counted')).toBeTruthy();
    expect(within(centre).getByText(/Nothing yet · No seating plan yet/u)).toBeTruthy();
  });

  it('with no costs, says what the event already knows and offers the first cost', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget': () =>
        json(budget({ lines: [], confirmed: '0.00', potential: '0.00', notPriced: 0 })),
    });

    expect(await screen.findByText('No costs yet')).toBeTruthy();
    expect(
      screen.getByText(
        '96 guests have said yes, there is no seating plan yet and the event runs 3 days. Each cost you add takes its quantity from these, so nobody types a count in.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add the first cost' })).toBeTruthy();
    expect(screen.queryByText(/£0 to £0/u)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Costs' })).toBeNull();
  });
});

describe('who sees the Budget (sc-85)', () => {
  it('leaves Budget out of the navigation without budget.read', async () => {
    signedIn();
    const without = OWNER_PERMISSIONS.filter((one) => !one.startsWith('budget.'));
    serve({}, { permissions: without, at: '/app/events/ev_1' });

    await screen.findByRole('link', { name: 'Guests' });
    expect(screen.queryByRole('link', { name: 'Budget' })).toBeNull();
  });

  it('answers a direct link without budget.read as an event not found', async () => {
    signedIn();
    const without = OWNER_PERMISSIONS.filter((one) => !one.startsWith('budget.'));
    const sent = serve({}, { permissions: without });

    expect(
      await screen.findByRole('heading', { name: 'This event is not available' }),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Adaeze and Tunde' })).toBeNull();
    expect(sent.some((one) => one.line === 'GET /api/events/ev_1/budget')).toBe(false);
  });
});

describe('changing a rate in place (sc-85)', () => {
  it('opens the rate in place, refuses too many decimals with nothing sent, and saves', async () => {
    signedIn();
    const sent = serve({
      'PUT /api/events/ev_1/budget/lines/dinner': () => json({ line: DINNER }),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    const field = screen.getByRole('textbox', { name: 'Rate for Dinner' });
    expect(document.activeElement).toBe(field);
    expect((field as HTMLInputElement).value).toBe('68.00');

    fireEvent.change(field, { target: { value: '70.505' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText(
        "That has too many decimal places for this event's currency. Enter the rate like 12.50.",
      ),
    ).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);

    fireEvent.change(field, { target: { value: '70' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(await screen.findByText('Saved.', { selector: 'p' })).toBeTruthy();
    expect(sent.find((one) => one.line.startsWith('PUT'))?.body).toEqual({
      label: 'Dinner',
      category: 'catering',
      basis: 'per_head',
      rate: '70.00',
      currency: 'GBP',
    });
  });

  it('Escape leaves the rate as it was and sends nothing', async () => {
    signedIn();
    const sent = serve({});

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    const field = screen.getByRole('textbox', { name: 'Rate for Dinner' });
    fireEvent.change(field, { target: { value: '90' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(screen.queryByRole('textbox', { name: 'Rate for Dinner' })).toBeNull();
    expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);
  });

  it('opens a line at 0 empty, and refuses Save while it is empty', async () => {
    signedIn();
    const sent = serve({});

    fireEvent.click(await screen.findByRole('button', { name: /^Aisle arch\./u }));
    const field = screen.getByRole('textbox', { name: 'Amount for Aisle arch' });
    expect((field as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter the amount.')).toBeTruthy();
    expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);
  });

  it('puts the rate back and says so when the save fails', async () => {
    signedIn();
    serve({
      'PUT /api/events/ev_1/budget/lines/dinner': () => problem(500, 'internal_error'),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rate for Dinner' }), {
      target: { value: '70' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Not saved. The rate is back to £68.00 a head.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Dinner\. Rate: £68\.00 a head/u })).toBeTruthy();
  });
});

describe('removing a cost (sc-85)', () => {
  it('takes it off at once with Undo, saying how far the settled total fell, and Undo puts it back', async () => {
    signedIn();
    let lines = [DINNER, ARCH, CENTRE];
    const sent = serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines })),
      'DELETE /api/events/ev_1/budget/lines/dinner': () => {
        lines = [ARCH, CENTRE];
        return new Response(null, { status: 204 });
      },
      'POST /api/events/ev_1/budget/lines': () => {
        lines = [ARCH, CENTRE, { ...DINNER, id: 'dinner-2' }];
        return json({ line: DINNER }, 201);
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(
      await screen.findByText('Dinner removed. The settled total fell by £6,528.'),
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Dinner\./u })).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByRole('button', { name: /^Dinner\./u })).toBeTruthy();
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/budget/lines')?.body).toEqual({
      label: 'Dinner',
      category: 'catering',
      basis: 'per_head',
      rate: '68.00',
      currency: 'GBP',
    });
  });

  it('says a line with no price leaves the total the same', async () => {
    signedIn();
    serve({
      'DELETE /api/events/ev_1/budget/lines/arch': () => new Response(null, { status: 204 }),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Aisle arch\./u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(
      await screen.findByText('Aisle arch removed. It had no price, so the total is the same.'),
    ).toBeTruthy();
  });
});

describe('Add a cost (sc-85, decided 6 Nov)', () => {
  it('lists each basis with what it counts today, and the rate field only once one is chosen', async () => {
    signedIn();
    serve({});

    fireEvent.click(await screen.findByRole('button', { name: 'Add a cost' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a cost' });

    expect(
      within(dialog).getByText('96 said yes now, up to 133 if all come · from the guest list'),
    ).toBeTruthy();
    expect(within(dialog).getByText("3 days, from the event's dates")).toBeTruthy();
    expect(within(dialog).queryByRole('textbox', { name: 'Rate' })).toBeNull();
    expect(within(dialog).queryByRole('textbox', { name: /Vendor/u })).toBeNull();

    fireEvent.click(within(dialog).getByRole('radio', { name: /A fixed amount/u }));
    expect(within(dialog).getByRole('textbox', { name: 'Amount' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('radio', { name: /Per staff hour/u }));
    expect(within(dialog).queryByRole('textbox', { name: 'Amount' })).toBeNull();
    expect(within(dialog).queryByRole('textbox', { name: 'Rate' })).toBeNull();
  });

  it('marks each field it refuses, moves focus to the first, and sends nothing', async () => {
    signedIn();
    const sent = serve({});

    fireEvent.click(await screen.findByRole('button', { name: 'Add a cost' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a cost' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(within(dialog).getByText('3 fields need fixing, so nothing was sent.')).toBeTruthy();
    expect(within(dialog).getByText('Enter what it is.')).toBeTruthy();
    expect(within(dialog).getByText('Choose a category.')).toBeTruthy();
    expect(within(dialog).getByText('Choose how it is counted.')).toBeTruthy();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('textbox', { name: 'What it is' }),
    );
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/budget/lines')).toBe(false);
  });

  it('shows the staff-time basis unavailable once the budget has one', async () => {
    signedIn();
    const staff = costed(
      'staff',
      'Service staff',
      { category: 'staffing', basis: 'per_staff_hour', quantity: QUANTITIES.per_staff_hour },
      '0.00',
    );
    serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines: [DINNER, staff] })),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a cost' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a cost' });
    const radio = within(dialog).getByRole('radio', { name: /Per staff hour/u });

    expect((radio as HTMLInputElement).disabled).toBe(true);
    expect(within(dialog).getByText('The budget already has a staff-time cost.')).toBeTruthy();
  });

  it('reads a refusal only the server gives under the field it names', async () => {
    signedIn();
    serve({
      'POST /api/events/ev_1/budget/lines': () =>
        problem(422, 'validation_failed', [
          {
            propertyPath: 'basis',
            message: 'The budget already has a staff-time cost. Choose another way it is counted.',
            code: 'validation_failed',
          },
        ]),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a cost' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a cost' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'What it is' }), {
      target: { value: 'Service staff' },
    });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Category' }), {
      target: { value: 'staffing' },
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Per staff hour/u }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(
      await within(dialog).findByText(
        'The budget already has a staff-time cost. Choose another way it is counted.',
      ),
    ).toBeTruthy();
    expect(within(dialog).getByRole('textbox', { name: 'What it is' })).toBeTruthy();
  });

  it('keeps what was typed and says it was not saved when the save fails', async () => {
    signedIn();
    serve({
      'POST /api/events/ev_1/budget/lines': () => problem(500, 'internal_error'),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a cost' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a cost' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'What it is' }), {
      target: { value: 'Welcome drinks' },
    });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Category' }), {
      target: { value: 'catering' },
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Per head/u }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Rate' }), {
      target: { value: '12' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(
      await within(dialog).findByText(
        'Not saved. Check your connection and try again. What you typed is still here.',
      ),
    ).toBeTruthy();
    expect(
      (within(dialog).getByRole('textbox', { name: 'What it is' }) as HTMLInputElement).value,
    ).toBe('Welcome drinks');
  });

  it('sends the cost, closes, and shows it on the page', async () => {
    signedIn();
    let lines = [DINNER];
    const drinks = costed('drinks', 'Welcome drinks', { rate: '12.00' }, '1152.00', '1596.00');
    const sent = serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines, notPriced: 0 })),
      'POST /api/events/ev_1/budget/lines': () => {
        lines = [DINNER, drinks];
        return json({ line: drinks }, 201);
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a cost' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a cost' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'What it is' }), {
      target: { value: 'Welcome drinks' },
    });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Category' }), {
      target: { value: 'catering' },
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Per head/u }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Rate' }), {
      target: { value: '12' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('button', { name: /^Welcome drinks\./u })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a cost' })).toBeNull());
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/budget/lines')?.body).toEqual({
      label: 'Welcome drinks',
      category: 'catering',
      basis: 'per_head',
      rate: '12.00',
      currency: 'GBP',
    });
  });
});
