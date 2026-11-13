import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 15000 };

function at(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function board(state: string): Promise<HTMLElement> {
  at(`/demo/search?state=${state}`);

  return screen.findByRole('dialog', { name: 'Search' }, WAIT);
}

const field = (dialog: HTMLElement) => within(dialog).getByRole('combobox', { name: 'Search' });

function groupNames(dialog: HTMLElement): string[] {
  return within(dialog)
    .queryAllByRole('group')
    .map((group) => group.getAttribute('aria-labelledby') ?? '')
    .map((id) => document.getElementById(id)?.textContent ?? '');
}

describe('Search as a command palette (sc-39534)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  afterEach(() => {
    __setConfig(tested);
    vi.useRealTimers();
  });

  it('opens from the sidebar’s row, focused, and closes on Esc back to the row', SLOW, async () => {
    at('/demo/today');
    const nav = await screen.findByRole('navigation', { name: 'Soirely' }, WAIT);
    const row = within(nav).getByRole('button', { name: 'Search' });

    expect(row.getAttribute('aria-keyshortcuts')).toBe('Meta+K Control+K');
    row.focus();
    fireEvent.click(row);
    const dialog = screen.getByRole('dialog', { name: 'Search' });

    await waitFor(() => expect(document.activeElement).toBe(field(dialog)));
    expect(within(dialog).getByText('Find an event, a guest or a member.')).toBeDefined();

    fireEvent.keyDown(field(dialog), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it('opens and closes with ⌘K and Ctrl+K', SLOW, async () => {
    at('/demo/settings');
    await screen.findByRole('navigation', { name: 'Soirely' }, WAIT);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
  });

  it('closes when the scrim is clicked', SLOW, async () => {
    await board('idle');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
  });

  it('asks for 2 characters under two', SLOW, async () => {
    const short = await board('short');
    expect(within(short).getByText('Type at least 2 characters.')).toBeDefined();
  });

  it('shows three skeleton rows while loading, and says Searching…', SLOW, async () => {
    const dialog = await board('loading');

    expect(dialog.querySelectorAll('.search-bone')).toHaveLength(3);
    expect(within(dialog).getByRole('status').textContent).toBe('Searching…');
  });

  it('groups ines as Events 1, Guests 5 of 7, Members 4, with no Show all', SLOW, async () => {
    const dialog = await board('mixed');

    expect(groupNames(dialog)).toEqual(['Events1', 'Guests7', 'Members4']);
    expect(within(dialog).getAllByRole('option')).toHaveLength(10);
    expect(within(dialog).queryByRole('option', { name: /Show all/u })).toBeNull();
    expect(within(dialog).getByRole('status').textContent).toBe('12 matches');
    expect(field(dialog).getAttribute('aria-expanded')).toBe('true');
  });

  it(
    'shows a member’s email, role and standing, and an invitation by its email once',
    SLOW,
    async () => {
      const dialog = await board('mixed');
      const members = within(dialog).getAllByRole('group')[2] as HTMLElement;

      expect(
        within(members)
          .getAllByRole('option')
          .map((one) => one.getAttribute('aria-label')),
      ).toEqual([
        'Inês Rocha, ines.rocha@outlook.com · Member, Awaiting approval',
        'Inês Santos, ines.s@gmail.com · Member, Suspended',
        'Inês Santos, ines.santos@ire-events.com · Admin',
        'ines.moura@gmail.com, Member, Invited',
      ]);
      expect(within(members).getByText('Suspended').closest('.desk-tag')).not.toBeNull();
    },
  );

  it('finds one event by its venue', SLOW, async () => {
    const dialog = await board('one');

    expect(groupNames(dialog)).toEqual(['Events1']);
    expect(
      within(dialog).getByRole('option', {
        name: 'Adaeze & Tunde’s wedding, Thu, Nov 5 to Sat, Nov 7 · The Landmark, London',
      }),
    ).toBeDefined();
  });

  it('says nothing matches garden party in one sentence, with Clear search', SLOW, async () => {
    const dialog = await board('none');

    expect(within(dialog).getByRole('status').textContent).toBe('Nothing matches “garden party”.');
    expect(within(dialog).queryByText(/Search finds/u)).toBeNull();
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear search' }));
    expect((field(dialog) as HTMLInputElement).value).toBe('');
    expect(within(dialog).getByText('Find an event, a guest or a member.')).toBeDefined();
    expect(document.activeElement).toBe(field(dialog));
  });

  it('gives a Member events and guests, and no Members heading', SLOW, async () => {
    const dialog = await board('member');

    expect(groupNames(dialog)).toEqual(['Events1', 'Guests7']);
    expect(field(dialog).getAttribute('placeholder')).toBe('Search events and guests');
  });

  it(
    'has no Guests heading, and no Awaiting approval, for a custom role with events and members',
    SLOW,
    async () => {
      const dialog = await board('no-guests');

      expect(groupNames(dialog)).toEqual(['Events1', 'Members3']);
      expect(field(dialog).getAttribute('placeholder')).toBe('Search events and members');
      expect(within(dialog).queryByText('Awaiting approval')).toBeNull();
    },
  );

  it('says Search and no hint to a role that can find nothing', SLOW, async () => {
    const dialog = await board('nothing-to-find');

    expect(field(dialog).getAttribute('placeholder')).toBe('Search');
    expect(within(dialog).queryByText(/^Find /u)).toBeNull();
  });

  it(
    'searches as the person Settings shows: a Member is told events and guests',
    SLOW,
    async () => {
      at('/demo/settings/members?as=ana');
      await screen.findByRole('navigation', { name: 'Soirely' }, WAIT);

      fireEvent.keyDown(window, { key: 'k', metaKey: true });
      const dialog = screen.getByRole('dialog', { name: 'Search' });
      expect(field(dialog).getAttribute('placeholder')).toBe('Search events and guests');
    },
  );

  it('draws one guest on two events as two rows', SLOW, async () => {
    const dialog = await board('two-events');

    expect(
      within(dialog)
        .getAllByRole('option')
        .map((one) => one.getAttribute('aria-label')),
    ).toEqual([
      'Inês Duarte, Rafael & Inês’s wedding · Sat, Oct 17',
      'Inês Duarte, Adaeze & Tunde’s wedding · Thu, Nov 5',
    ]);
  });

  it(
    'lists 5 of six Quinta events then Show all in Events, the long name whole in its title',
    SLOW,
    async () => {
      const dialog = await board('long');
      const rows = within(dialog).getAllByRole('option');

      expect(groupNames(dialog)).toEqual(['Events6']);
      expect(rows).toHaveLength(6);
      expect(rows[2]?.getAttribute('title')).toContain(
        'Casamento de Maria Eduarda Albuquerque e João Pedro Vasconcelos',
      );
      expect(rows[5]?.textContent).toBe('Show all in Events');
    },
  );

  it('opens Events with the same search from Show all in Events', SLOW, async () => {
    const router = at('/demo/search?state=long');
    const dialog = await screen.findByRole('dialog', { name: 'Search' }, WAIT);

    fireEvent.click(within(dialog).getByRole('option', { name: 'Show all in Events' }));
    await waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
        '/demo/events?q=quinta',
      ),
    );
  });

  it('says Search needs a connection. offline, and lists no matches', SLOW, async () => {
    const dialog = await board('offline');

    expect(within(dialog).getByText('Search needs a connection.')).toBeDefined();
    expect((field(dialog) as HTMLInputElement).value).toBe('ines');
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);
  });

  it('moves the lit row with the arrows, Home and End', SLOW, async () => {
    const dialog = await board('mixed');
    const combo = field(dialog);
    const lit = () => document.getElementById(combo.getAttribute('aria-activedescendant') ?? '');

    expect(lit()?.textContent).toContain('Rafael & Inês’s wedding');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(lit()?.textContent).toContain('Inês Almeida');
    fireEvent.keyDown(combo, { key: 'End' });
    expect(lit()?.textContent).toContain('ines.moura@gmail.com');
    fireEvent.keyDown(combo, { key: 'Home' });
    expect(lit()?.getAttribute('aria-selected')).toBe('true');
    expect(lit()?.textContent).toContain('Rafael & Inês’s wedding');
  });

  it('opens a member with Enter in Settings › Members', SLOW, async () => {
    const router = at('/demo/search?state=mixed');
    const combo = field(await screen.findByRole('dialog', { name: 'Search' }, WAIT));

    fireEvent.keyDown(combo, { key: 'End' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/demo/settings/members'));
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
  });

  it('opens an event on its page', SLOW, async () => {
    const router = at('/demo/search?state=one');
    const dialog = await screen.findByRole('dialog', { name: 'Search' }, WAIT);

    fireEvent.click(within(dialog).getAllByRole('option')[0] as HTMLElement);
    await waitFor(() => expect(router.state.location.pathname).toBe('/demo/events/evt-wed-4'));
  });

  it('opens the picked guest’s details on that guest’s event', SLOW, async () => {
    const router = at('/demo/search?state=two-events');
    const combo = field(await screen.findByRole('dialog', { name: 'Search' }, WAIT));

    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    await waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
        '/demo/guests?event=evt-wed-4&guest=ines',
      ),
    );
  });

  it('filters the sample as you type, after a pause', SLOW, async () => {
    const dialog = await board('idle');
    vi.useFakeTimers();

    fireEvent.change(field(dialog), { target: { value: 'duarte' } });
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(within(dialog).getAllByRole('option')).toHaveLength(2);
  });
});
