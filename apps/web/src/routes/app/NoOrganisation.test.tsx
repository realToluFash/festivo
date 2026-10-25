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
      waitingFor: null,
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function answering(answers: Record<string, () => Response | Promise<Response>>) {
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
    expect(document.activeElement).toBe(screen.getByLabelText('Organisation name'));
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
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Organisation name')),
    );
    expect(screen.queryByText('Starting it did not work. Try again in a moment.')).toBeNull();
  });

  it('puts focus on the country when the refusal names only the country', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () =>
        json(
          {
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Some fields need attention.',
            status: 422,
            violations: [{ propertyPath: 'countryCode', message: 'Not a country.', code: 'x' }],
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

    expect(await screen.findByText('Not a country.')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Country')));
  });

  it('holds both fields while it starts, the button reading Starting…', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => new Promise<Response>(() => {}),
    });
    app();

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: 'Okoro Weddings' },
    });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start organisation' }));

    expect(await screen.findByRole('button', { name: 'Starting…' })).toBeDefined();
    expect((screen.getByLabelText('Organisation name') as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText('Country') as HTMLSelectElement).disabled).toBe(true);
  });

  it('keeps focus in Organisation name while it starts after Enter, and there once refused (sc-11588)', async () => {
    inNone();
    let answer: (response: Response) => void = () => {};
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    app();

    const name = (await screen.findByLabelText('Organisation name')) as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Okoro Weddings' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    name.focus();
    fireEvent.submit(name);

    await screen.findByRole('button', { name: 'Starting…' });
    expect(document.activeElement).toBe(name);

    answer(json({ type: 'about:blank', title: 'Internal Server Error', status: 500 }, 500));
    expect(await screen.findByRole('button', { name: 'Start organisation' })).toBeDefined();
    expect(document.activeElement).toBe(name);
  });

  it('sends one request for a double press, then one more after a failure (sc-8327)', async () => {
    inNone();
    let answer: (response: Response) => void = () => {};
    const sent = answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    const posts = () => sent.filter(({ line }) => line === 'POST /api/orgs');
    app();

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: 'Okoro Weddings' },
    });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    const form = screen.getByLabelText('Organisation name').closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    const starting = await screen.findByRole('button', { name: 'Starting…' });
    expect(starting.matches(':disabled')).toBe(true);
    fireEvent.click(starting);
    await waitFor(() => expect(posts()).toHaveLength(1));

    answer(json({ type: 'about:blank', title: 'Internal Server Error', status: 500 }, 500));
    const start = await screen.findByRole('button', { name: 'Start organisation' });
    expect(start.matches(':disabled')).toBe(false);
    expect(posts()).toHaveLength(1);
    fireEvent.click(start);
    await waitFor(() => expect(posts()).toHaveLength(2));
  });

  it.each([
    [
      'too many new organisations',
      () =>
        json(
          {
            type: 'https://soirely.com/errors/too_many_attempts',
            title: 'Too many attempts.',
            status: 429,
          },
          429,
        ),
    ],
    [
      'a server error',
      () => json({ type: 'about:blank', title: 'Internal Server Error', status: 500 }, 500),
    ],
    [
      'no network',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('puts focus back on the name, keeping what was entered, after %s', async (_, answer) => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': answer,
    });
    app();

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: 'Okoro Weddings' },
    });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start organisation' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const name = screen.getByLabelText<HTMLInputElement>('Organisation name');
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(name.value).toBe('Okoro Weddings');
    expect(screen.getByLabelText<HTMLSelectElement>('Country').value).toBe('GH');
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
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Organisation name')),
    );
  });
});
