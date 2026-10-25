import type { Membership } from '@soirely/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../session.ts';
import { membership } from '../test-memberships.ts';
import { routes } from '../routes/index.tsx';

function inside(organisation: Membership): void {
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Folake Adeyemi',
      email: 'folake@ire.events',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      needsOrganisation: false,
      hasPassword: true,
      organisation,
      organisations: [organisation],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ invitations: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app'] })} />);
}

function changed(id: string): Membership {
  return membership({
    id,
    signInRules: { ...membership().signInRules, changedAt: '2026-10-20T09:00:00+00:00' },
  });
}

const GATED = { withheldUntilTwoFactor: ['budget.read'] } as Partial<Membership>;

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  sessionStorage.clear();
});

describe('a notice closed with its own button (sc-11369)', () => {
  it('takes Close this notice under "Sign-in rules changed" to Dashboard when no notice is left', () => {
    inside(changed('org_closes_last'));

    fireEvent.click(screen.getByRole('button', { name: 'Close this notice' }));

    expect(screen.queryByText('Sign-in rules changed')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' }),
    );
  });

  it('takes Not now under "Two-factor required by" to the next notice, read as its title and words', () => {
    inside({ ...changed('org_gate_then_changed'), ...GATED });

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    const title = screen.getByText('Sign-in rules changed');
    expect(document.activeElement).toBe(title);
    expect(
      document.getElementById(title.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toMatch(/Ìrè Events/);
  });

  it('takes Not now to Dashboard when it was the only notice', () => {
    inside(membership({ id: 'org_gate_only', ...GATED }));

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' }),
    );
  });

  it('takes Dismiss under the linked notice to the next notice', () => {
    sessionStorage.setItem('soirely.provider.linked', 'Google');
    inside(changed('org_linked_then_changed'));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(document.activeElement).toBe(screen.getByText('Sign-in rules changed'));
  });

  it('takes Dismiss under the linked notice to Dashboard when no notice is left', () => {
    sessionStorage.setItem('soirely.provider.linked', 'Apple');
    inside(membership({ id: 'org_linked_only' }));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' }),
    );
  });
});
