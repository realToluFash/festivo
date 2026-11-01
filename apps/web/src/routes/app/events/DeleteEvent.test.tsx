import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

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

function deletion(needsName: boolean): Response {
  return json({
    needsName,
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
) {
  const { sent } = await onTheEvent(shown, {
    'GET /api/events/ev_1/deletion': () => deletion(needsName),
    ...answers,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete event…' }));

  return {
    sent,
    dialog: await screen.findByRole('dialog', { name: `Delete ${shown.name}?` }),
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
    await onTheEvent(event());

    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Delete event…' })).toBeNull();
  });

  it('deletes a Draft on its plain confirmation, with no name, and says so on Events', async () => {
    signedIn();
    const { sent, dialog } = await asking(event(), false);

    expect(document.activeElement).toBe(
      within(dialog).getByRole('heading', { name: 'Delete Adaeze and Tunde?' }),
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
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Adaeze and Tunde was deleted.'),
    );
  });

  it('takes the deleted page out of history, so Back from Events never opens it (sc-22103)', async () => {
    signedIn();
    const { router } = await onTheEvent(
      event(),
      { 'GET /api/events/ev_1/deletion': () => deletion(false) },
      ['/app/events', '/app/events/ev_1'],
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete event…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Adaeze and Tunde?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await screen.findByRole('heading', { level: 1, name: 'Events' });
    await router.navigate(-1);

    expect(router.state.location.pathname).toBe('/app/events');
  });

  it('asks for the name of an event past Draft, and says until when support can restore it', async () => {
    signedIn();
    const { dialog } = await asking(live(), true);

    expect(spaced(dialog.querySelector('#event-delete-body')?.textContent)).toBe(
      [
        'This removes, for your whole team:',
        'the event, its details and its schedule',
        "Guests following their link will see that it isn't available.",
        "If this was a mistake, support can restore it until Wednesday, Nov 25 at 14:20 WAT. After that it's gone for good.",
      ].join(''),
    );
    expect(within(dialog).getByLabelText('Type Adaeze and Tunde to delete it')).toBeDefined();
    expect(
      within(dialog).getByText(
        'Type it exactly, capitals included. A straight or curly apostrophe both count.',
      ),
    ).toBeDefined();
  });

  it('sends nothing for a name that does not match, says so under the field and moves focus to it', async () => {
    signedIn();
    const { sent, dialog } = await asking(live(), true);
    const field = within(dialog).getByLabelText('Type Adaeze and Tunde to delete it');
    const button = within(dialog).getByRole('button', { name: 'Delete' });

    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.change(field, { target: { value: 'Adaeze' } });
    fireEvent.click(button);

    expect(within(dialog).getByRole('alert').querySelector('p')?.textContent).toBe(
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

  it('keeps the dialog open with what was typed when it was not deleted', async () => {
    signedIn();
    const { dialog } = await asking(live(), true, {
      'DELETE /api/events/ev_1': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    const field = within(dialog).getByLabelText('Type Adaeze and Tunde to delete it');

    fireEvent.change(field, { target: { value: 'Adaeze and Tunde' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect((await within(dialog).findByRole('alert')).querySelector('p')?.textContent).toBe(
      'That did not go through. Nothing was changed. Try again in a moment.',
    );
    expect((field as HTMLInputElement).value).toBe('Adaeze and Tunde');
    expect(screen.getByRole('dialog', { name: 'Delete Adaeze and Tunde?' })).toBeDefined();
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

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete event…' })),
    );
    expect(deletes(sent)).toBe(false);
  });
});

function spaced(text: string | null | undefined): string {
  return (text ?? '').replace(/\s/g, ' ');
}
