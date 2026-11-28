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
    initialEntries: [`/demo/guests/seating?state=${state}`],
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function bar(): HTMLElement {
  return screen.getByRole('region', { name: 'Selected guests' });
}

function barButtons(): (string | null)[] {
  return within(bar())
    .getAllByRole('button')
    .map((one) => one.textContent);
}

function said(): string {
  return document.querySelector('.gm-said')?.textContent ?? '';
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('the guest list reads the plan (sc-4025)', () => {
  it('shows each row’s table and the Unseated chip with its count', SLOW, async () => {
    await open('list');

    expect(screen.getByRole('button', { name: /^Ngozi Eze.*Table: Table 9$/u })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^Kwame Mensah.*Table: Row C, seat 4$/u }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unseated, 8 people' })).toBeTruthy();
  });

  it('sorts by table, Table 2 before Table 10, no seat last', SLOW, async () => {
    await open('sortedByTable');
    const names = screen
      .getAllByRole('button', { name: /, Table: /u })
      .map((one) => one.getAttribute('aria-label')?.split(',')[0]);

    expect(names.slice(0, 4)).toEqual(['Tunde Bakare', 'Funmi Bakare', 'Marta Silva', 'Ngozi Eze']);
    expect(names.indexOf('Amaka Eze')).toBeLessThan(names.indexOf('Kwame Mensah'));
    expect(names.indexOf('Kwame Mensah')).toBeLessThan(names.indexOf('Ifeanyi Okafor'));
  });

  it('narrows to the unseated with the chip', SLOW, async () => {
    await open('list');
    fireEvent.click(screen.getByRole('button', { name: 'Unseated, 8 people' }));

    expect(screen.queryByRole('button', { name: /^Ngozi Eze/u })).toBeNull();
    expect(screen.getByRole('button', { name: /^Ifeanyi Okafor/u })).toBeTruthy();
  });

  it(
    'puts Assign table after Add to group, primary when Mark as invited is not there',
    SLOW,
    async () => {
      await open('selected');

      expect(barButtons()).toEqual([
        'Add to group',
        'Assign table',
        'Remove from the list',
        'Clear',
      ]);
      expect(within(bar()).getByRole('button', { name: 'Assign table' }).className).toContain(
        'is-primary',
      );
    },
  );

  it('keeps Mark as invited first and primary on a Live event', SLOW, async () => {
    await open('selectedLive');

    expect(barButtons()).toEqual([
      'Mark as invited',
      'Add to group',
      'Assign table',
      'Remove from the list',
      'Clear',
    ]);
    expect(within(bar()).getByRole('button', { name: 'Assign table' }).className).toContain(
      'is-secondary',
    );
  });

  it('sends nothing with no table chosen', SLOW, async () => {
    await open('chooser');
    const dialog = await screen.findByRole('dialog', { name: 'Assign a table' }, WAIT);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign table' }));

    expect(within(dialog).getByText('Choose a table.')).toBeTruthy();
    expect(
      within(dialog).getByRole('combobox', { name: 'Table' }).getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('chooses with the keyboard and seats whole parties, then undoes', SLOW, async () => {
    await open('selectedLive');
    fireEvent.click(within(bar()).getByRole('button', { name: 'Assign table' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a table' }, WAIT);
    const field = within(dialog).getByRole('combobox', { name: 'Table' });

    fireEvent.change(field, { target: { value: 'table 4' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(
      within(dialog).getByText('Will move from their seats: Ngozi Eze and Yusuf Danjuma.'),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign table' }));

    await waitFor(() => expect(said()).toContain('Seated 6 at Table 4.'), WAIT);
    expect(said()).toContain('Not seated: Ifeanyi Okafor’s party (4), not enough room.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(
      () => expect(said()).toContain('Undone. 6 people are back where they were.'),
      WAIT,
    );
  });

  it('says Every table is full and lists none', SLOW, async () => {
    await open('chooserFull');
    const dialog = await screen.findByRole('dialog', { name: 'Assign a table' }, WAIT);

    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);
    expect(within(dialog).getAllByText('Every table is full.').length).toBeGreaterThan(0);
  });

  it('keeps the highlighted option on the list when a table leaves the plan', SLOW, async () => {
    await open('chooser');
    const dialog = await screen.findByRole('dialog', { name: 'Assign a table' }, WAIT);
    const field = within(dialog).getByRole<HTMLInputElement>('combobox', { name: 'Table' });

    fireEvent.click(field);
    const before = within(dialog).getAllByRole('option').length;
    for (let step = 0; step < before; step += 1) fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Take Table 4 off the plan' }));
    fireEvent.click(field);

    const options = within(dialog).getAllByRole('option');
    const last = options[options.length - 1];
    expect(options).toHaveLength(before - 1);
    expect(field.getAttribute('aria-activedescendant')).toBe(last?.id);
    expect(last?.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field.value).not.toBe('');
    expect(field.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the chooser open when the chosen table leaves the plan', SLOW, async () => {
    await open('chooserChosen');
    const dialog = await screen.findByRole('dialog', { name: 'Assign a table' }, WAIT);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Take Table 4 off the plan' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign table' }));

    expect(
      within(dialog).getByText('Table 4 is no longer on the plan. Choose another table.'),
    ).toBeTruthy();
    expect(within(dialog).getByRole<HTMLInputElement>('combobox', { name: 'Table' }).value).toBe(
      '',
    );
    expect(said()).toBe('');
  });

  it('unseats from the details, with Undo', SLOW, async () => {
    await open('detailsTable');
    const details = screen.getByRole('region', { name: 'Tunde Bakare, details' });

    expect(within(details).getByText('Table 2 · Main hall')).toBeTruthy();
    expect(within(details).getByText('Seat: Table 2 · Main hall')).toBeTruthy();
    fireEvent.click(within(details).getByRole('button', { name: 'Unseat' }));
    expect(within(details).getByText('Unseated from Table 2 · Main hall.')).toBeTruthy();
    expect(within(details).getByText('No seat yet')).toBeTruthy();
    fireEvent.click(within(details).getByRole('button', { name: 'Undo' }));
    expect(within(details).getByText('Table 2 · Main hall')).toBeTruthy();
  });

  it('offers Choose a seat to a guest with no seat', SLOW, async () => {
    await open('detailsNoSeat');
    const details = screen.getByRole('region', { name: 'Ifeanyi Okafor, details' });

    expect(within(details).getByText('No seat yet')).toBeTruthy();
    expect(within(details).getByRole('link', { name: 'Choose a seat' })).toBeTruthy();
  });

  it('shows nothing of seating before the plan has a table, then shows it live', SLOW, async () => {
    await open('noTables');

    expect(screen.queryByRole('button', { name: /^Unseated/u })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add the first table to the plan' }));
    expect(await screen.findByRole('button', { name: /^Unseated/u }, WAIT)).toBeTruthy();
  });

  it('shows the column without the actions to Seating: read only', SLOW, async () => {
    await open('readOnly');
    fireEvent.click(screen.getByRole('checkbox', { name: /^Ngozi Eze/u }));

    expect(barButtons()).not.toContain('Assign table');
    expect(screen.getByRole('button', { name: /^Ngozi Eze.*Table: Table 9$/u })).toBeTruthy();
  });

  it('is the list as before without Seating: read', SLOW, async () => {
    await open('noSeating');

    expect(screen.queryByRole('button', { name: /^Unseated/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /Table: /u })).toBeNull();
  });
});
