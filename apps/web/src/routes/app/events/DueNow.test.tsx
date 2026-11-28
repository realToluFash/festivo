import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type InitialEntry, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

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

const WEDDING = { id: 'ev_1', name: 'Adaeze & Tunde', currency: 'GBP', today: '2026-11-03' };
const GALA = { id: 'ev_2', name: 'Gala Fundación Lucía', currency: 'EUR', today: '2026-11-03' };

function payment(id: string, description: string, amount: string, dueOn: string, fields = {}) {
  return {
    id,
    description,
    amount,
    dueOn,
    overdue: dueOn < '2026-11-03',
    addedAsPaid: false,
    paid: null,
    cancelled: null,
    ...fields,
  };
}

const PAID_BY_JULIEN = {
  paid: {
    amount: '840.00',
    paidOn: '2026-11-02',
    reference: null,
    at: '2026-11-02T10:00:00+00:00',
    by: { id: 'u_julien', name: 'Julien Moreau' },
    difference: '0.00',
  },
};

function row(
  paymentId: string,
  vendor: string,
  description: string,
  amount: string,
  owed: unknown,
  eventId = 'ev_1',
) {
  return { paymentId, eventId, vendor, description, amount, payment: owed };
}

function sheet(rows: unknown[], fields = {}) {
  return { sentOn: '2026-11-01', readOnly: false, events: [WEDDING], rows, ...fields };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const problem = (status: number, type: string, detail?: string) =>
  new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${type}`, title: type, status, detail }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

function serve(
  answers: Record<string, (body: unknown) => Response>,
  initialEntries: InitialEntry[] = ['/app/due/r_1'],
) {
  const sent: { line: string; body: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    return answers[line]?.(body) ?? json({});
  });
  const router = createMemoryRouter(routes, {
    initialEntries,
    initialIndex: initialEntries.length - 1,
  });
  const { container } = render(<RouterProvider router={router} />);

  return Object.assign(sent, { router, container });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Due now, from a payment reminder (sc-1331)', () => {
  it('lists what the reminder named and marks one paid in one tap with sc-88’s defaults', async () => {
    signedIn();
    let deposit: unknown = payment('p6', 'Deposit', '840.00', '2026-10-30');
    const sent = serve({
      'GET /api/payment-reminders/r_1': () =>
        json(
          sheet([
            row('p6', 'Savour Kitchen', 'Deposit', '840.00', deposit),
            row(
              'p7',
              'Bloom & Co',
              'Flowers',
              '300.00',
              payment('p7', 'Flowers', '300.00', '2026-11-04'),
            ),
          ]),
        ),
      'POST /api/events/ev_1/budget/payments/p6/paid': () => {
        deposit = payment('p6', 'Deposit', '840.00', '2026-10-30', {
          ...PAID_BY_JULIEN,
          paid: { ...PAID_BY_JULIEN.paid, by: { id: 'u_folake', name: 'Folake Adeyemi' } },
        });
        return json({ quote: {} });
      },
    });

    expect(await screen.findByText('From the reminder sent Nov 1 · 2 payments')).toBeTruthy();
    expect(screen.getByText('Deposit · Overdue since Fri, Oct 30 · Adaeze & Tunde')).toBeTruthy();
    expect(screen.getByText('Flowers · Due Wed, Nov 4 · Adaeze & Tunde')).toBeTruthy();
    expect(sent.some(({ line }) => line.startsWith('POST'))).toBe(false);

    fireEvent.click(screen.getAllByRole('button', { name: 'Paid' })[0]!);

    expect(await screen.findByText('Marked paid · £840.00')).toBeTruthy();
    expect(
      sent.find(({ line }) => line === 'POST /api/events/ev_1/budget/payments/p6/paid')?.body,
    ).toEqual({
      amount: '840.00',
      currency: 'GBP',
      paidOn: '2026-11-03',
      reference: '',
    });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.queryByText('Nothing left to pay from this reminder')).toBeNull();
  });

  it('says how each row changed since, with no Paid on any of them, and settles with a link per event', async () => {
    signedIn();
    serve({
      'GET /api/payment-reminders/r_1': () =>
        json(
          sheet(
            [
              row(
                'p6',
                'Savour Kitchen',
                'Deposit',
                '840.00',
                payment('p6', 'Deposit', '840.00', '2026-11-04', PAID_BY_JULIEN),
              ),
              row(
                'p7',
                'Bloom & Co',
                'Flowers',
                '300.00',
                payment('p7', 'Flowers', '300.00', '2026-11-04', {
                  cancelled: { at: '', by: null, reason: null },
                }),
              ),
              row('p9', 'Lens & Light', 'Album', '350.00', null),
              row(
                'g1',
                'Floristería Lirio',
                'Balance',
                '1200.00',
                payment('g1', 'Balance', '1200.00', '2026-11-06', PAID_BY_JULIEN),
                'ev_2',
              ),
            ],
            { events: [WEDDING, GALA] },
          ),
        ),
    });

    expect(
      await screen.findByText('From the reminder sent Nov 1 · 4 payments across 2 events'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Deposit · Due Wed, Nov 4 · Adaeze & Tunde · Paid by Julien Moreau on Nov 2',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Flowers · Due Wed, Nov 4 · Adaeze & Tunde · Cancelled')).toBeTruthy();
    expect(screen.getByText('Album · Adaeze & Tunde · No longer on the schedule')).toBeTruthy();
    expect(screen.getByText('£350.00')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Paid' })).toBeNull();
    expect(screen.getByText('Nothing left to pay from this reminder')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Everything due on Adaeze & Tunde' }).getAttribute('href'),
    ).toBe('/app/events/ev_1/budget/due');
    expect(
      screen
        .getByRole('link', { name: 'Everything due on Gala Fundación Lucía' })
        .getAttribute('href'),
    ).toBe('/app/events/ev_2/budget/due');
  });

  it('marking the last row settles the sheet, and its Undo takes the line and the link away again', async () => {
    signedIn();
    let deposit: unknown = payment('p6', 'Deposit', '840.00', '2026-11-04');
    const sent = serve({
      'GET /api/payment-reminders/r_1': () =>
        json(sheet([row('p6', 'Savour Kitchen', 'Deposit', '840.00', deposit)])),
      'POST /api/events/ev_1/budget/payments/p6/paid': () => {
        deposit = payment('p6', 'Deposit', '840.00', '2026-11-04', PAID_BY_JULIEN);
        return json({ quote: {} });
      },
      'DELETE /api/events/ev_1/budget/payments/p6/paid': () => {
        deposit = payment('p6', 'Deposit', '840.00', '2026-11-04');
        return json({ quote: {} });
      },
    });

    expect(await screen.findByText('From the reminder sent Nov 1 · 1 payment')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Paid' }));
    expect(await screen.findByText('Nothing left to pay from this reminder')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Everything due on Adaeze & Tunde' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: 'Paid' })).toBeTruthy();
    expect(screen.queryByText('Nothing left to pay from this reminder')).toBeNull();
    expect(
      sent.some(({ line }) => line === 'DELETE /api/events/ev_1/budget/payments/p6/paid'),
    ).toBe(true);
  });

  it('a tap someone beat shows the row as it is now with sc-88’s words under it, and the others keep Paid', async () => {
    signedIn();
    let deposit: unknown = payment('p6', 'Deposit', '840.00', '2026-11-04');
    serve({
      'GET /api/payment-reminders/r_1': () =>
        json(
          sheet([
            row('p6', 'Savour Kitchen', 'Deposit', '840.00', deposit),
            row(
              'p7',
              'Bloom & Co',
              'Flowers',
              '300.00',
              payment('p7', 'Flowers', '300.00', '2026-11-04'),
            ),
          ]),
        ),
      'POST /api/events/ev_1/budget/payments/p6/paid': () => {
        deposit = payment('p6', 'Deposit', '840.00', '2026-11-04', PAID_BY_JULIEN);
        return problem(
          409,
          'payment_already_paid',
          'Julien Moreau has already marked this paid, so nothing has changed.',
        );
      },
    });

    fireEvent.click((await screen.findAllByRole('button', { name: 'Paid' }))[0]!);

    expect((await within(await screen.findByRole('dialog')).findByRole('alert')).textContent).toBe(
      'Julien Moreau has already marked this paid, so nothing has changed.',
    );
    expect(
      await screen.findByText(
        'Deposit · Due Wed, Nov 4 · Adaeze & Tunde · Paid by Julien Moreau on Nov 2',
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Paid' })).toHaveLength(1);
  });

  it('a tap refused for the plan turns the whole sheet read only, rows marked earlier keeping Marked paid', async () => {
    signedIn();
    let deposit: unknown = payment('p6', 'Deposit', '840.00', '2026-11-04');
    serve({
      'GET /api/payment-reminders/r_1': () =>
        json(
          sheet([
            row('p6', 'Savour Kitchen', 'Deposit', '840.00', deposit),
            row(
              'p7',
              'Bloom & Co',
              'Flowers',
              '300.00',
              payment('p7', 'Flowers', '300.00', '2026-11-04'),
            ),
          ]),
        ),
      'POST /api/events/ev_1/budget/payments/p6/paid': () => {
        deposit = payment('p6', 'Deposit', '840.00', '2026-11-04', PAID_BY_JULIEN);
        return json({ quote: {} });
      },
      'POST /api/events/ev_1/budget/payments/p7/paid': () => problem(403, 'plan_required'),
    });

    fireEvent.click((await screen.findAllByRole('button', { name: 'Paid' }))[0]!);
    await screen.findByText('Marked paid · £840.00');
    fireEvent.click(screen.getByRole('button', { name: 'Paid' }));

    expect((await within(await screen.findByRole('dialog')).findByRole('alert')).textContent).toBe(
      'Payments cannot be marked paid on this organisation’s plan, so nothing has changed.',
    );
    expect(
      screen.getByText(/read-only because this organisation’s plan no longer includes them/),
    ).toBeTruthy();
    expect(screen.getByText('Marked paid · £840.00')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Paid' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Paid a different amount' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('read only after a downgrade offers nothing to tap and asks for no upgrade', async () => {
    signedIn();
    serve({
      'GET /api/payment-reminders/r_1': () =>
        json(
          sheet(
            [
              row(
                'p6',
                'Savour Kitchen',
                'Deposit',
                '840.00',
                payment('p6', 'Deposit', '840.00', '2026-11-04'),
              ),
            ],
            { readOnly: true },
          ),
        ),
    });

    expect(await screen.findByText(/read-only because this organisation’s plan/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Paid' })).toBeNull();
    expect(screen.queryByText(/upgrade/i)).toBeNull();
  });

  it('a reminder it cannot find, or one the reader may not see, says only that', async () => {
    signedIn();
    serve({ 'GET /api/payment-reminders/r_1': () => problem(404, 'not_found') });

    expect(await screen.findByText('We cannot find these payments.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to your events' }).getAttribute('href')).toBe(
      '/app/events',
    );
  });

  it('a failed read offers Try again, which says it is loading, then shows the rows', async () => {
    signedIn();
    let reads = 0;
    serve({
      'GET /api/payment-reminders/r_1': () => {
        reads += 1;

        return reads === 1
          ? problem(500, 'internal')
          : json(
              sheet([
                row(
                  'p1',
                  'Savour Kitchen',
                  'Deposit',
                  '840.00',
                  payment('p1', 'Deposit', '840.00', '2026-11-04'),
                ),
              ]),
            );
      },
    });

    const dialog = await screen.findByRole('dialog');
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'These payments did not load. Check your connection and try again.',
    );
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));

    expect(within(dialog).getByRole('status').textContent).toBe('Loading the payments…');
    expect(within(dialog).queryByRole('button', { name: 'Paid' })).toBeNull();
    expect(await within(dialog).findByRole('button', { name: 'Paid' })).toBeTruthy();
  });

  it('Paid a different amount opens sc-88’s own Mark paid form for that payment', async () => {
    signedIn();
    const deposit = payment('p6', 'Deposit', '840.00', '2026-11-04');
    serve({
      'GET /api/payment-reminders/r_1': () =>
        json(sheet([row('p6', 'Savour Kitchen', 'Deposit', '840.00', deposit)])),
      'GET /api/events/ev_1/budget/quotes': () =>
        json({
          currency: 'GBP',
          timeZone: 'Europe/London',
          entitled: true,
          quotes: [
            {
              id: 'q1',
              vendor: {
                id: 'v1',
                name: 'Savour Kitchen',
                category: 'catering',
                contactName: null,
                archived: false,
              },
              quote: {
                id: 'qv1',
                covers: 'Dinner',
                amount: '840.00',
                quotedOn: '2026-10-01',
                reference: null,
                supersededAt: null,
              },
              earlier: [],
              lines: [],
              payments: [deposit],
            },
          ],
          due: [],
          totals: {},
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Paid a different amount' }));

    expect(await screen.findByRole('heading', { name: 'Mark paid' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Amount paid')).toBeTruthy());
  });

  it('Close goes back to the page that was open before the sheet', async () => {
    signedIn();
    const { router } = serve({ 'GET /api/payment-reminders/r_1': () => json(sheet([])) }, [
      '/app/calendar',
      '/app/due/r_1',
    ]);

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/calendar'));
  });

  it('Close on a sheet the link opened cold goes to Today', async () => {
    signedIn();
    const { router } = serve({ 'GET /api/payment-reminders/r_1': () => json(sheet([])) });

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('sits over the page that was open when it is opened from inside the desk', async () => {
    signedIn();
    const events = { pathname: '/app/events', search: '', hash: '', state: null, key: 'k1' };
    const { container } = serve({ 'GET /api/payment-reminders/r_1': () => json(sheet([])) }, [
      events,
      { pathname: '/app/due/r_1', state: { under: events } },
    ]);

    expect(await screen.findByRole('button', { name: 'Close' })).toBeTruthy();
    await waitFor(() => expect(container.querySelector('.desk.ev')).not.toBeNull());
  });

  it('a payment no quote holds any more says it was not marked, under its row', async () => {
    signedIn();
    serve({
      'GET /api/payment-reminders/r_1': () =>
        json(
          sheet([
            row(
              'p6',
              'Savour Kitchen',
              'Deposit',
              '840.00',
              payment('p6', 'Deposit', '840.00', '2026-11-04'),
            ),
          ]),
        ),
      'GET /api/events/ev_1/budget/quotes': () =>
        json({ currency: 'GBP', timeZone: 'Europe/London', entitled: true, quotes: [], due: [] }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Paid a different amount' }));

    expect(
      (await screen.findAllByText('This payment was not marked paid. Try again in a moment.'))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Mark paid' })).toBeNull();
  });
});
