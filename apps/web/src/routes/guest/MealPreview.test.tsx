import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __setSessionState, type Session } from '../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

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
};

const CLOSE = { at: '2030-11-10T23:59:00+01:00', source: 'replyBy', closed: false };

const menuDish = (id: string, name: string, allergens: string[] | null) => ({
  id,
  name,
  description: null,
  allergens,
  diets: [],
  libraryDishId: null,
  picked: false,
  variants: [],
  choices: [],
  offered: true,
  items: [],
});

const menuCourse = (picksClose: object | null) => ({
  id: 'main',
  name: 'Main',
  servedAt: null,
  answer: 'choose',
  skippable: false,
  dishes: [menuDish('jollof', 'Jollof rice', ['celery']), menuDish('egusi', 'Egusi', ['milk'])],
  ownItems: [],
  items: [],
  picksClose,
});

const guestDish = (id: string, name: string, allergens: string[]) => ({
  id,
  name,
  description: null,
  allergens,
  diets: [],
  variants: [],
  choices: [],
});

const PREVIEW = {
  guest: {
    fullName: 'Folake Adeyemi',
    reply: null,
    needs: {
      allergies: [],
      otherAllergy: null,
      diet: [],
      otherDiet: null,
      access: [],
      otherAccess: null,
      changed: null,
    },
    places: 0,
    unnamed: [],
    companions: [],
  },
  language: { chosen: null, host: null, organisation: 'en' },
  event: {
    id: 'ev_1',
    name: 'Adaeze and Tunde',
    type: 'wedding',
    cover: null,
    hosts: ['Adaeze', 'Tunde'],
    thankYou: null,
    startsAt: '2030-11-15T18:00:00+01:00',
    timeZone: 'Africa/Lagos',
    venue: null,
    arrivalNote: null,
    replyBy: null,
  },
  phase: 'live',
  started: false,
  answersOpen: true,
  answersClosedOn: null,
  calendarFeed: null,
  programme: [],
  meals: {
    you: 'preview',
    courses: [
      {
        id: 'main',
        name: 'Main',
        answer: 'choose',
        skippable: false,
        picksClose: CLOSE,
        dishes: [
          guestDish('jollof', 'Jollof rice', ['celery']),
          guestDish('egusi', 'Egusi', ['milk']),
        ],
      },
    ],
    answers: {},
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });

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

function onMenu(picksClose: object | null, permissions = OWNER_PERMISSIONS): string[] {
  const sent: string[] = [];
  signedIn();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push(line);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });
    if (line === 'GET /api/events/ev_1/menu')
      return json({ menu: { courses: [menuCourse(picksClose)] } });
    if (line === 'GET /api/events/ev_1/menu/preview') return json(PREVIEW);
    if (line === 'GET /api/orgs/org_1/dishes')
      return json({ dishes: [], canManage: true, seesPrices: false });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/menu'] })}
    />,
  );

  return sent;
}

const pill = () => screen.queryByRole('link', { name: 'Preview as guest' });

async function openPreview(): Promise<void> {
  fireEvent.click((await screen.findByRole('link', { name: 'Preview as guest' })) as HTMLElement);
  await screen.findByText('For you · Main · 1 of 1');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Preview as guest (sc-3907)', () => {
  it('opens the host alone on the first meal screen from the Menu, and the band’s Close preview returns there having saved nothing', async () => {
    const sent = onMenu(CLOSE);
    await openPreview();

    expect(screen.getByText('Preview. Nothing is saved.')).toBeDefined();
    expect(screen.getByRole('heading', { name: /Which main\?/ })).toBe(document.activeElement);

    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));

    expect(await screen.findByText('Nothing was saved.')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(pill()));
    expect(sent.filter((line) => !line.startsWith('GET '))).toEqual([]);
  });

  it('runs every course to Check and send, where Close preview takes Send my answer’s place and sends nothing', async () => {
    const sent = onMenu(CLOSE);
    await openPreview();

    fireEvent.click(screen.getByRole('radio', { name: /Jollof rice/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Check and send' })).toBe(document.activeElement);
    expect(screen.queryByRole('button', { name: 'Send my answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Change your answer/ })).toBeNull();
    const closes = screen.getAllByRole('button', { name: 'Close preview' });
    expect(closes).toHaveLength(2);

    fireEvent.click(closes[1] as HTMLElement);

    expect(await screen.findByText('Nothing was saved.')).toBeDefined();
    expect(sent.filter((line) => !line.startsWith('GET '))).toEqual([]);
  });

  it('gives Back from the first meal screen the kitchen note, with no Back of its own, where an allergy rules a dish out', async () => {
    onMenu(CLOSE);
    await openPreview();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('heading', { name: 'Anything the kitchen must know?' })).toBe(
      document.activeElement,
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Milk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect((screen.getByRole('radio', { name: /Egusi/ }) as HTMLInputElement).disabled).toBe(true);
  });

  it('shows to a role that can only read the menu', async () => {
    onMenu(CLOSE, ['events.read', 'menu.read']);

    expect(await screen.findByRole('link', { name: 'Preview as guest' })).toBeDefined();
  });

  it('is not offered when no course asks guests anything', async () => {
    onMenu(null);

    expect(await screen.findByText('1 course · 2 dishes')).toBeDefined();
    expect(pill()).toBeNull();
  });
});
