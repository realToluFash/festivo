import type { SingleSignOnPage } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { atWideWidth } from '../../../test-widths.ts';
import { routes } from '../../index.tsx';

const OKTA = {
  protocol: 'saml' as const,
  name: 'Okta',
  way: 'url' as const,
  url: 'https://okta.example/metadata',
  file: null,
  issuer: null,
  clientId: null,
};

const NOTHING: SingleSignOnPage = {
  plan: 'enterprise',
  ownerChanges: true,
  domains: ['ire.events'],
  provider: null,
  staying: null,
  test: 'untested',
  testedAt: null,
  tested: null,
  testedEmail: null,
  testedName: null,
  testFailure: null,
  testFailureFromProvider: false,
  on: false,
  required: false,
  ours: {
    saml: { entityId: 'urn:e', replyUrl: 'urn:r', metadataUrl: 'urn:m' },
    oidc: { redirectUrl: 'urn:o' },
  },
};

const SAVED: SingleSignOnPage = { ...NOTHING, provider: OKTA };
const ON: SingleSignOnPage = { ...SAVED, test: 'passed', on: true };

function signedIn(): void {
  const organisation = membership();
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    userId: 'u1',
    needsOrganisation: false,
    organisation,
    organisations: [organisation],
    organisationCountry: null,
    timezone: 'Africa/Lagos',
    waitingFor: null,
    hasPassword: true,
    providers: [],
  };

  __setSessionState({ status: 'signedIn', session });
}

const PATH = '/api/orgs/org_1/single-sign-on';

function answering(answers: Record<string, unknown>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ line, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    if (!(line in answers)) throw new TypeError('Failed to fetch');

    return new Response(JSON.stringify(answers[line]), {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return sent;
}

function open() {
  signedIn();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, {
        initialEntries: ['/app/settings/sign-in-rules/single-sign-on'],
      })}
    />,
  );
}

beforeEach(() => {
  atWideWidth();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('single sign-on settings', () => {
  it('checks the form before sending, then saves an OpenID Connect provider', async () => {
    const sent = answering({ [`GET ${PATH}`]: NOTHING, [`PUT ${PATH}/provider`]: SAVED });
    open();

    fireEvent.click(await screen.findByRole('radio', { name: /OpenID Connect/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));

    expect(screen.getByText('Enter the client secret.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);

    const type = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    type('Provider name', 'Google Workspace');
    type('Issuer URL', 'https://accounts.google.com');
    type('Client ID', 'client');
    type('Client secret', 'secret');
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));

    expect(await screen.findByText('Saved, not tested')).toBeDefined();
    expect(sent.find((one) => one.line.startsWith('PUT'))?.body).toEqual({
      protocol: 'oidc',
      name: 'Google Workspace',
      issuer: 'https://accounts.google.com',
      clientId: 'client',
      clientSecret: 'secret',
    });
  });

  it('refuses the switch until a test has worked', async () => {
    const sent = answering({ [`GET ${PATH}`]: SAVED });
    open();

    fireEvent.click(await screen.findByRole('switch', { name: 'Single sign-on' }));

    expect(screen.getByRole('alert').textContent).toContain('Test sign-on first.');
    expect(sent.some((one) => one.line.startsWith('POST'))).toBe(false);
  });

  it('asks before requiring sign-on', async () => {
    const sent = answering({
      [`GET ${PATH}`]: ON,
      [`POST ${PATH}/required`]: { ...ON, required: true },
    });
    open();

    fireEvent.click(await screen.findByRole('switch', { name: 'Required sign-on' }));
    expect(sent.some((one) => one.line.startsWith('POST'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Require sign-on' }));

    expect(await screen.findByText('Required')).toBeDefined();
  });

  it('refuses removal while sign-on is required', async () => {
    answering({ [`GET ${PATH}`]: { ...ON, required: true } });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Okta…' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Turn off required sign-on first.'),
    );
  });

  it('shows an admin where it stands, with nothing to change', async () => {
    answering({ [`GET ${PATH}`]: { ...ON, ownerChanges: false } });
    open();

    expect(
      await screen.findByText('Only an owner can set up or change single sign-on.'),
    ).toBeDefined();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
