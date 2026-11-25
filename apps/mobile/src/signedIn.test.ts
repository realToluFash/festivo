import type { InvitationPreview } from '@soirely/api-client';
import { rememberedEntry } from '@soirely/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  me: vi.fn(),
  organisationsWithPaused: vi.fn(),
  signOut: vi.fn(),
  myInvitations: vi.fn(async (): Promise<InvitationPreview[]> => []),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
const shown = vi.hoisted(() => ({ language: 'en' }));

vi.mock('./api.ts', () => ({ api }));
const cards = vi.hoisted(() => ({ takeDown: vi.fn(async () => {}) }));

vi.mock('./appPush.ts', () => ({ registerAppPush: async () => {} }));
vi.mock('./runOfShowCards.ts', () => ({ takeDownRunOfShowCards: cards.takeDown }));
vi.mock('./i18n/index.ts', () => ({ currentLocale: () => shown.language }));
vi.mock('./tokens.ts', () => ({ tokens: { clear: vi.fn() } }));
vi.mock('expo-router', () => ({ router }));
const storage = vi.hoisted(() => ({
  getItem: vi.fn(async () => null),
  setItem: vi.fn(async () => {}),
  removeItem: vi.fn(async () => {}),
  getAllKeys: vi.fn(async (): Promise<string[]> => []),
  multiRemove: vi.fn(async () => {}),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
vi.mock('react', () => ({
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useEffect: (effect: () => void) => effect(),
  useMemo: (make: () => unknown) => make(),
}));

const {
  joinOrganisation,
  launchSignedIn,
  reloadSignedIn,
  replaceOrganisation,
  onMovedOn,
  rereadAccount,
  rereadOrganisations,
  resumesSession,
  signOutHere,
  switchOrganisation,
  useSignedIn,
} = await import('./signedIn.ts');
const { rememberEventsTab, rememberedEventsTab } = await import('@soirely/domain');
const { HOME_TAPPED } = await import('./kit/appNav.ts');
const { useInvitationAnswers, useWaitingInvitations } = await import('./invitations.ts');
const { waitingInvitations } = await import('@soirely/domain');
const { default: i18next } = await import('i18next');

const account = {
  id: 'usr_1',
  name: 'Adaeze',
  verified: true,
  emailAddresses: [],
  phoneNumbers: [],
};
const organisation = {
  id: 'org_1',
  name: 'Ìrè Events',
  countryCode: 'NG',
  contactAddress: 'hello@ire.events',
  locale: 'en',
  plan: 'free' as const,
  subscription: { status: 'active' as const, periodEnd: null },
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  role: { id: 'role_1', seededAs: 'owner', name: null },
  permissions: ['organisation.manage'],
  withheldUntilTwoFactor: [],
  readOnlyUntilLinked: false,
  withheldUntilLinked: [],
  onAnEvent: [],
  twoFactorDue: null,
  signInRules: {
    providerOnly: false,
    inactivityTimeoutDays: null,
    administratorsNeedTwoFactor: false,
    everyoneNeedsTwoFactor: false,
    changedAt: null,
  },
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('"Sign out" on the Settings list and the "This device" row', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });
    api.signOut.mockResolvedValue(undefined);
    await reloadSignedIn();
    vi.clearAllMocks();
  });

  it('asks for no confirmation and calls logout once', async () => {
    signOutHere();
    await settle();

    expect(api.signOut).toHaveBeenCalledTimes(1);
  });

  it('takes down every run-of-show card on this device (sc-66580)', async () => {
    signOutHere();
    await settle();

    expect(cards.takeDown).toHaveBeenCalledTimes(1);
  });

  it("leaves no door's list or waiting arrivals for the next person on this device (sc-1301)", async () => {
    storage.getAllKeys.mockResolvedValue([
      'door.list.evt_1',
      'door.waiting.evt_1',
      'soirely.organisation',
    ]);

    signOutHere();
    await settle();

    expect(storage.multiRemove).toHaveBeenCalledWith(['door.list.evt_1', 'door.waiting.evt_1']);
  });

  it('opens welcome with no "You were signed out" banner', async () => {
    signOutHere();
    await settle();

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/welcome');
  });

  it('forgets the account, and a frame still on screen does not ask for it again', async () => {
    expect(useSignedIn().account).toEqual(account);

    signOutHere();
    await settle();

    expect(useSignedIn()).toEqual({
      account: null,
      organisations: [],
      organisation: null,
      invitations: [],
      invitationOutcomes: {},
    });
    expect(api.me).not.toHaveBeenCalled();
  });
});

describe('opening the signed-in home at launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is ready once the account and its organisations are read', async () => {
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });

    await expect(launchSignedIn()).resolves.toBe(true);
    expect(useSignedIn().organisation).toEqual(organisation);
  });

  it("lands a door code's account, which may read no organisations, in none (sc-72)", async () => {
    const doorCode = { ...account, verified: false };
    api.me.mockResolvedValue(doorCode);
    api.organisationsWithPaused.mockRejectedValue(new Error('account_unverified'));

    await expect(launchSignedIn()).resolves.toBe(true);
    expect(useSignedIn()).toMatchObject({ account: doorCode, organisation: null });
    expect(router.replace).not.toHaveBeenCalled();

    api.organisationsWithPaused.mockClear();
    await rereadOrganisations();
    expect(api.organisationsWithPaused).not.toHaveBeenCalled();
  });

  it('opens welcome when an account with an address cannot read its organisations', async () => {
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockRejectedValue(new Error('down'));

    await expect(launchSignedIn()).resolves.toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/welcome');
  });

  it('resumes the session when Home is tapped from the frame while signed in (sc-28178)', async () => {
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });

    await launchSignedIn();

    expect(resumesSession(HOME_TAPPED.params.tapped)).toBe(true);
  });

  it('launches when the launch screen is opened without a Home tap (sc-28178)', async () => {
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });

    await launchSignedIn();

    expect(resumesSession(undefined)).toBe(false);
  });

  it('launches when Home is tapped after signing out (sc-28178)', async () => {
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });
    api.signOut.mockResolvedValue(undefined);

    await launchSignedIn();
    signOutHere();
    await settle();

    expect(resumesSession(HOME_TAPPED.params.tapped)).toBe(false);
  });

  it('shows the organisation access is paused in when there is nothing else to open', async () => {
    const paused = {
      ...organisation,
      suspension: {
        reason: 'address_gone' as const,
        domain: 'ire.events',
        since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday, Oct 16 at 09:40 WAT' },
        removesAt: { at: '2026-11-15T08:40:00+00:00', written: 'Sunday, Nov 15 at 09:40 WAT' },
        onlyOwner: false,
      },
      ownerClaim: null,
    };
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [], paused: [paused] });

    await expect(launchSignedIn()).resolves.toBe(true);
    expect(useSignedIn().pausedIn).toEqual(paused);
  });

  it('is not, and opens welcome, when the account cannot be read', async () => {
    api.me.mockRejectedValue(new Error('unauthorised'));
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });

    await expect(launchSignedIn()).resolves.toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/welcome');
  });
});

describe('an organisation saved from its page', () => {
  const other = { ...organisation, id: 'org_2', name: 'Okafor Weddings' };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [organisation, other],
      paused: [],
    });
    await reloadSignedIn();
  });

  it('shows its new name in the switcher and on the list at once, with no second load', () => {
    replaceOrganisation({ ...organisation, name: 'Ìrè Events Ltd' });

    expect(useSignedIn().organisation?.name).toBe('Ìrè Events Ltd');
    expect(useSignedIn().organisations.map(({ name }) => name)).toEqual([
      'Ìrè Events Ltd',
      'Okafor Weddings',
    ]);
    expect(api.organisationsWithPaused).toHaveBeenCalledTimes(1);
  });

  it('leaves the organisation this device is in alone when another one changes', () => {
    replaceOrganisation({ ...other, name: 'Okafor & Co' });

    expect(useSignedIn().organisation?.id).toBe('org_1');
  });
});

describe('Switch organisation (sc-3594)', () => {
  const other = { ...organisation, id: 'org_2', name: 'Okafor Weddings' };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [organisation, other],
      paused: [],
    });
    await reloadSignedIn();
  });

  it('opens Events on Upcoming in the organisation switched back to', () => {
    rememberEventsTab('org_1', 'past');

    switchOrganisation('org_2');
    switchOrganisation('org_1');

    expect(rememberedEventsTab('org_1')).toBe('upcoming');
  });
});

describe('the account read again without leaving the screen', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });
    await reloadSignedIn();
    vi.clearAllMocks();
  });

  it('replaces the account and keeps the organisation, with no second organisations read', async () => {
    api.me.mockResolvedValue({ ...account, name: 'Adaeze Okafor' });

    await rereadAccount();

    expect(useSignedIn().account).toEqual({ ...account, name: 'Adaeze Okafor' });
    expect(useSignedIn().organisation).toEqual(organisation);
    expect(api.organisationsWithPaused).not.toHaveBeenCalled();
  });

  it('rejects when the read fails, keeps the account it had, and opens nothing', async () => {
    api.me.mockRejectedValue(new Error('offline'));

    await expect(rereadAccount()).rejects.toThrow('offline');
    expect(useSignedIn().account).toEqual(account);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('an invitation answered on one screen', () => {
  const invitation: InvitationPreview = {
    id: 'inv_1',
    organisation: { id: 'org_2', name: 'Okafor Weddings' },
    email: 'adaeze@ire.events',
    role: { id: 'role_2', seededAs: 'coordinator', name: null },
    invitedBy: { name: 'Chidi' },
    expiresAt: '2026-10-26T09:00:00Z',
    refusal: null,
    forYou: true,
    signedInAs: null,
    managed: null,
  };
  const joined = { ...organisation, id: 'org_2', name: 'Okafor Weddings' };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });
    api.myInvitations.mockResolvedValue([invitation]);
    await reloadSignedIn();
  });

  it('is read once with the account, not once per screen', () => {
    useWaitingInvitations();
    useWaitingInvitations();

    expect(api.myInvitations).toHaveBeenCalledTimes(1);
    expect(useWaitingInvitations().invitations).toEqual([invitation]);
  });

  it('shows as declined on the screen underneath too', async () => {
    api.declineInvitation.mockResolvedValue(undefined);
    const settings = useWaitingInvitations();

    await settings.answer(invitation, 'decline');

    expect(useWaitingInvitations().outcomes).toEqual({ inv_1: { kind: 'declined' } });
  });

  it('shows as accepted on the screen underneath too, with the organisation joined', async () => {
    api.acceptInvitation.mockResolvedValue(joined);
    const settings = useWaitingInvitations();

    await settings.answer(invitation, 'accept');

    expect(useWaitingInvitations().outcomes).toEqual({
      inv_1: { kind: 'accepted', organisationId: 'org_2' },
    });
    expect(useSignedIn().organisations.map(({ id }) => id)).toEqual(['org_1', 'org_2']);
  });

  describe('listed as one a managed account cannot accept (sc-73668)', () => {
    const message =
      'Your ire.events address is managed by Ìrè Events, so you can only be a member there.';
    const managed = {
      ...invitation,
      id: 'inv_9',
      managed: { domain: 'ire.events', organisation: { id: 'org_1', name: 'Ìrè Events' }, message },
    };

    beforeEach(async () => {
      api.myInvitations.mockResolvedValue([managed]);
      await reloadSignedIn();
    });

    it('reads as managed for the switcher and its openers before anything is pressed, and is not counted', () => {
      const waiting = useWaitingInvitations();

      expect(waiting.outcomes.inv_9).toEqual({
        kind: 'managed',
        organisation: 'Ìrè Events',
        message,
      });
      expect(waitingInvitations(waiting.invitations, waiting.outcomes)).toBe(0);
    });

    it('keeps its answers on You are not in an organisation until a press is refused, as sc-563 has it', () => {
      const answers = useInvitationAnswers();

      expect(answers.outcomes.inv_9).toBeUndefined();
      expect(waitingInvitations(answers.invitations, answers.outcomes)).toBe(1);
    });
  });
});

describe('the organisations after a language change (sc-9267)', () => {
  const due = (written: string) => ({ at: '2026-10-31T10:44:00+00:00', written, overdue: false });
  const pausedWith = (written: string) => ({
    ...organisation,
    id: 'org_2',
    suspension: {
      reason: 'address_gone' as const,
      domain: 'ire.events',
      since: { at: '2026-10-16T08:40:00+00:00', written },
      removesAt: { at: '2026-11-15T08:40:00+00:00', written },
      onlyOwner: false,
    },
    ownerClaim: null,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [{ ...organisation, twoFactorDue: due('Saturday 31 Oct at 10:44 GMT') }],
      paused: [],
    });
    await reloadSignedIn();
  });

  it('reads them again, and the organisation shown carries the date in the new language', async () => {
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [{ ...organisation, twoFactorDue: due('sábado 31 oct a las 10:44 GMT') }],
      paused: [],
    });

    i18next.emit('languageChanged', 'es');
    await settle();

    expect(useSignedIn().organisation?.twoFactorDue?.written).toBe('sábado 31 oct a las 10:44 GMT');
  });

  it('leaves them as they were when the read fails', async () => {
    api.organisationsWithPaused.mockRejectedValue(new Error('offline'));

    i18next.emit('languageChanged', 'es');
    await settle();

    expect(useSignedIn().organisation?.twoFactorDue?.written).toBe('Saturday 31 Oct at 10:44 GMT');
  });

  it('keeps an organisation joined while the read was on its way', async () => {
    let answer: (read: unknown) => void = () => {};
    api.organisationsWithPaused.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    i18next.emit('languageChanged', 'es');
    joinOrganisation({ ...organisation, id: 'org_2', name: 'Ọ̀ṣun Parties' });
    answer({
      organisations: [{ ...organisation, twoFactorDue: due('sábado 31 oct a las 10:44 GMT') }],
      paused: [],
    });
    await settle();

    expect(useSignedIn().organisations.map(({ id }) => id)).toEqual(['org_1', 'org_2']);
  });

  it('reads them again when the account’s language was followed while the launch read them', async () => {
    let answer: (read: unknown) => void = () => {};
    api.organisationsWithPaused.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const launched = launchSignedIn();

    shown.language = 'es';
    i18next.emit('languageChanged', 'es');
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [{ ...organisation, twoFactorDue: due('sábado 31 oct a las 10:44 GMT') }],
      paused: [],
    });
    answer({
      organisations: [{ ...organisation, twoFactorDue: due('Saturday 31 Oct at 10:44 GMT') }],
      paused: [],
    });
    await launched;
    await settle();
    shown.language = 'en';

    expect(useSignedIn().organisation?.twoFactorDue?.written).toBe('sábado 31 oct a las 10:44 GMT');
  });

  it('carries the paused organisation’s dates in the new language', async () => {
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [],
      paused: [pausedWith('Friday 16 Oct at 08:40 GMT')],
    });
    await reloadSignedIn();
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [],
      paused: [pausedWith('viernes 16 oct a las 08:40 GMT')],
    });

    i18next.emit('languageChanged', 'es');
    await settle();

    expect(useSignedIn().pausedIn?.suspension.since.written).toBe('viernes 16 oct a las 08:40 GMT');
  });
});

describe('the organisation being worked in, ended while the app is open (sc-28178)', () => {
  const other = { ...organisation, id: 'org_2', name: 'Ọ̀ṣun Parties' };
  const paused = {
    ...organisation,
    suspension: {
      reason: 'address_gone' as const,
      domain: 'ire.events',
      since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday 16 Oct at 08:40 GMT' },
      removesAt: { at: '2026-11-15T08:40:00+00:00', written: 'Sunday 15 Nov at 08:40 GMT' },
      onlyOwner: false,
    },
    ownerClaim: null,
  };
  const movedTo: string[] = [];
  onMovedOn((next) => movedTo.push(next.id));

  const workingIn = async (organisations: (typeof organisation)[]) => {
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations, paused: [] });
    await reloadSignedIn();
    vi.clearAllMocks();
    movedTo.length = 0;
  };

  beforeEach(() => workingIn([organisation, other]));

  it('shows Access paused for it at the next move, though the member belongs to another', async () => {
    api.organisationsWithPaused.mockResolvedValue({ organisations: [other], paused: [paused] });

    await rereadOrganisations();

    expect(useSignedIn().pausedIn?.id).toBe('org_1');
    expect(movedTo).toEqual([]);
  });

  it('moves on into the first organisation left, and tells the frame, when it is gone', async () => {
    api.organisationsWithPaused.mockResolvedValue({ organisations: [other], paused: [] });

    await rereadOrganisations();

    expect(useSignedIn().organisation?.id).toBe('org_2');
    expect(useSignedIn().organisations.map(({ id }) => id)).toEqual(['org_2']);
    expect(useSignedIn().pausedIn).toBeNull();
    expect(movedTo).toEqual(['org_2']);
  });

  it('opens in no organisation when it was the only one', async () => {
    await workingIn([organisation]);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [], paused: [] });

    await rereadOrganisations();

    expect(useSignedIn().organisation).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(movedTo).toEqual([]);
  });

  it('stays where it was when the read fails', async () => {
    api.organisationsWithPaused.mockRejectedValue(new Error('offline'));

    await rereadOrganisations();

    expect(useSignedIn().organisation?.id).toBe('org_1');
    expect(useSignedIn().pausedIn).toBeNull();
  });

  it('moves nothing when access is unchanged', async () => {
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [organisation, other],
      paused: [],
    });

    await rereadOrganisations();

    expect(useSignedIn().organisation?.id).toBe('org_1');
    expect(movedTo).toEqual([]);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('the organisation this phone was last in, paused there (sc-86056)', () => {
  const other = { ...organisation, id: 'org_2', name: 'Ọ̀ṣun Parties' };
  const paused = {
    ...organisation,
    suspension: {
      reason: 'address_gone' as const,
      domain: 'ire.events',
      since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday 16 Oct at 08:40 GMT' },
      removesAt: { at: '2026-11-15T08:40:00+00:00', written: 'Sunday 15 Nov at 08:40 GMT' },
      onlyOwner: false,
    },
    ownerClaim: null,
  };

  const launched = async (
    remembered: string | null,
    organisations: (typeof organisation)[],
    pausedIn: (typeof paused)[],
  ) => {
    vi.clearAllMocks();
    storage.getItem.mockResolvedValue(remembered as never);
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations, paused: pausedIn });
    await reloadSignedIn();
  };

  it('remembers the organisation it opened by default', async () => {
    await launched(null, [organisation, other], []);

    expect(useSignedIn().organisation?.id).toBe('org_1');
    expect(storage.setItem).toHaveBeenCalledWith(
      'soirely.organisation',
      rememberedEntry('usr_1', 'org_1'),
    );
  });

  it('opens its paused page at the next launch, and keeps it remembered', async () => {
    await launched(rememberedEntry('usr_1', 'org_1'), [other], [paused]);

    expect(useSignedIn().pausedIn?.id).toBe('org_1');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('opens in the other with no paused card on a phone that was in no organisation', async () => {
    await launched(null, [other], [paused]);

    expect(useSignedIn().organisation?.id).toBe('org_2');
    expect(useSignedIn().pausedIn).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith(
      'soirely.organisation',
      rememberedEntry('usr_1', 'org_2'),
    );
  });

  it('keeps the paused one remembered when it pauses while the app is open', async () => {
    await launched(null, [organisation, other], []);
    vi.clearAllMocks();
    api.organisationsWithPaused.mockResolvedValue({ organisations: [other], paused: [paused] });

    await rereadOrganisations();

    expect(useSignedIn().pausedIn?.id).toBe('org_1');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('a phone shared by several accounts (sc-86373)', () => {
  const alpha = { ...organisation, id: 'org_a', name: 'Alpha' };
  const beta = { ...organisation, id: 'org_b', name: 'Beta' };
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
  let kept: string | null = null;

  beforeEach(() => {
    kept = null;
    storage.getItem.mockImplementation(async () => kept as never);
    storage.setItem.mockImplementation(async (...args: unknown[]) => {
      kept = String(args[1]);
    });
    storage.removeItem.mockImplementation(async () => {
      kept = null;
    });
  });

  afterEach(() => {
    storage.getItem.mockImplementation(async () => null);
    storage.setItem.mockImplementation(async () => {});
    storage.removeItem.mockImplementation(async () => {});
  });

  const signsIn = async (
    id: string,
    organisations: (typeof organisation)[],
    paused: (typeof pausedAlpha)[] = [],
  ) => {
    api.me.mockResolvedValue({ ...account, id });
    api.organisationsWithPaused.mockResolvedValue({ organisations, paused });
    await reloadSignedIn();
    await settle();
  };

  const xChoosesAlpha = async () => {
    await signsIn('usr_x', [beta, alpha]);
    switchOrganisation('org_a');
    await settle();
  };

  it('opens Y in Beta, Y’s own, after X chose Alpha', async () => {
    await xChoosesAlpha();

    await signsIn('usr_y', [beta, alpha]);
    const y = useSignedIn();

    expect(y.organisation?.id).toBe('org_b');
    expect(y.pausedIn).toBeNull();
  });

  it('opens Y in Beta with no paused card when Y’s access to Alpha is paused', async () => {
    await xChoosesAlpha();

    await signsIn('usr_y', [beta], [pausedAlpha]);
    const y = useSignedIn();

    expect(y.organisation?.id).toBe('org_b');
    expect(y.pausedIn).toBeNull();
  });

  it('opens Y in Beta after Z opened Alpha by default', async () => {
    await signsIn('usr_z', [alpha]);

    await signsIn('usr_y', [beta, alpha]);
    expect(useSignedIn().organisation?.id).toBe('org_b');
    await signsIn('usr_z', [alpha]);
    await signsIn('usr_y', [beta], [pausedAlpha]);
    const y = useSignedIn();
    expect(y.organisation?.id).toBe('org_b');
    expect(y.pausedIn).toBeNull();
  });

  it('opens X in Beta again once Y has signed in between', async () => {
    await xChoosesAlpha();
    await signsIn('usr_y', [beta, alpha]);

    await signsIn('usr_x', [beta, alpha]);
    expect(useSignedIn().organisation?.id).toBe('org_b');
  });

  it('lets X’s Alpha go even when Y signs in to a paused page alone', async () => {
    await xChoosesAlpha();
    await signsIn('usr_y', [], [pausedAlpha]);
    expect(useSignedIn().pausedIn?.id).toBe('org_a');

    await signsIn('usr_x', [beta, alpha]);
    expect(useSignedIn().organisation?.id).toBe('org_b');
  });

  it('keeps X’s Alpha for X, and shows its paused page once X is paused there', async () => {
    await xChoosesAlpha();

    await signsIn('usr_x', [beta, alpha]);
    expect(useSignedIn().organisation?.id).toBe('org_a');
    await signsIn('usr_x', [beta], [pausedAlpha]);
    const paused = useSignedIn();
    expect(paused.pausedIn?.id).toBe('org_a');
  });
});
