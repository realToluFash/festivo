import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { KW, resetKitchen } from './kitchen.ts';
import { LONG_NAMES } from './kitchenChanges.ts';
import { PW } from './kitchenParts.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/kitchen';

function open(path: string) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function kitchen(state?: string) {
  const router = open(state == null ? AT : `${AT}?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: KW.title }, WAIT);

  return router;
}

function block(): HTMLElement {
  return screen.getByRole('region', { name: KW.final });
}

function dueRow(): HTMLElement {
  return within(block()).getByRole('button', { name: /Final numbers due/u });
}

function field(): HTMLInputElement {
  return within(block()).getByLabelText(KW.due, { selector: 'input' }) as HTMLInputElement;
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
  resetKitchen();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Final numbers due on the kitchen sheet (sc-30812)', () => {
  it('starts with None, and Give final numbers… as the card’s one step', SLOW, async () => {
    await kitchen('empty');

    expect(dueRow().textContent).toContain(KW.none);
    expect(screen.getByRole('button', { name: KW.give })).toBeDefined();
    expect(within(block()).queryByText(/Given to the kitchen on/u)).toBeNull();
  });

  it('shows the picks-close line beside a date before the last close', SLOW, async () => {
    await kitchen('set');

    expect(dueRow().textContent).toContain('Tue, Nov 3');
    expect(within(block()).getByText('Guests can still choose until Wed, Nov 4.')).toBeDefined();
  });

  it(
    'refuses the day the event starts before anything is sent, under the field',
    SLOW,
    async () => {
      await kitchen('set');
      fireEvent.click(dueRow());
      fireEvent.change(field(), { target: { value: '2026-11-05' } });
      fireEvent.click(within(block()).getByRole('button', { name: 'Save' }));

      expect(within(block()).getByRole('alert').textContent).toBe(KW.errorStart);
      expect(field().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(field());
    },
  );

  it('refuses a new day in the past, and saves today', SLOW, async () => {
    await kitchen('set');
    fireEvent.click(dueRow());
    fireEvent.change(field(), { target: { value: '2026-11-02' } });
    fireEvent.click(within(block()).getByRole('button', { name: 'Save' }));
    expect(within(block()).getByRole('alert').textContent).toBe(KW.errorPast);

    fireEvent.change(field(), { target: { value: '2026-11-04' } });
    fireEvent.click(within(block()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(KW.saved)).toBeDefined();
    expect(dueRow().textContent).toContain('Wed, Nov 4');
    expect(within(block()).queryByText(/Guests can still choose/u)).toBeNull();
  });

  it('clears the date with the field’s clear button and Save', SLOW, async () => {
    await kitchen('set');
    fireEvent.click(dueRow());
    fireEvent.click(within(block()).getByRole('button', { name: KW.clear }));
    fireEvent.click(within(block()).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(KW.saved)).toBeDefined();
    expect(dueRow().textContent).toContain(KW.none);
  });

  it('keeps a passed date shown as set and editable', SLOW, async () => {
    await kitchen('passed');

    expect(dueRow().textContent).toContain('Mon, Nov 2');
    fireEvent.click(dueRow());
    expect(field().value).toBe('2026-11-02');
  });

  it('shows the API’s 422 under the field and saves nothing', SLOW, async () => {
    await kitchen('refused');

    expect(within(block()).getByRole('alert').textContent).toBe(KW.errorPast);
    fireEvent.click(within(block()).getByRole('button', { name: 'Save' }));
    expect(within(block()).getByRole('alert').textContent).toBe(KW.errorPast);
    expect(screen.queryByText(KW.saved)).toBeNull();
  });

  it(
    'gives menu.read the date read only, no Give final numbers…, and the copies',
    SLOW,
    async () => {
      await kitchen('viewer');

      expect(within(block()).queryByRole('button', { name: /Final numbers due/u })).toBeNull();
      expect(screen.queryByRole('button', { name: KW.give })).toBeNull();
      expect(within(block()).getByRole('button', { name: KW.copyDownload })).toBeDefined();
      expect(screen.getByText(KW.namesNeed)).toBeDefined();
    },
  );
});

describe('Give final numbers…', () => {
  it('makes, downloads and records a copy in one press, and says so', SLOW, async () => {
    await kitchen('set');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole('button', { name: KW.give }));

    const dialog = screen.getByRole('alertdialog', { name: KW.giveTitle });
    expect(within(dialog).getByText(KW.giveBody)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: KW.download }));
    expect(within(dialog).getByRole('button', { name: KW.making })).toBeDefined();

    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText(KW.given)).toBeDefined();
    expect(
      within(block()).getByText(
        'Given to the kitchen on Tuesday, Nov 3 at 09:41 by Folake Adeyemi',
      ),
    ).toBeDefined();
  });

  it('lists two copies given in one visit, newest first', SLOW, async () => {
    await kitchen('copies');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    for (const round of [1, 2]) {
      fireEvent.click(screen.getByRole('button', { name: KW.give }));
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: KW.download }),
      );
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(within(block()).getAllByText(/^Given to the kitchen on/u)).toHaveLength(3 + round);
    }

    const lines = within(block())
      .getAllByText(/^Given to the kitchen on/u)
      .map((one) => one.textContent);
    expect(lines.slice(0, 3)).toEqual(
      Array(3).fill('Given to the kitchen on Tuesday, Nov 3 at 09:41 by Folake Adeyemi'),
    );
    expect(lines.slice(3)).toEqual([
      'Given to the kitchen on Monday, Nov 2 at 17:00 by Ana Souza',
      'Given to the kitchen on Friday, Oct 30 at 12:15 by Folake Adeyemi',
    ]);
  });

  it('records nothing on Cancel', SLOW, async () => {
    await kitchen('giveNoDate');
    fireEvent.click(screen.getByRole('button', { name: KW.cancel }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(block()).queryByText(/Given to the kitchen on/u)).toBeNull();
  });

  it('keeps the dialog open on a failure, and Try again records it', SLOW, async () => {
    await kitchen('failed');
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const dialog = screen.getByRole('alertdialog', { name: KW.giveTitle });
    expect(within(dialog).getByText(KW.failed)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: KW.retry }));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(screen.getByText(KW.given)).toBeDefined();
  });

  it('lists several copies newest first', SLOW, async () => {
    await kitchen('copies');

    const lines = within(block())
      .getAllByText(/^Given to the kitchen on/u)
      .map((one) => one.textContent);
    expect(lines).toEqual([
      'Given to the kitchen on Tuesday, Nov 3 at 09:41 by Folake Adeyemi',
      'Given to the kitchen on Monday, Nov 2 at 17:00 by Ana Souza',
      'Given to the kitchen on Friday, Oct 30 at 12:15 by Folake Adeyemi',
    ]);
  });
});

describe('the milestone on the Overview and All dates', () => {
  it('is the Overview card’s Next up, with Open the kitchen sheet as its step', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4?state=finalNumbers');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }, WAIT);

    expect(screen.getByText('Next up: Give final numbers to the kitchen')).toBeDefined();
    expect(screen.getByText('Tue, Nov 3, 23:59 · today')).toBeDefined();

    const links = screen.getAllByRole('link', { name: KW.openSheet });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([AT, AT]);
    fireEvent.click(links[0]!);
    expect(router.state.location.pathname).toBe(AT);
  });

  it('says Overdue on the card once its moment passes', SLOW, async () => {
    open('/demo/events/evt-wed-4?state=finalNumbersOverdue');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }, WAIT);

    expect(screen.getByText(KW.overdue)).toBeDefined();
  });

  it('goes once a copy is recorded: the start is Next up again', SLOW, async () => {
    open('/demo/events/evt-wed-4?state=finalNumbersGiven');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }, WAIT);

    expect(screen.queryByText(/Give final numbers to the kitchen/u)).toBeNull();
    expect(screen.getByText('Next up: Adaeze & Tunde’s wedding starts')).toBeDefined();
  });

  it(
    'lists the milestone on All dates, marked You, Overdue and Next up, with its action',
    SLOW,
    async () => {
      open('/demo/events/evt-wed-4/dates?state=finalNumbersOverdue');
      await screen.findByRole('heading', { level: 1, name: KW.allDates }, WAIT);

      const list = screen.getByRole('heading', { level: 1, name: KW.allDates }).parentElement!;
      const rows = within(list.querySelector('ol')!).getAllByRole('listitem');
      expect(rows[0]?.textContent).toContain('Give final numbers to the kitchen');
      expect(rows[0]?.textContent).toContain('You · Mon, Nov 2, 23:59');
      expect(within(rows[0]!).getByText(KW.overdue)).toBeDefined();
      expect(within(rows[0]!).getByText(KW.nextUpTag)).toBeDefined();
      expect(within(rows[0]!).getByRole('link', { name: KW.openSheet })).toBeDefined();
    },
  );

  it('carries a recorded copy back to All dates: no milestone', SLOW, async () => {
    await kitchen('set');
    open('/demo/events/evt-wed-4/dates?state=finalNumbersGiven');
    await screen.findByRole('heading', { level: 1, name: KW.allDates }, WAIT);

    expect(screen.queryByText('Give final numbers to the kitchen')).toBeNull();
    expect(screen.getByText('Adaeze & Tunde’s wedding starts')).toBeDefined();
  });

  it(
    'leaves Events A’s own states as their boards draw them after a visit to the sheet',
    SLOW,
    async () => {
      await kitchen('set');
      open('/demo/events/evt-wed-4?state=live');
      await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }, WAIT);

      expect(screen.queryByText('Next up: Give final numbers to the kitchen')).toBeNull();
      expect(screen.getByText('Next up: Adaeze & Tunde’s wedding starts')).toBeDefined();
    },
  );

  it('keeps what the demo holds when the Overview opens with no state', SLOW, async () => {
    await kitchen('set');
    open('/demo/events/evt-wed-4');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }, WAIT);

    expect(screen.getByText('Next up: Give final numbers to the kitchen')).toBeDefined();
  });

  it('opens the kitchen sheet from the event’s Menu', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4?area=menu');
    fireEvent.click(await screen.findByRole('link', { name: KW.title }, WAIT));

    expect(router.state.location.pathname).toBe(AT);
  });
});

describe('nothing leaves the demo', () => {
  it('sends nothing while a date is saved and a copy is given', SLOW, async () => {
    const fetched = vi.spyOn(globalThis, 'fetch');
    await kitchen('set');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole('button', { name: KW.give }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: KW.download }),
    );
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(fetched.mock.calls).toEqual([]);
    fetched.mockRestore();
  });
});

describe('Changes since on the kitchen sheet (sc-30692)', () => {
  const SINCE = 'Since Monday, Nov 2 at 17:00';
  const GIVE = 'Give the changes…';

  function changes(): HTMLElement {
    return screen.getByRole('region', { name: /since/iu });
  }

  function lines(): string[] {
    return within(within(changes()).getByRole('list'))
      .getAllByRole('listitem')
      .map((one) => one.textContent ?? '');
  }

  it(
    'opens the sheet with the list, names with guests.manage, ending with Give the changes…',
    SLOW,
    async () => {
      await kitchen('changes_named');

      expect(within(changes()).getByRole('heading', { level: 2 }).textContent).toBe(SINCE);
      expect(lines()).toEqual([
        'New allergy: Sesame (Yusuf Ibrahim)',
        'New diet: Halal (Ngozi Eze)',
        '2 more coming',
        'Pepper soup 50 to 52',
        'Jollof rice with chicken 45 to 48',
        'Grilled sea bass 31 to 30',
        'Chocolate tart 51 to 53',
      ]);
      expect(within(changes()).getByRole('button', { name: GIVE })).toBeDefined();
      expect(screen.getByRole('heading', { level: 2, name: /^Allergies/u }).textContent).toBe(
        'Allergies · 7',
      );
    },
  );

  it('keeps a long dish and variant whole, and lets the row break anywhere', SLOW, async () => {
    await kitchen('changes_long');

    expect(lines()).toEqual([
      `Renamed: ${LONG_NAMES.dishWas}, now ${LONG_NAMES.dish}`,
      `Renamed: ${LONG_NAMES.dish} · ${LONG_NAMES.sideWas}, now ${LONG_NAMES.side}`,
    ]);
    expect(lines().join('')).not.toContain('…');
    expect(readFileSync(join(import.meta.dirname, 'kitchen.css'), 'utf8')).toMatch(
      /\.kitchen-changes \.desk-row-name \{\s*overflow-wrap: anywhere;\s*\}/u,
    );
  });

  it('gives counts and no name without guests.manage', SLOW, async () => {
    await kitchen('changes_counts');

    expect(lines().slice(0, 2)).toEqual([
      'New allergy: Sesame (1 guest)',
      'New diet: Halal (1 guest)',
    ]);
    expect(changes().textContent).not.toContain('Yusuf');
  });

  it('shows a renamed dish before its count, with the sheet under it renamed', SLOW, async () => {
    await kitchen('changes_menu');

    expect(lines()).toContain('Renamed: Grilled sea bass, now Pan-seared sea bass');
    expect(lines()).toContain('Removed: Mushroom risotto, was 15');
    expect(screen.getByRole('region', { name: /^Main/u }).textContent).toContain(
      'Pan-seared sea bass32',
    );
  });

  it('never nets a count without guests.manage', SLOW, async () => {
    await kitchen('changes_swap');

    expect(lines()).toEqual([
      'New allergy: Peanuts (1 guest)',
      'Allergy removed: Peanuts (1 guest)',
    ]);
    expect(changes().textContent).not.toContain('Amaka');
    expect(within(changes()).getByRole('heading', { level: 2 }).textContent).toBe(SINCE);
  });

  it('counts an erased guest for every reader', SLOW, async () => {
    await kitchen('changes_erased');

    expect(lines()).toContain('Allergy removed: Shellfish (1 guest)');
    expect(changes().textContent).not.toContain('Kwame');
  });

  it('says no changes, with no Give the changes…', SLOW, async () => {
    await kitchen('no_changes');

    expect(within(changes()).getByRole('heading', { level: 2 }).textContent).toBe(
      'No changes since Monday, Nov 2 at 17:00.',
    );
    expect(screen.queryByRole('button', { name: GIVE })).toBeNull();
  });

  it('has no list without a copy', SLOW, async () => {
    await kitchen('no_copy');

    expect(screen.queryByRole('region', { name: /since/iu })).toBeNull();
  });

  it(
    'shows the list and nothing to give without menu.manage, and after the start',
    SLOW,
    async () => {
      await kitchen('view_only');
      expect(lines()).toHaveLength(7);
      expect(screen.queryByRole('button', { name: GIVE })).toBeNull();

      await kitchen('started');
      expect(lines()).toHaveLength(7);
      expect(screen.queryByRole('button', { name: GIVE })).toBeNull();
    },
  );

  it(
    'records the next copy through sc-30812’s dialog, then reads no changes since it',
    SLOW,
    async () => {
      await kitchen('changes_named');
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fireEvent.click(screen.getByRole('button', { name: GIVE }));

      const dialog = screen.getByRole('alertdialog', { name: KW.giveTitle });
      expect(within(dialog).getByText(KW.giveBody)).toBeDefined();
      fireEvent.click(within(dialog).getByRole('button', { name: KW.download }));
      await act(() => vi.advanceTimersByTimeAsync(1000));

      expect(screen.getByText(KW.given)).toBeDefined();
      expect(within(changes()).getByRole('heading', { level: 2 }).textContent).toBe(
        'No changes since Tuesday, Nov 3 at 09:41.',
      );
      expect(screen.queryByRole('button', { name: GIVE })).toBeNull();
    },
  );

  it('says a copy with changes opens with its changes page when downloaded', SLOW, async () => {
    await kitchen('changes_copies');
    const downloads = within(block()).getAllByRole('button', { name: KW.copyDownload });
    fireEvent.click(downloads[0]!);

    expect(await screen.findByText(new RegExp(KW.changesPage, 'u'))).toBeDefined();
  });
});

describe('Give the changes to the kitchen on the Overview and All dates', () => {
  it('is Next up with Open the kitchen sheet, and Overdue once the date passes', SLOW, async () => {
    open('/demo/events/evt-wed-4?state=changes_due');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }, WAIT);
    expect(screen.getByText('Next up: Give the changes to the kitchen')).toBeDefined();

    open('/demo/events/evt-wed-4/dates?state=changes_overdue');
    await screen.findByRole('heading', { level: 1, name: KW.allDates }, WAIT);
    const list = screen.getByRole('heading', { level: 1, name: KW.allDates }).parentElement!;
    const rows = within(list.querySelector('ol')!).getAllByRole('listitem');
    const row = rows.find((one) => one.textContent?.includes('Give the changes to the kitchen'));
    expect(within(row!).getByText(KW.overdue)).toBeDefined();
    expect(within(row!).getByRole('link', { name: KW.openSheet })).toBeDefined();
  });

  it('is due at the start, never Overdue, once it came back after the date', SLOW, async () => {
    open('/demo/events/evt-wed-4/dates?state=changes_late');
    await screen.findByRole('heading', { level: 1, name: KW.allDates }, WAIT);

    const row = screen
      .getAllByRole('listitem')
      .find((one) => one.textContent?.includes('Give the changes to the kitchen'));
    expect(row?.textContent).toContain('You · Thu, Nov 5, 18:00');
    expect(within(row!).queryByText(KW.overdue)).toBeNull();
  });
});

describe('Each part of a course, and each table’s platters (sc-34244)', () => {
  function main(): HTMLElement {
    return screen.getByRole('region', { name: /^Main · 96/u });
  }

  it(
    'lists each dish’s parts under it, then Served with and Plated at the pass',
    SLOW,
    async () => {
      await kitchen('inParts');

      const block = main();
      expect(within(block).getByText(PW.inParts)).toBeDefined();
      expect(within(block).getByText('Plantain 24 · Salad 11 · Moi moi 6')).toBeDefined();
      expect(within(block).getByText('Rice · 43')).toBeDefined();
      expect(within(block).getByText('Fish · 33')).toBeDefined();
      expect(within(block).getByRole('list', { name: PW.servedWith }).textContent).toBe(
        'Drink · 96',
      );
      expect(within(block).getByText('Plated at the pass · 45')).toBeDefined();
      expect(within(block).queryByRole('table')).toBeNull();
    },
  );

  it('keeps the Starter and Dessert as sc-3911, with no way named', SLOW, async () => {
    await kitchen('inParts');

    const starter = screen.getByRole('region', { name: /^Starter · 96/u });
    expect(within(starter).queryByText(PW.servedWith)).toBeNull();
    expect(within(starter).queryByText(/Plated at the pass/u)).toBeNull();
  });

  it('gives By table as a real table, natural order, No table last', SLOW, async () => {
    await kitchen('familyStyle');

    const table = within(main()).getByRole('table', { name: PW.byTable });
    const heads = within(table)
      .getAllByRole('rowheader')
      .map((one) => one.textContent);
    expect(heads[0]).toBe('Table 1');
    expect(heads.at(-2)).toBe('Table 10');
    expect(heads.at(-1)).toBe(PW.noTable);
    expect(heads).not.toContain('Top table');
    expect(heads).not.toContain('Table 7');
  });

  it('shows no By table when everyone is plated at the pass', SLOW, async () => {
    await kitchen('allPlated');

    expect(within(main()).queryByRole('table')).toBeNull();
    expect(within(main()).getByText('Plated at the pass · 96')).toBeDefined();
  });

  it('drops the numbers for guests who skipped, and names nobody', SLOW, async () => {
    await kitchen('skipped');

    expect(within(main()).getByText('Rice · 41')).toBeDefined();
    expect(within(main()).getByRole('list', { name: PW.servedWith }).textContent).toBe(
      'Drink · 94',
    );
  });

  it('gives a menu of Plated and Buffet courses the sheet as sc-3911', SLOW, async () => {
    await kitchen('platedBuffet');

    expect(within(main()).queryByText(/Rice/u)).toBeNull();
    expect(within(main()).queryByText(PW.servedWith)).toBeNull();
    expect(within(main()).queryByText(/Plated at the pass/u)).toBeNull();
  });

  it('gives the same parts lines without guests.manage', SLOW, async () => {
    await kitchen('countsOnly');

    expect(screen.getByText(KW.namesNeed)).toBeDefined();
    expect(within(main()).getByRole('table', { name: PW.byTable })).toBeDefined();
  });

  it('prints on A4 with real headings and tables, the same lines in order', SLOW, async () => {
    open(`${AT}?state=print`);
    await screen.findByRole('heading', { level: 1, name: KW.title }, WAIT);

    expect(
      screen.getByRole('heading', { level: 2, name: /^Main · 96 · Family style/u }),
    ).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Main · By table' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: PW.servedWith })).toBeDefined();
    expect(screen.getByText('Plated at the pass · 51')).toBeDefined();
    expect(screen.getAllByText(PW.health)).toHaveLength(4);
    expect(screen.getByRole('article', { name: 'Page 3 of 4' })).toBeDefined();
  });
});
