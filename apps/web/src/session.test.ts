import { type Account, type Membership } from '@soirely/api-client';
import { rememberedEntry, rememberedFor } from '@soirely/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SIGNED_OUT, api } from './api.ts';
import { SCHEME_KEY, __resetColourScheme, startColourScheme } from './colourScheme.ts';
import { setLanguage } from './i18n/index.ts';
import {
  type Session,
  __setSessionState,
  adoptAccount,
  forgetSession,
  joinOrganisation,
  onMovedOn,
  rereadOrganisations,
  refreshAccount,
  switchOrganisation,
  useSessionState,
} from './session.ts';
import { membership } from './test-memberships.ts';
import { act, renderHook, waitFor } from '@testing-library/react';

const SIGNED_IN: Session = {
  userId: 'u1',
  name: 'Folake Adeyemi',
  email: 'folake@ire.events',
  verified: true,
  complete: true,
  awaiting: null,
  providers: [],
  hasPassword: true,
  needsOrganisation: false,
  organisations: [],
  organisationCountry: null,
  timezone: null,
  waitingFor: null,
  outsideEvents: [],
  signedOutAt: null,
  organisation: null,
  pausedIn: null,
};

function signedOutBy(detail: unknown, before: 'signedIn' | 'checking' = 'signedIn') {
  __setSessionState(
    before === 'signedIn' ? { status: 'signedIn', session: SIGNED_IN } : { status: 'checking' },
  );
  window.dispatchEvent(new CustomEvent(SIGNED_OUT, { detail }));

  return renderHook(() => useSessionState()).result.current;
}

afterEach(() => {
  vi.restoreAllMocks();
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

describe('a tab that never held a session (sc-612)', () => {
  it('arrived signed out when the API refuses its refresh, and still says the session ended', () => {
    expect(
      signedOutBy(
        { type: 'https://soirely.com/errors/unauthenticated', title: 'No.', status: 401 },
        'checking',
      ),
    ).toEqual({ status: 'signedOut', ended: true, arrived: true });
  });

  it('still says which rule ended the session its cookie held', () => {
    expect(
      signedOutBy(
        {
          type: 'https://soirely.com/errors/session_timed_out',
          title: 'Signed out.',
          status: 401,
          organisation: 'Ìrè Events',
          days: 7,
          email: 'folake@ire.events',
        },
        'checking',
      ),
    ).toEqual({
      status: 'signedOut',
      ended: true,
      arrived: true,
      timedOut: { organisation: 'Ìrè Events', days: 7, email: 'folake@ire.events' },
    });
  });
});

describe("the account's colours at sign-in (sc-30441)", () => {
  afterEach(() => {
    __resetColourScheme();
    localStorage.clear();
  });

  it('takes the scheme the sign-in answered, with no /me read and no reload', async () => {
    startColourScheme();
    const me = vi.spyOn(api, 'me');

    await adoptAccount({
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
      colourScheme: 'garden',
      waitingFor: null,
      providers: [],
      emailAddresses: [],
      phoneNumbers: [],
      outsideEvents: [],
      signedOutAt: null,
    });

    expect(document.documentElement.dataset.scheme).toBe('garden');
    expect(localStorage.getItem(SCHEME_KEY)).toBe('garden');
    expect(me).not.toHaveBeenCalled();
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
      colourScheme: null,
      waitingFor: null,
      providers: [],
      emailAddresses: [],
      phoneNumbers: [],
      outsideEvents: [],
      signedOutAt: null,
    });
    await refreshing;

    expect(renderHook(() => useSessionState()).result.current).toEqual({
      status: 'signedOut',
      ended: false,
    });
  });
});

function account(overrides: Partial<Account>): Account {
  return {
    id: 'acc_1',
    name: 'Folake Adeyemi',
    businessName: null,
    countryCode: null,
    organisationCountry: null,
    locale: null,
    timezone: null,
    verified: true,
    complete: true,
    needsOrganisation: false,
    hasPassword: true,
    twoFactorSetupPrompt: false,
    colourScheme: null,
    waitingFor: null,
    providers: [],
    emailAddresses: [],
    phoneNumbers: [],
    outsideEvents: [],
    signedOutAt: null,
    ...overrides,
  };
}

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
  }

  function watchDeadline(): () => string | undefined {
    const { result } = renderHook(() => useSessionState());

    return () =>
      result.current.status === 'signedIn'
        ? result.current.session.organisation?.twoFactorDue?.written
        : undefined;
  }

  it('reads them again, and the organisation shown carries the date in the new language', async () => {
    signedInWith(membership({ twoFactorDue: due('Saturday 31 Oct at 10:44 GMT') }));
    const read = vi.spyOn(api, 'organisationsWithPaused').mockResolvedValue({
      organisations: [membership({ twoFactorDue: due('sábado 31 oct a las 10:44 GMT') })],
      paused: [],
    });

    await act(() => setLanguage('es'));

    const shownDeadline = watchDeadline();
    await waitFor(() => expect(shownDeadline()).toBe('sábado 31 oct a las 10:44 GMT'));
    expect(read).toHaveBeenCalledOnce();
  });

  it('reads them again when the account’s language is followed after they were read', async () => {
    __setSessionState({ status: 'checking' });
    const read = vi
      .spyOn(api, 'organisationsWithPaused')
      .mockResolvedValueOnce({
        organisations: [membership({ twoFactorDue: due('Saturday 31 Oct at 10:44 GMT') })],
        paused: [],
      })
      .mockResolvedValue({
        organisations: [membership({ twoFactorDue: due('sábado, 31 de out. às 10:44 GMT') })],
        paused: [],
      });

    await act(() => adoptAccount(account({ locale: 'pt' })));

    const shownDeadline = watchDeadline();
    await waitFor(() => expect(shownDeadline()).toBe('sábado, 31 de out. às 10:44 GMT'));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('leaves them as they were when the read fails', async () => {
    signedInWith(membership({ twoFactorDue: due('Saturday 31 Oct at 10:44 GMT') }));
    const read = vi.spyOn(api, 'organisationsWithPaused').mockRejectedValue(new Error('offline'));

    await act(() => setLanguage('es'));

    await waitFor(() => expect(read).toHaveBeenCalled());
    const shownDeadline = watchDeadline();
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

describe('the organisation this browser was last in, paused there (sc-86056)', () => {
  const ORGANISATION = 'soirely.organisation';
  const a = membership();
  const b = membership({ id: 'org_2', name: 'Ọ̀ṣun Parties' });
  const pausedA = {
    ...a,
    suspension: {
      reason: 'address_gone' as const,
      domain: 'ire.events',
      since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday 16 Oct at 08:40 GMT' },
      removesAt: { at: '2026-11-15T08:40:00+00:00', written: 'Sunday 15 Nov at 08:40 GMT' },
      onlyOwner: false,
    },
    ownerClaim: null,
  };

  const opened = async (organisations: Membership[], paused: (typeof pausedA)[]) => {
    vi.spyOn(api, 'organisationsWithPaused').mockResolvedValue({ organisations, paused });
    await act(() => adoptAccount(account({})));
    const current = renderHook(() => useSessionState()).result.current;
    if (current.status !== 'signedIn') throw new Error('not signed in');

    return current.session;
  };

  afterEach(() => {
    localStorage.clear();
  });

  it('opens A’s paused page when A was opened by default, never chosen', async () => {
    await opened([a, b], []);
    expect(rememberedFor(localStorage.getItem(ORGANISATION), 'acc_1')).toBe('org_1');

    const next = await opened([b], [pausedA]);

    expect(next.pausedIn?.id).toBe('org_1');
    expect(rememberedFor(localStorage.getItem(ORGANISATION), 'acc_1')).toBe('org_1');
  });

  it('opens in A again once A restores the member', async () => {
    await opened([a, b], []);
    await opened([b], [pausedA]);

    const next = await opened([a, b], []);

    expect(next.organisation?.id).toBe('org_1');
    expect(next.pausedIn).toBeNull();
  });

  it('opens in B with no paused card on a browser that was in no organisation before', async () => {
    const next = await opened([b], [pausedA]);

    expect(next.organisation?.id).toBe('org_2');
    expect(next.pausedIn).toBeNull();
    expect(rememberedFor(localStorage.getItem(ORGANISATION), 'acc_1')).toBe('org_2');
  });

  it('opens in B with no paused card when B was the one chosen', async () => {
    localStorage.setItem(ORGANISATION, rememberedEntry('acc_1', 'org_2'));

    const next = await opened([b], [pausedA]);

    expect(next.organisation?.id).toBe('org_2');
    expect(next.pausedIn).toBeNull();
  });

  it('shows A’s paused page at a return to the tab, and moves nobody into B', async () => {
    await opened([a, b], []);
    localStorage.clear();
    const movedTo: string[] = [];
    const stop = onMovedOn((next) => movedTo.push(next.id));
    vi.spyOn(api, 'organisationsWithPaused').mockResolvedValue({
      organisations: [b],
      paused: [pausedA],
    });

    await act(() => rereadOrganisations());
    stop();

    const current = renderHook(() => useSessionState()).result.current;
    expect(current.status === 'signedIn' && current.session.pausedIn?.id).toBe('org_1');
    expect(movedTo).toEqual([]);
  });
});

describe('a browser shared by several accounts (sc-86373)', () => {
  const ORGANISATION = 'soirely.organisation';
  const alpha = membership({ id: 'org_a', name: 'Alpha' });
  const beta = membership({ id: 'org_b', name: 'Beta' });
  const pausedAlpha = {
    ...alpha,
    suspension: {
      reason: 'domain_closed' as const,
      domain: 'alpha.events',
      since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday 16 Oct at 08:40 GMT' },
      removesAt: { at: '2026-11-15T08:40:00+00:00', written: 'Sunday 15 Nov at 08:40 GMT' },
      onlyOwner: false,
    },
    ownerClaim: null,
  };

  const signsIn = async (
    id: string,
    organisations: Membership[],
    paused: (typeof pausedAlpha)[] = [],
  ) => {
    vi.spyOn(api, 'organisationsWithPaused').mockResolvedValue({ organisations, paused });
    await act(() => adoptAccount(account({ id })));
    const current = renderHook(() => useSessionState()).result.current;
    if (current.status !== 'signedIn') throw new Error('not signed in');

    return current.session;
  };

  const xChoosesAlpha = async () => {
    await signsIn('acc_x', [beta, alpha]);
    act(() => switchOrganisation('org_a'));
  };

  afterEach(() => {
    localStorage.clear();
  });

  it('opens Y in Beta, Y’s own, after X chose Alpha', async () => {
    await xChoosesAlpha();

    const y = await signsIn('acc_y', [beta, alpha]);

    expect(y.organisation?.id).toBe('org_b');
    expect(y.pausedIn).toBeNull();
  });

  it('opens Y in Beta with no paused card when Y’s access to Alpha is paused', async () => {
    await xChoosesAlpha();

    const y = await signsIn('acc_y', [beta], [pausedAlpha]);

    expect(y.organisation?.id).toBe('org_b');
    expect(y.pausedIn).toBeNull();
  });

  it('opens Y in Beta after Z opened Alpha by default', async () => {
    await signsIn('acc_z', [alpha]);

    expect((await signsIn('acc_y', [beta, alpha])).organisation?.id).toBe('org_b');
    await signsIn('acc_z', [alpha]);
    const y = await signsIn('acc_y', [beta], [pausedAlpha]);
    expect(y.organisation?.id).toBe('org_b');
    expect(y.pausedIn).toBeNull();
  });

  it('opens X in Beta again once Y has signed in between', async () => {
    await xChoosesAlpha();
    await signsIn('acc_y', [beta, alpha]);

    expect((await signsIn('acc_x', [beta, alpha])).organisation?.id).toBe('org_b');
  });

  it('lets X’s Alpha go even when Y signs in to a paused page alone', async () => {
    await xChoosesAlpha();
    expect((await signsIn('acc_y', [], [pausedAlpha])).pausedIn?.id).toBe('org_a');

    expect(localStorage.getItem(ORGANISATION)).toBeNull();
    expect((await signsIn('acc_x', [beta, alpha])).organisation?.id).toBe('org_b');
  });

  it('keeps X’s Alpha for X, and shows its paused page once X is paused there', async () => {
    await xChoosesAlpha();

    expect((await signsIn('acc_x', [beta, alpha])).organisation?.id).toBe('org_a');
    const paused = await signsIn('acc_x', [beta], [pausedAlpha]);
    expect(paused.pausedIn?.id).toBe('org_a');
    expect(rememberedFor(localStorage.getItem(ORGANISATION), 'acc_x')).toBe('org_a');
  });
});
