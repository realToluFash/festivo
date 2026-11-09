import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import type { LinkedProvider, Membership } from '@soirely/api-client';
import { setLanguage } from '../../../i18n/index.ts';
import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const OWNER = { id: 'role_1', seededAs: 'owner', name: null };
const ADMIN = { id: 'role_2', seededAs: 'administrator', name: null };
const MEMBER = { id: 'role_4', seededAs: 'member', name: null };
const READER = { role: MEMBER, permissions: ['events.read', 'events.manage'] };

const PAGE = {
  providerOnly: false,
  inactivityTimeoutDays: 30,
  administratorsNeedTwoFactor: true,
  everyoneNeedsTwoFactor: false,
  changedAt: '2026-10-28T15:12:00+00:00',
  inactivityChoices: [7, 30],
  changes: [
    {
      entry: 'entry_2',
      at: '2026-10-28T15:12:00+00:00',
      by: { name: 'Folake Adeyemi', role: OWNER },
      rule: 'administratorsNeedTwoFactor',
      now: true,
      was: false,
    },
    {
      entry: 'entry_1',
      at: '2026-09-01T10:05:00+00:00',
      by: { name: 'Folake Adeyemi', role: OWNER },
      rule: 'inactivityTimeoutDays',
      now: 30,
      was: null,
    },
  ],
  passwordOnly: [
    { userId: 'user_2', name: 'Priya Shah', role: ADMIN },
    { userId: 'user_3', name: 'Ana Souza', role: MEMBER },
  ],
  withoutTwoFactor: [],
  twoFactorDeadline: { at: '2026-11-11T10:00:00+00:00', written: 'unused' },
  inactivityLimit: { organisationId: 'org_1', organisation: 'Ìrè Events', days: 30 },
  ownTwoFactor: true,
  ownProvider: true,
};

const GOOGLE: LinkedProvider = { provider: 'google', email: 'folake@gmail.com' };

function signedIn(organisation: Membership, providers: LinkedProvider[] = [GOOGLE]): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers,
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    organisation,
    organisations: [organisation],
    organisationCountry: null,
    timezone: 'Africa/Lagos',
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

type Answer = (body: unknown) => Response | Promise<Response>;

function answering(page: unknown = PAGE, saved: unknown | Answer = page) {
  const sent: { method: string; path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ method, path: new URL(String(input)).pathname, body });

    if (method === 'PATCH' && typeof saved === 'function') return (saved as Answer)(body);

    return new Response(JSON.stringify(method === 'PATCH' ? saved : page), { status: 200 });
  });

  return sent;
}

function problem(code: string): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: 'No.', status: 403 }),
    { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function open(path = '/app/settings/sign-in-rules') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

const patches = (sent: { method: string; body: unknown }[]) =>
  sent.filter(({ method }) => method === 'PATCH').map(({ body }) => body);

async function row(name: RegExp): Promise<HTMLElement> {
  return screen.findByRole('button', { name });
}

function dialog(): ReturnType<typeof within> {
  return within(screen.getByRole('dialog'));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('Sign-in rules at a desk, summary first (sc-30192)', () => {
  it('an owner meets every rule: the card, then where they stand in order, then what changed', async () => {
    signedIn(membership());
    answering();
    open();

    expect(await screen.findByText('You meet Ìrè Events’s rules')).toBeDefined();
    expect(screen.getByText('As an owner, you can change them below.')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign-in rules' })).toBeDefined();
    const page = screen
      .getByRole('heading', { level: 1, name: 'Sign-in rules' })
      .closest('.desk-column');
    const headings = within(page as HTMLElement)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Where you stand', 'What changed']);
    const rows = within(screen.getByText('Where you stand').closest('section')!)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(rows).toEqual([
      'Met. Sign in any wayPassword, Google and Apple all work.Change',
      'Met. Signed out after 30 days unusedAfter 30 days without Soirely, you sign in again.Change',
      'Met. Two-factor for managersYours is on.Change',
    ]);
    expect(screen.getByText('Managers are owners and admins.')).toBeDefined();
    expect(screen.queryByText(/Rules saved/)).toBeNull();
    expect(screen.queryByText('What they will see')).toBeNull();
  });

  it('an admin is told they can change them', async () => {
    signedIn(membership({ role: ADMIN }));
    answering();
    open();

    expect(await screen.findByText('As an admin, you can change them below.')).toBeDefined();
  });

  it('a member reads, with no Change, and is pointed at owners and admins', async () => {
    signedIn(membership(READER));
    answering({ ...PAGE, passwordOnly: null, withoutTwoFactor: null });
    open();

    expect(
      await screen.findByText('Set by its owners and admins. Only they can change them.'),
    ).toBeDefined();
    expect(screen.getByText('Doesn’t apply to your role, Member.')).toBeDefined();
    expect(screen.queryByText('Change')).toBeNull();
    expect(screen.getByText('Questions? Ask an owner or admin of Ìrè Events.')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign-in rules' })).toBeDefined();
  });

  it('an admin held by two-factor reads, with the card’s step to Security', async () => {
    signedIn(
      membership({
        role: ADMIN,
        permissions: ['events.read'],
        withheldUntilTwoFactor: ['organisation.manage', 'members.manage'],
      }),
    );
    answering({ ...PAGE, ownTwoFactor: false });
    const router = open();

    expect(await screen.findByText('1 rule needs you')).toBeDefined();
    expect(
      screen.getByText(
        'Until it’s on, changes to members or security wait. Your events keep working.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText('Not on yet. Changes to members and security wait until it is.'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Until you turn on two-factor, you can see these rules but not change them.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('Change')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Turn on two-factor' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/account/security'));
  });

  it('under Google or Apple only, a member with none linked gets the step, and the hold says why', async () => {
    signedIn(
      membership({ ...READER, readOnlyUntilLinked: true, withheldUntilLinked: ['events.manage'] }),
      [],
    );
    answering({ ...PAGE, providerOnly: true, ownProvider: false, ownTwoFactor: false });
    open();

    expect(await screen.findByText('1 rule needs you')).toBeDefined();
    expect(
      screen.getByText('Until you link one, you can read but not change anything in Ìrè Events.'),
    ).toBeDefined();
    expect(
      screen.getByText('Your password still signs you in. Link one to change things again.'),
    ).toBeDefined();
    expect(
      within(screen.getByText('1 rule needs you').closest('section')!).getByRole('button', {
        name: 'Link Google or Apple',
      }),
    ).toBeDefined();
  });

  it('names what the viewer has linked, from their account', async () => {
    signedIn(membership(), [GOOGLE, { provider: 'apple', email: null }]);
    answering({ ...PAGE, providerOnly: true });
    open();

    expect(await screen.findByText('You have Google and Apple linked.')).toBeDefined();
  });

  it('says a shorter limit from another organisation on the limit row, with no notice', async () => {
    signedIn(membership());
    answering({
      ...PAGE,
      inactivityLimit: { organisationId: 'org_2', organisation: 'Lumen Studio', days: 7 },
    });
    open();

    expect(
      await screen.findByText('For you, 7 days: Lumen Studio’s rule is shorter.'),
    ).toBeDefined();
    expect(screen.queryByText(/For you, sign-ins end after/)).toBeNull();
  });

  it('under two-factor for everyone, gives the deadline with its weekday, and counts who is still without it', async () => {
    signedIn(membership());
    answering({
      ...PAGE,
      everyoneNeedsTwoFactor: true,
      ownTwoFactor: false,
      withoutTwoFactor: [
        { userId: 'user_2', name: 'Priya Shah', role: ADMIN },
        { userId: 'user_3', name: 'Ana Souza', role: MEMBER },
      ],
    });
    open();

    expect(await screen.findByText(/^Not on yet\. Turn it on by Wednesday, /)).toBeDefined();
    expect(
      screen.getByText(
        '2 people don’t have two-factor yet. Each sees a banner until their deadline, then can’t open anything in Ìrè Events until they turn it on.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('Managers are owners and admins.')).toBeNull();
  });

  it('tags a change after the last one this browser saw as New, and opening the page counts as seeing it', async () => {
    window.localStorage.setItem('soirely.signInRulesSeen.org_1', '2026-09-01T10:05:00+00:00');
    const organisation = membership({
      signInRules: { ...membership().signInRules, changedAt: PAGE.changedAt },
    });
    signedIn(organisation);
    answering();
    open();

    const changes = within((await screen.findByText('What changed')).closest('section')!);
    const rows = changes.getAllByRole('listitem').map((item) => item.textContent);
    expect(rows[0]).toMatch(/^Two-factor for managers: onNew.* · was off · Folake Adeyemi$/);
    expect(rows[1]).toMatch(/^Signed out after: 30 days unused.* · was no limit · Folake Adeyemi$/);
    expect(window.localStorage.getItem('soirely.signInRulesSeen.org_1')).toBe(PAGE.changedAt);
  });

  it('every change is New on a browser that has seen none', async () => {
    signedIn(membership({ id: 'org_unseen' }));
    answering();
    open();

    expect(await screen.findAllByText('New')).toHaveLength(2);
  });

  it('with no changes yet, says so', async () => {
    signedIn(membership());
    answering({ ...PAGE, changes: [], changedAt: null });
    open();

    expect(await screen.findByText('No changes yet')).toBeDefined();
    expect(screen.getByText('These are the rules every organisation starts with.')).toBeDefined();
  });
});

describe('changing a rule (sc-30192)', () => {
  it('opens the rule in force, tagged Now, and offers no Save until the pick changes', async () => {
    signedIn(membership());
    answering();
    open();

    fireEvent.click(await row(/Signed out after 30 days unused/));

    expect(
      dialog().getByRole('heading', { name: 'How long a sign-in lasts unused' }),
    ).toBeDefined();
    expect((dialog().getByRole('radio', { name: /30 days/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(dialog().getByRole('radio', { name: /30 days\s*Now/ })).toBeDefined();
    expect(dialog().getByRole('radio', { name: /No limit/ })).toBeDefined();
    expect(dialog().getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(dialog().getByText('Nothing changes. These are the rules in force.')).toBeDefined();
  });

  it('sends only the rule the edit changes, then the row and what changed say it, and focus is back on the row', async () => {
    signedIn(membership());
    const savedChange = {
      entry: 'entry_3',
      at: '2026-11-09T09:00:00+00:00',
      by: { name: 'Folake Adeyemi', role: OWNER },
      rule: 'inactivityTimeoutDays',
      now: 7,
      was: 30,
    };
    const sent = answering(PAGE, {
      ...PAGE,
      inactivityTimeoutDays: 7,
      changedAt: savedChange.at,
      changes: [savedChange, ...PAGE.changes],
    });
    open();

    const limit = await row(/Signed out after 30 days unused/);
    fireEvent.click(limit);
    fireEvent.click(dialog().getByRole('radio', { name: /^7 days/ }));
    expect(
      dialog().getByText(
        'Anyone who has not used Soirely for 7 days is asked to sign in again, from their next visit.',
      ),
    ).toBeDefined();
    expect(
      dialog().getByText('Everyone affected gets an email saying what changed and why.'),
    ).toBeDefined();
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patches(sent)).toEqual([{ inactivityTimeoutDays: 7 }]);
    const again = await row(/Signed out after 7 days unused/);
    await waitFor(() => expect(document.activeElement).toBe(again));
    const changes = within(screen.getByText('What changed').closest('section')!);
    expect(changes.getAllByRole('listitem')[0]?.textContent).toMatch(
      /^Signed out after: 7 days unused.* · was 30 days · Folake Adeyemi$/,
    );
    expect(screen.queryByText(/Rules saved/)).toBeNull();
  });

  it('while Save is out, it reads Saving… and is off, and Cancel and Escape do nothing', async () => {
    signedIn(membership());
    let answer: (response: Response) => void = () => {};
    const sent = answering(
      PAGE,
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    open();

    fireEvent.click(await row(/Signed out after 30 days unused/));
    fireEvent.click(dialog().getByRole('radio', { name: /^7 days/ }));
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }));

    const saving = await screen.findByRole('button', { name: 'Saving…' });
    expect(saving.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(saving);
    fireEvent.click(dialog().getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.queryByText('Discard your change?')).toBeNull();
    expect(patches(sent)).toHaveLength(1);

    await act(async () =>
      answer(new Response(JSON.stringify({ ...PAGE, inactivityTimeoutDays: 7 }), { status: 200 })),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a failed save keeps the dialog and the pick, says so as an alert, and Save tries again', async () => {
    signedIn(membership());
    let fails = true;
    const sent = answering(PAGE, () =>
      fails
        ? new Response(null, { status: 500 })
        : new Response(JSON.stringify({ ...PAGE, inactivityTimeoutDays: 7 }), { status: 200 }),
    );
    open();

    fireEvent.click(await row(/Signed out after 30 days unused/));
    fireEvent.click(dialog().getByRole('radio', { name: /^7 days/ }));
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'The rules were not saved. Nothing changed. Try again in a moment.',
    );
    expect(dialog().queryByText('What happens when you save')).toBeNull();
    expect((dialog().getByRole('radio', { name: /^7 days/ }) as HTMLInputElement).checked).toBe(
      true,
    );

    fails = false;
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patches(sent)).toHaveLength(2);
  });

  it('Cancel after a change asks before discarding, Keep editing first, and Discard closes with nothing sent', async () => {
    signedIn(membership());
    const sent = answering();
    open();

    const limit = await row(/Signed out after 30 days unused/);
    fireEvent.click(limit);
    fireEvent.click(dialog().getByRole('radio', { name: /^7 days/ }));
    fireEvent.click(dialog().getByRole('button', { name: 'Cancel' }));

    const ask = within(screen.getByRole('alertdialog'));
    expect(ask.getByText('Discard your change?')).toBeDefined();
    expect(ask.getByText('Signed out after 30 days unused stays the rule.')).toBeDefined();
    expect(ask.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Keep editing',
      'Discard',
    ]);
    fireEvent.click(ask.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(limit));
    expect(patches(sent)).toEqual([]);
  });

  it('picking Google or Apple only names who has a password only, before saving', async () => {
    signedIn(membership());
    answering();
    open();

    fireEvent.click(await row(/Sign in any way/));
    fireEvent.click(dialog().getByRole('radio', { name: /Google or Apple only/ }));

    expect(
      dialog().getByText(
        'Priya Shah and Ana Souza can read but not change anything until they link Google or Apple. Their password still signs them in.',
      ),
    ).toBeDefined();
  });

  it('picking For everyone names who has no two-factor, after its line', async () => {
    signedIn(membership());
    answering({
      ...PAGE,
      withoutTwoFactor: [{ userId: 'user_3', name: 'Ana Souza', role: MEMBER }],
    });
    open();

    fireEvent.click(await row(/Two-factor for managers/));
    fireEvent.click(dialog().getByRole('radio', { name: /For everyone/ }));

    const lines = dialog()
      .getAllByText(/./, { selector: 'p.desk-line' })
      .map((line: HTMLElement) => line.textContent);
    expect(lines).toEqual([
      'Everyone needs two-factor. Anyone without it is emailed and has 7 days to turn it on.',
      'Ana Souza doesn’t have it yet.',
    ]);
  });

  it('a pick the viewer does not meet is refused in place of what happens, with its step, and Save stays off', async () => {
    signedIn(membership(), []);
    const sent = answering({ ...PAGE, administratorsNeedTwoFactor: false, ownTwoFactor: false });
    open();

    fireEvent.click(await row(/Two-factor not required/));
    fireEvent.click(dialog().getByRole('radio', { name: /For managers/ }));

    const refusal = within(screen.getByRole('alert'));
    expect(refusal.getByText('Turn on two-factor for yourself first')).toBeDefined();
    expect(refusal.getByText('Then you can require it here.')).toBeDefined();
    expect(refusal.getByRole('button', { name: 'Turn on two-factor' })).toBeDefined();
    expect(dialog().queryByText('What happens when you save')).toBeNull();
    expect(dialog().getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }));
    expect(patches(sent)).toEqual([]);
  });

  it('refused by the server because the viewer’s own two-factor went, shows that pick’s refusal', async () => {
    signedIn(membership());
    answering({ ...PAGE, administratorsNeedTwoFactor: false }, () => problem('two_factor_off'));
    open();

    fireEvent.click(await row(/Two-factor not required/));
    fireEvent.click(dialog().getByRole('radio', { name: /For managers/ }));
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Turn on two-factor for yourself first')).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(dialog().getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('refused by the server because Google or Apple went, shows that pick’s refusal', async () => {
    signedIn(membership());
    answering(PAGE, () => problem('oauth_only_unlinked'));
    open();

    fireEvent.click(await row(/Sign in any way/));
    fireEvent.click(dialog().getByRole('radio', { name: /Google or Apple only/ }));
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Link Google or Apple for yourself first')).toBeDefined();
  });

  it('refused because Google or Apple went, on a change with no refusal of its own, says it was not saved', async () => {
    signedIn(membership());
    answering({ ...PAGE, providerOnly: true }, () => problem('oauth_only_unlinked'));
    open();

    fireEvent.click(await row(/Signed out after 30 days unused/));
    fireEvent.click(dialog().getByRole('radio', { name: /^7 days/ }));
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'The rules were not saved. Nothing changed. Try again in a moment.',
    );
    expect(dialog().queryByText('What happens when you save')).toBeNull();
    expect(dialog().getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).not.toBe(
      'true',
    );
  });

  it('two changes saved in the same second both show, each once, with no duplicate-key warning (sc-13954)', async () => {
    const errors = vi.spyOn(console, 'error');
    const by = { name: 'Folake Adeyemi', role: OWNER };
    signedIn(membership(READER));
    answering({
      ...PAGE,
      changes: [
        {
          entry: 'e2',
          at: '2026-10-26T14:27:46+00:00',
          by,
          rule: 'inactivityTimeoutDays',
          now: null,
          was: 7,
        },
        {
          entry: 'e1',
          at: '2026-10-26T14:27:46+00:00',
          by,
          rule: 'inactivityTimeoutDays',
          now: 7,
          was: 30,
        },
      ],
    });
    open();

    const changes = within((await screen.findByText('What changed')).closest('section')!);
    expect(changes.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^Signed out after: no limit/),
      expect.stringMatching(/^Signed out after: 7 days unused/),
    ]);
    expect(errors.mock.calls.flat().join(' ')).not.toContain('same key');
  });
});

describe('in another language', () => {
  afterEach(async () => {
    await act(() => setLanguage(null));
  });

  it('reads the page in Spanish', async () => {
    await act(() => setLanguage('es'));
    signedIn(membership());
    answering();
    open();

    expect(await screen.findByText('Cumple las normas de Ìrè Events')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Su situación' })).toBeDefined();
  });
});

describe('loading and failing to load', () => {
  it('says it is loading, in the demo’s words', async () => {
    signedIn(membership());
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
    open();

    expect(await screen.findByRole('status', { name: 'Loading the sign-in rules…' })).toBeDefined();
  });

  function failingTwice(): void {
    let reads = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (!new URL(String(input)).pathname.endsWith('/sign-in-rules')) {
        throw new TypeError('Failed to fetch');
      }
      reads += 1;
      if (reads < 3) throw new TypeError('Failed to fetch');

      return new Response(JSON.stringify(PAGE), { status: 200 });
    });
  }

  it('Try again that loads puts focus on the title, and one that fails again on what failed (sc-11369)', async () => {
    signedIn(membership(READER));
    failingTwice();
    open();

    const failed = 'We could not load the sign-in rules.';
    expect(await screen.findByText(failed)).toBeDefined();
    expect(screen.getByText('Check your connection and try again.')).toBeDefined();
    expect(document.activeElement).toBe(document.body);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const again = await screen.findByText(failed);
    await waitFor(() => expect(document.activeElement).toBe(again));

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Sign-in rules' }),
      ),
    );
  });
});

describe('what the rules ask of a member, on every page', () => {
  it('a member with no provider under a Google-or-Apple-only rule is told they can only read', async () => {
    signedIn(membership({ readOnlyUntilLinked: true }));
    answering();
    open('/app/settings');

    expect(await screen.findByText('Read-only until you link Google or Apple')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Link Google or Apple' }).getAttribute('href')).toBe(
      '/app/account/security',
    );
  });

  it('an administrator without two-factor is asked to turn it on, and can put it off', async () => {
    signedIn(membership({ withheldUntilTwoFactor: ['members.manage'] }));
    answering();
    open('/app/settings');

    expect(await screen.findByText('Two-factor required by Ìrè Events')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByText('Two-factor required by Ìrè Events')).toBeNull();
  });

  it('a change to the rules is said once, and closing it keeps it closed', async () => {
    const changed = membership({
      signInRules: {
        providerOnly: false,
        inactivityTimeoutDays: 30,
        administratorsNeedTwoFactor: false,
        everyoneNeedsTwoFactor: false,
        changedAt: '2026-10-15T17:40:00+00:00',
      },
    });
    signedIn(changed);
    answering();
    open('/app/settings');

    expect(await screen.findByText('Sign-in rules changed')).toBeDefined();
    expect(screen.getByRole('link', { name: 'See what changed' }).getAttribute('href')).toBe(
      '/app/settings/sign-in-rules',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close this notice' }));

    await waitFor(() => expect(screen.queryByText('Sign-in rules changed')).toBeNull());
  });

  it('a member without two-factor sees the deadline, with no way to close it', async () => {
    signedIn(
      membership({
        twoFactorDue: {
          at: '2999-10-24T13:20:00+00:00',
          written: 'Saturday, Oct 24 at 14:20 WAT',
          overdue: false,
        },
      }),
    );
    answering();
    open('/app/settings');

    expect(
      await screen.findByText('Ìrè Events requires two-factor from Saturday, Oct 24 at 14:20 WAT.'),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Turn it on now' }).getAttribute('href')).toBe(
      '/app/account/security',
    );
    expect(screen.queryByRole('button', { name: 'Close this notice' })).toBeNull();
  });

  it('past the deadline, nothing in the organisation opens until two-factor is on', async () => {
    signedIn(
      membership({
        twoFactorDue: {
          at: '2026-10-24T13:20:00+00:00',
          written: 'Saturday, Oct 24 at 14:20 WAT',
          overdue: true,
        },
      }),
    );
    answering();
    open('/app/settings/sign-in-rules');

    expect(await screen.findByText('Turn on two-factor to carry on')).toBeDefined();
    expect(
      screen.getByText('Ìrè Events requires two-factor, and the time to turn it on has passed.'),
    ).toBeDefined();
    expect(
      screen.getByText('Your other organisations and single-event access are not affected.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Sign-in rules' })).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Turn on two-factor' }));

    await waitFor(() => expect(screen.queryByText('Turn on two-factor to carry on')).toBeNull());
  });

  it('past the deadline, stays signed in and says so when signing out cannot reach Soirely', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    signedIn(
      membership({
        twoFactorDue: {
          at: '2026-10-24T13:20:00+00:00',
          written: 'Saturday, Oct 24 at 14:20 WAT',
          overdue: true,
        },
      }),
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (new URL(String(input)).pathname === '/api/auth/logout') {
        throw new TypeError('Failed to fetch');
      }

      return new Response(JSON.stringify(PAGE), { status: 200 });
    });
    open('/app/settings/sign-in-rules');

    await screen.findByText('Turn on two-factor to carry on');
    const button = screen.getByRole('button', { name: 'Sign out' });
    button.focus();
    fireEvent.click(button);

    expect((await screen.findByRole('alert')).textContent).toMatch(/You are still signed in/);
    expect(document.activeElement).toBe(button);
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
  });
});
