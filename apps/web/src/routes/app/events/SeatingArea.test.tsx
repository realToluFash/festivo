import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setConfig, config } from '../../../config.ts';
import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { deletePlanWords, sectionDeleteWords } from './SeatingArea.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-14T16:00:00+01:00',
  endsAt: '2030-11-15T02:00:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 2,
  currency: 'NGN',
  cover: null,
  venue: {
    name: 'The Landmark',
    address: {
      formatted: 'Water Corporation Drive, Lagos',
      line1: null,
      line2: null,
      city: 'Lagos',
      region: null,
      postalCode: null,
      countryCode: null,
      latitude: null,
      longitude: null,
    },
  },
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

const NONE = { sections: 0, tables: 0, rows: 0, singleSeats: 0, seatedGuests: 0 };
const EMPTY = { tables: 0, rows: 0, singleSeats: 0, seats: 0 };

function plan(sections: { id: string; name: string; colour: string; version?: number }[] = []) {
  return {
    id: 'plan_1',
    roomName: 'Main hall',
    widthCm: 2400,
    lengthCm: 1800,
    version: 1,
    changedBy: null,
    sections: sections.map((one) => ({ version: 1, ...EMPTY, ...one })),
    tables: [],
    rows: [],
    singleSeats: [],
    withoutSection: EMPTY,
    counts: { ...NONE, sections: sections.length },
  };
}

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

type Answer = (body: unknown, headers: Headers) => Response | Promise<Response>;

async function onSeating(
  answers: Record<string, Answer>,
  permissions: string[] = OWNER_PERMISSIONS,
): Promise<{ line: string; body: unknown; ifMatch: string | null }[]> {
  return (await onSeatingMounted(answers, permissions)).sent;
}

async function onSeatingMounted(
  answers: Record<string, Answer>,
  permissions: string[] = OWNER_PERMISSIONS,
): Promise<{
  sent: { line: string; body: unknown; ifMatch: string | null }[];
  unmount: () => void;
}> {
  const sent: { line: string; body: unknown; ifMatch: string | null }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    const headers = new Headers(init?.headers);
    sent.push({ line, body, ifMatch: headers.get('If-Match') });

    const answer = answers[line];
    if (answer != null) return answer(body, headers);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });

    return json({});
  });
  const { unmount } = render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/seating'] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: i18next.t('seating.area') });

  return { sent, unmount };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Seating at a desk (sc-3998)', () => {
  it('starts a plan in metres, refusing a blank or too small side beside its field', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: null } }),
      'POST /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: plan() } }, 201),
    });

    expect(await screen.findByText('No seating plan yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }));
    expect(
      screen.getByText(
        'At The Landmark, Lagos. Sizes are in metres, the units used where Ìrè Events is based.',
      ),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText('Length'), { target: { value: '1,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }));
    expect(screen.getByText('Enter the room’s width.')).toBeDefined();
    expect(screen.getByText('The room must be between 2 m and 500 m.')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/seating-plan')).toBe(false);

    fireEvent.change(screen.getByLabelText(/^Room name/), {
      target: { value: 'Main hall' },
    });
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Length'), { target: { value: '18,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }));

    expect(await screen.findAllByText('Main hall · 24 m × 18 m')).toHaveLength(2);
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/seating-plan')?.body).toEqual({
      roomName: 'Main hall',
      widthCm: 2400,
      lengthCm: 1850,
    });
    expect(screen.getByText('Add your first table, row or seat from the bar below.')).toBeDefined();
  });

  it('asks for feet and inches where the organisation is US customary', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'us', plan: null } }),
      'POST /api/events/ev_1/seating-plan': () =>
        json(
          {
            seating: { measurementSystem: 'us', plan: { ...plan(), widthCm: 381, lengthCm: 610 } },
          },
          201,
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Start the plan' }));
    expect(screen.getByText('Type 12′ 4″, 12 ft 4 in, 12.5 ft or 148 in.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '6 ft 6 in' } });
    fireEvent.change(screen.getByLabelText('Length'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }));
    expect(screen.getByText('The room must be between 6 ft 7 in and 1640 ft 5 in.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '12\' 6"' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }));

    expect(await screen.findAllByText('Main hall · 12 ft 6 in × 20 ft')).toHaveLength(2);
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/seating-plan')?.body).toEqual({
      roomName: null,
      widthCm: 381,
      lengthCm: 610,
    });
  });

  it('says it could not load, and Try again loads it again', async () => {
    signedIn();
    let tries = 0;
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => {
        tries += 1;
        return tries === 1
          ? problem('internal_error', 500)
          : json({ seating: { measurementSystem: 'metric', plan: plan() } });
      },
    });

    expect(await screen.findByText('Could not load the seating plan.')).toBeDefined();
    expect(
      screen.getByText('Check your connection and try again. Nothing on the plan has changed.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByText('Main hall · 24 m × 18 m')).toHaveLength(2);
  });

  it('shows the plan but no way to change it without seating.manage', async () => {
    signedIn();
    await onSeating(
      {
        'GET /api/events/ev_1/seating-plan': () =>
          json({
            seating: {
              measurementSystem: 'metric',
              plan: plan([{ id: 's1', name: 'Terrace', colour: 'teal' }]),
            },
          }),
      },
      ['events.read', 'seating.read'],
    );

    expect(
      await screen.findByText('You can view and print this plan, but not change it.'),
    ).toBeDefined();
    expect(screen.getByText('Teal · 0 tables')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Room settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a section' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Terrace' })).toBeNull();
    expect(screen.queryByText('Add your first table, row or seat from the bar below.')).toBeNull();
  });

  it('adds a section on the least-used colour, refusing a name the plan has in another case', async () => {
    signedIn();
    const sections = [
      { id: 's1', name: 'Terrace', colour: 'blue' },
      { id: 's2', name: 'Balcony', colour: 'purple' },
    ];
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: plan(sections) } }),
      'POST /api/events/ev_1/seating-plan/sections': () =>
        json({
          seating: {
            measurementSystem: 'metric',
            plan: plan([...sections, { id: 's3', name: 'Main floor', colour: 'plum' }]),
          },
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a section' }));
    expect(screen.getByRole('radio', { name: 'Plum' })).toHaveProperty('checked', true);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'TÉRRACE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    expect(screen.getByText('This plan already has a section called Terrace.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Main floor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));

    expect(await screen.findByText('Main floor')).toBeDefined();
    expect(
      sent.find((one) => one.line === 'POST /api/events/ev_1/seating-plan/sections')?.body,
    ).toEqual({ name: 'Main floor', colour: 'plum' });
  });

  it('refuses a 31st section when Add a section is pressed', async () => {
    signedIn();
    const full = Array.from({ length: 30 }, (_, index) => ({
      id: `s${index}`,
      name: `Section ${index}`,
      colour: 'blue',
    }));
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: plan(full) } }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a section' }));
    expect(
      screen.getByText('A plan can have up to 30 sections. Delete one to add another.'),
    ).toBeDefined();
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('says who changed the room first when a save comes back 412, and reloads it', async () => {
    signedIn();
    let reads = 0;
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => {
        reads += 1;
        return json({
          seating: {
            measurementSystem: 'metric',
            plan: reads === 1 ? plan() : { ...plan(), widthCm: 3000, version: 2 },
          },
        });
      },
      'PATCH /api/events/ev_1/seating-plan': () =>
        problem('precondition_failed', 412, { changedBy: 'Ana Souza' }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Room settings' }));
    const width = screen.getByLabelText('Width');
    fireEvent.change(width, { target: { value: '26' } });
    fireEvent.blur(width);

    expect(
      await screen.findByText('Ana Souza just changed this. Your change was not saved.'),
    ).toBeDefined();
    await waitFor(() => expect(screen.getByLabelText('Width')).toHaveProperty('value', '30'));
    expect(sent.find((one) => one.line === 'PATCH /api/events/ev_1/seating-plan')?.ifMatch).toBe(
      '"1"',
    );
  });

  it('sends a room field entered before the one before it answers with the version that one saved', async () => {
    signedIn();
    let answered = 1;
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: plan() } }),
      'PATCH /api/events/ev_1/seating-plan': async (body) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        answered += 1;
        return json({
          seating: {
            measurementSystem: 'metric',
            plan: { ...plan(), ...(body as object), version: answered },
          },
        });
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Room settings' }));
    const name = screen.getByLabelText(/^Room name/u);
    fireEvent.change(name, { target: { value: 'Great Hall' } });
    fireEvent.blur(name);
    leave('Width', '26');

    await waitFor(() => expect(sent.filter((one) => one.line.startsWith('PATCH'))).toHaveLength(2));
    expect(
      sent.filter((one) => one.line.startsWith('PATCH')).map((one) => [one.body, one.ifMatch]),
    ).toEqual([
      [{ roomName: 'Great Hall' }, '"1"'],
      [{ widthCm: 2600 }, '"2"'],
    ]);
    expect(screen.queryByText(/just changed this/u)).toBeNull();
  });

  it('counts the rows, single seats and seats in each section and in none', async () => {
    signedIn();
    const ceremony = plan([{ id: 's1', name: 'Ceremony', colour: 'teal' }]);
    ceremony.sections = ceremony.sections.map((one) => ({
      ...one,
      rows: 3,
      singleSeats: 1,
      seats: 31,
    }));
    ceremony.withoutSection = { ...EMPTY, rows: 1, seats: 10 };
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: ceremony } }),
    });

    expect(
      await screen.findByText('Teal · 0 tables · 3 rows · 1 single seat · 31 seats'),
    ).toBeDefined();
    expect(screen.getByText('No section')).toBeDefined();
    expect(screen.getByText('1 row · 10 seats')).toBeDefined();
  });

  it('asks before deleting a section, naming its tables', async () => {
    signedIn();
    const terrace = { ...plan([{ id: 's1', name: 'Terrace', colour: 'teal' }]) };
    terrace.sections = terrace.sections.map((one) => ({ ...one, tables: 3, seats: 24 }));
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: terrace } }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Terrace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete section…' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Terrace?' });
    expect(
      within(ask).getByText('Its 3 tables stay where they are, with no section.'),
    ).toBeDefined();
  });

  it('asks before deleting a section, naming its rows and single seats too', async () => {
    signedIn();
    const terrace = { ...plan([{ id: 's1', name: 'Terrace', colour: 'teal' }]) };
    terrace.sections = terrace.sections.map((one) => ({
      ...one,
      tables: 3,
      rows: 2,
      singleSeats: 1,
      seats: 45,
    }));
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: terrace } }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Terrace' }));
    expect(
      screen.getByText('Its tables, rows and single seats stay where they are, with no section.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete section…' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Terrace?' });
    expect(
      within(ask).getByText(
        'Its 3 tables, 2 rows and 1 single seat stay where they are, with no section.',
      ),
    ).toBeDefined();
  });

  it('asks only "Delete {name}?" for a section with no tables, and deletes it', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({
          seating: {
            measurementSystem: 'metric',
            plan: plan([{ id: 's1', name: 'Terrace', colour: 'teal' }]),
          },
        }),
      'DELETE /api/events/ev_1/seating-plan/sections/s1': () =>
        json({ seating: { measurementSystem: 'metric', plan: plan() } }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Terrace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete section…' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Terrace?' });
    expect(within(ask).queryByText(/with no section/u)).toBeNull();
    expect(ask.getAttribute('aria-describedby')).toBeNull();
    expect(ask.closest('.desk')).not.toBeNull();
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete section' }));

    await waitFor(() => expect(screen.queryByText('Terrace')).toBeNull());
    expect(
      sent.some((one) => one.line === 'DELETE /api/events/ev_1/seating-plan/sections/s1'),
    ).toBe(true);
  });

  it('keeps the section and says so when its delete is not saved', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({
          seating: {
            measurementSystem: 'metric',
            plan: plan([{ id: 's1', name: 'Terrace', colour: 'teal' }]),
          },
        }),
      'DELETE /api/events/ev_1/seating-plan/sections/s1': () => problem('internal_error', 500),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Terrace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete section…' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Terrace?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete section' }));

    expect(await screen.findByText('This change was not saved.')).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Terrace');
  });

  it('takes focus to a panel form’s title as it opens, and back to its opener as it closes', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: plan() } }),
    });

    const settings = await screen.findByRole('button', { name: 'Room settings' });
    settings.focus();
    fireEvent.click(settings);
    await waitFor(() => expect(document.activeElement?.getAttribute('data-focus')).toBe('title'));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Room settings' })),
    );
  });

  it('is not shown without seating.read', async () => {
    signedIn();
    const fetched = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => json({ event: { ...EVENT, permissions: ['events.read'] } }));
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/seating'] })}
      />,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page does not exist' }),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Seating' })).toBeNull();
    expect(fetched.mock.calls.some(([url]) => String(url).includes('/seating-plan'))).toBe(false);
  });
});

describe.each([
  {
    locale: 'en',
    least: '6 ft 7 in',
    largest: '1640 ft 5 in',
    shown: '1148 ft 4 in',
    header: '1,148 ft 4 in',
    typed: '1148 ft 6 in',
  },
  {
    locale: 'fr',
    least: '6 pi 7 po',
    largest: '1640 pi 5 po',
    shown: '1148 pi 4 po',
    header: '1 148 pi 4 po',
    typed: '1148 pi 6 po',
  },
  {
    locale: 'es',
    least: '6 ft 7 in',
    largest: '1640 ft 5 in',
    shown: '1148 ft 4 in',
    header: '1148 ft 4 in',
    typed: '1148 ft 6 in',
  },
])(
  'A room over 1,000 ft, in $locale (sc-3998)',
  ({ locale, least, largest, shown, header, typed }) => {
    const spaced = (text: string) => text.replace(/\s+/gu, ' ');
    const t = (key: string, values: Record<string, string> = {}) => i18next.t(key, values);
    const refusalOpening = () =>
      t('seating.roomRange', { min: '\u0000', max: '' }).split('\u0000')[0] ?? '';
    const refusalShown = () =>
      screen.queryByText((text) => text.startsWith(refusalOpening()), { selector: '*' });

    afterEach(async () => {
      await i18next.changeLanguage('en');
    });

    it('starts at the largest size its refusal names', async () => {
      await i18next.changeLanguage(locale);
      signedIn();
      const sent = await onSeating({
        'GET /api/events/ev_1/seating-plan': () =>
          json({ seating: { measurementSystem: 'us', plan: null } }),
        'POST /api/events/ev_1/seating-plan': () =>
          json({ seating: { measurementSystem: 'us', plan: { ...plan(), widthCm: 50_000 } } }, 201),
      });

      fireEvent.click(await screen.findByRole('button', { name: t('seating.startPlan') }));
      fireEvent.change(screen.getByLabelText(t('seating.width')), { target: { value: '2000 ft' } });
      fireEvent.change(screen.getByLabelText(t('seating.length')), { target: { value: '20' } });
      fireEvent.click(screen.getByRole('button', { name: t('seating.startPlan') }));
      const refusal = refusalShown()?.textContent ?? '';
      expect(spaced(refusal)).toBe(spaced(t('seating.roomRange', { min: least, max: largest })));

      fireEvent.change(screen.getByLabelText(t('seating.width')), { target: { value: largest } });
      fireEvent.click(screen.getByRole('button', { name: t('seating.startPlan') }));

      await waitFor(() =>
        expect(
          sent.find((one) => one.line === 'POST /api/events/ev_1/seating-plan')?.body,
        ).toMatchObject({ widthCm: 50_000 }),
      );
    });

    it('groups the header and takes back the size Room settings shows', async () => {
      await i18next.changeLanguage(locale);
      signedIn();
      const hall = { ...plan(), widthCm: 35_000 };
      const sent = await onSeating({
        'GET /api/events/ev_1/seating-plan': () =>
          json({ seating: { measurementSystem: 'us', plan: hall } }),
        'PATCH /api/events/ev_1/seating-plan': () =>
          json({ seating: { measurementSystem: 'us', plan: { ...hall, widthCm: 35_006 } } }),
      });

      expect(
        await screen.findAllByText((text) => spaced(text).includes(`Main hall · ${header} ×`)),
      ).toHaveLength(2);

      fireEvent.click(screen.getByRole('button', { name: t('seating.roomSettings') }));
      const width = screen.getByLabelText<HTMLInputElement>(t('seating.width'));
      expect(spaced(width.value)).toBe(shown);
      fireEvent.change(width, { target: { value: typed } });
      fireEvent.blur(width);

      await waitFor(() =>
        expect(
          sent.find((one) => one.line === 'PATCH /api/events/ev_1/seating-plan')?.body,
        ).toEqual({
          widthCm: 35_006,
        }),
      );
      expect(refusalShown()).toBeNull();
    });
  },
);

describe('Delete the plan’s words (sc-3998)', () => {
  const t = i18next.t.bind(i18next);

  it('lists what goes with zero counts left out, then who loses a seat', () => {
    expect(deletePlanWords(t, 'en', { ...NONE, sections: 3, tables: 24, seatedGuests: 1 })).toBe(
      'This also deletes 3 sections and 24 tables. 1 seated guest moves to Without a seat; the guest list does not change.',
    );
    expect(
      deletePlanWords(t, 'en', {
        sections: 1,
        tables: 2,
        rows: 1,
        singleSeats: 4,
        seatedGuests: 0,
      }),
    ).toBe(
      'This also deletes 1 section, 2 tables, 1 row and 4 single seats. The guest list does not change.',
    );
  });

  it('leaves the first sentence out when the plan holds nothing', () => {
    expect(deletePlanWords(t, 'en', NONE)).toBe('The guest list does not change.');
  });
});

describe('Delete a section’s words (sc-54060)', () => {
  const t = i18next.t.bind(i18next);
  const NOTHING = { tables: 0, rows: 0, singleSeats: 0, seats: 0 };

  it('names each kind alone, the verb following its total', () => {
    expect(sectionDeleteWords(t, 'en', { ...NOTHING, tables: 1 })).toBe(
      'Its 1 table stays where it is, with no section.',
    );
    expect(sectionDeleteWords(t, 'en', { ...NOTHING, tables: 3 })).toBe(
      'Its 3 tables stay where they are, with no section.',
    );
    expect(sectionDeleteWords(t, 'en', { ...NOTHING, rows: 1, seats: 12 })).toBe(
      'Its 1 row stays where it is, with no section.',
    );
    expect(sectionDeleteWords(t, 'en', { ...NOTHING, singleSeats: 1, seats: 1 })).toBe(
      'Its 1 single seat stays where it is, with no section.',
    );
    expect(sectionDeleteWords(t, 'en', { ...NOTHING, singleSeats: 4, seats: 4 })).toBe(
      'Its 4 single seats stay where they are, with no section.',
    );
  });

  it('lists all three in order, zeros left out, a row counted once however many seats', () => {
    expect(sectionDeleteWords(t, 'en', { tables: 3, rows: 2, singleSeats: 1, seats: 50 })).toBe(
      'Its 3 tables, 2 rows and 1 single seat stay where they are, with no section.',
    );
    expect(sectionDeleteWords(t, 'en', { ...NOTHING, tables: 1, rows: 1, seats: 20 })).toBe(
      'Its 1 table and 1 row stay where they are, with no section.',
    );
  });

  it('says nothing for an empty section', () => {
    expect(sectionDeleteWords(t, 'en', NOTHING)).toBeUndefined();
    expect(sectionDeleteWords(t, 'fr', NOTHING)).toBeUndefined();
  });

  it('counts and joins in French', () => {
    const fr = i18next.getFixedT('fr');

    expect(
      sectionDeleteWords(fr, 'fr', { tables: 3, rows: 2, singleSeats: 1, seats: 50 }),
    ).toContain('3 tables, 2 rangées et 1 place isolée');
    expect(sectionDeleteWords(fr, 'fr', { ...NOTHING, rows: 1, seats: 10 })).toBe(
      fr('seating.sectionDeleteBody', { count: 1, counts: '1 rangée' }),
    );
  });
});

function table(more: Record<string, unknown> = {}) {
  return {
    id: 't1',
    name: 'Table 1',
    sectionId: null,
    shape: 'round',
    seats: 10,
    widthCm: 180,
    lengthCm: 180,
    endSeats: 0,
    rotation: 0,
    xCm: 1200,
    yCm: 900,
    unusableSeats: [],
    version: 1,
    changedBy: null,
    ...more,
  };
}

function withTables(...tables: ReturnType<typeof table>[]) {
  return {
    ...plan(),
    tables,
    withoutSection: { ...EMPTY, tables: tables.length },
    counts: { ...NONE, tables: tables.length },
  };
}

function seating(planned: unknown, tableId?: string) {
  return json({ seating: { measurementSystem: 'metric', plan: planned }, tableId });
}

async function chooseTable(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name }));
  await screen.findByRole('heading', { level: 2, name: name.split(',')[0] ?? name });
}

function leave(label: string, value: string): void {
  const field = screen.getByLabelText(label);

  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe('Tables at a desk (sc-4000)', () => {
  it('offers the four shapes as whole phrases and adds one, opening its panel', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(plan()),
      'POST /api/events/ev_1/seating-plan/tables': () => seating(withTables(table()), 't1'),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add table' }));
    const menu = screen.getByRole('menu', { name: 'Add table' });

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((one) => one.textContent),
    ).toEqual([
      'Round table · 180 cm · 10 seats',
      'Rectangular table · 180 × 76 cm · 6 seats',
      'Head table · 240 × 76 cm · 4 seats',
      'Cocktail table · 60 cm · 4 places',
    ]);
    fireEvent.click(within(menu).getAllByRole('menuitem')[0]!);

    expect(await screen.findByText('Table 1 added in the nearest free space.')).toBeDefined();
    expect(sent.find((one) => one.line.startsWith('POST'))?.body).toEqual({ shape: 'round' });
    expect(screen.getByLabelText('Diameter')).toHaveProperty('value', '180');
    expect(screen.getByLabelText('Seats')).toHaveProperty('value', '10');
    expect(screen.queryByLabelText('Seats on the ends')).toBeNull();
    expect(screen.queryByLabelText('Rotation')).toBeNull();
  });

  it('refuses a field beside it and sends nothing, and sends a good one with its version', async () => {
    signedIn();
    const long = table({ shape: 'rectangular', seats: 6, widthCm: 180, lengthCm: 76 });
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(long)),
      'PATCH /api/events/ev_1/seating-plan/tables/t1': () =>
        seating(withTables({ ...long, endSeats: 2, version: 2 }), 't1'),
    });

    await chooseTable('Table 1, rectangular, 0 of 6 seats taken');
    expect(
      screen.getByText('0 on the left end, 0 on the right, 3 and 3 down the sides.'),
    ).toBeDefined();

    leave('Seats', '31');
    expect(await screen.findByText('Enter a number of seats from 1 to 30.')).toBeDefined();
    leave('Width', '30');
    expect(await screen.findByText('Enter a size from 40 cm to 10 m.')).toBeDefined();
    leave('Seats on the ends', '7');
    expect(
      await screen.findByText('Enter 0 to 6, no more than the table has seats.'),
    ).toBeDefined();
    leave('Name', '');
    expect(await screen.findByText('Enter a name for the table.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('PATCH'))).toBe(false);

    leave('Seats on the ends', '2');
    await waitFor(() =>
      expect(
        screen.getByText('1 on the left end, 1 on the right, 2 and 2 down the sides.'),
      ).toBeDefined(),
    );
    const patch = sent.find((one) => one.line.startsWith('PATCH'));
    expect(patch?.body).toEqual({ endSeats: 2 });
    expect(patch?.ifMatch).toBe('"1"');
  });

  it('refuses a table size in feet, naming the largest it can take, rounded down', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'us', plan: withTables(table()) } }),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    leave('Diameter', '33 ft');

    expect(await screen.findByText('Enter a size from 1 ft 4 in to 32 ft 9 in.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('PATCH'))).toBe(false);
  });

  it('says a new shape’s size was reset, and warns of a squeeze without refusing it', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withTables(table({ widthCm: 150, lengthCm: 150 }))),
      'PATCH /api/events/ev_1/seating-plan/tables/t1': () =>
        seating(
          withTables(table({ shape: 'rectangular', widthCm: 180, lengthCm: 76, version: 2 })),
          't1',
        ),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    expect(screen.getByText('10 seats will be tight at a 150 cm table.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'rectangular' } });

    expect(
      await screen.findByText(
        'Size reset to the rectangular default, 180 × 76 cm. Seats kept at 10.',
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.line.startsWith('PATCH'))?.body).toEqual({
      shape: 'rectangular',
    });
  });

  it('counts a name’s letters as a reader sees them, marks and all', async () => {
    signedIn();
    const thirty = 'e\u0323\u0300'.repeat(30);
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/tables/t1': () =>
        seating(withTables(table({ name: thirty, version: 2 })), 't1'),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    expect(screen.getByLabelText<HTMLInputElement>('Name').maxLength).toBe(-1);
    leave('Name', `${thirty}e\u0323\u0300`);
    expect(await screen.findByText('Use 30 characters or fewer.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('PATCH'))).toBe(false);

    leave('Name', thirty);
    await waitFor(() =>
      expect(sent.find((one) => one.line.startsWith('PATCH'))?.body).toEqual({ name: thirty }),
    );
  });

  it('refuses a name another table has, in any case', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withTables(table(), table({ id: 't2', name: 'Top table', xCm: 400 }))),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    leave('Name', 'top TABLE');

    expect(
      await screen.findByText('This plan already has a table called Top table.'),
    ).toBeDefined();
  });

  it('marks a chosen chair unusable, and draws a cocktail table’s places square', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(
          withTables(
            table(),
            table({
              id: 't2',
              name: 'Table 2',
              shape: 'cocktail',
              seats: 4,
              widthCm: 60,
              lengthCm: 60,
              xCm: 400,
            }),
          ),
        ),
      'PATCH /api/events/ev_1/seating-plan/tables/t1': () =>
        seating(withTables(table({ unusableSeats: [3], version: 2 })), 't1'),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    expect(document.querySelectorAll('[data-table="t2"] rect.st-chair')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Table 1, Seat 3, Empty' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark unusable' }));

    await screen.findByRole('button', { name: 'Mark usable' });
    expect(sent.find((one) => one.line.startsWith('PATCH'))?.body).toEqual({ unusableSeats: [3] });
    expect(document.querySelectorAll('[data-table="t1"] .st-chair.is-unusable')).toHaveLength(1);
  });

  it('duplicates a table and opens the copy', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'POST /api/events/ev_1/seating-plan/tables/t1/duplicate': () =>
        seating(withTables(table(), table({ id: 't2', name: 'Table 2', yCm: 1320 })), 't2'),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(
      await screen.findByText('Table 2 added, a copy of Table 1 with nobody seated.'),
    ).toBeDefined();
    expect(sent.find((one) => one.line.endsWith('/duplicate'))?.ifMatch).toBe('"1"');
  });

  it('asks before deleting a table, saying nobody is seated, and deletes it', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'DELETE /api/events/ev_1/seating-plan/tables/t1': () => seating(plan()),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.click(screen.getByRole('button', { name: 'Delete table' }));
    const ask = await screen.findByRole('alertdialog');

    expect(within(ask).getByText('Delete Table 1?')).toBeDefined();
    expect(within(ask).getByText('Nobody is seated here.')).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete Table 1' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' }),
      ).toBeNull(),
    );
    expect(sent.find((one) => one.line.startsWith('DELETE'))?.ifMatch).toBe('"1"');
  });

  it('says who changed a table first when a save comes back 412', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/tables/t1': () =>
        problem('precondition_failed', 412, { changedBy: 'Ngozi Eze' }),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    leave('Seats', '8');

    expect(
      await screen.findByText('Ngozi Eze just changed this table. Your change was not saved.'),
    ).toBeDefined();
  });

  it('keeps Room settings open on a size that leaves a table outside, outlining it', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table({ xCm: 2200 }))),
      'PATCH /api/events/ev_1/seating-plan': () =>
        problem('seating_items_outside', 409, { outside: ['t1'] }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Room settings' }));
    leave('Width', '13');

    expect(
      await screen.findByText('1 item sits outside 13 m × 18 m. Move it first.'),
    ).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Room settings' })).toBeDefined();
    expect(document.querySelector('[data-table="t1"] .st-overlap')).not.toBeNull();
    expect(document.querySelector('.st-new-wall')).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Width').value).toBe('13');
  });

  it('gives focus back to the room’s table when the panel it opened closes', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    const item = await screen.findByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' });
    item.focus();
    fireEvent.click(item);
    await waitFor(() => expect(document.activeElement?.getAttribute('data-focus')).toBe('title'));

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(item));
    expect(screen.queryByRole('heading', { level: 2, name: 'Table 1' })).toBeNull();

    fireEvent.click(item);
    await waitFor(() => expect(document.activeElement?.getAttribute('data-focus')).toBe('title'));
    fireEvent.click(document.querySelector('.st-floor') as Element);
    await waitFor(() => expect(document.activeElement).toBe(item));
  });

  it('leaves a chair’s panel by Esc, with no Close, giving focus to its table', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.click(screen.getByRole('button', { name: 'Table 1, Seat 3, Empty' }));
    await screen.findByRole('button', { name: 'Mark unusable' });

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement?.getAttribute('data-table')).toBe('t1'));
    expect(screen.queryByRole('button', { name: 'Mark unusable' })).toBeNull();
  });

  it('names the shape in the panel’s select by its short word, as the demo does', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' }),
    );

    const shape = await screen.findByLabelText<HTMLSelectElement>('Shape');
    expect([...shape.options].map((option) => option.text)).toEqual([
      'Round',
      'Rectangular',
      'Head',
      'Cocktail',
    ]);
  });

  it('shows a table as facts, with nothing to change, without seating.manage', async () => {
    signedIn();
    await onSeating(
      { 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) },
      OWNER_PERMISSIONS.filter((one) => one !== 'seating.manage'),
    );

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    expect(screen.queryByRole('button', { name: 'Add table' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete table' })).toBeNull();
    expect(screen.queryByLabelText('Seats')).toBeNull();
    const facts = [...document.querySelectorAll('.st-facts div')].map((row) => row.textContent);

    expect(facts).toEqual(['SectionNo section', 'ShapeRound table', 'Seats10', 'Diameter180 cm']);
    expect(screen.getByText('You can view and print this plan, but not change it.')).toBeDefined();
  });
});

function row(more: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    label: 'A',
    sectionId: null,
    seats: 10,
    spacingCm: 50,
    rotation: 0,
    xCm: 1200,
    yCm: 400,
    unusableSeats: [],
    version: 1,
    changedBy: null,
    ...more,
  };
}

function single(more: Record<string, unknown> = {}) {
  return {
    id: 's1',
    name: 'Seat 1',
    sectionId: null,
    xCm: 300,
    yCm: 300,
    unusable: false,
    version: 1,
    changedBy: null,
    ...more,
  };
}

function withRowsAndSeats(
  rows: ReturnType<typeof row>[],
  singleSeats: ReturnType<typeof single>[],
) {
  return {
    ...plan(),
    rows,
    singleSeats,
    counts: { ...NONE, rows: rows.length, singleSeats: singleSeats.length },
  };
}

function placed(planned: unknown, ids: { rowId?: string; seatId?: string }) {
  return json({ seating: { measurementSystem: 'metric', plan: planned }, ...ids });
}

describe('Rows and single seats at a desk (sc-4003)', () => {
  it('adds a row of ten in the nearest free space, opening it with five seats shown', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(plan()),
      'POST /api/events/ev_1/seating-plan/rows': () =>
        placed(withRowsAndSeats([row()], []), { rowId: 'r1' }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add row' }));

    expect(
      await screen.findByText('Row A added in the nearest free space, with 10 seats.'),
    ).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/seating-plan/rows')).toBe(true);
    expect(screen.getByText('Faces the front · seat 1 on the left')).toBeDefined();
    expect(document.querySelectorAll('.st-strip-seat')).toHaveLength(5);
    expect(screen.getByText('+5 to the right')).toBeDefined();
    expect(screen.getByLabelText('Label')).toHaveProperty('value', 'A');
    expect(screen.getByLabelText('Spacing')).toHaveProperty('value', '50');
    expect(document.querySelector('[data-row="r1"] .st-tab-text')?.textContent).toBe('A');
  });

  it('refuses a taken label, too many seats and a spacing out of range, then sends a good one', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withRowsAndSeats([row(), row({ id: 'r2', label: 'B', yCm: 800 })], [])),
      'PATCH /api/events/ev_1/seating-plan/rows/r1': () =>
        placed(
          withRowsAndSeats(
            [row({ spacingCm: 60, version: 2 }), row({ id: 'r2', label: 'B', yCm: 800 })],
            [],
          ),
          { rowId: 'r1' },
        ),
    });

    await chooseTable('Row A, row of 10, 0 of 10 seats taken');
    leave('Label', 'b');
    expect(await screen.findByText('This plan already has a row labelled B.')).toBeDefined();
    leave('Seats', '61');
    expect(await screen.findByText('Enter a number of seats from 1 to 60.')).toBeDefined();
    leave('Spacing', '30');
    expect(await screen.findByText(/^Enter a spacing from 40 cm to /u)).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('PATCH'))).toBe(false);

    leave('Spacing', '60');
    await waitFor(() => expect(sent.some((one) => one.line.startsWith('PATCH'))).toBe(true));
    const patch = sent.find((one) => one.line.startsWith('PATCH'));
    expect(patch?.body).toEqual({ spacingCm: 60 });
    expect(patch?.ifMatch).toBe('"1"');
  });

  it('marks a row’s chosen seat unusable from the strip', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([row()], [])),
      'PATCH /api/events/ev_1/seating-plan/rows/r1': () =>
        placed(withRowsAndSeats([row({ unusableSeats: [3], version: 2 })], []), { rowId: 'r1' }),
    });

    await chooseTable('Row A, row of 10, 0 of 10 seats taken');
    const strip = document.querySelector<HTMLElement>('.st-strip')!;
    fireEvent.click(within(strip).getByRole('button', { name: 'Row A, seat 3, Empty' }));
    expect(await screen.findByText('Row A, seat 3 · Empty')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Mark unusable' }));

    await screen.findByRole('button', { name: 'Mark usable' });
    expect(sent.find((one) => one.line.startsWith('PATCH'))?.body).toEqual({ unusableSeats: [3] });
    expect(document.querySelectorAll('[data-row="r1"] .st-chair.is-unusable')).toHaveLength(1);
  });

  it('duplicates a row and asks before deleting one', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([row()], [])),
      'POST /api/events/ev_1/seating-plan/rows/r1/duplicate': () =>
        placed(withRowsAndSeats([row(), row({ id: 'r2', label: 'B', yCm: 460 })], []), {
          rowId: 'r2',
        }),
      'DELETE /api/events/ev_1/seating-plan/rows/r2': () => seating(withRowsAndSeats([row()], [])),
    });

    await chooseTable('Row A, row of 10, 0 of 10 seats taken');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(
      await screen.findByText('Row B added, a copy of Row A with nobody seated.'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));
    const ask = await screen.findByRole('alertdialog');

    expect(within(ask).getByText('Delete Row B?')).toBeDefined();
    expect(within(ask).getByText('Nobody is seated here.')).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete Row B' }));
    await waitFor(() => expect(document.querySelector('[data-row="r2"]')).toBeNull());
    expect(sent.find((one) => one.line.startsWith('DELETE'))?.ifMatch).toBe('"1"');
  });

  it('sends a second field entered before the first answers with the version the first saved', async () => {
    signedIn();
    let answered = 1;
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([row()], [])),
      'PATCH /api/events/ev_1/seating-plan/rows/r1': async (body) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        answered += 1;
        return placed(withRowsAndSeats([row({ ...(body as object), version: answered })], []), {
          rowId: 'r1',
        });
      },
    });

    await chooseTable('Row A, row of 10, 0 of 10 seats taken');
    leave('Seats', '11');
    leave('Spacing', '60');

    await waitFor(() => expect(sent.filter((one) => one.line.startsWith('PATCH'))).toHaveLength(2));
    const patches = sent.filter((one) => one.line.startsWith('PATCH'));
    expect(patches.map((one) => [one.body, one.ifMatch])).toEqual([
      [{ seats: 11 }, '"1"'],
      [{ spacingCm: 60 }, '"2"'],
    ]);
    await waitFor(() => expect(screen.getByLabelText('Spacing')).toHaveProperty('value', '60'));
    expect(screen.queryByText(/just changed this row/u)).toBeNull();
  });

  it('leaves a row’s and a single seat’s panel by Esc or the floor, with no Close, giving focus back', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withRowsAndSeats([row()], [single({ xCm: 600, yCm: 900 })])),
    });

    const rowItem = await screen.findByRole('button', {
      name: 'Row A, row of 10, 0 of 10 seats taken',
    });
    fireEvent.click(rowItem);
    await waitFor(() => expect(document.activeElement?.getAttribute('data-focus')).toBe('title'));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(rowItem));
    expect(screen.queryByRole('heading', { level: 2, name: 'Row A' })).toBeNull();

    const seatItem = screen.getByRole('button', { name: 'Seat 1, single seat, Empty' });
    fireEvent.click(seatItem);
    await waitFor(() => expect(document.activeElement?.getAttribute('data-focus')).toBe('title'));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.click(document.querySelector('.st-floor') as Element);
    await waitFor(() => expect(document.activeElement).toBe(seatItem));
  });

  it('says who changed a row first when a save comes back 412', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([row()], [])),
      'PATCH /api/events/ev_1/seating-plan/rows/r1': () =>
        problem('precondition_failed', 412, { changedBy: 'Ngozi Eze' }),
    });

    await chooseTable('Row A, row of 10, 0 of 10 seats taken');
    leave('Seats', '8');

    expect(
      await screen.findByText('Ngozi Eze just changed this row. Your change was not saved.'),
    ).toBeDefined();
  });

  it('says who changed a single seat first when a save comes back 412', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([], [single()])),
      'PATCH /api/events/ev_1/seating-plan/seats/s1': () =>
        problem('precondition_failed', 412, { changedBy: 'Ngozi Eze' }),
    });

    await chooseTable('Seat 1, single seat, Empty');
    leave('Name', 'Usher');

    expect(
      await screen.findByText('Ngozi Eze just changed this seat. Your change was not saved.'),
    ).toBeDefined();
  });

  it('adds a single seat, refuses a name another seat has, marks it unusable and deletes it', async () => {
    signedIn();
    const other = single({ id: 's2', name: 'Usher', xCm: 600 });
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([], [other])),
      'POST /api/events/ev_1/seating-plan/seats': () =>
        placed(withRowsAndSeats([], [other, single()]), { seatId: 's1' }),
      'PATCH /api/events/ev_1/seating-plan/seats/s1': () =>
        placed(withRowsAndSeats([], [other, single({ unusable: true, version: 2 })]), {
          seatId: 's1',
        }),
      'DELETE /api/events/ev_1/seating-plan/seats/s1': () => seating(withRowsAndSeats([], [other])),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add seat' }));
    expect(await screen.findByText('Seat 1 added in the nearest free space.')).toBeDefined();
    expect(screen.getByText('Single seat · No section')).toBeDefined();

    leave('Name', 'usher');
    expect(await screen.findByText('This plan already has a seat called Usher.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('PATCH'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Mark unusable' }));
    await screen.findByRole('button', { name: 'Mark usable' });
    expect(sent.find((one) => one.line.startsWith('PATCH'))?.body).toEqual({ unusable: true });

    fireEvent.click(screen.getByRole('button', { name: 'Delete seat' }));
    const ask = await screen.findByRole('alertdialog');
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete Seat 1' }));
    await waitFor(() => expect(document.querySelector('[data-seat="s1"]')).toBeNull());
    expect(sent.find((one) => one.line.startsWith('DELETE'))?.ifMatch).toBe('"2"');
  });

  it('shows a row as facts, with nothing to change, without seating.manage', async () => {
    signedIn();
    await onSeating(
      { 'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([row()], [])) },
      OWNER_PERMISSIONS.filter((one) => one !== 'seating.manage'),
    );

    await chooseTable('Row A, row of 10, 0 of 10 seats taken');
    expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete row' })).toBeNull();
    expect(screen.queryByLabelText('Label')).toBeNull();
    const facts = [...document.querySelectorAll('.st-facts div')].map((one) => one.textContent);

    expect(facts).toEqual(['SectionNo section', 'Seats10', 'Spacing50 cm']);
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

const TABLE_1 = 'Table 1, round, 0 of 10 seats taken';

function percent(): string {
  return document.querySelector('.st-pct')?.textContent ?? '';
}

function press(name: 'Zoom in' | 'Zoom out' | 'Fit the room', times = 1): void {
  for (let n = 0; n < times; n += 1) fireEvent.click(screen.getByRole('button', { name }));
}

function chairTargets(id: string): Element[] {
  return [...document.querySelectorAll(`[data-table="${id}"] .st-chair-hit`)];
}

function centreOf(id: string): number {
  return Number(document.querySelector(`[data-table="${id}"] .st-body`)?.getAttribute('cx'));
}

describe('The room to scale (sc-4007)', () => {
  const before = config();

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    __setConfig(before);
    vi.unstubAllGlobals();
  });

  it('opens fitted, steps through the zoom levels, stops at 25% and 400%, and fits the room again', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) });

    await screen.findByRole('group', { name: 'Zoom 57%' });
    press('Zoom in');
    expect(percent()).toBe('75%');
    press('Zoom in', 3);
    expect(percent()).toBe('200%');
    press('Zoom in', 3);
    expect(percent()).toBe('400%');
    expect(screen.getByRole('button', { name: 'Zoom in' }).getAttribute('aria-disabled')).toBe(
      'true',
    );

    press('Fit the room');
    expect(percent()).toBe('57%');
    press('Zoom out', 5);
    expect(percent()).toBe('25%');
    expect(screen.getByRole('button', { name: 'Zoom out' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Zoom in' }).getAttribute('aria-disabled')).toBe(
      'false',
    );
  });

  it('zooms with Ctrl or Cmd and the wheel, as a trackpad pinch sends it, and moves the view without', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) });
    const canvas = await waitFor(() => document.querySelector('.st-canvas.is-plan')!);

    fireEvent.wheel(canvas, { deltaY: -300, ctrlKey: true });
    const zoomed = Number(percent().replace('%', ''));

    expect(zoomed).toBeGreaterThan(57);
    fireEvent.wheel(canvas, { deltaY: 600, metaKey: true });
    expect(Number(percent().replace('%', ''))).toBeLessThan(zoomed);

    const was = centreOf('t1');

    fireEvent.wheel(canvas, { deltaX: 100, deltaY: 0 });
    expect(centreOf('t1')).toBeCloseTo(was - 100, 0);
  });

  it('draws each item as its outline, name and how full it is under 50%, and its chairs from 50%', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating({
          ...withTables(table({ unusableSeats: [2] })),
          rows: [row()],
          singleSeats: [single()],
        }),
    });

    await screen.findByRole('button', { name: TABLE_1 });
    press('Zoom out');
    expect(percent()).toBe('50%');
    expect(document.querySelectorAll('[data-table="t1"] .st-chair')).toHaveLength(10);
    expect(document.querySelector('.st-of')).toBeNull();

    press('Zoom out');
    expect(percent()).toBe('40%');
    expect(document.querySelectorAll('.st-room .st-chair')).toHaveLength(0);
    expect(document.querySelector('[data-table="t1"] .st-body.is-out')).not.toBeNull();
    expect([...document.querySelectorAll('.st-of')].map((one) => one.textContent)).toEqual([
      '0 of 10',
      '0 of 9',
    ]);
    expect(document.querySelector('[data-seat="s1"] .st-fill')).toBeNull();
    expect(screen.getByRole('button', { name: TABLE_1 })).toBeDefined();
  });

  it('makes every chair a pointer target from 150%, so a click opens it with Mark unusable', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withTables(table(), table({ id: 't2', name: 'Table 2', xCm: 400 }))),
    });

    await screen.findByRole('button', { name: TABLE_1 });
    expect(chairTargets('t1')).toHaveLength(0);
    press('Zoom in', 2);
    expect(percent()).toBe('100%');
    expect(chairTargets('t1')).toHaveLength(0);
    press('Zoom in');
    expect(percent()).toBe('150%');
    expect(chairTargets('t1')).toHaveLength(10);
    expect(chairTargets('t1').every((one) => one.getAttribute('tabindex') === '-1')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Table 2, Seat 4, Empty' }));
    expect(await screen.findByRole('button', { name: 'Mark unusable' })).toBeDefined();
    expect(percent()).toBe('150%');
  });

  it('shows the small map with the view on it from 200%', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) });

    await screen.findByRole('button', { name: TABLE_1 });
    press('Zoom in', 3);
    expect(percent()).toBe('150%');
    expect(document.querySelector('.st-minimap')).toBeNull();
    press('Zoom in');
    expect(document.querySelector('.st-minimap .st-view-box')).not.toBeNull();
    expect(document.querySelectorAll('.st-minimap .st-body')).toHaveLength(1);
  });

  it('keeps the zoom and view when the page is opened again, and fits a room that changed size since', async () => {
    signedIn();
    const answers = { 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) };
    const { unmount } = await onSeatingMounted(answers);

    await screen.findByRole('button', { name: TABLE_1 });
    press('Zoom in', 4);
    expect(percent()).toBe('200%');
    const at = centreOf('t1');

    unmount();
    vi.restoreAllMocks();
    const again = await onSeatingMounted(answers);

    await screen.findByRole('button', { name: TABLE_1 });
    expect(percent()).toBe('200%');
    expect(centreOf('t1')).toBe(at);

    again.unmount();
    vi.restoreAllMocks();
    await onSeatingMounted({
      'GET /api/events/ev_1/seating-plan': () =>
        seating({ ...withTables(table()), widthCm: 2000, lengthCm: 1600 }),
    });
    await screen.findByRole('button', { name: TABLE_1 });
    expect(percent()).toBe('69%');
  });

  it('lets Tab reach the items top to bottom, then left to right, whatever their kind', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating({
          ...withTables(
            table({ id: 't1', name: 'Table 1', xCm: 2000, yCm: 1500 }),
            table({ id: 't2', name: 'Table 2', xCm: 400, yCm: 1500 }),
          ),
          rows: [row({ xCm: 1200, yCm: 400 })],
          singleSeats: [single({ xCm: 300, yCm: 380 })],
        }),
    });

    await screen.findByRole('button', { name: TABLE_1 });
    const order = [
      ...document.querySelectorAll(
        '.st-room [data-table], .st-room [data-row], .st-room [data-seat]',
      ),
    ].map((one) => one.getAttribute('aria-label'));

    expect(order).toEqual([
      'Seat 1, single seat, Empty',
      'Row A, row of 10, 0 of 10 seats taken',
      'Table 2, round, 0 of 10 seats taken',
      TABLE_1,
    ]);
  });

  it('draws a colleague’s saved change without moving the view or clearing the choice', async () => {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'POST /api/events/ev_1/seating-plan/subscriptions': () =>
        json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
    });
    const seatingSource = () =>
      StubSource.made.find((one) => decodeURIComponent(one.url).includes('/seating'));

    await waitFor(() => expect(seatingSource()).toBeDefined());

    press('Zoom in', 2);
    await chooseTable(TABLE_1);
    const at = centreOf('t1');

    seatingSource()!.publish({
      measurementSystem: 'metric',
      plan: withTables(table(), table({ id: 't2', name: 'Table 2', xCm: 400 })),
    });

    await screen.findByRole('button', { name: 'Table 2, round, 0 of 10 seats taken' });
    expect(percent()).toBe('100%');
    expect(centreOf('t1')).toBe(at);
    expect(screen.getByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
  });

  it('reads the room in feet and inches where the organisation is US customary', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'us', plan: withTables(table()) } }),
    });

    expect(
      await screen.findByRole('group', { name: /^Floor plan, Main hall, 78 feet 9 inches by/u }),
    ).toBeDefined();
  });

  it('zooms and reads the room without seating.manage, with nothing to add', async () => {
    signedIn();
    await onSeating(
      { 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) },
      OWNER_PERMISSIONS.filter((one) => one !== 'seating.manage'),
    );

    await screen.findByRole('button', { name: TABLE_1 });
    press('Zoom in', 3);
    expect(percent()).toBe('150%');
    expect(screen.queryByRole('button', { name: 'Add table' })).toBeNull();
  });

  it('sends nothing about the room when the plan opens, zooms and fits', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    await screen.findByRole('button', { name: TABLE_1 });
    press('Zoom in', 4);
    press('Fit the room');
    expect(sent.filter((one) => !one.line.startsWith('GET '))).toEqual([]);
  });
});
