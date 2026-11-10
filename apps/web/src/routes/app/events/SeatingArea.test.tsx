import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { deletePlanWords } from './SeatingArea.tsx';

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
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

const NONE = { sections: 0, tables: 0, rows: 0, singleSeats: 0, seatedGuests: 0 };

function plan(sections: { id: string; name: string; colour: string; version?: number }[] = []) {
  return {
    id: 'plan_1',
    roomName: 'Main hall',
    widthCm: 2400,
    lengthCm: 1800,
    version: 1,
    changedBy: null,
    sections: sections.map((one) => ({ version: 1, tables: 0, seats: 0, ...one })),
    withoutSection: { tables: 0, seats: 0 },
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
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/seating'] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: i18next.t('seating.area') });

  return sent;
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
    expect(within(ask).queryByText(/tables? stays?/u)).toBeNull();
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
      'This also deletes 1 section, 2 tables, 1 row, and 4 single seats. The guest list does not change.',
    );
  });

  it('leaves the first sentence out when the plan holds nothing', () => {
    expect(deletePlanWords(t, 'en', NONE)).toBe('The guest list does not change.');
  });
});
