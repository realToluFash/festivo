import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { realtimeTopic } from '@soirely/api-client';
import { connection } from '@soirely/domain';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../../../config.ts';
import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { cssRule, stylesheet } from '../../../test-styles.ts';
import { todayIn } from './quotesArea.ts';

const BUDGET_CSS = stylesheet(import.meta.dirname, 'budget.css');

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
    notPriced: fields.notPriced ?? [fields.rate, fields.amount].includes('0.00'),
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
    if (line === 'GET /api/events/ev_1/budget/margin') return problem(403, 'plan_required');

    return json({});
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);

  return sent;
}

const problem = (status: number, type: string, violations: unknown[] = []) =>
  new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${type}`, title: type, status, violations }),
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

  it('reads the agency’s fee at £0.00 with its own client price as priced, out of the count (sc-75696)', async () => {
    signedIn();
    const fee = costed(
      'fee',
      'Planning fee',
      {
        category: 'other',
        basis: 'fixed',
        amount: '0.00',
        notPriced: false,
        quantity: QUANTITIES.fixed,
      },
      '0.00',
    );
    serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines: [DINNER, fee], notPriced: 0 })),
    });

    const row = await screen.findByRole('button', { name: /^Planning fee\./u });
    expect(within(row).queryByText('Not priced')).toBeNull();
    expect(within(row).getByText('A fixed amount')).toBeTruthy();
    expect(row.getAttribute('aria-label')).toBe(
      'Planning fee. Rate: £0.00. Quantity: A fixed amount. Settled: £0',
    );
    expect(screen.queryByText(/not priced yet/u)).toBeNull();
    expect(screen.queryByRole('button', { name: /Add a price/u })).toBeNull();
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

  it('draws the not available page as its demo does: the event, Not available, Back to Events', async () => {
    signedIn();
    const without = OWNER_PERMISSIONS.filter((one) => !one.startsWith('budget.'));
    serve({}, { permissions: without, at: '/app/events/ev_1/budget/staff-rates' });

    const heading = await screen.findByRole('heading', { name: 'This event is not available' });
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumb).getByRole('link', { name: 'Adaeze and Tunde' })).toBeTruthy();
    expect(within(crumb).getByText('Not available')).toBeTruthy();
    expect(heading.closest('.card')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to Events' }).getAttribute('href')).toBe(
      '/app/events',
    );
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

  it('lets the opened rate’s tint reach past its rows at a desk, the page never clipping it (sc-92)', async () => {
    signedIn();
    serve({});

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    expect(
      screen.getByRole('textbox', { name: 'Rate for Dinner' }).closest('.bt.desk-page'),
    ).not.toBeNull();
    expect(cssRule('.bt.desk-page', BUDGET_CSS.slice(0, BUDGET_CSS.indexOf('@media')))).toContain(
      'overflow: visible;',
    );
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
  it('takes it off at once with Undo, saying how far the settled total fell, and Undo puts the same line back in its place', async () => {
    signedIn();
    let lines = [DINNER, ARCH, CENTRE];
    const sent = serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines })),
      'DELETE /api/events/ev_1/budget/lines/dinner': () => {
        lines = [ARCH, CENTRE];
        return new Response(null, { status: 204 });
      },
      'DELETE /api/events/ev_1/budget/lines/dinner/removal': () => {
        lines = [DINNER, ARCH, CENTRE];
        return json({ line: DINNER });
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
    expect(sent.some((one) => one.line.startsWith('POST '))).toBe(false);
    expect(
      sent.filter((one) => one.line === 'DELETE /api/events/ev_1/budget/lines/dinner/removal'),
    ).toHaveLength(1);
    const rows = Array.from(document.querySelectorAll('[data-line]'), (row) =>
      row.getAttribute('data-line'),
    );
    expect(rows.indexOf('dinner')).toBeLessThan(rows.indexOf(CENTRE.id));
  });

  it('keeps the bar with Undo above No costs yet when the only cost goes, and Undo puts it back', async () => {
    signedIn();
    let lines = [DINNER];
    serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines })),
      'DELETE /api/events/ev_1/budget/lines/dinner': () => {
        lines = [];
        return new Response(null, { status: 204 });
      },
      'DELETE /api/events/ev_1/budget/lines/dinner/removal': () => {
        lines = [DINNER];
        return json({ line: DINNER });
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('No costs yet')).toBeTruthy();
    expect(screen.getByText('Dinner removed. The settled total fell by £6,528.')).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo' })),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByRole('button', { name: /^Dinner\./u })).toBeTruthy();
    expect(screen.queryByText('No costs yet')).toBeNull();
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

class StubSource {
  static readonly CLOSED = 2;
  static made: StubSource[] = [];

  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  readonly url: string;

  constructor(url: string | URL) {
    this.url = String(url);
    StubSource.made.push(this);
  }

  close(): void {
    this.readyState = StubSource.CLOSED;
  }

  publish(data = '{}'): void {
    act(() => this.onmessage?.({ data }));
  }
}

function deferred(): { promise: Promise<void>; open: () => void } {
  let open = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { promise, open };
}

describe('the Budget while others change it (sc-85)', () => {
  const before = config();
  const CAKE = costed(
    'cake',
    'Cake',
    { category: 'other', basis: 'fixed', amount: '450.00', quantity: QUANTITIES.fixed },
    '450.00',
  );
  const hub = () =>
    json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });

  beforeEach(() => {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
  });

  afterEach(() => {
    __setConfig(before);
    vi.unstubAllGlobals();
    vi.useRealTimers();
    act(() => connection.deviceOnline());
  });

  async function source(): Promise<StubSource> {
    const budgeted = () => StubSource.made.filter((one) => one.url.includes('budget'));
    await waitFor(() => expect(budgeted()).toHaveLength(1));
    const one = budgeted()[0]!;
    const topics = new URL(one.url).searchParams.getAll('topic');
    expect(topics).toEqual([
      realtimeTopic('EventBudget', 'ev_1'),
      realtimeTopic('EventHeadcount', 'ev_1'),
      realtimeTopic('EventQuotes', 'ev_1'),
    ]);

    return one;
  }

  it('says a cost another tab added, with how the settled total moved', async () => {
    signedIn();
    let now = budget();
    serve({
      'GET /api/events/ev_1/budget': () => json(now),
      'POST /api/events/ev_1/budget/subscriptions': hub,
    });
    await screen.findByRole('button', { name: /^Dinner\./u });
    const hubbed = await source();

    now = budget({ confirmed: '6978.00', lines: [DINNER, ARCH, CENTRE, CAKE] });
    hubbed.publish();

    expect(
      await screen.findByText(
        'Cake was added in another tab, so the settled total went up by £450.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Cake\./u })).toBeTruthy();
  });

  it('says a cost another tab put back with Undo was put back, never added (decided 19 Nov)', async () => {
    signedIn();
    let now = budget();
    serve({
      'GET /api/events/ev_1/budget': () => json(now),
      'POST /api/events/ev_1/budget/subscriptions': hub,
    });
    await screen.findByRole('button', { name: /^Dinner\./u });
    const hubbed = await source();

    now = budget({ confirmed: '0.00', lines: [ARCH, CENTRE] });
    hubbed.publish();
    await screen.findByText(/^Dinner was removed in another tab/u);
    now = budget();
    hubbed.publish();

    expect(
      await screen.findByText(
        'Dinner was put back in another tab, so the settled total went up by £6,528.',
      ),
    ).toBeTruthy();
  });

  it('says how many more guests said yes when the headcount moves', async () => {
    signedIn();
    let now = budget();
    serve({
      'GET /api/events/ev_1/budget': () => json(now),
      'POST /api/events/ev_1/budget/subscriptions': hub,
    });
    await screen.findByRole('button', { name: /^Dinner\./u });
    const hubbed = await source();

    now = budget({
      confirmed: '6664.00',
      perHead: {
        confirmed: { amount: '68.00', heads: 98 },
        potential: { amount: '68.00', heads: 133 },
      },
    });
    hubbed.publish();

    expect(
      await screen.findByText('2 more guests said yes, so the settled total went up by £136.'),
    ).toBeTruthy();
  });

  it('never tells the reader their own removal came from another tab', async () => {
    signedIn();
    let lines = [DINNER, ARCH, CENTRE];
    const held: ReturnType<typeof deferred>[] = [];
    let holding = false;
    serve({
      'GET /api/events/ev_1/budget': async () => {
        const answer = budget({ lines, confirmed: lines.includes(DINNER) ? '6528.00' : '0.00' });
        if (!holding) return json(answer);
        const gate = deferred();
        held.push(gate);
        await gate.promise;

        return json(answer);
      },
      'POST /api/events/ev_1/budget/subscriptions': hub,
      'DELETE /api/events/ev_1/budget/lines/dinner': () => {
        lines = [ARCH, CENTRE];
        holding = true;
        return new Response(null, { status: 204 });
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    const hubbed = await source();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(held).toHaveLength(1));
    hubbed.publish();
    await waitFor(() => expect(held).toHaveLength(2));
    await act(async () => {
      held[1]!.open();
      await held[1]!.promise;
    });
    await act(async () => {
      held[0]!.open();
      await held[0]!.promise;
    });

    expect(
      await screen.findByText('Dinner removed. The settled total fell by £6,528.'),
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Dinner\./u })).toBeNull());
    expect(screen.queryByText(/in another tab/u)).toBeNull();
  });

  it('never tells the reader their own emptied price came from another tab (sc-75696)', async () => {
    signedIn();
    const fee = (notPriced: boolean) =>
      costed(
        'fee',
        'Planning fee',
        {
          category: 'other',
          basis: 'fixed',
          amount: '0.00',
          notPriced,
          quantity: QUANTITIES.fixed,
        },
        '0.00',
      );
    let emptied = false;
    const priced = {
      ...MARGIN_DINNER,
      id: 'fee',
      label: 'Planning fee',
      category: 'other',
      basis: 'fixed',
      source: 'price',
      markup: null,
      price: '3000.00',
    };
    serve({
      'GET /api/events/ev_1/budget': () =>
        json(budget({ lines: [DINNER, fee(emptied)], notPriced: emptied ? 1 : 0 })),
      'GET /api/events/ev_1/budget/margin': () => json(margin({ lines: [MARGIN_DINNER, priced] })),
      'POST /api/events/ev_1/budget/subscriptions': hub,
      'POST /api/events/ev_1/budget/margin/subscriptions': hub,
      'PUT /api/events/ev_1/budget/lines/fee/charge': () => {
        emptied = true;
        return json(margin());
      },
    });
    const plain = () =>
      StubSource.made.find((one) =>
        new URL(one.url).searchParams
          .getAll('topic')
          .includes(realtimeTopic('EventBudget', 'ev_1')),
      );
    await waitFor(() => expect(plain()).toBeDefined());

    fireEvent.click(await screen.findByRole('button', { name: 'See margin' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Planning fee/u }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Charged at' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Price removed.')).length).toBeGreaterThan(0);
    act(() => plain()!.publish());

    fireEvent.click(screen.getByRole('button', { name: 'Hide margin' }));
    expect((await screen.findAllByText(/1 cost not priced yet/u)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/in another tab/u)).toBeNull();
  });

  it('says it is not live, as of when, hides the live line, and Try now asks again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2030, 10, 15, 14, 32));
    signedIn();
    let online = true;
    let now = budget();
    const sent = serve({
      'GET /api/events/ev_1/budget': () => {
        if (!online) throw new TypeError('Failed to fetch');
        return json(now);
      },
      'GET /api/events/ev_1': () => {
        if (!online) throw new TypeError('Failed to fetch');
        return json({ event: EVENT });
      },
      'POST /api/events/ev_1/budget/subscriptions': hub,
    });
    await screen.findByRole('button', { name: /^Dinner\./u });
    const hubbed = await source();
    now = budget({ confirmed: '6978.00', lines: [DINNER, ARCH, CENTRE, CAKE] });
    hubbed.publish();
    const live = 'Cake was added in another tab, so the settled total went up by £450.';
    expect(await screen.findByText(live)).toBeTruthy();

    vi.setSystemTime(new Date(2030, 10, 15, 14, 38));
    online = false;
    act(() => connection.deviceOffline());

    expect(await screen.findByText('Not live. Figures as of 14:32, 6 minutes ago.')).toBeTruthy();
    expect(screen.queryByText(live)).toBeNull();
    const asked = sent.filter(({ line }) => line === 'GET /api/events/ev_1').length;

    online = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try now' }));

    await waitFor(() =>
      expect(sent.filter(({ line }) => line === 'GET /api/events/ev_1').length).toBeGreaterThan(
        asked,
      ),
    );
  });
});

describe('a failed Undo (sc-85)', () => {
  it.each([
    [new TypeError('Failed to fetch'), 'Not put back. Check your connection and try again.'],
    [
      problem(422, 'validation_failed', [
        { propertyPath: 'basis', message: 'The budget already has a staff-time cost.' },
      ]),
      'Not put back. The budget already has a staff-time cost.',
    ],
  ])('says the line is not back, and keeps Undo', async (failure, words) => {
    signedIn();
    removeDinner(failure);

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await screen.findByText('Dinner removed. The settled total fell by £6,528.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText(words, { selector: '.bt-undo-words' })).toBeTruthy();
    expect(screen.queryByText('Dinner removed. The settled total fell by £6,528.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it.each([
    [problem(404, 'not_found'), 'Not put back. It was removed more than a day ago.'],
    [
      problem(410, 'budget_line_currency_changed'),
      "Not put back. The event's currency has changed since it was removed.",
    ],
  ])(
    'says why a line past its Undo is not put back, and offers Undo no more (decided 19 Nov)',
    async (failure, words) => {
      signedIn();
      removeDinner(failure);

      fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      await screen.findByText('Dinner removed. The settled total fell by £6,528.');
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

      expect(await screen.findByText(words, { selector: '.bt-undo-words' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Dinner\./u })).toBeNull();
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByText(words, { selector: '.bt-undo-words' }).parentElement,
        ),
      );
    },
  );

  function removeDinner(failure: unknown) {
    let lines = [DINNER, ARCH, CENTRE];
    serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines })),
      'DELETE /api/events/ev_1/budget/lines/dinner': () => {
        lines = [ARCH, CENTRE];
        return new Response(null, { status: 204 });
      },
      'DELETE /api/events/ev_1/budget/lines/dinner/removal': () => {
        if (failure instanceof Response) return failure;
        throw failure;
      },
    });
  }
});

const MARGIN_DINNER = {
  id: 'dinner',
  label: 'Dinner',
  category: 'catering',
  basis: 'per_head',
  source: 'event',
  markup: '20',
  price: null,
  client: { confirmed: '7833.60', potential: '10852.80' },
  cost: { confirmed: '6528.00', potential: '9044.00' },
  margin: { confirmed: '1305.60', potential: '1808.80' },
  share: { confirmed: '16.7', potential: '16.7' },
};

function margin(fields: Record<string, unknown> = {}) {
  return {
    currency: 'GBP',
    markups: { event: '20', categories: {} },
    total: {
      client: MARGIN_DINNER.client,
      cost: MARGIN_DINNER.cost,
      margin: MARGIN_DINNER.margin,
      share: MARGIN_DINNER.share,
    },
    categories: {},
    lines: [MARGIN_DINNER],
    ...fields,
  };
}

const SAVOUR = {
  id: 'q_savour',
  vendor: {
    id: 'v4',
    name: 'Savour Kitchen',
    category: 'catering',
    contactName: 'Kofi Mensah',
    archived: false,
  },
  quote: {
    id: 'qv_1',
    covers: 'Dinner and drinks',
    amount: '9000.00',
    quotedOn: '2026-10-13',
    reference: null,
    supersededAt: null,
  },
  earlier: [],
  lines: [],
  payments: [
    {
      id: 'p_deposit',
      description: 'Deposit',
      amount: '4500.00',
      dueOn: '2030-11-04',
      overdue: false,
    },
  ],
  scheduled: '4500.00',
  difference: '-4500.00',
};

function quotes(fields: Record<string, unknown> = {}) {
  return {
    currency: 'GBP',
    timeZone: 'Europe/London',
    entitled: true,
    quotes: [SAVOUR],
    due: [],
    ...fields,
  };
}

describe('the margin face, for margin readers on a plan with margin (sc-92)', () => {
  it('opens on the plain Budget, and See margin turns it to its margin face and back', async () => {
    signedIn();
    serve({ 'GET /api/events/ev_1/budget/margin': () => json(margin()) });

    fireEvent.click(await screen.findByRole('button', { name: 'See margin' }));

    const card = screen.getByRole('region', { name: 'Budget' });
    expect(within(card).getByText('Client total')).toBeTruthy();
    expect(within(card).getByText('£7,834 to £10,853')).toBeTruthy();
    expect(within(card).getByText('Internal cost')).toBeTruthy();
    expect(within(card).getByText('£1,306 to £1,809')).toBeTruthy();
    expect(within(card).getByText('16.7% of the client total')).toBeTruthy();
    expect(within(card).getByText('Never on a share or a printout.')).toBeTruthy();
    expect(
      screen.getByText('Cost £6,528.00 · Charged at £7,833.60 · 20% markup, the event’s'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Whole event/u }).textContent).toContain(
      '20% markup',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide margin' }));
    expect(screen.getByText('This event will cost')).toBeTruthy();
    expect(screen.queryByText('Client total')).toBeNull();
  });

  it('reads an event markup of 0 as at cost, chosen, on the event row and every line it covers', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/margin': () =>
        json(
          margin({
            markups: { event: '0', categories: {} },
            lines: [{ ...MARGIN_DINNER, markup: '0' }],
          }),
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'See margin' }));

    expect(screen.getByRole('button', { name: /^Whole event/u }).textContent).toContain(
      'At cost, chosen',
    );
    expect(screen.getByText(/· at cost, chosen$/u)).toBeTruthy();
    expect(screen.queryByText(/markup, the event’s/u)).toBeNull();
  });

  it('says nothing is missing on a plan without margin', async () => {
    signedIn();
    serve({ 'GET /api/events/ev_1/budget/margin': () => problem(403, 'plan_required') });

    expect(await screen.findByText('This event will cost')).toBeTruthy();
    await act(async () => Promise.resolve());
    expect(screen.queryByRole('button', { name: 'See margin' })).toBeNull();
  });

  it('asks nothing without budget.margin', async () => {
    signedIn();
    const sent = serve(
      {},
      { permissions: OWNER_PERMISSIONS.filter((one) => one !== 'budget.margin') },
    );

    expect(await screen.findByText('This event will cost')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See margin' })).toBeNull();
    expect(sent.some((one) => one.line.includes('/margin'))).toBe(false);
  });

  it('refuses a markup below 0 at the field with nothing sent, and saves one', async () => {
    signedIn();
    const sent = serve({
      'GET /api/events/ev_1/budget/margin': () => json(margin()),
      'PUT /api/events/ev_1/budget/markup': () =>
        json(margin({ markups: { event: '25', categories: {} } })),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'See margin' }));
    fireEvent.click(screen.getByRole('button', { name: /^Whole event/u }));
    const field = await screen.findByRole('textbox', { name: 'Markup' });
    expect((field as HTMLInputElement).value).toBe('20');

    fireEvent.change(field, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText('A markup cannot be below 0. To sell below cost, enter the price instead.'),
    ).toBeTruthy();
    fireEvent.change(field, { target: { value: '20.25' } });
    expect(screen.getByText('Enter a markup with at most 1 decimal place.')).toBeTruthy();
    expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);

    fireEvent.change(field, { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'PUT /api/events/ev_1/budget/markup')?.body).toEqual({
        markup: '25',
      }),
    );
    expect(await screen.findByText('Markup saved.')).toBeTruthy();
  });

  it('takes an emptied markup as a removal only where one is set', async () => {
    signedIn();
    const sent = serve({
      'GET /api/events/ev_1/budget/margin': () => json(margin()),
      'PUT /api/events/ev_1/budget/markup': () =>
        json(margin({ markups: { event: null, categories: {} } })),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'See margin' }));
    fireEvent.click(screen.getByRole('button', { name: /^Whole event/u }));
    expect(screen.getByText(/Leave it empty to remove it\./u)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /^A category/u }));
    const field = screen.getByRole('textbox', { name: 'Markup' });
    expect((field as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/Leave it empty/u)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter the markup as a number, like 12.5.')).toBeTruthy();
    expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);

    fireEvent.click(screen.getByRole('radio', { name: /^The whole event/u }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Markup' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(sent.find((one) => one.line === 'PUT /api/events/ev_1/budget/markup')?.body).toEqual({
        markup: null,
      }),
    );
    expect((await screen.findAllByText('Markup removed.')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Markup saved.')).toBeNull();
  });

  it('says an emptied price was removed, not saved', async () => {
    signedIn();
    const priced = { ...MARGIN_DINNER, source: 'price', markup: null, price: '8000.00' };
    const sent = serve({
      'GET /api/events/ev_1/budget/margin': () => json(margin({ lines: [priced] })),
      'PUT /api/events/ev_1/budget/lines/dinner/charge': () => json(margin()),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'See margin' }));
    fireEvent.click(screen.getByRole('button', { name: /^Dinner/u }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Charged at' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(
        sent.find((one) => one.line === 'PUT /api/events/ev_1/budget/lines/dinner/charge')?.body,
      ).toEqual({}),
    );
    expect((await screen.findAllByText('Price removed.')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Saved.')).toBeNull();
  });

  it('keeps its figures when the headcount moves, and reads the margin again', async () => {
    const before = config();
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
    try {
      signedIn();
      let now = margin();
      const hub = () =>
        json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
      serve({
        'GET /api/events/ev_1/budget/margin': () => json(now),
        'POST /api/events/ev_1/budget/subscriptions': hub,
        'POST /api/events/ev_1/budget/margin/subscriptions': hub,
      });

      fireEvent.click(await screen.findByRole('button', { name: 'See margin' }));
      const card = screen.getByRole('region', { name: 'Budget' });
      expect(within(card).getByText('£7,834 to £10,853')).toBeTruthy();
      await waitFor(() =>
        expect(StubSource.made.filter((one) => one.url.includes('margin'))).toHaveLength(1),
      );
      const hubbed = StubSource.made.find((one) => one.url.includes('margin'))!;

      const more = { confirmed: '7920.00', potential: '10852.80' };
      now = margin({ total: { ...margin().total, client: more } });
      hubbed.publish(JSON.stringify({ headcount: 99 }));

      expect(await within(card).findByText('£7,920 to £10,853')).toBeTruthy();
      expect(screen.getByText(/^Cost £6,528\.00 · Charged at/u)).toBeTruthy();
    } finally {
      __setConfig(before);
      vi.unstubAllGlobals();
    }
  });

  it('says a price below cost beside the field, with its margin, and still saves it', async () => {
    signedIn();
    const sent = serve({
      'GET /api/events/ev_1/budget/margin': () => json(margin()),
      'PUT /api/events/ev_1/budget/lines/dinner/charge': () => json(margin()),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'See margin' }));
    fireEvent.click(screen.getByRole('button', { name: /^Dinner/u }));
    const field = screen.getByRole('textbox', { name: 'Charged at' });
    expect((field as HTMLInputElement).value).toBe('7,833.60');

    fireEvent.change(field, { target: { value: '6000' } });
    expect(screen.getByRole('status').textContent).toMatch(/^Below cost: margin [-−]£528\.00\.$/u);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(
        sent.find((one) => one.line === 'PUT /api/events/ev_1/budget/lines/dinner/charge')?.body,
      ).toEqual({ price: '6000.00', currency: 'GBP' }),
    );
  });
});

const READ_ONLY =
  'Quotes and payment schedules are read-only because this organisation’s plan no longer includes them. Nothing has been removed.';
const NOT_LOADED = 'Quotes and payments did not load. Check your connection and try again.';

describe('quotes on Budget’s home (sc-87)', () => {
  it('shows nothing of quotes to an organisation whose plan never had them', async () => {
    signedIn();
    const sent = serve({
      'GET /api/events/ev_1/budget/quotes': () => json(quotes({ entitled: false, quotes: [] })),
    });

    await screen.findByText('Dinner');
    await waitFor(() =>
      expect(sent.some((one) => one.line === 'GET /api/events/ev_1/budget/quotes')).toBe(true),
    );
    await act(async () => {});
    expect(screen.queryByText(READ_ONLY)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Due next' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Vendors quoted' })).toBeNull();
  });

  it('keeps the quotes readable after a downgrade, saying they are read-only', async () => {
    signedIn();
    serve({ 'GET /api/events/ev_1/budget/quotes': () => json(quotes({ entitled: false })) });

    expect(await screen.findByText(READ_ONLY)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Vendors quoted' })).toBeTruthy();
    expect(screen.getByText('Savour Kitchen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a quote' })).toBeNull();
  });

  it('keeps Due next and Vendors quoted in place when the quotes did not load, with Try again', async () => {
    signedIn();
    let tries = 0;
    serve({
      'GET /api/events/ev_1/budget/quotes': () =>
        ++tries === 1 ? problem(500, 'internal_error') : json(quotes()),
    });

    expect(await screen.findAllByText(NOT_LOADED)).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Due next' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Vendors quoted' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a quote' })).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]!);

    expect(await screen.findByText('Savour Kitchen')).toBeTruthy();
    expect(screen.queryByText(NOT_LOADED)).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Budget' }));
  });
});

describe('a vendor’s page (sc-87)', () => {
  const at = '/app/events/ev_1/budget/vendors/v4';

  it('opens the vendor’s name on its row in the directory', async () => {
    signedIn();
    serve({ 'GET /api/events/ev_1/budget/quotes': () => json(quotes()) }, { at });

    const name = await screen.findByRole('link', { name: 'Savour Kitchen' });
    expect(name.getAttribute('href')).toBe('/app/settings/vendors?vendor=v4');
  });

  it('keeps the row asking when Remove fails, says so in it, and puts focus back on Remove', async () => {
    signedIn();
    let removals = 0;
    serve(
      {
        'GET /api/events/ev_1/budget/quotes': () => json(quotes()),
        'DELETE /api/events/ev_1/budget/payments/p_deposit': () =>
          ++removals === 1 ? problem(500, 'internal_error') : new Response(null, { status: 204 }),
      },
      { at },
    );

    const row = (await screen.findByText('Deposit')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    const ask = within(row).getByRole('group', { name: 'Remove this payment?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove' }));

    expect((await within(ask).findByRole('alert')).textContent).toBe(
      'Not removed. Check your connection and try again.',
    );
    expect(document.activeElement).toBe(within(ask).getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Deposit')).toBeTruthy();
    expect(screen.queryByRole('status', { name: /Not removed/ })).toBeNull();
  });
});

describe('marking a payment paid (sc-88)', () => {
  const at = '/app/events/ev_1/budget/vendors/v4';
  const deposit = SAVOUR.payments[0]!;
  const withPayments = (payments: unknown[]) => quotes({ quotes: [{ ...SAVOUR, payments }] });
  const dialog = () => screen.getByRole('dialog');

  it('starts on the amount scheduled and today, says the difference, sends it and lights the row with Undo', async () => {
    signedIn();
    const today = todayIn('Europe/London');
    let now = quotes();
    const paid = {
      ...deposit,
      paid: {
        amount: '4600.00',
        paidOn: today,
        reference: 'FP-2231',
        at: '2026-11-20T10:00:00+00:00',
        by: { id: 'u_folake', name: 'Folake Adeyemi' },
        difference: '100.00',
      },
    };
    const sent = serve(
      {
        'GET /api/events/ev_1/budget/quotes': () => json(now),
        'POST /api/events/ev_1/budget/payments/p_deposit/paid': () => {
          now = withPayments([paid]);
          return json({ quote: now.quotes[0] });
        },
      },
      { at },
    );

    const row = (await screen.findByText('Deposit')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Mark paid' }));
    const amount = within(dialog()).getByRole('textbox', { name: 'Amount paid' });
    expect((amount as HTMLInputElement).value).toBe('4,500.00');
    expect((within(dialog()).getByLabelText('Date paid') as HTMLInputElement).value).toBe(today);

    fireEvent.change(amount, { target: { value: '4,600' } });
    expect(
      within(dialog()).getByText(
        '£100.00 more than scheduled. The difference stays visible; nothing absorbs it.',
      ),
    ).toBeTruthy();
    fireEvent.change(within(dialog()).getByRole('textbox', { name: /Reference/ }), {
      target: { value: ' FP-2231 ' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Mark paid' }));

    const lit = (await screen.findByText(/Marked by Folake Adeyemi/)).closest('li')!;
    expect(within(lit).getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(within(lit).queryByRole('button', { name: 'Mark paid' })).toBeNull();
    expect(within(lit).getByText('Reference: FP-2231')).toBeTruthy();
    expect(
      sent.find((one) => one.line === 'POST /api/events/ev_1/budget/payments/p_deposit/paid')?.body,
    ).toEqual({ amount: '4600.00', currency: 'GBP', paidOn: today, reference: 'FP-2231' });
  });

  it('refuses a blank amount before sending, and gives way to the server’s already paid with only Close', async () => {
    signedIn();
    const sent = serve(
      {
        'GET /api/events/ev_1/budget/quotes': () => json(quotes()),
        'POST /api/events/ev_1/budget/payments/p_deposit/paid': () =>
          new Response(
            JSON.stringify({
              type: 'https://soirely.com/errors/payment_already_paid',
              title: 'payment_already_paid',
              status: 409,
              detail: 'Kofi Mensah has already marked this paid, so nothing has changed.',
            }),
            { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
          ),
      },
      { at },
    );

    const row = (await screen.findByText('Deposit')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Mark paid' }));
    const amount = within(dialog()).getByRole('textbox', { name: 'Amount paid' });
    fireEvent.change(amount, { target: { value: '' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Mark paid' }));
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(sent.some((one) => one.line.startsWith('POST'))).toBe(false);

    fireEvent.change(amount, { target: { value: '4500' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Mark paid' }));

    expect((await within(dialog()).findByRole('alert')).textContent).toBe(
      'Kofi Mensah has already marked this paid, so nothing has changed.',
    );
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(within(dialog()).queryByRole('textbox', { name: 'Amount paid' })).toBeNull();
  });

  it('cancels an unpaid payment with its reason, keeps it struck as not owed, and Restore brings it back', async () => {
    signedIn();
    let now = quotes();
    const sent = serve(
      {
        'GET /api/events/ev_1/budget/quotes': () => json(now),
        'POST /api/events/ev_1/budget/payments/p_deposit/cancellation': () => {
          now = withPayments([
            { ...deposit, cancelled: { at: '', by: null, reason: 'Venue includes it' } },
          ]);
          return json({ quote: now.quotes[0] });
        },
        'DELETE /api/events/ev_1/budget/payments/p_deposit/cancellation': () => {
          now = quotes();
          return json({ quote: now.quotes[0] });
        },
      },
      { at },
    );

    const row = (await screen.findByText('Deposit')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Cancel payment' }));
    expect(within(dialog()).getByRole('button', { name: 'Keep it' })).toBeTruthy();
    fireEvent.change(within(dialog()).getByRole('textbox', { name: /Why it is not owed/ }), {
      target: { value: 'Venue includes it' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel payment' }));

    expect(
      await screen.findByText('Cancelled · Not owed: Venue includes it · £4,500.00'),
    ).toBeTruthy();
    expect(
      sent.find((one) => one.line.endsWith('/cancellation') && one.line.startsWith('POST'))?.body,
    ).toEqual({ reason: 'Venue includes it' });

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    const back = (await screen.findByRole('button', { name: 'Mark paid' })).closest('li')!;
    expect(within(back).getByText('Deposit')).toBeTruthy();
  });

  it('says Undo deletes a payment added as already made, and says what it deleted', async () => {
    signedIn();
    const added = {
      id: 'p_stems',
      description: 'Extra stems for the arch',
      amount: '180.00',
      dueOn: '2026-11-03',
      overdue: false,
      addedAsPaid: true,
      cancelled: null,
      paid: {
        amount: '180.00',
        paidOn: '2026-11-03',
        reference: null,
        at: '',
        by: { id: 'u_folake', name: 'Folake Adeyemi' },
        difference: '0.00',
      },
    };
    let now = withPayments([deposit, added]);
    const sent = serve(
      {
        'GET /api/events/ev_1/budget/quotes': () => json(now),
        'DELETE /api/events/ev_1/budget/payments/p_stems/paid': () => {
          now = quotes();
          return json({ quote: now.quotes[0] });
        },
      },
      { at },
    );

    const row = (
      await screen.findByText(/^Paid .+\. Added by you as already paid, so Undo deletes it\.$/)
    ).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Undo' }));

    expect(
      (
        await screen.findByText(
          /^Deleted the payment of £180\.00 to Savour Kitchen on .+: Extra stems for the arch\.$/,
        )
      ).getAttribute('role'),
    ).toBe('status');
    expect(screen.queryByText('Extra stems for the arch')).toBeNull();
    expect(
      sent.some((one) => one.line === 'DELETE /api/events/ev_1/budget/payments/p_stems/paid'),
    ).toBe(true);
  });

  it('names the next payment on the card, and opens its Mark paid from there', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/quotes': () =>
        json(
          quotes({
            due: [
              {
                id: 'p_deposit',
                quoteId: 'q_savour',
                vendor: 'Savour Kitchen',
                description: 'Deposit',
                amount: '4500.00',
                dueOn: '2026-11-03',
                overdue: true,
              },
            ],
          }),
        ),
    });

    const line = await screen.findByText(
      /^The deposit for Savour Kitchen, £4,500, was due on .*3.*\.$/,
    );
    const foot = line.closest('div')!;
    fireEvent.click(within(foot).getByRole('button', { name: 'Mark paid' }));
    expect(within(dialog()).getByText('Savour Kitchen · Deposit · Adaeze and Tunde')).toBeTruthy();
  });

  it('opens Mark paid from a row of Due next, and keeps the row lit with Undo once marked', async () => {
    signedIn();
    let now = quotes({
      due: [
        {
          id: 'p_deposit',
          quoteId: 'q_savour',
          vendor: 'Savour Kitchen',
          description: 'Deposit',
          amount: '4500.00',
          dueOn: '2030-11-04',
          overdue: false,
        },
      ],
    });
    serve({
      'GET /api/events/ev_1/budget/quotes': () => json(now),
      'POST /api/events/ev_1/budget/payments/p_deposit/paid': () => {
        now = withPayments([
          {
            ...deposit,
            paid: {
              amount: '4500.00',
              paidOn: '2026-11-20',
              reference: null,
              at: '',
              by: { id: 'u_folake', name: 'Folake Adeyemi' },
              difference: '0.00',
            },
          },
        ]);
        return json({ quote: now.quotes[0] });
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Savour Kitchen.*Mark paid/ }));
    expect(within(dialog()).getByText('Savour Kitchen · Deposit · Adaeze and Tunde')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Mark paid' }));

    const lit = (await screen.findAllByText(/^Marked paid: £4,500\.00 on /))
      .map((one) => one.closest('li'))
      .find((one) => one != null)!;
    expect(within(lit).getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  const markedEarlier = {
    ...deposit,
    paid: {
      amount: '4500.00',
      paidOn: '2026-11-02',
      reference: null,
      at: '2026-11-02T10:00:00+00:00',
      by: { id: 'u_kofi', name: 'Kofi Mensah' },
      difference: '0.00',
    },
  };
  const addedEarlier = (by: { id: string; name: string }) => ({
    id: 'p_stems',
    description: 'Extra stems for the arch',
    amount: '180.00',
    dueOn: '2026-11-03',
    overdue: false,
    addedAsPaid: true,
    cancelled: null,
    paid: {
      amount: '180.00',
      paidOn: '2026-11-03',
      reference: null,
      at: '',
      by,
      difference: '0.00',
    },
  });

  it('offers Undo on a payment someone else marked paid before this page loaded, and Undo unmarks it (decided 20 Nov)', async () => {
    signedIn();
    let now = withPayments([markedEarlier]);
    const sent = serve(
      {
        'GET /api/events/ev_1/budget/quotes': () => json(now),
        'DELETE /api/events/ev_1/budget/payments/p_deposit/paid': () => {
          now = quotes();
          return json({ quote: now.quotes[0] });
        },
      },
      { at },
    );

    const row = (await screen.findByText(/Marked by Kofi Mensah/)).closest('li')!;
    expect(within(row).queryByText(/^Reference:/)).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Undo' }));

    expect(await screen.findByRole('button', { name: 'Mark paid' })).toBeTruthy();
    expect(
      sent.some((one) => one.line === 'DELETE /api/events/ev_1/budget/payments/p_deposit/paid'),
    ).toBe(true);
  });

  it('draws the reference under the paid line of a row added as already paid (ux #77035)', async () => {
    signedIn();
    const added = addedEarlier({ id: 'u_kofi', name: 'Kofi Mensah' });
    serve(
      {
        'GET /api/events/ev_1/budget/quotes': () =>
          json(withPayments([{ ...added, paid: { ...added.paid, reference: 'Cheque 004417' } }])),
      },
      { at },
    );

    const row = (await screen.findByText('Extra stems for the arch')).closest('li')!;
    const lines = [...row.querySelectorAll('.desk-row-line')].map((one) => one.textContent);
    expect(lines[1]).toBe('Reference: Cheque 004417');
    expect(lines).toHaveLength(2);
  });

  it('says nothing under Amount paid in Mark paid until the amount differs, and nothing in Add a payment already made', async () => {
    signedIn();
    serve({ 'GET /api/events/ev_1/budget/quotes': () => json(quotes()) }, { at });

    const row = (await screen.findByText('Deposit')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Mark paid' }));
    const amount = within(dialog()).getByRole('textbox', { name: 'Amount paid' });
    expect(within(dialog()).queryByText(/the currency this event uses/)).toBeNull();
    expect(amount.closest('.desk-field')!.querySelector('.desk-help')).toBeNull();

    fireEvent.change(amount, { target: { value: '4,400' } });
    expect(amount.closest('.desk-field')!.querySelector('.desk-help')!.textContent).toBe(
      '£100.00 less than scheduled. The difference stays visible; nothing absorbs it.',
    );
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add a payment already made' }));
    expect(within(dialog()).queryByText(/the currency this event uses/)).toBeNull();
    expect(
      within(dialog())
        .getByRole('textbox', { name: 'Amount paid' })
        .closest('.desk-field')!
        .querySelector('.desk-help'),
    ).toBeNull();
  });

  it.each([
    [{ id: 'u_folake', name: 'Folake Adeyemi' }, /^Paid .+\. Added by you as already paid\.$/],
    [{ id: 'u_kofi', name: 'Kofi Mensah' }, /^Paid .+\. Added by Kofi Mensah as already paid\.$/],
  ])(
    'after a downgrade, drops the Undo clause from a payment added as already made, and offers no Undo',
    async (by, line) => {
      signedIn();
      serve(
        {
          'GET /api/events/ev_1/budget/quotes': () =>
            json(
              quotes({
                entitled: false,
                quotes: [{ ...SAVOUR, payments: [markedEarlier, addedEarlier(by)] }],
              }),
            ),
        },
        { at },
      );

      expect(await screen.findByText(line)).toBeTruthy();
      expect(screen.queryByText(/Undo deletes it/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    },
  );

  it('offers no Mark paid, Cancel payment or Add a payment already made after a downgrade', async () => {
    signedIn();
    serve(
      { 'GET /api/events/ev_1/budget/quotes': () => json(quotes({ entitled: false })) },
      { at },
    );

    await screen.findByText('Deposit');
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel payment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a payment already made' })).toBeNull();
  });
});

describe('the inset on Add a payment already made (sc-75579)', () => {
  const at = '/app/events/ev_1/budget/vendors/v4';
  const BLOOM = {
    ...SAVOUR,
    id: 'q_bloom',
    vendor: { ...SAVOUR.vendor, id: 'v3', name: 'Bloom & Co', category: 'flowers' },
    quote: { ...SAVOUR.quote, id: 'qv_bloom', amount: '1000.00' },
    payments: [],
    scheduled: '1050.00',
    difference: '50.00',
    paid: '400.00',
  };
  const both = () => quotes({ quotes: [{ ...SAVOUR, paid: '0.00' }, BLOOM] });
  const dialog = () => screen.getByRole('dialog');
  const row = (title: string) => within(dialog()).getByText(title).closest('li')!;

  it('shows the vendor’s totals as they stand, then with the amount paid, and follows the Vendor', async () => {
    signedIn();
    serve({ 'GET /api/events/ev_1/budget/quotes': () => json(both()) }, { at });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a payment already made' }));
    expect(row('Paid to Savour Kitchen').textContent).toContain('£0.00');
    expect(row('Scheduled').textContent).toContain('£4,500.00');
    expect(row('Scheduled').textContent).not.toContain('→');

    fireEvent.change(within(dialog()).getByRole('textbox', { name: 'Amount paid' }), {
      target: { value: '500' },
    });
    expect(
      within(row('Paid to Savour Kitchen')).getByText('£0.00 now, £500.00 with this payment'),
    ).toBeTruthy();
    expect(
      within(row('Scheduled')).getByText('£4,500.00 now, £5,000.00 with this payment'),
    ).toBeTruthy();
    expect(within(dialog()).queryByText(/over the quote/)).toBeNull();

    fireEvent.change(within(dialog()).getByRole('combobox', { name: 'Vendor' }), {
      target: { value: 'q_bloom' },
    });
    expect(
      within(row('Paid to Bloom & Co')).getByText('£400.00 now, £900.00 with this payment'),
    ).toBeTruthy();
    expect(
      within(row('Scheduled')).getByText('£1,050.00 now, £1,550.00 with this payment'),
    ).toBeTruthy();
    expect(
      within(dialog()).getByText('With this payment, the schedule is £550.00 over the quote.'),
    ).toBeTruthy();
    expect(
      within(dialog()).getByText(/The difference stays visible; nothing absorbs it\./),
    ).toBeTruthy();
    expect(
      (within(dialog()).getByRole('button', { name: 'Add as paid' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('drops the after while the amount is one Add as paid refuses', async () => {
    signedIn();
    serve({ 'GET /api/events/ev_1/budget/quotes': () => json(both()) }, { at });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a payment already made' }));
    for (const value of ['0', 'abc', '-20']) {
      fireEvent.change(within(dialog()).getByRole('textbox', { name: 'Amount paid' }), {
        target: { value },
      });
      expect(row('Scheduled').textContent).toBe('Scheduled£4,500.00');
      expect(within(dialog()).queryByText(/over the quote/)).toBeNull();
    }
  });
});

describe('quotes on an event with no costs yet (sc-74361)', () => {
  const noCosts = () =>
    json(budget({ lines: [], confirmed: '0.00', potential: '0.00', notPriced: 0 }));

  it('shows Due next and Vendors quoted empty under the first-time card, with Add a quote', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget': noCosts,
      'GET /api/events/ev_1/budget/quotes': () => json(quotes({ quotes: [] })),
    });

    expect(await screen.findByText('No quotes on this event yet.')).toBeTruthy();
    expect(screen.getByText('No costs yet')).toBeTruthy();
    expect(screen.getByText('Nothing is due.')).toBeTruthy();
    const first = screen.getByRole('button', { name: 'Add the first cost' });
    const add = screen.getByRole('button', { name: 'Add a quote' });
    expect(first.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(READ_ONLY)).toBeNull();
  });

  it('says in the quote form that there are no budget lines to agree', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget': noCosts,
      'GET /api/events/ev_1/budget/quotes': () => json(quotes({ quotes: [] })),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a quote' }));

    const lines = await screen.findByRole('group', { name: 'Budget lines it agrees' });
    expect(lines.textContent).toContain(
      'This event has no costs yet, so the quote agrees none. Once it has some, correct the quote to add them.',
    );
    expect(within(lines).queryByRole('checkbox')).toBeNull();
  });

  it('keeps a quote and its overdue payment on the page', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget': noCosts,
      'GET /api/events/ev_1/budget/quotes': () =>
        json(
          quotes({
            due: [
              {
                id: 'p_deposit',
                quoteId: 'q_savour',
                vendor: 'Savour Kitchen',
                description: 'Deposit',
                amount: '4500.00',
                dueOn: '2020-11-04',
                overdue: true,
              },
            ],
          }),
        ),
    });

    const quoted = await screen.findByRole('region', { name: 'Vendors quoted' });
    expect(within(quoted).getByText('Savour Kitchen')).toBeTruthy();
    expect(screen.getByText('No costs yet')).toBeTruthy();
    const due = screen.getByRole('region', { name: 'Due next' });
    expect(within(due).getByText(/Deposit/u)).toBeTruthy();
    expect(within(due).getByText('Overdue')).toBeTruthy();
  });

  it('keeps quotes readable after a downgrade, with the read-only line and no Add a quote', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget': noCosts,
      'GET /api/events/ev_1/budget/quotes': () => json(quotes({ entitled: false })),
    });

    expect(await screen.findByText(READ_ONLY)).toBeTruthy();
    expect(screen.getByText('Savour Kitchen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a quote' })).toBeNull();
  });

  it('shows the first-time page alone without vendors and with no quote', async () => {
    signedIn();
    const sent = serve({
      'GET /api/events/ev_1/budget': noCosts,
      'GET /api/events/ev_1/budget/quotes': () => json(quotes({ entitled: false, quotes: [] })),
    });

    expect(await screen.findByText('No costs yet')).toBeTruthy();
    await waitFor(() =>
      expect(sent.some((one) => one.line === 'GET /api/events/ev_1/budget/quotes')).toBe(true),
    );
    await act(async () => {});
    expect(screen.queryByText(READ_ONLY)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Due next' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Vendors quoted' })).toBeNull();
  });

  it('keeps both blocks in place with Try again when the quotes did not load', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget': noCosts,
      'GET /api/events/ev_1/budget/quotes': () => problem(500, 'internal_error'),
    });

    expect(await screen.findAllByText(NOT_LOADED)).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Due next' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Vendors quoted' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add the first cost' })).toBeTruthy();
  });

  it('keeps the bar with Undo above No costs yet, and both blocks, when the last cost goes with a quote on the event', async () => {
    signedIn();
    let lines = [DINNER];
    serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines })),
      'GET /api/events/ev_1/budget/quotes': () => json(quotes()),
      'DELETE /api/events/ev_1/budget/lines/dinner': () => {
        lines = [];
        return new Response(null, { status: 204 });
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner\./u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    const none = await screen.findByText('No costs yet');
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.compareDocumentPosition(none) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Due next' })).toBeTruthy();
    const quoted = screen.getByRole('region', { name: 'Vendors quoted' });
    expect(within(quoted).getByText('Savour Kitchen')).toBeTruthy();
  });

  it('keeps Due next and Vendors quoted in the right column beside the first cost once it is added', async () => {
    signedIn();
    let lines: unknown[] = [];
    const drinks = costed('drinks', 'Welcome drinks', { rate: '12.00' }, '1152.00', '1596.00');
    serve({
      'GET /api/events/ev_1/budget': () => json(budget({ lines, notPriced: 0 })),
      'GET /api/events/ev_1/budget/quotes': () => json(quotes()),
      'POST /api/events/ev_1/budget/lines': () => {
        lines = [drinks];
        return json({ line: drinks }, 201);
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add the first cost' }));
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

    const row = await screen.findByRole('button', { name: /^Welcome drinks\./u });
    expect(screen.queryByText('No costs yet')).toBeNull();
    const right = screen.getByRole('region', { name: 'Vendors quoted' }).closest('.ev-right');
    expect(right?.contains(screen.getByRole('region', { name: 'Due next' }))).toBe(true);
    expect(right?.parentElement?.querySelector('.ev-left')?.contains(row)).toBe(true);
  });

  it('says in Correct that there are no budget lines to agree', async () => {
    signedIn();
    serve(
      {
        'GET /api/events/ev_1/budget': noCosts,
        'GET /api/events/ev_1/budget/quotes': () => json(quotes()),
      },
      { at: '/app/events/ev_1/budget/vendors/v4' },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Correct the quote' }));

    const dialog = await screen.findByRole('dialog', { name: 'Correct the quote' });
    const lines = within(dialog).getByRole('group', { name: 'Budget lines it agrees' });
    expect(lines.textContent).toContain(
      'This event has no costs yet, so the quote agrees none. Once it has some, correct the quote to add them.',
    );
    expect(within(lines).queryByRole('checkbox')).toBeNull();
  });
});

describe('a schedule from the vendor’s terms (sc-1332)', () => {
  const at = '/app/events/ev_1/budget/vendors/v4';
  const UNPAID = { ...SAVOUR, payments: [], scheduled: '0.00', difference: '-9000.00' };
  const THREE = [
    { description: 'Deposit', amount: '4500.00', currency: 'GBP', dueOn: '2026-10-13' },
    { description: 'Second instalment', amount: '2700.00', currency: 'GBP', dueOn: '2030-09-15' },
    { description: 'Balance', amount: '1800.00', currency: 'GBP', dueOn: '2030-10-31' },
  ];

  async function chooseInstalments(answer: Answer) {
    signedIn();
    const sent = serve(
      {
        'GET /api/events/ev_1/budget/quotes': () => json(quotes({ quotes: [UNPAID] })),
        'POST /api/events/ev_1/budget/quotes/q_savour/schedule': answer,
      },
      { at },
    );
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add a payment' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Add a payment' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Three instalments' }));

    return { sent, dialog };
  }

  const scheduled = (sent: { line: string; body: unknown }[]) =>
    sent.filter((one) => one.line === 'POST /api/events/ev_1/budget/quotes/q_savour/schedule');
  const quotesRead = (sent: { line: string }[]) =>
    sent.filter((one) => one.line === 'GET /api/events/ev_1/budget/quotes').length;

  it.each([
    [
      'offers the shapes when every payment is cancelled',
      { cancelled: { at: '', by: null, reason: 'Venue includes it' } },
      1,
    ],
    ['offers no shapes once a payment was added as already made', { addedAsPaid: true }, 0],
  ])('%s', async (_, over, offered) => {
    signedIn();
    const payment = { ...SAVOUR.payments[0]!, ...over };
    serve(
      {
        'GET /api/events/ev_1/budget/quotes': () =>
          json(quotes({ quotes: [{ ...SAVOUR, payments: [payment] }] })),
      },
      { at },
    );
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add a payment' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Add a payment' });

    expect(within(dialog).queryAllByRole('radio', { name: 'Three instalments' })).toHaveLength(
      offered,
    );
  });

  it('Save 3 payments sends the rows the shape computed, all at once', async () => {
    const { sent, dialog } = await chooseInstalments(() => json(UNPAID, 201));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save 3 payments' }));

    await waitFor(() => expect(scheduled(sent)).toHaveLength(1));
    expect(scheduled(sent)[0]?.body).toEqual({ payments: THREE });
  });

  it('refuses a percentage of 0 at its field and sends nothing', async () => {
    const { sent, dialog } = await chooseInstalments(() => json(UNPAID, 201));

    fireEvent.change(within(dialog).getAllByLabelText('Percentage of the quote')[1]!, {
      target: { value: '0' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save 3 payments' }));

    expect(
      await within(dialog).findByText(
        'Enter a percentage above 0 and up to 100, with up to two decimal places.',
      ),
    ).toBeTruthy();
    expect(scheduled(sent)).toHaveLength(0);
  });

  it('says another tab scheduled payments first, and reads the quotes again', async () => {
    const { sent, dialog } = await chooseInstalments(() =>
      problem(409, 'payments_already_scheduled'),
    );
    const before = quotesRead(sent);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save 3 payments' }));

    expect(
      await within(dialog).findByText(
        'Payments were added to this vendor’s schedule while you were filling this in, so none of yours were saved. Check the payments it has now before adding more.',
      ),
    ).toBeTruthy();
    await waitFor(() => expect(quotesRead(sent)).toBeGreaterThan(before));
  });

  it('keeps the rows as filled in and says none were saved when the send fails', async () => {
    const { dialog } = await chooseInstalments(() => {
      throw new TypeError('Failed to fetch');
    });
    fireEvent.change(within(dialog).getAllByLabelText('Percentage of the quote')[0]!, {
      target: { value: '40' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save 3 payments' }));

    expect(
      await within(dialog).findByText(
        'None of these payments were saved, because they could not be sent. Your rows are kept as you filled them in; select Save 3 payments to send them again.',
      ),
    ).toBeTruthy();
    expect(
      (within(dialog).getAllByLabelText('Percentage of the quote')[0] as HTMLInputElement).value,
    ).toBe('40');
  });
});

describe('the crumbs of the Budget and Staff rates in every language (sc-79848)', () => {
  it('wraps them whole at word breaks rather than truncating them', () => {
    expect(cssRule('.bt .ev-crumb ol', BUDGET_CSS)).toContain('flex-wrap: wrap;');
    expect(cssRule('.bt .ev-crumb-part', BUDGET_CSS)).toContain('min-width: auto;');
    expect(cssRule('.bt .ev-crumb-part', BUDGET_CSS)).toContain('overflow-wrap: break-word;');
    expect(cssRule('.bt .ev-crumb-name', BUDGET_CSS)).toContain('white-space: normal;');
  });
});
