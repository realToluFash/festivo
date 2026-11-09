import { type Membership } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { atPhoneWidth } from '../../../test-widths.ts';
import { routes } from '../../index.tsx';

const OWNER = { id: 'role_1', seededAs: 'owner', name: null };
const ADMINISTRATOR = { id: 'role_2', seededAs: 'administrator', name: null };
const MEMBER = { id: 'role_3', seededAs: 'member', name: null };
const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const MANAGES = ['organisation.manage', 'members.manage', 'members.read'];

const held = (permissions = OWNER_PERMISSIONS) =>
  membership({
    permissions: permissions.filter((one) => !MANAGES.includes(one)),
    withheldUntilTwoFactor: MANAGES,
  });

function member(id: string, name: string, role: object, self = false) {
  return {
    id,
    user: { id: `u_${id}`, name, email: null },
    role,
    status: 'active',
    former: null,
    channel: 'invitation',
    since: null,
    invitedBy: null,
    invitedAt: null,
    self,
    history: [],
  };
}

const MEMBERS = {
  members: [
    member('m_folake', 'Folake Adeyemi', OWNER, true),
    member('m_bisi', 'Bisi Adeyemi', ADMINISTRATOR),
  ],
  invitations: [],
};

const DOMAINS = {
  domains: [{ domain: 'ire.events', stopped: false }],
  most: 5,
  ownAddress: 'folake@ire.events',
};

const ME = {
  id: 'u_folake',
  name: 'Folake Adeyemi',
  businessName: null,
  countryCode: null,
  locale: 'en',
  timezone: null,
  waitingFor: null,
  verified: true,
  complete: true,
  userId: 'u1',
  needsOrganisation: false,
  hasPassword: true,
  providers: [],
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
};

let signedInTo: Membership = IRE;

function signedIn(organisation: Membership = IRE): void {
  signedInTo = organisation;
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number, more: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...more }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function answering(answers: Record<string, () => Response | Promise<Response>> = {}) {
  const sent: { line: string; body: unknown }[] = [];
  const all: Record<string, () => Response | Promise<Response>> = {
    'GET /api/orgs': () => json({ organisations: [signedInTo], paused: [] }),
    'GET /api/orgs/org_1/members': () => json(MEMBERS),
    'GET /api/orgs/org_1/domains': () => json(DOMAINS),
    'GET /api/orgs/org_1/request-link': () =>
      json({ on: true, url: 'https://soirely.app/join/r/7f3k9q' }),
    'GET /api/orgs/org_1/recovery-requests': () => json({ requests: [] }),
    ...answers,
  };

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ line, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = all[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function settings() {
  const router = createMemoryRouter(routes, { initialEntries: ['/app/settings'] });
  render(<RouterProvider router={router} />);

  return router;
}

function steps(): string[] {
  const section = screen.getByRole('heading', { level: 2, name: 'Ownership and leaving' });

  return within(section.closest('section') as HTMLElement)
    .getAllByRole('button')
    .map((one) => one.textContent ?? '');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings > General at a desk (sc-30191)', () => {
  it('gives the owner the summary card, then Details, joining and all three steps', async () => {
    signedIn();
    answering();
    settings();

    expect(await screen.findByRole('heading', { level: 1, name: 'General' })).toBeDefined();
    expect(screen.getByText('hello@ire.events')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Details' })).toBeDefined();
    expect(screen.getByText('Language for invitations')).toBeDefined();
    expect(screen.queryByText(/The name your team and guests see/u)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Organisation' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Remove ire.events' })).toBeDefined();
    expect(
      (await screen.findByRole('switch', { name: 'Requests to join' })).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    expect(steps()).toEqual(['Transfer ownership', 'Leave Ìrè Events…', 'Delete organisation…']);
  });

  it('draws the page and its dialogs in the desk’s look, beside the Settings list', async () => {
    signedIn();
    answering();
    settings();

    const title = await screen.findByRole('heading', { level: 1, name: 'General' });
    expect(title.closest('.settings-desk-page .desk')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    const details = await screen.findByRole('dialog', { name: 'Organisation details' });
    expect(details.closest('.settings-desk-page .desk')).not.toBeNull();
  });

  it('keeps today’s page in a phone’s browser', async () => {
    atPhoneWidth();
    signedIn();
    answering();
    settings();

    expect(await screen.findByText(/The name your team and guests see/u)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit details' })).toBeNull();
  });

  it('gives a member the details to read, the lock line and Leave alone', async () => {
    signedIn(membership({ role: MEMBER, permissions: ['events.read'] }));
    answering();
    settings();

    expect(
      await screen.findByText(
        'Your role, Member, can see these but not change them. Owners and admins can.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit details' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Company domain joining' })).toBeNull();
    expect(steps()).toEqual(['Leave Ìrè Events…']);
  });

  it('gives a held owner the hold’s line, its step to Security, and Leave alone', async () => {
    signedIn(held());
    answering();
    const router = settings();

    const hold = await screen.findByText(
      'Ìrè Events asks its owners and admins to use two-factor. Until you turn it on, you can see these but not change them.',
    );
    expect(steps()).toEqual(['Leave Ìrè Events…']);

    fireEvent.click(
      within(hold.closest('.desk-card') as HTMLElement).getByRole('link', {
        name: 'Turn on two-factor',
      }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/account/security'));
  });

  it('saves only what changed, and says so on the card', async () => {
    signedIn();
    const sent = answering({
      'PATCH /api/orgs/org_1': () => json({ ...IRE, name: 'Ìrè Events Ltd' }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const details = await screen.findByRole('dialog', { name: 'Organisation details' });
    const save = within(details).getByRole('button', { name: 'Save' });
    expect(save.getAttribute('aria-disabled')).toBe('true');

    fireEvent.change(within(details).getByLabelText('Name'), {
      target: { value: 'Ìrè Events Ltd' },
    });
    expect(save.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(save);

    expect(
      await screen.findByText(
        'Saved. Everyone in Ìrè Events Ltd sees the new details on their next screen.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Organisation details' })).toBeNull();
    expect(sent.find((one) => one.line === 'PATCH /api/orgs/org_1')?.body).toEqual({
      name: 'Ìrè Events Ltd',
    });
  });

  it('asks before it discards one change, or two', async () => {
    signedIn();
    answering();
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const details = await screen.findByRole('dialog', { name: 'Organisation details' });

    fireEvent.change(within(details).getByLabelText('Name'), { target: { value: 'Ìrè' } });
    fireEvent.click(within(details).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('alertdialog', { name: 'Discard your change?' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    fireEvent.change(within(details).getByLabelText('Contact address'), {
      target: { value: 'team@ire.events' },
    });
    fireEvent.click(within(details).getByRole('button', { name: 'Cancel' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Discard your changes?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Discard' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Organisation details' })).toBeNull(),
    );
  });

  it('opens a field’s list in the dialog, the current choice ticked, and a pick goes back', async () => {
    signedIn();
    answering();
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const details = await screen.findByRole('dialog', { name: 'Organisation details' });
    fireEvent.click(within(details).getByRole('button', { name: /^Currency, / }));

    const list = await screen.findByRole('dialog', { name: 'Currency' });
    await waitFor(() => expect(document.activeElement).toBe(within(list).getByRole('searchbox')));
    expect(
      within(list)
        .getAllByRole('button')
        .find((one) => one.getAttribute('aria-current') === 'true')?.textContent,
    ).toContain('NGN');

    fireEvent.change(within(list).getByRole('searchbox'), { target: { value: 'euro' } });
    expect(within(list).queryByRole('button', { name: /NGN/u })).toBeNull();
    fireEvent.click(within(list).getByRole('button', { name: /EUR/u }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Currency' })).toBeNull());
    expect(within(details).getByRole('button', { name: /^Currency, .*EUR/u })).toBeDefined();
  });

  it('keeps the dialog on a refusal, Save off, and Cancel closes it without asking', async () => {
    signedIn();
    answering({ 'PATCH /api/orgs/org_1': () => problem('permission_required', 403) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const details = await screen.findByRole('dialog', { name: 'Organisation details' });
    fireEvent.change(within(details).getByLabelText('Name'), { target: { value: 'Ìrè' } });
    fireEvent.click(within(details).getByRole('button', { name: 'Save' }));

    const refusal = await within(details).findByText(
      'Nothing was saved. Your role does not include the permission this needs.',
    );
    const name = within(details).getByLabelText('Name');
    expect((name as HTMLInputElement).value).toBe('Ìrè');
    expect(refusal.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.activeElement).toBe(within(details).getByRole('alert'));
    expect(
      within(details).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled'),
    ).toBe('true');

    fireEvent.click(within(details).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Organisation details' })).toBeNull(),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('says a failed save above Name, Save still on and keeping focus', async () => {
    signedIn();
    answering({ 'PATCH /api/orgs/org_1': () => problem('internal_error', 500) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const details = await screen.findByRole('dialog', { name: 'Organisation details' });
    fireEvent.change(within(details).getByLabelText('Name'), { target: { value: 'Ìrè' } });
    const save = within(details).getByRole('button', { name: 'Save' });
    save.focus();
    fireEvent.click(save);

    const alert = await within(details).findByRole('alert');
    const name = within(details).getByLabelText('Name');
    expect(alert.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() =>
      expect(
        within(details).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    expect(document.activeElement).toBe(within(details).getByRole('button', { name: 'Save' }));
  });

  it('asks for the code only once the server does, after the password', async () => {
    signedIn();
    const proofs = [
      () => problem('two_factor_required', 403, { pendingProof: 'pending_1' }),
      () => problem('two_factor_code_invalid', 422),
    ];
    answering({ 'POST /api/auth/proof': () => (proofs.shift() ?? proofs[0])!() });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    const transfer = await screen.findByRole('dialog', { name: 'Transfer ownership' });
    expect(within(transfer).queryByLabelText('Code')).toBeNull();

    fireEvent.click(await within(transfer).findByRole('radio', { name: /Bisi Adeyemi/u }));
    fireEvent.change(within(transfer).getByLabelText('Your password'), {
      target: { value: 'right' },
    });
    fireEvent.click(within(transfer).getByRole('button', { name: 'Transfer' }));

    const code = await within(transfer).findByLabelText('Code');
    await waitFor(() => expect(document.activeElement).toBe(code));
    expect(
      within(transfer).getByText('From your authenticator app, or one of your recovery codes.'),
    ).toBeDefined();

    fireEvent.click(within(transfer).getByRole('button', { name: 'Transfer' }));
    expect(
      await within(transfer).findByText('Enter a code from your app, or a recovery code.'),
    ).toBeDefined();

    fireEvent.change(code, { target: { value: '000000' } });
    fireEvent.click(within(transfer).getByRole('button', { name: 'Transfer' }));
    expect(
      await within(transfer).findByText('That code did not work. Check your app and try again.'),
    ).toBeDefined();
  });

  it('says who owns it after a transfer, and the steps an owner had are gone', async () => {
    signedIn();
    const admin = { ...IRE, role: ADMINISTRATOR, permissions: [] };
    answering({
      'POST /api/auth/proof': () => json({ proof: 'p_1', expiresAt: '2026-11-08T13:25:00+00:00' }),
      'POST /api/orgs/org_1/ownership': () => {
        signedInTo = admin;

        return new Response(null, { status: 204 });
      },
      'GET /api/invitations/mine': () => json({ invitations: [] }),
      'GET /api/auth/me': () => json(ME),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    const transfer = await screen.findByRole('dialog', { name: 'Transfer ownership' });
    fireEvent.click(await within(transfer).findByRole('radio', { name: /Bisi Adeyemi/u }));
    fireEvent.change(within(transfer).getByLabelText('Your password'), {
      target: { value: 'right' },
    });
    fireEvent.click(within(transfer).getByRole('button', { name: 'Transfer' }));

    expect(await screen.findByText('Bisi Adeyemi is now the owner')).toBeDefined();
    expect(screen.getByText('You are an Admin. You both have an email saying so.')).toBeDefined();
    await waitFor(() => expect(steps()).toEqual(['Leave Ìrè Events…']));
  });

  it('keeps Delete off until the name is typed exactly', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/deletion': () =>
        json({
          events: 5,
          guests: 1204,
          members: 9,
          restoreClosesAt: '2026-11-16T13:20:00+00:00',
          restoreCloses: 'Monday, Nov 16 at 14:20 WAT',
        }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation…' }));
    const remove = await screen.findByRole('dialog', { name: 'Delete Ìrè Events?' });
    expect(
      await within(remove).findByText(/5 events, 1,204 guests and 9 members are deleted/u),
    ).toBeDefined();
    const verb = within(remove).getByRole('button', { name: 'Delete' });
    expect(verb.getAttribute('aria-disabled')).toBe('true');

    fireEvent.change(within(remove).getByLabelText('Type Ìrè Events to confirm'), {
      target: { value: 'Ìrè Events' },
    });

    expect(verb.getAttribute('aria-disabled')).toBe('false');
    expect(within(remove).getByText('That matches.')).toBeDefined();
  });

  it('removes a domain after asking, and names it in a toast', async () => {
    signedIn();
    answering({
      'DELETE /api/orgs/org_1/domains/ire.events': () => json({ ...DOMAINS, domains: [] }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove ire.events' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Remove ire.events?' });
    expect(within(ask).getAllByRole('button')[0]?.textContent).toBe('Keep it');
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove ire.events' }));

    expect(await screen.findByText('ire.events removed.')).toBeDefined();
    expect(screen.getByText('It is off until you add a domain.')).toBeDefined();
  });

  it('says the request link did not load, with Try again', async () => {
    signedIn();
    let reads = 0;
    answering({
      'GET /api/orgs/org_1/request-link': () =>
        reads++ === 0 ? new Response('{}', { status: 500 }) : json({ on: false, url: null }),
    });
    settings();

    expect(await screen.findByText('The request link could not be loaded.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const link = await screen.findByRole('switch', { name: 'Requests to join' });
    expect(link.getAttribute('aria-checked')).toBe('false');
    expect(link.textContent).toBe('Off');
  });

  it('says under the field what the server refused, and focus goes to it', async () => {
    signedIn();
    answering({
      'PATCH /api/orgs/org_1': () =>
        problem('validation_failed', 422, {
          violations: [
            { propertyPath: 'contactAddress', message: 'That address cannot receive email.' },
          ],
        }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const details = await screen.findByRole('dialog', { name: 'Organisation details' });
    const contact = within(details).getByLabelText('Contact address');
    fireEvent.change(contact, { target: { value: 'team@nowhere.example' } });
    fireEvent.click(within(details).getByRole('button', { name: 'Save' }));

    expect(await within(details).findByText('That address cannot receive email.')).toBeDefined();
    expect(document.activeElement).toBe(contact);
  });

  it('keeps what was typed after a failure, with the alert at the top and Save still on', async () => {
    signedIn();
    answering({ 'PATCH /api/orgs/org_1': () => new Response('{}', { status: 500 }) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const details = await screen.findByRole('dialog', { name: 'Organisation details' });
    fireEvent.change(within(details).getByLabelText('Name'), { target: { value: 'Ìrè Ltd' } });
    fireEvent.click(within(details).getByRole('button', { name: 'Save' }));

    expect(
      await within(details).findByText(
        'Saving did not work. Nothing was changed. Try again in a moment.',
      ),
    ).toBeDefined();
    expect((within(details).getByLabelText('Name') as HTMLInputElement).value).toBe('Ìrè Ltd');
    expect(
      within(details).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled'),
    ).toBe('false');
  });

  it('asks before leaving, says Leaving… while it goes, and lands on the app', async () => {
    signedIn(membership({ role: MEMBER, permissions: ['events.read'] }));
    let answer: (response: Response) => void = () => {};
    answering({
      'POST /api/orgs/org_1/leave': () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
      'GET /api/invitations/mine': () => json({ invitations: [] }),
      'GET /api/auth/me': () => json(ME),
    });
    const router = settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave Ìrè Events…' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Leave Ìrè Events?' });
    expect(
      within(ask)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Stay', 'Leave Ìrè Events']);

    fireEvent.click(within(ask).getByRole('button', { name: 'Leave Ìrè Events' }));
    expect(await within(ask).findByText('Leaving…')).toBeDefined();

    answer(new Response(null, { status: 204 }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });

  it('keeps a failed leave in the confirm, with its words', async () => {
    signedIn(membership({ role: MEMBER, permissions: ['events.read'] }));
    answering();
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave Ìrè Events…' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Leave Ìrè Events?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Leave Ìrè Events' }));

    expect(
      await within(ask).findByText(
        'That did not go through. Nothing was changed. Try again in a moment.',
      ),
    ).toBeDefined();
    expect(within(ask).getByRole('button', { name: 'Leave Ìrè Events' })).toBeDefined();
  });

  it('turns the server’s last owner into the only owner’s confirm, whose Transfer opens Transfer', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/members': () =>
        json({
          ...MEMBERS,
          members: [...MEMBERS.members, member('m_tobi', 'Tobi Ade', OWNER)],
        }),
      'POST /api/orgs/org_1/leave': () => problem('last_owner', 409),
    });
    settings();

    expect(await screen.findByRole('button', { name: 'Remove ire.events' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Leave Ìrè Events…' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Leave Ìrè Events?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Leave Ìrè Events' }));

    const only = await screen.findByRole('alertdialog', { name: 'You are the only owner' });
    expect(
      within(only)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Stay', 'Transfer ownership']);
    fireEvent.click(within(only).getByRole('button', { name: 'Transfer ownership' }));

    expect(await screen.findByRole('dialog', { name: 'Transfer ownership' })).toBeDefined();
    expect(screen.queryByRole('alertdialog', { name: 'You are the only owner' })).toBeNull();
  });

  it('checks a domain’s shape before sending it', async () => {
    signedIn();
    const sent = answering();
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Add domain' }));
    const add = await screen.findByRole('dialog', { name: 'Add a domain' });
    const field = within(add).getByLabelText('Domain');
    fireEvent.change(field, { target: { value: 'acme' } });
    fireEvent.click(within(add).getByRole('button', { name: 'Add' }));

    expect(
      await within(add).findByText('Enter a domain with a dot and no spaces, like ire.events.'),
    ).toBeDefined();
    expect(document.activeElement).toBe(field);
    expect(sent.some((one) => one.line === 'POST /api/orgs/org_1/domains')).toBe(false);
  });

  it('shows the server’s refusal under the domain field, focus on it', async () => {
    signedIn();
    answering({
      'POST /api/orgs/org_1/domains': () =>
        problem('validation_failed', 422, {
          violations: [{ propertyPath: 'domain', message: 'Your address is not at acme.com.' }],
        }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Add domain' }));
    const add = await screen.findByRole('dialog', { name: 'Add a domain' });
    const field = within(add).getByLabelText('Domain');
    fireEvent.change(field, { target: { value: 'acme.com' } });
    fireEvent.click(within(add).getByRole('button', { name: 'Add' }));

    expect(await within(add).findByText('Your address is not at acme.com.')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it('adds a domain that fills the list: its Added line, the full line, and Add domain gone', async () => {
    signedIn();
    const filled = {
      ...DOMAINS,
      most: 2,
      domains: [...DOMAINS.domains, { domain: 'ire.ng', stopped: false }],
    };
    answering({
      'GET /api/orgs/org_1/domains': () => json({ ...DOMAINS, most: 2 }),
      'POST /api/orgs/org_1/domains': () => json(filled),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Add domain' }));
    const add = await screen.findByRole('dialog', { name: 'Add a domain' });
    fireEvent.change(within(add).getByLabelText('Domain'), { target: { value: 'ire.ng' } });
    fireEvent.click(within(add).getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByText(
        'Added. People whose main email address is at it can now ask to join.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Add a domain' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add domain' })).toBeNull();
    expect(
      screen.getByText(
        /That is 2 domains, the most the list can hold\. Remove one to add another\./u,
      ),
    ).toBeDefined();
  });
});
