import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

const PHONE = {
  id: 'p1',
  number: '+2348035550142',
  countryCode: 'NG',
  verified: false,
  primary: true,
};

function account(phoneNumbers: unknown[] = [PHONE]) {
  return {
    id: 'acc_1',
    name: 'Folake Adeyemi',
    businessName: null,
    countryCode: null,
    organisationCountry: null,
    locale: 'en',
    verified: false,
    complete: false,
    needsOrganisation: true,
    hasPassword: true,
    emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
    phoneNumbers,
  };
}

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function answering(answers: Record<string, (body: unknown) => Response>) {
  const sent: { method: string; path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const path = new URL(String(input)).pathname;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ method, path, body });

    const answer = answers[`${method} ${path}`];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer(body);
  });

  return sent;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function problem(status: number, code: string): Response {
  return json({ type: `https://soirely.com/errors/${code}`, title: 'No.', status }, status);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('check your messages', () => {
  it('names the number as people read it, and counts down from the server', async () => {
    answering({
      'GET /api/auth/me': () => json(account()),
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 42 }),
    });
    at('/verify-phone');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Check your messages' })).toBeDefined(),
    );
    expect(screen.getByText('We texted a code to +234 803 555 0142.')).toBeDefined();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send a new code in 0:42' })).toBeDefined(),
    );
    expect(screen.getByLabelText('Code from the text').getAttribute('autocomplete')).toBe(
      'one-time-code',
    );
  });

  it('opens on the banner when the code is already spent or expired, and on the field while it is live', async () => {
    for (const [codeState, title] of [
      ['exhausted', 'Too many wrong tries'],
      ['expired', 'That code has expired'],
    ] as const) {
      answering({
        'GET /api/auth/me': () => json(account()),
        'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 0, codeState }),
      });
      const view = at('/verify-phone');

      expect(await screen.findByText(title)).toBeDefined();
      expect(screen.queryByLabelText('Code from the text')).toBeNull();
      expect(screen.getByRole('button', { name: 'Send a new code' })).toBeDefined();
      view.unmount();
      vi.restoreAllMocks();
    }

    answering({
      'GET /api/auth/me': () => json(account()),
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 0, codeState: 'live' }),
    });
    at('/verify-phone');
    expect(await screen.findByLabelText('Code from the text')).toBeDefined();
  });

  it('checks the code is six digits before sending', async () => {
    const sent = answering({
      'GET /api/auth/me': () => json(account()),
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 0 }),
    });
    at('/verify-phone');
    await screen.findByLabelText('Code from the text');

    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
    expect(screen.getByText('Enter the 6-digit code from the text.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code from the text'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
    expect(screen.getByText('The code is 6 digits.')).toBeDefined();

    expect(sent.filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('says a wrong code is wrong, and a right one verifies the number', async () => {
    let tries = 0;
    answering({
      'GET /api/auth/me': () => json(account()),
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 0 }),
      'POST /api/auth/verify/phone': () =>
        ++tries === 1
          ? problem(422, 'verification_code_invalid')
          : json({ ...PHONE, verified: true }),
    });
    at('/verify-phone');
    await screen.findByLabelText('Code from the text');

    fireEvent.change(screen.getByLabelText('Code from the text'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
    await waitFor(() => expect(screen.getByText(/That code does not match/)).toBeDefined());

    fireEvent.change(screen.getByLabelText('Code from the text'), { target: { value: '184231' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Number verified' })).toBeDefined(),
    );
    expect(screen.getByText(/Soirely can reach you on \+234 803 555 0142/)).toBeDefined();
  });

  it('offers a fresh code when the last one expired or was spent', async () => {
    answering({
      'GET /api/auth/me': () => json(account()),
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 0 }),
      'POST /api/auth/verify/phone': () => problem(422, 'verification_code_exhausted'),
    });
    at('/verify-phone');
    await screen.findByLabelText('Code from the text');

    fireEvent.change(screen.getByLabelText('Code from the text'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));

    await waitFor(() => expect(screen.getByText('Too many wrong tries')).toBeDefined());
    expect(screen.getAllByRole('button', { name: 'Send a new code' }).length).toBeGreaterThan(0);
  });

  it('carries on without the phone by saving the details with none', async () => {
    let removed = false;
    const sent = answering({
      'GET /api/auth/me': () =>
        json(
          removed
            ? { ...account([]), verified: true, complete: true, needsOrganisation: false }
            : { ...account(), complete: true, needsOrganisation: false },
        ),
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 0 }),
      'PATCH /api/auth/complete-profile': () => {
        removed = true;
        return json({ account: account([]), verificationNeeded: false });
      },
      'GET /api/orgs': () => json({ organisations: [] }),
    });
    at('/verify-phone?from=onboarding');

    fireEvent.click(await screen.findByRole('button', { name: 'Carry on without it' }));

    await waitFor(() => expect(removed).toBe(true));
    expect(sent.find((request) => request.method === 'PATCH')?.body).toEqual({
      name: 'Folake Adeyemi',
    });
  });

  it('asks for the code sent to a replacement, not the number it will replace', async () => {
    const current = { ...PHONE, verified: true };
    const replacement = {
      id: 'p2',
      number: '+233244123456',
      countryCode: 'GH',
      verified: false,
      primary: false,
      pending: true,
    };
    answering({
      'GET /api/auth/me': () => json(account([current, replacement])),
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 60 }),
    });
    at('/verify-phone');

    await waitFor(() =>
      expect(screen.getByText('We texted a code to +233 24 412 3456.')).toBeDefined(),
    );
    expect(screen.getByLabelText('Code from the text')).toBeDefined();
  });

  it('asks for a number first when there is none', async () => {
    answering({
      'GET /api/auth/me': () => json(account([])),
      'GET /api/auth/verify/phone/resend': () => problem(404, 'not_found'),
    });
    at('/verify-phone');

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Change your mobile number' }),
      ).toBeDefined(),
    );
  });
});

describe('change your mobile number', () => {
  it('shows the current number, says it keeps working until the new one is verified, and starts on its country', async () => {
    answering({ 'GET /api/auth/me': () => json(account([{ ...PHONE, verified: true }])) });
    at('/phone');

    await waitFor(() =>
      expect(screen.getByText('Now: +234 803 555 0142 · verified')).toBeDefined(),
    );
    expect(screen.getByText(/keeps working until the new one is verified/)).toBeDefined();
    expect((screen.getByLabelText('Code') as HTMLSelectElement).value).toBe('NG');
    expect(screen.getByRole('button', { name: 'Keep my current number' })).toBeDefined();
  });

  it('checks the length for the chosen country before sending', async () => {
    const sent = answering({ 'GET /api/auth/me': () => json(account([])) });
    at('/phone');
    await screen.findByLabelText('Mobile number');

    fireEvent.click(screen.getByRole('button', { name: 'Text a code to this number' }));
    expect(screen.getByText('Enter your mobile number.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'NG' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '803 55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Text a code to this number' }));
    expect(
      screen.getByText('That number looks too short for Nigeria. Check it and try again.'),
    ).toBeDefined();

    expect(sent.filter((request) => request.method === 'PUT')).toEqual([]);
  });

  it('texts a code to the new number and opens the code screen', async () => {
    let saved = false;
    const sent = answering({
      'GET /api/auth/me': () => json(account(saved ? [PHONE] : [])),
      'PUT /api/auth/phone': () => {
        saved = true;
        return json({ phone: PHONE, verificationNeeded: true, cooldownSeconds: 60 });
      },
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 60 }),
    });
    at('/phone');
    await screen.findByLabelText('Mobile number');

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'NG' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), {
      target: { value: '0803 555 0142' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Text a code to this number' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Check your messages' })).toBeDefined(),
    );
    expect(sent.find((request) => request.method === 'PUT')?.body).toEqual({
      countryCode: 'NG',
      number: '0803 555 0142',
    });
  });

  it('says a number verified on another account is taken, with a way out', async () => {
    answering({
      'GET /api/auth/me': () => json(account([{ ...PHONE, verified: true }])),
      'PUT /api/auth/phone': () => problem(409, 'phone_taken'),
    });
    at('/phone');
    await screen.findByLabelText('Mobile number');

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'GH' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '024 412 3456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Text a code to this number' }));

    await waitFor(() =>
      expect(
        screen.getByText(/already linked to another account\. Your current number is unchanged\./),
      ).toBeDefined(),
    );
    expect(screen.getByLabelText('Mobile number').getAttribute('aria-invalid')).toBe('true');
  });
});
