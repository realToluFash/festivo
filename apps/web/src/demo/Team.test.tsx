import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

beforeAll(() => import('./Demo.tsx'), 60000);
beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string, title = 'Team'): Promise<void> {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/team?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title }, { timeout: 8000 });
}

const button = (name: string) => screen.queryByRole('button', { name });
const panel = () => screen.queryByRole('complementary', { name: /^Move someone to/ });

describe('/demo/team (sc-36034)', () => {
  it('lists the places, sections first, with nobody shown in words', async () => {
    await open('populated');
    const kitchen = screen.getByRole('region', { name: 'Kitchen' });
    expect(within(kitchen).getByText('Pass')).toBeTruthy();
    expect(screen.getByText('Nobody on Section C')).toBeTruthy();
    expect(screen.queryByText('Door')).toBeNull();
  });

  it('offers a section to the floor only, and puts someone on it As well', async () => {
    await open('populated');
    fireEvent.click(button('Move someone to Section C') as HTMLElement);
    const sheet = panel() as HTMLElement;
    expect(within(sheet).queryByText('Ronke Alade')).toBeNull();
    expect(within(sheet).queryByText('Tolu Bello')).toBeNull();
    fireEvent.click(within(sheet).getByRole('radio', { name: /Kunle Ajayi/ }));
    expect(within(sheet).getByRole('radio', { name: 'As well' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(within(sheet).getByRole('button', { name: 'Put Kunle Ajayi on Section C' }));
    expect(panel()).toBeNull();
    expect(
      screen.getByText('Kunle Ajayi is on Section C.', { selector: '.toast-words' }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(button('Move someone to Section C'));
  });

  it('says who to choose when Put is pressed with nobody chosen', async () => {
    await open('sheetSection');
    fireEvent.click(button('Put someone on Section C') as HTMLElement);
    expect(screen.getByRole('alert').textContent).toBe('Choose who to move.');
  });

  it('offers Instead only to someone on two stations', async () => {
    await open('sheetTwo');
    const sheet = panel() as HTMLElement;
    expect(within(sheet).queryByRole('radio', { name: 'As well' })).toBeNull();
    expect(within(sheet).getAllByText(/Leaves Rice · Jollof with nobody/).length).toBeGreaterThan(
      0,
    );
  });

  it('keeps the Move controls offline, moves nothing and says why', async () => {
    await open('offline');
    expect(screen.getByText('No connection · as of 20:41')).toBeTruthy();
    fireEvent.click(button('Move someone to Section C') as HTMLElement);
    expect(panel()).toBeNull();
    expect(screen.getAllByText('Needs a connection to move anyone.').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Waiting to send/)).toBeNull();
  });

  it('refuses a beaten move and shows where they are now', async () => {
    await open('conflict');
    expect(screen.getByRole('alert').textContent).toContain('Grace Udo wasn’t moved');
    const d = screen.getByText('Section D', { selector: 'strong' }).closest('li') as HTMLElement;
    expect(within(d).getByText('Grace Udo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.activeElement).toBe(button('Move someone to Section C'));
  });

  it('opens on the place an alert names, with focus on its Move', async () => {
    await open('fromAlert');
    expect(screen.getByText('Nobody on Section A')).toBeTruthy();
    expect(document.activeElement).toBe(button('Move someone to Section A'));
  });

  it('draws one line with no places, and no Team without service.manage', async () => {
    await open('empty');
    expect(screen.getByText('No sections or kitchen stations at this event.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Sections' })).toBeNull();
  });

  it('has no Team tab without service.manage', async () => {
    await open('noManage', 'Service');
    expect(screen.queryByText('Team', { selector: 'li' })).toBeNull();
  });
});
