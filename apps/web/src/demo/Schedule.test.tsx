import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 20000 };

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string, extra = ''): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/schedule?state=${state}${extra}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: /^Schedule · / }, { timeout: 8000 });
}

const button = (name: string) => screen.queryByRole('button', { name });
const said = () => screen.getAllByRole('status').find((one) => one.classList.contains('mn-said'));

describe('/demo/events/evt-wed-4/schedule (sc-3893)', () => {
  it('shows the day’s tabs and a table per place, Main first', SLOW, async () => {
    await open('populated');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Schedule · Fri 6 Nov');
    const tabs = within(screen.getByRole('tablist', { name: 'Days' })).getAllByRole('tab');
    expect(tabs.map((one) => one.textContent)).toEqual([
      'Thu 5 Nov · 2 items',
      'Fri 6 Nov · 10 items',
      'Sat 7 Nov · 0 items',
    ]);
    const tables = screen.getAllByRole('table');
    expect(tables.map((one) => one.getAttribute('aria-labelledby'))).toEqual([
      'ro-place-main',
      'ro-place-garden',
      'ro-place-ballroom',
    ]);
    const heads = within(tables[0] as HTMLElement)
      .getAllByRole('columnheader')
      .map((one) => one.textContent);
    expect(heads).toEqual(['Starts', 'Lasts', 'Item', 'Owner']);
    expect(screen.getByText('Sat 00:30')).toBeTruthy();
  });

  it('shows Nothing scheduled yet on a day with no items, with Add item', SLOW, async () => {
    await open('populated');
    fireEvent.click(screen.getByRole('tab', { name: 'Sat 7 Nov · 0 items' }));
    expect(screen.getByRole('heading', { name: 'Nothing scheduled yet' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add item' })).toHaveLength(2);
  });

  it(
    'refuses a blank form beside each field, focus on Title, and saves nothing',
    SLOW,
    async () => {
      await open('populated');
      fireEvent.click(button('Add item') as HTMLElement);
      fireEvent.click(button('Save item') as HTMLElement);
      expect(document.activeElement?.id).toBe('ro-title');
      expect(screen.getByText('Enter a title.')).toBeTruthy();
      expect(screen.getByText('Choose the date and time it starts.')).toBeTruthy();
      expect(screen.getAllByRole('tab')[1]?.textContent).toBe('Fri 6 Nov · 10 items');
    },
  );

  it('adds an item after midnight to the day before', SLOW, async () => {
    await open('populated');
    fireEvent.click(button('Add item') as HTMLElement);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Carriages' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-07' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '01:30' } });
    fireEvent.click(button('Save item') as HTMLElement);
    expect(said()?.textContent).toBe('Carriages added.');
    expect(screen.getAllByRole('tab')[1]?.textContent).toBe('Fri 6 Nov · 11 items');
    expect(document.activeElement?.textContent).toBe('Carriages');
  });

  it(
    'refuses a start outside the event with the window’s sentence, focus on Date',
    SLOW,
    async () => {
      await open('startOutside');
      expect(document.activeElement?.id).toBe('ro-date');
      expect(
        screen.getByText('Choose a time between Thu 5 Nov, 06:00 and Sat 7 Nov, 15:00.').className,
      ).toBe('desk-error');
    },
  );

  it('says what a changed place does, and a new place', SLOW, async () => {
    await open('placeMoved');
    expect(screen.getByText('[It moves to Garden’s table and keeps its start.]')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: /^Place/ }), {
      target: { value: 'Terrace' },
    });
    expect(screen.getByText('A new place. Terrace gets its own table on this day.')).toBeTruthy();
  });

  it('holds 200 items: the notice, focus on it, nothing saved', SLOW, async () => {
    await open('atLimit');
    fireEvent.click(button('Save item') as HTMLElement);
    const notice = screen.getByRole('alert');
    expect(notice.textContent).toContain('This schedule has 200 items');
    expect(document.activeElement).toBe(notice);
    expect(screen.getAllByRole('tab')[1]?.textContent).toBe('Fri 6 Nov · 198 items');
  });

  it(
    'checks the form before Keep mine saves it, focus on the first wrong field',
    SLOW,
    async () => {
      await open('conflict');
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });
      fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Keep mine' }));
      expect(document.activeElement?.id).toBe('ro-title');
      expect(screen.getByText('Enter a title.')).toBeTruthy();
      expect(said()?.textContent).toBe('');
      expect(screen.getByRole('alert')).toBeTruthy();
    },
  );

  it('files a place typed in another case under the day’s table', SLOW, async () => {
    await open('populated');
    fireEvent.click(button('Add item') as HTMLElement);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Lawn games' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '16:00' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Place/ }), {
      target: { value: 'garden' },
    });
    expect(screen.queryByText(/^A new place\./)).toBeNull();
    fireEvent.click(button('Save item') as HTMLElement);
    expect(screen.getAllByRole('table')).toHaveLength(3);
  });

  it('offers Theirs and Yours on a 412, and Use theirs refills the form', SLOW, async () => {
    await open('conflict');
    const notice = screen.getByRole('alert');
    const rows = within(notice)
      .getAllByRole('rowheader')
      .map((one) => one.textContent);
    expect(rows).toEqual(['Title', 'Starts', 'Owner', 'Role']);
    fireEvent.click(within(notice).getByRole('button', { name: 'Use theirs' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByLabelText(/^Owner/) as HTMLInputElement).value).toBe('Tunde Bakare');
  });

  it('asks before deleting, then gives Undo, which puts it back', SLOW, async () => {
    await open('editing');
    fireEvent.click(button('Delete item…') as HTMLElement);
    expect(screen.getByText('Delete Speeches?')).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Keep it');
    fireEvent.click(button('Delete item') as HTMLElement);
    expect(screen.queryByRole('button', { name: 'Speeches' })).toBeNull();
    expect(screen.getByText('Speeches deleted.')).toBeTruthy();
    fireEvent.click(button('Undo') as HTMLElement);
    expect(screen.getByRole('button', { name: 'Speeches' })).toBeTruthy();
    expect(said()?.textContent).toBe('Speeches is back.');
  });

  it('is read only without run_of_show.manage', SLOW, async () => {
    await open('readOnly');
    expect(button('Add item')).toBeNull();
    expect(button('Speeches')).toBeNull();
    expect(
      screen.getByText('You can see this schedule. Ask whoever runs the event to change it.'),
    ).toBeTruthy();
  });

  it('picks a place by its name and count', SLOW, async () => {
    await open('placePicker');
    expect(button('Place: Main')?.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Ballroom/ }));
    expect(button('Place: Ballroom')).toBeTruthy();
  });

  it('writes times as the reader’s locale does, and names the zone when away', SLOW, async () => {
    await open('populated', '&locale=en-US&zone=away');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Schedule · Fri, Nov 6');
    expect(screen.getByText(/^10 items · 13:30 to 01:00 · 3 places · ./)).toBeTruthy();
  });
});
