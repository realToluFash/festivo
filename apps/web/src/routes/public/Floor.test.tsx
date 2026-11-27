import type { FloorRead, ServiceGuestRead, ServiceTableRead } from '@soirely/domain';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { tokens } from '../../tokens.ts';
import { routes } from '../index.tsx';

const NO_FLAGS = { allergens: [], allergenOther: null, diet: [], dietOther: null };

function guest(
  id: string,
  seat: number,
  name: string,
  stage: 'served' | 'toServe',
  held = false,
): ServiceGuestRead {
  return {
    id,
    seat,
    name,
    flags: NO_FLAGS,
    noOrder: null,
    order: {
      id: `plate-${id}`,
      guestId: id,
      courseId: 'main',
      isOrder: true,
      stage,
      items: [{ key: 'curry', name: 'Goat curry', state: 'preparing' }],
      trayId: null,
      owedReason: null,
      sentBack: [],
      held,
      holding: held ? ['curry'] : [],
      choice: null,
      owed: [],
    },
  };
}

function table(name: string, section: string, guests: ServiceGuestRead[]): ServiceTableRead {
  return {
    key: name,
    kind: 'table',
    name,
    seats: guests.length,
    section: { id: section, name: `Section ${section}` },
    people: [{ id: 'staff', name: 'Bisi Lawal' }],
    firedAt: '2026-11-27T19:00:00Z',
    guests,
  };
}

const FLOOR: FloorRead = {
  yours: [{ id: 'B', name: 'Section B' }],
  floorLead: 'Ifeoma Nduka',
  manage: false,
  courses: [
    {
      phase: 'on',
      course: { id: 'main', name: 'Main' },
      items: [{ key: 'curry', name: 'Goat curry', state: 'preparing', readyIn: 4 }],
      trays: [],
      tables: [
        table('Table 10', 'B', [guest('a', 1, 'Ada Obi', 'served')]),
        table('Table 2', 'B', [guest('k', 1, 'Kemi Oke', 'toServe', true)]),
        table('Table 3', 'C', [guest('t', 1, 'Tunde Ade', 'served')]),
      ],
    },
  ],
};

let sent: string[] = [];

function open(floor: FloorRead = FLOOR, status = 200) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (init?.method === 'PUT' || init?.method === 'POST')
      sent.push(`${path} ${String(init.body ?? '')}`);

    return new Response(JSON.stringify(path.endsWith('/service/floor') ? floor : {}), {
      status: path.endsWith('/service/floor') ? status : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/floor/e1'] })} />);
}

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('Floor in the browser (sc-4021)', () => {
  beforeEach(() => {
    sent = [];
    tokens.clear();
    localStorage.clear();
    __setSessionState({ status: 'signedOut', ended: false });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists yours first, Table 2 before Table 10, each row one button read in full', async () => {
    open();

    await screen.findByRole('heading', { name: 'Yours · Section B' });
    expect(
      screen
        .getAllByRole('button', { name: /^Table / })
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual([
      'Table 2, Waiting on the kitchen, 0 of 1 served, 1 cover',
      'Table 10, Served, 1 of 1 served, 1 cover',
      'Table 3, Served, 1 of 1 served, 1 cover, Section C',
    ]);
  });

  it('says it did not load when the read is refused', async () => {
    open(FLOOR, 403);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Table / })).toBeNull();
  });

  it('marks a held guest’s choice, and offers no What’s ready with nothing ready', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));

    expect(screen.queryByRole('button', { name: 'What’s ready, now' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Wait for all' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('keeps a sent-back plate with its reason until it can send, once a reason is chosen', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 10,/ }));
    press('Send back');

    const sheet = screen.getByRole('dialog');
    const send = within(sheet).getByRole('button', { name: 'Send back' });
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(within(sheet).getByRole('radio', { name: /Dropped/ }));
    fireEvent.click(send);

    // No hub in this test, so the strip has no connection and the tap waits (sc-4028).
    await screen.findByText('Waiting to send');
    await waitFor(() => expect(JSON.stringify({ ...localStorage })).toContain('dropped'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('draws no action at a table the person may not write at', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 3,/ }));

    expect(screen.getByRole('heading', { name: 'Table 3' })).toBeTruthy();
    expect(screen.getByText('On it · Section C · Bisi Lawal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send back' })).toBeNull();
  });

  it('keeps no guest’s name in the browser', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 10,/ }));
    press('Send back');
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('radio', { name: /Dropped/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send back' }));
    await waitFor(() => expect(JSON.stringify({ ...localStorage })).toContain('dropped'));

    expect(JSON.stringify({ ...localStorage })).not.toContain('Ada Obi');
  });
});
