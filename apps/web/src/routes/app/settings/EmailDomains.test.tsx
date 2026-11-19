import type { EmailDomain, EmailDomainsPage, OrganisationExportPage } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { atWideWidth } from '../../../test-widths.ts';
import { routes } from '../../index.tsx';

const ADMIN = membership({ role: { id: 'role_2', seededAs: 'administrator', name: null } });

const MEMBER = membership({
  role: { id: 'role_3', seededAs: 'member', name: null },
  permissions: ['events.read'],
});

function signedIn(organisation = membership()): void {
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

const RECORD = { type: 'TXT' as const, value: 'k7q2m9x4c8rt5bn3wd6jp1hz0ys5gfa' };

function domain(name: string, status: EmailDomain['status']): EmailDomain {
  const proved = status === 'proved' || status === 'missing';

  return {
    domain: name,
    status,
    record: { ...RECORD, name: `_soirely-verify.${name}` },
    addedAt: '2026-10-16T15:45:00+00:00',
    added: 'Friday 16 Oct at 16:45 WAT',
    provedAt: proved ? '2026-10-06T10:02:00+00:00' : null,
    proved: proved ? 'Tuesday 6 Oct at 11:02 WAT' : null,
    checksEndAt: '2026-10-23T15:45:00+00:00',
    checksEnd: 'Friday 23 Oct at 16:45 WAT',
    putBackByAt: status === 'missing' ? '2026-10-31T13:20:00+00:00' : null,
    putBackBy: status === 'missing' ? 'Saturday 31 Oct at 14:20 WAT' : null,
    onlyOurs: 'off',
    onlyOursFromAt: null,
    onlyOursFrom: null,
    onlyOursIfNowAt: proved ? '2026-10-31T13:20:00+00:00' : null,
    onlyOursIfNow: proved ? 'Saturday 31 Oct at 14:20 WAT' : null,
  };
}

const IRE = domain('ire.events', 'proved');
const IRE_COM = domain('ireevents.com', 'waiting');

const page = (
  domains: EmailDomain[],
  plan: EmailDomainsPage['plan'] = 'enterprise',
  ownerChanges = true,
): EmailDomainsPage => ({ plan, ownerChanges, domains });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number, members: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...members }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function refused(code: string, message: string): Response {
  return problem('validation_failed', 422, {
    violations: [{ propertyPath: 'domain', code, message }],
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

const AT = '/app/settings/data-and-control/email-domains';
const PAGE = 'GET /api/orgs/org_1/email-domains';
const ADD = 'POST /api/orgs/org_1/email-domains';
const VERIFY = 'POST /api/orgs/org_1/email-domains/ireevents.com/verify';
const EXPORT = 'GET /api/orgs/org_1/export';

function open(at = AT) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);
}

function row(name: string): HTMLElement {
  return screen.getByText(name, { selector: '.desk-row-name' }).closest('li') as HTMLElement;
}

beforeEach(() => {
  atWideWidth();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Data and control › Email domains (sc-560)', () => {
  it('lists each domain by status with the server’s own instants', async () => {
    signedIn();
    answering({
      [PAGE]: () =>
        json(
          page([
            IRE,
            IRE_COM,
            domain('ire.ng', 'failed'),
            { ...domain('ire.co', 'missing'), putBackBy: 'Sunday 1 Nov at 09:00 WAT' },
          ]),
        ),
    });
    open();

    expect(await screen.findByText('The record for ire.co is missing')).toBeDefined();
    expect(
      screen.getByText(
        'Put it back by Sunday 1 Nov at 09:00 WAT, or ire.co stops being proved and Only our organisation stops with it.',
      ),
    ).toBeDefined();
    expect(within(row('ire.events')).getByText('Proved')).toBeDefined();
    expect(within(row('ire.events')).getByText('Proved Tuesday 6 Oct at 11:02 WAT')).toBeDefined();
    expect(within(row('ireevents.com')).getByText('Waiting for the record')).toBeDefined();
    expect(
      within(row('ireevents.com')).getByText(
        'We check every hour until Friday 23 Oct at 16:45 WAT',
      ),
    ).toBeDefined();
    expect(within(row('ire.ng')).getByText('Not proved')).toBeDefined();
    expect(
      within(row('ire.ng')).getByText(
        'We stopped checking on Friday 23 Oct at 16:45 WAT. Verify still works.',
      ),
    ).toBeDefined();
    expect(within(row('ire.co')).getByText('Record missing')).toBeDefined();
    expect(
      within(row('ire.co')).getByText('Put it back by Sunday 1 Nov at 09:00 WAT'),
    ).toBeDefined();
    expect(within(row('ire.events')).queryByRole('button', { name: /See the record/ })).toBeNull();
    expect(
      within(row('ire.events')).getByRole('button', { name: 'Remove ire.events' }).textContent,
    ).toBe('Remove…');
    expect(
      within(row('ireevents.com')).getByRole('button', { name: 'Remove ireevents.com' })
        .textContent,
    ).toBe('Remove');
    expect(screen.getByRole('button', { name: 'Data and control' })).toBeDefined();
    expect(
      screen.getByText(
        'Proving a domain does not let anyone join. Company domain joining is its own list, in General.',
      ),
    ).toBeDefined();
    expect(
      screen.getAllByText('Only our organisation', { selector: '.desk-row-name' }),
    ).toHaveLength(2);
  });

  it('draws the page in the desk’s look', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([IRE])) });
    open();

    const title = await screen.findByRole('heading', { level: 1, name: 'Email domains' });
    expect(title.closest('.desk')).not.toBeNull();
    expect(await screen.findByText('ire.events is proved')).toBeDefined();
    expect(
      screen.getByText('People at ire.events can still be members of other organisations.', {
        selector: '.desk-on-card',
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Limit ire.events accounts to Ìrè Events' }),
    ).toBeDefined();
  });

  it('asks to prove the first domain when there is none', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([])) });
    open();

    expect(await screen.findByText('Prove the email domain of Ìrè Events')).toBeDefined();
    expect(screen.getByText('No domains yet.')).toBeDefined();
  });

  it('checks the field before sending, then shows each refusal of the server under it', async () => {
    signedIn();
    let answer = json(page([]));
    const sent = answering({ [PAGE]: () => json(page([])), [ADD]: () => answer });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Prove a domain' }));
    const dialog = await screen.findByRole('dialog', { name: 'Prove a domain' });
    const field = within(dialog).getByLabelText('Domain');
    expect(
      within(dialog).getByText('For example, ire.events. A subdomain needs adding on its own.'),
    ).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByText('Enter a domain, like ire.events.')).toBeDefined();

    fireEvent.change(field, { target: { value: 'ire events' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(
      within(dialog).getByText('Enter a domain with a dot and no spaces, like ire.events.'),
    ).toBeDefined();
    expect(sent.some((one) => one.line === ADD)).toBe(false);

    const refusals = [
      ['gmail.com', 'domain_public', 'You cannot use a public email domain.'],
      [
        'lumenfeiras.pt',
        'domain_taken',
        'Another organisation has already proved this domain. Contact Soirely support if it is yours.',
      ],
      ['ire.events', 'domain_listed', 'ire.events is already on the list.'],
    ] as const;

    for (const [typed, code, message] of refusals) {
      answer = refused(code, message);
      fireEvent.change(field, { target: { value: typed } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      expect(await within(dialog).findByText(message)).toBeDefined();
      expect(field.getAttribute('aria-invalid')).toBe('true');
    }
    expect(sent.filter((one) => one.line === ADD).map((one) => one.body)).toEqual([
      { domain: 'gmail.com' },
      { domain: 'lumenfeiras.pt' },
      { domain: 'ire.events' },
    ]);
  });

  it('adds a domain and opens its record, each part with Copy', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([IRE])), [ADD]: () => json(page([IRE, IRE_COM]), 201) });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Prove a domain' }));
    const dialog = await screen.findByRole('dialog', { name: 'Prove a domain' });
    fireEvent.change(within(dialog).getByLabelText('Domain'), {
      target: { value: 'IreEvents.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    const record = await screen.findByRole('dialog', { name: 'Prove ireevents.com' });
    expect(within(record).getByText('TXT')).toBeDefined();
    expect(within(record).getByText('_soirely-verify.ireevents.com')).toBeDefined();
    expect(within(record).getByText(RECORD.value)).toBeDefined();
    expect(within(record).getAllByRole('button', { name: /^Copy / })).toHaveLength(3);
    expect(
      within(record).getByText('We check every hour until Friday 23 Oct at 16:45 WAT.'),
    ).toBeDefined();
  });

  it('keeps the record open with the not-found line when Verify finds nothing', async () => {
    signedIn();
    answering({
      [PAGE]: () => json(page([IRE, IRE_COM])),
      [VERIFY]: () => json({ found: false, ...page([IRE, IRE_COM]) }),
    });
    open();

    fireEvent.click(
      await screen.findByRole('button', { name: 'See the record for ireevents.com' }),
    );
    const record = await screen.findByRole('dialog', { name: 'Prove ireevents.com' });
    fireEvent.click(within(record).getByRole('button', { name: 'Verify' }));

    expect(
      await within(record).findByText(
        'We could not find the record yet. DNS changes can take up to 48 hours.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Prove ireevents.com' })).toBeDefined();
  });

  it('proves the domain when Verify finds the record, and says so on the card', async () => {
    signedIn();
    const provedNow = {
      ...domain('ireevents.com', 'proved'),
      proved: 'Monday 19 Oct at 10:12 WAT',
    };
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    answering({
      [PAGE]: () => json(page([IRE, IRE_COM])),
      [VERIFY]: async () => {
        await held;
        return json({ found: true, ...page([IRE, provedNow]) });
      },
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'See the record' }));
    const record = await screen.findByRole('dialog', { name: 'Prove ireevents.com' });
    fireEvent.click(within(record).getByRole('button', { name: 'Verify' }));

    expect(await within(record).findByRole('button', { name: 'Verifying…' })).toBeDefined();
    release();

    expect(await screen.findByText('ireevents.com is proved')).toBeDefined();
    expect(screen.getByText('Proved Monday 19 Oct at 10:12 WAT.')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(row('ireevents.com')).getByText('Proved')).toBeDefined();
  });

  it('opens the record the hub’s See the record names', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([IRE, IRE_COM])) });
    open(`${AT}?record=ireevents.com`);

    expect(await screen.findByRole('dialog', { name: 'Prove ireevents.com' })).toBeDefined();
  });

  it('asks before removing a proved domain, and says it was removed', async () => {
    signedIn();
    const sent = answering({
      [PAGE]: () => json(page([IRE, IRE_COM])),
      'DELETE /api/orgs/org_1/email-domains/ire.events': () => json(page([IRE_COM])),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove ire.events' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Remove ire.events?' });
    expect(
      within(ask).getByText(
        'It stops being proved, and Only our organisation stops for it. Company domain joining keeps its own list.',
      ),
    ).toBeDefined();
    expect(
      within(ask)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Keep it', 'Remove']);
    expect(sent.some((one) => one.line.startsWith('DELETE'))).toBe(false);
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('ire.events was removed')).toBeDefined();
    expect(screen.getByText('It is no longer proved.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'See the record' })).toBeDefined();
    expect(screen.queryByText('ire.events', { selector: '.desk-row-name' })).toBeNull();
  });

  it('removes a waiting domain without asking', async () => {
    signedIn();
    const sent = answering({
      [PAGE]: () => json(page([IRE, IRE_COM])),
      'DELETE /api/orgs/org_1/email-domains/ireevents.com': () => json(page([IRE])),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove ireevents.com' }));

    expect(await screen.findByText('ireevents.com removed.')).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(sent.filter((one) => one.line.startsWith('DELETE'))).toHaveLength(1);
  });

  it('locks the page off Enterprise, with no list', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([], 'free')) });
    open();

    expect(await screen.findByText('Available on Enterprise')).toBeDefined();
    expect(
      screen.getByText(
        'Prove that Ìrè Events owns its domain, then limit the accounts at it to Ìrè Events.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Domains' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Prove a domain' })).toBeNull();
  });

  it('keeps the domains read only once the organisation left Enterprise', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([IRE], 'left')) });
    open();

    expect(
      await screen.findByText(
        'Ìrè Events left Enterprise. Its domains are kept as they were, and come back on with Enterprise.',
      ),
    ).toBeDefined();
    expect(within(row('ire.events')).getByText('Kept')).toBeDefined();
    expect(within(row('ire.events')).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Prove a domain' })).toBeNull();
  });

  it('says the page did not load, with Try again', async () => {
    signedIn();
    let reads = 0;
    answering({
      [PAGE]: () => {
        reads += 1;
        if (reads === 1) throw new TypeError('Failed to fetch');
        return json(page([IRE]));
      },
    });
    open();

    expect(await screen.findByText('We could not load Email domains.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('ire.events is proved')).toBeDefined();
  });

  it('gives a member nothing of it', async () => {
    signedIn(MEMBER);
    const sent = answering({});
    open();

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(sent.some((one) => one.line === PAGE)).toBe(false);
  });

  it('lets an admin prove domains too', async () => {
    signedIn(ADMIN);
    answering({ [PAGE]: () => json(page([IRE])) });
    open();

    expect(await screen.findByRole('button', { name: 'Prove a domain' })).toBeDefined();
  });
});

const NO_EXPORT: OrganisationExportPage = {
  owner: true,
  export: null,
  nextAllowedAt: null,
  nextAllowed: null,
};

describe('Data and control’s Email domains row and card (sc-560)', () => {
  it('lists Email domains under Control with each domain and where it stands', async () => {
    signedIn();
    answering({ [EXPORT]: () => json(NO_EXPORT), [PAGE]: () => json(page([IRE, IRE_COM])) });
    open('/app/settings/data-and-control');

    expect(
      await screen.findByText('ire.events proved · ireevents.com waiting for the record'),
    ).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Control' })).toBeDefined();
    expect(screen.getByRole('link', { name: /Email domains/ }).getAttribute('href')).toBe(AT);
  });

  it('puts the waiting record on the card with See the record, which opens it', async () => {
    signedIn();
    answering({ [EXPORT]: () => json(NO_EXPORT), [PAGE]: () => json(page([IRE, IRE_COM])) });
    open('/app/settings/data-and-control');

    expect(await screen.findByText('ireevents.com is waiting for its record')).toBeDefined();
    expect(screen.getByText('We check every hour until Friday 23 Oct at 16:45 WAT.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'See the record' }));

    expect(await screen.findByRole('dialog', { name: 'Prove ireevents.com' })).toBeDefined();
  });

  it('puts the soonest step first: a ready export ending before the checks stop', async () => {
    signedIn();
    const ready: OrganisationExportPage = {
      owner: true,
      export: {
        id: 'ex_1',
        state: 'ready',
        mine: true,
        askedBy: 'Folake Adeyemi',
        askedAt: '2026-10-17T13:30:00+00:00',
        asked: 'Saturday 17 Oct at 14:30 WAT',
        expiresAt: '2026-10-18T13:52:00+00:00',
        expires: 'Sunday 18 Oct at 14:52 WAT',
        downloadedAt: null,
        downloaded: null,
      },
      nextAllowedAt: null,
      nextAllowed: null,
    };
    answering({ [EXPORT]: () => json(ready), [PAGE]: () => json(page([IRE, IRE_COM])) });
    open('/app/settings/data-and-control');

    expect(await screen.findByText('Your export is ready')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Download' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'See the record' })).toBeNull();
  });

  it('puts a missing record before a waiting one that stops checking later', async () => {
    signedIn();
    const missing = {
      ...domain('ire.events', 'missing'),
      putBackByAt: '2026-10-20T08:00:00+00:00',
    };
    answering({ [EXPORT]: () => json(NO_EXPORT), [PAGE]: () => json(page([IRE_COM, missing])) });
    open('/app/settings/data-and-control');

    expect(await screen.findByText('The record for ire.events is missing')).toBeDefined();
  });

  it('says nothing needs attention once every domain is proved', async () => {
    signedIn();
    answering({ [EXPORT]: () => json(NO_EXPORT), [PAGE]: () => json(page([IRE])) });
    open('/app/settings/data-and-control');

    expect(await screen.findByText('ire.events proved')).toBeDefined();
    expect(screen.getByText('Nothing needs your attention')).toBeDefined();
  });

  it('locks the row off Enterprise, and keeps it once the organisation left', async () => {
    signedIn();
    let plan: EmailDomainsPage = page([], 'free');
    answering({ [EXPORT]: () => json(NO_EXPORT), [PAGE]: () => json(plan) });
    const { unmount } = open('/app/settings/data-and-control');

    const link = await screen.findByRole('link', { name: /Email domains/ });
    expect(within(link).getByText('Enterprise')).toBeDefined();
    expect(within(link).getByText('Prove your domain')).toBeDefined();
    unmount();

    plan = page([domain('ireevents.com', 'waiting')], 'left');
    open('/app/settings/data-and-control');

    expect(await screen.findByText('ireevents.com kept as it was')).toBeDefined();
    await waitFor(() => expect(screen.getByText('Nothing needs your attention')).toBeDefined());
  });
});

describe('Data and control › Email domains › Only our organisation (sc-563)', () => {
  const ONLY = 'POST /api/orgs/org_1/email-domains/ire.events/only-ours';
  const OFF = 'DELETE /api/orgs/org_1/email-domains/ire.events/only-ours';
  const scheduled: EmailDomain = {
    ...IRE,
    onlyOurs: 'scheduled',
    onlyOursFromAt: '2026-10-31T13:20:00+00:00',
    onlyOursFrom: 'Saturday 31 Oct at 14:20 WAT',
    onlyOursIfNowAt: null,
    onlyOursIfNow: null,
  };
  const on: EmailDomain = { ...scheduled, onlyOurs: 'on' };

  function only(): HTMLElement {
    return screen
      .getByText('Only our organisation', { selector: '.desk-row-name' })
      .closest('li') as HTMLElement;
  }

  it('switching it on asks once with the instant, then shows it scheduled with Cancel', async () => {
    signedIn();
    const sent = answering({
      [PAGE]: () => json(page([IRE])),
      [ONLY]: () => json(page([scheduled])),
    });
    open();

    expect(
      await screen.findByText('People at ire.events can still be members of other organisations.', {
        selector: '.desk-on-card',
      }),
    ).toBeDefined();
    fireEvent.click(
      within(only()).getByRole('switch', { name: 'Only our organisation for ire.events' }),
    );

    const ask = await screen.findByRole('alertdialog', {
      name: 'Limit ire.events accounts to Ìrè Events?',
    });
    expect(
      within(ask).getByText(
        'From Saturday 31 Oct at 14:20 WAT, 14 days from now, an account whose main email address is at ire.events can only be a member of Ìrè Events.',
      ),
    ).toBeDefined();
    expect(
      within(ask).getByText(
        'Everyone at ire.events is emailed now. Access to a single event still works. You can cancel until then.',
      ),
    ).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Schedule it' }));

    expect(
      await screen.findByText('Only our organisation starts on Saturday 31 Oct at 14:20 WAT'),
    ).toBeDefined();
    expect(
      screen.getByText('Everyone at ire.events was emailed. You can cancel until then.'),
    ).toBeDefined();
    expect(within(only()).getByText('Starts Saturday 31 Oct at 14:20 WAT')).toBeDefined();
    expect(within(only()).queryByRole('switch')).toBeNull();
    expect(sent.map((one) => one.line)).toContain(ONLY);
  });

  it('cancelling asks nothing and says nothing changes', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([scheduled])), [OFF]: () => json(page([IRE])) });
    open();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancel Only our organisation for ire.events' }),
    );

    expect(await screen.findByText('Only our organisation was cancelled')).toBeDefined();
    expect(screen.getByText('Nothing changes for the accounts at ire.events.')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('switching it off applies at once', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([on])), [OFF]: () => json(page([IRE])) });
    open();

    expect(await screen.findByText('Accounts at ire.events belong to Ìrè Events')).toBeDefined();
    fireEvent.click(
      within(only()).getByRole('switch', {
        name: 'Only our organisation for ire.events',
        checked: true,
      }),
    );

    expect(await screen.findByText('Only our organisation is off')).toBeDefined();
    expect(
      screen.getByText('Accounts at ire.events can be members of other organisations again.'),
    ).toBeDefined();
  });

  it('an admin reads its state and that only an owner can change it, with no control', async () => {
    signedIn(ADMIN);
    answering({ [PAGE]: () => json(page([scheduled], 'enterprise', false)) });
    open();

    expect(
      await screen.findByText(
        'Starts Saturday 31 Oct at 14:20 WAT. Only an owner can change this.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Only an owner can cancel it.')).toBeDefined();
    expect(within(only()).queryByRole('switch')).toBeNull();
    expect(within(only()).queryByRole('button')).toBeNull();
  });

  it('after leaving Enterprise it reads as kept', async () => {
    signedIn();
    answering({ [PAGE]: () => json(page([on], 'left')) });
    open();

    expect(
      await screen.findByText('Kept as it was. It comes back on with Enterprise.'),
    ).toBeDefined();
    expect(within(only()).queryByRole('switch')).toBeNull();
  });
});
