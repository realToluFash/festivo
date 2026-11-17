import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-15T17:00:00+00:00',
  endsAt: '2030-11-16T03:00:00+00:00',
  timeZone: 'Europe/London',
  dayCount: 1,
  currency: 'GBP',
  cover: null,
  venue: null,
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'happening_now',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

const KEPT = 'soirely.nightPresses.ev_1';
const PRESS_SPEECHES = 'POST /api/events/ev_1/schedule/items/it_speeches/presses';
const PRESS_DANCE = 'POST /api/events/ev_1/schedule/items/it_dance/presses';

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

let clock = '20:02';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ETag: '"1"',
      'Content-Type': 'application/json',
      Date: new Date(`2030-11-15T${clock}:00Z`).toUTCString(),
    },
  });
}

const at = (time: string) => `2030-11-15T${time}:00+00:00`;

function item(id: string, title: string, time: string, more: Record<string, unknown> = {}) {
  return {
    id,
    title,
    startsAt: at(time),
    startedAt: null,
    endedAt: null,
    skipped: false,
    day: '2030-11-15',
    lengthMinutes: null,
    place: 'Ballroom',
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
    earliest: '2030-11-15T05:00:00+00:00',
    latest: '2030-11-16T03:00:00+00:00',
    itemsMaximum: 200,
    items,
  };
}

const ARRIVE = item('it_arrive', 'Guests arrive', '18:00', {
  lengthMinutes: 30,
  startedAt: at('18:02'),
  endedAt: at('18:31'),
});
const DINNER = item('it_dinner', 'Dinner is served', '18:30', {
  lengthMinutes: 75,
  startedAt: at('18:33'),
  endedAt: at('19:48'),
});
const SPEECHES = item('it_speeches', 'Speeches', '19:45', {
  lengthMinutes: 40,
  ownerName: 'Ifeoma Nduka',
  startedAt: at('19:50'),
});
const SPOKEN = { ...SPEECHES, endedAt: at('20:28') };
const DANCE = item('it_dance', 'First dance', '20:30', { lengthMinutes: 15 });
const CAKE = item('it_cake', 'Cake cutting', '20:45', {
  lengthMinutes: 20,
  ownerName: 'Ada Nnaji',
});
const NIGHT = [ARRIVE, DINNER, SPEECHES, DANCE, CAKE];
const GAP = [ARRIVE, DINNER, SPOKEN, DANCE, CAKE];

interface Sent {
  line: string;
  key: string | null;
  body: unknown;
}

type Answer = (init?: RequestInit) => Response | Promise<Response>;

async function onNight(
  items: unknown[],
  {
    permissions = OWNER_PERMISSIONS,
    answers = {},
    now = '20:02',
    phase = 'happening_now',
    url = '/app/events/ev_1/schedule',
  }: {
    permissions?: string[];
    answers?: Record<string, Answer>;
    now?: string;
    phase?: string;
    url?: string;
  } = {},
): Promise<Sent[]> {
  const sent: Sent[] = [];
  clock = now;
  signedIn();

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({
      line,
      key: new Headers(init?.headers).get('Idempotency-Key'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });

    const answer = answers[line];
    if (answer != null) return answer(init);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, phase, permissions } });
    if (line === 'GET /api/events/ev_1/schedule') return json({ schedule: schedule(items) });

    return json({});
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [url] })} />);
  await screen.findByRole('heading', { level: 1 });

  return sent;
}

function answered(items: unknown[]): Answer {
  return () => json({ schedule: schedule(items), itemId: 'it' });
}

function refused(code: string, more: Record<string, unknown> = {}): Answer {
  return () =>
    new Response(
      JSON.stringify({
        type: `https://soirely.com/errors/${code}`,
        title: code,
        status: 409,
        ...more,
      }),
      { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
    );
}

function kept(): { key: string; kind: string; pressedAt: string }[] {
  return JSON.parse(localStorage.getItem(KEPT) ?? '[]') as {
    key: string;
    kind: string;
    pressedAt: string;
  }[];
}

const liveRegion = () => document.querySelector('.mn-page > [aria-live="polite"]');

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Run of show on the night (sc-3895)', () => {
  it('shows Now, Next and Later for the track, on the 24-hour clock', async () => {
    await onNight(NIGHT);

    const now = await screen.findByRole('region', { name: 'Now' });
    expect(within(now).getByText('Now · since 19:50')).toBeDefined();
    expect(within(now).getByRole('heading', { name: 'Speeches' })).toBeDefined();
    expect(within(now).getByText('Ifeoma Nduka · Ballroom')).toBeDefined();
    expect(within(now).getByText('12 min')).toBeDefined();
    expect(within(now).getByText('Lasts 40 min')).toBeDefined();
    expect(within(now).getByRole('button', { name: 'Done: Speeches' })).toBeDefined();
    expect(within(now).getByRole('button', { name: 'Skip: Speeches' })).toBeDefined();

    const next = screen.getByRole('region', { name: 'Next' });
    expect(within(next).getByRole('heading', { name: 'First dance' })).toBeDefined();
    expect(within(next).getByText('No owner · Lasts 15 min')).toBeDefined();
    expect(within(next).getByText('Finish the current item first')).toBeDefined();
    expect(within(next).queryByRole('button')).toBeNull();

    const later = screen.getByRole('region', { name: 'Later' });
    expect(within(later).getByText('Times are expected, not planned')).toBeDefined();
    expect(within(later).getByRole('button', { name: /Cake cutting/ }).textContent).toContain(
      'Not started · 20:45',
    );
    expect(screen.getByText('On time')).toBeDefined();
    expect(screen.getByText('2 of 5 done · ends about 21:05')).toBeDefined();
    expect(screen.getByText('Ballroom')).toBeDefined();
    expect(screen.getByText('Live · updated just now')).toBeDefined();
  });

  it('says how far over the item that is on runs, in words', async () => {
    await onNight(NIGHT, { now: '20:34' });

    expect(await screen.findByText('+4 min over')).toBeDefined();
  });

  it('sends Done with an Idempotency-Key, saved before the screen changes, and announces it', async () => {
    const sent = await onNight(NIGHT, { answers: { [PRESS_SPEECHES]: answered(GAP) } });

    fireEvent.click(await screen.findByRole('button', { name: 'Done: Speeches' }));

    expect(await screen.findByRole('button', { name: 'Start now: First dance' })).toBeDefined();
    const press = sent.find((one) => one.line === PRESS_SPEECHES);
    expect(press?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(press?.body).toEqual({
      kind: 'done',
      pressedAt: expect.stringMatching(/^2030-11-15T20:02:00\.\d{3}Z$/),
    });
    expect(screen.getByText('Nothing is on')).toBeDefined();
    expect(screen.getByText('Speeches finished at 20:28.')).toBeDefined();
    expect(liveRegion()?.textContent).toBe('Speeches done. Next: First dance.');
    await waitFor(() => expect(kept()).toEqual([]));
  });

  it('starts the Next item with Start now once nothing is on', async () => {
    const started = { ...DANCE, startedAt: at('20:29') };
    const sent = await onNight(GAP, {
      now: '20:29',
      answers: { [PRESS_DANCE]: answered([ARRIVE, DINNER, SPOKEN, started, CAKE]) },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Start now: First dance' }));

    expect(await screen.findByRole('button', { name: 'Done: First dance' })).toBeDefined();
    expect(sent.find((one) => one.line === PRESS_DANCE)?.body).toMatchObject({ kind: 'start' });
    expect(liveRegion()?.textContent).toBe('First dance started.');
  });

  it('docks a chosen Later row with Start now, Skip and Move, and Move offers Leave it', async () => {
    await onNight(GAP, { now: '20:29' });

    fireEvent.click(await screen.findByRole('button', { name: /Cake cutting/ }));
    const panel = screen.getByRole('complementary', { name: 'Cake cutting' });

    expect(within(panel).getByText('20:45 · Ada Nnaji · Lasts 20 min')).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Start now: Cake cutting' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Skip: Cake cutting' })).toBeDefined();
    fireEvent.click(within(panel).getByRole('button', { name: 'Move: Cake cutting' }));
    expect(within(panel).getByRole('heading', { name: 'Move: Cake cutting' })).toBeDefined();
    fireEvent.click(within(panel).getByRole('button', { name: 'Leave it' }));
    expect(within(panel).getByRole('button', { name: 'Skip: Cake cutting' })).toBeDefined();
  });

  it('asks to finish the current item first on a chosen row while something is on', async () => {
    await onNight(NIGHT);

    fireEvent.click(await screen.findByRole('button', { name: /Cake cutting/ }));
    const panel = screen.getByRole('complementary', { name: 'Cake cutting' });

    expect(within(panel).getByText('Finish the current item first')).toBeDefined();
    expect(within(panel).queryByRole('button', { name: /^Start now/ })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Skip: Cake cutting' })).toBeDefined();
  });

  it('skips a Later item and reads it out', async () => {
    const sent = await onNight(NIGHT, {
      answers: {
        'POST /api/events/ev_1/schedule/items/it_cake/presses': answered([
          ARRIVE,
          DINNER,
          SPEECHES,
          DANCE,
          { ...CAKE, skipped: true },
        ]),
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Cake cutting/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip: Cake cutting' }));

    await waitFor(() => expect(screen.getByText('Skipped')).toBeDefined());
    expect(
      sent.find((one) => one.line === 'POST /api/events/ev_1/schedule/items/it_cake/presses')?.body,
    ).toMatchObject({ kind: 'skip' });
    expect(liveRegion()?.textContent).toBe('Cake cutting skipped.');
  });

  it('gives somebody who can only read the night no buttons', async () => {
    await onNight(NIGHT, { permissions: ['run_of_show.read', 'events.read'] });

    expect(await screen.findByText('View only')).toBeDefined();
    expect(
      screen.getByText('You can follow the run of show here, but not change it.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^(Done|Skip|Start now|Move):/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cake cutting/ })).toBeNull();
    expect(screen.getByText('Cake cutting')).toBeDefined();
  });

  it('keeps a press made offline, counts it, and sends it with the same key on Try now', async () => {
    let online = false;
    await onNight(NIGHT, {
      answers: {
        [PRESS_SPEECHES]: () => {
          if (!online) throw new TypeError('Failed to fetch');
          return json({ schedule: schedule(GAP) });
        },
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Done: Speeches' }));

    expect(await screen.findByText('Reconnecting · 1 min old')).toBeDefined();
    expect(screen.getByText('1 press waiting to send.')).toBeDefined();
    expect(screen.getByText('Nothing is on')).toBeDefined();
    const [press] = kept();
    expect(press?.kind).toBe('done');

    online = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try now' }));

    expect(await screen.findByText('Live · updated just now')).toBeDefined();
    expect(liveRegion()?.textContent).toBe('Connected. Presses sent.');
    expect(kept()).toEqual([]);
  });

  it('shows and sends what was pressed before the page was closed', async () => {
    localStorage.setItem(
      KEPT,
      JSON.stringify([
        {
          eventId: 'ev_1',
          itemId: 'it_speeches',
          kind: 'done',
          title: 'Speeches',
          key: 'k-1',
          pressedAt: '2030-11-15T20:01:00+00:00',
        },
      ]),
    );
    const sent = await onNight(NIGHT, {
      answers: {
        [PRESS_SPEECHES]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });

    expect(await screen.findByText('1 press waiting to send.')).toBeDefined();
    expect(screen.getByText('Nothing is on')).toBeDefined();
    expect(sent.find((one) => one.line === PRESS_SPEECHES)?.key).toBe('k-1');
  });

  it('drops a losing replay from the queue and says who started it first', async () => {
    const theirs = [ARRIVE, DINNER, SPOKEN, { ...DANCE, startedAt: at('20:31') }, CAKE];
    let lost = false;
    await onNight(GAP, {
      now: '20:33',
      answers: {
        [PRESS_DANCE]: (init) => {
          lost = true;
          return refused('item_started', {
            superseded_by: { name: 'Ifeoma Nduka', at: at('20:31') },
          })(init);
        },
        'GET /api/events/ev_1/schedule': () => json({ schedule: schedule(lost ? theirs : GAP) }),
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Start now: First dance' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('First dance')).toBeDefined();
    expect(within(alert).getByText('Already started by Ifeoma Nduka at 20:31.')).toBeDefined();
    expect(kept()).toEqual([]);
    expect(await screen.findByRole('button', { name: 'Done: First dance' })).toBeDefined();
    fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the refusal’s own title for a losing replay that names nobody', async () => {
    await onNight(NIGHT, {
      now: '20:20',
      answers: {
        [PRESS_SPEECHES]: refused('item_not_started', {
          title: 'This item has not started yet, so it cannot be done.',
        }),
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Done: Speeches' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Speeches')).toBeDefined();
    expect(
      within(alert).getByText('This item has not started yet, so it cannot be done.'),
    ).toBeDefined();
    expect(kept()).toEqual([]);
  });

  describe('the end of the night', () => {
    const last = (ended: string) => [{ ...ARRIVE, startedAt: at('18:02'), endedAt: at(ended) }];

    it('reads behind plan with the line it was worked out from, and links to End now', async () => {
      await onNight(last('18:42'), { now: '19:00' });

      expect(await screen.findByText('That’s everything.')).toBeDefined();
      expect(screen.getByText('Finished 12 min behind plan.')).toBeDefined();
      expect(
        screen.getByText('Last item finished at 18:42, planned to finish at 18:30.'),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'End now' }).getAttribute('href')).toBe(
        '/app/events/ev_1',
      );
    });

    it('reads ahead of plan and on plan', async () => {
      await onNight(last('18:24'), { now: '19:00' });
      expect(await screen.findByText('Finished 6 min ahead of plan.')).toBeDefined();
    });

    it('reads on plan', async () => {
      await onNight(last('18:30'), { now: '19:00' });
      expect(await screen.findByText('Finished on plan.')).toBeDefined();
    });

    it('has no End now without events.manage', async () => {
      await onNight(last('18:42'), {
        now: '19:00',
        permissions: OWNER_PERMISSIONS.filter((one) => one !== 'events.manage'),
      });

      expect(await screen.findByText('Finished 12 min behind plan.')).toBeDefined();
      expect(screen.queryByRole('link', { name: 'End now' })).toBeNull();
    });

    it('gives a track whose items were all skipped the tick and the heading alone, End now kept', async () => {
      await onNight([{ ...ARRIVE, startedAt: null, endedAt: null, skipped: true }], {
        now: '19:00',
      });

      expect(await screen.findByText('That’s everything.')).toBeDefined();
      expect(screen.queryByText(/^Finished/)).toBeNull();
      expect(screen.queryByText(/^Last item finished/)).toBeNull();
      expect(screen.getByRole('link', { name: 'End now' })).toBeDefined();
    });

    it('has no End now while another track is still running', async () => {
      const foyer = item('it_bar', 'Late bar', '18:10', {
        place: 'Foyer',
        lengthMinutes: 60,
        startedAt: at('18:10'),
      });
      await onNight([...last('18:42'), foyer], { now: '19:00' });

      expect(await screen.findByText('Finished 12 min behind plan.')).toBeDefined();
      expect(screen.queryByRole('link', { name: 'End now' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Track: Ballroom' })).toBeDefined();
    });
  });

  it('opens on the track Today followed, named by ?track= (sc-61017)', async () => {
    const foyer = item('it_bar', 'Late bar', '19:30', {
      place: 'Foyer',
      lengthMinutes: 60,
      startedAt: at('19:30'),
    });
    await onNight([...NIGHT, foyer], {
      url: `/app/events/ev_1/schedule?${new URLSearchParams({ track: '2030-11-15|Foyer' }).toString()}`,
    });

    expect(await screen.findByRole('button', { name: 'Track: Foyer' })).toBeDefined();
    const now = screen.getByRole('region', { name: 'Now' });
    expect(within(now).getByRole('heading', { name: 'Late bar' })).toBeDefined();
  });

  it('says a day with nothing on it has nothing planned, and links to the Schedule', async () => {
    await onNight([{ ...DANCE, startsAt: '2030-11-17T20:30:00+00:00', day: '2030-11-17' }]);

    expect(await screen.findByText('Nothing is planned for today.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open the schedule' }).getAttribute('href')).toBe(
      '/app/events/ev_1/schedule?view=schedule',
    );
  });

  describe('the switch in the header bar', () => {
    it('shows Run of show at the Schedule’s address while the event is happening', async () => {
      await onNight(NIGHT);

      const switcher = screen.getByRole('navigation', { name: 'Schedule or run of show' });
      expect(within(switcher).getByText('Run of show').getAttribute('aria-current')).toBe('page');
      expect(within(switcher).getByRole('link', { name: 'Schedule' }).getAttribute('href')).toBe(
        '/app/events/ev_1/schedule?view=schedule',
      );
    });

    it('opens the Schedule from it, with Run of show to go back to', async () => {
      await onNight(NIGHT, { url: '/app/events/ev_1/schedule?view=schedule' });

      const switcher = await screen.findByRole('navigation', { name: 'Schedule or run of show' });
      expect(within(switcher).getByText('Schedule').getAttribute('aria-current')).toBe('page');
      expect(within(switcher).getByRole('link', { name: 'Run of show' }).getAttribute('href')).toBe(
        '/app/events/ev_1/schedule',
      );
      expect(screen.queryByRole('region', { name: 'Now' })).toBeNull();
    });

    it('is not there, and the Schedule is, before the event is happening', async () => {
      await onNight(NIGHT, { phase: 'live', now: '16:00' });

      expect(screen.queryByRole('navigation', { name: 'Schedule or run of show' })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Now' })).toBeNull();
    });
  });
});
