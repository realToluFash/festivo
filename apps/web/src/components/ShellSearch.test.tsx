import type { SearchFound } from '@soirely/api-client';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api.ts';
import { keyHint } from '../searchLinks.ts';
import { SearchRow, ShellSearch } from './ShellSearch.tsx';

function guest(id: string, name: string) {
  return {
    id,
    name,
    event: {
      id: 'ev_1',
      name: 'Gala',
      startsAt: '2026-11-14T16:00:00+01:00',
      timeZone: 'Africa/Lagos',
    },
  };
}

const FOUND: SearchFound = {
  events: { total: 0, matches: [] },
  guests: { total: 23, matches: [guest('g1', 'Inês Duarte'), guest('g2', 'Ines Okafor')] },
  members: {
    total: 1,
    matches: [
      {
        id: 'i1',
        kind: 'invitation',
        name: null,
        email: 'ines.moura@example.com',
        role: { id: 'r1', seededAs: 'member', name: null },
        status: 'invited',
      },
    ],
  },
};

function Where() {
  const at = useLocation();

  return <p data-testid="at">{`${at.pathname}${at.search}`}</p>;
}

function shell(organisationId: string | null = 'org_1') {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <ShellSearch organisationId={organisationId}>
        <SearchRow />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </ShellSearch>
    </MemoryRouter>,
  );
}

function reaching(reach = { events: true, guests: true, members: true }) {
  vi.spyOn(api, 'searchReach').mockResolvedValue(reach);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Search (sc-39534)', () => {
  it('opens from the sidebar row with the cursor in its field, worded for what the person may find', async () => {
    reaching({ events: true, guests: true, members: false });
    shell();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const field = screen.getByRole('combobox', { name: 'Search' });
    expect(document.activeElement).toBe(field);
    await waitFor(() => expect(field.getAttribute('placeholder')).toBe('Search events and guests'));
    expect(screen.getByText('Find an event or a guest.')).toBeTruthy();
  });

  it('opens and closes with ⌘K or Ctrl+K, and a person outside an organisation has no Search', () => {
    reaching();
    const { unmount } = shell();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();

    shell(null);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
  });

  it('sends nothing under two characters', async () => {
    reaching();
    const search = vi.spyOn(api, 'search');
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'i' } });

    expect(await screen.findByText('Type at least 2 characters.')).toBeTruthy();
    expect(search).not.toHaveBeenCalled();
  });

  it('lists each heading with the server’s count, a guest without contact details, and opens the one picked with the keyboard', async () => {
    reaching();
    const search = vi.spyOn(api, 'search').mockResolvedValue(FOUND);
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ines' } });

    const guests = await screen.findByRole('group', { name: 'Guests, 23 matches' });
    expect(search).toHaveBeenCalledWith('org_1', 'ines', expect.any(AbortSignal));
    expect(within(guests).getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: /^Events/ })).toBeNull();
    expect(
      screen.getByRole('option', { name: 'ines.moura@example.com, Member, Invited' }),
    ).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('24 matches');

    const field = screen.getByRole('combobox');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(screen.getByTestId('at').textContent).toBe('/app/events/ev_1/guests?guest=g2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says what was searched for when nothing matches, and Clear search empties the field', async () => {
    reaching();
    vi.spyOn(api, 'search').mockResolvedValue({ events: null, guests: null, members: null });
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'garden party' } });

    expect(await screen.findAllByText('Nothing matches “garden party”.')).toHaveLength(2);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    });
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  });

  it('writes the key hint the reader’s keyboard has', () => {
    expect(keyHint('macOS')).toBe('⌘K');
    expect(keyHint('Windows')).toBe('Ctrl K');
  });
});
