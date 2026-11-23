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
          cells: [{ kind: 'skipped' }],
        },
        {
          id: 'g_kwame',
          name: 'Kwame Mensah',
          allergens: ['celery'],
          otherAllergy: null,
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

type Answer = () => Response | Promise<Response>;

const SHEET = 'GET /api/events/ev_1/menu/kitchen-sheet';
const PDF = 'POST /api/events/ev_1/menu/kitchen-sheet/pdf';

function onSheet(answers: Record<string, Answer>, at = '/app/events/ev_1/menu/kitchen'): string[] {
  const sent: string[] = [];
  signedIn();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push(line);
    const answer = answers[line];
    if (answer != null) return answer();
    if (line === 'GET /api/events/ev_1') return json({ event: EVENT });

    return json({});
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);

  return sent;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:sheet');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('The kitchen sheet (sc-3911)', () => {
  it('puts allergies first, by person, then diets, then each course with its counts', async () => {
    onSheet({ [SHEET]: () => json(sheetOf()) });

    expect(await screen.findByRole('heading', { level: 1, name: 'Kitchen sheet' })).toBeDefined();
    expect(screen.getByText(/^As of Sunday.* · 19:42$/)).toBeDefined();
    expect(screen.getByText('4 coming · 2 people with allergies · 1 course')).toBeDefined();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);
    const at = ['Allergies', 'Diets', 'Main'].map((name) => headings.indexOf(name));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);

    const allergies = screen.getByRole('region', { name: 'Allergies' });
    const rows = within(allergies).getAllByRole('row');
    expect(within(rows[1] as HTMLElement).getByRole('rowheader').textContent).toBe('Ada Obi');
    expect(within(rows[1] as HTMLElement).getByText('Milk, Kiwi (other)')).toBeDefined();
    expect(within(rows[1] as HTMLElement).getByText('Skipped')).toBeDefined();
    expect(within(rows[2] as HTMLElement).getByText('Egusi')).toBeDefined();
    expect(within(allergies).getByText('Milk 1 · Celery 1 · Other allergy 1')).toBeDefined();

    const diets = screen.getByRole('region', { name: 'Diets' });
    expect(within(diets).getByRole('rowheader', { name: 'Vegan' })).toBeDefined();

    const main = screen.getByRole('region', { name: 'Main' });
    expect(within(main).getByRole('rowheader', { name: 'Variant · Plate' })).toBeDefined();
    expect(within(main).getByRole('rowheader', { name: '1 not chosen yet' })).toBeDefined();
    expect(within(main).getByRole('rowheader', { name: 'The room' })).toBeDefined();
  });

  it('counts allergies with no names without Guests manage', async () => {
    onSheet({ [SHEET]: () => json(sheetOf({ names: false, allergic: null })) });

    expect(await screen.findByText('Names need Guests manage.')).toBeDefined();
    const allergies = screen.getByRole('region', { name: 'Allergies' });
    expect(within(allergies).getByRole('rowheader', { name: 'Celery' })).toBeDefined();
    expect(screen.queryByText('Ada Obi')).toBeNull();
  });

  it('says when nobody coming has an allergy', async () => {
    onSheet({
      [SHEET]: () => json(sheetOf({ allergicCount: 0, allergic: [], allergyCounts: [] })),
    });

    expect(await screen.findByText('No allergies recorded for anyone coming.')).toBeDefined();
  });

  it('after the close, names those never given the default and who was', async () => {
    onSheet({
      [SHEET]: () =>
        json(
          sheetOf({
            courses: [{ ...MAIN, never: true, given: { count: 2, plate: 'Jollof rice, Plate' } }],
          }),
        ),
    });

    const main = await screen.findByRole('region', { name: 'Main' });
    expect(
      within(main).getByRole('rowheader', { name: '1 not chosen, never given the default' }),
    ).toBeDefined();
    expect(
      within(main).getByText(
        '2 given the default, Jollof rice, Plate, when picks closed. They are in its count.',
      ),
    ).toBeDefined();
  });

  it('makes the PDF when pressed and names the file the server gave', async () => {
    const sent = onSheet({
      [SHEET]: () => json(sheetOf()),
      [PDF]: () =>
        new Response('%PDF-1.7', {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition':
              "attachment; filename=kitchen-sheet.pdf; filename*=utf-8''Adaeze%20and%20Tunde%20kitchen%20sheet%202030-11-10.pdf",
          },
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Download PDF' }));

    expect(
      await screen.findByText('Adaeze and Tunde kitchen sheet 2030-11-10.pdf is ready.'),
    ).toBeDefined();
    expect(sent.filter((line) => line === PDF)).toHaveLength(1);
  });

  it('keeps the sheet when the PDF cannot be made, and Try again asks again', async () => {
    let tries = 0;
    onSheet({
      [SHEET]: () => json(sheetOf()),
      [PDF]: () => {
        tries += 1;
        return problem('service_unavailable', 503);
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Download PDF' }));

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText(
        'The PDF could not be made. The sheet on this page is unchanged, and Print still works.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('region', { name: 'Allergies' })).toBeDefined();
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(tries).toBe(2));
  });

  it('prints the sheet on paper with the health footer on each page', async () => {
    onSheet({ [SHEET]: () => json(sheetOf()) });

    fireEvent.click(await screen.findByRole('link', { name: 'Print' }));

    expect(await screen.findByRole('button', { name: 'Print this page' })).toBeDefined();
    const pages = screen.getAllByRole('article');
    expect(pages).toHaveLength(2);
    for (const page of pages)
      expect(
        within(page).getByText(
          'This sheet holds guests’ health information. Keep it with the kitchen and dispose of it after the event.',
        ),
      ).toBeDefined();
    expect(screen.queryByText(/₦|NGN/)).toBeNull();
  });

  it('is refused without Menu read', async () => {
    onSheet({ [SHEET]: () => problem('permission_required', 403) });

    expect(await screen.findByText('You cannot open the kitchen sheet')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to the event' })).toBeDefined();
  });
});
