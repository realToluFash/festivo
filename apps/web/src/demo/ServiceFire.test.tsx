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
    initialEntries: [`/demo/service-fire?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Service' }, { timeout: 8000 });
}

const button = (name: string | RegExp) => screen.queryByRole('button', { name });
const dialog = () => screen.getByRole('dialog');

describe('/demo/service-fire (sc-4009)', () => {
  it('starts service from the header, and then offers Fire and Next course', async () => {
    await open('notStarted');
    expect(screen.getByText('Service hasn’t started')).toBeTruthy();
    fireEvent.click(button('Start service')!);
    expect(screen.getByText('Service · Starter · course 1 of 4 since 20:24')).toBeTruthy();
    expect(button('Fire starter')).toBeTruthy();
    expect(button('Next course')).toBeTruthy();
  });

  it('offers no button without a menu', async () => {
    await open('noMenu');
    expect(screen.getByText('Add a menu to start service')).toBeTruthy();
    expect(button('Start service')).toBeNull();
  });

  it('fires at the tables still to fire, and reads the refused table out', async () => {
    await open('fireAll');
    const fire = within(dialog()).getByRole('button', { name: 'Fire mains at 3 tables' });
    fireEvent.click(fire);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Mains fired at 3 tables.')).toBeTruthy();
    expect(screen.getByText('Table 14 was not fired: no one is seated there.')).toBeTruthy();
  });

  it('counts a section on its own', async () => {
    await open('fireAll');
    fireEvent.click(within(dialog()).getByLabelText(/Section C/));
    expect(within(dialog()).getByRole('button', { name: 'Fire mains at 2 tables' })).toBeTruthy();
  });

  it('sends nothing with nothing ticked, and moves focus to the first table it can tick', async () => {
    await open('fireChoose');
    const locked = within(dialog()).getByRole('checkbox', {
      name: /^Table 1(?!\d)/,
    }) as HTMLInputElement;
    expect(locked.checked).toBe(true);
    fireEvent.click(locked);
    expect(locked.checked).toBe(true);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Fire mains at 0 tables' }));
    expect(
      within(dialog()).getByText('Choose at least one table. Nothing was fired.'),
    ).toBeTruthy();
    expect(document.activeElement?.id).toBe('sf-t-Table-12');
  });

  it('fires a later course and moves the room on', async () => {
    await open('fireLater');
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Fire dessert at/ }));
    expect(screen.getByText('Service · Dessert · course 3 of 4 since 20:24')).toBeTruthy();
  });

  it('suggests the next course, and Not yet hides it with a line saying when', async () => {
    await open('suggestion');
    expect(screen.getByRole('heading', { name: '8 of 10 tables served mains' })).toBeTruthy();
    fireEvent.click(button('Not yet')!);
    expect(screen.queryByRole('heading', { name: '8 of 10 tables served mains' })).toBeNull();
    expect(screen.getByText('The dessert suggestion comes back at 20:29.')).toBeTruthy();
  });

  it('hides the suggestion once its threshold is raised past the share served', async () => {
    await open('thresholds');
    fireEvent.click(button('Raise dessert’s threshold')!);
    expect(screen.queryByRole('heading', { name: '8 of 10 tables served mains' })).toBeNull();
    fireEvent.click(button('Lower dessert’s threshold')!);
    expect(screen.getByRole('heading', { name: '8 of 10 tables served mains' })).toBeTruthy();
  });

  it('opens the fire choice on dessert from the run of show’s prompt, and keeps the prompt until a fire', async () => {
    await open('prompt');
    fireEvent.click(button('Fire dessert now')!);
    expect(within(dialog()).getByRole('heading', { name: 'Fire dessert' })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Don’t fire' }));
    expect(screen.getByText('Speeches has started. Fire dessert?')).toBeTruthy();
  });

  it('dismisses the prompt for good with Not now, and holds the dessert suggestion back too', async () => {
    await open('prompt');
    fireEvent.click(button('Not now')!);
    expect(screen.queryByText('Speeches has started. Fire dessert?')).toBeNull();
    expect(screen.getByText('The dessert suggestion comes back at 20:29.')).toBeTruthy();
  });

  it('confirms the next course, and ends service from the last one', async () => {
    await open('nextConfirm');
    expect(within(dialog()).getByText('Tables still on mains keep their orders.')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Move to dessert' }));
    expect(screen.getByText('Service · Dessert · course 3 of 4 since 20:24')).toBeTruthy();
  });

  it('ends service and leaves no control', async () => {
    await open('endConfirm');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'End service' }));
    expect(screen.getByText('Service has ended')).toBeTruthy();
    expect(button(/^Fire/)).toBeNull();
    expect(button('Next course')).toBeNull();
  });

  it('keeps every control drawn and disabled offline, and queues nothing', async () => {
    await open('offline');
    const fire = button('Fire mains')!;
    expect(fire.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(fire);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getAllByText('Firing, the next course and ending service need a connection.').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Speeches has started. Fire dessert?')).toBeNull();
  });

  it('says starting service needs a connection, offline before start', async () => {
    await open('offlineBefore');
    expect(button('Start service')!.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Starting service needs a connection.')).toBeTruthy();
  });

  it('shows only the service line without service.manage', async () => {
    await open('noManage');
    expect(screen.getByText('Service · Mains · course 2 of 4 since 20:10')).toBeTruthy();
    expect(button(/^Fire/)).toBeNull();
    expect(button('Next course')).toBeNull();
  });
});
