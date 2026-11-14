import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function guests(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/guests?state=${state}`] });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function column(): HTMLElement {
  return screen.getByRole('main').querySelector<HTMLElement>('.gs-column') as HTMLElement;
}

function chips(): HTMLElement {
  return screen.getByRole('group', { name: 'Groups' });
}

function groupRows(): string[] {
  return within(within(column()).getByRole('list', { name: 'Groups' }))
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.desk-row-name')?.textContent ?? '');
}

function newGroup(): HTMLInputElement {
  return within(column()).getByRole('textbox', { name: 'New group' });
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('Groups on the list and the guest (sc-3775)', () => {
  it('shows a chip per group, then No group, and the group on each guest’s row', SLOW, async () => {
    await guests('groups');

    expect(
      within(chips())
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Bride’s side', 'Groom’s side', 'Old school friends', 'Work', 'No group']);
    expect(
      screen.getByRole('link', { name: /^Alhaji Musa Bello, .*Group: Bride’s side$/u }),
    ).toBeDefined();
  });

  it('narrows to a group and its companions, and Clear lets it go', SLOW, async () => {
    await guests('groups');
    fireEvent.click(within(chips()).getByRole('button', { name: 'Work' }));

    expect(within(chips()).getByRole('button', { name: 'Work' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const rows = screen.getAllByRole('link', { name: /Group: Work$/u });

    expect(rows.map((one) => one.getAttribute('aria-label')?.split(',')[0])).toEqual([
      'Camille Dubois',
      'Inês Duarte',
      'Sophie Laurent',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(within(chips()).getByRole('button', { name: 'Work' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('No group shows only guests without one', SLOW, async () => {
    await guests('groupsNoGroup');

    expect(screen.queryAllByRole('link', { name: /Group: /u })).toHaveLength(0);
    expect(screen.getByRole('link', { name: /^Bisi Adewale/u })).toBeDefined();
  });

  it(
    'puts the group beside the name in the details, and nothing for a guest with none',
    SLOW,
    async () => {
      await guests('groupsGuest');
      expect(within(column()).getByText('Bride’s side')).toBeDefined();

      cleanup();
      await guests('groupsGuestNone');
      expect(column().querySelector('.gg-pill')).toBeNull();
    },
  );
});

describe('the Group field (sc-3775)', () => {
  it(
    'is a combobox: typing lists the groups that hold it, and choosing sets it',
    SLOW,
    async () => {
      await guests('groupField');
      const field = within(column()).getByRole('combobox', { name: /Group/u });

      expect((field as HTMLInputElement).value).toBe('Bride’s side');
      fireEvent.change(field, { target: { value: 'gro' } });
      const list = within(column()).getByRole('listbox', { name: 'Groups on this event' });

      expect(
        within(list)
          .getAllByRole('option')
          .map((one) => one.textContent),
      ).toEqual(['Groom’s side', 'Create “gro”']);
      fireEvent.click(within(list).getByRole('option', { name: 'Groom’s side' }));
      expect((field as HTMLInputElement).value).toBe('Groom’s side');
      expect(within(column()).queryByRole('listbox')).toBeNull();
    },
  );

  it('Create makes the group as the guest is saved, and the list shows it', SLOW, async () => {
    await guests('groupFieldCreate');
    fireEvent.click(within(column()).getByRole('option', { name: 'Create “Cousins”' }));
    expect(
      within(column()).getByText('Cousins is a new group. It’s made when you save.'),
    ).toBeDefined();
    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    await waitFor(
      () =>
        expect(
          screen.getByRole('link', { name: /^Dr Emeka Nwosu.*Group: Cousins$/u }),
        ).toBeDefined(),
      WAIT,
    );
    expect(within(chips()).getByRole('button', { name: 'Cousins' })).toBeDefined();
  });

  it(
    'refuses a new name over 60 and a 51st group beside the field, saving nothing',
    SLOW,
    async () => {
      await guests('groupFieldLong');
      const field = within(column()).getByRole('combobox', { name: /Group/u });

      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(column().textContent).toContain('A group name can be up to 60 characters.');

      cleanup();
      await guests('groupFieldLimit');
      expect(column().textContent).toContain(
        'This event has 50 groups, the most it can have. Choose one of them, or delete one in Groups to make another.',
      );
    },
  );
});

describe('Groups: make, rename, delete (sc-3775)', () => {
  it('lists each group with its people, No group last, adding up to everyone', SLOW, async () => {
    await guests('groupsPane');

    expect(groupRows()).toEqual([
      'Bride’s side',
      'Groom’s side',
      'Old school friends',
      'Work',
      'No group',
    ]);
    expect(column().textContent).toContain('The groups and No group add up to');
    expect(within(column()).getByRole('button', { name: 'Rename Work' })).toBeDefined();
  });

  it(
    'New group refuses a blank press with focus kept, then creates and keeps the field for the next',
    SLOW,
    async () => {
      await guests('groupsPane');
      fireEvent.click(within(column()).getByRole('button', { name: 'Create group' }));

      expect(column().textContent).toContain('Enter a name for the group.');
      expect(newGroup().getAttribute('aria-invalid')).toBe('true');
      fireEvent.change(newGroup(), { target: { value: 'Cousins' } });
      expect(column().textContent).not.toContain('Enter a name for the group.');
      fireEvent.submit(newGroup());

      expect(within(column()).getByRole('status').textContent).toBe('Cousins created.');
      expect(newGroup().value).toBe('');
      expect(groupRows()).toContain('Cousins');
      expect(column().textContent).toContain('0 people · 0 guests and no companions');
      await waitFor(() => expect(document.activeElement).toBe(newGroup()), WAIT);
    },
  );

  it('refuses a used name, naming the group as it is spelt, and at 50 groups', SLOW, async () => {
    await guests('groupsNewTaken');
    expect(column().textContent).toContain('There’s already a group called Work.');

    cleanup();
    await guests('groupsNewLimit');
    expect(column().textContent).toContain(
      'This event has 50 groups, the most it can have. Delete one to make another.',
    );
  });

  it('renames in place, everywhere at once, and refuses a name taken', SLOW, async () => {
    await guests('groupsRenameTaken');
    expect(column().textContent).toContain('There’s already a group called Bride’s side.');

    const field = within(column()).getByRole('textbox', { name: 'New name for Work' });

    fireEvent.change(field, { target: { value: 'Colleagues' } });
    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    expect(within(column()).getByRole('status').textContent).toBe('Renamed to Colleagues.');
    fireEvent.click(within(chips()).getByRole('button', { name: 'Colleagues' }));
    expect(
      screen.getByRole('link', { name: /^Sophie Laurent.*Group: Colleagues$/u }),
    ).toBeDefined();
  });

  it(
    'asks before deleting, names the guests in it, and leaves them with no group',
    SLOW,
    async () => {
      await guests('groupsDelete');
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete Work?' });

      expect(dialog.textContent).toContain('3 guests are in it, with their companions.');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));

      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(groupRows()).not.toContain('Work');
      expect(within(chips()).queryByRole('button', { name: 'Work' })).toBeNull();
      expect(screen.queryAllByRole('link', { name: /Group: Work$/u })).toHaveLength(0);
    },
  );

  it('an empty group says no guest changes group', SLOW, async () => {
    await guests('groupsDeleteEmpty');
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Cousins?' });

    expect(dialog.textContent).toContain('No one is in it, so no guest changes group.');
  });

  it('without guests.manage, shows the groups and changes nothing', SLOW, async () => {
    await guests('groupsViewer');

    expect(within(column()).queryByRole('textbox', { name: 'New group' })).toBeNull();
    expect(within(column()).queryByRole('button', { name: /^Rename/u })).toBeNull();
    expect(column().textContent).toContain(
      'Making, renaming and deleting them is for people who manage guests.',
    );
  });

  it('the first time: New group above No groups yet', SLOW, async () => {
    await guests('groupsFirst');

    expect(newGroup()).toBeDefined();
    expect(within(column()).getByRole('heading', { name: 'No groups yet' })).toBeDefined();
  });

  it('on a new event with no guests, Groups opens and a group can be made', SLOW, async () => {
    await guests('first');
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    fireEvent.change(newGroup(), { target: { value: 'Bride’s side' } });
    fireEvent.click(within(column()).getByRole('button', { name: 'Create group' }));

    await waitFor(() => expect(groupRows()).toContain('Bride’s side'), WAIT);
  });

  it('asks before Groups drops a changed Edit guest, and Keep editing keeps it', SLOW, async () => {
    await guests('groupField');
    fireEvent.change(within(column()).getByLabelText('Full name'), {
      target: { value: 'Alhaji Musa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));

    expect(screen.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeDefined();
    expect(within(column()).queryByRole('textbox', { name: 'New group' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(within(column()).getByLabelText('Full name')).toHaveProperty('value', 'Alhaji Musa');
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(newGroup()).toBeDefined();
  });

  it('the state for a new event shows New group above No groups yet', SLOW, async () => {
    await guests('groupsNoGuests');

    expect(newGroup()).toBeDefined();
    expect(within(column()).getByRole('heading', { name: 'No groups yet' })).toBeDefined();
  });
});
