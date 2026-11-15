import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/run?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Run of show' }, { timeout: 8000 });
}

const hall = () => screen.getByRole('table', { name: 'Main hall' });
const said = () => screen.getAllByRole('status').map((one) => one.textContent);

describe('/demo/events/evt-wed-4/run (sc-1404)', () => {
  it('draws one table per track, Starts · Lasts · Item · Owner', async () => {
    await open('onTime');
    expect(screen.getByRole('table', { name: 'Garden terrace' })).toBeTruthy();
    const heads = within(hall())
      .getAllByRole('columnheader')
      .map((one) => one.textContent);
    expect(heads).toEqual(['Starts', 'Lasts', 'Item', 'Owner', 'Mark']);
    expect(within(hall()).getByText('No length set')).toBeTruthy();
    expect(within(hall()).getAllByText('No owner yet')).toHaveLength(2);
    expect(within(hall()).getByText('Fixed time')).toBeTruthy();
  });

  it('puts “about 20:13” under the planned time and says how far behind', async () => {
    await open('behind');
    expect(within(hall()).getByText('about 20:13')).toBeTruthy();
    expect(within(hall()).getByText('started 18:58')).toBeTruthy();
    expect(said()).toContain('Main hall, 18 minutes behind18 min behind');
  });

  it('flags the collision, naming both items', async () => {
    await open('collision');
    expect(screen.getByText('Cake cutting would run into Fireworks at 22:00')).toBeTruthy();
  });

  it('says an item started out of order', async () => {
    await open('outOfOrder');
    expect(within(hall()).getByText('Started before Welcome speech.')).toBeTruthy();
  });

  it('reads Last item under way', async () => {
    await open('last');
    expect(said()).toContain('Main hall, last item under wayLast item under way');
  });

  it('shows no figure on a track with every item done, and says so under its table', async () => {
    await open('allDone');
    expect(said()).toContain('Main hall, every item on this track is done');
    expect(said()).not.toContain('verything done');
    expect(screen.queryByText('Everything done')).toBeNull();
    expect(screen.getAllByText('Every item on this track is done.').length).toBeGreaterThan(0);
  });

  it('ends each table with what is next', async () => {
    await open('outOfOrder');
    expect(
      screen.getByText('Next: Welcome speech at about 18:55. Next step: start it when it begins.'),
    ).toBeTruthy();
  });

  it('recomputes when an item is finished', async () => {
    await open('collision');
    const dance = () => within(hall()).getByRole('rowheader', { name: /First dance/ });
    expect(within(dance()).queryByText('Done')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finish First dance' }));
    expect(within(dance()).getByText('Done')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Finish First dance' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Cake cutting' }));
    expect(within(hall()).getByText('started 21:32')).toBeTruthy();
    expect(screen.getByText('Cake cutting would run into Fireworks at 22:00')).toBeTruthy();
  });

  it('moves the clock on, and times move with it', async () => {
    await open('onTime');
    for (let i = 0; i < 12; i += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Move the clock on 5 min' }));
    expect(document.querySelector('.rv-clock')?.textContent).toBe('Now 20:10 at the venue');
    expect(within(hall()).getByText('about 20:10')).toBeTruthy();
    expect(said()).toContain('Main hall, 15 minutes behind15 min behind');
  });
});
