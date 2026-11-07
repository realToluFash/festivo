import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { CALENDAR_STATES, CAL_WORDS, FEED_WORDS } from './calendar.ts';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 8000 };

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function calendar(state = 'populated') {
  const router = open(`/demo/calendar?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Calendar' }, SLOW);

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

describe('the Calendar in B, weeks as lanes, at a desk (sc-30329)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    window.localStorage.clear();
    resetSample();
  });

  it('opens from the sidebar on the month holding today', SLOW, async () => {
    const router = open('/demo/today');
    const side = await screen.findByRole('navigation', { name: 'Soirely' }, SLOW);

    fireEvent.click(within(side).getByRole('link', { name: 'Calendar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' }, SLOW)).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/calendar');
    expect(screen.getByRole('heading', { level: 2, name: 'November 2026' })).toBeDefined();
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeDefined();
    expect(
      within(screen.getByRole('navigation', { name: 'Soirely' }))
        .getByRole('link', { name: 'Calendar' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('draws every ?state= the story lists', SLOW, async () => {
    const seen: Record<string, () => unknown> = {
      populated: () => screen.getByRole('grid'),
      agenda: () => screen.getByRole('radio', { name: 'View: Agenda', checked: true }),
      showMenu: () =>
        screen.getByRole('menuitemradio', { name: CAL_WORDS.showEvents, checked: true }),
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

    expect(Object.keys(seen).sort()).toEqual([...CALENDAR_STATES].sort());

    for (const state of CALENDAR_STATES) {
      await calendar(state);
      expect(seen[state]?.(), state).toBeTruthy();
      cleanup();
      resetSample();
    }
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
      await screen.findByRole('heading', { level: 1, name: CAL_WORDS.allDates }, SLOW),
    ).toBeDefined();
    expect(screen.getByText(CAL_WORDS.allDatesComing)).toBeDefined();
  });
});
