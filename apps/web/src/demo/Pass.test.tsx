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
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/pass?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Pass · Main' }, { timeout: 8000 });
}

const panel = () => screen.getByRole('dialog');

describe('/demo/pass (sc-4018)', () => {
  it('shows the strip as sc-4028’s Connected state alone, with no line under it', async () => {
    await open('ticket');
    expect(screen.getByText('Connected · up to date 20:09').parentElement?.textContent).toBe(
      'Connected · up to date 20:09',
    );
  });

  it('records Printed when the stand-in dialogue closes, Cancel included, as a browser cannot tell them apart', async () => {
    await open('ticket');
    fireEvent.click(screen.getByRole('button', { name: 'Print table 9’s ticket' }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Printed 20:12')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('records nothing when Print tickets is cancelled from its own panel', async () => {
    await open('print-tickets');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Printed 20:12')).toBeNull();
  });

  it('prints what is not printed yet from Print tickets, then offers None left to print', async () => {
    await open('print-tickets');
    expect(within(panel()).getByLabelText('Not printed yet · 4 tickets')).toHaveProperty(
      'checked',
      true,
    );
    fireEvent.click(within(panel()).getByRole('button', { name: 'Print 4 tickets' }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Print' }));
    expect(screen.getAllByText('Printed 20:12')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Print tickets' }));
    expect(within(panel()).getByLabelText('None left to print')).toHaveProperty('disabled', true);
    expect(
      within(panel()).getByLabelText('All tickets for Main · 6 tickets, printed ones again'),
    ).toHaveProperty('checked', true);
  });

  it('keeps Print tickets shut, saying why, with no tickets in Main', async () => {
    await open('no-tickets');
    const button = screen.getByRole('button', { name: /Print tickets/ });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toContain('· none in Main');
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers Paper roll and the iPad line in Printing, with no switch', async () => {
    await open('printing');
    expect(within(panel()).getByLabelText('80 mm')).toHaveProperty('checked', true);
    expect(
      within(panel()).getByText('Print when fired needs the Soirely app on an iPad.'),
    ).toBeTruthy();
    expect(within(panel()).queryByRole('switch')).toBeNull();
  });

  it('prints with no connection from the tickets on screen, saying the paper carries AS OF', async () => {
    await open('offline');
    expect(screen.getByText('No connection · as of 20:09')).toBeTruthy();
    expect(screen.queryByText(/Offline|Reconnecting/)).toBeNull();
    expect(within(panel()).getByText(/Each ticket carries AS OF 20:09 at the top\./)).toBeTruthy();
  });
});
