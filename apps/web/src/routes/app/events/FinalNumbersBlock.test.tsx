import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  startsAt: '2030-11-15T18:00:00+01:00',
  endsAt: '2030-11-16T02:00:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 1,
  currency: 'NGN',
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

function problem(code: string, status: number): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const MAIN = {
  id: 'c_main',
  name: 'Main',
  rows: [
    { id: 'd_jollof', kind: 'dish', name: 'Jollof rice', count: 2 },
    { id: 'v_plate', kind: 'variant', name: 'Plate', count: 2 },
    { id: 'd_egusi', kind: 'dish', name: 'Egusi', count: 0 },
  ],
  kitchen: 1,
  skipped: 0,
  needsHost: 0,
  notChosen: 1,
  never: false,
  room: 4,
  given: null,
  sides: false,
};

function sheetOf(more: Record<string, unknown> = {}) {
  return {
    sheet: {
      asOf: '2030-11-10T19:42:00+01:00',
      paper: 'a4',
      names: true,
      coming: 4,
      allergicCount: 2,
      allergic: [
        {
          id: 'g_ada',
          name: 'Ada Obi',
          allergens: ['milk', 'other'],
          otherAllergy: 'Kiwi',
          diets: [],
          otherDiet: null,
          cells: [{ kind: 'skipped' }],
        },
        {
          id: 'g_kwame',
          name: 'Kwame Mensah',
          allergens: ['celery'],
          otherAllergy: null,
          diets: [],
          otherDiet: null,
          cells: [{ kind: 'dish', text: 'Egusi' }],
        },
      ],
      allergyCounts: [
        { code: 'milk', count: 1 },
        { code: 'celery', count: 1 },
        { code: 'other', count: 1 },
      ],
      dietCounts: [{ code: 'vegan', count: 1 }],
      courses: [MAIN],
      ...more,
    },
  };
}

type Answer = (init?: RequestInit) => Response | Promise<Response>;

const SHEET = 'GET /api/events/ev_1/menu/kitchen-sheet';
const DUE = 'PUT /api/events/ev_1/menu/final-numbers';
const GIVE = 'POST /api/events/ev_1/menu/kitchen-sheet/copies';
const COPY = 'POST /api/events/ev_1/menu/kitchen-sheet/copies/k_1/pdf';

const NONE = { due: null, picksOpenUntil: null, copies: [] };
const COPIES = [
  { id: 'k_2', recordedAt: '2030-11-07T17:00:00+01:00', by: 'Ada Obi' },
  { id: 'k_1', recordedAt: '2030-11-03T09:41:00+01:00', by: 'Folake Adeyemi' },
];

function withFinal(finalNumbers: Record<string, unknown>) {
  return { ...sheetOf(), finalNumbers };
}

function pdf(name: string): Response {
  return new Response(new Uint8Array([37, 80, 68, 70]), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}

function onSheet(answers: Record<string, Answer>, permissions = OWNER_PERMISSIONS): string[] {
  const sent: string[] = [];
  signedIn();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push(line);
    const answer = answers[line];
    if (answer != null) return answer(init);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/menu/kitchen'] })}
    />,
  );

  return sent;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2030-11-03T23:30:00Z'));
  URL.createObjectURL = vi.fn(() => 'blob:sheet');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function openDue(): Promise<HTMLInputElement> {
  fireEvent.click(await screen.findByRole('button', { name: /Final numbers due/ }));

  return screen.getByLabelText('Final numbers due', { selector: 'input' }) as HTMLInputElement;
}

/** jsdom's device is en-US, so dates read in its region: "Fri, Nov 15". */
describe('Final numbers due and the copies (sc-30812)', () => {
  it('shows None until a date is set, then saves it in place', async () => {
    const sent = onSheet({
      [SHEET]: () => json(withFinal(NONE)),
      [DUE]: (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ due: '2030-11-10' });

        return json({ finalNumbers: { ...NONE, due: '2030-11-10' } });
      },
    });

    const final = await screen.findByRole('region', { name: 'Final numbers' });
    expect(within(final).getByText('None')).toBeDefined();
    const field = await openDue();
    expect(
      screen.getByText('Any day before Fri, Nov 15. It ends at 23:59 that day, in Africa/Lagos.'),
    ).toBeDefined();
    fireEvent.change(field, { target: { value: '2030-11-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await within(final).findByText('Sun, Nov 10')).toBeDefined();
    expect(sent).toContain(DUE);
    expect(await screen.findByText('Saved')).toBeDefined();
  });

  it('refuses a day on or after the start, or newly in the past in the event’s zone, before sending', async () => {
    const sent = onSheet({ [SHEET]: () => json(withFinal(NONE)) });

    const field = await openDue();
    fireEvent.change(field, { target: { value: '2030-11-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const start = await screen.findByRole('alert');
    expect(start.textContent).toBe(
      'The date cannot be on or after the day the event starts. Choose an earlier date.',
    );
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toContain(start.id);

    fireEvent.change(field, { target: { value: '2030-11-03' } });
    expect(screen.getByRole('alert').textContent).toBe(
      'The date cannot be in the past. Choose today or a later date.',
    );

    fireEvent.change(field, { target: { value: '2030-11-04' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sent).not.toContain(DUE);
  });

  it('keeps a passed date as it is, and shows the API’s 422 under the field', async () => {
    onSheet({
      [SHEET]: () => json(withFinal({ ...NONE, due: '2030-11-01' })),
      [DUE]: () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Validation failed',
            status: 422,
            violations: [
              {
                propertyPath: 'due',
                message: 'The date cannot be in the past. Choose today or a later date.',
              },
            ],
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });

    const field = await openDue();
    expect(field.value).toBe('2030-11-01');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(field, { target: { value: '2030-11-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The date cannot be in the past. Choose today or a later date.',
    );
  });

  it('says guests can still choose while the date falls before the last close', async () => {
    onSheet({
      [SHEET]: () =>
        json(
          withFinal({ ...NONE, due: '2030-11-03', picksOpenUntil: '2030-11-04T23:59:00+01:00' }),
        ),
    });

    expect(await screen.findByText('Guests can still choose until Mon, Nov 4.')).toBeDefined();
  });

  it('gives final numbers: downloads the PDF, records it, and announces it', async () => {
    let given = false;
    const sent = onSheet({
      [SHEET]: () => json(withFinal(given ? { ...NONE, copies: [COPIES[1]] } : NONE)),
      [GIVE]: () => {
        given = true;

        return pdf('Adaeze and Tunde kitchen sheet 2030-11-03.pdf');
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Give final numbers…' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Give the kitchen final numbers',
    });
    expect(
      within(dialog).getByText(
        'Download the kitchen sheet as a PDF and pass it on to the kitchen yourself. Soirely keeps this copy as the numbers you gave, and sends it to nobody.',
      ),
    ).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download PDF' }));

    expect(
      await screen.findByText('Given to the kitchen. A copy is kept on this page.'),
    ).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(sent).toContain(GIVE);
    expect(
      await screen.findByText('Given to the kitchen on Sunday, Nov 3 at 09:41 by Folake Adeyemi'),
    ).toBeDefined();
  });

  it('records nothing when the PDF cannot be made, and Try again retries', async () => {
    let tries = 0;
    onSheet({
      [SHEET]: () => json(withFinal(NONE)),
      [GIVE]: () => {
        tries += 1;

        return tries === 1 ? problem('service_unavailable', 503) : pdf('sheet.pdf');
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Give final numbers…' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Download PDF' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(
      await within(dialog).findByText('The PDF could not be made, so nothing has been recorded.'),
    ).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(tries).toBe(2));
    expect(
      await screen.findByText('Given to the kitchen. A copy is kept on this page.'),
    ).toBeDefined();
  });

  it('cancelling records nothing', async () => {
    const sent = onSheet({ [SHEET]: () => json(withFinal(NONE)) });

    fireEvent.click(await screen.findByRole('button', { name: 'Give final numbers…' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(sent).not.toContain(GIVE);
  });

  it('lists the copies newest first, each with Download this copy', async () => {
    const sent = onSheet({
      [SHEET]: () => json(withFinal({ ...NONE, copies: COPIES })),
      [COPY]: () => pdf('Adaeze and Tunde kitchen sheet 2030-11-03.pdf'),
    });

    const final = await screen.findByRole('region', { name: 'Final numbers' });
    const lines = within(final)
      .getAllByText(/^Given to the kitchen on/)
      .map((one) => one.textContent);
    expect(lines).toEqual([
      'Given to the kitchen on Thursday, Nov 7 at 17:00 by Ada Obi',
      'Given to the kitchen on Sunday, Nov 3 at 09:41 by Folake Adeyemi',
    ]);
    const downloads = within(final).getAllByRole('button', { name: 'Download this copy' });
    fireEvent.click(downloads[1] as HTMLElement);

    await waitFor(() => expect(sent).toContain(COPY));
  });

  it('with menu.read alone shows the date and the copies, and nothing to change them', async () => {
    onSheet(
      { [SHEET]: () => json(withFinal({ ...NONE, due: '2030-11-10', copies: COPIES })) },
      OWNER_PERMISSIONS.filter((one) => one !== 'menu.manage'),
    );

    const final = await screen.findByRole('region', { name: 'Final numbers' });
    expect(within(final).getByText('Sun, Nov 10')).toBeDefined();
    expect(within(final).queryByRole('button', { name: /Final numbers due/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Give final numbers…' })).toBeNull();
    expect(within(final).getAllByRole('button', { name: 'Download this copy' })).toHaveLength(2);
  });
});

const line = (kind: string, more: Record<string, unknown> = {}) => ({
  kind,
  code: null,
  who: null,
  item: null,
  to: null,
  old: 0,
  count: 0,
  ...more,
});

const item = (name: string, parent: string | null = null) => ({ name, parent, state: null });

const CHANGES = {
  since: '2030-11-07T17:00:00+01:00',
  lines: [
    line('allergyNew', { code: 'sesame', who: 'Ngozi Eze', count: 1 }),
    line('allergyGone', { code: 'peanuts', count: 1 }),
    line('dietNew', { code: 'other', count: 2 }),
    line('comingFewer', { count: 1 }),
    line('count', { item: item('Fish', 'Jollof rice'), old: 41, count: 40 }),
    line('added', { item: item('Sea bream'), count: 6 }),
    line('removed', { item: item('Fish'), count: 6 }),
    line('renamed', { item: item('Fish', 'Jollof rice'), to: 'Sea bass' }),
    line('count', { item: { name: '', parent: null, state: 'notYet' }, old: 3, count: 0 }),
  ],
};

describe('Changes since the latest copy (sc-30692)', () => {
  it('opens the sheet with each change in words, in order', async () => {
    onSheet({ [SHEET]: () => json(withFinal({ ...NONE, copies: COPIES, changes: CHANGES })) });

    const card = await screen.findByRole('region', { name: 'Since Thursday, Nov 7 at 17:00' });
    expect(
      within(card)
        .getAllByRole('listitem')
        .map((one) => one.textContent),
    ).toEqual([
      'New allergy: Sesame (Ngozi Eze)',
      'Allergy removed: Peanuts (1 guest)',
      'New diet: Other diet (2 guests)',
      '1 fewer coming',
      'Jollof rice · Fish: 41 to 40',
      'Added: Sea bream, 6',
      'Removed: Fish, was 6',
      'Renamed: Jollof rice · Fish, now Sea bass',
      'Not chosen yet: 3 to 0',
    ]);
  });

  it('gives the changes through the same dialog, then reads from the new copy', async () => {
    let given = false;
    const sent = onSheet({
      [SHEET]: () =>
        json(
          withFinal({
            ...NONE,
            copies: COPIES,
            changes: given ? { since: '2030-11-08T09:30:00+01:00', lines: [] } : CHANGES,
          }),
        ),
      [GIVE]: () => {
        given = true;

        return pdf('sheet.pdf');
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Give the changes…' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Download PDF' }),
    );

    expect(
      await screen.findByText('Given to the kitchen. A copy is kept on this page.'),
    ).toBeDefined();
    expect(
      await screen.findByRole('region', { name: 'No changes since Friday, Nov 8 at 09:30.' }),
    ).toBeDefined();
    expect(sent).toContain(GIVE);
  });

  it('says when nothing has changed, with no action', async () => {
    onSheet({
      [SHEET]: () =>
        json(withFinal({ ...NONE, copies: COPIES, changes: { ...CHANGES, lines: [] } })),
    });

    await screen.findByRole('region', { name: 'No changes since Thursday, Nov 7 at 17:00.' });
    expect(screen.queryByRole('button', { name: 'Give the changes…' })).toBeNull();
  });

  it.each([
    ['without menu.manage', OWNER_PERMISSIONS.filter((one) => one !== 'menu.manage'), null],
    ['once the event has started', OWNER_PERMISSIONS, '2030-11-15T19:00:00+01:00'],
  ])('keeps the list and asks for nothing %s', async (_when, permissions, now) => {
    if (now != null) vi.setSystemTime(new Date(now));
    onSheet(
      { [SHEET]: () => json(withFinal({ ...NONE, copies: COPIES, changes: CHANGES })) },
      permissions,
    );

    await screen.findByText('1 fewer coming');
    expect(screen.queryByRole('button', { name: 'Give the changes…' })).toBeNull();
  });

  it('is not shown before a first copy', async () => {
    onSheet({ [SHEET]: () => json(withFinal({ ...NONE, changes: null })) });

    await screen.findByRole('region', { name: 'Final numbers' });
    expect(screen.queryByText(/since/i)).toBeNull();
  });
});
