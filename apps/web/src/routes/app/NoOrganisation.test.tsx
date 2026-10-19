import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

function inNone(): void {
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Chidi Okoro',
      email: 'chidi@ire.events',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      needsOrganisation: false,
      hasPassword: true,
      organisation: null,
      organisations: [],
      organisationCountry: null,
      timezone: null,
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function answering(answers: Record<string, () => Response>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ line, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function app() {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app'] })} />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
});

describe('No organisation', () => {
  it('asks for a name and a country before starting one sends anything', async () => {
    inNone();
    const sent = answering({ 'GET /api/invitations': () => json({ invitations: [] }) });
    app();

    fireEvent.change(await screen.findByLabelText('Country'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start organisation' }));

    expect(screen.getByText("Enter the organisation's name.")).toBeDefined();
    expect(screen.getByText('Choose a country.')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/orgs')).toBe(false);
  });

  it('refuses a name over 100 characters, saying how long it is', async () => {
    inNone();
    const sent = answering({ 'GET /api/invitations': () => json({ invitations: [] }) });
    app();

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: 'a'.repeat(101) },
    });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start organisation' }));

    expect(screen.getByText('That name is 101 characters. Use 100 or fewer.')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/orgs')).toBe(false);
  });

  it('starts one and opens it, with the account as its owner', async () => {
    inNone();
    const started = membership({ id: 'org_9', name: 'Okoro Weddings', countryCode: 'GH' });
    const sent = answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => json({ organisation: started }, 201),
    });
    app();

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: '  Okoro Weddings ' },
    });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start organisation' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'You are not in an organisation' })).toBeNull(),
    );
    expect(screen.getByText('Now working in Okoro Weddings.')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/orgs')?.body).toMatchObject({
      name: 'Okoro Weddings',
      countryCode: 'GH',
    });
  });

  it('shows the server refusal against the field it names', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () =>
        json(
          {
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Some fields need attention.',
            status: 422,
            violations: [
              { propertyPath: 'name', message: 'Keep it to 100 characters.', code: 'x' },
            ],
          },
          422,
        ),
    });
    app();

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: 'Okoro Weddings' },
    });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start organisation' }));

    expect(await screen.findByText('Keep it to 100 characters.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'You are not in an organisation' })).toBeDefined();
  });

  it('says starting it did not work when the refusal names no field the page has', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () =>
        json(
          {
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Some fields need attention.',
            status: 422,
            violations: [{ propertyPath: 'contactAddress', message: 'Bad address.', code: 'x' }],
          },
          422,
        ),
    });
    app();

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: 'Okoro Weddings' },
    });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start organisation' }));

    expect(
      await screen.findByText('Starting it did not work. Try again in a moment.'),
    ).toBeDefined();
    expect(screen.queryByText('Bad address.')).toBeNull();
  });
});
