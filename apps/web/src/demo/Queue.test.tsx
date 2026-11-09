import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

beforeAll(() => import('./Demo.tsx'), 60000);
beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string): Promise<void> {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/queue?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Service' }, { timeout: 8000 });
}

const queue = () => screen.queryByRole('region', { name: 'Queue' });
const names = () =>
  within(queue() as HTMLElement)
    .getAllByRole('listitem')
    .map((row) => row.querySelector('strong')?.textContent);
const button = (name: string) => screen.queryByRole('button', { name });

describe('/demo/queue (sc-36033)', () => {
  it('numbers the rows in words as well, with no way up from the first or down from the last', async () => {
    await open('populated');
    expect(names()).toEqual([
      'Table 2',
      'Table 4',
      'Table 5',
      'Table 10',
      'Row C',
      'Seats 1 to 10',
    ]);
    expect(within(queue() as HTMLElement).getByText(/1 of 6\./)).toBeTruthy();
    expect(button('Bring Table 2 forward')).toBeNull();
    expect(button('Move Table 2 up')).toBeNull();
    expect(button('Move Seats 1 to 10 down')).toBeNull();
    expect(button('Move Table 2 down')).toBeTruthy();
  });

  it('brings a table forward, says where it went, and keeps focus on its controls', async () => {
    await open('populated');
    fireEvent.click(button('Bring Table 4 forward') as HTMLElement);
    expect(names()[0]).toBe('Table 4');
    expect(screen.getByText('Table 4 moved to 1 of 6').getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(button('Move Table 4 down'));
  });

  it('never tells the lead of their own change', async () => {
    await open('waiterNotice');
    expect(names()[0]).toBe('Table 5');
    expect(screen.queryByText(/Moved up by/)).toBeNull();
  });

  it('refuses a change offline with the line, and changes nothing', async () => {
    await open('populated');
    fireEvent.click(screen.getByRole('button', { name: 'Go offline' }));
    fireEvent.click(button('Move Table 4 up') as HTMLElement);
    expect(names()[0]).toBe('Table 2');
    expect(within(queue() as HTMLElement).getByRole('status').textContent).toBe(
      'Changing the queue needs a connection.',
    );
  });

  it('keeps Save shut until a table is placed, then saves the built queue', async () => {
    await open('buildEmpty');
    const shut = screen.getByRole('button', { name: 'Tap a table to start' });
    expect(shut.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(shut);
    expect(button('Tap a table to start')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Table 19, not placed yet' }));
    expect(
      screen
        .getByRole('button', { name: 'Table 19, number 1 in the new queue' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Save the queue · Table 19 first' }));
    expect(names()[0]).toBe('Table 19');
    expect(screen.getByText('Section D queue saved · Table 19 is next')).toBeTruthy();
  });

  it('says another lead changed the queue when a save is refused with 412', async () => {
    await open('conflict');
    expect(
      screen.getByText('Tobi Adeyemi changed this queue while you were building it.'),
    ).toBeTruthy();
  });

  it('draws a one-table section with no controls and no Build the queue', async () => {
    await open('oneTable');
    expect(names()).toEqual(['Table 12']);
    expect(within(queue() as HTMLElement).queryAllByRole('button')).toHaveLength(0);
  });

  it('draws no Queue for a section with no tables', async () => {
    await open('noTables');
    expect(queue()).toBeNull();
    expect(
      screen.getByText(
        'No tables in Section E yet. A table added to it joins the end of its queue.',
      ),
    ).toBeTruthy();
  });

  it('draws no Queue without service.manage', async () => {
    await open('noManage');
    expect(queue()).toBeNull();
    expect(screen.getByRole('region', { name: 'On it' })).toBeTruthy();
  });
});
