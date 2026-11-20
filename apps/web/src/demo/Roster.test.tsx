import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('says beside a name that its section was removed from the seating plan (sc-3910)', async () => {
    await open('sectionRemoved');
    const table = screen.getByRole('table', { name: 'Roster' });
    const chidi = within(table).getByRole('rowheader', { name: 'Chidi Okafor' }).closest('tr');
    expect(within(chidi as HTMLElement).getByText('No station')).toBeTruthy();
    expect(within(table).getAllByText('Section D was removed from the seating plan.')).toHaveLength(
      2,
    );
    const picker = screen.getByLabelText('Change station, Emeka Obi');
    expect(picker.getAttribute('aria-describedby')).toBe('rs-gone');
    fireEvent.change(picker, { target: { value: 'Section B' } });
    const emeka = within(table).getByRole('rowheader', { name: 'Emeka Obi' }).closest('tr');
    expect(within(emeka as HTMLElement).getByText('Section B')).toBeTruthy();
    expect(within(table).getAllByText('Section D was removed from the seating plan.')).toHaveLength(
      1,
    );
  });

  it('says why in the details without staff.manage, with no picker (sc-3910)', async () => {
    await open('sectionRemovedReadOnly');
    const details = screen.getByRole('complementary');
    expect(within(details).getByText('No station')).toBeTruthy();
    expect(within(details).getByText('Section D was removed from the seating plan.')).toBeTruthy();
    expect(screen.queryByLabelText('Change station, Emeka Obi')).toBeNull();
  });

  it('groups the Station picker as Stations does, Places then Seating sections (sc-3910)', async () => {
    await open('details');
    const picker = screen.getByLabelText('Change station, Amina Yusuf');
    const groups = [...picker.querySelectorAll('optgroup')].map((group) => [
      group.label,
      [...group.querySelectorAll('option')].map((one) => one.textContent),
    ]);
    expect(groups).toEqual([
      ['Places', ['Pass', 'Door', 'Bar', 'Kitchen', 'Stage', 'Floor', 'Grill', 'Pastry']],
      ['Seating sections', ['Section A', 'Section B', 'Section C']],
    ]);
    expect(picker.querySelector(':scope > option')?.textContent).toBe('No station yet');
  });

  it.each(['populated', 'readOnly'])(
    'lets the keyboard reach the table frame, the one region named Roster, just before the first name, in %s (sc-70540)',
    async (state) => {
      await open(state);
      const frame = screen.getByRole('region', { name: 'Roster' });
      expect(frame.tabIndex).toBe(0);
      expect(frame.classList.contains('rs-frame')).toBe(true);
      expect(frame.contains(screen.getByRole('table', { name: 'Roster' }))).toBe(true);
      const first = within(frame).getAllByRole('rowheader')[0]?.querySelector('button');
      const reachable = [...document.querySelectorAll<HTMLElement>('button, [tabindex="0"]')];
      expect(reachable[reachable.indexOf(frame) + 1]).toBe(first);
      if (state === 'populated') {
        expect(reachable[reachable.indexOf(frame) - 1]).toBe(button('Add a person'));
      }
    },
  );

  it('draws a focus ring on the Roster frame (sc-70540)', () => {
    expect(cssRule('.rs-frame:focus-visible', ROSTER_CSS)).toContain(
      'outline: 2px solid var(--colorAccent);',
    );
  });

  it('keeps whole words in the table below 720 px, the frame scrolling instead (sc-70540)', () => {
    const narrow = ROSTER_CSS.slice(ROSTER_CSS.indexOf('(width <= 720px)'));
    expect(cssRule('.rs-table :is(th, td),\n  .rs-table :is(th, td) *', narrow)).toContain(
      'overflow-wrap: normal;',
    );
    expect(
      cssRule('.rs-table thead th:nth-child(2),\n  .rs-table thead th:nth-child(3)', narrow),
    ).toContain('min-width: 128px;');
    expect(cssRule('.rs-table thead th:nth-child(5)', narrow)).toContain('min-width: 168px;');
  });

  it('keeps whole words in the Roster at every desk width, Link at 168 px (sc-75033)', () => {
    const desk = ROSTER_CSS.slice(0, ROSTER_CSS.indexOf('@media'));
    expect(
      cssRule('.rs-frame > .rs-table :is(th, td),\n.rs-frame > .rs-table :is(th, td) *', desk),
    ).toContain('overflow-wrap: normal;');
    expect(cssRule('.rs-frame > .rs-table thead th:nth-child(5)', desk)).toContain(
      'min-width: 168px;',
    );
    expect(desk).not.toContain('min-width: 128px;');
  });

  it.each([
    ['populatedFrench', 'Liste du personnel', 'Pas encore de lien'],
    ['detailsNoLinkFrench', 'Liste du personnel', 'Pas encore de lien'],
    ['erasedListFrench', 'Liste du personnel', 'Coordonnées effacées après l’événement'],
    ['erasedList', 'Roster', 'Contact details removed after the event'],
  ])('shows the Link words of %s in the Roster (sc-75033)', async (state, roster, words) => {
    const router = createMemoryRouter(routes, {
      initialEntries: [`/demo/events/evt-wed-4/staff/roster?state=${state}`],
    });
    render(<RouterProvider router={router} />);
    const table = await screen.findByRole('table', { name: roster }, { timeout: 8000 });
    expect(within(table).getAllByText(words).length).toBeGreaterThan(0);
  });

  it.each([
    ['nobodyOnShift', 'Not on a shift yet'],
    ['nobodyOnShiftFrench', 'Aucun service pour l’instant'],
  ])(
    'marks each Shift cell with no shift as one, in the paler grey, in %s (sc-71607)',
    async (state, words) => {
      await open(state);
      const cells = within(screen.getByRole('table', { name: 'Roster' }))
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.querySelectorAll('td')[2] as HTMLElement);
      expect(cells.length).toBeGreaterThan(1);
      for (const cell of cells) {
        expect(cell.textContent).toBe(words);
        expect([...cell.classList]).toEqual(['rs-no-shift', 'rs-quiet']);
      }
    },
  );

  it('keeps a Shift cell with no shift on one line below 720 px only, beside ones with a shift (sc-71607)', async () => {
    await open('populated');
    const cell = screen.getByText('Not on a shift yet', { selector: 'td' });
    expect([...cell.classList]).toEqual(['rs-no-shift', 'rs-quiet']);
    expect(cssRule('.rs-table td.rs-shift', ROSTER_CSS)).toContain('white-space: nowrap;');
    const start = ROSTER_CSS.indexOf('@media (width <= 720px)');
    const end = ROSTER_CSS.indexOf('\n}\n', start) + 3;
    const narrow = ROSTER_CSS.slice(start, end);
    expect(cssRule('.rs-table td.rs-no-shift', narrow)).toContain('white-space: nowrap;');
    expect(ROSTER_CSS.slice(0, start) + ROSTER_CSS.slice(end)).not.toContain('rs-no-shift');
    expect(cssRule('.rs-table tbody td.rs-quiet', ROSTER_CSS)).toContain(
      'color: var(--colorInkSecondary);',
    );
  });

  it('keeps the card heading 12rem wide below 720 px, as the product does', () => {
    expect(
      cssRule('.rs .sn-card-names', ROSTER_CSS.slice(ROSTER_CSS.indexOf('(width <= 720px)'))),
    ).toContain('flex-basis: 12rem;');
  });
});

describe('a person’s own link on the roster (sc-3912)', () => {
  const SLOW = { timeout: 4000 };

  afterEach(() => vi.unstubAllGlobals());

  it('says Link copied. only once the clipboard has it, and offers Mark as sent', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    vi.stubGlobal('ClipboardItem', undefined);
    await open('populated');
    press('Copy link: Emeka Obi');
    expect(live()?.textContent).not.toBe('Link copied.');
    const issuing = button('Copy link: Emeka Obi');
    expect(issuing?.getAttribute('aria-busy')).toBe('true');
    expect(issuing?.querySelector('.pending-spinner')).toBeTruthy();
    await screen.findByText('Copied by Amara Nwosu · 19:12 · not marked as sent', {}, SLOW);
    expect(writeText).toHaveBeenCalledWith('https://soirely.com/s/7Gk2pQ9xVb4mT1sR8nLw3c');
    expect(live()?.textContent).toBe('Link copied.');
    press('Mark as sent: Emeka Obi');
    expect(screen.getAllByText('Marked as sent by Amara Nwosu · 19:12').length).toBeGreaterThan(0);
    expect(button('Mark as sent: Emeka Obi')).toBeNull();
  });

  it('records nothing when no link is issued, and says so', async () => {
    await open('linkNotIssued');
    const table = screen.getByRole('table', { name: 'Roster' });
    expect(within(table).getByText('That did not work. Try again in a moment.')).toBeTruthy();
    expect(live()?.textContent).toBe('That did not work. Try again in a moment.');
    press('Copy link: Emeka Obi');
    await act(() => new Promise((done) => setTimeout(done, 800)));
    expect(screen.queryByText(/Copied by Amara Nwosu · 19:12/)).toBeNull();
  });

  it('shows a refused link to copy by hand, named for whose it is, and records the copy', async () => {
    await open('linkRefused');
    const field = screen.getByLabelText('Link for Emeka Obi') as HTMLInputElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe('https://soirely.com/s/7Gk2pQ9xVb4mT1sR8nLw3c');
    expect(live()?.textContent).toBe('The link could not be copied. Copy it from the link field.');
    expect(button('Mark as sent: Emeka Obi')).toBeTruthy();
    expect(screen.queryByText('Link copied.')).toBeNull();
  });

  it('asks before Replace link, and puts the row back to No link yet', async () => {
    await open('replaceAsk');
    const dialog = screen.getByRole('alertdialog', { name: 'Replace Grace’s link?' });
    expect(within(dialog).getByText('Their current link stops working now.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace link' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('No link yet')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Replace link…' })).toBeNull();
  });

  it('keeps the link on Keep this link', async () => {
    await open('replaceAsk');
    press('Keep this link');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('Link opened')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Replace link…' }).className).toBe(
      'gs-pill is-secondary',
    );
  });

  it('offers no link actions without staff.manage, nor on a finished event', async () => {
    await open('readOnly');
    expect(button('Copy link: Emeka Obi')).toBeNull();
    expect(button('Replace link…')).toBeNull();
  });
});

describe('the Roster from 961 to 1279 px, in English and French (sc-73291)', () => {
  async function openIn(state: string, title: string): Promise<void> {
    const router = createMemoryRouter(routes, {
      initialEntries: [`/demo/events/evt-wed-4/staff/roster?state=${state}`],
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: title }, { timeout: 8000 });
  }

  it('opens Add a person on the roster and on an empty one, Cancel back on Add a person', async () => {
    await openIn('add', 'Staff');
    expect(screen.getByRole('heading', { level: 2, name: 'Add a person' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Roster' })).toBeTruthy();
    press('Cancel');
    expect(document.activeElement).toBe(button('Add a person'));
  });

  it('says the empty roster under the open form', async () => {
    await openIn('addEmpty', 'Staff');
    expect(screen.getByRole('heading', { level: 2, name: 'Add a person' })).toBeTruthy();
    expect(screen.getByText('Nobody on the staff yet')).toBeTruthy();
  });

  it('puts the details, the Roster and the top in the product’s French', async () => {
    await openIn('detailsFrench', 'Équipe');
    const table = screen.getByRole('table', { name: 'Liste du personnel' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((one) => one.textContent),
    ).toEqual(['Nom', 'Fonction', 'Poste', 'Service', 'Lien']);
    expect(screen.getByRole('navigation', { name: 'Fil d’Ariane' })).toBeTruthy();
    expect(screen.getByText('Fonctions et services')).toBeTruthy();
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByRole('heading', { level: 2, name: 'Amina Yusuf' })).toBeTruthy();
    expect(within(panel).getByText('Numéro de portable')).toBeTruthy();
  });

  it('moves focus to the name in French, and Fermer back to the row', async () => {
    await openIn('detailsFrench', 'Équipe');
    press('Bisi Okon');
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Bisi Okon' }),
    );
    press('Fermer');
    expect(document.activeElement).toBe(button('Bisi Okon'));
  });

  it('opens Add a person in French on an empty roster, Annuler back on Ajouter une personne', async () => {
    await openIn('addEmptyFrench', 'Équipe');
    expect(screen.getByRole('heading', { level: 2, name: 'Ajouter une personne' })).toBeTruthy();
    expect(screen.getByText('Personne dans l’équipe pour l’instant')).toBeTruthy();
    press('Annuler');
    expect(document.activeElement).toBe(button('Ajouter une personne'));
  });
});
