import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { cssRule, stylesheet } from '../test-styles.ts';

const JOBS_CSS = stylesheet(import.meta.dirname, 'jobsShifts.css');
const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/staff/jobs?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Staff' }, { timeout: 8000 });
}

const button = (name: string) => screen.queryByRole('button', { name });
const panel = () => screen.getByRole('complementary');
const status = () => screen.getAllByRole('status').find((one) => one.classList.contains('mn-said'));

describe('/demo/events/evt-wed-4/staff/jobs (sc-3908)', () => {
  it('adds the Staff tab row, Jobs and shifts current, Roster linked', async () => {
    await open('populated');
    const tabs = screen.getByRole('navigation', { name: 'Staff' });
    expect(within(tabs).getByText('Jobs and shifts').getAttribute('aria-current')).toBe('page');
    expect(within(tabs).getByRole('link', { name: 'Roster' }).getAttribute('href')).toBe(
      '/demo/events/evt-wed-4/staff/roster',
    );
  });

  it('puts Coverage first, its gaps in words, and a table for screen readers', async () => {
    await open('populated');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);
    expect(headings.indexOf('Coverage')).toBeLessThan(headings.indexOf('Jobs'));
    expect(screen.getByText('4 jobs are short at some point, 3 covered.')).toBeTruthy();
    expect(
      screen.getByText(
        'Short 1 · 17:00 to 19:00; Short 2 · 19:00 to 23:00; Short 1 · 23:00 to 00:00',
      ),
    ).toBeTruthy();
    fireEvent.click(button('Table') as HTMLElement);
    const table = screen.getByRole('table', { name: 'Coverage by job and time' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(10);
    expect(within(table).getAllByText('Short 2').length).toBeGreaterThan(0);
  });

  it('offers no Assign on a full shift, and brings it back on unassigning', async () => {
    await open('populated');
    expect(button('Assign, Floor lead, 16:00 to 01:00')).toBeNull();
    expect(screen.getAllByText(/Every place on this shift is filled/).length).toBe(5);
    fireEvent.click(button('Unassign Ifeoma Nduka') as HTMLElement);
    expect(status()?.textContent).toBe('Ifeoma Nduka unassigned. The place is open.');
    expect(button('Assign, Floor lead, 16:00 to 01:00')).toBeTruthy();
  });

  it('refuses another job and an overlap on the person’s row, and gives a person with no job the shift’s', async () => {
    await open('assign');
    fireEvent.click(screen.getByRole('button', { name: /^Tolu Bello/ }));
    expect(within(panel()).getByText('Tolu Bello works as Door on this event.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Sade Lawal/ }));
    expect(within(panel()).getByText('Sade Lawal is on Bar from 16:00 to 01:00.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Chinedu Eze/ }));
    expect(status()?.textContent).toBe(
      'Chinedu Eze is on Bar from 21:15 to 23:00. Chinedu Eze’s job is now Bar.',
    );
  });

  it('checks People needed against the people on the shift before sending', async () => {
    await open('editNeedBelow');
    const field = screen.getByLabelText('People needed');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('3 people are on this shift. Unassign some first, or keep 3 or more.'),
    ).toBeTruthy();
    expect(document.activeElement).toBe(field);
  });

  it('shows the API’s number after a 422, with the newcomer among the shift’s people', async () => {
    await open('editNeedRace');
    fireEvent.click(button('Save changes') as HTMLElement);
    expect(
      screen.getByText('2 people are on this shift. Unassign some first, or keep 2 or more.'),
    ).toBeTruthy();
    expect(within(panel()).getByText('Chinedu Eze')).toBeTruthy();
  });

  it('reads a shift across midnight as Ends on Sunday', async () => {
    await open('addShiftMidnight');
    expect(screen.getByText('Ends on Sunday at 01:00')).toBeTruthy();
  });

  it('removes a job with no shifts straight away, asks for one with shifts, refuses one with people', async () => {
    await open('populated');
    fireEvent.click(button('Remove Security') as HTMLElement);
    expect(status()?.textContent).toBe('Security removed.');
    fireEvent.click(button('Remove MC') as HTMLElement);
    expect(screen.getByRole('heading', { name: 'Remove MC and its shift?' })).toBeTruthy();
    fireEvent.click(button('Keep it') as HTMLElement);
    fireEvent.click(button('Remove Waiter') as HTMLElement);
    expect(screen.getByRole('heading', { name: 'Unassign its people first.' })).toBeTruthy();
    expect(screen.getByText('Waiter: 4 people are on its shifts.')).toBeTruthy();
  });

  it('checks a job’s name ignoring case and accents', async () => {
    await open('addJobTaken');
    expect(screen.getByText('This event already has a job called Waiter.')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('offers no change without staff.manage', async () => {
    await open('readOnly');
    expect(button('Add a job')).toBeNull();
    expect(button('Unassign Ifeoma Nduka')).toBeNull();
    expect(screen.queryByText(/Every place on this shift is filled/)).toBeNull();
    expect(screen.getAllByText(/^(\d+) of \1 places? filled$/).length).toBe(5);
  });

  it('names each start and end’s day on an event over 24 hours', async () => {
    await open('longEvent');
    expect(screen.getByText('Fri 6 Nov')).toBeTruthy();
    expect(screen.getByText('Sat 7 Nov')).toBeTruthy();
    expect(screen.getAllByText('Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'The event runs from Thu 5 Nov, 18:00 to Sat 7 Nov, 15:00. A shift may start before it or end after it.',
      ),
    ).toBeTruthy();
    fireEvent.click(button('Table') as HTMLElement);
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('Thu 5 Nov, 18:00 to 23:00').length).toBeGreaterThan(0);
  });

  it('refuses an overlap with its days on an event over 24 hours', async () => {
    await open('longEventOverlap');
    expect(
      screen.getByText('Sade Lawal is on Bar from Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00.'),
    ).toBeTruthy();
  });

  it('starts a gap line under the name in a frame too narrow for it, whole words only (sc-70959)', () => {
    expect(cssRule('.js-frame', JOBS_CSS)).toContain('container: js-frame / inline-size;');
    expect(cssRule('.js-gaps', JOBS_CSS)).toContain('overflow-wrap: normal;');
    const narrow = cssRule(
      '.js-gaps',
      JOBS_CSS.slice(JOBS_CSS.indexOf('@container js-frame (width < 29.5rem)')),
    );
    expect(narrow).toContain('grid-column: 1 / -1;');
    expect(narrow).toContain('left: 0;');
    expect(narrow).toContain('max-width: 100cqi;');
  });
});
