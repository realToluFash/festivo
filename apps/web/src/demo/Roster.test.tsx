import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { cssRule, stylesheet } from '../test-styles.ts';

const tested = config();
const ROSTER_CSS = stylesheet(import.meta.dirname, 'roster.css');

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/staff/roster?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Staff' }, { timeout: 8000 });
}

const button = (name: string) => screen.queryByRole('button', { name });
const press = (name: string) => fireEvent.click(button(name) as HTMLElement);
const live = () =>
  screen.getAllByRole('status').find((one) => one.classList.contains('visually-hidden'));
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('/demo/events/evt-wed-4/staff/roster (sc-3906)', () => {
  it('is where the Staff page opens, its first tab', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/events/evt-wed-4/staff'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole('table', { name: 'Roster' }, { timeout: 8000 });
    expect(router.state.location.pathname).toBe('/demo/events/evt-wed-4/staff/roster');
  });

  it('is a real table with headers, each name a button, each link a mark with a word', async () => {
    await open('populated');
    const table = screen.getByRole('table', { name: 'Roster' });
    const heads = within(table)
      .getAllByRole('columnheader')
      .map((one) => one.textContent);
    expect(heads).toEqual(['Name', 'Job', 'Station', 'Shift', 'Link']);
    const rows = within(table).getAllByRole('rowheader');
    expect(rows[0]?.textContent).toBe('Ada Nnaji');
    expect(rows.at(-1)?.textContent).toBe('Chinedu Eze');
    expect(within(table).getByText('Add a mobile number to send a link')).toBeTruthy();
    expect(within(table).getByText('Copied')).toBeTruthy();
    expect(within(table).getByText('Not on a shift yet')).toBeTruthy();
  });

  it('says Nobody on the staff yet, with Add a person', async () => {
    await open('empty');
    expect(screen.getByText('Nobody on the staff yet')).toBeTruthy();
    expect(button('Add a person')).toBeTruthy();
  });

  it('opens details with focus on the heading, and returns focus to the name on close', async () => {
    await open('populated');
    press('Amina Yusuf');
    const heading = screen.getByRole('heading', { level: 2, name: 'Amina Yusuf' });
    expect(document.activeElement).toBe(heading);
    expect(
      screen.getByText('Next: once you have sent them the copied link, mark it as sent.'),
    ).toBeTruthy();
    press('Close');
    expect(document.activeElement).toBe(button('Amina Yusuf'));
  });

  it('refuses a blank name with focus on Name', async () => {
    await open('populated');
    press('Add a person');
    press('Add');
    expect(screen.getByText('Enter their name.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  });

  it('warns about a shared number after Add, Cancel keeps the form, Add anyway adds', async () => {
    await open('populated');
    press('Add a person');
    type('Name', 'Funmi Bakare');
    type(/Mobile number/, '0803 111 0009');
    press('Add');
    expect(screen.getByText('Kunle Ajayi already uses this number')).toBeTruthy();
    expect(document.activeElement?.id).toBe('rs-warning');
    fireEvent.click(
      within(document.getElementById('rs-warning') as HTMLElement).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(screen.queryByText('Kunle Ajayi already uses this number')).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText(/Mobile number/));
    press('Add');
    press('Add anyway');
    expect(live()?.textContent).toBe('Funmi Bakare added to the roster.');
    expect(screen.getByRole('rowheader', { name: 'Funmi Bakare' })).toBeTruthy();
  });

  it('names the member it linked to, and the row keeps the typed name', async () => {
    await open('populated');
    press('Add a person');
    type('Name', 'Mara Obi');
    type(/Email/, 'amara.obi@ireevents.com');
    press('Add');
    expect(live()?.textContent).toBe(
      'Mara Obi added to the roster. Amara Obi is a member of Ire Events. Their shift will appear in their app.',
    );
    expect(screen.getByRole('rowheader', { name: 'Mara Obi' })).toBeTruthy();
  });

  it('Edit warns only when the number changed, with Save anyway', async () => {
    await open('edit');
    type('Name', 'Kunle A. Ajayi');
    press('Save changes');
    expect(live()?.textContent).toBe('Saved.');
    const said = live()?.firstChild;
    press('Edit');
    press('Save changes');
    expect(live()?.textContent).toBe('Saved.');
    expect(live()?.firstChild).not.toBe(said);
    press('Edit');
    type(/Mobile number/, '0803 111 0008');
    press('Save changes');
    expect(screen.getByText('Grace Udo already uses this number')).toBeTruthy();
    expect(button('Save anyway')).toBeTruthy();
  });

  it('asks before removing, Keep them goes back, Remove moves focus to the Roster heading', async () => {
    await open('details');
    press('Remove from the event');
    expect(
      screen.getByRole('heading', { name: 'Remove Amina Yusuf from the event?' }),
    ).toBeTruthy();
    expect(screen.getByText('Waiter · 17:00 to 00:00')).toBeTruthy();
    press('Keep them');
    expect(document.activeElement).toBe(button('Remove from the event'));
    press('Remove from the event');
    press('Remove from the event');
    expect(screen.queryByRole('rowheader', { name: 'Amina Yusuf' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Roster' }));
  });

  it('on a finished event keeps Edit and drops Remove', async () => {
    await open('finishedEvent');
    expect(button('Edit')).toBeTruthy();
    expect(button('Remove from the event')).toBeNull();
    expect(
      screen.getByText('Next: check the hours on Hours worked before the budget closes.'),
    ).toBeTruthy();
  });

  it('after the erasure, Edit has no Mobile or Email field and every row says so', async () => {
    await open('finishedErased');
    expect(screen.queryByLabelText(/Mobile number/)).toBeNull();
    expect(screen.queryByLabelText(/Email/)).toBeNull();
    const table = screen.getByRole('table', { name: 'Roster' });
    expect(within(table).getAllByText('Contact details removed after the event')).toHaveLength(12);
  });

  it('without staff.manage, offers no Add, Edit, Remove or station change', async () => {
    await open('readOnly');
    expect(button('Add a person')).toBeNull();
    expect(button('Edit')).toBeNull();
    expect(button('Remove from the event')).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Change station/ })).toBeNull();
  });

  it('shows the earliest shift with +1 more, and lists every shift in the details (sc-3908)', async () => {
    await open('detailsShifts');
    const table = screen.getByRole('table', { name: 'Roster' });
    expect(within(table).getByText('+1 more')).toBeTruthy();
    const details = screen.getByRole('complementary');
    expect(within(details).getByText('Door · 16:30 to 21:00')).toBeTruthy();
    expect(within(details).getByText('Door · 23:00 to 02:00')).toBeTruthy();
  });

  it('offers Shift on Add a person once a job is chosen (sc-3908)', async () => {
    await open('populated');
    press('Add a person');
    type('Job', 'Waiter');
    expect(screen.getByLabelText('Shift')).toBeTruthy();
  });

  it('Edit has Job and no Shift: shifts change on Jobs and shifts (sc-3908)', async () => {
    await open('edit');
    expect(screen.getByLabelText('Job')).toBeTruthy();
    expect(screen.queryByLabelText('Shift')).toBeNull();
  });

  it('refuses a new job while the person is on a shift (sc-3908)', async () => {
    await open('editJobOnShift');
    expect(screen.getByText('Unassign Kunle Ajayi from their shifts first.')).toBeTruthy();
    press('Save changes');
    expect(screen.getByText('Unassign Kunle Ajayi from their shifts first.')).toBeTruthy();
    expect(live()?.textContent).not.toContain('Saved.');
  });

  it('names each shift on Remove from the event (sc-3908)', async () => {
    await open('removeTwoShifts');
    const ask = screen.getByRole('complementary');
    expect(
      within(ask)
        .getAllByRole('listitem')
        .map((one) => one.textContent),
    ).toEqual(['Door · 16:30 to 21:00', 'Door · 23:00 to 02:00']);
  });

  it('names each shift’s day on an event over 24 hours (sc-3908)', async () => {
    await open('longEvent');
    const table = screen.getByRole('table');
    expect(within(table).getByText('Thu 5 Nov, 17:30 to 21:00')).toBeTruthy();
    expect(within(table).getByText('Sat 7 Nov, 10:00 to 15:00')).toBeTruthy();
    const details = screen.getByRole('complementary');
    expect(within(details).getByText('Door · Fri 6 Nov, 23:00 to Sat 7 Nov, 02:00')).toBeTruthy();
  });

  it('lists every dated shift on Remove from the event (sc-3908)', async () => {
    await open('longEventRemove');
    expect(
      within(screen.getByRole('complementary'))
        .getAllByRole('listitem')
        .map((one) => one.textContent),
    ).toEqual([
      'Door · Thu 5 Nov, 17:30 to 21:00',
      'Door · Fri 6 Nov, 16:30 to 21:00',
      'Door · Fri 6 Nov, 23:00 to Sat 7 Nov, 02:00',
    ]);
  });

  it('lets the keyboard reach the table frame, the one region named Roster, just before the first name (sc-70540)', async () => {
    await open('readOnly');
    const frame = screen.getByRole('region', { name: 'Roster' });
    expect(frame.tabIndex).toBe(0);
    expect(frame.classList.contains('rs-frame')).toBe(true);
    expect(frame.contains(screen.getByRole('table', { name: 'Roster' }))).toBe(true);
    const first = within(frame).getAllByRole('rowheader')[0]?.querySelector('button');
    const reachable = [...document.querySelectorAll<HTMLElement>('button, [tabindex="0"]')];
    expect(reachable[reachable.indexOf(frame) + 1]).toBe(first);
    expect(cssRule('.rs-frame:focus-visible', ROSTER_CSS)).toContain(
      'outline: 2px solid var(--colorAccent);',
    );
  });

  it('keeps the card heading 12rem wide below 720 px, as the product does', () => {
    expect(
      cssRule('.rs .sn-card-names', ROSTER_CSS.slice(ROSTER_CSS.indexOf('(width <= 720px)'))),
    ).toContain('flex-basis: 12rem;');
  });
});
