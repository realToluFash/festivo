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
    initialEntries: [`/demo/events/evt-wed-4/staff?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Staff' }, { timeout: 8000 });
}

const button = (name: string) => screen.queryByRole('button', { name });
const status = () => screen.getAllByRole('status').find((one) => one.classList.contains('mn-said'));

describe('/demo/events/evt-wed-4/staff (sc-3910)', () => {
  it('puts the Pass first with no Rename or Remove, and names sections with their table count', async () => {
    await open('populated');
    const places = screen.getByRole('region', { name: 'Places' });
    expect(within(places).getAllByRole('heading', { level: 3 })[0]?.textContent).toContain('Pass');
    expect(button('Rename Pass')).toBeNull();
    expect(button('Remove Pass…')).toBeNull();
    expect(button('Rename Grill')).toBeTruthy();
    expect(screen.getByText('Section A · 6 tables')).toBeTruthy();
    expect(screen.getByText('Section B · 1 table')).toBeTruthy();
    expect(screen.getByText('Section C · No tables yet')).toBeTruthy();
    expect(screen.getByText('2 people · Dishes 3 items')).toBeTruthy();
  });

  it('offers places only for Dished at, the Pass first, and joins the walking order', async () => {
    await open('populated');
    const select = screen.getByRole('combobox', { name: 'Dished at, Salad, Main' });
    const options = within(select)
      .getAllByRole('option')
      .map((one) => one.textContent);
    expect(options[0]).toBe('Pass');
    expect(options.some((one) => one?.startsWith('Section'))).toBe(false);
    fireEvent.change(select, { target: { value: 'stage' } });
    expect(status()?.textContent).toBe(
      'Salad is dished at Stage. Stage joins the walking order at stop 5.',
    );
    const walk = screen.getByRole('list', { name: 'Walking order' });
    expect(within(walk).getAllByRole('listitem').at(-1)?.textContent).toContain('Stage');
  });

  it('moves a stop, announces it, and has no Move up first nor Move down last', async () => {
    await open('populated');
    expect(button('Move up, Kitchen')).toBeNull();
    expect(button('Move down, Pastry')).toBeNull();
    fireEvent.click(button('Move up, Grill') as HTMLElement);
    expect(status()?.textContent).toBe('Grill moved to stop 2 of 4');
    expect(document.activeElement).toBe(button('Move down, Grill'));
  });

  it('reads the empty states', async () => {
    await open('courseEmpty');
    expect(screen.getByText('No dishes on this course yet.')).toBeTruthy();
  });

  it('reads a menu with no courses and a walking order of the Pass alone', async () => {
    await open('noCourses');
    expect(screen.getByText('This event’s menu has no courses yet.')).toBeTruthy();
    expect(screen.getByText('Every item is dished at the Pass.')).toBeTruthy();
  });

  it('asks before removing a place and sends its items to the Pass', async () => {
    await open('removeBoth');
    expect(
      screen.getByText(
        'Remove Grill? 2 people lose their station, and its 3 items go to the Pass.',
      ),
    ).toBeTruthy();
    fireEvent.click(button('Remove Grill') as HTMLElement);
    expect(status()?.textContent).toBe('Grill removed. 2 people have no station now.');
    expect(
      (screen.getByRole('combobox', { name: 'Dished at, Chicken, Main' }) as HTMLSelectElement)
        .value,
    ).toBe('pass');
  });

  it('refuses a blank or taken name and sends nothing', async () => {
    await open('addBlank');
    expect(screen.getByText('Enter a name for the station.')).toBeTruthy();
    const name = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Bar' } });
    fireEvent.click(button('Add place') as HTMLElement);
    expect(screen.getByText('This event already has a place called Bar.')).toBeTruthy();
    expect(document.activeElement).toBe(name);
    fireEvent.change(name, { target: { value: 'Cloakroom' } });
    fireEvent.click(button('Add place') as HTMLElement);
    expect(status()?.textContent).toBe('Cloakroom added. Nobody is on it yet.');
  });

  it('shows everything as text without staff.manage', async () => {
    await open('readOnly');
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(button('Move up, Grill')).toBeNull();
    expect(button('People and lead for Grill')).toBeNull();
    expect(button('Add a place')).toBeNull();
  });
});
