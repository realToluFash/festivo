import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const WAIT = { timeout: 8000 };
const SLOW = { timeout: 20000 };

async function open(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/guests/many?state=${state}`],
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function bar(): HTMLElement {
  return screen.getByRole('region', { name: 'Selected guests' });
}

function page(): string {
  return document.body.textContent ?? '';
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('select many guests (sc-3776)', () => {
  it('shows the bar with its two actions and Clear, companions counted', SLOW, async () => {
    await open('some');

    const names = within(bar())
      .getAllByRole('button')
      .map((one) => one.textContent);

    expect(names).toEqual(['Add to group', 'Remove from the list', 'Clear']);
    expect(bar().textContent).toContain('4 selected');
    expect(bar().textContent).toContain('and 1 companion with them');
  });

  it('clears the selection when the search changes, and says so', SLOW, async () => {
    await open('some');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a guest' }), {
      target: { value: 'So' },
    });

    await waitFor(() => expect(page()).toContain('Selection cleared.'));
    expect(screen.queryByRole('region', { name: 'Selected guests' })).toBeNull();
  });

  it('moves the selected guests to a group, and the line takes the bar’s place', SLOW, async () => {
    await open('group');

    const dialog = await screen.findByRole('dialog', { name: 'Add 4 guests to a group' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to group' }));
    expect(dialog.textContent).toContain('Choose a group, or make a new one.');
    fireEvent.click(within(dialog).getByRole('radio', { name: /Bride’s side/u }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to group' }));

    await waitFor(() => expect(page()).toContain('4 moved to Bride’s side.'));
    expect(screen.queryByRole('region', { name: 'Selected guests' })).toBeNull();
  });

  it('checks a new group’s name before anything is sent', SLOW, async () => {
    await open('newGroupBlank');

    const dialog = await screen.findByRole('dialog', { name: 'Add 4 guests to a group' });

    expect(dialog.textContent).toContain('Enter a name for the group.');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name of the new group' }), {
      target: { value: 'Cousins' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to group' }));

    await waitFor(() => expect(page()).toContain('4 moved to Cousins.'));
  });

  it('asks before removing, names who has arrived, and Undo puts them back', SLOW, async () => {
    await open('remove');

    const ask = await screen.findByRole('alertdialog', {
      name: 'Remove 3 guests and their 1 companion?',
    });

    expect(ask.textContent).toContain('Kwame Mensah has arrived, so they stay on the list.');
    expect(document.activeElement).toBe(
      within(ask).getByRole('button', { name: 'Keep on the list' }),
    );
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove 3' }));

    await waitFor(() => expect(page()).toContain('3 guests and 1 companion removed.'));
    expect(page()).toContain('1 not changed: Kwame Mensah has arrived.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(page()).toContain('3 guests are back on the list, as they were.'));
  });

  it('keeps the selection when nothing changed, and Try again acts on it', SLOW, async () => {
    await open('failed');
    expect(page()).toContain('Nothing changed. We could not reach Soirely.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(page()).toContain('4 moved to Bride’s side.'));
  });

  it('shows no boxes and no bar without guests.manage', SLOW, async () => {
    await open('viewOnly');
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Selected guests' })).toBeNull();
  });
});
