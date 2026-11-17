import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { type SeatingPlan, realtimeTopic } from '@soirely/api-client';

import { __setConfig, config } from '../../../config.ts';
import fr from '../../../i18n/locales/fr.json';
import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { cssRule, stylesheet } from '../../../test-styles.ts';
import { routes } from '../../index.tsx';
import { deletePlanWords, sectionDeleteWords } from './SeatingArea.tsx';
import { KeysStrip, Overlaps } from './SeatingArrange.tsx';
import { pressedHandle } from './seatingItems.ts';

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

  it('counts a section name’s letters as a reader sees them (sc-54292)', async () => {
    signedIn();
    const forty = 'e\u0323\u0300'.repeat(40);
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: plan([]) } }),
      'POST /api/events/ev_1/seating-plan/sections': () =>
        json({
          seating: {
            measurementSystem: 'metric',
            plan: plan([{ id: 's1', name: forty, colour: 'blue' }]),
          },
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a section' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: `${forty}e\u0323\u0300` } });
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    expect(screen.getByText('Use 40 characters or fewer.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: forty } });
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    await waitFor(() =>
      expect(
        sent.find((one) => one.line === 'POST /api/events/ev_1/seating-plan/sections')?.body,
      ).toMatchObject({ name: forty }),
    );
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
  it('offers the four shapes as whole phrases and places one at the centre, opening its panel', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(plan()),
      'POST /api/events/ev_1/seating-plan/tables': () => seating(withTables(table()), 't1'),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        seating(withTables(table({ version: 2 }))),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add table' }));
    const menu = screen.getByRole('menu', { name: 'Add table' });

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((one) => one.textContent),
    ).toEqual([
      'Round table · 180\u00a0cm · 10 seats',
      'Rectangular table · 180 × 76\u00a0cm · 6 seats',
      'Head table · 240 × 76\u00a0cm · 4 seats',
      'Cocktail table · 60\u00a0cm · 4 places',
    ]);
    fireEvent.click(within(menu).getAllByRole('menuitem')[0]!);
    expect(
      screen.getByText('Click the floor to place a round table. It snaps to the grid. Esc stops.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Place another' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place at the centre' }));

    await screen.findByRole('heading', { level: 2, name: 'Table 1' });
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

  it('clears the reset line on the next saved change, and keeps it through a refused one', async () => {
    signedIn();
    let answered = 1;
    let shape = 'round';
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/tables/t1': (body) => {
        answered += 1;
        const changes = body as Record<string, unknown>;

        if (typeof changes.shape === 'string') shape = changes.shape;
        return seating(
          withTables(
            table({
              ...changes,
              shape,
              widthCm: shape === 'round' ? 150 : 180,
              lengthCm: shape === 'round' ? 150 : 76,
              version: answered,
            }),
          ),
          't1',
        );
      },
    });
    const reset = 'Size reset to the rectangular default, 180 × 76 cm. Seats kept at 10.';

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'rectangular' } });
    expect(await screen.findByText(reset)).toBeDefined();

    leave('Seats', '31');
    expect(await screen.findByText('Enter a number of seats from 1 to 30.')).toBeDefined();
    expect(screen.getByText(reset)).toBeDefined();

    leave('Seats', '10');
    expect(screen.getByText(reset)).toBeDefined();

    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'round' } });
    expect(await screen.findByText(/^Size reset to the round default, /u)).toBeDefined();
    expect(screen.queryByText(reset)).toBeNull();

    leave('Name', 'Top table');
    await waitFor(() => expect(screen.queryByText(/^Size reset to/u)).toBeNull());
  });

  it('clears the reset line once a turn or a move of that table saves, and not another table’s', async () => {
    signedIn();
    let version = 1;
    let shape = 'round';
    let placedAs: Record<string, unknown> = {};
    let other = table({ id: 't2', name: 'Table 2', xCm: 600 });
    let fails = 3;
    const now = () =>
      table({
        shape,
        widthCm: shape === 'round' ? 150 : 180,
        lengthCm: shape === 'round' ? 150 : 76,
        ...placedAs,
        version,
      });
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(now(), other)),
      'PATCH /api/events/ev_1/seating-plan/tables/t1': (body) => {
        const changes = body as Record<string, unknown>;

        if (typeof changes.shape === 'string') shape = changes.shape;
        version += 1;
        return seating(withTables(now(), other), 't1');
      },
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        type Step = { id: string; xCm: number; yCm: number; rotation?: number };
        const [item] = (body as { items: Step[] }).items;
        const placed = { xCm: item!.xCm, yCm: item!.yCm, rotation: item!.rotation ?? 0 };

        if (item!.id === 't2') {
          if (fails > 0) {
            fails -= 1;
            return problem('internal', 500);
          }
          other = { ...other, ...placed, version: other.version + 1 };
        } else {
          version += 1;
          placedAs = placed;
        }
        return seating(withTables(now(), other));
      },
    });
    const reset = 'Size reset to the rectangular default, 180 × 76 cm. Seats kept at 10.';

    await chooseTable('Table 2, round, 0 of 10 seats taken');
    fireEvent.keyDown(document.querySelector('[data-table="t2"]')!, { key: 'ArrowRight' });
    expect(await screen.findByText('Saving…')).toBeDefined();
    expect(
      await screen.findByText('This change was not saved.', {}, { timeout: 6000 }),
    ).toBeDefined();

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'rectangular' } });
    expect(await screen.findByText(reset)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Saved')).toBeDefined();
    expect(screen.getByText(reset)).toBeDefined();

    fireEvent.change(screen.getByLabelText('Rotation'), { target: { value: '45' } });
    await waitFor(() => expect(screen.queryByText(reset)).toBeNull());

    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'round' } });
    expect(await screen.findByText(/^Size reset to the round default, /u)).toBeDefined();
    leave('Across', '6 m');
    await waitFor(() => expect(screen.queryByText(/^Size reset to/u)).toBeNull());
  }, 15_000);

  it('counts only usable chairs in a table’s name, and follows a chair marked unusable', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(
          withTables(
            table({ seats: 8, unusableSeats: [2] }),
            table({ id: 't2', name: 'Table 2', seats: 2, unusableSeats: [1], xCm: 400 }),
            table({ id: 't3', name: 'Table 3', seats: 2, unusableSeats: [1, 2], xCm: 700 }),
          ),
        ),
      'PATCH /api/events/ev_1/seating-plan/tables/t1': () =>
        seating(
          withTables(
            table({ seats: 8, unusableSeats: [2, 3], version: 2 }),
            table({ id: 't2', name: 'Table 2', seats: 2, unusableSeats: [1], xCm: 400 }),
            table({ id: 't3', name: 'Table 3', seats: 2, unusableSeats: [1, 2], xCm: 700 }),
          ),
          't1',
        ),
    });

    await chooseTable('Table 1, round, 0 of 7 seats taken');
    expect(screen.getByRole('button', { name: 'Table 2, round, 0 of 1 seat taken' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Table 3, round, 0 of 0 seats taken' }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Table 1, Seat 3, Empty' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark unusable' }));

    expect(
      await screen.findByRole('button', { name: 'Table 1, round, 0 of 6 seats taken' }),
    ).toBeDefined();
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

  it('keeps focus on the room’s table it chooses, and one Esc lets it go', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    const item = await screen.findByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' });
    fireEvent.click(item);
    await screen.findByRole('heading', { level: 2, name: 'Table 1' });
    await waitFor(() => expect(document.activeElement).toBe(item));

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(item, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Table 1' })).toBeNull(),
    );
    expect(document.activeElement).toBe(item);

    fireEvent.keyDown(item, { key: 'Enter' });
    await screen.findByRole('heading', { level: 2, name: 'Table 1' });
    await waitFor(() => expect(document.activeElement).toBe(item));
    fireEvent.keyDown(item, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Table 1' })).toBeNull(),
    );

    fireEvent.click(item);
    await screen.findByRole('heading', { level: 2, name: 'Table 1' });
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

    expect(facts).toEqual([
      'SectionNo section',
      'ShapeRound table',
      'Seats10',
      'Diameter180\u00a0cm',
    ]);
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
  it('places a row of ten, opening it with five seats shown', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(plan()),
      'POST /api/events/ev_1/seating-plan/rows': () =>
        placed(withRowsAndSeats([row()], []), { rowId: 'r1' }),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        seating(withRowsAndSeats([row({ version: 2 })], [])),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add row' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Place another' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place at the centre' }));

    await screen.findByRole('heading', { level: 2, name: 'Row A' });
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

  it('counts only usable chairs in a row’s name, while “row of” counts every chair', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withRowsAndSeats([row({ unusableSeats: [4, 7] })], [])),
    });

    expect(
      await screen.findByRole('button', { name: 'Row A, row of 10, 0 of 8 seats taken' }),
    ).toBeDefined();
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
    await waitFor(() => expect(document.activeElement).toBe(rowItem));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(rowItem, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Row A' })).toBeNull(),
    );
    expect(document.activeElement).toBe(rowItem);

    const seatItem = screen.getByRole('button', { name: 'Seat 1, single seat, Empty' });
    fireEvent.click(seatItem);
    await waitFor(() => expect(document.activeElement).toBe(seatItem));
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

  it('counts a row label’s and a seat name’s letters as a reader sees them (sc-54292)', async () => {
    signedIn();
    const ten = 'E\u0323\u0300'.repeat(10);
    const thirty = 'e\u0323\u0300'.repeat(30);
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([row()], [single()])),
      'PATCH /api/events/ev_1/seating-plan/rows/r1': () =>
        placed(withRowsAndSeats([row({ label: ten, version: 2 })], [single()]), { rowId: 'r1' }),
      'PATCH /api/events/ev_1/seating-plan/seats/s1': () =>
        placed(
          withRowsAndSeats(
            [row({ label: ten, version: 2 })],
            [single({ name: thirty, version: 2 })],
          ),
          {
            seatId: 's1',
          },
        ),
    });

    await chooseTable('Row A, row of 10, 0 of 10 seats taken');
    expect(screen.getByLabelText<HTMLInputElement>('Label').maxLength).toBe(-1);
    leave('Label', `${ten}E\u0323\u0300`);
    expect(await screen.findByText('Use 10 characters or fewer.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('PATCH'))).toBe(false);
    leave('Label', ten);
    await waitFor(() =>
      expect(sent.find((one) => one.line.endsWith('/rows/r1'))?.body).toEqual({ label: ten }),
    );

    await chooseTable('Seat 1, single seat, Empty');
    expect(screen.getByLabelText<HTMLInputElement>('Name').maxLength).toBe(-1);
    leave('Name', `${thirty}e\u0323\u0300`);
    expect(await screen.findByText('Use 30 characters or fewer.')).toBeDefined();
    leave('Name', thirty);
    await waitFor(() =>
      expect(sent.find((one) => one.line.endsWith('/seats/s1'))?.body).toEqual({ name: thirty }),
    );
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
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        seating(withRowsAndSeats([], [other, single()])),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add seat' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Place another' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place at the centre' }));
    await screen.findByRole('heading', { level: 2, name: 'Seat 1' });
    expect(screen.getByText('Single seat · No section')).toBeDefined();

    leave('Name', 'usher');
    expect(await screen.findByText('This plan already has a seat called Usher.')).toBeDefined();
    expect(
      sent.some((one) => one.line.startsWith('PATCH /api/events/ev_1/seating-plan/seats')),
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Mark unusable' }));
    await screen.findByRole('button', { name: 'Mark usable' });
    expect(
      sent.find((one) => one.line.startsWith('PATCH /api/events/ev_1/seating-plan/seats'))?.body,
    ).toEqual({ unusable: true });

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

    expect(facts).toEqual(['SectionNo section', 'Seats10', 'Spacing50\u00a0cm']);
  });
});

function barMeetsZoom() {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const width = this.classList.contains('st-add')
      ? this.childElementCount > 1
        ? 520
        : 200
      : this.classList.contains('st-zoom')
        ? 240
        : 0;

    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0 } as DOMRect;
  });
}

describe('At a narrow desk (sc-55937)', () => {
  beforeAll(standInPointerEvents);

  it('folds Add row and Add seat into one Add menu when the bar meets the zoom', async () => {
    signedIn();
    const measured = barMeetsZoom();

    try {
      const sent = await onSeating({
        'GET /api/events/ev_1/seating-plan': () => seating(plan()),
        'POST /api/events/ev_1/seating-plan/rows': () =>
          placed(withRowsAndSeats([row()], []), { rowId: 'r1' }),
        'PATCH /api/events/ev_1/seating-plan/furniture': () =>
          seating(withRowsAndSeats([row({ version: 2 })], [])),
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
      expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add seat' })).toBeNull();
      const menu = screen.getByRole('menu', { name: 'Add' });

      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((one) => one.textContent),
      ).toEqual([
        'Round table · 180\u00a0cm · 10 seats',
        'Rectangular table · 180 × 76\u00a0cm · 6 seats',
        'Head table · 240 × 76\u00a0cm · 4 seats',
        'Cocktail table · 60\u00a0cm · 4 places',
        'Row of chairs',
        'Single seat',
      ]);
      await waitFor(() =>
        expect(document.activeElement).toBe(within(menu).getAllByRole('menuitem')[0]),
      );
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Row of chairs' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Place at the centre' }));

      await waitFor(() => expect(furniture(sent)).toHaveLength(1));
      expect(sent.some((one) => one.line === 'POST /api/events/ev_1/seating-plan/rows')).toBe(true);
      expect(screen.queryByRole('menu')).toBeNull();
    } finally {
      measured.mockRestore();
    }
  });

  it('keeps Add on from a folded menu choice until placing stops', async () => {
    signedIn();
    const measured = barMeetsZoom();

    try {
      await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(plan()) });

      const add = await screen.findByRole('button', { name: 'Add' });

      for (const choice of [
        'Row of chairs',
        'Single seat',
        'Round table · 180\u00a0cm · 10 seats',
      ]) {
        fireEvent.click(add);
        fireEvent.click(
          within(screen.getByRole('menu', { name: 'Add' })).getByRole('menuitem', { name: choice }),
        );
        expect(screen.queryByRole('menu')).toBeNull();
        expect(add.classList.contains('is-on')).toBe(true);
        expect(add.hasAttribute('aria-pressed')).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'Stop placing' }));
        expect(add.classList.contains('is-on')).toBe(false);
      }
    } finally {
      measured.mockRestore();
    }
  });

  it('turns Add off when Esc ends placing that its menu began', async () => {
    signedIn();
    const measured = barMeetsZoom();

    try {
      await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(plan()) });

      const add = await screen.findByRole('button', { name: 'Add' });

      fireEvent.click(add);
      fireEvent.click(
        within(screen.getByRole('menu', { name: 'Add' })).getByRole('menuitem', {
          name: 'Single seat',
        }),
      );
      expect(add.classList.contains('is-on')).toBe(true);

      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() =>
        expect(screen.queryByRole('checkbox', { name: 'Place another' })).toBeNull(),
      );
      expect(add.classList.contains('is-on')).toBe(false);
    } finally {
      measured.mockRestore();
    }
  });

  it('keeps Add on through each click with Place another, and off once the last is placed', async () => {
    signedIn();
    const measured = barMeetsZoom();

    try {
      const sent = await onSeating({
        'GET /api/events/ev_1/seating-plan': () => seating(plan()),
        'POST /api/events/ev_1/seating-plan/seats': () =>
          placed(withRowsAndSeats([], [single({ xCm: 1200, yCm: 900 })]), { seatId: 's1' }),
        'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
          const [item] = (body as { items: { xCm: number; yCm: number }[] }).items;

          return seating(withRowsAndSeats([], [single({ ...item, version: 2 })]));
        },
      });

      const add = await screen.findByRole('button', { name: 'Add' });

      fireEvent.click(add);
      fireEvent.click(
        within(screen.getByRole('menu', { name: 'Add' })).getByRole('menuitem', {
          name: 'Single seat',
        }),
      );
      const floor = document.querySelector('.st-floor')!;

      fireEvent.pointerDown(floor, { pointerId: 1, button: 0, clientX: 203, clientY: 147 });
      await waitFor(() => expect(furniture(sent)).toHaveLength(1));
      expect(screen.getByRole('checkbox', { name: 'Place another' })).toBeDefined();
      expect(add.classList.contains('is-on')).toBe(true);

      fireEvent.click(screen.getByRole('checkbox', { name: 'Place another' }));
      fireEvent.pointerDown(floor, { pointerId: 2, button: 0, clientX: 303, clientY: 147 });
      await waitFor(() =>
        expect(screen.queryByRole('checkbox', { name: 'Place another' })).toBeNull(),
      );
      expect(add.classList.contains('is-on')).toBe(false);
    } finally {
      measured.mockRestore();
    }
  });

  it('turns Add table off when the bar unfolds while a row from the folded Add is placed', async () => {
    signedIn();
    const measured = barMeetsZoom();
    const resized: ResizeObserverCallback[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );

    try {
      await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(plan()) });

      fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
      fireEvent.click(
        within(screen.getByRole('menu', { name: 'Add' })).getByRole('menuitem', {
          name: 'Row of chairs',
        }),
      );
      expect(screen.getByRole('button', { name: 'Add' }).classList.contains('is-on')).toBe(true);

      act(() => {
        for (const callback of resized)
          callback(
            [{ contentRect: { width: 1200, height: 719 } } as ResizeObserverEntry],
            {} as ResizeObserver,
          );
      });

      const addTable = await screen.findByRole('button', { name: 'Add table' });

      expect(screen.getByRole('button', { name: 'Stop placing' })).toBeDefined();
      expect(addTable.classList.contains('is-on')).toBe(false);
    } finally {
      measured.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('keeps Add table on while a table is placed unfolded, and leaves Add row as it is', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(plan()) });

    const addTable = await screen.findByRole('button', { name: 'Add table' });

    fireEvent.click(addTable);
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'Add table' })).getByRole('menuitem', {
        name: 'Round table · 180\u00a0cm · 10 seats',
      }),
    );
    expect(addTable.classList.contains('is-on')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    expect(addTable.classList.contains('is-on')).toBe(false);
    expect(screen.getByRole('button', { name: 'Add row' }).classList.contains('is-on')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Stop placing' }));
    expect(addTable.classList.contains('is-on')).toBe(false);
  });

  it('unfolds Add row and Add seat again once the floor is wide enough', async () => {
    signedIn();
    const measured = barMeetsZoom();
    const resized: ResizeObserverCallback[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );

    try {
      await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(plan()) });

      expect(await screen.findByRole('button', { name: 'Add' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull();

      const widen = (width: number) =>
        act(() => {
          for (const callback of resized)
            callback(
              [{ contentRect: { width, height: 719 } } as ResizeObserverEntry],
              {} as ResizeObserver,
            );
        });

      widen(780);
      expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull();

      widen(1200);
      expect(await screen.findByRole('button', { name: 'Add row' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Add seat' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Add table' })).toBeDefined();
    } finally {
      measured.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('steps the zoom up a line while even the folded bar meets it, and back once they fit', async () => {
    signedIn();
    const measured = barMeetsZoom();
    const resized: ResizeObserverCallback[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );

    try {
      await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(plan()) });
      const bar = (await screen.findByRole('group', { name: 'Add to the room' })) as HTMLElement;
      const widen = (width: number) =>
        act(() => {
          for (const callback of resized)
            callback(
              [{ contentRect: { width, height: 719 } } as ResizeObserverEntry],
              {} as ResizeObserver,
            );
        });

      widen(460);
      await waitFor(() => expect(bar.classList.contains('is-crowded')).toBe(true));
      expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();

      widen(780);
      await waitFor(() => expect(bar.classList.contains('is-crowded')).toBe(false));
      expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull();
    } finally {
      measured.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('keeps Add row and Add seat on the bar, and the menu to the four tables, when they fit', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(plan()) });

    fireEvent.click(await screen.findByRole('button', { name: 'Add table' }));
    expect(screen.getByRole('button', { name: 'Add row' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add seat' })).toBeDefined();
    expect(
      within(screen.getByRole('menu', { name: 'Add table' })).getAllByRole('menuitem'),
    ).toHaveLength(4);
  });

  it('undoes the typing with the first Esc in a table’s field and leaves the table with the second', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    const field = screen.getByLabelText('Seats');

    field.focus();
    fireEvent.change(field, { target: { value: '3' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field).toHaveProperty('value', '10');
    expect(screen.getByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
    expect(document.activeElement).toBe(field);

    fireEvent.keyDown(field, { key: 'Escape' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' }),
      ),
    );
    expect(screen.queryByRole('heading', { level: 2, name: 'Table 1' })).toBeNull();
    expect(
      sent.filter((one) => !one.line.startsWith('GET') && !one.line.endsWith('/chosen')),
    ).toEqual([]);
  });

  it('clears a refusal with the first Esc and leaves with the second', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    const field = screen.getByLabelText('Seats');

    fireEvent.change(field, { target: { value: '31' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByText('Enter a number of seats from 1 to 30.')).toBeDefined();

    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field).toHaveProperty('value', '10');
    expect(screen.queryByText('Enter a number of seats from 1 to 30.')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();

    fireEvent.keyDown(field, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Table 1' })).toBeNull(),
    );
    expect(
      sent.filter((one) => !one.line.startsWith('GET') && !one.line.endsWith('/chosen')),
    ).toEqual([]);
  });

  it('leaves a row and a single seat by Esc in a field with nothing to undo', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withRowsAndSeats([row()], [single({ xCm: 600, yCm: 900 })])),
    });

    const rowItem = await screen.findByRole('button', {
      name: 'Row A, row of 10, 0 of 10 seats taken',
    });
    fireEvent.click(rowItem);
    fireEvent.keyDown(await screen.findByLabelText('Label'), { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(rowItem));

    const seatItem = screen.getByRole('button', { name: 'Seat 1, single seat, Empty' });
    fireEvent.click(seatItem);
    fireEvent.keyDown(await screen.findByLabelText('Name'), { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(seatItem));
  });

  it('keeps Room settings open on Esc in its field', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) });

    fireEvent.click(await screen.findByRole('button', { name: 'Room settings' }));
    const field = await screen.findByLabelText('Room name', { exact: false });

    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.getByRole('heading', { level: 2, name: 'Room settings' })).toBeDefined();
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

function standInPointerEvents(): void {
  if ('PointerEvent' in window) return;
  class StandIn extends MouseEvent {
    pointerId: number;
    pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: StandIn, configurable: true });
}

describe('The room to scale (sc-4007)', () => {
  const before = config();

  beforeAll(standInPointerEvents);

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

  it('pans an item Tab lands on into view by the least distance, and not for a click or an item in view', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) });
    const item = await screen.findByRole('button', { name: TABLE_1 });

    press('Zoom in', 6);
    expect(percent()).toBe('400%');
    let left = 2000;
    const measured = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        const at = this.getAttribute('data-table') === 't1' ? left : 0;
        const size = at === 0 ? 0 : 100;

        return {
          width: size,
          height: size,
          top: 300,
          left: at,
          right: at + size,
          bottom: 300 + size,
          x: at,
          y: 300,
        } as DOMRect;
      });

    try {
      const was = centreOf('t1');

      fireEvent.pointerDown(item, { button: 0, pointerId: 1 });
      act(() => item.focus());
      expect(centreOf('t1')).toBeCloseTo(was, 0);
      act(() => item.blur());

      fireEvent.keyDown(window, { key: 'Tab' });
      act(() => item.focus());
      expect(percent()).toBe('400%');
      expect(centreOf('t1')).toBeCloseTo(was - (2100 - (718 - 16 - 8)), 0);
      act(() => item.blur());

      const moved = centreOf('t1');

      left = 300;
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
      act(() => item.focus());
      expect(centreOf('t1')).toBeCloseTo(moved, 0);
    } finally {
      measured.mockRestore();
    }
  });

  it('ends a pan of the floor with Space held wherever the button comes up, and the next click on the floor still counts', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) });
    await screen.findByRole('button', { name: TABLE_1 });
    press('Zoom in', 3);
    const floor = document.querySelector('.st-floor')!;
    const room = document.querySelector('.st-room')!;
    const at = { button: 0, pointerId: 1 };
    const was = centreOf('t1');

    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.pointerDown(floor, { ...at, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(room, { ...at, clientX: 160, clientY: 100 });
    expect(centreOf('t1')).toBeCloseTo(was + 60, 0);
    fireEvent.pointerUp(document.body, { ...at, clientX: 160, clientY: 100 });
    fireEvent.keyUp(window, { key: ' ' });
    fireEvent.pointerMove(room, { ...at, clientX: 260, clientY: 100 });
    expect(centreOf('t1')).toBeCloseTo(was + 60, 0);

    fireEvent.click(screen.getByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
    fireEvent.pointerDown(floor, { ...at, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(floor, { ...at, clientX: 100, clientY: 100 });
    fireEvent.click(floor);
    expect(screen.queryByRole('heading', { level: 2, name: 'Table 1' })).toBeNull();
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

    await screen.findByRole('button', { name: 'Table 1, round, 0 of 9 seats taken' });
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
    expect(
      screen.getByRole('button', { name: 'Table 1, round, 0 of 9 seats taken' }),
    ).toBeDefined();
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

    const room = document.querySelector('.st-room [data-table="t2"]')!;
    expect(room.getAttribute('aria-pressed')).toBe('false');
    expect(room.querySelectorAll('.st-lit')).toHaveLength(1);
    expect(room.querySelector('.st-lit')?.tagName).toBe('circle');
    expect(
      screen.getByRole('button', { name: 'Table 2, Seat 4, Empty' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('lights only the chosen seat of a row, not the row, once a seat is open', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withRowsAndSeats([row()], [])),
    });

    await screen.findByRole('button', { name: /^Row A/ });
    press('Zoom in', 3);
    expect(percent()).toBe('150%');

    fireEvent.click(screen.getByRole('button', { name: 'Row A, seat 4, Empty' }));
    expect(await screen.findByRole('button', { name: 'Mark unusable' })).toBeDefined();

    const drawn = document.querySelector('.st-room [data-row="r1"]')!;
    expect(drawn.getAttribute('aria-pressed')).toBe('false');
    expect(drawn.querySelectorAll('.st-lit')).toHaveLength(1);
    expect(drawn.querySelector('.st-lit')?.tagName).toBe('circle');
    expect(
      within(drawn as HTMLElement)
        .getByRole('button', { name: 'Row A, seat 4, Empty' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('draws the room’s floor with its tables still to come while the plan loads', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => new Promise<Response>(() => {}) });

    const loading = await screen.findByRole('status', { name: 'Loading the seating plan' });
    expect(loading.querySelectorAll('.st-skeleton-room')).toHaveLength(1);
    expect(loading.querySelectorAll('.st-skeleton-block')).toHaveLength(9);
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

  it('lets Tab keep tables a little out of line on one line, as Renumber reads them', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(
          withTables(
            table({ id: 't1', name: 'Table 1', xCm: 1000, yCm: 170 }),
            table({ id: 't2', name: 'Table 2', xCm: 200, yCm: 190 }),
          ),
        ),
    });

    await screen.findByRole('button', { name: TABLE_1 });
    const order = [...document.querySelectorAll('.st-room [data-table]')].map((one) =>
      one.getAttribute('aria-label'),
    );

    expect(order).toEqual(['Table 2, round, 0 of 10 seats taken', TABLE_1]);
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
    await chooseTable('Table 1, round, 0 of 10 seats taken');
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

  it('refuses a drag whose table a colleague moved between pointer-down and release', async () => {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'POST /api/events/ev_1/seating-plan/subscriptions': () =>
        json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: { version: number }[] }).items;

        return item!.version === 2
          ? seating(withTables(table({ version: 3 })))
          : problem('precondition_failed', 412, { stale: ['t1'], changedBy: 'Bola Ade' });
      },
    });
    const seatingSource = () =>
      StubSource.made.find((one) => decodeURIComponent(one.url).includes('/seating'));

    await waitFor(() => expect(seatingSource()).toBeDefined());
    await screen.findByRole('button', { name: TABLE_1 });
    const drawn = document.querySelector('[data-table="t1"]')!;
    const room = document.querySelector('.st-room')!;
    const at = { pointerId: 1, button: 0 };

    fireEvent.pointerDown(drawn, { ...at, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(room, { ...at, clientX: 133, clientY: 117 });
    seatingSource()!.publish({
      measurementSystem: 'metric',
      plan: withTables(table({ xCm: 600, version: 2 })),
    });
    fireEvent.pointerUp(room, { ...at, clientX: 133, clientY: 117 });

    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    expect((furniture(sent)[0] as { version: number }[])[0]!.version).toBe(1);
    expect(
      await screen.findByText('Bola Ade just moved Table 1. Your change was not saved.'),
    ).toBeDefined();
  });

  it('reads the room in feet and inches where the organisation is US customary', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'us', plan: withTables(table()) } }),
    });

    expect(
      await screen.findByRole('group', {
        name: /^Floor plan, Main hall, 78\u00a0feet 9\u00a0inches by/u,
      }),
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

describe('The breadcrumb (sc-55300)', () => {
  it('cuts only the event name, whose link still carries it in full', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({ seating: { measurementSystem: 'metric', plan: plan() } }),
    });
    const crumb = screen.getByRole('navigation', { name: i18next.t('seating.crumb') });
    const event = within(crumb).getByRole('link', { name: 'Adaeze and Tunde' });

    expect(event.getAttribute('href')).toBe('/app/events/ev_1');
    expect(event.querySelector('.st-crumb-name')?.textContent).toBe('Adaeze and Tunde');
    expect(event.closest('li')?.classList.contains('st-crumb-event')).toBe(true);
    expect(
      within(crumb)
        .getByRole('link', { name: i18next.t('seating.events') })
        .closest('li')
        ?.classList.contains('st-crumb-event'),
    ).toBe(false);
  });

  it('pads its list at least as wide as the desk halo, so a focused link shows it whole (sc-57088)', () => {
    const list = cssRule('.st-crumb ol', stylesheet(import.meta.dirname, 'seating.css'));
    const space = stylesheet(import.meta.dirname, '../../../tokens.css').match(
      /--spaceXs: (\d+)px;/u,
    );
    const halo = stylesheet(import.meta.dirname, '../../../components/SettingsParts.css').match(
      /--deskRing:[^;]*0 0 0 (\d+)px color-mix/u,
    );

    expect(list).toMatch(/padding: var\(--spaceXs\);/u);
    expect(list).toMatch(/margin: calc\(-1 \* var\(--spaceXs\)\);/u);
    expect(Number(space?.[1])).toBeGreaterThanOrEqual(Number(halo?.[1]));
  });
});

function furniture(sent: { line: string; body: unknown }[]) {
  return sent
    .filter((one) => one.line === 'PATCH /api/events/ev_1/seating-plan/furniture')
    .map((one) => (one.body as { items: unknown[] }).items);
}

function usSeating(planned: unknown, tableId?: string) {
  return json({ seating: { measurementSystem: 'us', plan: planned }, tableId });
}

describe('Moving, turning and resizing on the Floor plan (sc-5028)', () => {
  beforeAll(standInPointerEvents);

  const measure = Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return this.matches('[data-table], [data-row], [data-seat]')
        ? new DOMRect(340, 340, 40, 40)
        : measure.call(this);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('moves a chosen table 10 cm with an arrow and 1 m with Shift, each a step with its version', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: { xCm: number; yCm: number }[] }).items;

        return seating(withTables(table({ xCm: item!.xCm, yCm: item!.yCm, version: 2 })));
      },
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    const drawn = document.querySelector('[data-table="t1"]')!;

    fireEvent.keyDown(drawn, { key: 'ArrowRight' });
    expect(await screen.findByText('Saved')).toBeDefined();
    fireEvent.keyDown(drawn, { key: 'ArrowDown', shiftKey: true });

    await waitFor(() => expect(furniture(sent)).toHaveLength(2));
    expect(furniture(sent)).toEqual([
      [{ kind: 'table', id: 't1', xCm: 1210, yCm: 900, version: 1 }],
      [{ kind: 'table', id: 't1', xCm: 1210, yCm: 1000, version: 2 }],
    ]);
    expect(screen.getByText('Table 1, 12.1 m across, 10 m down.')).toBeDefined();
  });

  it('stops an arrow at the room’s edge and sends nothing past it', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table({ xCm: 145 }))),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        seating(withTables(table({ xCm: 140, version: 2 }))),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    const drawn = document.querySelector('[data-table="t1"]')!;

    fireEvent.keyDown(drawn, { key: 'ArrowLeft' });
    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    expect(furniture(sent)[0]).toEqual([
      { kind: 'table', id: 't1', xCm: 140, yCm: 900, version: 1 },
    ]);
    await screen.findByText('Saved');
    fireEvent.keyDown(drawn, { key: 'ArrowLeft' });
    expect(furniture(sent)).toHaveLength(1);
  });

  it('places a table exactly from Across and Down, refusing a spot outside the room beside the field', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        seating(withTables(table({ xCm: 375, version: 2 }))),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    expect(screen.getByLabelText('Across')).toHaveProperty('value', '12\u00a0m');

    leave('Across', '23.5');
    expect(await screen.findByText('Table 1 would sit outside the room.')).toBeDefined();
    leave('Across', 'abc');
    expect(await screen.findByText('Enter a length like 3.75 m or 375 cm.')).toBeDefined();
    expect(furniture(sent)).toEqual([]);

    leave('Across', '3.75');
    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    expect(furniture(sent)[0]).toEqual([
      { kind: 'table', id: 't1', xCm: 375, yCm: 900, version: 1 },
    ]);
    await waitFor(() =>
      expect(screen.getByLabelText('Across')).toHaveProperty('value', '3.75\u00a0m'),
    );
  });

  it('works in feet and inches where the organisation is US customary: 3 in arrows, typed lengths and no bare numbers', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => usSeating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: { xCm: number; yCm: number }[] }).items;

        return usSeating(withTables(table({ xCm: item!.xCm, yCm: item!.yCm, version: 2 })));
      },
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    expect(screen.getByLabelText('Across')).toHaveProperty('value', '39\u00a0ft 4\u00a0in');
    expect(screen.getByLabelText('Across').getAttribute('inputmode')).toBe('text');

    leave('Down', '12');
    expect(await screen.findByText('Enter a length like 12 ft 4 in or 148 in.')).toBeDefined();
    expect(furniture(sent)).toEqual([]);

    leave('Down', '12′ 4″');
    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    expect(furniture(sent)[0]).toEqual([
      { kind: 'table', id: 't1', xCm: 1200, yCm: 376, version: 1 },
    ]);
    await screen.findByText('Saved');

    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });
    await waitFor(() => expect(furniture(sent)).toHaveLength(2));
    expect(furniture(sent)[1]).toEqual([
      { kind: 'table', id: 't1', xCm: 1208, yCm: 376, version: 2 },
    ]);
  });

  it('turns a long table 15° with R, duplicates it with Ctrl+D and asks before Delete', async () => {
    signedIn();
    const long = table({ shape: 'rectangular', seats: 6, widthCm: 180, lengthCm: 76 });
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(long)),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        seating(withTables({ ...long, rotation: 15, version: 2 })),
      'POST /api/events/ev_1/seating-plan/tables/t1/duplicate': () =>
        seating(
          withTables(
            { ...long, rotation: 15, version: 2 },
            { ...long, id: 't2', name: 'Table 2', yCm: 1320 },
          ),
          't2',
        ),
    });

    await chooseTable('Table 1, rectangular, 0 of 6 seats taken');
    const drawn = document.querySelector('[data-table="t1"]')!;

    fireEvent.keyDown(drawn, { key: 'r' });
    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    expect(furniture(sent)[0]).toEqual([
      { kind: 'table', id: 't1', xCm: 1200, yCm: 900, rotation: 15, version: 1 },
    ]);
    await screen.findByText('Saved');

    fireEvent.keyDown(drawn, { key: 'Delete' });
    const ask = await screen.findByRole('alertdialog');
    expect(within(ask).getByRole('button', { name: 'Delete Table 1' })).toBeDefined();
    fireEvent.keyDown(ask, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'd', ctrlKey: true });
    expect(
      await screen.findByText('Table 2 added, a copy of Table 1 with nobody seated.'),
    ).toBeDefined();
    expect(
      sent.find((one) => one.line === 'POST /api/events/ev_1/seating-plan/tables/t1/duplicate')
        ?.ifMatch,
    ).toBe('"2"');
  });

  it('does not turn a round table with R', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'R' });
    expect(furniture(sent)).toEqual([]);
  });

  it('chooses several with Shift and click, moves them as one step, and lets go with Esc', async () => {
    signedIn();
    const second = table({ id: 't2', name: 'Table 2', xCm: 600 });
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second)),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        seating(withTables(table({ xCm: 1300, version: 2 }), { ...second, xCm: 700, version: 2 })),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.click(screen.getByRole('button', { name: 'Table 2, round, 0 of 10 seats taken' }), {
      shiftKey: true,
    });
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    expect(screen.getByText('2 tables · 0 guests seated')).toBeDefined();
    expect(
      screen.getByText('Shift and click adds or takes one away. Esc lets go of all of them.'),
    ).toBeDefined();

    fireEvent.keyDown(document.querySelector('[data-table="t2"]')!, {
      key: 'ArrowRight',
      shiftKey: true,
    });
    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    expect(furniture(sent)[0]).toEqual([
      { kind: 'table', id: 't1', xCm: 1300, yCm: 900, version: 1 },
      { kind: 'table', id: 't2', xCm: 700, yCm: 900, version: 1 },
    ]);

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: '2 chosen' })).toBeNull());
    expect(document.querySelectorAll('[aria-pressed="true"][data-table]')).toHaveLength(0);
  });

  it('drags a table, snapping to the grid, and saves it on release', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: { xCm: number; yCm: number }[] }).items;

        return seating(withTables(table({ xCm: item!.xCm, yCm: item!.yCm, version: 2 })));
      },
    });
    await screen.findByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' });
    const drawn = document.querySelector('[data-table="t1"]')!;
    const room = document.querySelector('.st-room')!;
    const at = { pointerId: 1, button: 0 };

    fireEvent.pointerDown(drawn, { ...at, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(room, { ...at, clientX: 133, clientY: 117 });
    fireEvent.pointerUp(room, { ...at, clientX: 133, clientY: 117 });
    fireEvent.click(drawn);

    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    const [moved] = furniture(sent)[0] as { xCm: number; yCm: number }[];

    expect(moved!.xCm % 10).toBe(0);
    expect(moved!.yCm % 10).toBe(0);
    expect(moved!.xCm).toBeGreaterThan(1200);
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
  });

  it('outlines overlapping tables and says so in the panel', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withTables(table(), table({ id: 't2', name: 'Table 2', xCm: 1350 }))),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    expect(screen.getByText('Overlaps Table 2')).toBeDefined();
    expect(document.querySelectorAll('[data-table] .st-overlap')).toHaveLength(2);
  });

  it('says Saving…, then Couldn’t save and tries again, and after three tries keeps the change with Try again', async () => {
    signedIn();
    let fails = 3;
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/furniture': () => {
        if (fails > 0) {
          fails -= 1;
          return problem('internal', 500);
        }
        return seating(withTables(table({ xCm: 1210, version: 2 })));
      },
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });
    expect(await screen.findByText('Saving…')).toBeDefined();
    expect(await screen.findByText('Couldn’t save. Trying again…')).toBeDefined();
    expect(
      await screen.findByText('This change was not saved.', {}, { timeout: 6000 }),
    ).toBeDefined();
    expect(document.querySelector('.st-save')?.textContent).toContain('Try again');
    expect(document.querySelector('.st-save .st-no')).not.toBeNull();
    expect(screen.getByLabelText('Across')).toHaveProperty('value', '12.1\u00a0m');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Saved')).toBeDefined();
    expect(furniture(sent)).toHaveLength(4);
  }, 15_000);

  it('refuses a step a colleague got to first, naming them, and snaps back to where they put it', async () => {
    signedIn();
    let reads = 0;
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => {
        reads += 1;
        return seating(withTables(table(reads > 1 ? { xCm: 600, version: 2 } : {})));
      },
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        problem('precondition_failed', 412, { stale: ['t1'], changedBy: 'Bola Ade' }),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });

    const said = await screen.findByText('Bola Ade just moved Table 1. Your change was not saved.');

    expect(said.closest('.st-under-views .st-bar.is-amber')).not.toBeNull();
    expect(said.closest('.st-panel')).toBeNull();
    await waitFor(() =>
      expect(screen.getByLabelText('Across')).toHaveProperty('value', '6\u00a0m'),
    );
  });

  it('clears the refusal from the floor once the host moves again or chooses another table', async () => {
    signedIn();
    let reads = 0;
    let steps = 0;
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => {
        reads += 1;
        return seating(
          withTables(
            table(reads > 1 ? { xCm: 600, version: 2 } : {}),
            table({ id: 't2', name: 'Table 2', xCm: 2400 }),
          ),
        );
      },
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        steps += 1;
        if (steps !== 2)
          return problem('precondition_failed', 412, { stale: ['t1'], changedBy: 'Bola Ade' });
        const [item] = (body as { items: { xCm: number }[] }).items;

        return seating(
          withTables(
            table({ xCm: item!.xCm, version: 3 }),
            table({ id: 't2', name: 'Table 2', xCm: 2400 }),
          ),
        );
      },
    });
    const refusal = 'Bola Ade just moved Table 1. Your change was not saved.';

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });
    await screen.findByText(refusal);
    await waitFor(() =>
      expect(screen.getByLabelText('Across')).toHaveProperty('value', '6\u00a0m'),
    );

    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });
    expect(screen.queryByText(refusal)).toBeNull();
    expect(await screen.findByText('Saved')).toBeDefined();

    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });
    await screen.findByText(refusal);

    await chooseTable('Table 2, round, 0 of 10 seats taken');
    expect(screen.queryByText(refusal)).toBeNull();
  });

  it('sends a queued step on from the version its own earlier step saved', async () => {
    signedIn();
    let current = 1;
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: { xCm: number; version: number }[] }).items;

        if (item!.version !== current)
          return problem('precondition_failed', 412, { stale: ['t1'], changedBy: 'Bola Ade' });
        current += 1;
        return seating(withTables(table({ xCm: item!.xCm, version: current })));
      },
    });

    await chooseTable(TABLE_1);
    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });
    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });

    expect(await screen.findByText('Saved')).toBeDefined();
    await waitFor(() => expect(furniture(sent)).toHaveLength(2));
    expect(furniture(sent).map((items) => (items as { version: number }[])[0]!.version)).toEqual([
      1, 2,
    ]);
    expect(screen.queryByText(/just moved/u)).toBeNull();
  });

  it('places by a click on the floor, snapped, and keeps placing with Place another until Esc', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(plan()),
      'POST /api/events/ev_1/seating-plan/seats': () =>
        placed(withRowsAndSeats([], [single({ xCm: 1200, yCm: 900 })]), { seatId: 's1' }),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: { xCm: number; yCm: number }[] }).items;

        return seating(withRowsAndSeats([], [single({ ...item, version: 2 })]));
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add seat' }));
    expect(screen.getByRole('checkbox', { name: 'Place another' })).toHaveProperty('checked', true);
    const floor = document.querySelector('.st-floor')!;

    fireEvent.pointerDown(floor, { pointerId: 1, button: 0, clientX: 203, clientY: 147 });
    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    const [put] = furniture(sent)[0] as { xCm: number; yCm: number }[];

    expect([put!.xCm % 10, put!.yCm % 10]).toEqual([0, 0]);
    expect(
      screen.getByText('Click the floor to place a seat. It snaps to the grid. Esc stops.'),
    ).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: 'Place another' })).toBeNull(),
    );
  });

  it('keeps the placing bar in reading order: its words, Place at the centre, Stop placing', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(plan()),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add seat' }));
    const body = screen.getByRole('button', { name: 'Stop placing' }).closest('.st-bar-body');
    const order = [...(body?.querySelectorAll('p, button') ?? [])].map((node) =>
      node.tagName === 'P' ? 'words' : node.textContent,
    );

    expect(order).toEqual(['words', 'Place at the centre', 'Stop placing']);
  });

  it('offers Snap to grid, on at first, and none of this without seating.manage', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });
    const snap = await screen.findByRole('switch', { name: 'Snap to grid' });

    expect(snap.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(snap);
    expect(snap.getAttribute('aria-checked')).toBe('false');
  });

  it('moves nothing for a viewer, and shows no handles or Snap to grid', async () => {
    signedIn();
    const sent = await onSeating(
      { 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) },
      OWNER_PERMISSIONS.filter((one) => one !== 'seating.manage'),
    );

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    fireEvent.keyDown(document.querySelector('[data-table="t1"]')!, { key: 'ArrowRight' });
    expect(screen.queryByRole('switch', { name: 'Snap to grid' })).toBeNull();
    expect(document.querySelector('.st-handle-hit')).toBeNull();
    expect(screen.queryByLabelText('Across')).toBeNull();
    expect(furniture(sent)).toEqual([]);
  });

  it('gives a chosen table 44 px handles and resizes it from one, saved on release', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: { widthCm: number }[] }).items;

        return seating(
          withTables(table({ widthCm: item!.widthCm, lengthCm: item!.widthCm, version: 2 })),
        );
      },
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    const hits = document.querySelectorAll('.st-handle-hit');

    expect(hits).toHaveLength(4);
    expect([hits[0]!.getAttribute('width'), hits[0]!.getAttribute('height')]).toEqual(['44', '44']);
    const room = document.querySelector('.st-room')!;
    const at = { pointerId: 2, button: 0 };

    fireEvent.pointerDown(hits[2]!, { ...at, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(room, { ...at, clientX: 400, clientY: 300 });
    fireEvent.pointerUp(room, { ...at, clientX: 400, clientY: 300 });

    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    const [sized] = furniture(sent)[0] as { widthCm: number; lengthCm: number }[];

    expect(sized!.widthCm).toBe(sized!.lengthCm);
    expect(sized!.widthCm % 10).toBe(0);
  });

  it('moves a chosen long table pressed at its middle, though its s handle’s target covers it', async () => {
    signedIn();
    const long = { shape: 'rectangular', seats: 6, widthCm: 240, lengthCm: 80 };
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(long))),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: { xCm: number; yCm: number }[] }).items;

        return seating(withTables(table({ ...long, xCm: item!.xCm, yCm: item!.yCm, version: 2 })));
      },
    });

    await chooseTable('Table 1, rectangular, 0 of 6 seats taken');
    const middle = (name: string) => {
      const hit = document.querySelector(`.st-handle-hit[data-handle="${name}"]`)!;

      return [Number(hit.getAttribute('x')) + 22, Number(hit.getAttribute('y')) + 22];
    };
    const [x, north] = middle('n');
    const [, south] = middle('s');
    const at = { pointerId: 3, button: 0, clientX: x!, clientY: (north! + south!) / 2 };
    const room = document.querySelector('.st-room')!;

    fireEvent.pointerDown(document.querySelector('.st-handle-hit[data-handle="s"]')!, at);
    fireEvent.pointerMove(room, { ...at, clientX: at.clientX + 40, clientY: at.clientY + 30 });
    fireEvent.pointerUp(room, { ...at, clientX: at.clientX + 40, clientY: at.clientY + 30 });

    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    const [moved] = furniture(sent)[0] as Record<string, number>[];

    expect([moved!.xCm, moved!.yCm]).not.toEqual([1200, 900]);
    expect(moved).not.toHaveProperty('widthCm');
    expect(moved).not.toHaveProperty('lengthCm');
  });

  it('moves a table by arrow straight after a click chooses it, focus staying on the table', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        seating(withTables(table({ xCm: 1210, version: 2 }))),
    });

    await chooseTable('Table 1, round, 0 of 10 seats taken');
    await waitFor(() => expect(document.activeElement?.getAttribute('data-table')).toBe('t1'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });

    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    expect(furniture(sent)[0]).toEqual([
      { kind: 'table', id: 't1', xCm: 1210, yCm: 900, version: 1 },
    ]);
  });

  it('stops placing a table picked from Add table’s menu with one Esc', async () => {
    signedIn();
    await onSeating({ 'GET /api/events/ev_1/seating-plan': () => seating(plan()) });

    fireEvent.click(await screen.findByRole('button', { name: 'Add table' }));
    const menu = screen.getByRole('menu', { name: 'Add table' });

    fireEvent.click(within(menu).getAllByRole('menuitem')[0]!);
    await screen.findByRole('checkbox', { name: 'Place another' });
    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: 'Place another' })).toBeNull(),
    );
  });

  it('reads Saved from the moment the plan opens for a host who can arrange it, and nothing for a viewer', async () => {
    signedIn();
    const { unmount } = await onSeatingMounted({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
    });

    await screen.findByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' });
    expect(document.querySelector('.st-save')?.textContent).toBe('Saved');
    expect(document.querySelector('.st-save .desk-mark.is-yes')).not.toBeNull();
    unmount();

    await onSeating(
      { 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())) },
      OWNER_PERMISSIONS.filter((one) => one !== 'seating.manage'),
    );
    await screen.findByRole('button', { name: 'Table 1, round, 0 of 10 seats taken' });
    expect(document.querySelector('.st-save')).toBeNull();
  });
});

describe('A press where a short table’s handle targets overlap (sc-5028)', () => {
  const long = table({ shape: 'rectangular', seats: 6, widthCm: 240, lengthCm: 80 }) as never;

  it('moves the table from its middle, though the n and s targets cover it', () => {
    expect(pressedHandle(long, 's', [0, 5])).toBeNull();
    expect(pressedHandle(long, 'n', [-30, -8])).toBeNull();
  });

  it('gives the drawn e handle to e, and each corner to its corner', () => {
    expect(pressedHandle(long, 'se', [120, 4])).toBe('e');
    expect(pressedHandle(long, 'e', [118, 36])).toBe('se');
    expect(pressedHandle(long, 'w', [-121, -38])).toBe('nw');
    expect(pressedHandle(long, 'sw', [-119, 2])).toBe('w');
  });

  it('keeps the edge handle a press near the edge’s middle meant', () => {
    expect(pressedHandle(long, 'n', [3, -42])).toBe('n');
  });
});

describe('The keys strip and the overlap line in the viewer’s language (sc-56839)', () => {
  const near = withTables(
    table(),
    table({ id: 't2', name: 'Table 2', xCm: 1350 }),
    table({ id: 't3', name: 'Table 3', xCm: 1050 }),
    table({ id: 't4', name: 'Table 4', yCm: 1050 }),
  );
  const firstOf = (count: number) =>
    ({ ...near, tables: near.tables.slice(0, count + 1) }) as unknown as SeatingPlan;

  afterEach(async () => {
    await act(() => i18next.changeLanguage('en'));
  });

  it('names the keys as the catalogue does', async () => {
    const { container } = render(<KeysStrip system="metric" />);
    const keys = () => [...container.querySelectorAll('kbd')].map((key) => key.textContent);

    expect(keys()).toEqual(['← ↑ → ↓', 'Shift', 'R', 'Ctrl D', 'Delete', 'Esc']);

    i18next.addResourceBundle(
      'fr',
      'translation',
      {
        seating: { keyName: { shift: 'Maj', delete: 'Suppr', esc: 'Échap', ctrl: 'Ctrl' } },
      },
      true,
      true,
    );
    try {
      await act(() => i18next.changeLanguage('fr'));
      expect(keys()).toEqual(['← ↑ → ↓', 'Maj', 'R', 'Ctrl D', 'Suppr', 'Échap']);
    } finally {
      i18next.addResourceBundle('fr', 'translation', fr, true, true);
    }
  });

  it('joins one, two and three overlapping names as a list in English', () => {
    const line = (count: number) =>
      render(<Overlaps plan={firstOf(count)} id="t1" />).container.textContent;

    expect(line(1)).toBe('Overlaps Table 2');
    expect(line(2)).toBe('Overlaps Table 2 and Table 3');
    expect(line(3)).toBe('Overlaps Table 2, Table 3 and Table 4');
  });

  it('joins them with the language’s own word in Spanish', async () => {
    await act(() => i18next.changeLanguage('es'));
    const line = (count: number) =>
      render(<Overlaps plan={firstOf(count)} id="t1" />).container.textContent;

    expect(line(1)).toBe('Se solapa con Table 2');
    expect(line(2)).toBe('Se solapa con Table 2 y Table 3');
    expect(line(3)).toBe('Se solapa con Table 2, Table 3 y Table 4');
  });

  it('says nothing for an item that overlaps nothing', () => {
    expect(render(<Overlaps plan={firstOf(0)} id="t1" />).container.textContent).toBe('');
  });
});

describe('Choosing many and the Selection tools (sc-4717)', () => {
  beforeAll(standInPointerEvents);

  const TABLE_2 = 'Table 2, round, 0 of 10 seats taken';
  const second = (more: Record<string, unknown> = {}) =>
    table({ id: 't2', name: 'Table 2', xCm: 600, ...more });

  function stepLine(): string {
    return document.querySelector('.st-under-views .st-bar p')?.textContent ?? '';
  }

  function heard(): string {
    return document.querySelector('p.visually-hidden[aria-live]')?.textContent ?? '';
  }

  function panel() {
    return within(document.querySelector<HTMLElement>('.st-panel')!);
  }

  function posted(sent: { line: string; body: unknown }[], path: string) {
    return sent
      .filter((one) => one.line.endsWith(`/seating-plan/furniture/${path}`))
      .map((one) => (one.body as { items: unknown[] }).items);
  }

  async function chooseBoth(): Promise<void> {
    await chooseTable(TABLE_1);
    fireEvent.click(screen.getByRole('button', { name: TABLE_2 }), { shiftKey: true });
    await screen.findByRole('heading', { level: 2, name: '2 chosen' });
  }

  it('chooses every item a box on the floor touches, and Shift adds a second box to the first', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
    });
    await screen.findByRole('button', { name: TABLE_1 });
    const floor = document.querySelector('.st-floor')!;
    const at = (id: string) => {
      const body = document.querySelector(`[data-table="${id}"] .st-body`)!;

      return [Number(body.getAttribute('cx')), Number(body.getAttribute('cy'))] as const;
    };
    const [x1, y1] = at('t1');
    const [x2] = at('t2');
    const pointer = { button: 0, pointerId: 1 };

    fireEvent.pointerDown(floor, { ...pointer, clientX: x2 - 4, clientY: y1 - 4 });
    fireEvent.pointerMove(window, { ...pointer, clientX: x2 + 4, clientY: y1 + 4 });
    expect(document.querySelector('.st-box-drawn')).not.toBeNull();
    fireEvent.pointerUp(window, { ...pointer, clientX: x2 + 4, clientY: y1 + 4 });
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 2' })).toBeDefined();
    expect(document.querySelector('.st-box-drawn')).toBeNull();

    fireEvent.pointerDown(floor, { ...pointer, clientX: x1 - 4, clientY: y1 - 4, shiftKey: true });
    fireEvent.pointerMove(window, { ...pointer, clientX: x1 + 4, clientY: y1 + 4 });
    fireEvent.pointerUp(window, { ...pointer, clientX: x1 + 4, clientY: y1 + 4 });
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
  });

  it('chooses all with Select all and Ctrl+A, and all of a kind from its menu', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
    });
    await screen.findByRole('button', { name: TABLE_1 });

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: '2 chosen' })).toBeNull());

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });

    const kinds = screen.getByRole('button', { name: 'Select all of a kind' });

    fireEvent.click(kinds);
    expect(kinds.getAttribute('aria-expanded')).toBe('true');
    const menu = within(screen.getByRole('menu', { name: 'Select all of a kind' }));

    expect(menu.getByRole('menuitem', { name: /^Rows/u })).toHaveProperty('disabled', true);
    expect(menu.getByRole('menuitem', { name: /^Rows/u }).textContent).toBe('RowsNone');
    fireEvent.click(menu.getByRole('menuitem', { name: /^Round tables/u }));
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('adds by a click while Add to choice is on, shows its rules, and Esc turns it off before letting go', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
    });
    await screen.findByRole('button', { name: TABLE_1 });
    const add = screen.getByRole('button', { name: 'Add to choice' });

    fireEvent.click(add);
    expect(add.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('note', { name: 'While Add to choice is on' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: TABLE_1 }));
    fireEvent.click(screen.getByRole('button', { name: TABLE_2 }));
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    expect(
      screen.getByText(
        'Esc turns Add to choice off and keeps these chosen. Esc again lets go of them.',
      ),
    ).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(add.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: '2 chosen' })).toBeNull());
  });

  it('takes a chosen item out, adds what a box touches and keeps the choice on empty floor, while Add to choice is on', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withTables(table(), second(), table({ id: 't3', name: 'Table 3', xCm: 1800 }))),
    });
    await screen.findByRole('button', { name: TABLE_1 });
    const TABLE_3 = 'Table 3, round, 0 of 10 seats taken';

    fireEvent.click(screen.getByRole('button', { name: 'Add to choice' }));
    fireEvent.click(screen.getByRole('button', { name: TABLE_1 }));
    fireEvent.click(screen.getByRole('button', { name: TABLE_2 }));
    fireEvent.click(screen.getByRole('button', { name: TABLE_3 }));
    expect(await screen.findByRole('heading', { level: 2, name: '3 chosen' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: TABLE_3 }));
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();

    const floor = document.querySelector('.st-floor')!;

    fireEvent.click(floor);
    expect(screen.getByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();

    const body = document.querySelector('[data-table="t3"] .st-body')!;
    const [x, y] = [Number(body.getAttribute('cx')), Number(body.getAttribute('cy'))];
    const pointer = { button: 0, pointerId: 1 };

    fireEvent.pointerDown(floor, { ...pointer, clientX: x - 4, clientY: y - 4 });
    fireEvent.pointerMove(window, { ...pointer, clientX: x + 4, clientY: y + 4 });
    fireEvent.pointerUp(window, { ...pointer, clientX: x + 4, clientY: y + 4 });
    expect(await screen.findByRole('heading', { level: 2, name: '3 chosen' })).toBeDefined();
  });

  it('adds and takes out by Enter and Space while Add to choice is on, and by Shift+Enter and Shift+Space while it is off', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withTables(table(), second(), table({ id: 't3', name: 'Table 3', xCm: 1800 }))),
    });
    await screen.findByRole('button', { name: TABLE_1 });
    const TABLE_3 = 'Table 3, round, 0 of 10 seats taken';
    const item = (name: string) => screen.getByRole('button', { name });
    const space = (name: string, shiftKey = false) => {
      act(() => item(name).focus());
      fireEvent.keyDown(item(name), { key: ' ', shiftKey });
      fireEvent.keyUp(item(name), { key: ' ', shiftKey });
    };

    fireEvent.click(screen.getByRole('button', { name: 'Add to choice' }));
    fireEvent.keyDown(item(TABLE_1), { key: 'Enter' });
    space(TABLE_2);
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    fireEvent.keyDown(item(TABLE_3), { key: 'Enter' });
    expect(await screen.findByRole('heading', { level: 2, name: '3 chosen' })).toBeDefined();
    space(TABLE_3);
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    fireEvent.keyDown(item(TABLE_3), { key: 'Enter', shiftKey: true });
    expect(await screen.findByRole('heading', { level: 2, name: '3 chosen' })).toBeDefined();
    space(TABLE_1, true);
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();

    fireEvent.keyDown(item(TABLE_1), { key: 'Enter' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
  });

  it('aligns as one step that Undo puts back, announcing each once it is saved', async () => {
    signedIn();
    let steps = 0;
    let answer: (response: Response) => void = () => {};
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        new Promise<Response>((done) => {
          steps += 1;
          answer = done;
        }),
    });

    await chooseBoth();
    expect(panel().getByRole('button', { name: 'Across' })).toHaveProperty('disabled', true);
    expect(panel().getByText('Choose 3 or more to space evenly.')).toBeDefined();
    fireEvent.click(panel().getByRole('button', { name: 'Left' }));
    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    expect(furniture(sent)[0]).toEqual([
      { kind: 'table', id: 't1', xCm: 600, yCm: 900, version: 1 },
      { kind: 'table', id: 't2', xCm: 600, yCm: 900, version: 1 },
    ]);
    expect(heard()).toBe('');
    expect(stepLine()).toBe('');
    answer(seating(withTables(table({ xCm: 600, version: 2 }), second({ version: 2 }))));
    await waitFor(() => expect(heard()).toBe('2 tables lined up on their left edges.'));
    expect(stepLine()).toBe('2 tables lined up on their left edges.');
    expect(
      screen.getByRole('button', { name: 'Undo' }).closest('.st-bar-body')?.querySelector('p')
        ?.textContent,
    ).toBe('2 tables lined up on their left edges.');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(furniture(sent)).toHaveLength(2));
    expect(furniture(sent)[1]).toEqual([
      { kind: 'table', id: 't1', xCm: 1200, yCm: 900, version: 2 },
      { kind: 'table', id: 't2', xCm: 600, yCm: 900, version: 2 },
    ]);
    expect(heard()).toBe('2 tables lined up on their left edges.');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    answer(seating(withTables(table({ version: 3 }), second({ version: 3 }))));
    await waitFor(() => expect(heard()).toBe('Undone. Everything is back as it was.'));
    expect(steps).toBe(2);
  });

  it('puts no Undo up for a move saved while a later move waits, only for the later one', async () => {
    signedIn();
    const answers: ((response: Response) => void)[] = [];
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        new Promise<Response>((done) => {
          answers.push(done);
        }),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Left' }));
    fireEvent.click(panel().getByRole('button', { name: 'Right' }));
    await waitFor(() => expect(furniture(sent)).toHaveLength(1));
    answers[0]!(seating(withTables(table({ xCm: 600, version: 2 }), second({ version: 2 }))));
    await waitFor(() => expect(furniture(sent)).toHaveLength(2));
    expect(heard()).toBe('2 tables lined up on their left edges.');
    expect(stepLine()).toBe('');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();

    answers[1]!(seating(withTables(table({ version: 3 }), second({ xCm: 1200, version: 3 }))));
    await waitFor(() => expect(stepLine()).toBe('2 tables lined up on their right edges.'));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined();
  });

  it('refuses a grid too wide for the room or out of range, beside its fields', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating({ ...withTables(table(), second()), widthCm: 1400 }),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Arrange in a grid' }));
    fireEvent.change(panel().getByLabelText('Columns'), { target: { value: '0' } });
    fireEvent.change(panel().getByLabelText('Gap (m)'), { target: { value: '12' } });
    fireEvent.click(panel().getByRole('button', { name: 'Apply' }));
    expect(panel().getByText('Enter a number of columns from 1 to 20.')).toBeDefined();
    expect(panel().getByText('Enter a gap from 0 to 10 m.')).toBeDefined();

    fireEvent.change(panel().getByLabelText('Columns'), { target: { value: '2' } });
    fireEvent.change(panel().getByLabelText('Gap (m)'), { target: { value: '10' } });
    expect(document.querySelectorAll('.st-outline')).toHaveLength(2);
    fireEvent.click(panel().getByRole('button', { name: 'Apply' }));
    expect(panel().getByRole('alert').textContent).toMatch(
      /^This grid is .+ wide; the room is 14/u,
    );
    expect(furniture(sent)).toEqual([]);
  });

  it('refuses a grid too wide for a room in feet, in feet', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        json({
          seating: {
            measurementSystem: 'us',
            plan: { ...withTables(table({ xCm: 900 }), second({ xCm: 300 })), widthCm: 1200 },
          },
        }),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Arrange in a grid' }));
    fireEvent.change(panel().getByLabelText('Columns'), { target: { value: '2' } });
    fireEvent.change(panel().getByLabelText('Gap (ft)'), { target: { value: '33' } });
    fireEvent.click(panel().getByRole('button', { name: 'Apply' }));
    expect(panel().getByText('Enter a gap from 0 to 32 ft.')).toBeDefined();

    fireEvent.change(panel().getByLabelText('Gap (ft)'), { target: { value: '32' } });
    fireEvent.click(panel().getByRole('button', { name: 'Apply' }));
    expect(panel().getByRole('alert').textContent).toMatch(
      /^This grid is 50\sft\s4\sin wide; the room is 39\sft\s4\sin\.$/u,
    );
    expect(furniture(sent)).toEqual([]);
  });

  it('renumbers the chosen tables in reading order, refusing a name a table outside them keeps', async () => {
    signedIn();
    const third = table({ id: 't3', name: 'Table 3', xCm: 600, yCm: 300 });
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second(), third)),
      'PATCH /api/events/ev_1/seating-plan/furniture/names': () =>
        seating(withTables(table({ name: 'Table 6' }), second({ name: 'Table 5' }), third)),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Renumber' }));
    fireEvent.change(panel().getByLabelText('Start at'), { target: { value: '2' } });
    fireEvent.click(panel().getByRole('button', { name: 'Apply' }));
    expect(
      panel().getByText('Table 3 is already taken by a table you did not choose.'),
    ).toBeDefined();
    expect(posted(sent, 'names')).toEqual([]);

    fireEvent.change(panel().getByLabelText('Start at'), { target: { value: '5' } });
    fireEvent.click(panel().getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(posted(sent, 'names')).toHaveLength(1));
    expect(posted(sent, 'names')[0]).toEqual([
      { id: 't2', name: 'Table 5', version: 1 },
      { id: 't1', name: 'Table 6', version: 1 },
    ]);
    await waitFor(() =>
      expect(stepLine()).toBe(
        '2 tables renumbered from 5 to 6, top to bottom, left to right. Guests kept their seats.',
      ),
    );
  });

  it('puts the chosen in a section as one step', async () => {
    signedIn();
    const sections = [{ id: 's1', name: 'Terrace', colour: 'teal' }];
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating({ ...withTables(table(), second()), sections: plan(sections).sections }),
      'PATCH /api/events/ev_1/seating-plan/furniture/sections': () =>
        seating({
          ...withTables(table({ sectionId: 's1' }), second({ sectionId: 's1' })),
          sections: plan(sections).sections,
        }),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Section' }));
    fireEvent.click(panel().getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(posted(sent, 'sections')).toHaveLength(1));
    expect(posted(sent, 'sections')[0]).toEqual([
      { kind: 'table', id: 't1', version: 1, sectionId: 's1' },
      { kind: 'table', id: 't2', version: 1, sectionId: 's1' },
    ]);
    await waitFor(() => expect(stepLine()).toBe('2 tables now in Terrace.'));
  });

  it('duplicates the chosen, chooses the copies, and Undo deletes them', async () => {
    signedIn();
    const copies = [
      table({ id: 't3', name: 'Table 3', xCm: 650, yCm: 950 }),
      table({ id: 't4', name: 'Table 4', xCm: 1250, yCm: 950 }),
    ];
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
      'POST /api/events/ev_1/seating-plan/furniture/duplicate': () =>
        json(
          {
            seating: {
              measurementSystem: 'metric',
              plan: withTables(table(), second(), ...copies),
            },
            chosen: ['t3', 't4'],
          },
          201,
        ),
      'POST /api/events/ev_1/seating-plan/furniture/delete': () =>
        moved(withTables(table(), second()), []),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Duplicate' }));
    await waitFor(() =>
      expect(stepLine()).toBe(
        '2 copies added 50 cm down and to the right, with nobody seated. The copies are chosen.',
      ),
    );
    expect(posted(sent, 'duplicate')[0]).toEqual([
      { kind: 'table', id: 't1', version: 1 },
      { kind: 'table', id: 't2', version: 1 },
    ]);
    expect(document.querySelector('[data-table="t3"][aria-pressed="true"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(posted(sent, 'delete')).toHaveLength(1));
    expect(posted(sent, 'delete')[0]).toEqual([
      { kind: 'table', id: 't3', version: 1 },
      { kind: 'table', id: 't4', version: 1 },
    ]);
  });

  it("takes the copy's Undo down while a delete is saving, and offers the delete's Undo once it lands", async () => {
    signedIn();
    const copies = [
      table({ id: 't3', name: 'Table 3', xCm: 650, yCm: 950 }),
      table({ id: 't4', name: 'Table 4', xCm: 1250, yCm: 950 }),
    ];
    let deleted: (answer: Response) => void = () => {};
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
      'POST /api/events/ev_1/seating-plan/furniture/duplicate': () =>
        json(
          {
            seating: {
              measurementSystem: 'metric',
              plan: withTables(table(), second(), ...copies),
            },
            chosen: ['t3', 't4'],
          },
          201,
        ),
      'POST /api/events/ev_1/seating-plan/furniture/delete': () =>
        new Promise<Response>((done) => {
          deleted = done;
        }),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(stepLine()).toContain('2 copies added'));
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(panel().getByRole('button', { name: 'Delete' }));
    const ask = within(await screen.findByRole('alertdialog'));

    fireEvent.click(ask.getByRole('button', { name: 'Delete 4 tables' }));
    await waitFor(() => expect(posted(sent, 'delete')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    deleted(moved(withTables(), []));

    await waitFor(() => expect(stepLine()).toBe('4 tables deleted.'));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined();
    expect(posted(sent, 'delete')).toHaveLength(1);
  });

  it("takes a section step's Undo down while a delete is saving, so it is never sent for deleted tables", async () => {
    signedIn();
    const sections = [{ id: 's1', name: 'Terrace', colour: 'teal' }];
    let deleted: (answer: Response) => void = () => {};
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating({ ...withTables(table(), second()), sections: plan(sections).sections }),
      'PATCH /api/events/ev_1/seating-plan/furniture/sections': () =>
        seating({
          ...withTables(
            table({ sectionId: 's1', version: 2 }),
            second({ sectionId: 's1', version: 2 }),
          ),
          sections: plan(sections).sections,
        }),
      'POST /api/events/ev_1/seating-plan/furniture/delete': () =>
        new Promise<Response>((done) => {
          deleted = done;
        }),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Section' }));
    fireEvent.click(panel().getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(stepLine()).toBe('2 tables now in Terrace.'));
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(panel().getByRole('button', { name: 'Delete' }));
    const ask = within(await screen.findByRole('alertdialog'));

    fireEvent.click(ask.getByRole('button', { name: 'Delete 2 tables' }));
    await waitFor(() => expect(posted(sent, 'delete')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    deleted(moved({ ...withTables(), sections: plan(sections).sections }, []));

    await waitFor(() => expect(stepLine()).toBe('2 tables deleted.'));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined();
    expect(posted(sent, 'sections')).toHaveLength(1);
  });

  it('asks before deleting the chosen, and Undo puts them back', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
      'POST /api/events/ev_1/seating-plan/furniture/delete': () => moved(withTables(), []),
      'POST /api/events/ev_1/seating-plan/furniture/restore': () =>
        json(
          {
            seating: {
              measurementSystem: 'metric',
              plan: withTables(table({ id: 't5' }), second({ id: 't6' })),
            },
            chosen: ['t5', 't6'],
          },
          201,
        ),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Delete' }));
    const ask = within(await screen.findByRole('alertdialog'));

    expect(ask.getByText('Delete 2 tables?')).toBeDefined();
    expect(ask.getByText('Nobody is seated in them.')).toBeDefined();
    fireEvent.click(ask.getByRole('button', { name: 'Delete 2 tables' }));
    await waitFor(() => expect(stepLine()).toBe('2 tables deleted.'));
    expect(posted(sent, 'delete')[0]).toEqual([
      { kind: 'table', id: 't1', version: 1 },
      { kind: 'table', id: 't2', version: 1 },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(posted(sent, 'restore')).toHaveLength(1));
    expect(posted(sent, 'restore')[0]).toEqual([
      expect.objectContaining({ kind: 'table', name: 'Table 1', xCm: 1200, yCm: 900 }),
      expect.objectContaining({ kind: 'table', name: 'Table 2', xCm: 600, yCm: 900 }),
    ]);
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
  });

  it('says who changed a chosen table first when a step comes back 412, keeping the choice', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())),
      'PATCH /api/events/ev_1/seating-plan/furniture': () =>
        problem('precondition_failed', 412, { stale: ['t2'], changedBy: 'Bola Ade' }),
    });

    await chooseBoth();
    fireEvent.click(panel().getByRole('button', { name: 'Left' }));
    await waitFor(() =>
      expect(stepLine()).toBe(
        'Bola Ade changed Table 2 after you chose it, so nothing moved. The plan now shows the change; try again.',
      ),
    );
    expect(screen.getByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    for (const live of document.querySelectorAll('[aria-live]'))
      expect(live.textContent).not.toContain('lined up');
  });

  it('offers none of this without seating.manage', async () => {
    signedIn();
    await onSeating(
      { 'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second())) },
      OWNER_PERMISSIONS.filter((one) => one !== 'seating.manage'),
    );
    await screen.findByRole('button', { name: TABLE_1 });

    expect(screen.queryByRole('button', { name: 'Select all' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add to choice' })).toBeNull();
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(screen.queryByRole('heading', { name: '2 chosen' })).toBeNull();
  });
});

describe('Who else is on the plan (sc-4719)', () => {
  const before = config();
  const LIST = 'GET /.well-known/mercure/subscriptions/events%2Fev_1%2Fseating';
  const tab = (subscriber: string, userId: string, name: string, editor = true, active = true) => ({
    type: 'Subscription',
    subscriber,
    topic: realtimeTopic('EventSeating', 'ev_1'),
    active,
    payload: { userId, name, editor },
  });
  const PRIYA = tab('urn:uuid:p1', 'u_priya', 'Priya Shah');
  const SADE = tab('urn:uuid:s1', 'u_sade', 'Sade Bello', false);
  const ME = tab('urn:uuid:me', 'u_folake', 'Folake Adeyemi');

  beforeAll(standInPointerEvents);

  afterEach(() => {
    vi.useRealTimers();
    __setConfig(before);
    vi.unstubAllGlobals();
  });

  async function onPlanWith(
    here: unknown[],
    permissions: string[] = OWNER_PERMISSIONS,
    more: Record<string, Answer> = {},
  ) {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
    signedIn();
    const sent = await onSeating(
      {
        'GET /api/events/ev_1/seating-plan': () => seating(withTables(table())),
        'POST /api/events/ev_1/seating-plan/subscriptions': () =>
          json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
        'POST /api/realtime/subscriptions': () =>
          json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
        [LIST]: () => json({ subscriptions: here }),
        ...more,
      },
      permissions,
    );
    const seatingSource = () =>
      StubSource.made.find((one) => decodeURIComponent(one.url).includes('/seating'));
    await waitFor(() => expect(seatingSource()).toBeDefined());
    const source = seatingSource()!;
    act(() => source.onopen?.());
    await screen.findByRole('button', { name: TABLE_1 });

    return { sent, source };
  }

  const chosenSent = (sent: { line: string; body: unknown }[]) =>
    sent
      .filter((one) => one.line === 'PUT /api/events/ev_1/seating-plan/chosen')
      .map((one) => one.body);

  it('subscribes to the plan, its editors’ choices and who has it open, on one connection', async () => {
    const { source } = await onPlanWith([]);
    const topics = new URL(source.url).searchParams.getAll('topic');

    expect(topics).toEqual([
      realtimeTopic('EventSeating', 'ev_1'),
      realtimeTopic('EventSeatingChoices', 'ev_1'),
      '/.well-known/mercure/subscriptions/events%2Fev_1%2Fseating{/subscriber}',
    ]);
  });

  it('shows nothing when you are alone, and never yourself', async () => {
    await onPlanWith([ME]);

    expect(document.querySelector('.st-faces')).toBeNull();
    expect(screen.queryByText(/is on this plan/)).toBeNull();
  });

  it('shows two people as one chip and says who is on the plan', async () => {
    await onPlanWith([ME, PRIYA]);

    expect(await screen.findByRole('button', { name: 'Priya Shah' })).toBeDefined();
    expect(screen.getByText('Priya Shah is on this plan')).toBeDefined();
    expect(screen.getByRole('list', { name: 'Priya Shah is on this plan' })).toBeDefined();
  });

  it('counts three people, each once however many tabs they have, and says who can only view', async () => {
    await onPlanWith([ME, PRIYA, tab('urn:uuid:p2', 'u_priya', 'Priya Shah'), SADE]);

    const chips = await screen.findByRole('list', { name: 'Priya Shah and 1 other' });
    expect(
      within(chips)
        .getAllByRole('button')
        .map((one) => one.getAttribute('aria-label')),
    ).toEqual(['Priya Shah', 'Sade Bello, can view']);
    expect(chips.textContent).toBe('PSSB');
  });

  it('shows four chips and +n from six people, and lists them all', async () => {
    const six = [
      'Priya Shah',
      'Sade Bello',
      'Ana Souza',
      'Julien Moreau',
      'Kemi Okafor',
      'Tom Baker',
    ];
    await onPlanWith(six.map((name, index) => tab(`urn:uuid:${index}`, `u_${index}`, name)));

    const more = await screen.findByRole('button', { name: '2 more on this plan' });
    expect(more.textContent).toBe('+2');
    fireEvent.click(more);
    const list = screen.getByRole('dialog', { name: 'On this plan' });
    expect([...list.querySelectorAll('.st-row-name')].map((one) => one.textContent)).toEqual(six);
  });

  it('announces someone joining and leaving politely, but not their second tab', async () => {
    const { source } = await onPlanWith([ME]);
    const heard = () => document.querySelector('.st-top [aria-live="polite"]')?.textContent;

    source.publish(tab('urn:uuid:k1', 'u_kemi', 'Kemi Adeyemi'));
    await waitFor(() => expect(heard()).toBe('Kemi Adeyemi joined the plan.'));
    expect(screen.getByRole('button', { name: 'Kemi Adeyemi' })).toBeDefined();

    source.publish(tab('urn:uuid:k2', 'u_kemi', 'Kemi Adeyemi'));
    source.publish(tab('urn:uuid:k2', 'u_kemi', 'Kemi Adeyemi', true, false));
    expect(heard()).toBe('Kemi Adeyemi joined the plan.');
    expect(screen.getByRole('button', { name: 'Kemi Adeyemi' })).toBeDefined();

    source.publish(tab('urn:uuid:k1', 'u_kemi', 'Kemi Adeyemi', true, false));
    await waitFor(() => expect(heard()).toBe('Kemi Adeyemi left the plan.'), { timeout: 2_000 });
    expect(screen.queryByRole('button', { name: 'Kemi Adeyemi' })).toBeNull();
  });

  it('outlines what a colleague chooses with their initials and names them, until they clear it', async () => {
    const { source } = await onPlanWith([ME, PRIYA]);

    source.publish({ userId: 'u_priya', chosen: { kind: 'table', id: 't1', chair: null } });
    const chosen = await screen.findByRole('button', { name: `${TABLE_1}, chosen by Priya Shah` });
    expect(chosen.querySelector('.st-ring.p0')).not.toBeNull();
    expect(chosen.querySelector('.st-initials')?.textContent).toBe('PS');

    source.publish({ userId: 'u_priya', chosen: null });
    await screen.findByRole('button', { name: TABLE_1 });
    expect(document.querySelector('.st-ring')).toBeNull();
  });

  it('rings two colleagues on one table in the order they chose it, and a chosen seat on its chair (#60871)', async () => {
    const KEMI = tab('urn:uuid:k1', 'u_kemi', 'Kemi Adeyemi');
    const JULIEN = tab('urn:uuid:j1', 'u_julien', 'Julien Moreau');
    const { source } = await onPlanWith([ME, PRIYA, KEMI, JULIEN]);
    const pills = () =>
      [...document.querySelectorAll('[data-table="t1"] .st-ring .st-initials')].map(
        (one) => one.textContent,
      );

    source.publish({ userId: 'u_kemi', chosen: { kind: 'table', id: 't1', chair: null } });
    source.publish({ userId: 'u_priya', chosen: { kind: 'table', id: 't1', chair: null } });
    source.publish({ userId: 'u_julien', chosen: { kind: 'table', id: 't1', chair: 2 } });
    await screen.findByRole('button', {
      name: `${TABLE_1}, chosen by Kemi Adeyemi and Priya Shah, seat 2 chosen by Julien Moreau`,
    });
    expect(pills()).toEqual(['KA', 'PS', 'JM']);
    const [inner, outer] = [...document.querySelectorAll('[data-table="t1"] .st-ring-gap')].map(
      (one) => Number(one.getAttribute('r')),
    );
    expect(outer! - inner!).toBe(5);

    const seat = document.querySelector('[data-table="t1"] .st-ring:last-child circle');
    const chair = document.querySelectorAll('[data-table="t1"] .st-chair')[1];
    expect(seat?.getAttribute('cx')).toBe(chair?.getAttribute('cx'));

    while (Number(percent().replace('%', '')) >= 50) press('Zoom out');
    expect(document.querySelectorAll('.st-room .st-chair')).toHaveLength(0);
    expect(pills()).toEqual(['KA', 'PS', 'JM']);
    const rings = [...document.querySelectorAll('[data-table="t1"] .st-ring-gap')].map((one) =>
      one.getAttribute('cx'),
    );
    expect(new Set(rings).size).toBe(1);
  });

  it('moves a colleague who chooses again to the outside ring, after the later choice (#60848)', async () => {
    const KEMI = tab('urn:uuid:k1', 'u_kemi', 'Kemi Adeyemi');
    const { source } = await onPlanWith([ME, PRIYA, KEMI], OWNER_PERMISSIONS, {
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withTables(table(), table({ id: 't2', name: 'Table 2', xCm: 400 }))),
    });
    const pills = () =>
      [...document.querySelectorAll('[data-table="t1"] .st-ring .st-initials')].map(
        (one) => one.textContent,
      );

    source.publish({ userId: 'u_kemi', chosen: { kind: 'table', id: 't1', chair: null } });
    source.publish({ userId: 'u_priya', chosen: { kind: 'table', id: 't1', chair: null } });
    source.publish({ userId: 'u_kemi', chosen: { kind: 'table', id: 't2', chair: null } });
    await waitFor(() => expect(pills()).toEqual(['PS']));
    source.publish({ userId: 'u_kemi', chosen: { kind: 'table', id: 't1', chair: null } });

    await screen.findByRole('button', {
      name: `${TABLE_1}, chosen by Priya Shah and Kemi Adeyemi`,
    });
    expect(pills()).toEqual(['PS', 'KA']);
  });

  it('names who chose a seat on the chair itself (#60848)', async () => {
    const JULIEN = tab('urn:uuid:j1', 'u_julien', 'Julien Moreau');
    const { source } = await onPlanWith([ME, JULIEN]);

    source.publish({ userId: 'u_julien', chosen: { kind: 'table', id: 't1', chair: 2 } });
    await screen.findByRole('button', { name: `${TABLE_1}, seat 2 chosen by Julien Moreau` });
    while (Number(percent().replace('%', '')) < 150) press('Zoom in');

    expect(
      screen.getByRole('button', { name: 'Table 1, Seat 2, Empty, chosen by Julien Moreau' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Table 1, Seat 3, Empty' })).toBeDefined();
  });

  it('drops a colleague’s outline when they close the plan', async () => {
    const { source } = await onPlanWith([ME, PRIYA]);

    source.publish({ userId: 'u_priya', chosen: { kind: 'table', id: 't1', chair: null } });
    await screen.findByRole('button', { name: `${TABLE_1}, chosen by Priya Shah` });
    source.publish({ ...PRIYA, active: false });

    await screen.findByRole('button', { name: TABLE_1 }, { timeout: 2_000 });
    expect(document.querySelector('.st-ring')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Priya Shah' })).toBeNull();
  });

  it('announces nothing and keeps the outline when a colleague’s connection renews', async () => {
    const { source } = await onPlanWith([ME, PRIYA]);
    const heard = () => document.querySelector('.st-top [aria-live="polite"]')?.textContent ?? '';
    source.publish({ userId: 'u_priya', chosen: { kind: 'table', id: 't1', chair: null } });
    await screen.findByRole('button', { name: `${TABLE_1}, chosen by Priya Shah` });

    source.publish({ ...PRIYA, active: false });
    source.publish(tab('urn:uuid:p9', 'u_priya', 'Priya Shah'));
    await new Promise((done) => setTimeout(done, 1_200));

    expect(heard()).toBe('');
    expect(screen.getByRole('button', { name: 'Priya Shah' })).toBeDefined();
    expect(screen.getByRole('button', { name: `${TABLE_1}, chosen by Priya Shah` })).toBeDefined();
  });

  it('asks again for who is here when the list fails, while the connection stays open', async () => {
    let asked = 0;
    await onPlanWith([], OWNER_PERMISSIONS, {
      [LIST]: () => (++asked === 1 ? json({}, 404) : json({ subscriptions: [ME, PRIYA] })),
    });
    expect(await screen.findByText('Can’t see who else is here. Reconnecting…')).toBeDefined();

    expect(
      await screen.findByRole('button', { name: 'Priya Shah' }, { timeout: 7_000 }),
    ).toBeDefined();
    expect(screen.queryByText('Can’t see who else is here. Reconnecting…')).toBeNull();
    expect(asked).toBe(2);
  }, 10_000);

  it('never outlines what a viewer chooses', async () => {
    const { source } = await onPlanWith([ME, SADE]);

    source.publish({ userId: 'u_sade', chosen: { kind: 'table', id: 't1', chair: null } });

    await screen.findByRole('button', { name: 'Sade Bello, can view' });
    expect(screen.getByRole('button', { name: TABLE_1 })).toBeDefined();
    expect(document.querySelector('.st-ring')).toBeNull();
  });

  it('tells colleagues what you choose and clear, and again when someone arrives', async () => {
    const { sent, source } = await onPlanWith([ME]);

    await chooseTable(TABLE_1);
    await waitFor(() =>
      expect(chosenSent(sent)).toEqual([{ chosen: { kind: 'table', id: 't1', chair: null } }]),
    );

    source.publish(PRIYA);
    await waitFor(() => expect(chosenSent(sent)).toHaveLength(2));

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(chosenSent(sent).at(-1)).toEqual({ chosen: null }));
  });

  it('never tells anyone what a viewer chooses', async () => {
    const { sent } = await onPlanWith([ME, PRIYA], ['events.read', 'seating.read']);

    await chooseTable(TABLE_1);

    expect(chosenSent(sent)).toEqual([]);
  });

  it('says in the panel when you choose what a colleague has, and changes nothing', async () => {
    const { source } = await onPlanWith([ME, PRIYA]);

    source.publish({ userId: 'u_priya', chosen: { kind: 'table', id: 't1', chair: null } });
    await chooseTable(`${TABLE_1}, chosen by Priya Shah`);

    expect(
      screen.getByText(
        'Priya Shah has chosen this too. You can still change it. If you both save, the later change is refused and says why.',
      ),
    ).toBeDefined();
    expect(screen.getByLabelText('Seats')).not.toHaveProperty('disabled', true);
  });

  it('hides the chips and every colleague’s ring, and says so, when its own connection drops (#62213)', async () => {
    const { source } = await onPlanWith([ME, PRIYA]);
    source.publish({ userId: 'u_priya', chosen: { kind: 'table', id: 't1', chair: null } });
    await screen.findByRole('button', { name: `${TABLE_1}, chosen by Priya Shah` });

    act(() => source.onerror?.());

    expect(await screen.findByText('Can’t see who else is here. Reconnecting…')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Priya Shah' })).toBeNull();
    expect(screen.getByRole('button', { name: TABLE_1 })).toBeDefined();
    expect(document.querySelector('.st-ring')).toBeNull();
    expect(source.readyState).toBe(StubSource.CLOSED);
  });

  const seatingSources = () =>
    StubSource.made.filter((one) => decodeURIComponent(one.url).includes('/seating'));
  const beatsSent = (sent: { line: string }[]) =>
    sent.filter((one) => one.line === 'POST /api/events/ev_1/seating-plan/here').length;
  const heardOwn = (source: StubSource) => source.publish({ userId: 'u_folake', here: true });

  it('says it is still here every 5 seconds while its connection is open, as a viewer too', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { sent, source } = await onPlanWith([ME], ['events.read', 'seating.read']);
    await waitFor(() => expect(beatsSent(sent)).toBe(1));

    act(() => vi.advanceTimersByTime(5_000));
    heardOwn(source);

    await waitFor(() => expect(beatsSent(sent)).toBe(2));
  });

  it('lets a colleague whose connection died without a word go within 30 seconds, ring and all, and back once heard (#62200)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { source } = await onPlanWith([ME, PRIYA]);
    const heard = () => document.querySelector('.st-top [aria-live="polite"]')?.textContent ?? '';
    source.publish({ userId: 'u_priya', chosen: { kind: 'table', id: 't1', chair: null } });
    await screen.findByRole('button', { name: `${TABLE_1}, chosen by Priya Shah` });

    for (let second = 0; second < 30; second += 1) {
      act(() => vi.advanceTimersByTime(1_000));
      heardOwn(source);
    }

    expect(screen.queryByRole('button', { name: 'Priya Shah' })).toBeNull();
    expect(screen.getByRole('button', { name: TABLE_1 })).toBeDefined();
    expect(document.querySelector('.st-ring')).toBeNull();
    expect(heard()).toBe('Priya Shah left the plan.');
    expect(screen.queryByText('Can’t see who else is here. Reconnecting…')).toBeNull();

    source.publish({ userId: 'u_priya', here: true });

    expect(await screen.findByRole('button', { name: 'Priya Shah' })).toBeDefined();
    expect(heard()).toBe('Priya Shah joined the plan.');
  });

  it('keeps a colleague who keeps saying they are here', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { source } = await onPlanWith([ME, PRIYA]);
    await screen.findByRole('button', { name: 'Priya Shah' });

    for (let second = 0; second < 30; second += 1) {
      act(() => vi.advanceTimersByTime(1_000));
      heardOwn(source);
      if (second % 5 === 0) source.publish({ userId: 'u_priya', here: true });
    }

    expect(screen.getByRole('button', { name: 'Priya Shah' })).toBeDefined();
  });

  it('takes its own connection for dead when it hears nothing, says so, and opens a new one (#62200)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { source } = await onPlanWith([ME, PRIYA]);
    await screen.findByRole('button', { name: 'Priya Shah' });

    act(() => vi.advanceTimersByTime(13_000));

    expect(await screen.findByText('Can’t see who else is here. Reconnecting…')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Priya Shah' })).toBeNull();
    expect(source.readyState).toBe(StubSource.CLOSED);

    act(() => vi.advanceTimersByTime(5_000));
    await waitFor(() => expect(seatingSources()).toHaveLength(2));
    act(() => seatingSources()[1]!.onopen?.());

    expect(await screen.findByRole('button', { name: 'Priya Shah' })).toBeDefined();
  });

  class StubWorker {
    static made: StubWorker[] = [];
    url = '';
    every = 0;
    onmessage: (() => void) | null = null;
    onerror: (() => void) | null = null;
    terminated = false;
    constructor(url: URL) {
      this.url = url.href;
      StubWorker.made.push(this);
    }
    postMessage(ms: number) {
      this.every = ms;
    }
    terminate() {
      this.terminated = true;
    }
  }

  it('beats from a worker served from its own origin, whose timers a hidden tab does not hold back to one a minute', async () => {
    StubWorker.made = [];
    vi.stubGlobal('Worker', StubWorker);
    const { sent } = await onPlanWith([ME]);
    await waitFor(() => expect(beatsSent(sent)).toBe(1));
    const beating = StubWorker.made.find((one) => one.every === 5_000)!;

    expect(new URL(beating.url).origin).toBe(window.location.origin);

    act(() => beating.onmessage?.());

    await waitFor(() => expect(beatsSent(sent)).toBe(2));
  });

  it('beats from the page when the worker is refused after it was made, rather than going silent', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    StubWorker.made = [];
    vi.stubGlobal('Worker', StubWorker);
    const { sent, source } = await onPlanWith([ME]);
    await waitFor(() => expect(beatsSent(sent)).toBe(1));

    act(() => StubWorker.made.forEach((one) => one.onerror?.()));
    act(() => vi.advanceTimersByTime(5_000));
    heardOwn(source);

    await waitFor(() => expect(beatsSent(sent)).toBe(2));
    expect(StubWorker.made.every((one) => one.terminated)).toBe(true);
  });

  it('neither leaves nor reconnects when its timers wake a minute late, and says it is here at once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { sent, source } = await onPlanWith([ME, PRIYA]);
    const heard = () => document.querySelector('.st-top [aria-live="polite"]')?.textContent ?? '';
    await waitFor(() => expect(beatsSent(sent)).toBe(1));

    vi.setSystemTime(Date.now() + 60_000);
    act(() => vi.advanceTimersByTime(1_000));
    act(() => vi.advanceTimersByTime(1_000));

    await waitFor(() => expect(beatsSent(sent)).toBeGreaterThanOrEqual(2));
    expect(screen.queryByText('Can’t see who else is here. Reconnecting…')).toBeNull();
    expect(source.readyState).not.toBe(StubSource.CLOSED);
    expect(seatingSources()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Priya Shah' })).toBeDefined();
    expect(heard()).not.toContain('left the plan');
  });

  it('shows no email address', async () => {
    await onPlanWith([ME, PRIYA, SADE]);
    await screen.findByRole('button', { name: 'Priya Shah' });

    expect(document.body.textContent).not.toContain('@');
  });
});

describe('A second finger on a box pans and keeps the choice (sc-60666)', () => {
  beforeAll(standInPointerEvents);

  const TABLE_2 = 'Table 2, round, 0 of 10 seats taken';
  const threeTables = () =>
    seating(
      withTables(
        table(),
        table({ id: 't2', name: 'Table 2', xCm: 600 }),
        table({ id: 't3', name: 'Table 3', xCm: 1800 }),
      ),
    );

  function finger(
    kind: 'down' | 'move' | 'up',
    id: number,
    [clientX, clientY]: readonly [number, number],
    on: Element | Window = window,
  ): void {
    const init = { button: 0, pointerId: id, pointerType: 'touch', clientX, clientY };

    if (kind === 'down') fireEvent.pointerDown(on, init);
    else if (kind === 'move') fireEvent.pointerMove(on, init);
    else fireEvent.pointerUp(on, init);
  }

  function centre(id: string): [number, number] {
    const body = document.querySelector(`[data-table="${id}"] .st-body`)!;

    return [Number(body.getAttribute('cx')), Number(body.getAttribute('cy'))];
  }

  function floorAt(): [string | null, string | null] {
    const floor = document.querySelector('.st-floor');

    return [floor?.getAttribute('x') ?? null, floor?.getAttribute('y') ?? null];
  }

  function heard(): string {
    return document.querySelector('p.visually-hidden[aria-live]')?.textContent ?? '';
  }

  async function onThree(): Promise<{ line: string; body: unknown }[]> {
    signedIn();
    const sent = await onSeating({ 'GET /api/events/ev_1/seating-plan': threeTables });

    await screen.findByRole('button', { name: TABLE_1 });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    return sent;
  }

  async function chooseOneAndTwo(): Promise<void> {
    await chooseTable(TABLE_1);
    fireEvent.click(screen.getByRole('button', { name: TABLE_2 }), { shiftKey: true });
    await screen.findByRole('heading', { level: 2, name: '2 chosen' });
  }

  async function boxOverTable3(): Promise<[number, number]> {
    const [x, y] = centre('t3');

    finger('down', 1, [x - 4, y - 4], document.querySelector('.st-floor')!);
    finger('move', 1, [x + 4, y + 4]);
    expect(document.querySelector('.st-box-drawn')).not.toBeNull();
    return [x + 4, y + 4];
  }

  function secondFingerPans(at: readonly [number, number], on: Element): void {
    finger('down', 2, [at[0] + 40, at[1]], on);
    expect(document.querySelector('.st-box-drawn')).toBeNull();
    const was = floorAt();

    finger('move', 1, [at[0] + 30, at[1] + 30]);
    finger('move', 2, [at[0] + 70, at[1] + 30]);
    expect(floorAt()).not.toEqual(was);
    finger('up', 1, [at[0] + 30, at[1] + 30]);
    finger('up', 2, [at[0] + 70, at[1] + 30]);
    fireEvent.click(document.querySelector('.st-floor')!);
  }

  it('puts back the choice from before the box, and lifting after the pan neither clears it nor announces it', async () => {
    await onThree();
    await chooseOneAndTwo();
    const said = heard();
    const at = await boxOverTable3();

    expect(await screen.findByRole('heading', { level: 2, name: 'Table 3' })).toBeDefined();
    secondFingerPans(at, document.querySelector('.st-floor')!);
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    expect(heard()).toBe(said);
  });

  it('opens the one item’s panel again when one was chosen before the box', async () => {
    await onThree();
    await chooseTable(TABLE_1);
    const at = await boxOverTable3();

    expect(await screen.findByRole('heading', { level: 2, name: 'Table 3' })).toBeDefined();
    secondFingerPans(at, document.querySelector('.st-floor')!);
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
  });

  it('takes out what the box added while Add to choice is on, and leaves Add to choice on', async () => {
    await onThree();
    const add = screen.getByRole('button', { name: 'Add to choice' });

    fireEvent.click(add);
    fireEvent.click(screen.getByRole('button', { name: TABLE_1 }));
    fireEvent.click(screen.getByRole('button', { name: TABLE_2 }));
    await screen.findByRole('heading', { level: 2, name: '2 chosen' });
    const at = await boxOverTable3();

    expect(await screen.findByRole('heading', { level: 2, name: '3 chosen' })).toBeDefined();
    secondFingerPans(at, document.querySelector('.st-floor')!);
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    expect(add.getAttribute('aria-pressed')).toBe('true');
  });

  it('ends with nothing chosen when nothing was chosen before the box', async () => {
    await onThree();
    const at = await boxOverTable3();

    expect(await screen.findByRole('heading', { level: 2, name: 'Table 3' })).toBeDefined();
    secondFingerPans(at, document.querySelector('.st-floor')!);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Table 3' })).toBeNull(),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Room' })).toBeDefined();
  });

  it('pans from a second finger on an item without moving it, choosing it or taking it out', async () => {
    const sent = await onThree();

    await chooseOneAndTwo();
    const onFloor = () => centre('t1')[0] - Number(floorAt()[0]);
    const was = onFloor();
    const at = await boxOverTable3();
    const item = screen.getByRole('button', { name: TABLE_1 });

    secondFingerPans(at, item);
    fireEvent.click(item);
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    expect(sent.some((one) => one.line.includes('/seating-plan/furniture'))).toBe(false);
    expect(onFloor()).toBeCloseTo(was, 0);
  });

  it('pans from a second finger on a resize handle without resizing the table', async () => {
    const sent = await onThree();

    await chooseTable(TABLE_1);
    const at = await boxOverTable3();

    expect(await screen.findByRole('heading', { level: 2, name: 'Table 3' })).toBeDefined();
    const handle = document.querySelector('.st-handle-hit[data-handle="se"]')!;

    secondFingerPans(at, handle);
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
    expect(sent.some((one) => one.line.includes('/seating-plan/furniture'))).toBe(false);
  });

  it('pans and keeps the choice when both fingers land together', async () => {
    await onThree();
    await chooseOneAndTwo();
    const [x, y] = centre('t3');
    const floor = document.querySelector('.st-floor')!;

    finger('down', 1, [x, y + 200], floor);
    finger('down', 2, [x + 40, y + 200], floor);
    const was = floorAt();

    finger('move', 1, [x + 30, y + 230]);
    finger('move', 2, [x + 70, y + 230]);
    expect(floorAt()).not.toEqual(was);
    finger('up', 1, [x + 30, y + 230]);
    finger('up', 2, [x + 70, y + 230]);
    fireEvent.click(floor);
    expect(screen.getByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
  });
});

function guest(more: Record<string, unknown> = {}) {
  return {
    id: 'g_ada',
    fullName: 'Ada Obi',
    leadId: null,
    position: 1,
    reply: 'coming',
    groupId: null,
    groupName: 'Family',
    seat: null,
    ...more,
  };
}

const ADA_PARTY = [
  guest(),
  guest({ id: 'g_ada2', fullName: 'Chidi Obi', leadId: 'g_ada', position: 2 }),
  guest({ id: 'g_ada3', fullName: null, leadId: 'g_ada', position: 3 }),
  guest({
    id: 'g_bola',
    fullName: 'Bọ́lá Ade',
    position: 4,
    groupName: 'Work',
    reply: 'maybe',
  }),
];

function withGuests(guests: unknown[], ...tables: ReturnType<typeof table>[]) {
  return { ...withTables(...tables), guests };
}

function moved(planned: unknown, moves: unknown[], apart = false) {
  return json({ seating: { measurementSystem: 'metric', plan: planned }, moves, apart });
}

describe('Seating a guest at a desk (sc-4013)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists who is coming without a seat in Seat, with Not sure yet behind the switch, and finds by name', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(ADA_PARTY, table())),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    expect(screen.getByRole('tab', { name: 'Seat' }).getAttribute('aria-selected')).toBe('true');
    const list = screen.getByRole('list', { name: 'Without a seat' });

    expect(
      within(list)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['AOAda Obi + 2Family']);
    expect(document.querySelector('.st-tray-count')?.textContent).toBe('3');

    fireEvent.click(screen.getByRole('switch', { name: 'Also show Not sure yet and No reply' }));
    expect(screen.getByText('1 more: Not sure yet or No reply')).toBeDefined();
    expect(within(list).getAllByRole('button')).toHaveLength(2);
    expect(within(list).getByText('Work · Not sure yet')).toBeDefined();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by name' }), {
      target: { value: 'bola' },
    });
    expect(
      within(list)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['BABọ́lá AdeWork · Not sure yet']);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by name' }), {
      target: { value: 'nobody' },
    });
    expect(screen.getByText('Nobody without a seat matches this search.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and group' }));
    expect(
      within(screen.getByRole('list', { name: 'Without a seat' })).getAllByRole('button'),
    ).toHaveLength(2);
  });

  it('picks a party, seats it at the table clicked with Undo, and Undo puts it back', async () => {
    signedIn();
    const seated = ADA_PARTY.map((one, index) =>
      index < 3 ? { ...one, seat: { kind: 'table', id: 't1', seat: index + 1 } } : one,
    );
    const moves = [0, 1, 2].map((index) => ({
      guestId: ADA_PARTY[index]!.id,
      from: null,
      to: { kind: 'table', id: 't1', seat: index + 1 },
    }));
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(ADA_PARTY, table())),
      'POST /api/events/ev_1/seating-plan/guests/seat': () =>
        moved(withGuests(seated, table()), moves),
      'POST /api/events/ev_1/seating-plan/guests/undo': () =>
        moved(withGuests(ADA_PARTY, table()), []),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    fireEvent.click(screen.getByRole('button', { name: /Ada Obi \+ 2/ }));
    expect(screen.getByRole('button', { name: /Ada Obi \+ 2/, pressed: true })).toBeDefined();
    expect(screen.getByText('Now pick a table for Ada Obi and 2 guests.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /^Table 1,/ }));
    expect(await screen.findAllByText('Ada Obi and 2 guests are at Table 1.')).not.toHaveLength(0);
    expect(sent.find((one) => one.line.endsWith('/guests/seat'))?.body).toEqual({
      guestId: 'g_ada',
      kind: 'table',
      placeId: 't1',
      seat: null,
      justGuest: false,
    });
    expect(screen.queryByRole('list', { name: 'Without a seat' })).toBeNull();
    expect(screen.getByText('Everyone who is coming has a seat.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(sent.find((one) => one.line.endsWith('/guests/undo'))?.body).toEqual({ moves }),
    );
    expect(await screen.findByRole('button', { name: /Ada Obi \+ 2/ })).toBeDefined();
  });

  it('asks before taking a guest’s chair, swaps on Swap with, and Undo trades them back', async () => {
    signedIn();
    const funmi = guest({ id: 'g_funmi', fullName: 'Funmi Adeyemi', position: 2 });
    const kemi = guest({
      id: 'g_kemi',
      fullName: 'Kemi Ade',
      position: 3,
      seat: { kind: 'table', id: 't1', seat: 2 },
    });
    const before = [guest({ seat: { kind: 'table', id: 't1', seat: 3 } }), funmi, kemi];
    const moves = [
      { guestId: 'g_funmi', from: null, to: { kind: 'table', id: 't1', seat: 3 } },
      { guestId: 'g_ada', from: { kind: 'table', id: 't1', seat: 3 }, to: null },
    ];
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(before, table())),
      'POST /api/events/ev_1/seating-plan/guests/swap': () =>
        moved(withGuests([guest(), { ...funmi, seat: moves[0]!.to }, kemi], table()), moves),
      'POST /api/events/ev_1/seating-plan/guests/undo': () =>
        moved(withGuests(before, table()), []),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    fireEvent.click(screen.getByRole('button', { name: /Funmi Adeyemi/ }));
    press('Zoom in', 6);
    fireEvent.click(screen.getByRole('button', { name: 'Table 1, Seat 2, Kemi Ade' }));
    expect(await screen.findByText('Table 1, seat 2 is Kemi Ade’s.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Table 1, seat 2 is Kemi Ade’s.')).toBeNull();
    expect(sent.some((one) => one.line.endsWith('/guests/swap'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Table 1, Seat 3, Ada Obi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Swap with Ada Obi' }));
    expect(await screen.findAllByText('Funmi Adeyemi is at Table 1.')).not.toHaveLength(0);
    expect(sent.find((one) => one.line.endsWith('/guests/swap'))?.body).toEqual({
      guestId: 'g_funmi',
      withGuestId: 'g_ada',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(sent.find((one) => one.line.endsWith('/guests/undo'))?.body).toEqual({ moves }),
    );
  });

  it('says a full table and a short one, keeping the pick, and seats just the guest when asked', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(
          withGuests(
            ADA_PARTY,
            table({ seats: 2 }),
            table({ id: 't2', name: 'Table 13', seats: 4, xCm: 400 }),
          ),
        ),
      'POST /api/events/ev_1/seating-plan/guests/seat': (body) =>
        (body as { placeId: string }).placeId === 't2'
          ? problem('seating_table_full', 409)
          : (body as { justGuest: boolean }).justGuest
            ? moved(
                withGuests(
                  [{ ...ADA_PARTY[0], seat: { kind: 'table', id: 't1', seat: 1 } }],
                  table({ seats: 2 }),
                ),
                [{ guestId: 'g_ada', from: null, to: { kind: 'table', id: 't1', seat: 1 } }],
              )
            : problem('seating_table_short', 409, { free: 2, party: 3 }),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    fireEvent.click(screen.getByRole('button', { name: /Ada Obi \+ 2/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Table 13,/ }));
    expect(
      await screen.findByText(
        'Table 13 is full. Pick another table, or move someone off it first.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Table 1,/ }));
    expect(
      await screen.findByText('Table 1 has 2 free seats. Ada Obi’s party is 3.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Seat just Ada Obi' }));
    expect(await screen.findAllByText('Ada Obi is at Table 1.')).not.toHaveLength(0);
    expect(
      sent.filter((one) => one.line.endsWith('/guests/seat')).map((one) => one.body),
    ).toMatchObject([{ placeId: 't2' }, { placeId: 't1' }, { placeId: 't1', justGuest: true }]);
  });

  it('says the race and a refused Undo with no Undo of their own', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests([guest()], table())),
      'POST /api/events/ev_1/seating-plan/guests/seat': () => problem('seating_seat_taken', 409),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    fireEvent.click(screen.getByRole('button', { name: /Ada Obi/ }));
    expect(screen.getByText('Now pick a table for Ada Obi.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Table 1,/ }));
    expect(
      await screen.findByText('Someone just took that seat. Ada Obi is still without a seat.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('drops the pick on Esc and on Cancel', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests([guest()], table())),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    fireEvent.click(screen.getByRole('button', { name: /Ada Obi/ }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByText('Now pick a table for Ada Obi.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ada Obi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Now pick a table for Ada Obi.')).toBeNull();
  });

  it('lets nobody be picked without seating.manage', async () => {
    signedIn();
    await onSeating(
      { 'GET /api/events/ev_1/seating-plan': () => seating(withGuests([guest()], table())) },
      OWNER_PERMISSIONS.filter((one) => one !== 'seating.manage'),
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    expect(screen.getByRole('button', { name: /Ada Obi/ })).toHaveProperty('disabled', true);
  });
});

describe('Holding Space pans with an item focused, and Space acts on release (sc-62095)', () => {
  beforeAll(standInPointerEvents);

  const TABLE_2 = 'Table 2, round, 0 of 10 seats taken';
  const at = { button: 0, pointerId: 1 };

  function heard(): string {
    return document.querySelector('p.visually-hidden[aria-live]')?.textContent ?? '';
  }

  function chosen(): string | null {
    return document.querySelector('.st-panel h2')?.textContent ?? null;
  }

  function item(name: string): Element {
    return screen.getByRole('button', { name });
  }

  async function onTwo(): Promise<void> {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withTables(table(), table({ id: 't2', name: 'Table 2', xCm: 600 }))),
    });
    await screen.findByRole('button', { name: TABLE_1 });
    press('Zoom in', 3);
  }

  function spaceDrag(on: Element): void {
    const floor = document.querySelector('.st-floor')!;
    const room = document.querySelector('.st-room')!;
    const was = centreOf('t1');

    fireEvent.keyDown(on, { key: ' ' });
    expect(fireEvent.mouseDown(floor, { button: 0 })).toBe(false);
    fireEvent.pointerDown(floor, { ...at, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(room, { ...at, clientX: 160, clientY: 100 });
    expect(centreOf('t1')).toBeCloseTo(was + 60, 0);
    fireEvent.pointerUp(document.body, { ...at, clientX: 160, clientY: 100 });
    fireEvent.click(floor);
    fireEvent.keyUp(on, { key: ' ' });
  }

  async function addToChoice(): Promise<void> {
    fireEvent.click(screen.getByRole('button', { name: 'Add to choice' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add to choice' }).getAttribute('aria-pressed'),
      ).toBe('true'),
    );
  }

  it.each([
    ['clicked', false],
    ['reached by Tab', true],
  ])(
    'pans with Table 1 %s and chosen alone, and keeps the choice, the panel and the focus',
    async (_how, byTab) => {
      await onTwo();
      if (byTab) fireEvent.keyDown(window, { key: 'Tab' });
      else await chooseTable(TABLE_1);
      act(() => (item(TABLE_1) as SVGElement).focus());
      if (byTab) {
        fireEvent.keyDown(item(TABLE_1), { key: 'Enter' });
        await screen.findByRole('heading', { level: 2, name: 'Table 1' });
      }
      const said = heard();

      spaceDrag(item(TABLE_1));
      expect(chosen()).toBe('Table 1');
      expect(document.activeElement).toBe(item(TABLE_1));
      expect(heard()).toBe(said);
    },
  );

  it.each([false, true])(
    'pans with Table 1 focused and nothing chosen, Add to choice %s, and chooses nothing',
    async (adding) => {
      await onTwo();
      if (adding) await addToChoice();
      act(() => (item(TABLE_1) as SVGElement).focus());
      spaceDrag(item(TABLE_1));
      expect(item(TABLE_1).getAttribute('aria-pressed')).toBe('false');
      expect(document.activeElement).toBe(item(TABLE_1));
      expect(screen.queryByRole('heading', { level: 2, name: 'Table 1' })).toBeNull();
    },
  );

  it.each([false, true])(
    'pans with Table 1 focused and two chosen, Add to choice %s, and keeps both',
    async (adding) => {
      await onTwo();
      await chooseTable(TABLE_1);
      fireEvent.click(item(TABLE_2), { shiftKey: true });
      await screen.findByRole('heading', { level: 2, name: '2 chosen' });
      if (adding) await addToChoice();
      act(() => (item(TABLE_1) as SVGElement).focus());
      const said = heard();

      spaceDrag(item(TABLE_1));
      expect(chosen()).toBe('2 chosen');
      expect(document.activeElement).toBe(item(TABLE_1));
      expect(heard()).toBe(said);
    },
  );

  it('pans with Table 1 focused and chosen alone while Add to choice is on, and does not take it out', async () => {
    await onTwo();
    await chooseTable(TABLE_1);
    await addToChoice();
    act(() => (item(TABLE_1) as SVGElement).focus());
    spaceDrag(item(TABLE_1));
    expect(item(TABLE_1).getAttribute('aria-pressed')).toBe('true');
  });

  it('chooses on release, not on the press, and chooses Table 2 alone', async () => {
    await onTwo();
    await chooseTable(TABLE_1);
    act(() => (item(TABLE_2) as SVGElement).focus());
    fireEvent.keyDown(item(TABLE_2), { key: ' ' });
    expect(chosen()).toBe('Table 1');
    fireEvent.keyUp(item(TABLE_2), { key: ' ' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 2' })).toBeDefined();
  });

  it('adds on release with Shift held, as with Shift held only when Space comes up', async () => {
    await onTwo();
    await chooseTable(TABLE_1);
    act(() => (item(TABLE_2) as SVGElement).focus());
    fireEvent.keyDown(item(TABLE_2), { key: ' ', shiftKey: true });
    expect(chosen()).toBe('Table 1');
    fireEvent.keyUp(item(TABLE_2), { key: ' ', shiftKey: true });
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();

    fireEvent.keyDown(item(TABLE_2), { key: ' ' });
    fireEvent.keyUp(item(TABLE_2), { key: ' ', shiftKey: true });
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
  });

  it('adds once on release while Add to choice is on, however long Space repeats', async () => {
    await onTwo();
    await chooseTable(TABLE_1);
    await addToChoice();
    act(() => (item(TABLE_2) as SVGElement).focus());
    fireEvent.keyDown(item(TABLE_2), { key: ' ' });
    for (let times = 0; times < 5; times += 1)
      fireEvent.keyDown(item(TABLE_2), { key: ' ', repeat: true });
    expect(chosen()).toBe('Table 1');
    fireEvent.keyUp(item(TABLE_2), { key: ' ' });
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
  });

  it('does nothing on release once the focus has left the item Space went down on', async () => {
    await onTwo();
    await chooseTable(TABLE_1);
    act(() => (item(TABLE_2) as SVGElement).focus());
    fireEvent.keyDown(item(TABLE_2), { key: ' ' });
    act(() => (item(TABLE_1) as SVGElement).focus());
    fireEvent.keyUp(item(TABLE_1), { key: ' ' });
    expect(chosen()).toBe('Table 1');
  });

  it('still acts on the press of Enter and Shift+Enter', async () => {
    await onTwo();
    await chooseTable(TABLE_1);
    fireEvent.keyDown(item(TABLE_2), { key: 'Enter', shiftKey: true });
    expect(await screen.findByRole('heading', { level: 2, name: '2 chosen' })).toBeDefined();
    fireEvent.keyDown(item(TABLE_2), { key: 'Enter' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 2' })).toBeDefined();
  });
});

describe('An item moved by keys stays clear of the keys strip (sc-61042)', () => {
  beforeAll(standInPointerEvents);
  beforeEach(() => localStorage.clear());

  const STRIP = { left: 100, right: 618, top: 600, bottom: 680 };
  let below = 0;

  function floorTop(): number {
    return Number(document.querySelector('.st-room-line')?.getAttribute('y'));
  }

  function rect(left: number, top: number, width: number, height: number): DOMRect {
    return {
      width,
      height,
      left,
      top,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    } as DOMRect;
  }

  function measure() {
    return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.getAttribute('data-table') === 't1') return rect(300, floorTop() + below, 100, 100);
      if (this.classList.contains('st-keys'))
        return rect(STRIP.left, STRIP.top, STRIP.right - STRIP.left, STRIP.bottom - STRIP.top);
      return rect(0, 0, 0, 0);
    });
  }

  async function keyed(
    answers: Record<string, Answer> = {},
    more: Record<string, unknown> = {},
    at = 400,
  ) {
    signedIn();
    const long = table({ shape: 'rectangular', seats: 6, widthCm: 180, lengthCm: 76, ...more });
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(long)),
      'PATCH /api/events/ev_1/seating-plan/furniture': (body) => {
        const [item] = (body as { items: Record<string, number>[] }).items;

        return seating(withTables({ ...long, ...item, version: 2 }));
      },
      ...answers,
    });

    await chooseTable('Table 1, rectangular, 0 of 6 seats taken');
    const drawn = document.querySelector('[data-table="t1"]') as SVGGElement & HTMLElement;

    act(() => drawn.focus());
    const was = floorTop();

    below = at - was;
    fireEvent.keyDown(drawn, { key: 'Shift' });
    expect(document.querySelector('.st-keys')).not.toBeNull();
    return { drawn, sent, was };
  }

  async function nextFrame() {
    await act(() => new Promise<void>((done) => requestAnimationFrame(() => done())));
  }

  function watchShows() {
    const shows: MutationCallback[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'MutationObserver',
      class {
        constructor(callback: MutationCallback) {
          shows.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    return shows;
  }

  it('pans by the least distance once an arrow, Shift+arrow or R has moved the item under the strip', async () => {
    const measured = measure();

    try {
      const { drawn } = await keyed();
      const zoom = percent();

      for (const key of [
        { key: 'ArrowUp' },
        { key: 'ArrowDown', shiftKey: true },
        { key: 'ArrowLeft' },
        { key: 'R' },
      ]) {
        const was = floorTop();

        below = 520 - was;
        fireEvent.keyDown(drawn, key);
        expect(floorTop()).toBeCloseTo(was - 28, 0);
        expect(percent()).toBe(zoom);
      }
    } finally {
      measured.mockRestore();
    }
  });

  it('does not move the plan for an item a key leaves clear', async () => {
    const measured = measure();

    try {
      const { drawn } = await keyed();
      const was = floorTop();

      fireEvent.keyDown(drawn, { key: 'ArrowUp' });
      expect(floorTop()).toBe(was);
    } finally {
      measured.mockRestore();
    }
  });

  it('keeps the item clear when the room’s foot stops the arrow', async () => {
    const measured = measure();

    try {
      const { drawn, sent } = await keyed({}, { yCm: 1762 });
      const was = floorTop();

      below = 520 - was;
      fireEvent.keyDown(drawn, { key: 'ArrowDown' });
      expect(furniture(sent)).toEqual([]);
      expect(floorTop()).toBeCloseTo(was - 28, 0);
    } finally {
      measured.mockRestore();
    }
  });

  it('pans when the strip grows to a second line while the item has focus', async () => {
    const measured = measure();
    const watched: { callback: ResizeObserverCallback; targets: Element[] }[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        targets: Element[] = [];
        constructor(callback: ResizeObserverCallback) {
          watched.push({ callback, targets: this.targets });
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        disconnect() {}
      },
    );

    try {
      await keyed();
      const was = floorTop();
      const strip = document.querySelector('.st-keys')!;
      const grow = () =>
        act(() => {
          for (const one of watched)
            if (one.targets.includes(strip))
              one.callback(
                [{ target: strip, contentRect: strip.getBoundingClientRect() }] as never,
                {} as ResizeObserver,
              );
        });

      STRIP.top = 640;
      grow();
      below = 520 - was;
      STRIP.top = 600;
      grow();
      await nextFrame();
      expect(floorTop()).toBeCloseTo(was - 28, 0);
    } finally {
      STRIP.top = 600;
      vi.unstubAllGlobals();
      measured.mockRestore();
    }
  });

  it('pans for where the item lies once a resize that grew the strip has been drawn', async () => {
    const measured = measure();
    const watched: { callback: ResizeObserverCallback; targets: Element[] }[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        targets: Element[] = [];
        constructor(callback: ResizeObserverCallback) {
          watched.push({ callback, targets: this.targets });
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        disconnect() {}
      },
    );

    try {
      await keyed();
      const was = floorTop();
      const strip = document.querySelector('.st-keys')!;
      const grow = () =>
        act(() => {
          for (const one of watched)
            if (one.targets.includes(strip))
              one.callback(
                [{ target: strip, contentRect: strip.getBoundingClientRect() }] as never,
                {} as ResizeObserver,
              );
        });

      STRIP.top = 640;
      grow();
      STRIP.top = 600;
      grow();
      below = 520 - was;
      await nextFrame();
      expect(floorTop()).toBeCloseTo(was - 28, 0);
    } finally {
      STRIP.top = 600;
      vi.unstubAllGlobals();
      measured.mockRestore();
    }
  });

  it('pans when the strip shows over the item that has focus', async () => {
    const measured = measure();

    watchShows();
    try {
      const { was } = await keyed({}, {}, 520);

      expect(floorTop()).toBeCloseTo(was - 28, 0);
    } finally {
      vi.unstubAllGlobals();
      measured.mockRestore();
    }
  });

  it('pans when a bar appears over the item that has focus', async () => {
    const measured = measure();
    const shows = watchShows();

    try {
      const { was } = await keyed();
      const strip = document.querySelector('.st-keys')!;

      below = 520 - was;
      act(() => {
        for (const show of shows)
          show([{ addedNodes: [strip] as unknown as NodeList } as MutationRecord], {} as never);
      });
      await nextFrame();
      expect(floorTop()).toBeCloseTo(was - 28, 0);
    } finally {
      vi.unstubAllGlobals();
      measured.mockRestore();
    }
  });

  it('does not pan when the small map a zoom brings in shows while the item has focus', async () => {
    const measured = measure();
    const shows = watchShows();

    try {
      const { was } = await keyed();
      const small = document.createElement('div');

      small.className = 'st-float st-minimap';
      below = 520 - was;
      act(() => {
        for (const show of shows)
          show([{ addedNodes: [small] as unknown as NodeList } as MutationRecord], {} as never);
      });
      await nextFrame();
      expect(floorTop()).toBe(was);
    } finally {
      vi.unstubAllGlobals();
      measured.mockRestore();
    }
  });

  it('never moves the plan for a click or a drag, even with the item where the strip was', async () => {
    const measured = measure();

    try {
      const { drawn } = await keyed();
      const was = floorTop();

      below = 520 - was;
      fireEvent.pointerDown(drawn, { button: 0, pointerId: 1, clientX: 350, clientY: 570 });
      fireEvent.pointerUp(drawn, { button: 0, pointerId: 1, clientX: 350, clientY: 570 });
      fireEvent.click(drawn);
      expect(floorTop()).toBe(was);

      fireEvent.pointerDown(drawn, { button: 0, pointerId: 1, clientX: 350, clientY: 570 });
      fireEvent.pointerMove(drawn, { button: 0, pointerId: 1, clientX: 350, clientY: 640 });
      fireEvent.pointerUp(drawn, { button: 0, pointerId: 1, clientX: 350, clientY: 640 });
      expect(floorTop()).toBe(was);
    } finally {
      measured.mockRestore();
    }
  });
});

describe('A table’s guests in Seat, and the chairs in their states (sc-4013)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const AT_T1 = [
    guest({ reply: 'maybe', seat: { kind: 'table', id: 't1', seat: 1 } }),
    guest({
      id: 'g_ada2',
      fullName: null,
      leadId: 'g_ada',
      position: 2,
      reply: 'maybe',
      seat: { kind: 'table', id: 't1', seat: 2 },
    }),
  ];
  const T2 = table({ id: 't2', name: 'Table 2', seats: 4, xCm: 400 });
  const T3 = table({ id: 't3', name: 'Table 3', seats: 2, unusableSeats: [1], xCm: 700 });

  it('draws a taken and a held chair, counts them, and names each in the legend', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(AT_T1, table())),
    });

    await chooseTable('Table 1, round, 2 of 10 seats taken');
    expect(screen.getByRole('button', { name: 'Table 1, Seat 1, Ada Obi' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Table 1, Seat 2, Held for a companion' }),
    ).toBeDefined();
    expect(document.querySelectorAll('.st-chair.is-taken')).toHaveLength(1);
    expect(document.querySelectorAll('.st-chair.is-held')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Table 1, Seat 1, Ada Obi' }));
    expect(
      within(await screen.findByRole('list', { name: 'What the seats show' }))
        .getAllByRole('listitem')
        .map((one) => one.textContent),
    ).toEqual(['Taken', 'Held for a companion', 'Empty', 'Unusable']);
  });

  it('shows a chosen table’s chairs in words in Seat, and Unseat everyone empties it with Undo', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(AT_T1, table())),
      'POST /api/events/ev_1/seating-plan/guests/unseat': () =>
        moved(
          withGuests(
            AT_T1.map((one) => ({ ...one, seat: null })),
            table(),
          ),
          AT_T1.map((one) => ({ guestId: one.id, from: one.seat, to: null })),
        ),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    await chooseTable('Table 1, round, 2 of 10 seats taken');
    expect(screen.getByRole('heading', { level: 2, name: 'Table 1' })).toBeDefined();
    const chairs = document.querySelectorAll('.st-panel .st-row.is-dense');

    expect([...chairs].slice(0, 3).map((one) => one.textContent)).toEqual([
      'Seat 1Ada Obi · Not sure yet',
      'Seat 2Held for a companion · Not sure yet',
      'Seat 3Empty',
    ]);
    expect(chairs).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: 'Unseat everyone' }));
    expect(await screen.findAllByText('Table 1 is empty now.')).not.toHaveLength(0);
    expect(sent.find((one) => one.line.endsWith('/guests/unseat'))?.body).toEqual({
      kind: 'table',
      placeId: 't1',
    });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined();
    expect(
      screen.getByText('Nobody here yet. Pick a guest in Seat, then this table.'),
    ).toBeDefined();
  });

  it('offers only the tables with room for all in Move everyone to…, and moves them there', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(AT_T1, table(), T2, T3)),
      'POST /api/events/ev_1/seating-plan/guests/move-everyone': () =>
        moved(
          withGuests(
            AT_T1.map((one, index) => ({
              ...one,
              seat: { kind: 'table', id: 't2', seat: index + 1 },
            })),
            table(),
            T2,
            T3,
          ),
          AT_T1.map((one, index) => ({
            guestId: one.id,
            from: one.seat,
            to: { kind: 'table', id: 't2', seat: index + 1 },
          })),
        ),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    await chooseTable('Table 1, round, 2 of 10 seats taken');
    fireEvent.click(screen.getByRole('button', { name: 'Move everyone to…' }));
    const pop = screen.getByRole('dialog', { name: 'Move everyone to…' });

    expect(within(pop).getByText('Tables with room for all 2.')).toBeDefined();
    expect(
      within(pop)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Table 2No section · 4 free']);

    fireEvent.click(within(pop).getByRole('button', { name: /Table 2/ }));
    expect(await screen.findAllByText('2 guests moved to Table 2.')).not.toHaveLength(0);
    expect(sent.find((one) => one.line.endsWith('/guests/move-everyone'))?.body).toEqual({
      from: { kind: 'table', id: 't1' },
      to: { kind: 'table', id: 't2' },
    });
    expect(screen.queryByRole('dialog', { name: 'Move everyone to…' })).toBeNull();
  });

  it('picks a seated guest from their chair in Seat, and moves just them to the next table', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(AT_T1, table(), T2)),
      'POST /api/events/ev_1/seating-plan/guests/seat': () =>
        moved(
          withGuests(
            [{ ...AT_T1[0], seat: { kind: 'table', id: 't2', seat: 1 } }, AT_T1[1]],
            table(),
            T2,
          ),
          [
            {
              guestId: 'g_ada',
              from: { kind: 'table', id: 't1', seat: 1 },
              to: { kind: 'table', id: 't2', seat: 1 },
            },
          ],
        ),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    await chooseTable('Table 1, round, 2 of 10 seats taken');
    fireEvent.click(screen.getByRole('button', { name: 'Table 1, Seat 1, Ada Obi' }));
    expect(screen.getByText('Now pick a table for Ada Obi.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /^Table 2,/ }));
    expect(await screen.findAllByText('Ada Obi is at Table 2.')).not.toHaveLength(0);
    expect(sent.find((one) => one.line.endsWith('/guests/seat'))?.body).toMatchObject({
      guestId: 'g_ada',
      placeId: 't2',
    });
  });

  it('seats by keyboard: a picked guest, arrows step between tables, Enter seats, Esc drops', async () => {
    signedIn();
    const T2 = table({ id: 't2', name: 'Table 2', seats: 4, xCm: 400 });
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests([guest()], table(), T2)),
      'POST /api/events/ev_1/seating-plan/guests/seat': () =>
        moved(withGuests([guest({ seat: { kind: 'table', id: 't1', seat: 1 } })], table(), T2), [
          { guestId: 'g_ada', from: null, to: { kind: 'table', id: 't1', seat: 1 } },
        ]),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    const ada = screen.getByRole('button', { name: /Ada Obi/ });

    fireEvent.click(ada);
    expect(screen.getByText('Now pick a table for Ada Obi.')).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Now pick a table for Ada Obi.')).toBeNull();

    fireEvent.click(ada);
    const t2 = screen.getByRole('button', { name: /^Table 2,/ });
    const t1 = screen.getByRole('button', { name: /^Table 1,/ });

    t2.focus();
    fireEvent.keyDown(t2, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(t1);
    fireEvent.keyDown(t1, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(t2);
    fireEvent.keyDown(t2, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(t1);

    fireEvent.keyDown(t1, { key: 'Enter' });
    expect(await screen.findAllByText('Ada Obi is at Table 1.')).not.toHaveLength(0);
    expect(sent.find((one) => one.line.endsWith('/guests/seat'))?.body).toMatchObject({
      guestId: 'g_ada',
      placeId: 't1',
    });
  });

  it('takes Rename back to Arrange with the name field', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(AT_T1, table())),
    });

    fireEvent.click(await screen.findByRole('tab', { name: 'Seat' }));
    await chooseTable('Table 1, round, 2 of 10 seats taken');
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByRole('tab', { name: 'Arrange' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDefined();
  });
});

describe('The Tables view (sc-4013)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const SECTIONS = [
    { id: 's_stage', name: 'Stage', colour: 'blue', version: 1 },
    { id: 's_garden', name: 'Garden', colour: 'olive', version: 1 },
  ];

  function roomOfCards() {
    return {
      ...withGuests(
        [
          guest({ seat: { kind: 'table', id: 't10', seat: 1 } }),
          guest({ id: 'g_bo', fullName: 'Bo Ade', position: 2 }),
        ],
        table({ id: 't10', name: 'Table 10', sectionId: 's_stage', xCm: 300 }),
        table({ id: 't2', name: 'Table 2', sectionId: 's_stage', xCm: 700, seats: 8 }),
        table({ id: 't1', name: 'Table 1', sectionId: 's_garden', xCm: 1100 }),
        table({ id: 't3', name: 'Table 3', sectionId: null, xCm: 1500 }),
      ),
      sections: plan(SECTIONS).sections,
    };
  }

  it('shows a card per table by section, then by name in number order, and filters by section', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(roomOfCards()),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Tables' }));
    const cards = () =>
      within(document.querySelector<HTMLElement>('.st-cards')!)
        .getAllByRole('button')
        .map((one) => one.getAttribute('aria-label'));

    expect(cards()).toEqual([
      'Table 2, 0 of 8, Stage',
      'Table 10, 1 of 10, Stage',
      'Table 1, 0 of 10, Garden',
      'Table 3, 0 of 10',
    ]);
    expect(document.querySelectorAll('.st-cards .st-chair.is-taken')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Garden' }));
    expect(cards()).toEqual(['Table 1, 0 of 10, Garden']);
    fireEvent.click(screen.getByRole('button', { name: 'All sections' }));
    expect(cards()).toHaveLength(4);
  });

  it('seats a picked guest at the card clicked, with Undo', async () => {
    signedIn();
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(roomOfCards()),
      'POST /api/events/ev_1/seating-plan/guests/seat': () =>
        moved(roomOfCards(), [
          { guestId: 'g_bo', from: null, to: { kind: 'table', id: 't3', seat: 1 } },
        ]),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Tables' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Seat' }));
    fireEvent.click(screen.getByRole('button', { name: /Bo Ade/ }));
    expect(
      screen.getByText('Now pick a table for Bo Ade.').closest('.st-bar')?.className,
    ).toContain('is-tint');

    fireEvent.click(screen.getByRole('button', { name: 'Table 3, 0 of 10' }));
    expect(await screen.findAllByText('Bo Ade is at Table 3.')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Table 3, 0 of 10' }).className).toContain('is-lit');
    expect(sent.find((one) => one.line.endsWith('/guests/seat'))?.body).toMatchObject({
      guestId: 'g_bo',
      kind: 'table',
      placeId: 't3',
    });
  });

  it('moves between the cards with the arrow keys', async () => {
    signedIn();
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(roomOfCards()),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Tables' }));
    const card = (name: string) => screen.getByRole('button', { name });

    card('Table 2, 0 of 8, Stage').focus();
    fireEvent.keyDown(card('Table 2, 0 of 8, Stage'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(card('Table 10, 1 of 10, Stage'));
    fireEvent.keyDown(card('Table 10, 1 of 10, Stage'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(card('Table 1, 0 of 10, Garden'));
    fireEvent.keyDown(card('Table 1, 0 of 10, Garden'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(card('Table 10, 1 of 10, Stage'));
    card('Table 2, 0 of 8, Stage').focus();
    fireEvent.keyDown(card('Table 2, 0 of 8, Stage'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(card('Table 3, 0 of 10'));
  });
});

describe('Deleting many with guests in them (sc-57680)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const at = (id: string, seat: number, kind = 'table') => ({ kind, id, seat });
  const ada = guest({ seat: at('t1', 2) });
  const chidi = guest({
    id: 'g_ada2',
    fullName: 'Chidi Obi',
    leadId: 'g_ada',
    position: 2,
    seat: at('t1', 3),
  });
  const held = guest({ id: 'g_ada3', fullName: null, leadId: 'g_ada', position: 3 });
  const first = table({
    seated: [
      { seat: 2, guestId: 'g_ada' },
      { seat: 3, guestId: 'g_ada2' },
    ],
  });
  const freed = [
    { guestId: 'g_ada', from: at('t1', 2), to: null },
    { guestId: 'g_ada2', from: at('t1', 3), to: null },
  ];

  function stepLine(): string {
    return document.querySelector('.st-under-views .st-bar p')?.textContent ?? '';
  }

  function heard(): string {
    return document.querySelector('p.visually-hidden[aria-live]')?.textContent ?? '';
  }

  function panel() {
    return within(document.querySelector<HTMLElement>('.st-panel')!);
  }

  function bodies(sent: { line: string; body: unknown }[], path: string) {
    return sent
      .filter((one) => one.line.endsWith(`/seating-plan/furniture/${path}`))
      .map((one) => one.body as { items: Record<string, unknown>[]; emptyOnly?: boolean });
  }

  async function chooseTwo(second: RegExp): Promise<void> {
    fireEvent.click(await screen.findByRole('button', { name: /^Table 1,/ }));
    fireEvent.click(screen.getByRole('button', { name: second }), { shiftKey: true });
    await screen.findByRole('heading', { level: 2, name: '2 chosen' });
  }

  it('counts every taken chair in the ask, frees them with the delete, and Undo seats each back in their chair', async () => {
    signedIn();
    const second = table({
      id: 't2',
      name: 'Table 2',
      xCm: 600,
      seated: [{ seat: 1, guestId: 'g_ada3' }],
    });
    const everyone = [ada, chidi, { ...held, seat: at('t2', 1) }];
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withGuests(everyone, first, second)),
      'POST /api/events/ev_1/seating-plan/furniture/delete': () =>
        moved(withGuests([guest(), chidi, held].map((one) => ({ ...one, seat: null }))), [
          ...freed,
          { guestId: 'g_ada3', from: at('t2', 1), to: null },
        ]),
      'POST /api/events/ev_1/seating-plan/furniture/restore': () =>
        json(
          {
            seating: {
              measurementSystem: 'metric',
              plan: withGuests(everyone, { ...first, id: 't5' }, { ...second, id: 't6' }),
            },
            chosen: ['t5', 't6'],
          },
          201,
        ),
    });

    await chooseTwo(/^Table 2,/);
    expect(panel().getByText('2 tables · 3 guests seated')).toBeDefined();
    fireEvent.click(panel().getByRole('button', { name: 'Delete' }));
    const ask = within(await screen.findByRole('alertdialog'));

    expect(ask.getByText('Delete 2 tables?')).toBeDefined();
    expect(ask.getByText('3 guests will be moved to Without a seat.')).toBeDefined();
    fireEvent.click(ask.getByRole('button', { name: 'Delete 2 tables' }));
    await waitFor(() =>
      expect(stepLine()).toBe('2 tables deleted. 3 guests moved to Without a seat.'),
    );
    expect(heard()).toBe('2 tables deleted. 3 guests moved to Without a seat.');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(heard()).toBe('Undone. Everything is back as it was.'));
    expect(bodies(sent, 'restore')[0]?.items.map((item) => item.guests)).toEqual([
      [
        { guestId: 'g_ada', seat: 2 },
        { guestId: 'g_ada2', seat: 3 },
      ],
      [{ guestId: 'g_ada3', seat: 1 }],
    ]);
  });

  it('asks about 2 items when a row is chosen with a table, and counts its held chair', async () => {
    signedIn();
    const everyone = [ada, chidi, { ...held, seat: at('r1', 4, 'row') }];
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating({
          ...withGuests(everyone, first),
          rows: [row({ seated: [{ seat: 4, guestId: 'g_ada3' }] })],
        }),
    });

    await chooseTwo(/^Row A,/);
    fireEvent.click(panel().getByRole('button', { name: 'Delete' }));
    const ask = within(await screen.findByRole('alertdialog'));

    expect(ask.getByText('Delete 2 items?')).toBeDefined();
    expect(ask.getByText('3 guests will be moved to Without a seat.')).toBeDefined();
    fireEvent.click(ask.getByRole('button', { name: 'Keep them' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.querySelectorAll('[data-table="t1"]')).toHaveLength(1);
  });

  it('changes nothing when Undo finds a freed guest has moved since, and offers no Undo of that', async () => {
    signedIn();
    const second = table({ id: 't2', name: 'Table 2', xCm: 600 });
    await onSeating({
      'GET /api/events/ev_1/seating-plan': () =>
        seating(withGuests([ada, chidi, held], first, second)),
      'POST /api/events/ev_1/seating-plan/furniture/delete': () =>
        moved(withGuests([guest(), { ...chidi, seat: null }, held]), freed),
      'POST /api/events/ev_1/seating-plan/furniture/restore': () =>
        problem('seating_undo_stale', 409),
    });

    await chooseTwo(/^Table 2,/);
    fireEvent.click(panel().getByRole('button', { name: 'Delete' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Delete 2 tables',
      }),
    );
    await waitFor(() =>
      expect(stepLine()).toBe('2 tables deleted. 2 guests moved to Without a seat.'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(stepLine()).toBe('These seats changed since. Nothing was undone.'));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('refuses the Undo of a Duplicate once somebody sits in a copy', async () => {
    signedIn();
    const second = table({ id: 't2', name: 'Table 2', xCm: 600 });
    const copies = [table({ id: 't3', name: 'Table 3' }), table({ id: 't4', name: 'Table 4' })];
    const sent = await onSeating({
      'GET /api/events/ev_1/seating-plan': () => seating(withTables(table(), second)),
      'POST /api/events/ev_1/seating-plan/furniture/duplicate': () =>
        json(
          {
            seating: {
              measurementSystem: 'metric',
              plan: withTables(table(), second, ...copies),
            },
            chosen: ['t3', 't4'],
          },
          201,
        ),
      'POST /api/events/ev_1/seating-plan/furniture/delete': () =>
        problem('seating_undo_stale', 409),
    });

    await chooseTwo(/^Table 2,/);
    fireEvent.click(panel().getByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(stepLine()).toContain('2 copies added'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(stepLine()).toBe('These seats changed since. Nothing was undone.'));
    expect(bodies(sent, 'delete')[0]?.emptyOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
