import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { serverClock } from '@soirely/domain';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const MANAGER = membership({
  ...IRE,
  role: { id: 'role_4', seededAs: 'event_manager', name: null },
  permissions: OWNER_PERMISSIONS.filter((permission) => permission !== 'events.create'),
});

const AHEAD = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_1',
    organisationId: 'org_1',
    name: 'Adaeze and Tunde',
    type: 'wedding',
    status: 'draft',
    ...AHEAD,
    timeZone: 'Africa/Lagos',
    dayCount: 2,
    currency: 'NGN',
    cover: null,
    venue: null,
    hosts: ['Funmi Adeyemi'],
    madeLiveAt: null,
    pausedAt: null,
    phase: 'draft',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    permissions: OWNER_PERMISSIONS,
    ...overrides,
  };
}

function live(overrides: Record<string, unknown> = {}) {
  return event({
    status: 'live',
    phase: 'live',
    madeLiveAt: '2026-10-26T15:00:00+00:00',
    ...overrides,
  });
}

function signedIn(organisation = IRE): void {
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
    organisation,
    organisations: [organisation],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

type Answer = (body: unknown) => Response | Promise<Response>;

/** Tagged as the API tags an event, which the event's page reads with its version. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ETag: '"1"' } });
}

function deletion(
  needsName: boolean,
  people = 0,
  deleteRefusedBecause: string | null = null,
): Response {
  return json({
    needsName,
    people,
    deleteRefusedBecause,
    restoreClosesAt: '2026-11-25T13:20:00+00:00',
    restoreCloses: 'Wednesday, Nov 25 at 14:20 WAT',
  });
}

function mismatch(): Response {
  return json(
    {
      type: 'https://soirely.com/errors/validation_failed',
      title: 'Validation failed.',
      status: 422,
      violations: [
        { propertyPath: 'name', message: 'The name does not match.', code: 'event_name_mismatch' },
      ],
    },
    422,
  );
}

function answering(answers: Record<string, Answer>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    return (await answers[line]?.(body)) ?? json({});
  });

  return sent;
}

async function onTheEvent(
  shown: ReturnType<typeof event>,
  answers: Record<string, Answer> = {},
  initialEntries = ['/app/events/ev_1'],
) {
  const sent = answering({
    'GET /api/events/ev_1': () => json({ event: shown }),
    'GET /api/orgs/org_1/events': () => json({ events: [], total: 0 }),
    'DELETE /api/events/ev_1': () => new Response(null, { status: 204 }),
    ...answers,
  });
  const router = createMemoryRouter(routes, {
    initialEntries,
    initialIndex: initialEntries.length - 1,
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: shown.name });

  return { sent, router };
}

async function asking(
  shown: ReturnType<typeof event>,
  needsName: boolean,
  answers: Record<string, Answer> = {},
  people = 0,
) {
  const { sent } = await onTheEvent(shown, {
    'GET /api/events/ev_1/deletion': () => deletion(needsName, people),
    ...answers,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete event…' }));

  return {
    sent,
    dialog: await screen.findByRole('alertdialog', { name: `Delete ${shown.name}?` }),
  };
}

function deletes(sent: { line: string }[]): boolean {
  return sent.some(({ line }) => line === 'DELETE /api/events/ev_1');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Delete an event (sc-3592)', () => {
  it('offers Delete event, with what it does, to somebody with events.create', async () => {
    signedIn();
    await onTheEvent(event());

    expect(
      screen.getByText(
        "Removes the event and everything in it for your whole team. Guests following its link see that it isn't available.",
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete event…' })).toBeDefined();
  });

  it('is not offered without events.create, even to somebody who manages events', async () => {
    signedIn(MANAGER);
    await onTheEvent(event({ permissions: MANAGER.permissions }));

    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Delete event…' })).toBeNull();
  });

  it('deletes a Draft on its plain confirmation, with no name, and says so on Events', async () => {
    signedIn();
    const { sent, dialog } = await asking(event(), false);

    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Keep it' })),
    );
    expect(
      within(dialog).getByText(
        "It's a draft with nobody on its guest list. It will be removed for your whole team.",
      ),
    ).toBeDefined();
    expect(within(dialog).queryByRole('textbox')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await screen.findByRole('heading', { level: 1, name: 'Events' });
    expect(sent.find(({ line }) => line === 'DELETE /api/events/ev_1')?.body).toEqual({
      name: null,
    });
    const toast = await screen.findByText('Adaeze and Tunde was deleted.', {
      selector: '.toast *',
    });
    expect(
      within(toast.closest('.toast') as HTMLElement).getByRole('button', { name: 'Close' }),
    ).toBeDefined();
  });

  it('takes the deleted page out of history, so Back from Events never opens it (sc-22103)', async () => {
    signedIn();
    const { router } = await onTheEvent(
      event(),
      { 'GET /api/events/ev_1/deletion': () => deletion(false) },
      ['/app/events', '/app/events/ev_1'],
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete event…' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Adaeze and Tunde?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await screen.findByRole('heading', { level: 1, name: 'Events' });
    await router.navigate(-1);

    expect(router.state.location.pathname).toBe('/app/events');
  });

  it('says the event was deleted on that arrival only, not after Back or Forward (sc-22103)', async () => {
    signedIn();
    const { router } = await onTheEvent(
      event(),
      { 'GET /api/events/ev_1/deletion': () => deletion(false) },
      ['/app/events', '/app/events/ev_1'],
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete event…' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Adaeze and Tunde?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await screen.findByText('Adaeze and Tunde was deleted.');
    await act(() => router.navigate(-1));

    expect(screen.queryByText('Adaeze and Tunde was deleted.')).toBeNull();
    await act(() => router.navigate(1));
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeDefined();
    expect(screen.queryByText('Adaeze and Tunde was deleted.')).toBeNull();
  });

  it('says nothing on Forward to an entry still holding the deleted state, and drops that state (sc-22103)', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': () => json({ events: [], total: 0 }) });
    const router = createMemoryRouter(routes, {
      initialEntries: [
        '/app/events',
        { pathname: '/app/events', state: { deletedEvent: 'Adaeze and Tunde' } },
      ],
      initialIndex: 0,
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: 'Events' });

    await act(() => router.navigate(1));

    expect(screen.queryByText('Adaeze and Tunde was deleted.')).toBeNull();
    await waitFor(() => expect(router.state.location.state).toBeNull());
    expect(screen.queryByText('Adaeze and Tunde was deleted.')).toBeNull();
  });

  it('says nothing when Events opens on an entry still holding the deleted state, as on a reload (sc-22103)', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': () => json({ events: [], total: 0 }) });
    const router = createMemoryRouter(routes, {
      initialEntries: [{ pathname: '/app/events', state: { deletedEvent: 'Adaeze and Tunde' } }],
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: 'Events' });

    expect(screen.queryByText('Adaeze and Tunde was deleted.')).toBeNull();
    await waitFor(() => expect(router.state.location.state).toBeNull());
    expect(screen.queryByText('Adaeze and Tunde was deleted.')).toBeNull();
  });

  it('asks for the name of an event past Draft, and says until when support can restore it', async () => {
    signedIn();
    const { dialog } = await asking(live(), true);

    expect(
      [...dialog.querySelectorAll('.desk-ask-body > p, .desk-ask-body li')].map((part) =>
        spaced(part.textContent),
      ),
    ).toEqual([
      'This removes, for your whole team:',
      'the event, its details and its schedule',
      "Guests following their link will see that it isn't available.",
      "If this was a mistake, support can restore it until Wednesday, Nov 25 at 14:20 WAT. After that it's gone for good.",
    ]);
    const field = within(dialog).getByLabelText('Type Adaeze and Tunde to delete it');
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(
      within(dialog).getByRole('button', { name: 'Delete' }).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.change(field, { target: { value: 'Adaeze and Tunde' } });
    expect(
      within(dialog).getByRole('button', { name: 'Delete' }).getAttribute('aria-disabled'),
    ).toBe('false');
    expect(
      within(dialog).getByText(
        'Type it exactly, capitals included. A straight or curly apostrophe both count.',
      ),
    ).toBeDefined();
  });

  it('is described by what it removes, the guest link and the restore window, as the demo is', async () => {
    signedIn();
    const { dialog } = await asking(live(), true, {}, 2);

    expect(
      (dialog.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => spaced(document.getElementById(id)?.textContent)),
    ).toEqual([
      'This removes, for your whole team:',
      'the event, its details and its scheduleits guest list, with the 2 people on it',
      "Guests following their link will see that it isn't available.",
      "If this was a mistake, support can restore it until Wednesday, Nov 25 at 14:20 WAT. After that it's gone for good.",
    ]);
  });

  it('lists the guest list with the number of people on it, guests and companions together', async () => {
    signedIn();
    const { dialog } = await asking(live(), true, {}, 1421);

    expect([...dialog.querySelectorAll('.ev-removes li')].map((item) => item.textContent)).toEqual([
      'the event, its details and its schedule',
      'its guest list, with the 1,421 people on it',
    ]);
  });

  it('says the one person on a list of one', async () => {
    signedIn();
    const { dialog } = await asking(live(), true, {}, 1);

    expect(within(dialog).getByText('its guest list, with the 1 person on it')).toBeDefined();
  });

  it('asks for the name of a Draft with anybody on its list', async () => {
    signedIn();
    const { dialog } = await asking(event(), true, {}, 2);

    expect(within(dialog).getByText('its guest list, with the 2 people on it')).toBeDefined();
    expect(within(dialog).getByLabelText('Type Adaeze and Tunde to delete it')).toBeDefined();
  });

  it('sends nothing for a name that does not match, says so under the field and moves focus to it', async () => {
    signedIn();
    const { sent, dialog } = await asking(live(), true);
    const field = within(dialog).getByLabelText('Type Adaeze and Tunde to delete it');
    const button = within(dialog).getByRole('button', { name: 'Delete' });

    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.change(field, { target: { value: 'Adaeze' } });
    fireEvent.click(button);

    expect(within(dialog).getByRole('alert').textContent).toBe(
      'Type Adaeze and Tunde exactly as shown to delete it.',
    );
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(deletes(sent)).toBe(false);
  });

  it('refuses the name in the wrong case', async () => {
    signedIn();
    const { sent, dialog } = await asking(live(), true);

    fireEvent.change(within(dialog).getByLabelText('Type Adaeze and Tunde to delete it'), {
      target: { value: 'adaeze and tunde' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      within(dialog).getByText('Type Adaeze and Tunde exactly as shown to delete it.'),
    ).toBeDefined();
    expect(deletes(sent)).toBe(false);
  });

  it('takes a curly apostrophe for a straight one, and sends the name as typed', async () => {
    signedIn();
    const { sent, dialog } = await asking(live({ name: "Tunde's fortieth" }), true);

    fireEvent.change(within(dialog).getByLabelText("Type Tunde's fortieth to delete it"), {
      target: { value: 'Tunde’s fortieth' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await screen.findByRole('heading', { level: 1, name: 'Events' });
    expect(sent.find(({ line }) => line === 'DELETE /api/events/ev_1')?.body).toEqual({
      name: 'Tunde’s fortieth',
    });
  });

  it("shows the server's refusal of the name under the field", async () => {
    signedIn();
    const { dialog } = await asking(live(), true, { 'DELETE /api/events/ev_1': mismatch });
    const field = within(dialog).getByLabelText('Type Adaeze and Tunde to delete it');

    fireEvent.change(field, { target: { value: 'Adaeze and Tunde' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      await within(dialog).findByText('Type Adaeze and Tunde exactly as shown to delete it.'),
    ).toBeDefined();
    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole('heading', { level: 1, name: 'Events' })).toBeNull();
  });

  it('asks for the current name after the API refuses one renamed since the dialog opened (sc-44741)', async () => {
    signedIn();
    let renamed = false;
    const { sent, dialog } = await asking(live(), true, {
      'GET /api/events/ev_1': () =>
        json({ event: renamed ? live({ name: 'Adaeze at Forty' }) : live() }),
      'DELETE /api/events/ev_1': (body) => {
        if ((body as { name?: string }).name === 'Adaeze at Forty') {
          return new Response(null, { status: 204 });
        }
        renamed = true;

        return mismatch();
      },
    });
    const field = within(dialog).getByLabelText('Type Adaeze and Tunde to delete it');
    const button = within(dialog).getByRole('button', { name: 'Delete' });

    fireEvent.change(field, { target: { value: 'Adaeze and Tunde' } });
    fireEvent.click(button);

    expect(
      await within(dialog).findByText('Type Adaeze at Forty exactly as shown to delete it.'),
    ).toBeDefined();
    expect(screen.getByRole('alertdialog', { name: 'Delete Adaeze at Forty?' })).toBe(dialog);
    expect(within(dialog).getByLabelText('Type Adaeze at Forty to delete it')).toBe(field);
    expect((field as HTMLInputElement).value).toBe('Adaeze and Tunde');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
    expect(button.getAttribute('aria-disabled')).toBe('true');

    fireEvent.change(field, { target: { value: 'Adaeze and Tunde' } });
    expect(button.getAttribute('aria-disabled')).toBe('true');

    fireEvent.change(field, { target: { value: 'Adaeze at Forty' } });
    expect(button.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(button);

    await screen.findByRole('heading', { level: 1, name: 'Events' });
    expect(
      sent.filter(({ line }) => line === 'DELETE /api/events/ev_1').map(({ body }) => body),
    ).toEqual([{ name: 'Adaeze and Tunde' }, { name: 'Adaeze at Forty' }]);
  });

  it('keeps the name it opened with when the event cannot be reread after a refusal (sc-44741)', async () => {
    signedIn();
    let refused = false;
    const { dialog } = await asking(live(), true, {
      'GET /api/events/ev_1': () =>
        refused ? json({ title: 'Server error' }, 500) : json({ event: live() }),
      'DELETE /api/events/ev_1': () => {
        refused = true;

        return mismatch();
      },
    });
    const field = within(dialog).getByLabelText('Type Adaeze and Tunde to delete it');

    fireEvent.change(field, { target: { value: 'Adaeze and Tunde' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      await within(dialog).findByText('Type Adaeze and Tunde exactly as shown to delete it.'),
    ).toBeDefined();
    expect(screen.getByRole('alertdialog', { name: 'Delete Adaeze and Tunde?' })).toBe(dialog);
    expect(document.activeElement).toBe(field);
  });

  it('keeps the dialog open with what was typed when it was not deleted', async () => {
    signedIn();
    const { dialog } = await asking(live(), true, {
      'DELETE /api/events/ev_1': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    const field = within(dialog).getByLabelText('Type Adaeze and Tunde to delete it');

    fireEvent.change(field, { target: { value: 'Adaeze and Tunde' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'That did not go through. Nothing was changed. Try again in a moment.',
    );
    expect((field as HTMLInputElement).value).toBe('Adaeze and Tunde');
    expect(screen.getByRole('alertdialog', { name: 'Delete Adaeze and Tunde?' })).toBeDefined();
  });

  it.each([
    [
      'Keep it',
      (dialog: HTMLElement) =>
        fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it' })),
    ],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
  ])('closes on %s, sends nothing and returns focus to Delete event', async (_, close) => {
    signedIn();
    const { sent, dialog } = await asking(live(), true);

    close(dialog);

    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete event…' })),
    );
    expect(deletes(sent)).toBe(false);
  });
});

function spaced(text: string | null | undefined): string {
  return (text ?? '').replace(/\s/g, ' ');
}

describe('Delete event refused while a guest is Invited (sc-14445)', () => {
  const READ = OWNER_PERMISSIONS.filter((permission) => permission !== 'events.manage');
  const HAPPENING = { startsAt: '2020-11-14T16:00:00+01:00', phase: 'happening_now' };
  const BEFORE_BODY =
    'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. Calling it off is how they hear it will not go ahead.';
  const FROM_BODY =
    'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. End it first: it will then be over for everybody.';

  function clockAt(device: string): void {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(device));
    serverClock.observe(new Date(device).toUTCString());
  }

  afterEach(() => {
    vi.useRealTimers();
    serverClock.observe(new Date().toUTCString());
  });

  async function refused(shown: ReturnType<typeof event>, title: string) {
    const { sent } = await onTheEvent(shown, {
      'GET /api/events/ev_1/deletion': () => deletion(true, 3, 'guestsInvited'),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete event…' }));

    return { sent, dialog: await screen.findByRole('alertdialog', { name: title }) };
  }

  function callOffFirst(): Response {
    return json(
      {
        type: 'https://soirely.com/errors/event_call_off_first',
        title: 'This event cannot be deleted until it is finished.',
        detail:
          'Guests have been invited to it, or staff briefed for it. Call it off or end it first.',
        status: 409,
      },
      409,
    );
  }

  it('opens on Call off first before the start, with no name to type and focus on Keep it', async () => {
    signedIn();
    const { sent, dialog } = await refused(live(), 'Call off Adaeze and Tunde first?');

    expect(within(dialog).getByText(BEFORE_BODY)).toBeDefined();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Keep it', 'Call off']);
    expect(within(dialog).getByRole('button', { name: 'Call off' }).className).toContain('is-red');
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Keep it' })),
    );
    expect(deletes(sent)).toBe(false);
  });

  it('opens on End first from the start', async () => {
    signedIn();
    const { dialog } = await refused(live(HAPPENING), 'End Adaeze and Tunde first?');

    expect(within(dialog).getByText(FROM_BODY)).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'End now' })).toBeDefined();
  });

  it('turns Call off first into End first at the start, without a reload', async () => {
    clockAt('2030-11-14T14:59:55Z');
    signedIn();
    const { sent } = await refused(live(), 'Call off Adaeze and Tunde first?');

    await act(() => vi.advanceTimersByTimeAsync(15_000));

    const dialog = screen.getByRole('alertdialog', { name: 'End Adaeze and Tunde first?' });
    expect(within(dialog).getByRole('button', { name: 'End now' })).toBeDefined();
    expect(sent.filter(({ line }) => line === 'GET /api/events/ev_1')).toHaveLength(1);
  });

  it('refuses a Paused event as a Live one', async () => {
    signedIn();
    await refused(
      live({ status: 'paused', phase: 'paused', pausedAt: '2026-10-27T10:00:00+00:00' }),
      'Call off Adaeze and Tunde first?',
    );
  });

  it("opens Call off's own question a second before the start, and leaves the host on the page", async () => {
    clockAt('2030-11-14T14:59:59Z');
    signedIn();
    const { sent, dialog } = await refused(live(), 'Call off Adaeze and Tunde first?');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Call off' }));
    const question = await screen.findByRole('dialog', { name: 'Call off Adaeze and Tunde?' });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(within(question).getByRole('button', { name: 'Keep it on' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Call off…' })),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' })).toBeDefined();
    expect(sent.map(({ line }) => line)).not.toContain('POST /api/events/ev_1/end');
    expect(deletes(sent)).toBe(false);
  });

  it("opens End now's own question at the start, and nothing carries on into the delete", async () => {
    clockAt('2030-11-14T15:00:00Z');
    signedIn();
    const { sent, dialog } = await refused(live(), 'End Adaeze and Tunde first?');

    fireEvent.click(within(dialog).getByRole('button', { name: 'End now' }));
    const question = await screen.findByRole('dialog', { name: 'End Adaeze and Tunde now?' });
    fireEvent.click(within(question).getByRole('button', { name: 'End now' }));

    await waitFor(() =>
      expect(sent.map(({ line }) => line)).toContain('POST /api/events/ev_1/end'),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' })).toBeDefined();
    expect(deletes(sent)).toBe(false);
  });

  it.each([
    ['before the start', live(), 'Call off Adaeze and Tunde first?', 'to call it off.'],
    ['from the start', live(HAPPENING), 'End Adaeze and Tunde first?', 'to end it.'],
  ])(
    'shows somebody with Events at Read who can, and Keep it alone, %s',
    async (_, shown, title, ending) => {
      signedIn(membership({ ...IRE, permissions: READ }));
      const { dialog } = await refused({ ...shown, permissions: READ }, title);

      expect(
        within(dialog).getByText(`Ask someone who can change Events in Ìrè Events ${ending}`),
      ).toBeDefined();
      expect(
        within(dialog)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['Keep it']);
    },
  );

  it.each([
    ['the host', OWNER_PERMISSIONS, ['Keep it', 'Call off']],
    ['somebody with Events at Read', READ, ['Keep it']],
  ])(
    'turns the name screen into the refusal for %s when a guest was Invited since it opened',
    async (_, permissions, buttons) => {
      signedIn(membership({ ...IRE, permissions }));
      await onTheEvent(live({ permissions }), {
        'GET /api/events/ev_1/deletion': () => deletion(true),
        'DELETE /api/events/ev_1': () => callOffFirst(),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete event…' }));
      const named = await screen.findByRole('alertdialog', { name: 'Delete Adaeze and Tunde?' });
      fireEvent.change(within(named).getByLabelText('Type Adaeze and Tunde to delete it'), {
        target: { value: 'Adaeze and Tunde' },
      });

      fireEvent.click(within(named).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Call off Adaeze and Tunde first?',
      });
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(dialog).getByRole('heading', { name: 'Call off Adaeze and Tunde first?' }),
        ),
      );
      expect(
        within(dialog)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(buttons);
      expect(screen.queryByText(/Call it off or end it first/)).toBeNull();
      expect(screen.queryByText('This event cannot be deleted until it is finished.')).toBeNull();
    },
  );

  it('opens on the name screen once a page left open has crossed the end, without a reload', async () => {
    clockAt('2030-11-15T00:59:55Z');
    signedIn();
    const { sent } = await onTheEvent(live(HAPPENING), {
      'GET /api/events/ev_1/deletion': () => deletion(true, 3, 'guestsInvited'),
    });

    await act(() => vi.advanceTimersByTimeAsync(15_000));
    fireEvent.click(screen.getByRole('button', { name: 'Delete event…' }));

    await screen.findByRole('alertdialog', { name: 'Delete Adaeze and Tunde?' });
    expect(sent.filter(({ line }) => line === 'GET /api/events/ev_1')).toHaveLength(1);
  });

  it.each([
    [
      'Keep it',
      (dialog: HTMLElement) =>
        fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it' })),
    ],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
  ])('closes on %s, changes nothing and returns focus to Delete event', async (_, close) => {
    signedIn();
    const { sent, dialog } = await refused(live(), 'Call off Adaeze and Tunde first?');

    close(dialog);

    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete event…' })),
    );
    expect(sent.map(({ line }) => line)).not.toContain('POST /api/events/ev_1/end');
    expect(deletes(sent)).toBe(false);
  });
});
