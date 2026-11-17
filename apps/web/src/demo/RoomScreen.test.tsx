import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const SLOW = { timeout: 15000 };
const tested = config();

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function room(state: string, place = 'ballroom') {
  await open(`/demo/screen/${place}?state=${state}`);

  return screen.findByTestId('room-screen', {}, SLOW);
}

function coming(): string[] {
  const list = screen.getByRole('heading', { name: 'Coming up' }).nextElementSibling as HTMLElement;

  return within(list)
    .getAllByRole('listitem')
    .map((one) => one.textContent ?? '');
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  __setConfig(tested);
});

describe('the room screen (sc-3897)', () => {
  it('shows the event, Now and the next three', SLOW, async () => {
    const shown = await room('now');

    expect(within(shown).getByRole('heading', { level: 1 }).textContent).toBe(
      'Adaeze & Tunde’s wedding',
    );
    expect(screen.getByText('Grand entrance')).toBeDefined();
    expect(coming()).toEqual(['17:35Dinner', '19:15Speeches', '20:00First dance']);
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeDefined();
  });

  it('moves on when the night presses Done and Start', SLOW, async () => {
    await room('now');
    fireEvent.click(screen.getByRole('button', { name: 'Done on Grand entrance' }));

    expect(screen.queryByRole('heading', { name: 'Now' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Dinner' }));
    expect(screen.getByRole('heading', { name: 'Now' }).nextElementSibling?.textContent).toBe(
      'Dinner',
    );
    expect(coming()).toEqual(['19:15Speeches', '20:00First dance', '20:15Dancing']);
  });

  it(
    'keeps the last state offline, says as of when, and catches up on reconnecting',
    SLOW,
    async () => {
      await room('now');
      fireEvent.click(screen.getByRole('button', { name: 'Lose the connection' }));
      fireEvent.click(screen.getByRole('button', { name: 'Move the clock on 5 min' }));
      fireEvent.click(screen.getByRole('button', { name: 'Move the clock on 5 min' }));
      fireEvent.click(screen.getByRole('button', { name: 'Move the clock on 5 min' }));

      expect(screen.getByRole('status').textContent).toBe('Times as of 17:25');
      expect(coming()[0]).toBe('17:35Dinner');
      fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
      expect(screen.queryByText('Times as of 17:25')).toBeNull();
      expect(coming()[0]).toBe('17:40Dinner');
    },
  );

  it('shows only that the link was replaced, and the thank-you once Finished', SLOW, async () => {
    const replaced = await room('replaced');

    expect(replaced.textContent).toBe('This screen link has been replaced');
    expect(screen.queryByRole('button', { name: 'Full screen' })).toBeNull();
    cleanup();
    const finished = await room('finished');

    expect(finished.textContent).toContain('Thank you for coming');
    expect(finished.textContent).toContain('Adaeze & Tunde’s wedding');
  });

  it('is blank but for Full screen before its first answer', SLOW, async () => {
    const shown = await room('connecting');

    expect(within(shown).queryByRole('heading')).toBeNull();
    expect(within(shown).getByRole('button', { name: 'Full screen' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'The first answer arrives' }));
    expect(screen.getByText('Grand entrance')).toBeDefined();
  });

  it('shows the event’s name only with nothing left', SLOW, async () => {
    const shown = await room('nothingLeft', 'garden');

    expect(shown.textContent).toBe('Adaeze & Tunde’s weddingFull screen');
  });
});

describe('Show on a screen on the Schedule (sc-3897)', () => {
  it('lists each place with its three actions, and asks before replacing', SLOW, async () => {
    await open('/demo/events/evt-wed-4/schedule');
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }, SLOW));
    const dialog = screen.getByRole('dialog', { name: 'Show on a screen' });
    const rows = within(dialog).getAllByRole('listitem');

    expect(rows.map((one) => within(one).getByRole('heading').textContent)).toEqual([
      'Main',
      'Garden',
      'Ballroom',
    ]);
    const ballroom = rows[2] as HTMLElement;

    expect(within(ballroom).getByRole('link', { name: 'Open here' }).getAttribute('href')).toBe(
      '/demo/screen/ballroom',
    );
    fireEvent.click(within(ballroom).getByRole('button', { name: 'Replace link' }));
    expect(document.activeElement?.textContent).toBe('Keep this link');
    fireEvent.click(within(ballroom).getByRole('button', { name: 'Replace link' }));
    expect(
      within(ballroom).getByText('Replaced at 17:25. The old link shows nothing.'),
    ).toBeDefined();
  });

  it('says so and selects the link when the browser refuses the copy', SLOW, async () => {
    await open('/demo/events/evt-wed-4/schedule');
    fireEvent.click(await screen.findByRole('button', { name: 'Show on a screen' }, SLOW));
    const dialog = screen.getByRole('dialog', { name: 'Show on a screen' });
    const ballroom = within(dialog).getAllByRole('listitem')[2] as HTMLElement;

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    fireEvent.click(within(ballroom).getByRole('button', { name: 'Copy screen link' }));

    expect(
      await within(dialog).findByText(
        'Could not copy here. The link for Ballroom is selected: press Ctrl+C or Command+C.',
      ),
    ).toBeDefined();
    expect(within(dialog).queryByText('Screen link for Ballroom copied.')).toBeNull();
    expect(window.getSelection()?.toString()).toBe('https://soirely.app/s/w3E6rT9yU2iO5pA8sD1fG4');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('opens on the refused copy by ?state=screensRefused', SLOW, async () => {
    await open('/demo/events/evt-wed-4/schedule?state=screensRefused');
    const dialog = await screen.findByRole('dialog', { name: 'Show on a screen' }, SLOW);

    expect(within(dialog).getByRole('status').textContent).toBe(
      'Could not copy here. The link for Ballroom is selected: press Ctrl+C or Command+C.',
    );
    expect(window.getSelection()?.toString()).toBe('https://soirely.app/s/w3E6rT9yU2iO5pA8sD1fG4');
  });

  it('holds three rows while the links load', SLOW, async () => {
    await open('/demo/events/evt-wed-4/schedule?state=screensLoading');
    const dialog = await screen.findByRole('dialog', { name: 'Show on a screen' }, SLOW);

    expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0);
    expect(dialog.querySelectorAll('.skeleton-row')).toHaveLength(3);
    expect(within(dialog).getByRole('status').textContent).toBe('Loading the screen links…');
  });

  it('says the links did not load, and Try again loads them', SLOW, async () => {
    await open('/demo/events/evt-wed-4/schedule?state=screensFailed');
    const dialog = await screen.findByRole('dialog', { name: 'Show on a screen' }, SLOW);

    expect(within(dialog).getByRole('status').textContent).toBe('The screen links did not load.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(within(dialog).getByRole('status').textContent).toBe('Loading the screen links…');
    expect(
      await within(dialog).findAllByRole('button', { name: 'Copy screen link' }, SLOW),
    ).toHaveLength(3);
  });

  it('keeps the old link when Replace link fails', SLOW, async () => {
    await open('/demo/events/evt-wed-4/schedule?state=screensReplaceFailed');
    const dialog = await screen.findByRole('dialog', { name: 'Show on a screen' }, SLOW);
    const ballroom = within(dialog).getAllByRole('listitem')[2] as HTMLElement;

    expect(within(dialog).getByRole('status').textContent).toBe(
      'The link for Ballroom was not replaced, so the old link still works. Try again.',
    );
    expect(
      within(ballroom).getByText('https://soirely.app/s/w3E6rT9yU2iO5pA8sD1fG4'),
    ).toBeDefined();
    expect(within(ballroom).queryByText(/Replaced at/)).toBeNull();
    expect(document.activeElement).toBe(
      within(ballroom).getByRole('button', { name: 'Replace link' }),
    );
  });

  it('is not offered without run_of_show.manage', SLOW, async () => {
    await open('/demo/events/evt-wed-4/schedule?state=readOnly');
    await screen.findByRole('heading', { level: 1 }, SLOW);

    expect(screen.queryByRole('button', { name: 'Show on a screen' })).toBeNull();
  });
});
