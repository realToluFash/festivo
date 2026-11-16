import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { cssRule, stylesheet } from '../../../test-styles.ts';

const EVENTS_DESK_CSS = stylesheet(import.meta.dirname, '../../../components/eventsDesk.css');

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-15T18:00:00+00:00',
  endsAt: '2030-11-16T02:00:00+00:00',
  timeZone: 'Europe/London',
  dayCount: 1,
  currency: 'GBP',
  cover: null,
  venue: null,
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

function signedIn(): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u_folake',
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations: [IRE],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ETag: '"1"',
      'Content-Type': 'application/json',
      Date: 'Fri, 15 Nov 2030 19:20:00 GMT',
    },
  });
}

/** An item exactly as the API's contract writes one (sc-3893, sc-1404). */
function item(id: string, title: string, at: string, more: Record<string, unknown> = {}) {
  return {
    id,
    title,
    startsAt: `2030-11-15T${at}:00+00:00`,
    startedAt: null,
    endedAt: null,
    skipped: false,
    day: '2030-11-15',
    lengthMinutes: null,
    place: null,
    ownerName: null,
    ownerRole: null,
    note: null,
    fixedTime: false,
    showToGuests: false,
    version: 1,
    ...more,
  };
}

function schedule(items: unknown[]) {
  return {
    timeZone: 'Europe/London',
    earliest: '2030-11-15T06:00:00+00:00',
    latest: '2030-11-16T02:00:00+00:00',
    itemsMaximum: 200,
    items,
  };
}

const DINNER = item('it_dinner', 'Dinner is served', '18:40', {
  lengthMinutes: 75,
  ownerName: 'Ronke Alade',
  startedAt: '2030-11-15T18:58:00+00:00',
});
const SPEECHES = item('it_speeches', 'Speeches', '19:55', { lengthMinutes: 30 });
const CAKE = item('it_cake', 'Cake cutting', '20:20', { lengthMinutes: 30 });
const FIREWORKS = item('it_fireworks', 'Fireworks', '20:45', {
  lengthMinutes: 15,
  fixedTime: true,
});

async function onRun(
  items: unknown[],
  permissions: string[] = OWNER_PERMISSIONS,
  answers: Record<string, () => Response> = {},
): Promise<string[]> {
  const sent: string[] = [];
  signedIn();

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push(line);

    const answer = answers[line];
    if (answer != null) return answer();
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });
    if (line === 'GET /api/events/ev_1/schedule') return json({ schedule: schedule(items) });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/run'] })}
    />,
  );
  await screen.findByRole('table', { name: 'Main' });

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('The run view (sc-1404)', () => {
  it('shows each not-started item’s expected time under its planned one, and how far behind the track runs', async () => {
    await onRun([DINNER, SPEECHES, CAKE]);
    const main = screen.getByRole('table', { name: 'Main' });
    const rows = within(main).getAllByRole('row').slice(1);

    expect(rows[0]?.textContent).toContain('started 18:58');
    expect(rows[1]?.textContent).toContain('19:55');
    expect(rows[1]?.textContent).toContain('about 20:13');
    expect(rows[2]?.textContent).toContain('about 20:43');
    expect(screen.getByText('Main, 18 minutes behind')).toBeDefined();
    expect(screen.getByText('18 min behind')).toBeDefined();
    expect(
      screen.getByText('Next: Speeches at about 20:13. Next step: start it when it begins.'),
    ).toBeDefined();
  });

  it('holds a fixed-time item at its planned time and says in words what would run into it', async () => {
    await onRun([DINNER, SPEECHES, CAKE, FIREWORKS]);

    expect(screen.getByText('Cake cutting would run into Fireworks at 20:45')).toBeDefined();
    const rows = within(screen.getByRole('table', { name: 'Main' })).getAllByRole('row');
    expect(rows[4]?.textContent).not.toContain('about');
    expect(rows[4]?.textContent).toContain('Fixed time');
  });

  it('reads on time with no second time before anything starts', async () => {
    await onRun([{ ...SPEECHES, startsAt: '2030-11-15T21:00:00+00:00' }]);

    expect(screen.getByText('Main, on time')).toBeDefined();
    expect(screen.getByRole('table', { name: 'Main' }).textContent).not.toContain('about');
  });

  it('marks an item started and shows the schedule the API answers', async () => {
    const started = { ...SPEECHES, startedAt: '2030-11-15T19:20:00+00:00' };
    const sent = await onRun([DINNER, SPEECHES], OWNER_PERMISSIONS, {
      'POST /api/events/ev_1/schedule/items/it_speeches/presses': () =>
        json({ schedule: schedule([DINNER, started]), itemId: 'it_speeches' }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start Speeches' }));

    expect(await screen.findByRole('button', { name: 'Finish Speeches' })).toBeDefined();
    expect(sent).toContain('POST /api/events/ev_1/schedule/items/it_speeches/presses');
    expect(screen.getByText('Main, last item under way')).toBeDefined();
  });

  it('reads the schedule again and says what the API said when the item was already started', async () => {
    const started = { ...SPEECHES, startedAt: '2030-11-15T19:20:00+00:00' };
    let marked = false;
    await onRun([DINNER, SPEECHES], OWNER_PERMISSIONS, {
      'POST /api/events/ev_1/schedule/items/it_speeches/presses': () => {
        marked = true;

        return new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/item_started',
            title: 'This item has already started.',
            status: 409,
          }),
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        );
      },
      'GET /api/events/ev_1/schedule': () =>
        json({ schedule: schedule(marked ? [DINNER, started] : [DINNER, SPEECHES]) }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start Speeches' }));

    expect(await screen.findByRole('button', { name: 'Finish Speeches' })).toBeDefined();
    expect(screen.getByText('This item has already started.')).toBeDefined();
  });

  it('gives no Start or Finish to somebody who can only read the schedule', async () => {
    await onRun([DINNER, SPEECHES], ['run_of_show.read', 'events.read']);

    expect(screen.queryByRole('button', { name: /^Start / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Finish / })).toBeNull();
    expect(
      screen.getByText('You can see this schedule. Ask whoever runs the event to change it.'),
    ).toBeDefined();
    expect(screen.getByText('Next: Speeches at about 20:13.')).toBeDefined();
  });

  it('ends its crumb row with the one bell at a desk (sc-39509)', async () => {
    await onRun([DINNER, SPEECHES]);

    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it("starts where the event's other pages do at a desk, inside the card's one padding", async () => {
    await onRun([DINNER, SPEECHES]);

    const main = screen.getByRole('table', { name: 'Main' });
    expect(main.closest('.shell-content .ev-page.desk-page')).not.toBeNull();
  });

  it("is no wider than the event's other pages at a wide desk (sc-58278)", async () => {
    await onRun([DINNER, SPEECHES]);

    const main = screen.getByRole('table', { name: 'Main' });
    expect(main.closest('.ev .ev-wide')).not.toBeNull();
    expect(cssRule('.ev-column,\n.ev-wide', EVENTS_DESK_CSS)).toContain(
      'max-width: var(--evWide);',
    );
    expect(cssRule('.ev', EVENTS_DESK_CSS)).toContain('--evWide: 938px;');
  });

  it('goes back up to the Schedule from the breadcrumb', async () => {
    await onRun([DINNER, SPEECHES]);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });

    expect(within(crumbs).getByRole('link', { name: 'Schedule' }).getAttribute('href')).toBe(
      '/app/events/ev_1/schedule',
    );
  });
});
