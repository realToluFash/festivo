import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { addDays } from '@soirely/domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { CALENDAR_STATES, CAL_WORDS, FEED_WORDS, TODAY } from './calendar.ts';
import { PhaseTag } from './EventParts.tsx';
import { resetSample } from './events.ts';

const tested = config();
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
  showMenu: () => screen.getByRole('menuitemradio', { name: CAL_WORDS.showEvents, checked: true }),
  eventsOnly: () => screen.getByRole('button', { name: `Show: ${CAL_WORDS.showEvents}` }),
  busyDay: () => screen.getByRole('heading', { level: 2, name: 'Saturday, Nov 14' }),
  monthEdge: () => screen.getAllByRole('link', { name: /^Okafor family reunion, / }),
  otherZone: () => screen.getByRole('heading', { level: 2, name: 'October 2026' }),
  emptyMonth: () => screen.getByText(CAL_WORDS.emptyMonth('February 2027')),
  none: () => screen.getByText('Set up your first event'),
  loading: () => screen.getByRole('status', { name: '' }),
  failed: () => screen.getByRole('alert'),
  subscribe: () => screen.getByRole('dialog', { name: FEED_WORDS.open }),
  subscribeRefused: () => screen.getByText(FEED_WORDS.copyRefused),
  resetLink: () => screen.getByRole('dialog', { name: FEED_WORDS.confirmTitle }),
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

    expect(screen.getByText(CAL_WORDS.loading)).toBeDefined();
    expect(screen.getByRole('grid').getAttribute('aria-busy')).toBe('true');

    cleanup();
    await calendar('failed');

    expect(within(screen.getByRole('alert')).getByText(CAL_WORDS.failed)).toBeDefined();
    expect(screen.getByRole('button', { name: CAL_WORDS.retry })).toBeDefined();
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
      fireEvent.click(screen.getByRole('button', { name: CAL_WORDS.close }));
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
    expect(readFileSync(join(import.meta.dirname, 'calendar.css'), 'utf8')).not.toMatch(
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

    fireEvent.click(screen.getByRole('button', { name: `Show: ${CAL_WORDS.showAll}` }));

    const menu = screen.getByRole('menu');

    expect(document.activeElement).toBe(
      within(menu).getByRole('menuitemradio', { name: CAL_WORDS.showAll }),
    );

    fireEvent.click(within(menu).getByRole('menuitemradio', { name: CAL_WORDS.showEvents }));

    const show = screen.getByRole('button', { name: `Show: ${CAL_WORDS.showEvents}` });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(show);
    expect(
      screen.queryAllByRole('link', { name: /^Adaeze & Tunde’s wedding starts, / }),
    ).toHaveLength(0);
  });

  it('lists the days in Agenda', SLOW, async () => {
    await calendar('agenda');

    expect(screen.getByRole('heading', { level: 2, name: 'Today, Tuesday, Nov 3' })).toBeDefined();
    expect(screen.getAllByText(CAL_WORDS.emptyDay).length).toBeGreaterThan(0);

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
    [[CAL_WORDS.next], '2026-12-01'],
    [[CAL_WORDS.previous], '2026-10-01'],
    [[CAL_WORDS.previous, CAL_WORDS.next], TODAY],
  ])('enters Agenda after %j where Month enters, on %s', SLOW, async (names, first) => {
    await calendar('agenda');
    for (const name of names) fireEvent.click(screen.getByRole('button', { name }));

    const stop = entered();

    expect(rowDay(stop) >= first).toBe(true);
    expect(rowDay(rows()[rows().indexOf(stop) - 1]) < first).toBe(true);
  });

  it('puts Today in Agenda on today’s heading, then Tab on its first row', SLOW, async () => {
    await calendar('agenda');
    fireEvent.click(screen.getByRole('button', { name: CAL_WORDS.next }));
    fireEvent.click(screen.getByRole('button', { name: CAL_WORDS.today }));

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
    fireEvent.click(screen.getByRole('button', { name: CAL_WORDS.today }));
    fireEvent.click(screen.getByRole('radio', { name: 'View: Month' }));
    fireEvent.click(screen.getByRole('button', { name: CAL_WORDS.retry }));
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
    [[CAL_WORDS.next], '2026-12-01'],
    [[CAL_WORDS.previous], '2026-10-01'],
    [[CAL_WORDS.next, CAL_WORDS.today], TODAY],
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

    const subscribe = screen.getByRole('button', { name: FEED_WORDS.open });

    fireEvent.click(subscribe);

    const dialog = screen.getByRole('dialog', { name: FEED_WORDS.open });

    expect(within(dialog).getByRole('textbox', { name: FEED_WORDS.linkLabel })).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: FEED_WORDS.openInApp }));
    expect(within(dialog).getByText(FEED_WORDS.openedInApp)).toBeDefined();

    key('Escape');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(subscribe);
  });

  it('selects the link when the copy is refused', SLOW, async () => {
    await calendar('subscribeRefused');

    const dialog = screen.getByRole('dialog', { name: FEED_WORDS.open });
    const link = within(dialog).getByRole('textbox', { name: FEED_WORDS.linkLabel });

    expect(within(dialog).getByRole('alert').textContent).toBe(FEED_WORDS.copyRefused);
    expect(document.activeElement).toBe(link);

    fireEvent.click(within(dialog).getByRole('button', { name: FEED_WORDS.copy }));
    expect(await within(dialog).findByText(FEED_WORDS.copyRefused)).toBeDefined();
  });

  it('asks before it resets the link, and Keep this link changes nothing', SLOW, async () => {
    await calendar('resetLink');

    let dialog = screen.getByRole('dialog', { name: FEED_WORDS.confirmTitle });

    fireEvent.click(within(dialog).getByRole('button', { name: FEED_WORDS.keep }));
    dialog = screen.getByRole('dialog', { name: FEED_WORDS.open });
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: FEED_WORDS.resetOpen }),
    );

    fireEvent.click(within(dialog).getByRole('button', { name: FEED_WORDS.resetOpen }));
    fireEvent.click(screen.getByRole('button', { name: FEED_WORDS.reset }));
    expect(screen.getByText(FEED_WORDS.newLink)).toBeDefined();
    expect(
      (screen.getByRole('textbox', { name: FEED_WORDS.linkLabel }) as HTMLTextAreaElement).value,
    ).toMatch(/Xc7Rt2LwQ9mB4kZp1VyN8sHd3JfGe6TuA0oKi5bWnEq\.ics$/);
  });

  it('carries a milestone to its event’s All dates page', SLOW, async () => {
    open('/demo/events/evt-ireti-2/dates');

    expect(
      await screen.findByRole('heading', { level: 1, name: CAL_WORDS.allDates }, WAIT),
    ).toBeDefined();
    expect(screen.getByText('Ireti at 40 starts')).toBeDefined();
  });
});
