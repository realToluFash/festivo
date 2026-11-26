import type { OrganisationEvent } from '@soirely/api-client';
import type { Milestone } from '@soirely/domain';
import { fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { EventNeeds } from './EventNeeds.tsx';
import { needRows } from './eventNeeds.ts';
import type { TimelineRead } from './Timeline.tsx';

const LAGOS = 'Africa/Lagos';
const NOW = new Date('2026-11-10T09:00:00Z');

function milestone(at: string, overrides: Partial<Milestone> = {}): Milestone {
  return {
    at,
    title: 'Give final numbers to the kitchen',
    note: null,
    owner: 'you',
    area: 'menu',
    action: null,
    ...overrides,
  };
}

const KITCHEN = milestone('2026-11-08T22:59:00Z', {
  action: { label: 'Open the kitchen sheet', link: '/app/events/evt-1/kitchen' },
});

const event = (permissions: string[]) => ({ id: 'evt-1', permissions }) as OrganisationEvent;

function read(load: TimelineRead['load'], retry = vi.fn()): TimelineRead {
  return { load, now: NOW, retried: false, retry };
}

const loaded = (milestones: Milestone[]): TimelineRead['load'] => ({
  kind: 'loaded',
  timeline: { timeZone: LAGOS, milestones },
  at: NOW,
});

function show(timeline: TimelineRead, permissions = ['menu.read', 'menu.manage']) {
  return render(
    <MemoryRouter>
      <EventNeeds event={event(permissions)} timeline={timeline} />
    </MemoryRouter>,
  );
}

describe('an event’s Needs you card', () => {
  it('lists a row with its due words, a count and the action as a link on the row', () => {
    show(read(loaded([KITCHEN])));

    expect(screen.getByRole('heading', { name: 'Needs you, 1 thing' })).toBeTruthy();
    const row = within(screen.getByRole('listitem'));

    expect(row.getByText('Give final numbers to the kitchen')).toBeTruthy();
    expect(row.getByText('2 days overdue')).toBeTruthy();
    expect(row.getByRole('link', { name: 'Open the kitchen sheet' }).getAttribute('href')).toBe(
      '/app/events/evt-1/kitchen',
    );
  });

  it('has no button on a row whose milestone has no action', () => {
    show(read(loaded([milestone('2026-11-12T22:59:00Z')])));

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Due Thu, Nov 12')).toBeTruthy();
  });

  it('reads the heading with its count above one, and alone with none', () => {
    const { unmount } = show(
      read(loaded([KITCHEN, milestone('2026-11-12T22:59:00Z', { title: 'Another' })])),
    );

    expect(screen.getByRole('heading', { name: 'Needs you, 2 things' })).toBeTruthy();
    unmount();
    show(read(loaded([])));
    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeTruthy();
    expect(screen.getByText('Nothing needs you')).toBeTruthy();
  });

  it('lists nothing for a member holding only read, and nothing from Automatic or Event', () => {
    show(read(loaded([KITCHEN, milestone('2026-11-12T10:00:00Z', { owner: 'automatic' })])), [
      'menu.read',
    ]);

    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.getByText('Nothing needs you')).toBeTruthy();
  });

  it('shows neither row, count nor tick while loading', () => {
    show(read({ kind: 'loading' }));

    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeTruthy();
    expect(screen.getByText('Loading the dates…')).toBeTruthy();
    expect(screen.queryByText('Nothing needs you')).toBeNull();
  });

  it('offers Try again after a failed load, with no tick', () => {
    const retry = vi.fn();

    show(read({ kind: 'failed' }, retry));

    expect(screen.getByText('The dates did not load.')).toBeTruthy();
    expect(screen.queryByText('Nothing needs you')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('the rows', () => {
  const t = i18next.t.bind(i18next);
  const rows = (milestones: Milestone[], now = NOW) =>
    needRows(milestones, ['menu.manage'], LAGOS, now, 'en-US', t);

  it('counts the day in the event’s zone, not the reader’s', () => {
    // 23:59 in Lagos on 9 Nov is 22:59Z; to a reader in Los Angeles it is still 9 Nov afternoon.
    const at = '2026-11-09T22:59:00Z';

    expect(rows([milestone(at)], new Date('2026-11-09T08:00:00Z'))[0]?.due).toBe('Due today');
    expect(rows([milestone(at)], new Date('2026-11-10T00:30:00Z'))[0]?.due).toBe('1 day overdue');
  });

  it('writes the year only in another year', () => {
    expect(rows([milestone('2026-11-13T22:59:00Z')])[0]?.due).toBe('Due Fri, Nov 13');
    expect(rows([milestone('2027-01-13T22:59:00Z')])[0]?.due).toBe('Due Wed, Jan 13, 2027');
  });

  it('leads with overdue rows and breaks a tie by title', () => {
    const list = rows([
      milestone('2026-11-20T10:00:00Z', { title: 'Zeta' }),
      milestone('2026-11-05T10:00:00Z', { title: 'Late one' }),
      milestone('2026-11-20T10:00:00Z', { title: 'Alpha' }),
    ]);

    expect(list.map(({ milestone: one }) => one.title)).toEqual(['Late one', 'Alpha', 'Zeta']);
    expect(list[0]?.late).toBe(true);
  });
});
