import type { FloorRead, ServiceGuestRead, ServiceTableRead } from '@soirely/domain';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { tokens } from '../../tokens.ts';
import { routes } from '../index.tsx';

const NO_FLAGS = { allergens: [], allergenOther: null, diet: [], dietOther: null };

function guest(
  id: string,
  seat: number,
  name: string,
  stage: 'served' | 'toServe',
  held = false,
): ServiceGuestRead {
  return {
    id,
    seat,
    name,
    flags: NO_FLAGS,
    noOrder: null,
    order: {
      id: `plate-${id}`,
      guestId: id,
      courseId: 'main',
      isOrder: true,
      stage,
      items: [{ key: 'curry', name: 'Goat curry', state: 'preparing' }],
      trayId: null,
      owedReason: null,
      sentBack: [],
      held,
      holding: held ? ['curry'] : [],
      choice: null,
      owed: [],
    },
  };
}

function table(name: string, section: string, guests: ServiceGuestRead[]): ServiceTableRead {
  return {
    key: name,
    kind: 'table',
    name,
    seats: [],
    section: { id: section, name: `Section ${section}` },
    people: [{ id: 'staff', name: 'Bisi Lawal' }],
    firedAt: '2026-11-27T19:00:00Z',
    guests,
  };
}

const FLOOR: FloorRead = {
  event: 'Adaeze & Tunde',
  yours: [{ id: 'B', name: 'Section B' }],
  floorLead: 'Ifeoma Nduka',
  manage: false,
  courses: [
    {
      phase: 'on',
      course: { id: 'main', name: 'Main' },
      items: [{ key: 'curry', name: 'Goat curry', state: 'preparing', readyIn: 4 }],
      trays: [],
      tables: [
        table('Table 10', 'B', [guest('a', 1, 'Ada Obi', 'served')]),
        table('Table 2', 'B', [guest('k', 1, 'Kemi Oke', 'toServe', true)]),
        table('Table 3', 'C', [guest('t', 1, 'Tunde Ade', 'served')]),
      ],
    },
  ],
};

const hub = vi.hoisted(() => ({
  message: (_data: unknown) => {},
  gap: () => {},
}));

vi.mock('../app/events/useHubTopics.ts', () => ({
  useHubTopics: (
    _topics: unknown,
    _subscribe: unknown,
    onMessage: (data: unknown) => void,
    onGap: () => void,
  ) => {
    hub.message = onMessage;
    hub.gap = onGap;
  },
}));

const heartbeat = () => act(() => hub.message({ type: 'heartbeat' }));

const ME = {
  userId: 'u_bisi',
  name: 'Bisi Lawal',
  email: '',
  verified: true,
  complete: true,
  awaiting: null,
  providers: [],
  hasPassword: false,
  needsOrganisation: false,
  organisation: null,
  organisationCountry: null,
  organisations: [],
  timezone: null,
  waitingFor: null,
};

let sent: string[] = [];
let now: FloorRead = FLOOR;
let refusal: object | null = null;

function twoCourses(): FloorRead {
  const floor = structuredClone(FLOOR);
  const mains = floor.courses[0]!;
  const starter = structuredClone(mains);
  starter.course = { id: 'starter', name: 'Starter' };
  const kemi = starter.tables[1]!.guests[0]!;
  kemi.order = {
    ...kemi.order!,
    id: 'starter-k',
    courseId: 'starter',
    stage: 'served',
    held: false,
    holding: [],
    owed: [
      {
        ...kemi.order!,
        id: 'owed-k',
        courseId: 'starter',
        isOrder: false,
        stage: 'onItsWay',
        items: [{ key: 'soup', name: 'Pepper soup', state: 'ready' }],
        trayId: 't1',
        owedReason: 'sentBack',
        sentBack: [{ reason: 'wrongDish', at: '2026-11-27T19:10:00Z', by: null }],
      },
    ],
  };
  starter.trays = [
    {
      id: 't1',
      courseId: 'starter',
      table: 'Table 2',
      waiter: { id: 'staff', name: 'Bisi Lawal' },
      plates: ['owed-k'],
      done: false,
    },
  ];
  mains.tables[1]!.guests[0]!.flags = { ...NO_FLAGS, allergens: ['peanuts'] };
  floor.courses = [starter, mains];

  return floor;
}

function open(floor: FloorRead = FLOOR, status = 200, address = '/floor/e1') {
  now = floor;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (init?.method === 'PUT' || init?.method === 'POST')
      sent.push(`${path} ${String(init.body ?? '')}`);

    if (refusal != null && init?.method !== undefined && init.method !== 'GET')
      return new Response(JSON.stringify(refusal), {
        status: 409,
        headers: { 'Content-Type': 'application/problem+json' },
      });

    return new Response(JSON.stringify(path.endsWith('/service/floor') ? now : {}), {
      status: path.endsWith('/service/floor') ? status : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const router = createMemoryRouter(routes, { initialEntries: [address] });
  render(<RouterProvider router={router} />);

  return router;
}

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('Floor in the browser (sc-4021)', () => {
  beforeEach(() => {
    sent = [];
    refusal = null;
    tokens.clear();
    localStorage.clear();
    __setSessionState({ status: 'signedIn', session: ME });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lists yours first, Table 2 before Table 10, each row one button read in full', async () => {
    open();

    await screen.findByRole('heading', { name: 'Yours · Section B' });
    expect(
      screen
        .getAllByRole('button', { name: /^Table / })
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual([
      'Table 2, Waiting on the kitchen, 0 of 1 served, 1 cover',
      'Table 10, Served, 1 of 1 served, 1 cover',
      'Table 3, Served, 1 of 1 served, 1 cover, Section C',
    ]);
  });

  it('asks for a sign-in, and reads nothing, with nobody signed in', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    open();

    expect(await screen.findByRole('link', { name: 'Enter a door code' })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says what is refused on a 403, with nothing to try again', async () => {
    open(FLOOR, 403);

    expect(await screen.findByText('Floor opens with Can work the floor')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers to try again when the read fails', async () => {
    open(FLOOR, 500);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('heads the list with the event and the room’s course', async () => {
    open();

    expect(await screen.findByText('Adaeze & Tunde · Main')).toBeTruthy();
  });

  it('opened from Your night, its way back reads Your night and returns to the shift page, still signed in (sc-98893)', async () => {
    const router = open(FLOOR, 200, '/floor/e1?from=night');

    const back = await screen.findByRole('link', { name: 'Your night' });
    expect(back.getAttribute('href')).toBe('/night/e1');
    fireEvent.click(back);
    await waitFor(() => expect(router.state.location.pathname).toBe('/night/e1'));
    expect(screen.queryByRole('link', { name: 'Enter a door code' })).toBeNull();
  });

  it('has no way back to Your night when opened some other way', async () => {
    open();

    await screen.findByText('Adaeze & Tunde · Main');
    expect(screen.queryByRole('link', { name: 'Your night' })).toBeNull();
  });

  it('marks a held guest’s choice, and offers no What’s ready with nothing ready', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));

    expect(screen.queryByRole('button', { name: 'What’s ready, now' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Wait for all' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('keeps a sent-back plate with its reason until it can send, once a reason is chosen', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 10,/ }));
    press('Send back');

    const sheet = screen.getByRole('dialog');
    const send = within(sheet).getByRole('button', { name: 'Send back' });
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(within(sheet).getByRole('radio', { name: /Dropped/ }));
    fireEvent.click(send);

    // No hub in this test, so the strip has no connection and the tap waits (sc-4028).
    await screen.findAllByText('Waiting to send');
    await waitFor(() => expect(JSON.stringify({ ...localStorage })).toContain('dropped'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('writes an unnamed dish in sentence case only inside a sentence', async () => {
    const floor = structuredClone(FLOOR);
    for (const one of floor.courses[0]!.tables.flatMap((t) => t.guests)) {
      for (const item of one.order?.items ?? []) item.name = null;
      one.order?.items.unshift({ key: 'rice', name: 'Jollof rice', state: 'ready' });
    }
    open(floor);
    fireEvent.click(await screen.findByRole('button', { name: /^Table 10,/ }));
    expect(screen.getAllByText(/Jollof rice, Chef’s choice/).length).toBeGreaterThan(0);
    press('Send back');

    const sheet = screen.getByRole('dialog');
    expect(
      within(sheet).getByRole('heading', { name: /Jollof rice and chef’s choice/ }).textContent,
    ).not.toContain('Chef’s');
    fireEvent.click(within(sheet).getByRole('radio', { name: /Dropped/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send back' }));

    expect(
      (await screen.findAllByText('Sent back: Ada Obi’s Jollof rice and chef’s choice · Dropped'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('draws no action at a table the person may not write at', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 3,/ }));

    expect(screen.getByRole('heading', { name: 'Table 3' })).toBeTruthy();
    expect(screen.getByText('On it · Section C · Bisi Lawal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send back' })).toBeNull();
  });

  it('reads a table in order, its held guest and a plate owed from an earlier course', async () => {
    open(twoCourses());
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));

    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Table 2',
      'Flagged guests',
      'Trays',
      'Seats',
    ]);
    expect(screen.getByText('Bisi Lawal · 1 plate · On its way')).toBeTruthy();
    expect(screen.getByText('Goat curry · Ready in about 4 min')).toBeTruthy();
    expect(screen.getByText('Starter · Sent back · Wrong dish · Pepper soup')).toBeTruthy();
    expect(screen.getByText('On it · Section B · Bisi Lawal')).toBeTruthy();
  });

  it('marks a choice as made and then changed, each waiting to send', async () => {
    const floor = structuredClone(FLOOR);
    floor.courses[0]!.tables[1]!.guests[0]!.order!.items.push({
      key: 'rice',
      name: 'Rice',
      state: 'ready',
    });
    open(floor);
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));
    const pressed = (name: string) =>
      screen.getByRole('button', { name }).getAttribute('aria-pressed');

    press('What’s ready, now');
    await waitFor(() => expect(pressed('What’s ready, now')).toBe('true'));
    press('Wait for all');
    await waitFor(() => expect(pressed('Wait for all')).toBe('true'));

    expect(pressed('What’s ready, now')).toBe('false');
    expect(screen.getAllByText('Waiting to send').length).toBeGreaterThan(0);
  });

  it.each([
    ['Wrong dish', 'wrongDish'],
    ['Not right', 'notRight'],
    ['Dropped', 'dropped'],
    ['Allergy concern', 'allergyConcern'],
  ])('sends back for %s, and the owed plate shows at once', async (words, reason) => {
    open();
    await screen.findByRole('button', { name: /^Table 10,/ });
    heartbeat();
    fireEvent.click(screen.getByRole('button', { name: /^Table 10,/ }));
    press('Send back');
    const sheet = screen.getByRole('dialog');

    expect(within(sheet).getByText('Also alerts the floor lead, Ifeoma Nduka.')).toBeTruthy();
    expect(sent).toEqual([]);
    fireEvent.click(within(sheet).getByRole('radio', { name: new RegExp(`^${words}`) }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send back' }));

    await waitFor(() => expect(sent.join()).toContain(`"reason":"${reason}"`));
  });

  it('offers Undo for 2 minutes, naming the step', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 27, 19, 5));
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));
    press('Wait for all');

    expect(await screen.findByText('Undo until 19:07')).toBeTruthy();
    expect(screen.getAllByText('Kemi Oke: Wait for all').length).toBeGreaterThan(0);
    await act(async () => {});
    act(() => void vi.advanceTimersByTime(119_000));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2_000));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('takes an owed plate away at once on an offline Undo of a sent send-back', async () => {
    open();
    await screen.findByRole('button', { name: /^Table 10,/ });
    heartbeat();
    fireEvent.click(screen.getByRole('button', { name: /^Table 10,/ }));
    press('Send back');
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('radio', { name: /Dropped/ }));
    const floor = structuredClone(FLOOR);
    Object.assign(floor.courses[0]!.tables[0]!.guests[0]!.order!, {
      stage: 'toServe',
      owedReason: 'sentBack',
      sentBack: [{ reason: 'dropped', at: '2026-11-27T19:10:00Z', by: null }],
    });
    now = floor;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send back' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    act(() => hub.message({ type: 'patch' }));
    await screen.findByText(/Sent back · Dropped/);
    expect(screen.queryByText('Waiting to send')).toBeNull();

    act(() => void window.dispatchEvent(new Event('offline')));
    press('Undo');

    await screen.findByText(/1 tap waiting$/);
    expect(screen.queryByText(/Sent back · Dropped/)).toBeNull();
    expect(screen.getAllByText('Waiting to send')).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it('counts the kept taps on a 24-hour strip, then reads connected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 27, 19, 5));
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));
    press('Wait for all');

    expect(await screen.findByText('No connection · as of 19:05 · 1 tap waiting')).toBeTruthy();
    heartbeat();
    expect(screen.getByText('Connected · up to date at 19:05')).toBeTruthy();
  });

  it('draws a refused tap’s Not sent line, naming who, in the table in front', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));
    press('Wait for all');
    await screen.findAllByText('Waiting to send');
    refusal = {
      type: 'https://soirely.com/errors/service_changed',
      title: 'Changed',
      status: 409,
      changed: [
        {
          plateId: 'plate-k',
          guestId: 'k',
          table: 'Table 2',
          stage: 'served',
          onTray: true,
          by: 'Tomi',
        },
      ],
    };
    act(() => hub.gap());

    expect(await screen.findByText('Kemi Oke is now Served, marked by Tomi.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Table 2' })).toBeTruthy();
  });

  it('says a kept undo was too late', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));
    press('Wait for all');
    await screen.findAllByText('Waiting to send');
    refusal = { type: 'https://soirely.com/errors/undo_expired', title: 'Late', status: 409 };
    act(() => hub.gap());

    expect(await screen.findByText('Too late to undo: 2 minutes had passed.')).toBeTruthy();
  });

  it('draws a change from the hub, and a section moving away and one joining', async () => {
    open();
    await screen.findByRole('heading', { name: 'Yours · Section B' });

    now = { ...FLOOR, yours: [{ id: 'C', name: 'Section C' }] };
    act(() => hub.message({ type: 'patch' }));
    expect(await screen.findByRole('heading', { name: 'Yours · Section C' })).toBeTruthy();
    expect(screen.getByText('You’re on Section C now.')).toBeTruthy();

    now = {
      ...FLOOR,
      yours: [
        { id: 'B', name: 'Section B' },
        { id: 'C', name: 'Section C' },
      ],
    };
    act(() => hub.message({ type: 'patch' }));
    expect(await screen.findByText('You’re on Section B and Section C now.')).toBeTruthy();

    now = { ...FLOOR, yours: [] };
    act(() => hub.message({ type: 'patch' }));
    await screen.findByRole('heading', { name: 'Other tables' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Yours/ })).toBeNull());
    // Once on the page, and once more for a screen reader only.
    expect(
      screen.getAllByText('No tables yet. Ifeoma Nduka will put you on a section.'),
    ).toHaveLength(2);
  });

  it('names a block of single seats from its seats, after the tables', async () => {
    const floor = structuredClone(FLOOR);
    floor.courses[0]!.tables.unshift({
      ...table('block', 'B', [guest('s', 1, 'Sade Ojo', 'served')]),
      kind: 'block',
      name: null,
      seats: ['S1', 'S2'],
    });
    open(floor);
    await screen.findByRole('heading', { name: 'Yours · Section B' });

    expect(
      screen.getAllByRole('button', { name: /, \d+ covers?/ })[2]!.getAttribute('aria-label'),
    ).toBe('Seats S1 to S2, Served, 1 of 1 served, 1 cover');
  });

  it('shows a plate sent back under its guest, and Undo says what it saw', async () => {
    open();
    await screen.findByRole('button', { name: /^Table 10,/ });
    heartbeat();
    fireEvent.click(screen.getByRole('button', { name: /^Table 10,/ }));
    press('Send back');
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('radio', { name: /Not right/ }));
    const floor = structuredClone(FLOOR);
    Object.assign(floor.courses[0]!.tables[0]!.guests[0]!.order!, {
      stage: 'toServe',
      owedReason: 'sentBack',
      sentBack: [{ reason: 'notRight', at: '2026-11-27T19:10:00Z', by: null }],
    });
    now = floor;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send back' }));

    expect(await screen.findByText('Sent back · Not right · Goat curry')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toBe(
      '/api/events/e1/service/undo {"subject":"plate-a","expected":{"plates":{"plate-a":"toServe"}}}',
    );
  });

  it('reads an arrived seat Not fired yet before the first fire, beside one not here yet', async () => {
    const floor = structuredClone(FLOOR);
    const unfired = table('Table 4', 'B', [
      { ...guest('u', 1, 'Uche Obi', 'served'), order: null, noOrder: null },
      { ...guest('d', 2, 'Dayo Ola', 'served'), order: null, noOrder: 'notHereYet' },
    ]);
    floor.courses[0]!.tables.push({ ...unfired, firedAt: null });
    open(floor);
    fireEvent.click(await screen.findByRole('button', { name: /^Table 4,/ }));
    const seats = screen
      .getAllByRole('listitem')
      .map((seat) => seat.textContent)
      .join('|');

    expect(seats).toMatch(/Uche Obi.*Not fired yet.*\|.*Dayo Ola.*Not here yet/);
  });

  it('draws no tray step', async () => {
    open(twoCourses());
    fireEvent.click(await screen.findByRole('button', { name: /^Table 2,/ }));

    expect(
      screen.queryByRole('button', {
        name: /tray|On$|Not on|Check|Bring after|Take|All served|Pause|Carry on/i,
      }),
    ).toBeNull();
  });

  it('keeps no guest’s name in the browser', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Table 10,/ }));
    press('Send back');
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('radio', { name: /Dropped/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send back' }));
    await waitFor(() => expect(JSON.stringify({ ...localStorage })).toContain('dropped'));

    expect(JSON.stringify({ ...localStorage })).not.toContain('Ada Obi');
  });
});
