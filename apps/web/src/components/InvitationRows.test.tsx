import type { Membership } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../session.ts';
import { membership } from '../test-memberships.ts';
import { routes } from '../routes/index.tsx';
import { cssRule } from '../test-styles.ts';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const ADUNNI = membership({
  id: 'org_7',
  name: 'Adunni Weddings',
  role: { id: 'role_3', seededAs: 'event_manager', name: null },
});

// Every key InvitationsController::preview writes, as GET /api/invitations lists them.
const PREVIEW = {
  id: 'inv_1',
  organisation: { id: 'org_7', name: 'Adunni Weddings' },
  email: 'folake@ire.events',
  role: { id: 'role_3', seededAs: 'event_manager', name: null },
  invitedBy: { name: 'Bisi Adeyemi' },
  expiresAt: '2026-10-23T09:00:00+00:00',
  refusal: null,
  forYou: true,
  signedInAs: 'folake@ire.events',
};

const ACCEPT = 'POST /api/invitations/inv_1/accept';
const DECLINE = 'POST /api/invitations/inv_1/decline';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(status: number, code: string): Response {
  return json({ type: `https://soirely.com/errors/${code}`, title: 'No.', status }, status);
}

function answering(answers: Record<string, () => Response>) {
  const sent: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push(line);

    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function waiting(...invitations: unknown[]) {
  return { 'GET /api/invitations': () => json({ invitations }) };
}

function signedIn(organisations: readonly Membership[]): void {
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Folake Adeyemi',
      email: 'folake@ire.events',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      userId: 'u1',
      needsOrganisation: false,
      hasPassword: true,
      organisation: organisations[0] ?? null,
      organisations,
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
}

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

async function openSwitcher(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: /1 invitation waiting/ }));

  return screen.getByRole('group', { name: 'Adunni Weddings' });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('an invitation in the organisation switcher', () => {
  it('rings the switcher and lists it under Invitations, even for somebody in one organisation', async () => {
    signedIn([IRE]);
    answering(waiting(PREVIEW));
    at('/app');

    const trigger = await screen.findByRole('button', {
      name: 'Organisation: Ìrè Events, your role Owner. Switch organisation. 1 invitation waiting',
    });
    expect(within(trigger).getByText('1 invitation')).toBeDefined();

    fireEvent.click(trigger);
    const row = screen.getByRole('group', { name: 'Adunni Weddings' });

    expect(within(row).getByText('Invitation from Bisi Adeyemi · Event manager')).toBeDefined();
    expect(within(row).getByText('Works until Friday, Oct 23')).toBeDefined();
    expect(
      within(row).getByText('Declining tells Bisi Adeyemi you said no. Nothing else changes.'),
    ).toBeDefined();
    expect(
      within(row).getByRole('button', { name: 'Accept and join Adunni Weddings' }),
    ).toBeDefined();
    expect(
      within(row).getByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    ).toBeDefined();
  });

  it('accepts without moving you, then opens the organisation it joined', async () => {
    signedIn([IRE]);
    const sent = answering({ ...waiting(PREVIEW), [ACCEPT]: () => json({ organisation: ADUNNI }) });
    at('/app');

    const row = await openSwitcher();
    fireEvent.click(within(row).getByRole('button', { name: 'Accept and join Adunni Weddings' }));

    expect(
      await within(row).findByText('You joined Adunni Weddings as Event manager.'),
    ).toBeDefined();
    expect(sent).toContain(ACCEPT);
    expect(screen.getByRole('option', { name: /Adunni Weddings/ })).toBeDefined();
    expect(screen.getByRole('option', { name: /Ìrè Events/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByText('1 invitation')).toBeNull();

    const open = within(row).getByRole('button', { name: 'Open Adunni Weddings' });
    expect(open.querySelector('.button-label-cut')?.textContent).toBe('Open Adunni Weddings');
    expect(open.getAttribute('title')).toBe('Open Adunni Weddings');

    fireEvent.click(open);

    expect(screen.getByText('Now working in Adunni Weddings.')).toBeDefined();
    expect(window.localStorage.getItem('soirely.organisation')).toBe('org_7');
  });

  it('cuts a long name in Open with an ellipsis, keeping Open in view (sc-15414)', () => {
    const cut = cssRule('.button-label-cut');

    expect(cut).toMatch(/min-width: 0;/u);
    expect(cut).toMatch(/overflow: hidden;/u);
    expect(cut).toMatch(/text-overflow: ellipsis;/u);
    expect(cut).toMatch(/white-space: nowrap;/u);
  });

  it('says which refusal met a press when the invitation went stale after the list loaded', async () => {
    signedIn([IRE]);
    answering({ ...waiting(PREVIEW), [ACCEPT]: () => problem(410, 'invitation_expired') });
    at('/app');

    const row = await openSwitcher();
    fireEvent.click(within(row).getByRole('button', { name: 'Accept and join Adunni Weddings' }));

    expect(await within(row).findByText('Expired')).toBeDefined();
    expect(
      within(row).getByText('This invitation has expired. Ask Bisi Adeyemi to send a new one.'),
    ).toBeDefined();
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('says a withdrawn one was withdrawn, by the organisation', async () => {
    signedIn([IRE]);
    answering({ ...waiting(PREVIEW), [DECLINE]: () => problem(409, 'invitation_revoked') });
    at('/app');

    const row = await openSwitcher();
    fireEvent.click(
      within(row).getByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    );

    expect(await within(row).findByText('Withdrawn')).toBeDefined();
    expect(
      within(row).getByText(
        'This invitation was withdrawn by Adunni Weddings. If you think that is a mistake, ask whoever invited you.',
      ),
    ).toBeDefined();
  });

  it('keeps the buttons and says so when an answer does not reach the API', async () => {
    signedIn([IRE]);
    answering(waiting(PREVIEW));
    at('/app');

    const row = await openSwitcher();
    fireEvent.click(within(row).getByRole('button', { name: 'Accept and join Adunni Weddings' }));

    expect(await within(row).findByRole('alert')).toBeDefined();
    expect(
      within(row).getByRole('button', { name: 'Accept and join Adunni Weddings' }),
    ).toBeDefined();
  });

  it('names nobody once the inviter is gone, and the address when it is another one', async () => {
    signedIn([IRE]);
    answering({
      ...waiting({ ...PREVIEW, invitedBy: null, email: 'folake.o@gmail.com' }),
      [DECLINE]: () => json({ status: 'declined' }),
    });
    at('/app');

    const row = await openSwitcher();

    expect(within(row).getByText('Invitation · Event manager')).toBeDefined();
    expect(
      within(row).getByText('Works until Friday, Oct 23 · Sent to folake.o@gmail.com'),
    ).toBeDefined();
    expect(within(row).getByText('Declining changes nothing else.')).toBeDefined();

    fireEvent.click(
      within(row).getByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    );

    expect(await within(row).findByText('You declined.')).toBeDefined();
  });
});

describe('an invitation for somebody in no organisation', () => {
  it('lists it in place of asking to be invited again, and opens the organisation once accepted', async () => {
    signedIn([]);
    answering({ ...waiting(PREVIEW), [ACCEPT]: () => json({ organisation: ADUNNI }) });
    at('/app');

    const row = await screen.findByRole('group', { name: 'Adunni Weddings' });
    expect(screen.queryByText(/Ask whoever runs yours/)).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: 'Accept and join Adunni Weddings' }));
    fireEvent.click(await within(row).findByRole('button', { name: 'Open Adunni Weddings' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'You are not in an organisation' })).toBeNull(),
    );
    expect(screen.getByText('Now working in Adunni Weddings.')).toBeDefined();
  });

  it('still asks to be invited again while nothing is waiting', async () => {
    signedIn([]);
    const sent = answering(waiting());
    at('/app');

    await waitFor(() => expect(sent).toContain('GET /api/invitations'));
    expect(
      screen.getByText('Ask whoever runs yours to invite folake@ire.events again.'),
    ).toBeDefined();
  });
});
