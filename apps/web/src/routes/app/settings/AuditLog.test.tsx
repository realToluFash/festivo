import type { AuditEntry, AuditLogPage } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { atWideWidth } from '../../../test-widths.ts';
import { routes } from '../../index.tsx';

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

function entry(id: string, overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id,
    at: '2026-10-17T08:12:44+00:00',
    day: '2026-10-17',
    time: '09:12',
    when: 'Saturday, Oct 17, 2026 at 09:12:44 WAT',
    who: { kind: 'person', name: 'Folake Adeyemi', email: 'folake@ire.events' },
    what: `Entry ${id}`,
    on: null,
    changes: [],
    type: 'events',
    action: 'event.made_live',
    address: null,
    device: null,
    reference: `ref-${id}`,
    ...overrides,
  };
}

const LIVE = entry('live', {
  what: 'Made Ireti at 40 live',
  on: { name: 'Ireti at 40', eventId: 'evt_2', gone: false },
  changes: ['Live: Off → On'],
});
const DOMAIN = entry('domain', {
  at: '2026-10-16T15:45:09+00:00',
  day: '2026-10-16',
  time: '16:45',
  what: 'Added ireevents.com to Email domains',
  who: { kind: 'person', name: 'Julien Moreau', email: 'julien@ire.events' },
  type: 'security',
  action: 'email_domain.added',
  address: '203.0.113.17',
});
const PROVED = entry('proved', {
  at: '2026-10-06T10:02:00+00:00',
  day: '2026-10-06',
  time: '11:02',
  what: 'Proved ire.events',
  who: { kind: 'system', name: null, email: null },
  type: 'security',
  action: 'email_domain.proved',
});
const DELETED = entry('deleted', {
  at: '2026-10-06T09:40:22+00:00',
  day: '2026-10-06',
  time: '10:40',
  what: 'Deleted Bisi & Kola’s engagement',
  on: { name: 'Bisi & Kola’s engagement', eventId: 'evt_9', gone: true },
  action: 'event.deleted',
});

function logPage(entries: AuditEntry[], overrides: Partial<AuditLogPage> = {}): AuditLogPage {
  return {
    organisation: 'Ìrè Events',
    zone: 'Africa/Lagos',
    entries,
    next: null,
    people: [
      { id: 'u1', name: 'Folake Adeyemi', email: 'folake@ire.events', left: false },
      { id: 'u9', name: 'Marta Silva', email: null, left: true },
    ],
    events: [{ id: 'evt_2', name: 'Ireti at 40', gone: false }],
    preparing: null,
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type Sent = { line: string; query: Record<string, string>; body: unknown };

function answering(answers: Record<string, (query: Record<string, string>) => Response>) {
  const sent: Sent[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const line = `${init?.method ?? 'GET'} ${url.pathname}`;
    const query = Object.fromEntries(url.searchParams);
    sent.push({ line, query, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer(query);
  });

  return sent;
}

const AT = '/app/settings/data-and-control/audit-log';
const LOG = 'GET /api/orgs/org_1/audit-log';
const VIEWED = 'POST /api/orgs/org_1/audit-log/views';
const EXPORT = 'POST /api/orgs/org_1/audit-log/exports';
const DOWNLOAD = 'POST /api/orgs/org_1/audit-log/exports/ax_1/download';
const viewed = () => new Response(null, { status: 204 });

function open(at = AT) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);
}

const reads = (sent: Sent[]) => sent.filter((one) => one.line === LOG);

beforeEach(() => {
  atWideWidth();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:audit');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Data and control › Audit log (sc-611)', () => {
  it('lists the entries under a heading per day, newest first, and is viewed once', async () => {
    signedIn();
    const sent = answering({
      [LOG]: () => json(logPage([LIVE, DOMAIN, PROVED, DELETED])),
      [VIEWED]: viewed,
    });
    open();

    expect(await screen.findByText('Who did what in Ìrè Events')).toBeDefined();
    expect(
      screen.getByText('Kept for 365 days. Nobody can change or delete an entry.'),
    ).toBeDefined();
    expect(
      [...document.querySelectorAll('section.desk-block:has(.dc-entries) h2')].map(
        (heading) => heading.textContent,
      ),
    ).toEqual(['Saturday, Oct 17', 'Friday, Oct 16', 'Tuesday, Oct 6']);
    expect(screen.getByRole('button', { name: /^09:12 ?Made Ireti at 40 live/u })).toBeDefined();
    expect(screen.getByText('Julien Moreau · Sign-in and security')).toBeDefined();
    expect(screen.getByText('System · Sign-in and security')).toBeDefined();
    expect(
      ['Person: Anyone', 'Type: All types', 'Event: All events', 'Dates: Last 365 days'].map(
        (name) => screen.getByRole('button', { name }).textContent,
      ),
    ).toEqual(['Anyone', 'All types', 'All events', 'Last 365 days']);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Type: All types' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Events' }));
    await waitFor(() => expect(reads(sent)).toHaveLength(2));

    expect(sent.filter((one) => one.line === VIEWED)).toHaveLength(1);
  });

  it('says Today on the heading for today in the page’s zone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T13:00:00Z'));
    signedIn();
    let zone: string | null = null;
    answering({
      [LOG]: () =>
        json(
          logPage(
            [
              entry('now', { at: '2026-10-19T12:00:00Z', day: '2026-10-19' }),
              entry('before', { at: '2026-10-18T12:00:00Z', day: '2026-10-18' }),
            ],
            { zone },
          ),
        ),
      [VIEWED]: viewed,
    });
    const { unmount } = open();

    expect(await screen.findByRole('heading', { name: 'Today · Monday, Oct 19' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Sunday, Oct 18' })).toBeDefined();
    unmount();

    zone = 'Pacific/Auckland';
    open();

    expect(await screen.findByRole('heading', { name: 'Monday, Oct 19' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: /^Today/u })).toBeNull();
  });

  it('asks again with each filter as it changes, from the first page', async () => {
    signedIn();
    const sent = answering({
      [LOG]: (query) =>
        json(logPage(query.type === 'security' ? [DOMAIN, PROVED] : [LIVE, DOMAIN, PROVED])),
      [VIEWED]: viewed,
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Person: Anyone' }));
    expect(
      within(screen.getByRole('menu', { name: 'Person' }))
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['Anyone', 'Folake Adeyemi', 'Marta Silva · left']);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Marta Silva · left' }));
    await waitFor(() => expect(reads(sent).at(-1)?.query).toEqual({ person: 'u9' }));

    fireEvent.click(screen.getByRole('button', { name: 'Type: All types' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Sign-in and security' }));
    await waitFor(() =>
      expect(reads(sent).at(-1)?.query).toEqual({ person: 'u9', type: 'security' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Event: All events' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ireti at 40' }));
    await waitFor(() =>
      expect(reads(sent).at(-1)?.query).toEqual({ person: 'u9', type: 'security', event: 'evt_2' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dates: Last 365 days' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dates' });
    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-10-01' } });
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '2026-10-19' } });
    await waitFor(() =>
      expect(reads(sent).at(-1)?.query).toEqual({
        person: 'u9',
        type: 'security',
        event: 'evt_2',
        from: '2026-10-01',
        to: '2026-10-19',
      }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));

    expect(await screen.findByRole('button', { name: 'Dates: Oct 1 to Oct 19' })).toBeDefined();
    expect(reads(sent).every((one) => one.query.before == null)).toBe(true);
  });

  it('catches a start date after the end date at once, and asks for nothing', async () => {
    signedIn();
    const sent = answering({ [LOG]: () => json(logPage([LIVE])), [VIEWED]: viewed });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Dates: Last 365 days' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dates' });
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(reads(sent)).toHaveLength(2));
    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-10-19' } });

    expect(
      within(dialog)
        .getByRole('alert')
        .textContent?.includes('The start date must be on or before the end date.'),
    ).toBe(true);
    expect(
      within(dialog).getByRole('button', { name: 'Apply' }).getAttribute('aria-disabled'),
    ).toBe('true');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reads(sent)).toHaveLength(2);
    expect(reads(sent).some((one) => one.query.from === '2026-10-19')).toBe(false);
  });

  it('says no entry matches, and Clear filters asks for them all again', async () => {
    signedIn();
    const sent = answering({
      [LOG]: (query) => json(logPage(query.type == null ? [LIVE] : [])),
      [VIEWED]: viewed,
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Type: All types' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Audit log' }));

    expect(await screen.findByText('No entry matches these filters.')).toBeDefined();
    const clears = screen.getAllByRole('button', { name: 'Clear filters' });
    expect(clears).toHaveLength(2);
    fireEvent.click(clears[1] as HTMLElement);

    expect(await screen.findByText('Made Ireti at 40 live')).toBeDefined();
    expect(reads(sent).at(-1)?.query).toEqual({});
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('shows more from the next cursor under the entries shown', async () => {
    signedIn();
    const sent = answering({
      [LOG]: (query) =>
        json(
          query.before === 'cur_2' ? logPage([PROVED]) : logPage([LIVE, DOMAIN], { next: 'cur_2' }),
        ),
      [VIEWED]: viewed,
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));

    expect(await screen.findByText('Proved ire.events')).toBeDefined();
    expect(screen.getByText('Made Ireti at 40 live')).toBeDefined();
    expect(reads(sent).at(-1)?.query).toEqual({ before: 'cur_2' });
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(sent.filter((one) => one.line === VIEWED)).toHaveLength(1);
  });

  it('opens an entry with what it records, the event linked', async () => {
    signedIn();
    answering({ [LOG]: () => json(logPage([LIVE, DOMAIN, PROVED, DELETED])), [VIEWED]: viewed });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Made Ireti at 40 live/u }));
    const dialog = await screen.findByRole('dialog', { name: 'Entry' });

    expect(within(dialog).getByText('Saturday, Oct 17, 2026 at 09:12:44 WAT')).toBeDefined();
    expect(within(dialog).getByText('Folake Adeyemi · folake@ire.events')).toBeDefined();
    expect(within(dialog).getByRole('link', { name: 'Ireti at 40' }).getAttribute('href')).toBe(
      '/app/events/evt_2',
    );
    expect(within(dialog).getByText('Live: Off → On')).toBeDefined();
    expect(within(dialog).getByText('Events · event.made_live')).toBeDefined();
    expect(within(dialog).queryByText('Network address')).toBeNull();
    expect(within(dialog).queryByText('Device')).toBeNull();
    expect(within(dialog).getByText('ref-live')).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /Deleted Bisi/u }));
    const gone = await screen.findByRole('dialog', { name: 'Entry' });
    expect(within(gone).getByText('Bisi & Kola’s engagement · no longer exists')).toBeDefined();
    expect(within(gone).queryByRole('link')).toBeNull();
    fireEvent.click(within(gone).getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /Added ireevents.com/u }));
    const signIn = await screen.findByRole('dialog', { name: 'Entry' });
    expect(within(signIn).getByText('203.0.113.17')).toBeDefined();
    expect(within(signIn).queryByText('Device')).toBeNull();
  });

  it('locks the page off Enterprise, with no entries', async () => {
    signedIn();
    const sent = answering({ [LOG]: () => problem('plan_required', 403), [VIEWED]: viewed });
    open();

    expect(await screen.findByText('Available on Enterprise')).toBeDefined();
    expect(
      screen.getByText('See who did what in Ìrè Events, for 365 days, and export it.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Export these entries' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Type: All types' })).toBeNull();
    expect(sent.filter((one) => one.line === VIEWED)).toHaveLength(0);
  });

  it('downloads a small export at once and says so', async () => {
    signedIn();
    const sent = answering({
      [LOG]: () => json(logPage([LIVE])),
      [VIEWED]: viewed,
      [EXPORT]: () =>
        new Response('when,who\n', { status: 200, headers: { 'Content-Type': 'text/csv' } }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Type: All types' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Events' }));
    await waitFor(() => expect(reads(sent)).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Export these entries' }));
    const dialog = await screen.findByRole('dialog', { name: 'Export these entries' });
    expect(
      within(dialog).getByText(
        'Up to 10,000 entries download at once. More are prepared, and we email you a link.',
      ),
    ).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Export' }));

    expect(await screen.findByText('Downloading the audit log as CSV.')).toBeDefined();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(sent.find((one) => one.line === EXPORT)?.body).toEqual({
      format: 'csv',
      type: 'events',
    });
    const link = vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/u);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('turns the card to Preparing for a prepared export', async () => {
    signedIn();
    const sent = answering({
      [LOG]: () => json(logPage([LIVE])),
      [VIEWED]: viewed,
      [EXPORT]: () => json({ count: 48210, email: 'folake@ire.events' }, 202),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Export these entries' }));
    const dialog = await screen.findByRole('dialog', { name: 'Export these entries' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /JSON Lines/u }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Export' }));

    expect(await screen.findByText('Preparing your export')).toBeDefined();
    expect(
      screen.getByText(
        'We’ll email folake@ire.events a link when it’s ready. It downloads only for you, signed in, for 24 hours.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Export these entries' })).toBeNull();
    expect(sent.find((one) => one.line === EXPORT)?.body).toEqual({ format: 'jsonl' });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('shows Preparing while the page says one is pending', async () => {
    signedIn();
    answering({
      [LOG]: () => json(logPage([LIVE], { preparing: 'folake@ire.events' })),
      [VIEWED]: viewed,
    });
    open();

    expect(await screen.findByText('Preparing your export')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Export these entries' })).toBeNull();
  });

  it('says inside the dialog when more than a million match', async () => {
    signedIn();
    answering({
      [LOG]: () => json(logPage([LIVE])),
      [VIEWED]: viewed,
      [EXPORT]: () => problem('audit_export_too_many', 422),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Export these entries' }));
    const dialog = await screen.findByRole('dialog', { name: 'Export these entries' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Export' }));

    expect(
      await within(dialog).findByText(
        'More than 1,000,000 entries match. Narrow the filters, then export again.',
      ),
    ).toBeDefined();
    expect(
      within(dialog).getByRole('button', { name: 'Export' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('downloads a prepared export from its emailed link', async () => {
    signedIn();
    const sent = answering({
      [LOG]: () => json(logPage([LIVE])),
      [VIEWED]: viewed,
      [DOWNLOAD]: () =>
        new Response('{}\n', { status: 200, headers: { 'Content-Type': 'application/jsonl' } }),
    });
    open(`${AT}?download=ax_1`);

    expect(await screen.findByText('Downloading the audit log as JSON Lines.')).toBeDefined();
    expect(sent.filter((one) => one.line === DOWNLOAD)).toHaveLength(1);
    const link = vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.jsonl$/u);
  });

  it('says an emailed link has ended', async () => {
    signedIn();
    answering({
      [LOG]: () => json(logPage([LIVE])),
      [VIEWED]: viewed,
      [DOWNLOAD]: () => problem('export_expired', 410),
    });
    open(`${AT}?download=ax_1`);

    expect(
      await screen.findByText('This download link has ended. Export the entries again.'),
    ).toBeDefined();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('says the page did not load, with Try again', async () => {
    signedIn();
    let fails = true;
    answering({
      [LOG]: () => (fails ? problem('internal', 500) : json(logPage([LIVE]))),
      [VIEWED]: viewed,
    });
    open();

    expect(await screen.findByText('We could not load the audit log.')).toBeDefined();
    fails = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Made Ireti at 40 live')).toBeDefined();
  });
});

describe('Data and control’s Audit log row (sc-611)', () => {
  const hub = (plan: 'enterprise' | 'free' | 'left') => ({
    'GET /api/orgs/org_1/export': () =>
      json({ owner: true, export: null, nextAllowedAt: null, nextAllowed: null }),
    'GET /api/orgs/org_1/email-domains': () => json({ plan, domains: [] }),
  });

  it('lists Audit log under Control, after Email domains', async () => {
    signedIn();
    answering(hub('enterprise'));
    open('/app/settings/data-and-control');

    const link = await screen.findByRole('link', { name: /Audit log/u });
    expect(link.getAttribute('href')).toBe(AT);
    expect(within(link).getByText('Who did what, for 365 days')).toBeDefined();
    expect(within(link).queryByText('Enterprise')).toBeNull();
    expect(
      within(link.closest('ul') as HTMLElement)
        .getAllByRole('link')
        .map((one) => one.getAttribute('href')),
    ).toEqual(['/app/settings/data-and-control/email-domains', AT]);
  });

  it.each(['free', 'left'] as const)('locks the row on the %s plan', async (plan) => {
    signedIn();
    answering(hub(plan));
    open('/app/settings/data-and-control');

    const link = await screen.findByRole('link', { name: /Audit log/u });
    expect(within(link).getByText('Enterprise')).toBeDefined();
  });
});
