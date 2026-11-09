import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { addDays } from '@soirely/domain';
import i18next from 'i18next';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { PhaseTag } from '../components/EventParts.tsx';
import { routes } from '../routes/index.tsx';
import { CALENDAR_STATES, CAL_WORDS, OPENED_IN_APP, TODAY } from './calendar.ts';
import { resetSample } from './events.ts';

const tested = config();
const t = i18next.t.bind(i18next);
const W = {
  ...CAL_WORDS,
  previous: t('calendar.previous'),
  next: t('calendar.next'),
  today: t('calendar.today'),
  showAll: t('calendar.showAll'),
  showEvents: t('calendar.showEvents'),
  close: t('calendar.close'),
  loading: t('calendar.loading'),
  failed: t('calendar.failed'),
  retry: t('calendar.retry'),
  emptyDay: t('calendar.emptyDay'),
  emptyMonth: (month: string) => t('calendar.emptyMonth', { month }),
  allDates: t('timeline.allDates'),
  you: t('timeline.owner_you'),
};
const F = {
  open: t('calendarFeed.title'),
  copy: t('calendarFeed.copy'),
  copyRefused: t('calendarFeed.copyRefused'),
  linkLabel: t('calendarFeed.linkLabel'),
  confirmTitle: t('calendarFeed.confirmTitle'),
  keep: t('calendarFeed.keep'),
  newLink: t('calendarFeed.newLink'),
  openInApp: t('calendarFeed.openInApp'),
  openedInApp: OPENED_IN_APP,
  reset: t('calendarFeed.reset'),
  resetOpen: t('calendarFeed.resetOpen'),
};
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function calendar(state = 'populated') {
  const router = open(`/demo/calendar?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Calendar' }, WAIT);

  return router;
}

function day(date: string): HTMLElement {
  const button = document.querySelector<HTMLElement>(`[data-day="${date}"]`);

  if (button == null) throw new Error(`no day ${date}`);

  return button;
}

function focused(): string | undefined {
  return (document.activeElement as HTMLElement | null)?.dataset.day;
}

function key(name: string, options: { shiftKey?: boolean } = {}): void {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: name, ...options });
}

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.cal-agenda .cal-row')];
}

function rowDay(row: Element | null | undefined): string {
  return row?.closest<HTMLElement>('[data-entry]')?.dataset.entry ?? '';
}

function entered(): HTMLElement {
  const stops = rows().filter((row) => row.tabIndex === 0);

  expect(stops).toHaveLength(1);

  return stops[0] as HTMLElement;
}

const SEEN: Record<string, () => unknown> = {
  populated: () => screen.getByRole('grid'),
  agenda: () => screen.getByRole('radio', { name: 'View: Agenda', checked: true }),
  showMenu: () => screen.getByRole('menuitemradio', { name: W.showEvents, checked: true }),
  eventsOnly: () => screen.getByRole('button', { name: `Show: ${W.showEvents}` }),
  busyDay: () => screen.getByRole('heading', { level: 2, name: 'Saturday, Nov 14' }),
  monthEdge: () => screen.getAllByRole('link', { name: /^Okafor family reunion, / }),
  otherZone: () => screen.getByRole('heading', { level: 2, name: 'October 2026' }),
  emptyMonth: () => screen.getByText(W.emptyMonth('February 2027')),
  none: () => screen.getByText('Set up your first event'),
  loading: () => screen.getByRole('status', { name: '' }),
  failed: () => screen.getByRole('alert'),
  subscribe: () => screen.getByRole('dialog', { name: F.open }),
  subscribeRefused: () => screen.getByText(F.copyRefused),
  resetLink: () => screen.getByRole('dialog', { name: F.confirmTitle }),
  needsMenu: () =>
    screen.getByRole('menuitemradio', { name: W.showNeedsYou, checked: true }),
  needsMonth: () =>
    screen.getByRole('link', { name: /^Agree the toasts, / }).querySelector('.cal-late-mark'),
  needsDay: () =>
    within(screen.getByRole('complementary', { name: 'Tuesday, Nov 3' })).getAllByRole('link'),
  needsAgenda: () =>
    screen.getByRole('heading', { level: 2, name: 'Today, Tuesday, Nov 3' }) &&
    screen.getByText(W.emptyNeedsMonth('December 2026')),
  needsEmptyMonth: () => screen.getByText(W.emptyNeedsMonth('December 2026')),
  needsEmptyDay: () => screen.getByText(W.emptyNeedsDay),
  needsReadOnly: () =>
    screen.getByText(W.emptyNeedsMonth('November 2026')) &&
    screen.getByText(W.emptyNeedsDay),
  needsTodayEmpty: () =>
    screen.queryByRole('heading', { level: 2, name: 'Today, Tuesday, Nov 3' }) == null &&
    screen.getByRole('heading', { level: 2, name: 'Wednesday, Nov 4' }),
};

describe('the Calendar in B, weeks as lanes, at a desk (sc-30329)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    window.localStorage.clear();
    resetSample();
  });

  it('opens from the sidebar on the month holding today', SLOW, async () => {
    const router = open('/demo/today');
    const side = await screen.findByRole('navigation', { name: 'Soirely' }, WAIT);

    fireEvent.click(within(side).getByRole('link', { name: 'Calendar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' }, WAIT)).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/calendar');
    expect(screen.getByRole('heading', { level: 2, name: 'November 2026' })).toBeDefined();
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeDefined();
    expect(
      within(screen.getByRole('navigation', { name: 'Soirely' }))
        .getByRole('link', { name: 'Calendar' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('names a check for every ?state= the story lists', () => {
    expect(Object.keys(SEEN).sort()).toEqual([...CALENDAR_STATES].sort());
  });

  it.each(CALENDAR_STATES)('draws ?state=%s', SLOW, async (state) => {
    await calendar(state);
    expect(SEEN[state]?.()).toBeTruthy();
  });

  it('says it is loading, and a failed load offers Try again', SLOW, async () => {
    await calendar('loading');

    expect(screen.getByText(W.loading)).toBeDefined();
    expect(screen.getByRole('grid').getAttribute('aria-busy')).toBe('true');

    cleanup();
    await calendar('failed');

    expect(within(screen.getByRole('alert')).getByText(W.failed)).toBeDefined();
    expect(screen.getByRole('button', { name: W.retry })).toBeDefined();
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('moves a day with the arrows, a week up and down, and across a month edge', SLOW, async () => {
    await calendar();

    day('2026-11-03').focus();
    key('ArrowRight');
    expect(focused()).toBe('2026-11-04');
    key('ArrowDown');
    expect(focused()).toBe('2026-11-11');
    key('End');
    expect(focused()).toBe('2026-11-14');
    key('Home');
    expect(focused()).toBe('2026-11-08');
    key('PageDown');
    expect(focused()).toBe('2026-12-08');
    key('ArrowUp');
    key('ArrowUp');
    key('ArrowLeft');
    expect(focused()).toBe('2026-11-23');
    expect(day('2026-11-23').tabIndex).toBe(0);
    expect(day('2026-11-03').tabIndex).toBe(-1);
  });

  it(
    'opens a day on a click with its heading focused, and Escape gives the day back',
    SLOW,
    async () => {
      await calendar();

      fireEvent.click(day('2026-11-14'));

      const panel = screen.getByRole('complementary', { name: 'Saturday, Nov 14' });

      expect(document.activeElement).toBe(within(panel).getByRole('heading', { level: 2 }));
      expect(
        within(panel).getByRole('link', { name: /^Gala Fundación Lucía, Live, / }),
      ).toBeDefined();
      expect(
        within(panel)
          .getByRole('link', { name: /^Ireti at 40 ends, / })
          .getAttribute('href'),
      ).toBe('/demo/events/evt-ireti-2/dates');

      key('Escape');
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(focused()).toBe('2026-11-14');

      fireEvent.click(day('2026-11-14'));
      expect(screen.getByRole('complementary', { name: 'Saturday, Nov 14' })).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: W.close }));
      expect(focused()).toBe('2026-11-14');
    },
  );

  it('steps Tab from a day through its bars and marks, then out', SLOW, async () => {
    await calendar();

    day('2026-11-05').focus();
    key('Tab');
    expect((document.activeElement as HTMLElement).dataset.piece).toBe('event|evt-wed-4');
    expect(document.activeElement?.getAttribute('href')).toBe('/demo/events/evt-wed-4');
    key('Tab');
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(
      /^Adaeze & Tunde’s wedding starts, /,
    );
    key('Tab', { shiftKey: true });
    expect((document.activeElement as HTMLElement).dataset.piece).toBe('event|evt-wed-4');
    key('Tab', { shiftKey: true });
    expect(focused()).toBe('2026-11-05');
  });

  it('marks Live with the Events demo’s tag, and draws it no other way', SLOW, async () => {
    const events = render(<PhaseTag shown="live" />).container.firstElementChild?.className;

    cleanup();
    await calendar('busyDay');

    const panel = screen.getByRole('complementary', { name: 'Saturday, Nov 14' });
    const live = [...panel.querySelectorAll('.desk-tag')].filter(
      (tag) => tag.textContent === 'Live',
    );

    expect(events).toBe('desk-tag is-yes');
    expect(live).toHaveLength(2);
    expect(live.map((tag) => tag.className)).toEqual([events, events]);
    expect(readFileSync(join(import.meta.dirname, '../components/calendar.css'), 'utf8')).not.toMatch(
      /\.is-yes\b/u,
    );
  });

  it('opens each bar on its event page', SLOW, async () => {
    await calendar();

    const gala = screen.getByRole('link', { name: /^Gala Fundación Lucía, Live, / });

    expect(gala.getAttribute('href')).toBe('/demo/events/evt-gala-4');
    expect(gala.tabIndex).toBe(-1);
  });

  it('shows events only from the Show menu, and the menu gives focus back', SLOW, async () => {
    await calendar();

    expect(
      screen.getAllByRole('link', { name: /^Adaeze & Tunde’s wedding starts, / }),
    ).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: `Show: ${W.showAll}` }));

    const menu = screen.getByRole('menu');

    expect(document.activeElement).toBe(
      within(menu).getByRole('menuitemradio', { name: W.showAll }),
    );

    fireEvent.click(within(menu).getByRole('menuitemradio', { name: W.showEvents }));

    const show = screen.getByRole('button', { name: `Show: ${W.showEvents}` });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(show);
    expect(
      screen.queryAllByRole('link', { name: /^Adaeze & Tunde’s wedding starts, / }),
    ).toHaveLength(0);
  });

  it('lists the days in Agenda', SLOW, async () => {
    await calendar('agenda');

    expect(screen.getByRole('heading', { level: 2, name: 'Today, Tuesday, Nov 3' })).toBeDefined();
    expect(screen.getAllByText(W.emptyDay).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: 'View: Month' }));
    expect(screen.getByRole('grid')).toBeDefined();
  });

  it('enters Agenda by Tab at today’s first row, not the earliest (sc-31222)', SLOW, async () => {
    await calendar('agenda');

    const stop = entered();

    expect(rowDay(rows()[0])).toBe('2026-03-14');
    expect(rows()[0]?.tabIndex).toBe(-1);
    expect(rowDay(stop) >= TODAY).toBe(true);
    expect(rowDay(rows()[rows().indexOf(stop) - 1]) < TODAY).toBe(true);
  });

  it.each([
    [[W.next], '2026-12-01'],
    [[W.previous], '2026-10-01'],
    [[W.previous, W.next], TODAY],
  ])('enters Agenda after %j where Month enters, on %s', SLOW, async (names, first) => {
    await calendar('agenda');
    for (const name of names) fireEvent.click(screen.getByRole('button', { name }));

    const stop = entered();

    expect(rowDay(stop) >= first).toBe(true);
    expect(rowDay(rows()[rows().indexOf(stop) - 1]) < first).toBe(true);
  });

  it(
    'enters Agenda from past its last row at that row, the last before February',
    SLOW,
    async () => {
      await calendar('agenda');
      for (let step = 0; step < 3; step += 1) {
        fireEvent.click(screen.getByRole('button', { name: W.next }));
      }

      const stop = entered();

      expect(stop).toBe(rows().at(-1));
      expect(stop.textContent).toContain('Bisi & Kola’s engagement starts');
      expect(rowDay(stop) < '2027-02-01').toBe(true);
    },
  );

  it('puts Today in Agenda on today’s heading, then Tab on its first row', SLOW, async () => {
    await calendar('agenda');
    fireEvent.click(screen.getByRole('button', { name: W.next }));
    fireEvent.click(screen.getByRole('button', { name: W.today }));

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Today, Tuesday, Nov 3' }),
    );

    const stop = entered();

    expect(rowDay(stop) >= TODAY).toBe(true);
    key('Tab');
    expect(document.activeElement).toBe(stop);
  });

  it('keeps a Today press with no list from taking the focus later', SLOW, async () => {
    await calendar('failed');
    fireEvent.click(screen.getByRole('radio', { name: 'View: Agenda' }));
    fireEvent.click(screen.getByRole('button', { name: W.today }));
    fireEvent.click(screen.getByRole('radio', { name: 'View: Month' }));
    fireEvent.click(screen.getByRole('button', { name: W.retry }));
    fireEvent.click(screen.getByRole('radio', { name: 'View: Agenda' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Today, Tuesday, Nov 3' })).toBeDefined();
    expect(document.activeElement?.closest('.cal-agenda')).toBeNull();
  });

  it('steps Agenda’s rows by Tab and Shift+Tab, back to the earliest', SLOW, async () => {
    await calendar('agenda');

    const all = rows();
    const stop = entered();
    const at = all.indexOf(stop);

    stop.focus();
    key('Tab');
    expect(document.activeElement).toBe(all[at + 1]);
    key('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(stop);
    for (let back = at - 1; back >= 0; back -= 1) {
      key('Tab', { shiftKey: true });
      expect(document.activeElement).toBe(all[back]);
    }
    expect(rowDay(document.activeElement)).toBe('2026-03-14');
  });

  it.each([
    [[W.next], '2026-12-01'],
    [[W.previous], '2026-10-01'],
    [[W.next, W.today], TODAY],
  ])('enters Month after %j on %s, and its keys work from there', SLOW, async (names, at) => {
    await calendar();
    for (const name of names) fireEvent.click(screen.getByRole('button', { name }));

    expect(day(at).tabIndex).toBe(0);
    expect(document.querySelectorAll('.cal-day[tabindex="0"]')).toHaveLength(1);

    day(at).focus();
    key('ArrowRight');
    expect(focused()).toBe(addDays(at, 1));
    fireEvent.click(day(addDays(at, 1)));
    expect(document.activeElement?.closest('.cal-panel')).not.toBeNull();
    key('Escape');
    expect(focused()).toBe(addDays(at, 1));
  });

  it('leaves Month’s way in as it was after a visit to Agenda', SLOW, async () => {
    await calendar('agenda');
    fireEvent.click(screen.getByRole('radio', { name: 'View: Month' }));

    expect(day(TODAY).tabIndex).toBe(0);
    day(TODAY).focus();
    key('ArrowRight');
    expect(focused()).toBe('2026-11-04');
  });

  it('opens Subscribe as a dialog and gives focus back on Escape', SLOW, async () => {
    await calendar();

    const subscribe = screen.getByRole('button', { name: F.open });

    fireEvent.click(subscribe);

    const dialog = screen.getByRole('dialog', { name: F.open });

    expect(within(dialog).getByRole('textbox', { name: F.linkLabel })).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: F.openInApp }));
    expect(within(dialog).getByText(F.openedInApp)).toBeDefined();

    key('Escape');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(subscribe);
  });

  it('selects the link when the copy is refused', SLOW, async () => {
    await calendar('subscribeRefused');

    const dialog = screen.getByRole('dialog', { name: F.open });
    const link = within(dialog).getByRole('textbox', { name: F.linkLabel });

    expect(within(dialog).getByRole('alert').textContent).toBe(F.copyRefused);
    expect(document.activeElement).toBe(link);

    fireEvent.click(within(dialog).getByRole('button', { name: F.copy }));
    expect(await within(dialog).findByText(F.copyRefused)).toBeDefined();
  });

  it('asks before it resets the link, and Keep this link changes nothing', SLOW, async () => {
    await calendar('resetLink');

    let dialog = screen.getByRole('dialog', { name: F.confirmTitle });

    fireEvent.click(within(dialog).getByRole('button', { name: F.keep }));
    dialog = screen.getByRole('dialog', { name: F.open });
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: F.resetOpen }),
    );

    fireEvent.click(within(dialog).getByRole('button', { name: F.resetOpen }));
    fireEvent.click(screen.getByRole('button', { name: F.reset }));
    expect(await screen.findByText(F.newLink)).toBeDefined();
    expect(
      (screen.getByRole('textbox', { name: F.linkLabel }) as HTMLTextAreaElement).value,
    ).toMatch(/Xc7Rt2LwQ9mB4kZp1VyN8sHd3JfGe6TuA0oKi5bWnEq\.ics$/);
  });

  it('carries a milestone to its event’s All dates page', SLOW, async () => {
    open('/demo/events/evt-ireti-2/dates');

    expect(
      await screen.findByRole('heading', { level: 1, name: W.allDates }, WAIT),
    ).toBeDefined();
    expect(screen.getByText('Ireti at 40 starts')).toBeDefined();
  });

  it(
    'offers Only what needs you last on the Show menu, and reads it on the pill',
    SLOW,
    async () => {
      await calendar();
      fireEvent.click(screen.getByRole('button', { name: `Show: ${W.showAll}` }));

      const choices = within(screen.getByRole('menu')).getAllByRole('menuitemradio');

      expect(choices.map((one) => one.textContent)).toEqual([
        W.showAll,
        W.showEvents,
        W.showNeedsYou,
      ]);
      fireEvent.click(choices[2] as HTMLElement);

      const show = screen.getByRole('button', { name: `Show: ${W.showNeedsYou}` });

      expect(show.textContent).toBe(W.showNeedsYou);
      expect(show.className).toContain('is-on');
      expect(document.activeElement).toBe(show);
      expect(screen.getByText(W.emptyNeedsMonth('November 2026'))).toBeDefined();
    },
  );

  it('leaves the month cell without the event’s name, and names it in the day', SLOW, async () => {
    await calendar('needsDay');

    const day = screen.getByRole('complementary', { name: 'Tuesday, Nov 3' });
    const rows = within(day).getAllByRole('link');
    const cake = document.querySelector<HTMLElement>(
      '.cal-grid [data-piece^="mark|evt-wed-4|2026-11-03T09:00"]',
    );

    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Confirm the cake, Adaeze & Tunde’s wedding, .+, overdue$/),
      expect.stringMatching(/^Pay the band’s balance, Adaeze & Tunde’s wedding, [^,]+$/),
    ]);
    expect(rows[0]?.textContent).toContain('Adaeze & Tunde’s wedding');
    expect(rows[0]?.textContent).toContain(W.overdue);
    expect(rows[0]?.textContent).toContain(W.you);
    expect(rows[1]?.textContent).not.toContain(W.overdue);
    expect(cake?.textContent).toContain('Confirm the cake');
    expect(cake?.textContent).not.toContain('wedding');
    expect(cake?.getAttribute('aria-label')).not.toMatch(/wedding|overdue/);
    expect(cake?.querySelector('.cal-late')).not.toBeNull();
  });

  it(
    'marks nothing overdue under Events and milestones, and lists no You row under Events only',
    SLOW,
    async () => {
      await calendar('needsMonth');

      expect(document.querySelectorAll('.cal-grid .cal-late')).not.toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: `Show: ${W.showNeedsYou}` }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: W.showAll }));

      const toasts = screen.getByRole('link', { name: /^Agree the toasts, / });

      expect(toasts.getAttribute('aria-label')).not.toMatch(/overdue/);
      expect(toasts.querySelector('.cal-you')).not.toBeNull();
      expect(document.querySelectorAll('.cal-grid .cal-late')).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: `Show: ${W.showAll}` }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: W.showEvents }));

      expect(screen.queryByRole('link', { name: /^Agree the toasts, / })).toBeNull();
    },
  );

  it('says neither empty line while loading or failed', SLOW, async () => {
    await calendar('failed');
    fireEvent.click(screen.getByRole('button', { name: `Show: ${W.showAll}` }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: W.showNeedsYou }));

    const quiet = W.emptyNeedsMonth('November 2026');

    expect(screen.queryByText(quiet)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: W.retry }));
    expect(screen.getByText(W.loading)).toBeDefined();
    expect(screen.queryByText(quiet)).toBeNull();
    expect(await screen.findByText(quiet, {}, WAIT)).toBeDefined();
  });

  it(
    'puts Today in Agenda on the next day that needs you when today holds none',
    SLOW,
    async () => {
      await calendar('needsTodayEmpty');
      fireEvent.click(screen.getByRole('button', { name: W.next }));
      fireEvent.click(screen.getByRole('button', { name: W.today }));

      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Wednesday, Nov 4' }),
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Monday, Nov 2' })).toBeDefined();
    },
  );

  it('puts Today in Agenda on the empty line when the month needs nothing', SLOW, async () => {
    await calendar('needsReadOnly');
    fireEvent.click(screen.getByRole('radio', { name: 'View: Agenda' }));
    fireEvent.click(screen.getByRole('button', { name: W.today }));

    const quiet = W.emptyNeedsMonth('November 2026');

    expect(document.activeElement?.textContent).toBe(quiet);
  });

  it('starts on Events and milestones again after a reload', SLOW, async () => {
    await calendar('needsMonth');
    expect(screen.getByRole('button', { name: `Show: ${W.showNeedsYou}` })).toBeDefined();

    cleanup();
    open('/demo/calendar');
    await screen.findByRole('heading', { level: 1, name: 'Calendar' }, WAIT);

    expect(screen.getByRole('button', { name: `Show: ${W.showAll}` })).toBeDefined();
  });

  it('carries a row to its action, else its event’s All dates', SLOW, async () => {
    await calendar('needsAgenda');

    const kitchen = screen.getAllByRole('link', {
      name: /^Give final numbers to the kitchen, Adaeze & Tunde’s wedding, /,
    });
    const cake = screen.getByRole('link', { name: /^Confirm the cake, / });

    expect(kitchen[0]?.getAttribute('href')).toBe('/demo/events/evt-wed-4/kitchen');
    expect(cake.getAttribute('href')).toBe('/demo/events/evt-wed-4/dates');
    expect(screen.queryByRole('button', { name: /kitchen sheet/ })).toBeNull();
  });
});
