import { type Account, type Membership } from '@soirely/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SIGNED_OUT, api } from './api.ts';
import { setLanguage } from './i18n/index.ts';
import {
  __setSessionState,
  forgetSession,
  joinOrganisation,
  refreshAccount,
  useSessionState,
} from './session.ts';
import { membership } from './test-memberships.ts';
import { act, renderHook, waitFor } from '@testing-library/react';

function signedOutBy(detail: unknown) {
  window.dispatchEvent(new CustomEvent(SIGNED_OUT, { detail }));

  return renderHook(() => useSessionState()).result.current;
}

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
});

describe('a session the API ended', () => {
  it('carries an organisation’s inactivity rule to sign-in (sc-69)', () => {
    expect(
      signedOutBy({
        type: 'https://soirely.com/errors/session_timed_out',
        title: 'Signed out.',
        status: 401,
        organisation: 'Ìrè Events',
        days: 7,
        email: 'folake@ire.events',
      }),
    ).toEqual({
      status: 'signedOut',
      ended: true,
      timedOut: { organisation: 'Ìrè Events', days: 7, email: 'folake@ire.events' },
    });
  });

  it('carries a Google-or-Apple-only rule that ended a password session to sign-in (sc-69)', () => {
    expect(
      signedOutBy({
        type: 'https://soirely.com/errors/oauth_only',
        title: 'No.',
        status: 403,
        organisation: 'Ìrè Events',
        providers: ['google'],
        email: 'folake@ire.events',
      }),
    ).toEqual({
      status: 'signedOut',
      ended: true,
      providerOnly: {
        organisation: 'Ìrè Events',
        providers: ['google'],
        email: 'folake@ire.events',
      },
    });
  });

  it('says only that it ended for any other reason', () => {
    expect(
      signedOutBy({
        type: 'https://soirely.com/errors/unauthenticated',
        title: 'No.',
        status: 401,
      }),
    ).toEqual({ status: 'signedOut', ended: true });
    expect(signedOutBy(undefined)).toEqual({ status: 'signedOut', ended: true });
  });
});

describe('a sign-out while the account is still being read', () => {
  it('stays signed out when the answer lands afterwards', async () => {
    let answer: (account: Account) => void = () => {};
    vi.spyOn(api, 'me').mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    const refreshing = refreshAccount();
    forgetSession();
    answer({
      id: 'acc_1',
      name: 'Folake',
      businessName: null,
      countryCode: null,
      organisationCountry: null,
      locale: 'en',
      timezone: null,
      verified: false,
      complete: false,
      needsOrganisation: false,
      hasPassword: true,
      twoFactorSetupPrompt: false,
      waitingFor: null,
      providers: [],
      emailAddresses: [],
      phoneNumbers: [],
    });
    await refreshing;

    expect(renderHook(() => useSessionState()).result.current).toEqual({
      status: 'signedOut',
      ended: false,
    });
  });
});

describe('the organisations after a language change (sc-9267)', () => {
  const due = (written: string) => ({ at: '2026-10-31T10:44:00+00:00', written, overdue: false });

  afterEach(async () => {
    await act(() => setLanguage(null));
  });

  function signedInWith(organisation: Membership): void {
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
  }

  function shownDeadline(): string | undefined {
    const current = renderHook(() => useSessionState()).result.current;

    return current.status === 'signedIn'
      ? current.session.organisation?.twoFactorDue?.written
      : undefined;
  }

  it('reads them again, and the organisation shown carries the date in the new language', async () => {
    signedInWith(membership({ twoFactorDue: due('Saturday 31 Oct at 10:44 GMT') }));
    const read = vi.spyOn(api, 'organisationsWithPaused').mockResolvedValue({
      organisations: [membership({ twoFactorDue: due('sábado 31 oct a las 10:44 GMT') })],
      paused: [],
    });

    await act(() => setLanguage('es'));

    await waitFor(() => expect(shownDeadline()).toBe('sábado 31 oct a las 10:44 GMT'));
    expect(read).toHaveBeenCalledOnce();
  });

  it('leaves them as they were when the read fails', async () => {
    signedInWith(membership({ twoFactorDue: due('Saturday 31 Oct at 10:44 GMT') }));
    const read = vi.spyOn(api, 'organisationsWithPaused').mockRejectedValue(new Error('offline'));

    await act(() => setLanguage('es'));

    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(shownDeadline()).toBe('Saturday 31 Oct at 10:44 GMT');
  });
  it('keeps an organisation joined while the read was on its way', async () => {
    signedInWith(membership({ twoFactorDue: due('Saturday 31 Oct at 10:44 GMT') }));
    let answer: (read: Awaited<ReturnType<typeof api.organisationsWithPaused>>) => void = () => {};
    vi.spyOn(api, 'organisationsWithPaused').mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    await act(() => setLanguage('es'));
    act(() => joinOrganisation(membership({ id: 'org_2', name: 'Ọ̀ṣun Parties' })));
    await act(async () => {
      answer({
        organisations: [membership({ twoFactorDue: due('sábado 31 oct a las 10:44 GMT') })],
        paused: [],
      });
    });

    const current = renderHook(() => useSessionState()).result.current;
    expect(
      current.status === 'signedIn' ? current.session.organisations.map(({ id }) => id) : [],
    ).toEqual(['org_1', 'org_2']);
  });
});
