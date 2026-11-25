import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../../session.ts';
import { __forgetTab } from '../../../tabKept.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-14T16:00:00+01:00',
  endsAt: '2030-11-14T23:30:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 1,
  currency: 'NGN',
  cover: null,
  venue: { name: 'Eko Hotel', address: null },
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: IRE.permissions,
};

/** As DoorCodesController answers a card (PR #3354's contract). */
const CARD = {
  id: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
  code: 'K7P2QX9M',
  link: 'https://soirely.test/d/K7P2QX9M',
  qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  role: 'can_check_in',
  jobLabel: 'Bar and drinks',
  useCap: 30,
  used: 14,
  status: 'working',
  expiresAt: '2030-11-14T23:30:00+01:00',
  stoppedAt: null,
  createdAt: '2026-11-07T16:00:00+00:00',
};

/** A row of GET /api/events/{id}/people for someone who came in by a code. */
const JOAO = {
  id: 'p_joao',
  membershipId: null,
  user: { id: 'u_joao', name: 'João Pereira' },
  role: 'can_check_in',
  jobLabel: 'Bar and drinks',
  outside: true,
  address: null,
  addressKind: null,
  endsAt: EVENT.endsAt,
  doorCode: 'K7P2QX9M',
  joinedAt: '2030-11-14T13:34:00+01:00',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

type Answer = (body: unknown) => Response | Promise<Response>;

async function onPeople(
  codes: unknown[],
  answers: Record<string, Answer> = {},
): Promise<{ line: string; body: unknown }[]> {
  __setSessionState({
    status: 'signedIn',
    session: {
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
    },
  });
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: EVENT });
    if (line === 'GET /api/events/ev_1/people')
      return json({ people: [JOAO], owners: ['Folake Adeyemi'], admins: [] });
    if (line === 'GET /api/events/ev_1/people/addable') return json({ members: [] });
    if (line === 'GET /api/events/ev_1/door-codes') return json({ doorCodes: codes });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/people'] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'People' });
  await waitFor(() => expect(document.querySelector('.people-foot')).not.toBeNull());

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
  __forgetTab();
});

describe('door codes on People, at a desk (sc-72)', () => {
  it('offers the first code when there is none', async () => {
    await onPeople([]);

    expect(screen.getByText('No door code yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make a door code' })).toBeDefined();
  });

  it('shows a working code’s card, its count and what is under it', async () => {
    await onPeople([CARD]);

    expect(screen.getByText('Door code · Can check guests in · Bar and drinks')).toBeDefined();
    expect(screen.getByText('K7P2 QX9M')).toBeDefined();
    expect(screen.getByText('Door code K 7 P 2, Q X 9 M')).toBeDefined();
    expect(screen.getByText(/^14 of 30 used · until .*23:30$/u)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Show the code' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Print' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make a new code' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Stop this code' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make another door code' })).toBeDefined();
  });

  it('ends the row of someone who came in by a code with Door code, and says when in their dialog', async () => {
    await onPeople([CARD]);
    const row = screen.getByRole('button', { name: /João Pereira/u });

    expect(row.textContent).toContain('Can check guests in · Bar and drinks · Door code');

    fireEvent.click(row);
    const dialog = await screen.findByRole('dialog', { name: 'Role on this event' });

    expect(
      within(dialog).getByText(/^Joined with the door code K7P2 QX9M at .*13:34\.$/u),
    ).toBeDefined();
    expect(within(dialog).getByText('Their access ends when the event does.')).toBeDefined();
  });

  it('checks the number before it sends, then makes a code ending when the event does', async () => {
    const sent = await onPeople([], {
      'POST /api/events/ev_1/door-codes': () => json({ doorCode: { ...CARD, used: 0 } }, 201),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Make a door code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Door code' });

    expect(within(dialog).getByRole('radio', { name: /Can view/u })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(dialog).getByRole('radio', { name: /Can edit/u })).toHaveProperty(
      'disabled',
      true,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Make' }));
    expect(within(dialog).getByText('Enter how many people can use this code.')).toBeDefined();

    fireEvent.change(within(dialog).getByLabelText('How many people'), {
      target: { value: '3000' },
    });
    expect(within(dialog).getByText('Use a whole number from 1 to 500.')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/door-codes')).toBe(false);

    fireEvent.change(within(dialog).getByLabelText('How many people'), {
      target: { value: '30' },
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Can check guests in/u }));
    fireEvent.change(within(dialog).getByLabelText('Job label (optional)'), {
      target: { value: 'Bar and drinks' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make' }));

    expect(await screen.findByText('Door code made.')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/door-codes')?.body).toEqual({
      role: 'can_check_in',
      jobLabel: 'Bar and drinks',
      useCap: 30,
      expiresAt: '2030-11-14T22:30:00.000Z',
    });
    expect(screen.getByText('K7P2 QX9M')).toBeDefined();
  });

  it('refuses an earlier end that has already passed, at Time, and sends nothing', async () => {
    const sent = await onPeople([]);

    fireEvent.click(screen.getByRole('button', { name: 'Make a door code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Door code' });
    fireEvent.change(within(dialog).getByLabelText('How many people'), {
      target: { value: '30' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Ends/u }));
    fireEvent.click(within(dialog).getByRole('menuitemradio', { name: /Earlier/u }));

    const day = within(dialog).getByLabelText('Day') as HTMLSelectElement;
    const today = day.options[0]?.value ?? '';
    fireEvent.change(day, { target: { value: today } });
    const time = within(dialog).getByLabelText('Time') as HTMLSelectElement;
    fireEvent.change(time, { target: { value: '00:00' } });
    expect(time.value).toBe('00:00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make' }));

    expect(within(dialog).getByText('Choose a time that has not passed yet.')).toBeDefined();
    expect(document.activeElement).toBe(time);
    expect(time.getAttribute('aria-invalid')).toBe('true');
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/door-codes')).toBe(false);
  });

  it('says the code was not made when the request does not arrive, and keeps the form', async () => {
    await onPeople([], {
      'POST /api/events/ev_1/door-codes': () => Promise.reject(new TypeError('offline')),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Make a door code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Door code' });
    fireEvent.change(within(dialog).getByLabelText('How many people'), {
      target: { value: '30' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make' }));

    expect(
      await within(dialog).findByText(
        'The door code was not made. Check your connection and try again.',
      ),
    ).toBeDefined();
    expect(within(dialog).getByLabelText('How many people')).toHaveProperty('value', '30');
  });

  it('stops a code after asking, and everyone already in keeps their access', async () => {
    const sent = await onPeople([CARD], {
      [`POST /api/events/ev_1/door-codes/${CARD.id}/stop`]: () =>
        json({ doorCode: { ...CARD, status: 'stopped', stoppedAt: '2030-11-14T20:00:00+01:00' } }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop this code' }));
    const ask = screen.getByRole('alertdialog', { name: 'Stop this code?' });

    expect(
      within(ask).getByText(
        'Nobody new can use it. 14 people are already in and keep their access.',
      ),
    ).toBeDefined();

    fireEvent.click(within(ask).getByRole('button', { name: 'Stop the code' }));

    expect(
      await screen.findByText('14 people came in with this code. They keep their access.'),
    ).toBeDefined();
    expect(screen.getByText('Stopped')).toBeDefined();
    expect(
      sent.some((one) => one.line === `POST /api/events/ev_1/door-codes/${CARD.id}/stop`),
    ).toBe(true);
  });

  it('makes the new code in the old one’s place, with its role, label, number and end', async () => {
    const sent = await onPeople([CARD], {
      'POST /api/events/ev_1/door-codes': () =>
        json({ doorCode: { ...CARD, id: 'new', code: 'H3WD9RN6', used: 0 } }, 201),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Make a new code' }));
    const ask = screen.getByRole('alertdialog', { name: 'Make a new code?' });

    expect(
      within(ask).getByText(
        'K7P2 QX9M stops working. 14 people are already in and keep their access.',
      ),
    ).toBeDefined();

    fireEvent.click(within(ask).getByRole('button', { name: 'Make a new code' }));

    expect(await screen.findByText('H3WD 9RN6')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/door-codes')?.body).toEqual({
      role: 'can_check_in',
      jobLabel: 'Bar and drinks',
      useCap: 30,
      expiresAt: CARD.expiresAt,
      replaces: CARD.id,
    });
    expect(sent.some((one) => one.line.endsWith('/stop'))).toBe(false);
    expect(screen.queryByText('K7P2 QX9M')).toBeNull();
  });

  it('keeps the old code working when the new one is not made', async () => {
    await onPeople([CARD], {
      'POST /api/events/ev_1/door-codes': () => json({ title: 'Server error' }, 500),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Make a new code' }));
    const ask = screen.getByRole('alertdialog', { name: 'Make a new code?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Make a new code' }));

    expect(await within(ask).findByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.getAllByText('K7P2 QX9M').length).toBeGreaterThan(0);
  });

  it('shows the code over the whole window with its QR, and Escape closes it', async () => {
    await onPeople([CARD]);

    fireEvent.click(screen.getByRole('button', { name: 'Show the code' }));
    const shown = await screen.findByRole('dialog', { name: 'Door code' });

    expect(
      within(shown).getByRole('img', { name: 'QR code for the door code K 7 P 2, Q X 9 M' }),
    ).toBeDefined();
    expect(within(shown).getByText('Can check guests in · Bar and drinks')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Door code' })).toBeNull());
  });

  it('gives a stopped code Make a new code with its role, label and number kept', async () => {
    await onPeople([{ ...CARD, status: 'stopped', stoppedAt: '2026-11-08T10:00:00+00:00' }]);

    expect(screen.queryByRole('button', { name: 'Stop this code' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Make a new code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Door code' });

    expect(within(dialog).getByRole('radio', { name: /Can check guests in/u })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(dialog).getByLabelText('Job label (optional)')).toHaveProperty(
      'value',
      'Bar and drinks',
    );
    expect(within(dialog).getByLabelText('How many people')).toHaveProperty('value', '30');
  });

  it('makes a stopped code’s new one in its place', async () => {
    const sent = await onPeople(
      [{ ...CARD, status: 'stopped', stoppedAt: '2026-11-08T10:00:00+00:00' }],
      {
        'POST /api/events/ev_1/door-codes': () =>
          json({ doorCode: { ...CARD, id: 'new', code: 'H3WD9RN6', used: 0 } }, 201),
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Make a new code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Door code' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make' }));

    expect(await screen.findByText('H3WD 9RN6')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/door-codes')?.body).toMatchObject(
      { replaces: CARD.id },
    );
  });

  it('keeps the open sheet on its renewed code when the next read lists the codes in another order', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const other = { ...CARD, id: 'b', code: 'M4TR8WZ2', createdAt: '2026-11-07T17:00:00+00:00' };
      const fresh = {
        ...CARD,
        id: 'new',
        code: 'H3WD9RN6',
        used: 0,
        createdAt: '2026-11-08T09:00:00+00:00',
      };
      const listed: unknown[] = [other, CARD];
      await onPeople([], {
        'GET /api/events/ev_1/door-codes': () => json({ doorCodes: listed }),
        'POST /api/events/ev_1/door-codes': () => {
          listed.splice(0, listed.length, fresh, other);

          return json({ doorCode: fresh }, 201);
        },
      });

      fireEvent.click(screen.getAllByRole('button', { name: 'Show the code' })[0]!);
      const shown = await screen.findByRole('dialog', { name: 'Door code' });
      expect(within(shown).getByText('K7P2 QX9M')).toBeDefined();

      fireEvent.click(within(shown).getByRole('button', { name: 'Make a new code' }));
      const ask = screen.getByRole('alertdialog', { name: 'Make a new code?' });
      fireEvent.click(within(ask).getByRole('button', { name: 'Make a new code' }));
      expect(await within(shown).findByText('H3WD 9RN6')).toBeDefined();

      await act(() => vi.advanceTimersByTimeAsync(5_000));

      const still = screen.getByRole('dialog', { name: 'Door code' });
      expect(within(still).getByText('H3WD 9RN6')).toBeDefined();
      expect(within(still).queryByText('M4TR 8WZ2')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
