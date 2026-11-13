import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { peopleOn } from './guests.ts';
import { KW, kitchenAt, resetKitchen } from './kitchen.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const WEDDING = 'Adaeze & Tunde’s wedding';
const EVENTS_CSS = [
  'events.css',
  '../components/eventsDesk.css',
  '../components/EventsList.css',
  '../components/eventPage.css',
]
  .map((file) => readFileSync(join(import.meta.dirname, file), 'utf8'))
  .join('\n');

function cssValue(selector: string, property: string): string | undefined {
  const start = EVENTS_CSS.indexOf(`\n${selector} {`);
  const body = start < 0 ? '' : EVENTS_CSS.slice(start, EVENTS_CSS.indexOf('}', start));

  return new RegExp(`\\s${property}: ([^;]+);`, 'u').exec(body)?.[1];
}

function main(): HTMLElement {
  return screen.getByRole('main');
}

function side(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Soirely' });
}

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function list(path = '/demo/events?state=') {
  const router = open(path);
  await screen.findByRole('heading', { level: 1, name: 'Events' });

  return router;
}

async function page(path: string, name = WEDDING) {
  const router = open(path);
  await screen.findByRole('heading', { level: 1, name });

  return router;
}

describe('Events in A at a desk (sc-30304)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  it(
    'opens from the Today sidebar with the soonest event as the card and the rest as rows',
    SLOW,
    async () => {
      const router = open('/demo/today');
      const side = await screen.findByRole('navigation', { name: 'Soirely' }, WAIT);

      fireEvent.click(within(side).getByRole('link', { name: 'Events' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Events' })).toBeDefined();
      expect(router.state.location.pathname).toBe('/demo/events');
      expect(screen.getByRole('heading', { level: 2, name: WEDDING })).toBeDefined();
      expect(within(main()).getByRole('link', { name: /^Ireti at 40/ })).toBeDefined();
      expect(screen.getByText('4 events · Sorted by date')).toBeDefined();
    },
  );

  it('keeps the card’s link over all of the card but its own step', () => {
    const link = Number(cssValue('.ev-card-link::after', 'z-index'));
    const step = Number(cssValue('.ev-card-foot :is(a, button)', 'z-index'));

    expect(link).toBeGreaterThan(0);
    expect(step).toBeGreaterThan(link);
    expect(cssValue('.ev-card-foot', 'z-index')).toBeUndefined();
  });

  it('leaves a time field room for 06:00 PM beside its clock', () => {
    expect(
      parseInt(cssValue('.ev-when-pair .ev-input.is-time', 'width') ?? '0', 10),
    ).toBeGreaterThanOrEqual(160);
  });

  it('keeps the search in the address, so Back brings it back', SLOW, async () => {
    const router = await list();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search events' }), {
      target: { value: 'lucia' },
    });

    await waitFor(() => expect(router.state.location.search).toBe('?q=lucia'));
    expect(await screen.findByText('3 events')).toBeDefined();
    expect(screen.getByRole('link', { name: /Lucía’s quinceañera/ })).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: /Gala Fundación Lucía/ }));
    await screen.findByRole('heading', { level: 1, name: 'Gala Fundación Lucía' });
    await act(() => router.navigate(-1));

    expect(router.state.location.search).toBe('?q=lucia');
    expect(
      (screen.getByRole('searchbox', { name: 'Search events' }) as HTMLInputElement).value,
    ).toBe('lucia');
  });

  it('filters by type from the address and says when nothing matches', SLOW, async () => {
    await list('/demo/events?q=garden+party&type=wedding');

    expect(screen.getByRole('heading', { name: 'No events match' })).toBeDefined();
    expect(
      screen.getByText('You searched for “garden party” and filtered by Wedding.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /Wedding/ })).toBeDefined();
  });

  it('draws each phase’s one step on the card', SLOW, async () => {
    await page('/demo/events/evt-draft-4?state=draft', 'Bisi & Kola’s engagement');
    expect(screen.getByRole('button', { name: /Make live/ })).toBeDefined();
  });

  it('locks the dates once an event is called off, and offers Duplicate', SLOW, async () => {
    await page('/demo/events/evt-off?state=calledOff', 'Team offsite');

    expect(screen.getByText(/Called off on Fri, Oct 30, 2026, before it started/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Thu, Nov 12, 2026/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Duplicate/ }).length).toBeGreaterThan(0);
  });

  it('edits the name in place and asks before Cancel drops a change', SLOW, async () => {
    await page('/demo/events/evt-wed-4?state=name');
    const part = screen.getByRole('group', { name: 'Event name' });

    fireEvent.change(within(part).getByRole('textbox'), {
      target: { value: 'Adaeze & Tunde’s big day' },
    });
    fireEvent.click(within(part).getByRole('button', { name: 'Cancel' }));

    const ask = await screen.findByRole('alertdialog', { name: 'Discard your change?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    fireEvent.click(within(part).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s big day' }),
    ).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Event name' })).toBeNull();
  });

  it('asks before a sidebar area drops a change, and goes there on Discard', SLOW, async () => {
    const router = await page('/demo/events/evt-wed-4?state=name');
    const part = screen.getByRole('group', { name: 'Event name' });
    const areas = screen.getByRole('navigation', { name: WEDDING });

    fireEvent.change(within(part).getByRole('textbox'), { target: { value: 'Our big day' } });
    fireEvent.click(within(areas).getByRole('link', { name: 'Schedule' }));

    const ask = await screen.findByRole('alertdialog', { name: 'Discard your change?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));

    expect(router.state.location.search).toBe('?state=name');
    expect((within(part).getByRole('textbox') as HTMLInputElement).value).toBe('Our big day');

    fireEvent.click(within(areas).getByRole('link', { name: 'Schedule' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Discard your change?' })).getByRole(
        'button',
        { name: 'Discard' },
      ),
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Schedule' })).toBeDefined();
    expect(router.state.location.search).toBe('?area=schedule');
  });

  it('asks before Back drops a change, and the browser asks on reload', SLOW, async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/demo/events', '/demo/events/evt-wed-4?state=name'],
      initialIndex: 1,
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: WEDDING });
    const part = screen.getByRole('group', { name: 'Event name' });
    const reload = (): boolean =>
      !window.dispatchEvent(new Event('beforeunload', { cancelable: true }));

    expect(reload()).toBe(false);
    fireEvent.change(within(part).getByRole('textbox'), { target: { value: 'Our big day' } });
    expect(reload()).toBe(true);

    await act(() => router.navigate(-1));
    fireEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Discard your change?' })).getByRole(
        'button',
        { name: 'Discard' },
      ),
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Events' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/events');
    expect(reload()).toBe(false);

    await act(() => router.navigate(1));
    await screen.findByRole('heading', { level: 1, name: WEDDING });
    const again = screen.getByRole('group', { name: 'Event name' });

    fireEvent.change(within(again).getByRole('textbox'), { target: { value: 'Our big day' } });
    fireEvent.click(within(again).getByRole('button', { name: 'Save' }));
    expect(reload()).toBe(false);
    await act(() => router.navigate(-1));

    expect(await screen.findByRole('heading', { level: 1, name: 'Events' })).toBeDefined();
    expect(screen.queryByRole('alertdialog', { name: 'Discard your change?' })).toBeNull();
  });

  it('leaves without a second ask once Duplicate is confirmed', SLOW, async () => {
    const router = await page('/demo/events/evt-wed-4?state=name');
    const part = screen.getByRole('group', { name: 'Event name' });
    const manage = screen.getByRole('region', { name: 'Manage' });

    fireEvent.change(within(part).getByRole('textbox'), { target: { value: 'Our big day' } });
    fireEvent.click(within(manage).getByRole('button', { name: 'Duplicate' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Duplicate' })).getByRole('button', {
        name: 'Create draft',
      }),
    );

    expect(await screen.findByText('Draft created. Opening it.', {}, WAIT)).toBeDefined();
    expect(router.state.location.pathname).not.toBe('/demo/events/evt-wed-4');
    expect(screen.queryByRole('alertdialog', { name: 'Discard your change?' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: WEDDING })).toBeDefined();
  });

  it(
    'refuses a copy with no start on the field, and keeps Create draft pressable',
    SLOW,
    async () => {
      const router = await page('/demo/events/evt-wed-4?state=duplicateNoStart');
      const dialog = await screen.findByRole('dialog', { name: 'Duplicate' });
      const create = within(dialog).getByRole('button', { name: 'Create draft' });

      expect(create.getAttribute('aria-disabled')).not.toBe('true');
      expect(within(dialog).getByRole('alert').textContent).toContain(
        'Choose when the copy starts.',
      );

      const date = within(dialog).getByLabelText('Starts, Date');

      fireEvent.change(date, { target: { value: '2027-05-15' } });
      fireEvent.click(create);

      expect(within(dialog).getByRole('alert').textContent).toContain(
        'Choose the time the copy starts.',
      );
      expect(document.activeElement).toBe(within(dialog).getByLabelText('Starts, Time'));
      expect(router.state.location.pathname).toBe('/demo/events/evt-wed-4');

      fireEvent.change(within(dialog).getByLabelText('Starts, Time'), {
        target: { value: '16:00' },
      });

      expect(within(dialog).queryByRole('alert')).toBeNull();
    },
  );

  it('leaves without a second ask once Delete is confirmed by name', SLOW, async () => {
    const router = await page('/demo/events/evt-wed-4?state=name');
    const part = screen.getByRole('group', { name: 'Event name' });
    const manage = screen.getByRole('region', { name: 'Manage' });

    fireEvent.change(within(part).getByRole('textbox'), { target: { value: 'Our big day' } });
    fireEvent.click(within(manage).getByRole('button', { name: 'Delete event…' }));

    const ask = await screen.findByRole('alertdialog', { name: `Delete ${WEDDING}?` });

    fireEvent.change(within(ask).getByRole('textbox'), { target: { value: WEDDING } });
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(`${WEDDING} was deleted.`)).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/events');
    expect(screen.queryByRole('alertdialog', { name: 'Discard your change?' })).toBeNull();
  });

  it(
    'deletes a live event only once its name is typed, then says so on the list',
    SLOW,
    async () => {
      const router = await page('/demo/events/evt-wed-4?state=delete');
      const ask = screen.getByRole('alertdialog', { name: `Delete ${WEDDING}?` });
      const field = within(ask).getByRole('textbox');

      fireEvent.change(field, { target: { value: 'Adaeze and Tunde' } });
      fireEvent.click(within(ask).getByRole('button', { name: 'Delete' }));
      expect(within(ask).getByRole('alert').textContent).toBe(
        `Type ${WEDDING} exactly as shown to delete it.`,
      );

      fireEvent.change(field, { target: { value: "Adaeze & Tunde's wedding" } });
      fireEvent.click(within(ask).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText(`${WEDDING} was deleted.`)).toBeDefined();
      expect(router.state.location.pathname).toBe('/demo/events');
      expect(within(main()).queryByRole('link', { name: new RegExp(WEDDING) })).toBeNull();
      expect(within(side()).queryByRole('link', { name: WEDDING })).toBeNull();
    },
  );

  it(
    'counts the guest list among what Delete removes, as the Guests header does',
    SLOW,
    async () => {
      await page('/demo/events/evt-wed-4?state=delete');
      const ask = screen.getByRole('alertdialog', { name: `Delete ${WEDDING}?` });
      const people = peopleOn('evt-wed-4');

      expect(people).toBeGreaterThan(1);
      expect(
        within(ask)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([
        'the event, its details and its schedule',
        `its guest list, with the ${people} people on it`,
      ]);
    },
  );

  it(
    'asks for the name of a Draft with people on its list, and not of one without',
    SLOW,
    async () => {
      const draft = 'Bisi & Kola’s engagement';
      await page('/demo/events/evt-draft-4?state=deleteDraftGuests', draft);
      const ask = screen.getByRole('alertdialog', { name: `Delete ${draft}?` });

      expect(
        within(ask).getByRole('textbox', { name: `Type ${draft} to delete it` }),
      ).toBeDefined();
      expect(within(ask).getByText('its guest list, with the 12 people on it')).toBeDefined();
      cleanup();

      const empty = 'Cena benéfica Fundación Lucía';
      await page('/demo/events/evt-cena-4?state=deleteDraft', empty);
      const plain = screen.getByRole('alertdialog', { name: `Delete ${empty}?` });

      expect(within(plain).queryByRole('textbox')).toBeNull();
      expect(
        within(plain).getByText(
          'It’s a draft with nobody on its guest list. It will be removed for your whole team.',
        ),
      ).toBeDefined();
    },
  );

  it('shows an area that is coming, and opens People from the event’s sidebar', SLOW, async () => {
    await page('/demo/events/evt-wed-4?area=menu', 'Menu');

    expect(screen.getByText('The menu for this event is coming.')).toBeDefined();
    expect(
      within(screen.getByRole('navigation', { name: WEDDING }))
        .getByRole('link', { name: 'People' })
        .getAttribute('href'),
    ).toBe('/demo/people');
  });

  it('says Off or On beside Just for you’s switch', SLOW, async () => {
    open('/demo/events/evt-wed-4');
    const mute = await screen.findByRole('switch', { name: 'Mute this event' }, WAIT);

    expect(mute.getAttribute('aria-checked')).toBe('false');
    expect(mute.textContent).toBe('Off');

    fireEvent.click(mute);

    expect(mute.getAttribute('aria-checked')).toBe('true');
    expect(mute.textContent).toBe('On');
  });
});

describe('Guests can write from their page, on the Overview (sc-3978)', () => {
  const NAME = 'Guests can write from their page';

  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  async function guestsSwitch(state?: string): Promise<HTMLElement> {
    open(state == null ? '/demo/events/evt-wed-4' : `/demo/events/evt-wed-4?state=${state}`);

    return screen.findByRole('switch', { name: NAME }, WAIT);
  }

  it(
    'sits under the dashed preview, on, and saves Off at once after a busy moment',
    SLOW,
    async () => {
      const write = await guestsSwitch();
      const block = write.closest('section') as HTMLElement;

      expect(within(block).getByRole('heading', { name: 'Guests’ page' })).toBeDefined();
      expect(write.closest('.ev-dashed')).toBeNull();
      expect(block.querySelector('.ev-dashed')).not.toBeNull();
      expect(
        within(block).getAllByText(
          'Changes it for everyone on this event. Texts and emails still arrive.',
        ),
      ).toHaveLength(2);
      expect(write.getAttribute('aria-checked')).toBe('true');
      expect(write.textContent).toBe('On');

      fireEvent.click(write);
      expect(write.getAttribute('aria-checked')).toBe('false');
      expect(write.getAttribute('aria-busy')).toBe('true');
      fireEvent.click(write);
      expect(write.getAttribute('aria-checked')).toBe('false');

      await waitFor(() => expect(write.getAttribute('aria-busy')).toBe('false'), WAIT);
      expect(write.textContent).toBe('Off');
    },
  );

  it('opens Off, Saving busy, and Not saved back On', SLOW, async () => {
    const off = await guestsSwitch('guestsCanWriteOff');

    expect(off.getAttribute('aria-checked')).toBe('false');
    expect(off.textContent).toBe('Off');
    cleanup();

    const saving = await guestsSwitch('guestsCanWriteSaving');

    expect(saving.getAttribute('aria-checked')).toBe('false');
    expect(saving.getAttribute('aria-busy')).toBe('true');
    cleanup();

    const failed = await guestsSwitch('guestsCanWriteFailed');
    const block = failed.closest('section') as HTMLElement;

    expect(failed.getAttribute('aria-checked')).toBe('true');
    expect(within(block).getByRole('alert').textContent).toBe('Not saved. Try again.');
    fireEvent.click(failed);
    expect(within(block).queryByRole('alert')).toBeNull();
    await waitFor(() => expect(failed.getAttribute('aria-busy')).toBe('false'), WAIT);
    expect(failed.getAttribute('aria-checked')).toBe('false');
  });

  it('cannot be changed without messages.manage, and says why', SLOW, async () => {
    const fixed = await guestsSwitch('guestsCanWriteReadOnly');

    expect(fixed.getAttribute('aria-disabled')).toBe('true');
    expect(fixed.textContent).toBe('On');
    fireEvent.click(fixed);
    expect(fixed.getAttribute('aria-checked')).toBe('true');
    expect(fixed.getAttribute('aria-busy')).toBeNull();
    const why = screen.getByText('Only members who manage messages can change this.');

    expect(fixed.getAttribute('aria-describedby')?.split(' ')).toContain(why.id);
  });
});

describe('the guest counts on Events (sc-23284)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  it('shows the invited and the replies across the upcoming events', SLOW, async () => {
    await list();
    const tiles = within(main()).getByRole('list', { name: 'Guests across your events' });

    expect(within(tiles).getByText('367')).toBeDefined();
    expect(within(tiles).getByText('211 coming')).toBeDefined();
    expect(within(tiles).getByText('266')).toBeDefined();
    expect(within(tiles).getByText('101 haven’t replied')).toBeDefined();
  });

  it('shows 0 when nobody is invited yet', SLOW, async () => {
    await list('/demo/events?state=noGuests');
    const tiles = within(main()).getByRole('list', { name: 'Guests across your events' });

    expect(within(tiles).getAllByText('0')).toHaveLength(2);
    expect(within(tiles).getByText('0 coming')).toBeDefined();
    expect(within(tiles).getByText('0 haven’t replied')).toBeDefined();
  });

  it('draws the list loading as shapes, with search and Filter off', SLOW, async () => {
    await list('/demo/events?state=loading');

    const status = within(main()).getByRole('status');
    expect(status.textContent).toBe('Loading events…');
    expect(status.querySelector('.desk-unseen')?.textContent).toBe('Loading events…');
    expect(status.querySelectorAll('.desk-row.is-bones')).toHaveLength(3);
    expect(
      within(main())
        .getByRole('searchbox', { name: 'Search events' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(within(main()).queryByRole('tablist')).toBeNull();
    expect(within(main()).queryByText('Search needs a connection.')).toBeNull();
    expect(within(main()).getByRole('button', { name: 'New event' })).toBeDefined();
  });

  it('asks a role without Create events to ask an owner', SLOW, async () => {
    await list('/demo/events?state=firstAsk');

    expect(within(main()).getByText(/Ask an owner if you need to create one/)).toBeDefined();
    expect(within(main()).queryByRole('button', { name: 'Create an event' })).toBeNull();
    expect(within(main()).queryByRole('button', { name: 'New event' })).toBeNull();
    expect(within(side()).getByRole('button', { name: 'Ana Souza, Member' })).toBeDefined();
  });

  it('empties the sidebar’s upcoming events with the Upcoming tab', SLOW, async () => {
    await list('/demo/events?state=emptyUpcoming');

    for (const name of [WEDDING, 'Ireti at 40', 'Ire Events end-of-year party']) {
      expect(within(side()).queryByRole('link', { name })).toBeNull();
    }
    expect(within(side()).getByRole('link', { name: 'Bisi & Kola’s engagement' })).toBeDefined();
  });

  it.each([
    ['emptyUpcoming', 'Nothing coming up'],
    ['emptyDrafts', 'No drafts'],
    ['emptyPast', 'Nothing finished yet'],
  ])('draws %s with its title and line, and no footer', SLOW, async (state, title) => {
    await list(`/demo/events?state=${state}`);

    expect(within(main()).getByRole('heading', { level: 2, name: title })).toBeDefined();
    expect(within(main()).queryByText(/Sorted by date/)).toBeNull();
    expect(within(main()).getByRole('button', { name: 'New event' })).toBeDefined();
  });

  it('has no counts on a first run', SLOW, async () => {
    await list('/demo/events?state=first');

    expect(within(main()).queryByRole('list', { name: 'Guests across your events' })).toBeNull();
  });
});

describe('Needs you on the Overview at a desk (sc-32801)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetKitchen();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function card(): HTMLElement {
    return screen.getByRole('region', { name: /^Needs you/ });
  }

  it(
    'lists the rows, overdue first, with the button only where there is an action',
    SLOW,
    async () => {
      await page('/demo/events/evt-wed-4?state=needsYou');

      const rows = within(card()).getAllByRole('listitem');

      expect(
        screen.getByRole('heading', { level: 2, name: /^Needs you\s*, 4 things$/ }),
      ).toBeDefined();
      expect(rows.map((row) => row.textContent)).toEqual([
        'Give final numbers to the kitchen2 days overdueOpen the kitchen sheet',
        'Pay the band’s balanceDue today',
        'Seat the last 12 guestsDue tomorrow',
        'Confirm the cakeDue Thu, Nov 5',
      ]);
      expect(within(card()).queryByRole('button')).toBeNull();
      expect(
        within(card())
          .getAllByRole('link')
          .map((link) => [link.textContent, link.getAttribute('href')]),
      ).toEqual([[KW.openSheet, kitchenAt('evt-wed-4')]]);
      expect(within(card()).queryByText(WEDDING)).toBeNull();
    },
  );

  it(
    'lists the kitchen milestone while it is Next up, and opens Kitchen sheet for this event',
    SLOW,
    async () => {
      const router = await page('/demo/events/evt-wed-4?state=finalNumbers');

      expect(screen.getByText('Next up: Give final numbers to the kitchen')).toBeDefined();
      expect(
        within(card())
          .getAllByRole('listitem')
          .map((row) => row.textContent),
      ).toEqual([`Give final numbers to the kitchenDue today${KW.openSheet}`]);

      fireEvent.click(within(card()).getByRole('link', { name: KW.openSheet }));
      expect(router.state.location.pathname).toBe(kitchenAt('evt-wed-4'));
    },
  );

  it('lists the same rows as All dates', SLOW, async () => {
    open('/demo/events/evt-wed-4/dates?state=needsYou');
    await screen.findByRole('heading', { level: 1, name: KW.allDates }, WAIT);

    for (const title of [
      'Give final numbers to the kitchen',
      'Pay the band’s balance',
      'Seat the last 12 guests',
      'Confirm the cake',
    ])
      expect(screen.getByText(title)).toBeDefined();
  });

  it('drops the row once a copy is recorded on Kitchen sheet', SLOW, async () => {
    await page('/demo/events/evt-wed-4?state=finalNumbers');
    fireEvent.click(within(card()).getByRole('link', { name: KW.openSheet }));
    await screen.findByRole('heading', { level: 1, name: KW.title }, WAIT);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole('button', { name: KW.give }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: KW.download }),
    );
    await act(() => vi.advanceTimersByTimeAsync(1000));
    fireEvent.click(screen.getByRole('link', { name: WEDDING }));
    await screen.findByRole('heading', { level: 1, name: WEDDING }, WAIT);

    expect(within(card()).getByText('Nothing needs you')).toBeDefined();
    expect(within(card()).queryByRole('listitem')).toBeNull();
  });

  it(
    'says nothing needs you, with no count, on an event with no row and once it has started',
    SLOW,
    async () => {
      await page('/demo/events/evt-wed-4?state=now');

      expect(screen.getByRole('heading', { level: 2, name: 'Needs you' })).toBeDefined();
      expect(within(card()).getByText('Nothing needs you')).toBeDefined();
    },
  );

  it('shows a member who only reads no row', SLOW, async () => {
    await page('/demo/events/evt-wed-4?state=needsYouReadOnly');

    expect(within(card()).getByText('Nothing needs you')).toBeDefined();
    expect(within(card()).queryByRole('listitem')).toBeNull();
  });

  it('shows no row, count or tick until the load answers, or when it fails', SLOW, async () => {
    await page('/demo/events/evt-wed-4?state=needsYouFailed');

    expect(screen.getByRole('heading', { level: 2, name: 'Needs you' })).toBeDefined();
    expect(within(card()).queryByText('Nothing needs you')).toBeNull();

    fireEvent.click(within(card()).getByRole('button', { name: 'Try again' }));

    expect(within(card()).getByText('Nothing needs you')).toBeDefined();
  });
});
