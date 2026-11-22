import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

function open(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4?state=${state}`],
  });
  render(<RouterProvider router={router} />);
}

async function address(): Promise<HTMLInputElement> {
  return (await screen.findByRole('combobox', { name: /Address/ }, WAIT)) as HTMLInputElement;
}

function credit(name = 'OpenStreetMap contributors') {
  return screen.queryByRole('link', { name });
}

function stadia() {
  return screen.queryByRole('link', { name: 'Stadia Maps' });
}

describe('Address suggestions credit Stadia Maps and OpenStreetMap (sc-80918)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });
  afterEach(cleanup);

  it(
    'ends the list with the credit, outside the listbox, two links each in a new tab',
    SLOW,
    async () => {
      open('venueSuggestions');
      await address();
      const list = await screen.findByRole('listbox', {}, WAIT);
      const links = [stadia(), credit()];

      expect(within(list).getAllByRole('option')).toHaveLength(3);
      expect(links[0]?.closest('p')?.textContent).toBe(
        '© Stadia Maps © OpenStreetMap contributors',
      );
      expect(links.map((link) => link?.getAttribute('href'))).toEqual([
        'https://stadiamaps.com/attribution/',
        'https://www.openstreetmap.org/copyright',
      ]);
      for (const link of links) {
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
        expect(list.contains(link)).toBe(false);
        expect(list.nextElementSibling?.contains(link)).toBe(true);
      }
      expect(screen.getByText(/^3 suggestions/).getAttribute('role')).toBe('status');
    },
  );

  it('keeps the credit with one suggestion', SLOW, async () => {
    open('venueOne');
    await address();

    expect(
      within(await screen.findByRole('listbox', {}, WAIT)).getAllByRole('option'),
    ).toHaveLength(1);
    expect(credit()).not.toBeNull();
    expect(stadia()).not.toBeNull();
  });

  it.each(['venueShort', 'venueNoMatch', 'venueDown'])(
    'shows no credit in %s',
    SLOW,
    async (state) => {
      open(state);
      await address();

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(credit()).toBeNull();
      expect(stadia()).toBeNull();
    },
  );

  it('writes the credit in French, Stadia Maps and OpenStreetMap as written', SLOW, async () => {
    open('venueFrench');
    await address();
    const link = await screen.findByRole(
      'link',
      { name: 'les contributeurs d’OpenStreetMap' },
      WAIT,
    );

    expect(link.closest('p')?.getAttribute('lang')).toBe('fr');
    expect(link.closest('p')?.textContent).toBe(
      '© Stadia Maps © les contributeurs d’OpenStreetMap',
    );
    expect(stadia()?.getAttribute('href')).toBe('https://stadiamaps.com/attribution/');
  });

  it(
    'keeps the list open while focus is on the credit, and Escape there goes back to Address',
    SLOW,
    async () => {
      open('venueSuggestions');
      const field = await address();
      const link = credit();
      if (link == null) throw new Error('no credit');

      link.focus();
      fireEvent.blur(field, { relatedTarget: link });
      await new Promise((done) => setTimeout(done, 10));
      expect(screen.queryByRole('listbox')).not.toBeNull();

      fireEvent.keyDown(link, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
      expect(document.activeElement).toBe(field);
      expect(field.value).toBe('Eko Hot');
    },
  );

  it(
    'keeps the list while focus moves between the two links and back to Address',
    SLOW,
    async () => {
      open('venueSuggestions');
      const field = await address();
      const first = stadia();
      const second = credit();
      if (first == null || second == null) throw new Error('no credit');

      const settle = () => new Promise((done) => setTimeout(done, 10));

      first.focus();
      await settle();
      second.focus();
      await settle();
      field.focus();
      await settle();

      expect(screen.queryByRole('listbox')).not.toBeNull();
      expect(document.activeElement).toBe(field);
    },
  );

  it('still closes the list on Escape in Address', SLOW, async () => {
    open('venueSuggestions');
    const field = await address();
    await screen.findByRole('listbox', {}, WAIT);

    fireEvent.keyDown(field, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(credit()).toBeNull();
  });

  it(
    'never makes the credit the active option: the arrows stop at the last suggestion',
    SLOW,
    async () => {
      open('venueSuggestions');
      const field = await address();
      await screen.findByRole('listbox', {}, WAIT);

      for (let press = 0; press < 5; press += 1) fireEvent.keyDown(field, { key: 'ArrowDown' });
      const active = field.getAttribute('aria-activedescendant');

      expect(active).not.toBeNull();
      expect(document.getElementById(active ?? '')?.getAttribute('role')).toBe('option');
    },
  );
});
