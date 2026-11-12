import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

beforeAll(() => import('./Demo.tsx'), 60000);
beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/service-room?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Service' }, { timeout: 8000 });
}

const button = (name: string | RegExp) => screen.queryByRole('button', { name });
const panel = () => screen.getByRole('complementary', { name: /^Table/ });
const NINE =
  'Table 9, Behind, 22 minutes, request open, 10 covers, 2 flagged guests still to serve';

describe('/demo/service-room (sc-4026)', () => {
  it('opens on the plan with Behind, no Late, and the long flagged phrase as the tile’s name', async () => {
    await open('populated');
    expect(button('Plan')?.getAttribute('aria-pressed')).toBe('true');
    expect(button(NINE)).toBeTruthy();
    expect(screen.queryByText(/\blate\b/i)).toBeNull();
    expect(screen.getByText('Section C · Nobody on it')).toBeTruthy();
    expect(screen.getByText('Section B · Funmi Bakare, Grace Udo')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Alerts' })).toBeTruthy();
  });

  it('opens a table’s panel in the AC’s order from Go to table', async () => {
    await open('populated');
    const alerts = screen.getByRole('region', { name: 'Alerts' });
    fireEvent.click(
      within(alerts).getAllByRole('button', { name: 'Go to table' })[0] as HTMLElement,
    );
    const p = panel();
    const headings = within(p)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      'Flagged guests',
      'Requests · 4',
      'Trays',
      'Seats',
      'Closed at this table',
    ]);
    expect(
      within(p).getAllByText('Could the blind behind them come down a little?')[0],
    ).toBeTruthy();
    expect(document.activeElement?.id).toBe('sr-panel-title');
  });

  it('closes the panel on Escape and puts focus back on the table', async () => {
    await open('populated');
    const alerts = screen.getByRole('region', { name: 'Alerts' });
    fireEvent.click(
      within(alerts).getAllByRole('button', { name: 'Go to table' })[0] as HTMLElement,
    );
    const title = within(panel()).getByRole('heading', { level: 2 }).textContent ?? '';
    fireEvent.keyDown(panel(), { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: /^Table/ })).toBeNull();
    expect(document.activeElement?.getAttribute('data-table')).toBe(title.replace('Table ', ''));
  });

  it('sorts the list by Wait, then reverses it, with aria-sort', async () => {
    await open('list');
    const wait = screen.getByRole('columnheader', { name: /Wait/ });
    fireEvent.click(within(wait).getByRole('button'));
    expect(wait.getAttribute('aria-sort')).toBe('descending');
    const first = () => screen.getAllByRole('row')[1];
    expect(within(first() as HTMLElement).getByText('Table 9')).toBeTruthy();
    fireEvent.click(within(wait).getByRole('button'));
    expect(wait.getAttribute('aria-sort')).toBe('ascending');
    expect(within(first() as HTMLElement).getByText('Nothing waiting')).toBeTruthy();
  });

  it('takes a request nobody has', async () => {
    await open('reqNobody');
    const card = within(panel())
      .getByText('A high chair for seat 6, please.')
      .closest('li') as HTMLElement;
    expect(within(card).queryByRole('button', { name: 'Done' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'I’ll do it' }));
    expect(within(card).getByText(/You’re on it/)).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('refuses a blank decline and moves focus to the field', async () => {
    await open('reqNobody');
    const card = within(panel())
      .getByText('A high chair for seat 6, please.')
      .closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Decline' }));
    expect(within(card).getByLabelText('Why it can’t be done').getAttribute('maxlength')).toBe(
      '200',
    );
    fireEvent.click(within(card).getByRole('button', { name: 'Decline request' }));
    expect(within(card).getByText('Say why it can’t be done')).toBeTruthy();
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true');
  });

  it('moves a request closed first to Closed, with the notice focused', async () => {
    await open('reqOther');
    fireEvent.click(button('Someone closed it first') as HTMLElement);
    const card = within(panel())
      .getAllByText('Could the blind behind them come down a little?')[0]
      ?.closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Done' }));
    expect(document.activeElement?.textContent).toBe(
      'Not closed. Grace Udo closed this request at 20:23.',
    );
  });

  it('refuses every request button offline', async () => {
    await open('offline');
    const card = within(panel())
      .getByText('A high chair for seat 6, please.')
      .closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'I’ll do it' }));
    const refused =
      'Taking, finishing and declining a request need a connection. Nothing is kept to send later.';
    expect(screen.getAllByText(refused).length).toBeGreaterThan(0);
  });

  it('shows no buttons and no Alerts without service.manage', async () => {
    await open('noManage');
    expect(within(panel()).queryByRole('button', { name: /I’ll do it|Done|Decline/ })).toBeNull();
    expect(screen.getByText('Handling requests on any table needs Run the service.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Alerts' })).toBeNull();
  });

  it('opens on the list when the venue has no floor plan', async () => {
    await open('noPlan');
    expect(button('List')?.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('Plan') as HTMLElement);
    expect(screen.getByText('No floor plan for this venue')).toBeTruthy();
    fireEvent.click(button('Show the list') as HTMLElement);
    expect(button('List')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('draws every state', async () => {
    for (const state of [
      'notStarted',
      'loading',
      'refreshing',
      'unreachable',
      'panelHeld',
      'panelPaused',
      'earlier',
      'refusedStage',
      'refusedDish',
      'alertsEmpty',
    ]) {
      await open(state);
      expect(screen.getByRole('heading', { level: 1, name: 'Service' })).toBeTruthy();
      cleanup();
    }
  });

  it('makes the plan one Tab stop that the arrow keys, Home and End move through', async () => {
    await open('populated');
    const tile = (n: number) =>
      document.querySelector<HTMLButtonElement>(
        `.sr-plan [data-table="${n}"]`,
      ) as HTMLButtonElement;
    const stops = [...document.querySelectorAll('.sr-plan button')].filter(
      (b) => b.getAttribute('tabindex') !== '-1',
    );
    expect(stops).toEqual([tile(1)]);

    tile(1).focus();
    fireEvent.keyDown(tile(1), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tile(1));
    fireEvent.keyDown(tile(1), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tile(2));
    fireEvent.keyDown(tile(2), { key: 'End' });
    expect(document.activeElement).toBe(tile(18));
    fireEvent.keyDown(tile(18), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tile(18));
    fireEvent.keyDown(tile(18), { key: 'Home' });
    expect(document.activeElement).toBe(tile(1));
    fireEvent.keyDown(tile(1), { key: 'ArrowDown' });
    fireEvent.keyDown(tile(2), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tile(3));

    const alerts = screen.getByRole('region', { name: 'Alerts' });
    (within(alerts).getAllByRole('button')[0] as HTMLElement).focus();
    expect(tile(3).getAttribute('tabindex')).toBe('0');
    expect(tile(1).getAttribute('tabindex')).toBe('-1');

    fireEvent.click(tile(9));
    expect(tile(9).getAttribute('tabindex')).toBe('0');
    expect(tile(3).getAttribute('tabindex')).toBe('-1');
  });
});
