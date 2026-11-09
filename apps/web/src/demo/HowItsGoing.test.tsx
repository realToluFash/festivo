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
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/how-its-going?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Service' }, { timeout: 8000 });
}

const button = (name: string | RegExp) => screen.queryByRole('button', { name });
const alerts = () => screen.getByRole('region', { name: 'Alerts' });

describe('/demo/how-its-going (sc-34107)', () => {
  it('opens on How it’s going with the course line and the four counts', async () => {
    await open('populated');
    expect(button('How it’s going')?.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: '108 of 194 guests have had Mains' })).toBeTruthy();
    for (const word of [
      'On a tray',
      'Waiting on the kitchen',
      'To serve',
      'Served',
      'Not here yet',
    ])
      expect(screen.getByText(word)).toBeTruthy();
    expect(screen.queryByText(/\blate\b/i)).toBeNull();
  });

  it('pauses a started tray from its waiter’s line, and raises the alert', async () => {
    await open('populated');
    fireEvent.click(button('Pause Kunle Ajayi’s tray for Table 4') as HTMLElement);
    expect(button('Pause Kunle Ajayi’s tray for Table 4')).toBeNull();
    expect(within(alerts()).getByText('Kunle Ajayi’s tray is paused')).toBeTruthy();
    expect(within(alerts()).getByText('Table 4 · paused by Ifeoma Nduka')).toBeTruthy();
  });

  it('gives a paused tray from its alert, and the alert leaves', async () => {
    await open('populated');
    fireEvent.click(within(alerts()).getByRole('button', { name: 'Give to…' }));
    const dialog = screen.getByRole('dialog', { name: 'Give Table 9’s tray to…' });
    expect(within(dialog).getByText('Tray in hand · Table 6')).toBeTruthy();
    expect(within(dialog).getByText('As well')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /Bisi Lawal/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(alerts()).queryByText('Funmi Bakare’s tray is paused')).toBeNull();
    expect(screen.getByText('Table 9’s tray is Bisi Lawal’s now.')).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-line')).toBe('B:Bisi Lawal');
  });

  it('names who paused the tray, not its waiter', async () => {
    await open('giveNobody');
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Kunle Ajayi · Section A · paused by Ifeoma Nduka'),
    ).toBeTruthy();
  });

  it('keeps Tab inside Give to…, and Cancel returns to its Give to…', async () => {
    await open('populated');
    const opener = within(alerts()).getByRole('button', { name: 'Give to…' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(cancel);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(within(alerts()).getByRole('button', { name: 'Give to…' }));
  });

  it('says nobody else is on the section, with Team one press away', async () => {
    await open('giveNobody');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Nobody else is on Section A.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Team' })).toBeTruthy();
  });

  it('closes Give to… on Escape', async () => {
    await open('giveTo');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('draws the three Team alerts with no button until sc-36034 lands', async () => {
    await open('noTeam');
    expect(within(alerts()).queryByRole('button', { name: 'Team' })).toBeNull();
    expect(within(alerts()).getByText('Nobody on Section C')).toBeTruthy();
  });

  it('opens on Plan without service.manage, with no How it’s going', async () => {
    await open('noManage');
    expect(button('How it’s going')).toBeNull();
    expect(button('Plan')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows only the not-started state before service starts', async () => {
    await open('notStarted');
    expect(button('Start service')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Alerts' })).toBeNull();
    expect(screen.queryByText(/guests have had/)).toBeNull();
  });

  it('keeps the figures offline and refuses the pause with a line', async () => {
    await open('populated');
    fireEvent.click(button('Go offline') as HTMLElement);
    expect(screen.getByText('No connection · as of 20:22')).toBeTruthy();
    fireEvent.click(button('Pause Kunle Ajayi’s tray for Table 4') as HTMLElement);
    expect(
      screen.getAllByText('Pausing a tray and Give to… need a connection.').length,
    ).toBeGreaterThan(0);
    expect(button('Pause Kunle Ajayi’s tray for Table 4')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '108 of 194 guests have had Mains' })).toBeTruthy();
  });
});
