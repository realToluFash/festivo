import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 8000 };
const WEDDING = 'Adaeze & Tunde’s wedding';

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
      const side = await screen.findByRole('navigation', { name: 'Soirely' }, SLOW);

      fireEvent.click(within(side).getByRole('link', { name: 'Events' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Events' })).toBeDefined();
      expect(router.state.location.pathname).toBe('/demo/events');
      expect(screen.getByRole('heading', { level: 2, name: WEDDING })).toBeDefined();
      expect(within(main()).getByRole('link', { name: /Ireti at 40/ })).toBeDefined();
      expect(screen.getByText('4 events · Sorted by date')).toBeDefined();
    },
  );

  it('keeps the search in the address, so Back brings it back', SLOW, async () => {
    const router = await list();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search events' }), {
      target: { value: 'lucia' },
    });

    expect(router.state.location.search).toBe('?q=lucia');
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

    expect(await screen.findByText('Draft created. Opening it.')).toBeDefined();
    expect(router.state.location.pathname).not.toBe('/demo/events/evt-wed-4');
    expect(screen.queryByRole('alertdialog', { name: 'Discard your change?' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: WEDDING })).toBeDefined();
  });

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

  it('shows an area that is coming, and opens People from the event’s sidebar', SLOW, async () => {
    await page('/demo/events/evt-wed-4?area=guests', 'Guests');

    expect(screen.getByText('The guest list for this event is coming.')).toBeDefined();
    expect(
      within(screen.getByRole('navigation', { name: WEDDING }))
        .getByRole('link', { name: 'People' })
        .getAttribute('href'),
    ).toBe('/demo/people');
  });
});

describe('the guest counts on Events (sc-23284)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  it('shows the invited and the replies across the upcoming events', SLOW, async () => {
    await list();
    const tiles = within(main()).getByRole('list', { name: 'Guests across your upcoming events' });

    expect(within(tiles).getByText('367')).toBeDefined();
    expect(within(tiles).getByText('211 coming')).toBeDefined();
    expect(within(tiles).getByText('266')).toBeDefined();
    expect(within(tiles).getByText('101 haven’t replied')).toBeDefined();
  });

  it('shows 0 when nobody is invited yet', SLOW, async () => {
    await list('/demo/events?state=noGuests');
    const tiles = within(main()).getByRole('list', { name: 'Guests across your upcoming events' });

    expect(within(tiles).getAllByText('0')).toHaveLength(2);
    expect(within(tiles).getByText('0 coming')).toBeDefined();
    expect(within(tiles).getByText('0 haven’t replied')).toBeDefined();
  });

  it('has no counts on a first run', SLOW, async () => {
    await list('/demo/events?state=first');

    expect(
      within(main()).queryByRole('list', { name: 'Guests across your upcoming events' }),
    ).toBeNull();
  });
});
