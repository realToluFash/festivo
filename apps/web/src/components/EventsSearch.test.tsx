import { type EventsFilters, NO_EVENTS_FILTERS } from '@soirely/domain';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Calendar, EventsFilterMenu } from './EventsSearch.tsx';

const CALENDAR: Calendar = { today: '2026-11-11', firstDay: 1, locale: 'en' };

const CHOSEN: EventsFilters = {
  types: ['wedding', 'birthday'],
  when: { kind: 'week' },
  hosts: ['Chidi Okafor'],
};

/** Every letter 8 px; Filter's marks and padding 50 px. */
let filterRoom = 0;

function widthOf(node: HTMLElement): number {
  if (node.classList.contains('ev-filter-at')) return filterRoom + 50;
  if (node.classList.contains('ev-filter')) return 50;
  if (node.classList.contains('ev-menu-value')) return 130;

  return 0;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return widthOf(this);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return widthOf(this);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function menu(filters: EventsFilters, start: 'top' | null = null) {
  return render(
    <EventsFilterMenu
      filters={filters}
      off={false}
      hosts={['Chidi Okafor', 'Adaeze Obi']}
      start={start}
      calendar={CALENDAR}
      onFilters={() => undefined}
    />,
  );
}

function filterLine(): string {
  return document.querySelector('.ev-filter .ev-picks')?.textContent ?? '';
}

describe('Filter', () => {
  it('shows the first whole picks that fit, then how many more', () => {
    filterRoom = 200;
    menu(CHOSEN);

    expect(filterLine()).toBe('Wedding, Birthday +2 more');
  });

  it('never cuts a pick part way to fit more of it', () => {
    filterRoom = 199;
    menu(CHOSEN);

    expect(filterLine()).toBe('Wedding +3 more');
  });

  it('shows every pick, with no count, when they all fit', () => {
    filterRoom = 1000;
    menu(CHOSEN);

    expect(filterLine()).toBe('Wedding, Birthday, This week, Chidi Okafor');
  });

  it('reads All with nothing chosen', () => {
    filterRoom = 10;
    menu(NO_EVENTS_FILTERS);

    expect(filterLine()).toBe('All');
  });

  it('names every pick to a screen reader, never the count', () => {
    filterRoom = 200;
    menu(CHOSEN);

    expect(screen.getByRole('button', { name: /^Filter:/ }).getAttribute('aria-label')).toBe(
      'Filter: Wedding, Birthday, This week, Chidi Okafor',
    );
  });
});

describe('the Filter menu rows', () => {
  it('fit whole picks between the title and the chevron, and still name them all', () => {
    filterRoom = 1000;
    menu({ ...CHOSEN, types: ['wedding', 'birthday', 'anniversary'] });
    fireEvent.click(screen.getByRole('button', { name: /^Filter:/ }));

    const type = screen.getByRole('menuitem', { name: 'Type Wedding, Birthday, Anniversary' });

    expect(type.querySelector('.ev-picks')?.textContent).toBe('Wedding +2 more');
    expect(
      screen.getByRole('menuitem', { name: 'When This week' }).querySelector('.ev-picks')
        ?.textContent,
    ).toBe('This week');
  });
});
