import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { cssRule, stylesheet } from '../test-styles.ts';

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

  it('keeps what was entered when a save fails, and Save item tries again', SLOW, async () => {
    await open('saveFailed');
    const notice = screen.getByRole('alert');
    expect(notice.textContent).toBe('Not saved. What you entered is still here. Try again.');
    expect(document.activeElement).toBe(notice);
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Speeches and toasts');
    fireEvent.click(button('Save item') as HTMLElement);
    expect(said()?.textContent).toBe('Speeches and toasts saved.');
  });

  it('leaves the item in place when a delete fails', SLOW, async () => {
    await open('deleteFailed');
    expect(document.activeElement?.textContent).toBe(
      'Not deleted. Nothing was changed. Try again.',
    );
    expect(screen.getByRole('button', { name: 'Speeches' })).toBeTruthy();
    fireEvent.click(button('Delete item…') as HTMLElement);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says when Undo fails, with no toast left to press', SLOW, async () => {
    await open('undoFailed');
    const line = screen.getByRole('alert');
    expect(line.textContent).toBe('Speeches was not brought back. Add it again with Add item.');
    expect(document.activeElement).toBe(line);
    expect(button('Undo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Speeches' })).toBeNull();
    fireEvent.click(button('Add item') as HTMLElement);
    expect(button('Undo')).toBeNull();
    expect(screen.queryByText('Speeches deleted.')).toBeNull();
    expect(
      screen.getByText('Speeches was not brought back. Add it again with Add item.'),
    ).toBeTruthy();
  });

  it('offers Add it again when someone else deleted the item', SLOW, async () => {
    await open('gone');
    expect(screen.getByRole('heading', { name: 'Edit item' })).toBeTruthy();
    expect(document.activeElement?.textContent).toContain('Someone else deleted this item');
    expect(button('Delete item…')).toBeNull();
    fireEvent.click(button('Cancel') as HTMLElement);
    expect(document.activeElement?.id).toBe('ro-add');
  });

  it('adds the item again when someone else deleted it', SLOW, async () => {
    await open('gone');
    fireEvent.click(button('Add it again') as HTMLElement);
    expect(said()?.textContent).toBe('Speeches and toasts added.');
    expect(screen.getByRole('button', { name: 'Speeches and toasts' })).toBeTruthy();
  });

  it('is read only without run_of_show.manage', SLOW, async () => {
    await open('readOnly');
    expect(button('Add item')).toBeNull();
    expect(button('Speeches')).toBeNull();
    expect(
      screen.getByText('You can see this schedule. Ask whoever runs the event to change it.'),
    ).toBeTruthy();
  });

  it('opens the run view from its header, as a reader when it is read only', SLOW, async () => {
    await open('readOnly');
    expect(screen.getByRole('link', { name: 'Run view' }).getAttribute('href')).toBe(
      '/demo/events/evt-wed-4/run?as=reader',
    );
  });

  it('leaves the run view out of an empty schedule', SLOW, async () => {
    await open('empty');
    expect(screen.queryByRole('link', { name: 'Run view' })).toBeNull();
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

  it(
    'draws seven day tabs whose counts read in the reader’s language (sc-64803)',
    SLOW,
    async () => {
      await open('sevenDays', '&locale=fr-FR');
      const tabs = within(screen.getByRole('tablist', { name: 'Days' })).getAllByRole('tab');
      expect(tabs).toHaveLength(7);
      expect(tabs[2]?.textContent).toMatch(/· 1 élément$/);
      expect(tabs[3]?.textContent).toMatch(/· 12 éléments$/);
      fireEvent.keyDown(tabs[0] as HTMLElement, { key: 'ArrowLeft' });
      expect(tabs[6]?.getAttribute('aria-selected')).toBe('true');
    },
  );
});

describe('Course on the item form (sc-3898)', () => {
  it('lists the menu’s courses in order, each with its served time and holder', SLOW, async () => {
    await open('coursePicker');
    const list = document.getElementById('ro-course-list') as HTMLElement;
    const rows = within(list)
      .getAllByRole('button')
      .filter((one) => one.classList.contains('ro-course-row'))
      .map((one) => one.textContent);
    expect(rows).toEqual([
      'No course',
      'Starter served 17:30 · linked to Dinner',
      'Main served 19:50 · linked to Mains go out',
      'Dessert served 21:30',
      'Late-night bites',
    ]);
    expect(document.activeElement?.id).toBe('ro-course-first');
  });

  it('asks before moving a link, and Keep it leaves it where it was', SLOW, async () => {
    await open('coursePicker');
    fireEvent.click(screen.getByRole('button', { name: /^Main served/ }));
    expect(screen.getByText('Main is linked to Mains go out.')).toBeTruthy();
    expect(document.activeElement?.id).toBe('ro-move-cancel');
    fireEvent.click(screen.getByRole('button', { name: 'Keep it on Mains go out' }));
    expect(screen.queryByText('Main is linked to Mains go out.')).toBeNull();
    expect(document.getElementById('ro-course')?.textContent).toBe('No course');
  });

  it('moves the link on Save: the row shows Main, Mains go out loses it', SLOW, async () => {
    await open('courseMove');
    fireEvent.click(screen.getByRole('button', { name: 'Move the link' }));
    expect(screen.getByText('Mains go out loses this course when you save.')).toBeTruthy();
    fireEvent.click(button('Save item') as HTMLElement);
    const late = document.getElementById('ro-open-late')?.closest('tr') as HTMLElement;
    const mains = document.getElementById('ro-open-mains')?.closest('tr') as HTMLElement;
    expect(within(late).getByText('Course · Main')).toBeTruthy();
    expect(within(mains).queryByText(/^Course · /)).toBeNull();
  });

  it('points to the Menu page when the menu has no courses', SLOW, async () => {
    await open('courseNone');
    expect(screen.getByText('No courses on the menu yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the menu' }).getAttribute('href')).toBe(
      '/demo/events/evt-wed-4/menu',
    );
  });

  it(
    'offers no Course field without menu.read, and the rest of the form as before',
    SLOW,
    async () => {
      await open('courseRefused');
      expect(document.getElementById('ro-course')).toBeNull();
      expect(screen.getByRole('textbox', { name: /Title/ })).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Fixed time' })).toBeTruthy();
    },
  );

  it('says an item lost its course when the course left the menu', SLOW, async () => {
    await open('courseUnlinked');
    expect(screen.getByText('Mains go out is no longer linked to a course.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Mains go out is no longer linked to a course.')).toBeNull();
  });

  it('ends the unlinked notice on a save from that item’s form', SLOW, async () => {
    await open('courseUnlinked');
    fireEvent.click(document.getElementById('ro-open-mains') as HTMLElement);
    fireEvent.click(button('Save item') as HTMLElement);
    expect(screen.queryByText('Mains go out is no longer linked to a course.')).toBeNull();
  });

  it('ends the unlinked notice when that item is deleted', SLOW, async () => {
    await open('courseUnlinked');
    fireEvent.click(document.getElementById('ro-open-mains') as HTMLElement);
    fireEvent.click(button('Delete item…') as HTMLElement);
    fireEvent.click(button('Delete item') as HTMLElement);
    expect(screen.queryByText('Mains go out is no longer linked to a course.')).toBeNull();
  });

  it("holds a long course pill inside the Item column, as the desk's schedule does (sc-3898)", () => {
    expect(cssRule('.ro-course', stylesheet(import.meta.dirname, 'schedule.css'))).toContain(
      'max-width: min(18rem, var(--roWordCap, 100%));',
    );
  });
});
