import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setConfig, config } from '../../../config.ts';
import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { STYLES, cssRule, stylesheet } from '../../../test-styles.ts';

const SCHEDULE_CSS = stylesheet(import.meta.dirname, 'schedule.css');

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-15T18:00:00+00:00',
  endsAt: '2030-11-16T15:00:00+00:00',
  timeZone: 'Europe/London',
  dayCount: 2,
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
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number, more: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...more }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type Answer = (body: unknown, init?: RequestInit) => Response | Promise<Response>;

/** An item exactly as the API's contract writes one (sc-3893). */
function item(
  id: string,
  title: string,
  startsAt: string,
  day: string,
  more: Record<string, unknown> = {},
) {
  return {
    id,
    title,
    startsAt,
    startedAt: null,
    endedAt: null,
    skipped: false,
    day,
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

function schedule(items: unknown[], more: Record<string, unknown> = {}) {
  return {
    timeZone: 'Europe/London',
    earliest: '2030-11-15T06:00:00+00:00',
    latest: '2030-11-16T15:00:00+00:00',
    itemsMaximum: 200,
    items,
    ...more,
  };
}

const DRINKS = item('it_drinks', 'Welcome drinks', '2030-11-15T18:00:00+00:00', '2030-11-15', {
  lengthMinutes: 120,
  ownerName: 'Ebele Nwosu',
  ownerRole: 'Venue',
  showToGuests: true,
});
const PHOTOS = item('it_photos', 'Photos', '2030-11-15T19:00:00+00:00', '2030-11-15', {
  lengthMinutes: 60,
  place: 'Garden',
});
const LATE = item('it_late', 'Late food', '2030-11-16T00:30:00+00:00', '2030-11-15', {
  lengthMinutes: 30,
});
const BRUNCH = item('it_brunch', 'Brunch', '2030-11-16T11:00:00+00:00', '2030-11-16');

async function onSchedule(
  answers: Record<string, Answer>,
  permissions: string[] = OWNER_PERMISSIONS,
): Promise<{ line: string; body: unknown; ifMatch: string | null }[]> {
  const sent: { line: string; body: unknown; ifMatch: string | null }[] = [];
  signedIn();

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    const ifMatch = new Headers(init?.headers).get('If-Match');
    sent.push({ line, body, ifMatch });

    const answer = answers[line];
    if (answer != null) return answer(body, init);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/schedule'] })}
    />,
  );

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('The event’s Schedule (sc-3893)', () => {
  it('ends its crumb row with the one bell at a desk (sc-39509)', async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }),
    });

    await screen.findByRole('heading', { level: 1, name: /^Schedule · / });
    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it('answers a member without the schedule permission as a page that does not exist, under the crumb row and its one bell (sc-39509)', async () => {
    await onSchedule({}, ['events.read']);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page does not exist' }),
    ).toBeDefined();
    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it('shows a tab per event day and a table per place, sorted by start, with an item after midnight on the day before', async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () =>
        json({ schedule: schedule([LATE, PHOTOS, DRINKS, BRUNCH]) }),
    });

    const heading = await screen.findByRole('heading', { level: 1, name: /^Schedule · / });
    expect(heading).toBeDefined();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.textContent).toContain('3 items');
    expect(tabs[1]?.textContent).toContain('1 item');

    const main = screen.getByRole('table', { name: 'Main' });
    const rows = within(main).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Welcome drinks'),
      expect.stringContaining('Late food'),
    ]);
    expect(rows[1]?.textContent).toMatch(/00:30/);
    expect(
      within(main)
        .getAllByRole('columnheader')
        .map((one) => one.textContent),
    ).toEqual(['Starts', 'Lasts', 'Item', 'Owner']);
    expect(screen.getByRole('table', { name: 'Garden' })).toBeDefined();
    expect(main.textContent).toContain('18:00');
    expect(main.textContent).toContain('120 min');
    expect(main.textContent).toContain('Shown to guests');
  });

  it("sits inside the desk's button and field resets, and gives the narrow page its own padding", async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, BRUNCH]) }),
    });

    const tab = (await screen.findAllByRole('tab'))[0] as HTMLElement;
    expect(tab.closest('.desk.ev')).not.toBeNull();
    expect(
      cssRule('.ro.desk-page', SCHEDULE_CSS.slice(SCHEDULE_CSS.indexOf('(width <= 40rem)'))),
    ).toContain('padding: var(--spaceLg) var(--spaceMd) var(--space3xl);');
  });

  it("starts where the event's other pages do at a desk, the card's padding its only one", async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, BRUNCH]) }),
    });

    const tab = (await screen.findAllByRole('tab'))[0] as HTMLElement;
    expect(tab.closest('.shell-content .ev-page.desk-page')).not.toBeNull();
    expect(
      cssRule('.shell-content.is-card .desk-page', STYLES.slice(STYLES.indexOf('(width > 40rem)'))),
    ).toContain('padding: 0;');
  });

  it('moves between days with the arrow keys', async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, BRUNCH]) }),
    });
    const first = (await screen.findAllByRole('tab'))[0] as HTMLElement;
    fireEvent.keyDown(first, { key: 'ArrowRight' });

    await waitFor(() =>
      expect(screen.getAllByRole('tab')[1]?.getAttribute('aria-selected')).toBe('true'),
    );
    expect(screen.getByRole('table', { name: 'Main' }).textContent).toContain('Brunch');
  });

  it('says nothing is scheduled yet, with Add item', async () => {
    await onSchedule({ 'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([]) }) });

    expect(await screen.findByRole('heading', { name: 'Nothing scheduled yet' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Add item' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Run view' })).toBeNull();
  });

  it('opens the run view from its header once it holds an item, for a reader too (sc-1404)', async () => {
    await onSchedule(
      { 'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }) },
      OWNER_PERMISSIONS.filter((one) => one !== 'run_of_show.manage'),
    );

    const run = await screen.findByRole('link', { name: 'Run view' });
    expect(run.getAttribute('href')).toBe('/app/events/ev_1/run');
  });

  it('is read-only without run_of_show.manage', async () => {
    await onSchedule(
      { 'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }) },
      OWNER_PERMISSIONS.filter((one) => one !== 'run_of_show.manage'),
    );

    expect(
      await screen.findByText(
        'You can see this schedule. Ask whoever runs the event to change it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Welcome drinks' })).toBeNull();
    expect(screen.getByText('Welcome drinks')).toBeDefined();
  });

  it('is not found without run_of_show.read', async () => {
    const sent = await onSchedule(
      {},
      OWNER_PERMISSIONS.filter((one) => !one.startsWith('run_of_show.')),
    );

    await waitFor(() =>
      expect(sent.some(({ line }) => line === 'GET /api/events/ev_1')).toBe(true),
    );
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Schedule/ })).toBeNull());
    expect(sent.some(({ line }) => line === 'GET /api/events/ev_1/schedule')).toBe(false);
  });

  it('refuses a blank form beside each field, focus on the first, and sends nothing', async () => {
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-title'));
    expect(screen.getByText('Enter a title.')).toBeDefined();
    expect(screen.getByText('Choose the date and time it starts.')).toBeDefined();
    expect(sent.filter(({ line }) => line.startsWith('POST'))).toEqual([]);
  });

  it('refuses a start outside the window and a length over 720', async () => {
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fireworks' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-11-16' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '22:00' } });
    fireEvent.change(screen.getByLabelText(/Lasts, in minutes/), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-date'));
    expect(document.getElementById('ro-starts-error')?.textContent).toMatch(
      /^Choose a time between .* and .*\.$/,
    );
    expect(
      screen.getByText('Enter a length from 0 to 720 minutes, or leave it empty.'),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.startsWith('POST'))).toEqual([]);
  });

  it('counts a title’s letters as a reader sees them, and quotes them (sc-54292)', async () => {
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    const title = screen.getByLabelText('Title');

    fireEvent.change(title, { target: { value: 'e\u0323\u0300'.repeat(120) } });
    expect(screen.getByText('120 of 120')).toBeDefined();
    fireEvent.change(title, { target: { value: '👨‍👩‍👧 🇳🇬' } });
    expect(screen.getByText('3 of 120')).toBeDefined();

    fireEvent.change(title, { target: { value: 'e\u0323\u0300'.repeat(121) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    expect(
      await screen.findByText('That title is 121 characters. Use 120 or fewer.'),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.startsWith('POST'))).toEqual([]);
  });

  it('adds an item as the contract asks, and shows it', async () => {
    const added = item('it_new', 'Fireworks', '2030-11-15T23:00:00+00:00', '2030-11-15', {
      place: 'Garden',
      lengthMinutes: 15,
    });
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, PHOTOS]) }),
      'POST /api/events/ev_1/schedule/items': () =>
        json({ schedule: schedule([DRINKS, PHOTOS, added]), itemId: 'it_new' }, 201),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Fireworks ' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '23:00' } });
    fireEvent.change(screen.getByLabelText(/Lasts, in minutes/), { target: { value: '15' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Place/ }), {
      target: { value: 'garden' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    expect(await screen.findByText('Fireworks added.')).toBeDefined();
    expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/schedule/items')?.body).toEqual({
      title: 'Fireworks',
      startsAt: '2030-11-15T23:00',
      lengthMinutes: 15,
      place: 'Garden',
      ownerName: null,
      ownerRole: null,
      note: null,
      fixedTime: false,
      showToGuests: false,
    });
    expect(screen.getByRole('table', { name: 'Garden' }).textContent).toContain('Fireworks');
  });

  it('shows the API’s refusal beside its field', async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([]) }),
      'POST /api/events/ev_1/schedule/items': () =>
        problem('validation_failed', 422, {
          violations: [
            { propertyPath: 'startsAt', message: 'Choose a time between A and B.', code: 'x' },
          ],
        }),
    });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add item' }))[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Toast' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '20:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    expect(await screen.findByText('Choose a time between A and B.')).toBeDefined();
    await waitFor(() => expect(document.activeElement?.id).toBe('ro-date'));
  });

  it('refuses a 201st item before sending', async () => {
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () =>
        json({ schedule: schedule([DRINKS, PHOTOS], { itemsMaximum: 2 }) }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-limit'));
    expect(document.getElementById('ro-limit')?.textContent).toContain(
      'Delete one to add another. Nothing was saved.',
    );
    expect(sent.filter(({ line }) => line.startsWith('POST'))).toEqual([]);
  });

  it('saves with the version as If-Match, and on a 412 shows theirs beside yours', async () => {
    const theirs = { ...DRINKS, title: 'Drinks on the lawn', version: 2 };
    let puts = 0;
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }),
      'PUT /api/events/ev_1/schedule/items/it_drinks': () => {
        puts += 1;
        return puts === 1
          ? problem('precondition_failed', 412, { current: theirs, changedBy: 'Kemi' })
          : json({
              schedule: schedule([{ ...DRINKS, title: 'Cocktails', version: 3 }]),
              itemId: 'it_drinks',
            });
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Cocktails' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    const notice = await screen.findByRole('alert');
    await waitFor(() => expect(document.activeElement?.id).toBe('ro-conflict'));
    const diff = within(notice).getByRole('table');
    expect(within(diff).getAllByRole('row')[1]?.textContent).toBe(
      'TitleDrinks on the lawnCocktails',
    );
    expect(sent.find(({ line }) => line.startsWith('PUT'))?.ifMatch).toBe('"1"');

    fireEvent.click(within(notice).getByRole('button', { name: 'Keep mine' }));
    expect(await screen.findByText('Cocktails saved.')).toBeDefined();
    expect(sent.filter(({ line }) => line.startsWith('PUT')).at(-1)?.ifMatch).toBe('"2"');
  });

  it('Use theirs refills the form', async () => {
    const theirs = { ...DRINKS, title: 'Drinks on the lawn', version: 2 };
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }),
      'PUT /api/events/ev_1/schedule/items/it_drinks': () =>
        problem('precondition_failed', 412, { current: theirs, changedBy: null }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Cocktails' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use theirs' }));

    await waitFor(() =>
      expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Drinks on the lawn'),
    );
    expect(screen.queryByRole('button', { name: 'Use theirs' })).toBeNull();
  });

  it('asks before deleting, deletes, and Undo adds it back', async () => {
    const back = { ...DRINKS, id: 'it_back' };
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, PHOTOS]) }),
      'DELETE /api/events/ev_1/schedule/items/it_drinks': () =>
        json({ schedule: schedule([PHOTOS]) }),
      'POST /api/events/ev_1/schedule/items': () =>
        json({ schedule: schedule([back, PHOTOS]), itemId: 'it_back' }, 201),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete item…' }));
    expect(screen.getByText('Delete Welcome drinks?')).toBeDefined();
    await waitFor(() => expect(document.activeElement?.id).toBe('ro-keep'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

    expect(await screen.findByText('Welcome drinks deleted.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Welcome drinks' })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(await screen.findByText('Welcome drinks is back.')).toBeDefined();
    expect(sent.filter(({ line }) => line.startsWith('POST')).at(-1)?.body).toEqual({
      title: 'Welcome drinks',
      startsAt: '2030-11-15T18:00',
      lengthMinutes: 120,
      place: null,
      ownerName: 'Ebele Nwosu',
      ownerRole: 'Venue',
      note: null,
      fixedTime: false,
      showToGuests: true,
    });
  });

  it('on a 404, offers Add it again in place of Delete item…, and Add it again adds the form', async () => {
    const again = { ...DRINKS, id: 'it_again', title: 'Cocktails' };
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, PHOTOS]) }),
      'PUT /api/events/ev_1/schedule/items/it_drinks': () => problem('not_found', 404),
      'POST /api/events/ev_1/schedule/items': () =>
        json({ schedule: schedule([again, PHOTOS]), itemId: 'it_again' }, 201),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Cocktails' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-gone'));
    expect(document.getElementById('ro-gone')?.textContent).toBe(
      'Someone else deleted this item while you had it open. Nothing was saved.',
    );
    expect(screen.getByRole('heading', { name: 'Edit item' })).toBeDefined();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Cocktails');
    expect(screen.queryByRole('button', { name: 'Delete item…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save item' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add it again' }));

    expect(await screen.findByText('Cocktails added.')).toBeDefined();
    const posted = sent.filter(({ line }) => line === 'POST /api/events/ev_1/schedule/items');
    expect(posted).toHaveLength(1);
    expect(posted[0]?.body).toMatchObject({ title: 'Cocktails', startsAt: '2030-11-15T18:00' });
    expect(sent.filter(({ line }) => line.startsWith('PUT'))).toHaveLength(1);
  });

  it('Add it again is held to the 200 limit before sending', async () => {
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () =>
        json({ schedule: schedule([DRINKS, PHOTOS], { itemsMaximum: 2 }) }),
      'PUT /api/events/ev_1/schedule/items/it_drinks': () => problem('not_found', 404),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('ro-gone'));

    fireEvent.click(screen.getByRole('button', { name: 'Add it again' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-limit'));
    expect(
      sent.filter(({ line }) => line.startsWith('POST /api/events/ev_1/schedule/items')),
    ).toEqual([]);
  });

  it('says a failed save with the ✕ ring, keeps what was entered, and Save item retries', async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, PHOTOS]) }),
      'PUT /api/events/ev_1/schedule/items/it_drinks': () => problem('internal_error', 500),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Cocktails' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-failed'));
    const notice = document.getElementById('ro-failed');
    expect(notice?.textContent).toBe('Not saved. What you entered is still here. Try again.');
    expect(notice?.querySelector('.ro-ring')).not.toBeNull();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Cocktails');
    expect(screen.getByRole('button', { name: 'Save item' })).toBeDefined();
  });

  it('a failed delete closes the confirm back to the footer and keeps the row', async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, PHOTOS]) }),
      'DELETE /api/events/ev_1/schedule/items/it_drinks': () => problem('internal_error', 500),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete item…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-failed'));
    expect(document.getElementById('ro-failed')?.textContent).toBe(
      'Not deleted. Nothing was changed. Try again.',
    );
    expect(screen.queryByText('Delete Welcome drinks?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete item…' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Welcome drinks' })).toBeDefined();
  });

  it('a failed Undo says so with the ✕ ring, and shows no tick', async () => {
    await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, PHOTOS]) }),
      'DELETE /api/events/ev_1/schedule/items/it_drinks': () =>
        json({ schedule: schedule([PHOTOS]) }),
      'POST /api/events/ev_1/schedule/items': () => problem('internal_error', 500),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete item…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    expect(await screen.findByText('Welcome drinks deleted.')).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-unsaid'));
    const line = document.getElementById('ro-unsaid');
    expect(line?.getAttribute('role')).toBe('alert');
    expect(line?.textContent).toBe(
      'Welcome drinks was not brought back. Add it again with Add item.',
    );
    expect(line?.querySelector('.ro-ring')).not.toBeNull();
    expect(document.querySelector('.mn-said')?.textContent).toBe('');
    expect(document.querySelector('.mn-said svg')).toBeNull();
  });
});

class StubSource {
  static readonly CLOSED = 2;
  static made: StubSource[] = [];

  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  readonly url: string;

  constructor(url: string | URL) {
    this.url = String(url);
    StubSource.made.push(this);
  }

  close(): void {
    this.readyState = StubSource.CLOSED;
  }

  publish(data: unknown): void {
    act(() => this.onmessage?.({ data: JSON.stringify(data) }));
  }
}

describe('The Schedule’s form, while the hub moves the items (sc-3893)', () => {
  const before = config();

  beforeEach(() => {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
  });

  afterEach(() => {
    __setConfig(before);
    vi.unstubAllGlobals();
  });

  const hub = () =>
    json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });

  it('saves with the version the form opened with, not the one the hub delivered since', async () => {
    const theirs = { ...DRINKS, title: 'Drinks on the lawn', version: 2 };
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS]) }),
      'POST /api/events/ev_1/schedule/subscriptions': hub,
      'PUT /api/events/ev_1/schedule/items/it_drinks': () =>
        problem('precondition_failed', 412, { current: theirs, changedBy: 'Kemi' }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    const scheduled = () => StubSource.made.filter((one) => one.url.includes('schedule'));
    await waitFor(() => expect(scheduled()).toHaveLength(1));
    scheduled()[0]!.publish(schedule([theirs]));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Cocktails' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-conflict'));
    expect(sent.filter(({ line }) => line.startsWith('PUT')).map(({ ifMatch }) => ifMatch)).toEqual(
      ['"1"'],
    );
  });

  it('says the item is gone when the hub drops it from an open form, and adds nothing unasked', async () => {
    const sent = await onSchedule({
      'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, PHOTOS]) }),
      'POST /api/events/ev_1/schedule/subscriptions': hub,
      'PUT /api/events/ev_1/schedule/items/it_drinks': () => problem('not_found', 404),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Welcome drinks' }));
    const scheduled = () => StubSource.made.filter((one) => one.url.includes('schedule'));
    await waitFor(() => expect(scheduled()).toHaveLength(1));
    scheduled()[0]!.publish(schedule([PHOTOS]));

    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(document.activeElement?.id).toBe('ro-gone'));
    expect(document.getElementById('ro-gone')?.textContent).toContain(
      'Someone else deleted this item while you had it open. Nothing was saved.',
    );
    expect(screen.getByRole('button', { name: 'Add it again' })).toBeDefined();
    expect(
      sent.filter(({ line }) => line.startsWith('POST /api/events/ev_1/schedule/items')),
    ).toEqual([]);
  });
});

describe('Show on a screen (sc-3897)', () => {
  const LINKS = {
    links: [
      { place: null, token: 'tok_main', replacedAt: null },
      { place: 'Garden', token: 'tok_garden', replacedAt: null },
    ],
  };
  const withLinks = (more: Record<string, Answer> = {}) => ({
    'GET /api/events/ev_1/schedule': () => json({ schedule: schedule([DRINKS, PHOTOS]) }),
    'GET /api/events/ev_1/screen-links': () => json(LINKS),
    ...more,
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const said = () => document.querySelector('.ss-said')?.textContent;
  const rowsOf = () =>
    within(screen.getByRole('dialog', { name: 'Show on a screen' })).findAllByRole('listitem');

  it('is offered only to those who manage the run of show', async () => {
    await onSchedule(
      withLinks(),
      OWNER_PERMISSIONS.filter((one) => one !== 'run_of_show.manage'),
    );
    await screen.findByRole('link', { name: 'Run view' });

    expect(screen.queryByRole('button', { name: 'Show on a screen' })).toBeNull();
  });

  it('lists a link for each place, Main first, with its three actions', async () => {
    await onSchedule(withLinks());
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }));

    const dialog = screen.getByRole('dialog', { name: 'Show on a screen' });
    await within(dialog).findByText(`${window.location.origin}/s/tok_garden`);
    expect(document.activeElement?.id).toBe('ss-title');
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows.map((row) => within(row).getByRole('heading').textContent)).toEqual([
      'Main',
      'Garden',
    ]);
    expect(within(rows[1]!).getByRole('link', { name: 'Open here' }).getAttribute('href')).toBe(
      `${window.location.origin}/s/tok_garden`,
    );
    expect(within(rows[1]!).getByRole('button', { name: 'Copy screen link' })).toBeDefined();
    expect(within(rows[1]!).getByRole('button', { name: 'Replace link' })).toBeDefined();
  });

  it('says the link was copied only once the clipboard took it', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await onSchedule(withLinks());
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }));
    const row = (await rowsOf())[1]!;

    fireEvent.click(within(row).getByRole('button', { name: 'Copy screen link' }));

    await waitFor(() => expect(said()).toBe('Screen link for Garden copied.'));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/tok_garden`);
  });

  it('selects the link when the browser refuses to copy', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    });
    await onSchedule(withLinks());
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }));
    const row = (await rowsOf())[1]!;

    fireEvent.click(within(row).getByRole('button', { name: 'Copy screen link' }));

    await waitFor(() =>
      expect(said()).toBe(
        'Could not copy here. The link for Garden is selected: press Ctrl+C or Command+C.',
      ),
    );
    expect(window.getSelection()?.toString()).toBe(`${window.location.origin}/s/tok_garden`);
  });

  it('asks in the row before replacing, then shows the new link and when it was replaced', async () => {
    const sent = await onSchedule(
      withLinks({
        'POST /api/events/ev_1/screen-links/replace': () =>
          json({
            links: [
              LINKS.links[0],
              { place: 'Garden', token: 'tok_new', replacedAt: '2030-11-15T17:25:00+00:00' },
            ],
          }),
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }));
    const row = (await rowsOf())[1]!;

    fireEvent.click(within(row).getByRole('button', { name: 'Replace link' }));

    const ask = within(row).getByRole('group', { name: 'Replace the screen link for Garden?' });
    expect(document.activeElement?.textContent).toBe('Keep this link');
    fireEvent.click(within(ask).getByRole('button', { name: 'Replace link' }));

    await within(row).findByText(`${window.location.origin}/s/tok_new`);
    expect(within(row).getByText('Replaced at 17:25. The old link shows nothing.')).toBeDefined();
    expect(said()).toBe('Screen link for Garden replaced.');
    expect(sent.find(({ line }) => line.endsWith('/replace'))?.body).toEqual({ place: 'Garden' });
  });

  it('holds three rows and says so while the links load', async () => {
    await onSchedule(
      withLinks({ 'GET /api/events/ev_1/screen-links': () => new Promise(() => {}) }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }));

    const dialog = screen.getByRole('dialog', { name: 'Show on a screen' });
    expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0);
    expect(dialog.querySelectorAll('.skeleton-row')).toHaveLength(3);
    expect(within(dialog).getByRole('status').textContent).toBe('Loading the screen links…');
  });

  it('says the links did not load, and Try again loads them', async () => {
    let asks = 0;
    await onSchedule(
      withLinks({
        'GET /api/events/ev_1/screen-links': () =>
          ++asks === 1 ? problem('internal', 500) : json(LINKS),
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }));
    const dialog = screen.getByRole('dialog', { name: 'Show on a screen' });

    await waitFor(() =>
      expect(within(dialog).getByRole('status').textContent).toBe('The screen links did not load.'),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));

    expect(within(dialog).getByRole('status').textContent).toBe('Loading the screen links…');
    expect(await rowsOf()).toHaveLength(2);
  });

  it('keeps the old link when Replace link fails, back on that row’s Replace link', async () => {
    await onSchedule(
      withLinks({
        'POST /api/events/ev_1/screen-links/replace': () => problem('internal', 500),
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }));
    const row = (await rowsOf())[1]!;

    fireEvent.click(within(row).getByRole('button', { name: 'Replace link' }));
    const ask = within(row).getByRole('group', { name: 'Replace the screen link for Garden?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Replace link' }));

    await waitFor(() =>
      expect(said()).toBe(
        'The link for Garden was not replaced, so the old link still works. Try again.',
      ),
    );
    expect(within(row).queryByRole('group')).toBeNull();
    expect(within(row).getByText(`${window.location.origin}/s/tok_garden`)).toBeDefined();
    expect(within(row).queryByText(/Replaced at/)).toBeNull();
    expect(document.activeElement).toBe(within(row).getByRole('button', { name: 'Replace link' }));
  });

  it('keeps the link when Keep this link is pressed', async () => {
    const sent = await onSchedule(withLinks());
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }));
    const row = (await rowsOf())[0]!;

    fireEvent.click(within(row).getByRole('button', { name: 'Replace link' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Keep this link' }));

    expect(within(row).getByRole('button', { name: 'Copy screen link' })).toBeDefined();
    expect(sent.some(({ line }) => line.endsWith('/replace'))).toBe(false);
  });
});
