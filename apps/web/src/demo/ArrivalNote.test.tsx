import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import {
  ARRIVAL_NOTE,
  LONG_NOTE,
  MARKUP_NOTE,
  NOTE_MOST,
  WIDE_NOTE,
  noteLength,
  noteTooLong,
  savedNote,
} from './arrivalNote.ts';
import { EVENTS_PAGES, keepCopy, resetSample, sampleEvent } from './events.ts';
import { GUEST_NOTE_PAGES } from './guestNote.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WEDDING = 'Adaeze & Tunde’s wedding';
const TOO_LONG = 'Shorten the arrival note to 500 characters or fewer.';

async function page(state: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, {
        initialEntries: [`/demo/events/evt-wed-4?state=${state}`],
      })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: WEDDING }, { timeout: 8000 });
}

async function guest(state: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/demo/guest?state=${state}`] })}
    />,
  );
  await screen.findByRole('banner');
}

const venue = () => screen.getByRole('group', { name: 'Venue' });
const box = () => within(venue()).getByRole('textbox', { name: /^Arrival note/u });

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
  resetSample();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  __setConfig(tested);
});

describe('the arrival note’s rule (sc-24385)', () => {
  it('counts code points after NFC, of the trimmed text', () => {
    const accents = `${'é'.repeat(250)}${'ñ'.repeat(120)}${'ç'.repeat(129)}🚗`;

    expect(noteLength(accents)).toBe(NOTE_MOST);
    expect(noteTooLong(accents)).toBe(false);
    expect(noteTooLong(`${accents}x`)).toBe(true);
    expect(noteTooLong(`${accents}  \n`)).toBe(false);
    expect(noteLength('é')).toBe(1);
  });

  it('saves trimmed, and only spaces or blank lines as no note', () => {
    expect(savedNote('  Gate 2\n')).toBe('Gate 2');
    expect(savedNote(' \n\n ')).toBeNull();
  });

  it('has samples at 500 with no spaces and at 501', () => {
    expect(noteLength(WIDE_NOTE)).toBe(NOTE_MOST);
    expect(WIDE_NOTE).not.toMatch(/\s/u);
    expect(noteLength(LONG_NOTE)).toBe(NOTE_MOST + 1);
  });

  it('sits beside the venue, not inside it, and a duplicate carries it', () => {
    const wedding = sampleEvent('evt-wed-4');

    expect(wedding?.arrivalNote).toBe(ARRIVAL_NOTE);
    expect(wedding?.venue).not.toHaveProperty('arrivalNote');
    expect(keepCopy({ ...wedding!, venue: null }, '2027-06-01T12:00:00Z').arrivalNote).toBe(
      ARRIVAL_NOTE,
    );
  });

  it('is linked from the demo home, on the event and on the guest’s page', () => {
    const group = EVENTS_PAGES.find((one) => one.name === 'The arrival note (sc-24385)');

    expect(group?.states.map((one) => /state=(\w+)/u.exec(one.to)?.[1])).toEqual([
      'venueNote',
      'venueNoteTooLong',
      'venueNoteRefused',
      'venueNoteForbidden',
      'noteNoVenue',
      'noteWide',
      'noteMarkup',
    ]);
    expect(GUEST_NOTE_PAGES[0]?.states).toHaveLength(9);
  });
});

describe('Edit details › Venue, the arrival note', () => {
  it('sits under Address, optional, with its hint', SLOW, async () => {
    await page('venueNote');

    expect(box()).toBe(document.activeElement);
    expect((box() as HTMLTextAreaElement).value).toBe(ARRIVAL_NOTE);
    expect(within(venue()).getByText(/^How to find the entrance/u)).toBeDefined();
    const labels = [...venue().querySelectorAll('.desk-label')].map((one) => one.textContent);
    expect(labels).toEqual([
      'Venue name · Optional',
      'Address · Optional',
      'Arrival note · Optional',
    ]);
  });

  it(
    'refuses 501 characters before sending: the error, focus on the box, the status line',
    SLOW,
    async () => {
      await page('venueNoteTooLong');

      expect(within(venue()).getByText(TOO_LONG)).toBeDefined();
      expect(box().getAttribute('aria-invalid')).toBe('true');
      expect(box()).toBe(document.activeElement);
      expect(screen.getByText('1 field needs fixing, so nothing was sent.')).toBeDefined();
      fireEvent.change(box(), { target: { value: LONG_NOTE.slice(0, NOTE_MOST) } });
      expect(within(venue()).queryByText(TOO_LONG)).toBeNull();
    },
  );

  it('takes the server’s 422 in the same place', SLOW, async () => {
    await page('venueNoteRefused');

    expect(within(venue()).getByText(TOO_LONG)).toBeDefined();
    expect(box()).toBe(document.activeElement);
  });

  it('says a 403 beside the button and changes nothing', SLOW, async () => {
    await page('venueNoteForbidden');
    fireEvent.click(within(venue()).getByRole('button', { name: 'Save' }));

    expect(
      within(venue()).getByText(
        'Nothing was changed. Your role does not include the permission this needs.',
      ),
    ).toBeDefined();
    expect(sampleEvent('evt-wed-4')?.arrivalNote).toBe(ARRIVAL_NOTE);
  });
});

describe('Details › Venue on the event’s page', () => {
  it('shows the note under the address', SLOW, async () => {
    await page('live');

    expect(document.querySelector('.ev-note')?.textContent).toBe(ARRIVAL_NOTE);
  });

  it('reads Venue to be confirmed, the note, then Add the venue, with no venue', SLOW, async () => {
    await page('noteNoVenue');

    expect(screen.getByText('Venue to be confirmed')).toBeDefined();
    expect(document.querySelector('.ev-note')?.textContent).toBe(ARRIVAL_NOTE);
    fireEvent.click(screen.getByRole('button', { name: 'Add the venue' }));
    expect(venue()).toBeDefined();
  });

  it('offers Open in maps on OpenStreetMap, by the venue and its address', SLOW, async () => {
    await page('live');

    expect(screen.getByRole('link', { name: 'Open in maps' }).getAttribute('href')).toMatch(
      /^https:\/\/www\.openstreetmap\.org\/search\?query=/u,
    );
  });

  it('offers no Open in maps for a venue with no address', SLOW, async () => {
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/demo/events/evt-rafa-2'] })}
      />,
    );
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Rafael & Inês’s wedding' },
      { timeout: 8000 },
    );

    expect(screen.queryByRole('link', { name: 'Open in maps' })).toBeNull();
  });

  it('shows markup as those characters', SLOW, async () => {
    await page('noteMarkup');

    expect(document.querySelector('.ev-note')?.textContent).toBe(MARKUP_NOTE);
    expect(document.querySelector('.ev-note b')).toBeNull();
  });
});

describe('the guest’s page', () => {
  it('shows the note under the Where line, after Open in maps', async () => {
    await guest('arrivalNote');
    const where = document.querySelector('.gp-where') as HTMLElement;

    expect(within(where).getByText(/^Use the side entrance/u)).toBeDefined();
    expect(where.textContent?.indexOf('Open in maps')).toBeLessThan(
      where.textContent?.indexOf('Use the side entrance') ?? 0,
    );
  });

  it('shows a note with no venue on its own, with no Open in maps', async () => {
    await guest('arrivalNoteAlone');

    expect(screen.getByText(/^Use the side entrance/u)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Open in maps' })).toBeNull();
  });

  it('sends Open in maps to OpenStreetMap, as the host’s page does', async () => {
    await guest('arrivalNote');

    expect(screen.getByRole('link', { name: 'Open in maps' }).getAttribute('href')).toMatch(
      /^https:\/\/www\.openstreetmap\.org\/search\?query=/u,
    );
  });

  it.each(['arrivalNoteNone', 'arrivalNotePaused'])('%s shows no note', async (state) => {
    await guest(state);

    expect(document.querySelector('.gp-note')).toBeNull();
  });

  it('keeps the host’s words in French', async () => {
    await guest('arrivalNoteFrench');

    expect(document.querySelector('.gp-note')?.textContent).toBe(ARRIVAL_NOTE);
  });
});
