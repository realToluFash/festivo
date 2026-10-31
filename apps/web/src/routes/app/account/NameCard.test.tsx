import {
  act,
  fireEvent,
  getDefaultNormalizer,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { tokens } from '../../../tokens.ts';
import { routes } from '../../index.tsx';

const MEMBERSHIP = membership({ id: 'acc_1', name: 'Ire Events' });

const FOLAKE: Session = {
  name: 'Folake Ire',
  email: 'folake@ire.events',
  verified: true,
  complete: true,
  awaiting: null,
  providers: [],
  userId: 'u1',
  needsOrganisation: false,
  hasPassword: true,
  organisation: MEMBERSHIP,
  organisations: [MEMBERSHIP],
  organisationCountry: null,
  timezone: 'Africa/Lagos',
  waitingFor: null,
};

interface Sent {
  call: string;
  body: unknown;
}

function answering(answers: Record<string, () => Response | Promise<Response>> = {}): Sent[] {
  const sent: Sent[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ call, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer =
      answers[call] ?? (call === 'GET /api/auth/timezones' ? () => json({ timezones: [] }) : null);
    if (answer == null) throw new Error(`Nothing stubbed for ${call}`);

    return answer();
  });

  return sent;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function me(name: string): Response {
  return json({
    id: 'acc_1',
    name,
    businessName: null,
    countryCode: null,
    locale: 'en',
    timezone: 'Africa/Lagos',
    verified: true,
    complete: true,
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    providers: [],
    emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
    phoneNumbers: [],
  });
}

/** The account block at the foot of the sidebar. */
function sidebarName(): string | null | undefined {
  return document.querySelector('.shell-account span')?.textContent;
}

function open() {
  __setSessionState({ status: 'signedIn', session: FOLAKE });

  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/account'] })} />,
  );
}

function card(): HTMLElement {
  return screen.getByRole('region', { name: 'Name' });
}

function field(): HTMLInputElement {
  return within(card()).getByLabelText('Full name');
}

async function change(): Promise<void> {
  fireEvent.click(within(await screen.findByRole('region', { name: 'Name' })).getByText('Change'));
}

beforeEach(() => {
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: 's' });
});

afterEach(() => {
  vi.restoreAllMocks();
  tokens.clear();
});

describe("the account's name", () => {
  it('comes first, with the name and Change', async () => {
    answering();
    open();

    const name = await screen.findByRole('region', { name: 'Name' });
    expect(within(name).getByText('Folake Ire')).toBeDefined();
    expect(within(name).getByRole('button', { name: 'Change' })).toBeDefined();
    const regions = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-labelledby'));
    expect(regions[0]).toBe('name-title');
  });

  it('opens a Full name field holding the name, which autofill knows as a name and stops at 180', async () => {
    answering();
    open();
    await change();

    expect(field().value).toBe('Folake Ire');
    expect(field().getAttribute('autocomplete')).toBe('name');
    expect(field().maxLength).toBe(180);
    expect(document.activeElement).toBe(field());
    expect(within(card()).getByRole('button', { name: 'Save name' })).toBeDefined();
  });

  it('saves the name with its ends trimmed, says so, and the session reads it at once', async () => {
    const sent = answering({
      'PUT /api/auth/name': () => json({ name: 'Zoë  O’Brien-Núñez' }),
      'GET /api/auth/me': () => me('Zoë  O’Brien-Núñez'),
      'GET /api/orgs': () => json({ organisations: [MEMBERSHIP] }),
    });
    open();
    await change();

    fireEvent.change(field(), { target: { value: '  Zoë  O’Brien-Núñez ' } });
    fireEvent.click(within(card()).getByRole('button', { name: 'Save name' }));

    expect(
      await within(card()).findByText('Name changed to Zoë  O’Brien-Núñez.', {
        normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
      }),
    ).toBeDefined();
    expect(sent.find((call) => call.call === 'PUT /api/auth/name')?.body).toEqual({
      name: 'Zoë  O’Brien-Núñez',
    });
    expect(screen.queryByLabelText('Full name')).toBeNull();
    expect(sidebarName()).toBe('Zoë  O’Brien-Núñez');
  });

  it('disables the field and both buttons while it saves', async () => {
    let answer: (response: Response) => void = () => {};
    answering({
      'PUT /api/auth/name': () => new Promise((resolve) => (answer = resolve)),
      'GET /api/auth/me': () => me('李小龍'),
      'GET /api/orgs': () => json({ organisations: [MEMBERSHIP] }),
    });
    open();
    await change();

    fireEvent.change(field(), { target: { value: '李小龍' } });
    fireEvent.click(within(card()).getByRole('button', { name: 'Save name' }));

    const saving = await within(card()).findByRole('button', { name: 'Saving…' });
    expect(saving.getAttribute('aria-busy')).toBe('true');
    expect(within(card()).getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(field().readOnly).toBe(true);
    expect(field().getAttribute('aria-disabled')).toBe('true');

    await act(async () => answer(json({ name: '李小龍' })));
    expect(await within(card()).findByText('Name changed to 李小龍.')).toBeDefined();
  });

  it('refuses a blank name with a message tied to the field, until something is typed', async () => {
    const sent = answering();
    open();
    await change();

    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.click(within(card()).getByRole('button', { name: 'Save name' }));

    const message = within(card()).getByRole('alert');
    expect(within(message).getByText('Enter your name.')).toBeDefined();
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toBe(message.id);
    expect(sent.some((call) => call.call === 'PUT /api/auth/name')).toBe(false);

    fireEvent.change(field(), { target: { value: 'F' } });
    expect(within(card()).queryByRole('alert')).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBe('false');
  });

  it('closes with nothing sent and no line when the name is unchanged', async () => {
    const sent = answering();
    open();
    await change();

    fireEvent.change(field(), { target: { value: ' Folake Ire  ' } });
    fireEvent.click(within(card()).getByRole('button', { name: 'Save name' }));

    expect(screen.queryByLabelText('Full name')).toBeNull();
    expect(within(card()).queryByText(/Name changed/)).toBeNull();
    expect(sent.some((call) => call.call === 'PUT /api/auth/name')).toBe(false);
  });

  it('keeps the field and what was typed when the save cannot reach the server', async () => {
    answering({
      'PUT /api/auth/name': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    open();
    await change();

    fireEvent.change(field(), { target: { value: 'Folake Adé' } });
    fireEvent.click(within(card()).getByRole('button', { name: 'Save name' }));

    expect(
      await within(card()).findByText(
        'Your name could not be saved. Check your connection and try again.',
      ),
    ).toBeDefined();
    expect(field().value).toBe('Folake Adé');
    expect(sidebarName()).toBe('Folake Ire');
  });

  it('leaves the name as it was on Cancel, and goes back to Change', async () => {
    const sent = answering();
    open();
    await change();

    fireEvent.change(field(), { target: { value: 'Someone else' } });
    fireEvent.click(within(card()).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(within(card()).getByRole('button', { name: 'Change' })),
    );
    expect(within(card()).getByText('Folake Ire')).toBeDefined();
    expect(sent.some((call) => call.call === 'PUT /api/auth/name')).toBe(false);
  });
});
