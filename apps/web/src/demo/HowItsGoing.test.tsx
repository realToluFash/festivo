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

describe('/demo/how-its-going with Chicken run out (sc-59384)', () => {
  const panel = () => screen.getByRole('dialog', { name: 'Chicken has run out' });
  const kitchen = () => screen.getByRole('region', { name: 'The kitchen' });

  it('counts Waiting for a choice first, and raises the alert with one button, Choose', async () => {
    await open('runOutAlert');
    const counts = screen.getByRole('region', { name: /guests have had Mains/ });
    const words = within(counts)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.hig-count-word')?.textContent);
    expect(words[0]).toBe('Waiting for a choice');
    expect(within(alerts()).getByText('Chicken has run out')).toBeTruthy();
    expect(within(alerts()).getByText('Grill · 9 waiting for a choice')).toBeTruthy();
    expect(within(kitchen()).getByText('Chicken · Grill · Run out')).toBeTruthy();
  });

  it('opens the panel from Choose, and gives focus back to Choose on close', async () => {
    await open('runOutAlert');
    const choose = within(alerts()).getByRole('button', { name: 'Choose' });
    choose.focus();
    fireEvent.click(choose);
    expect(within(panel()).getByText('Marked by Tayo Bamidele on Grill at 20:06')).toBeTruthy();
    expect(document.activeElement?.id).toBe('rout-title');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(within(alerts()).getByRole('button', { name: 'Choose' }));
  });

  it('opens the panel from the kitchen line, and goes back to it on Escape', async () => {
    await open('runOutAlert');
    fireEvent.click(within(kitchen()).getByRole('button', { name: /Chicken · Grill · Run out/ }));
    expect(panel()).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement?.getAttribute('data-run-out')).toBe('kitchen');
  });

  it('confirms a bulk choice with its count, Cancel first', async () => {
    await open('runOutPanel');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Serve Beef' }));
    const ask = screen.getByRole('alertdialog', {
      name: 'Serve Beef to 4 guests instead of Chicken?',
    });
    const names = within(ask)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual(['Cancel', 'Serve Beef']);
    fireEvent.click(within(ask).getByRole('button', { name: 'Serve Beef' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(panel()).getByText('Applies to guests still to come')).toBeTruthy();
  });

  it('shows the standing choice as a line, not a button, and the others as buttons', async () => {
    await open('runOutStands');
    const line = within(panel()).getByText('Applies to guests still to come');
    expect(line.closest('button')).toBeNull();
    expect(within(panel()).queryByRole('button', { name: 'Serve Beef' })).toBeNull();
    expect(within(panel()).getByRole('button', { name: 'Serve Grilled fish' })).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: 'Choose for Musa Bello' })).toBeTruthy();
  });

  it('confirms for guests still to come when only flagged guests wait', async () => {
    await open('runOutConfirmLater');
    expect(
      screen.getByRole('alertdialog', {
        name: 'Serve Grilled fish instead of Chicken for guests still to come?',
      }),
    ).toBeTruthy();
  });

  it('shows a conflicting item as words that can’t be chosen', async () => {
    await open('runOutChooseFor');
    const pick = screen.getByRole('dialog', { name: 'Choose for Funke Adeyemi' });
    expect(within(pick).getAllByText('Not for Funke Adeyemi · Fish allergy')).toHaveLength(2);
    expect(within(pick).queryByRole('button', { name: 'Serve Beef' })).toBeNull();
    expect(within(pick).getByRole('button', { name: 'Serve without Chicken' })).toBeTruthy();
  });

  it('refuses Choose offline, and keeps nothing', async () => {
    await open('runOutAlert');
    fireEvent.click(button('Go offline') as HTMLElement);
    fireEvent.click(within(alerts()).getByRole('button', { name: 'Choose' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getAllByText('Needs a connection to choose. Nothing is kept to send later.').length,
    ).toBeGreaterThan(0);
    expect(within(alerts()).getByText('Grill · 9 waiting for a choice')).toBeTruthy();
  });

  it('marks Chicken available again: Ready, the alert and the count gone', async () => {
    await open('runOutPanel');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Mark available again' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(alerts()).queryByText('Chicken has run out')).toBeNull();
    expect(screen.queryByText('Waiting for a choice')).toBeNull();
    expect(within(kitchen()).queryByText('Chicken · Grill · Run out')).toBeNull();
  });

  it('reads Waiting for a choice on Plan for tables 9, 12, 14 and 3', async () => {
    await open('runOutPlan');
    for (const n of [9, 12, 14, 3])
      expect(
        screen.getByRole('button', { name: new RegExp(`^Table ${n}, Waiting for a choice`) }),
      ).toBeTruthy();
  });

  it('without service.manage: no How it’s going, and a choice by link refused (403)', async () => {
    await open('runOutNoManage');
    expect(button('How it’s going')).toBeNull();
    fireEvent.click(button('Open the choice panel by link') as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getAllByText('Only the floor lead chooses what guests get instead. Nothing changed.')
        .length,
    ).toBeGreaterThan(0);
  });
});
