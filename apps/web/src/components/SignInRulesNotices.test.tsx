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
      userId: 'u1',
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
  it('takes Close this notice under "Sign-in rules changed" to Today when no notice is left', () => {
    inside(changed('org_closes_last'));

    fireEvent.click(screen.getByRole('button', { name: 'Close this notice' }));

    expect(screen.queryByText('Sign-in rules changed')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Today' }));
  });

  it('takes Not now under "Two-factor required by" to the next notice, read as its title and words', () => {
    inside({ ...changed('org_gate_then_changed'), ...GATED });

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    const title = screen.getByText('Sign-in rules changed');
    expect(document.activeElement).toBe(title.closest('.notice-words'));
    expect(document.activeElement?.textContent).toMatch(/Ìrè Events/);
    expect(document.activeElement?.textContent).not.toMatch(/See what changed/u);
    expect(title.hasAttribute('aria-describedby')).toBe(false);
  });

  it('takes Not now to Today when it was the only notice', () => {
    inside(membership({ id: 'org_gate_only', ...GATED }));

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Today' }));
  });

  it('takes Dismiss under the linked notice to the next notice', () => {
    sessionStorage.setItem('soirely.provider.linked', 'Google');
    inside(changed('org_linked_then_changed'));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(document.activeElement).toBe(
      screen.getByText('Sign-in rules changed').closest('.notice-words'),
    );
  });

  it('takes Dismiss under the linked notice to Today when no notice is left', () => {
    sessionStorage.setItem('soirely.provider.linked', 'Apple');
    inside(membership({ id: 'org_linked_only' }));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Today' }));
  });
});

describe('the notices in [fd] (sc-23252)', () => {
  it('closes Sign-in rules changed with the worded Close this notice, not a bare mark', () => {
    inside(changed('org_worded_close'));

    expect(screen.getByRole('button', { name: 'Close this notice' }).textContent).toBe(
      'Close this notice',
    );
    expect(screen.queryByText('✕')).toBeNull();
  });

  it('draws the way forward as a button and leaves Not now a text action beside it', () => {
    inside(membership({ id: 'org_actions', ...GATED }));

    const onward = screen.getByRole('link', { name: 'Turn on two-factor' });
    const later = screen.getByRole('button', { name: 'Not now' });

    expect(onward.classList.contains('button')).toBe(true);
    expect(onward.getAttribute('href')).toBe('/app/account/security');
    expect(later.classList.contains('link-button')).toBe(true);
    expect(later.parentElement).toBe(onward.parentElement);
  });

  it('keeps the order: due, read-only, two-factor required, rules changed', () => {
    inside({
      ...changed('org_all_four'),
      ...GATED,
      readOnlyUntilLinked: true,
      twoFactorDue: {
        at: '2099-11-06T15:05:00+00:00',
        written: 'Friday, Nov 6 at 16:05 WAT',
        overdue: false,
      },
    });

    expect(
      Array.from(document.querySelectorAll('.notice-rule .notice-actions .button')).map(
        (action) => action.textContent,
      ),
    ).toEqual(['Turn it on now', 'Link Google or Apple', 'Turn on two-factor', 'See what changed']);
  });
});

describe('the ring where a closed notice lands (sc-23252)', () => {
  it('marks only the words focus lands on, and only until focus leaves them', () => {
    inside({ ...changed('org_ring'), ...GATED });

    const words = screen.getByText('Sign-in rules changed').closest<HTMLElement>('.notice-words');
    expect(words?.hasAttribute('data-notice-landing')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(document.activeElement).toBe(words);
    expect(words?.hasAttribute('data-notice-landing')).toBe(true);

    words?.blur();
    expect(words?.hasAttribute('data-notice-landing')).toBe(false);
  });

  it('marks the page heading when no notice follows', () => {
    inside(changed('org_ring_heading'));

    fireEvent.click(screen.getByRole('button', { name: 'Close this notice' }));

    const heading = screen.getByRole('heading', { level: 1 });
    expect(document.activeElement).toBe(heading);
    expect(heading.hasAttribute('data-notice-landing')).toBe(true);
  });
});

describe('the overdue screen in [fd] (sc-23252)', () => {
  it('takes the page, shows no notice, and draws Sign out as a secondary, never destructive', () => {
    inside({
      ...changed('org_overdue'),
      twoFactorDue: {
        at: '2020-01-01T00:00:00+00:00',
        written: 'Wednesday, Jan 1 at 00:00 UTC',
        overdue: true,
      },
    });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Turn on two-factor to carry on',
    );
    expect(document.querySelector('.notice-rule')).toBeNull();
    expect(screen.getByRole('link', { name: 'Turn on two-factor' }).className).toContain(
      'button-primary',
    );

    const signOut = screen.getByRole('button', { name: 'Sign out' });
    expect(signOut.classList.contains('button')).toBe(true);
    expect(signOut.className).not.toMatch(/danger/u);
  });
});
