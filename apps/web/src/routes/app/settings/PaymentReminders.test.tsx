import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { atWideWidth } from '../../../test-widths.ts';
import { routes } from '../../index.tsx';
import { typedDays } from './paymentReminders.ts';

const MEMBER = membership({
  role: { id: 'role_3', seededAs: 'member', name: null },
  permissions: ['events.read', 'vendors.read'],
});

function signedIn(organisation = membership()): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    userId: 'u1',
    needsOrganisation: false,
    organisation,
    organisations: [organisation],
    organisationCountry: null,
    timezone: 'Africa/Lagos',
    waitingFor: null,
    hasPassword: true,
    providers: [],
  };

  __setSessionState({ status: 'signedIn', session });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function answering(answers: Record<string, (body: unknown) => Response>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    sent.push({ line, body });
    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer(body);
  });

  return sent;
}

function open() {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, {
        initialEntries: ['/app/settings/vendors/payment-reminders'],
      })}
    />,
  );
}

const SETTING = 'GET /api/orgs/org_1/payment-reminders';
const CHANGE = 'PUT /api/orgs/org_1/payment-reminders';

beforeEach(() => {
  atWideWidth();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings › Vendors › Payment reminders (sc-95)', () => {
  it('says when reminders go and who hears, with no count', async () => {
    signedIn();
    answering({ [SETTING]: () => json({ days: 3, inForce: true }) });
    open();

    expect(await screen.findByRole('heading', { name: 'Payment reminders' })).toBeDefined();
    expect(
      screen.getByText('3 days before a payment is due, and once the day after, then silence.'),
    ).toBeDefined();
    expect(
      screen.getByText('The organisation’s owners and admins, and each event’s lead.'),
    ).toBeDefined();
    expect(
      screen.getByText('Marking a payment paid or cancelling it stops its reminders.'),
    ).toBeDefined();
  });

  it('refuses days outside 1 to 30 at the field, then saves a whole number', async () => {
    signedIn();
    const sent = answering({
      [SETTING]: () => json({ days: 3, inForce: true }),
      [CHANGE]: () => json({ days: 5, inForce: true }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    const field = await screen.findByLabelText('Days before a payment is due');
    fireEvent.change(field, { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter a whole number of days from 1 to 30.')).toBeDefined();
    expect(sent.some((one) => one.line === CHANGE)).toBe(false);

    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        '5 days before a payment is due, and once the day after, then silence.',
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.line === CHANGE)?.body).toEqual({ days: 5 });
  });

  it('saves on Enter in the days field', async () => {
    signedIn();
    const sent = answering({
      [SETTING]: () => json({ days: 3, inForce: true }),
      [CHANGE]: () => json({ days: 7, inForce: true }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    const field = await screen.findByLabelText('Days before a payment is due');
    fireEvent.change(field, { target: { value: '7' } });
    fireEvent.submit(field.closest('form') ?? field);

    expect(
      await screen.findByText(
        '7 days before a payment is due, and once the day after, then silence.',
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.line === CHANGE)?.body).toEqual({ days: 7 });
  });

  it('says reminders are off, and why, after a downgrade', async () => {
    signedIn();
    answering({ [SETTING]: () => json({ days: 3, inForce: false }) });
    open();

    expect(await screen.findByRole('heading', { name: 'Payment reminders are off' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
  });

  it('refuses a Member, as Vendors refuses one', async () => {
    signedIn(MEMBER);
    const sent = answering({});
    open();

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Payment reminders' })).toBeNull(),
    );
    expect(sent.some((one) => one.line === SETTING)).toBe(false);
  });
});

describe('typedDays', () => {
  it('takes a whole number from 1 to 30 and nothing else', () => {
    expect([' 1 ', '30', '3'].map(typedDays)).toEqual([1, 30, 3]);
    expect(['', '0', '31', '2.5', 'three', '-1'].map(typedDays)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
