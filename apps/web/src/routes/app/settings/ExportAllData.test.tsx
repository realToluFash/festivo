import type { OrganisationExportPage } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { atWideWidth } from '../../../test-widths.ts';
import { routes } from '../../index.tsx';

const EXPIRES = 'Sunday 18 Oct at 14:52 WAT';

const ADMIN = membership({
  role: { id: 'role_2', seededAs: 'administrator', name: null },
});

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

function exported(
  state: NonNullable<OrganisationExportPage['export']>['state'],
  mine = true,
): OrganisationExportPage {
  return {
    owner: mine,
    export: {
      id: 'ex_1',
      state,
      mine,
      askedBy: 'Folake Adeyemi',
      askedAt: '2026-10-17T13:30:00+00:00',
      asked: 'Saturday 17 Oct at 14:30 WAT',
      expiresAt: state === 'preparing' ? null : '2026-10-18T13:52:00+00:00',
      expires: state === 'preparing' ? null : EXPIRES,
      downloadedAt: state === 'used' ? '2026-10-17T14:05:00+00:00' : null,
      downloaded: state === 'used' ? 'Saturday 17 Oct at 15:05 WAT' : null,
    },
    nextAllowedAt: '2026-10-18T13:30:00+00:00',
    nextAllowed: 'Sunday 18 Oct at 14:30 WAT',
  };
}

const NOTHING: OrganisationExportPage = {
  owner: true,
  export: null,
  nextAllowedAt: null,
  nextAllowed: null,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number, members: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...members }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function answering(answers: Record<string, () => Response>) {
  const sent: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push(line);
    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function open(at = '/app/settings/data-and-control/export') {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);
}

const PAGE = 'GET /api/orgs/org_1/export';
const ASK = 'POST /api/orgs/org_1/export';
const DOWNLOAD = 'POST /api/orgs/org_1/export/ex_1/download';

beforeEach(() => {
  atWideWidth();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Data and control › Export all data (sc-612)', () => {
  it('offers an owner Export all data, and says what the archive holds and leaves out', async () => {
    signedIn();
    answering({ [PAGE]: () => json(NOTHING) });
    open();

    expect(await screen.findByText('Take everything Ìrè Events holds')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Export all data' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'What the archive holds' })).toBeDefined();
    expect(screen.getByText('Events with their People')).toBeDefined();
    expect(screen.getByText(/leaves out your own account’s sign-in methods/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Data and control' })).toBeDefined();
  });

  it('shows Preparing once pressed, then Ready with Download without a reload', async () => {
    signedIn();
    let page = NOTHING;
    const sent = answering({
      [PAGE]: () => json(page),
      [ASK]: () => {
        page = exported('ready');
        return json(exported('preparing'), 202);
      },
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Export all data' }));

    expect(await screen.findByText('Preparing your export')).toBeDefined();
    expect(
      screen.getByText(
        'Asked by you, Saturday 17 Oct at 14:30 WAT. We’ll email folake@ire.events when it’s ready, and it shows here.',
      ),
    ).toBeDefined();
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();

    expect(await screen.findByText('Your export is ready')).toBeDefined();
    expect(
      screen.getByText(
        `We emailed a link to folake@ire.events. It downloads once, until ${EXPIRES}, and only for you, signed in.`,
      ),
    ).toBeDefined();
    expect(
      screen.getByText('The next export can start on Sunday 18 Oct at 14:30 WAT.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Download' })).toBeDefined();
    expect(sent.filter((line) => line === ASK)).toHaveLength(1);
  });

  it('downloads once from Download, and then shows it used', async () => {
    signedIn();
    let page = exported('ready');
    const sent = answering({
      [PAGE]: () => json(page),
      [DOWNLOAD]: () => {
        page = exported('used');
        return new Response(new Uint8Array([80, 75]), {
          headers: { 'Content-Type': 'application/zip' },
        });
      },
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));

    expect(await screen.findByText('Your export was downloaded')).toBeDefined();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    expect(sent.filter((line) => line === DOWNLOAD)).toHaveLength(1);
  });

  it('follows the emailed link once, and says so when it was already used', async () => {
    signedIn();
    answering({
      [PAGE]: () => json(exported('used')),
      [DOWNLOAD]: () => problem('export_used', 410),
    });
    open('/app/settings/data-and-control/export?download=ex_1');

    expect(
      await screen.findByText('This download has been used. It downloads nothing now.'),
    ).toBeDefined();
    expect(screen.getByText('Your export was downloaded')).toBeDefined();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('shows the 429’s instant on a stale page and starts nothing', async () => {
    signedIn();
    answering({
      [PAGE]: () => json(exported('expired')),
      [ASK]: () => problem('too_many_attempts', 429, { retryAt: 'Sunday 18 Oct at 14:31 WAT' }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Export all data' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The next export can start on Sunday 18 Oct at 14:31 WAT. Nothing was started.',
    );
  });

  it('offers Try again when an export did not finish', async () => {
    signedIn();
    answering({
      [PAGE]: () => json({ ...exported('failed'), nextAllowedAt: null, nextAllowed: null }),
    });
    open();

    expect(await screen.findByText('Your export did not finish')).toBeDefined();
    expect(
      screen.getByText('Nothing was emailed, and it doesn’t count toward today’s export.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('shows an admin who asked for a ready export, with no Download', async () => {
    signedIn(ADMIN);
    answering({ [PAGE]: () => json(exported('ready', false)) });
    open();

    expect(await screen.findByText('Ìrè Events’s export is ready')).toBeDefined();
    expect(
      screen.getByText(
        `Asked by Folake Adeyemi, Saturday 17 Oct at 14:30 WAT. Only they can download it, until ${EXPIRES}.`,
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('gives an admin no Export all data', async () => {
    signedIn(ADMIN);
    answering({ [PAGE]: () => json({ ...NOTHING, owner: false }) });
    open();

    expect(await screen.findByText('Only an owner exports Ìrè Events’s data')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Export all data' })).toBeNull();
  });

  it('gives a member nothing of it', async () => {
    signedIn(MEMBER);
    const sent = answering({});
    open();

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(sent).not.toContain(PAGE);
  });
});

describe('Data and control (sc-612)', () => {
  it('lists Export all data, with Ready and the card’s Download when the reader’s export is ready', async () => {
    signedIn();
    answering({ [PAGE]: () => json(exported('ready')) });
    open('/app/settings/data-and-control');

    expect(await screen.findByText(`Ready until ${EXPIRES}`)).toBeDefined();
    expect(screen.getByText('Your export is ready')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Download' })).toBeDefined();
    expect(screen.getByRole('link', { name: /Export all data/ }).getAttribute('href')).toBe(
      '/app/settings/data-and-control/export',
    );
  });

  it('gives an admin the row with who asked, and no Download', async () => {
    signedIn(ADMIN);
    answering({ [PAGE]: () => json(exported('ready', false)) });
    open('/app/settings/data-and-control');

    expect(await screen.findByText('Ready · asked by Folake Adeyemi')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('says what the archive is when nothing was asked yet', async () => {
    signedIn();
    answering({ [PAGE]: () => json(NOTHING) });
    open('/app/settings/data-and-control');

    await waitFor(() =>
      expect(screen.getByText('Everything Ìrè Events holds, in one archive')).toBeDefined(),
    );
  });
});
