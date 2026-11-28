import { act, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from './routes/index.tsx';
import { __setSessionState } from './session.ts';
import { OWNER_PERMISSIONS, membership } from './test-memberships.ts';

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

const MENU = {
  menu: {
    courses: [
      {
        id: 'c_main',
        name: 'Main',
        servedAt: null,
        answer: 'choose',
        skippable: false,
        dishes: [],
        ownItems: [],
        items: [],
        picksClose: { at: '2030-11-15T18:00:00+00:00', source: 'start', closed: false },
      },
    ],
  },
};

/** 06:01 in London, the event's zone, as the API sends it. */
const PICKS = {
  picks: {
    updatedAt: '2030-11-10T06:01:00+00:00',
    room: 4,
    held: 0,
    answered: 0,
    percent: 0,
    allIn: false,
    courses: [],
    needsHost: null,
    waiting: null,
    people: null,
    parties: null,
    canChoose: false,
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

function openPicks(): { refresh: () => void } {
  __setSessionState({
    status: 'signedIn',
    session: {
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
    },
  });
  let apiUp = true;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/events/ev_1') return json({ event: EVENT });
    if (!apiUp) return json({}, 503);
    if (path === '/api/events/ev_1/menu') return json(MENU);
    if (path === '/api/events/ev_1/menu/picks') return json(PICKS);

    return json({});
  });
  const polls: (() => void)[] = [];
  const setInterval = window.setInterval.bind(window);
  vi.spyOn(window, 'setInterval').mockImplementation(((poll: () => void, ms?: number) => {
    polls.push(poll);

    return setInterval(() => {}, ms);
  }) as typeof window.setInterval);
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/menu/picks'] })}
    />,
  );

  return {
    refresh: () => {
      apiUp = false;
      act(() => polls.forEach((poll) => poll()));
    },
  };
}

/** One browser zone a file: a formatter keeps the zone it was made in, and the domain keeps one a locale. */
export function picksFreshInBrowser(zone: string, clock: string): void {
  describe(`See picks' freshness in a browser in ${zone}, for a London event (sc-89448)`, () => {
    const was = process.env.TZ;

    beforeAll(() => {
      process.env.TZ = zone;
    });

    afterAll(() => {
      if (was == null) delete process.env.TZ;
      else process.env.TZ = was;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('reads the live line in the browser’s time', async () => {
      openPicks();

      expect(
        await screen.findByText(`Updated at ${clock} · counts change as guests send their picks`),
      ).toBeDefined();
    });

    it('reads the stale line in the browser’s time once the API stops answering', async () => {
      const { refresh } = openPicks();
      await screen.findByText(/^Updated at/u);

      refresh();

      expect(
        await screen.findByText(`Not updated since ${clock}. Counts may be behind. Trying again.`),
      ).toBeDefined();
    });
  });
}
