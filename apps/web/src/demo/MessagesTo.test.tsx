import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/messages';
const NO_CONDITION =
  'Add a condition first. With none, Guests who… matches nobody, so there is nothing to send or save.';

async function messages(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function popover(): HTMLElement {
  return screen.getByRole('dialog', { name: 'To' });
}

function radios(): string[] {
  return within(popover())
    .getAllByRole('radio')
    .map((one) => {
      const by = one.getAttribute('aria-labelledby');

      return by == null
        ? (one.closest('label')?.textContent ?? '')
        : (document.getElementById(by)?.textContent ?? '');
    });
}

function checked(): HTMLInputElement | undefined {
  return within(popover())
    .getAllByRole<HTMLInputElement>('radio')
    .find((one) => one.checked);
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

function count(): string {
  return popover().querySelector('.mg-pop-count [role=status]')?.textContent ?? '';
}

function press(key: string): void {
  fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

async function focused(element: HTMLElement): Promise<void> {
  await vi.waitFor(() => expect(document.activeElement).toBe(element));
}

describe('Who gets it: To with its conditions, at a desk (sc-3957)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'lists the saved audiences A to Z, then the quick picks, Choose guests and Guests who…',
    SLOW,
    async () => {
      await messages('to');
      const to = popover();

      expect(radios()).toEqual([
        'Coming, with a mobile',
        'Elodie’s friends',
        'Family who haven’t replied',
        'No reply yet',
        'Work, has an email',
        'All guests142',
        'Coming96',
        'Hasn’t replied25',
        'Choose guests',
        'Guests who…',
      ]);
      expect(
        within(to).getByRole('radio', {
          name: 'Coming, with a mobile',
          description: 'Is coming · Has a mobile number',
        }),
      ).toBeDefined();
      expect(within(to).getAllByRole('button', { name: /^More actions for / })).toHaveLength(5);
      await focused(within(to).getByRole('radio', { name: 'Coming 96' }));
      expect(screen.getByRole('button', { name: 'Coming · 96' })).toBeDefined();
      expect(within(to).getByRole('button', { name: 'Remove condition: Is coming' })).toBeDefined();
      expect(count()).toBe('96 guests');
      expect(within(to).getByRole('button', { name: 'See who' })).toBeDefined();
      expect(within(to).getByRole('button', { name: 'Save this audience' })).toBeDefined();
      expect(within(to).queryByText(/changes this message only/)).toBeNull();
    },
  );

  it('adds a condition to a quick pick for this message only (whoAdded)', SLOW, async () => {
    await messages('whoAdded');

    expect(checked()?.closest('label')?.textContent).toBe('Coming96');
    expect(count()).toBe('31 guests');
    expect(
      within(popover()).getByText('Changing a condition here changes this message only.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Guests who… · 31 guests' })).toBeDefined();
  });

  it(
    'refuses Save this audience with no condition, the reason beside it (whoNone)',
    SLOW,
    async () => {
      await messages('whoNone');
      const save = within(popover()).getByRole('button', { name: 'Save this audience' });
      const why = within(popover()).getByRole('alert');

      expect(checked()?.closest('label')?.textContent).toBe('Guests who…');
      expect(count()).toBe('');
      expect(within(popover()).queryByRole('button', { name: 'See who' })).toBeNull();
      expect(why.textContent).toBe(NO_CONDITION);
      expect(save.getAttribute('aria-describedby')).toBe(why.id);
      await focused(save);
    },
  );

  it('refuses Send with no condition, beside Send, To closed (whoNoneSend)', SLOW, async () => {
    await messages('whoNoneSend');
    const why = await screen.findByRole('alert');

    expect(screen.queryByRole('dialog', { name: 'To' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Guests who…' })).toBeDefined();
    expect(why.textContent).toBe(NO_CONDITION);
    expect(screen.getByRole('button', { name: 'Send' }).getAttribute('aria-describedby')).toBe(
      why.id,
    );
    await focused(why);
  });

  it('takes several conditions, each removable (whoMany)', SLOW, async () => {
    await messages('whoMany');
    const to = popover();

    expect(
      within(to)
        .getAllByRole('button', { name: /^Remove condition: / })
        .map((one) => one.getAttribute('aria-label')),
    ).toEqual(['Remove condition: Hasn’t replied', 'Remove condition: Is in group: Family']);
    expect(count()).toBe('6 guests');
    expect(screen.getByRole('button', { name: 'Guests who… · 6 guests' })).toBeDefined();
  });

  it(
    'asks which group, the groups A to Z then No group, and counts again (whoGroup)',
    SLOW,
    async () => {
      await messages('whoGroup');
      const to = popover();
      const groups = within(to).getByRole('list', { name: 'Is in group: which group?' });

      expect(
        within(groups)
          .getAllByRole('button')
          .map((one) => one.textContent),
      ).toEqual(['Family', 'Old school friends', 'Work', 'No group']);
      await focused(within(groups).getByRole('button', { name: 'Family' }));

      press('Escape');
      await focused(within(to).getByRole('button', { name: 'Is in group' }));
      expect(
        within(to).getByRole('button', {
          name: 'Has replied',
          description: 'Any reply: Coming, Not sure yet or Not coming',
        }),
      ).toBeDefined();
      fireEvent.click(within(to).getByRole('button', { name: 'Is in group' }));
      fireEvent.click(within(to).getByRole('button', { name: 'Old school friends' }));

      expect(count()).toBe('Counting…');
      expect(within(to).queryByRole('button', { name: 'See who' })).toBeNull();
      await vi.waitFor(() => expect(count()).toBe('2 guests'), WAIT);
      expect(
        within(to).getByRole('button', {
          name: 'Remove condition: Is in group: Old school friends',
        }),
      ).toBeDefined();
      await focused(within(to).getByRole('button', { name: 'Add a condition' }));
    },
  );

  it('says Counting… in place of the count, See who hidden (whoCounting)', SLOW, async () => {
    await messages('whoCounting');
    const to = popover();

    expect(count()).toBe('Counting…');
    expect(within(to).queryByRole('button', { name: 'See who' })).toBeNull();
    await focused(within(to).getByRole('button', { name: 'Add a condition' }));

    fireEvent.click(
      within(to).getByRole('button', { name: 'Remove condition: Has a mobile number' }),
    );
    await vi.waitFor(() => expect(count()).toBe('96 guests'), WAIT);
    expect(within(to).getByRole('button', { name: 'See who' })).toBeDefined();
  });

  it('lists who matches with their channels under See who (seeWho)', SLOW, async () => {
    await messages('seeWho');
    const see = within(popover()).getByRole('button', { name: 'See who' });
    const list = within(popover()).getByRole('list', { name: 'See who' });

    expect(see.getAttribute('aria-expanded')).toBe('true');
    expect(see.getAttribute('aria-controls')).toBe(list.id);
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((one) => one.textContent),
    ).toEqual([
      'Abena Mensah · Email address · Mobile number',
      'Chidi Okeke · Email address',
      'Grace Adeyemi · Mobile number',
      'Ifeoma Bello · Email address · Mobile number',
      'Kofi Asante · No email address or mobile number',
      'Yetunde Bakare · Email address',
    ]);
    await focused(see);
    fireEvent.click(see);
    expect(within(popover()).queryByRole('list', { name: 'See who' })).toBeNull();
  });

  it('says Nobody matches and refuses Send, Save still offered (whoNobody)', SLOW, async () => {
    await messages('whoNobody');

    expect(count()).toBe('Nobody matches');
    expect(within(popover()).queryByRole('button', { name: 'See who' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(
      'Nobody matches these conditions, so there is no one to send it to.',
    );

    fireEvent.click(within(popover()).getByRole('button', { name: 'Save this audience' }));
    expect(within(popover()).getByRole('textbox', { name: 'Name this audience' })).toBeDefined();
  });

  it('shows a renamed group by its new name (whoRenamed)', SLOW, async () => {
    await messages('whoRenamed');
    const to = popover();

    expect(
      within(to).getByRole('button', { name: 'Remove condition: Is in group: Bride’s family' }),
    ).toBeDefined();
    expect(
      within(to).getByText('From your saved audience “Family who haven’t replied”'),
    ).toBeDefined();
    expect(
      within(to).getByRole('radio', {
        name: 'Family who haven’t replied',
        description: 'Is in group: Bride’s family · Hasn’t replied',
      }),
    ).toHaveProperty('checked', true);
    expect(count()).toBe('6 guests');
  });

  it(
    'says a deleted group was deleted, by name, matching nobody, and refuses Send (whoDeleted)',
    SLOW,
    async () => {
      await messages('whoDeleted');
      const to = popover();

      expect(
        within(to).getByRole('button', { name: 'Remove condition: Is in group: Family (deleted)' }),
      ).toBeDefined();
      expect(
        within(to).getByText(
          'Family was deleted from this event’s groups, so this condition matches nobody.',
        ),
      ).toBeDefined();
      expect(count()).toBe('Nobody matches');
      expect(screen.getByRole('alert').textContent).toBe(
        'Nobody matches, because Family was deleted. Remove that condition or choose another audience to send it.',
      );

      fireEvent.click(within(to).getByRole('button', { name: 'Add a condition' }));
      fireEvent.click(within(to).getByRole('button', { name: 'Is in group' }));
      expect(
        within(within(to).getByRole('list', { name: 'Is in group: which group?' }))
          .getAllByRole('button')
          .map((one) => one.textContent),
      ).toEqual(['Old school friends', 'Work', 'No group']);
    },
  );

  it(
    'asks for a name in place of the button, counted, with its hint (saveName)',
    SLOW,
    async () => {
      await messages('saveName');
      const field = within(popover()).getByRole('textbox', { name: 'Name this audience' });

      await focused(field);
      expect(within(popover()).getByText('0 of 60 characters')).toBeDefined();
      expect(
        within(popover()).getByText(
          'It is saved for this event and appears first in To. The conditions are saved, not the people.',
        ),
      ).toBeDefined();
      expect(within(popover()).getByRole('button', { name: 'Save audience' })).toBeDefined();
      expect(within(popover()).getByRole('button', { name: 'Cancel' })).toBeDefined();
      expect(within(popover()).queryByRole('button', { name: 'Save this audience' })).toBeNull();
    },
  );

  const REFUSED = [
    ['saveBlank', '', '0 of 60 characters', 'Enter a name for this audience.'],
    [
      'saveLong',
      'Everyone on the bride’s side who hasn’t replied, with mobiles',
      '61 of 60 characters',
      'A saved audience’s name can be up to 60 characters.',
    ],
    [
      'saveTaken',
      'élodie’s friends',
      '16 of 60 characters',
      'There’s already a saved audience called Elodie’s friends.',
    ],
    [
      'saveFull',
      'Reminder: Family, no reply',
      '26 of 60 characters',
      'This event has 20 saved audiences, the most it can have. Delete one to save another.',
    ],
  ] as const;

  for (const [state, value, counted, why] of REFUSED)
    it(`refuses the name beside the field (${state})`, SLOW, async () => {
      await messages(state);
      const field = within(popover()).getByRole<HTMLInputElement>('textbox', {
        name: 'Name this audience',
      });
      const alert = within(popover()).getByRole('alert');

      expect(field.value).toBe(value);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby')).toContain(alert.id);
      expect(alert.textContent).toBe(why);
      expect(within(popover()).getByText(counted)).toBeDefined();
      await focused(field);
      if (state === 'saveFull')
        expect(
          within(popover()).getAllByRole('button', { name: /^More actions for / }),
        ).toHaveLength(20);
    });

  it('chooses a saved audience in its place and says so (saved)', SLOW, async () => {
    await messages('saved');
    const mine = within(popover()).getByRole('radio', { name: 'Reminder: Family, no reply' });

    expect(mine).toHaveProperty('checked', true);
    await focused(mine);
    await vi.waitFor(() =>
      expect(said()).toContain(
        'Saved as Reminder: Family, no reply. It is with your saved audiences, at the top of To.',
      ),
    );
    expect(
      within(popover()).getByText('From your saved audience “Reminder: Family, no reply”'),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Reminder: Family, no reply · 6 guests' }),
    ).toBeDefined();
  });

  it(
    'keeps the saved audience as saved when a condition changes (savedChanged)',
    SLOW,
    async () => {
      await messages('savedChanged');
      const to = popover();

      expect(within(to).getByRole('radio', { name: 'Coming, with a mobile' })).toHaveProperty(
        'checked',
        true,
      );
      expect(
        within(to).getByText('From your saved audience “Coming, with a mobile”'),
      ).toBeDefined();
      expect(
        within(to).getByText('Changing a condition here changes this message only.'),
      ).toBeDefined();
      expect(count()).toBe('92 guests');
      expect(
        within(to).getByRole('radio', {
          name: 'Coming, with a mobile',
          description: 'Is coming · Has a mobile number',
        }),
      ).toBeDefined();
    },
  );

  it('offers Rename and Delete… from More actions, by keyboard (audienceMenu)', SLOW, async () => {
    await messages('audienceMenu');
    const more = within(popover()).getByRole('button', {
      name: 'More actions for Coming, with a mobile',
    });
    const menu = within(popover()).getByRole('menu', {
      name: 'More actions for Coming, with a mobile',
    });

    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((one) => one.textContent),
    ).toEqual(['Rename', 'Delete…']);
    await focused(within(menu).getByRole('menuitem', { name: 'Rename' }));
    press('ArrowDown');
    await focused(within(menu).getByRole('menuitem', { name: 'Delete…' }));
    press('Escape');
    expect(within(popover()).queryByRole('menu')).toBeNull();
    await focused(more);
  });

  it(
    'renames in place with the same counter; an unchanged name just closes (rename)',
    SLOW,
    async () => {
      await messages('rename');
      const field = within(popover()).getByRole<HTMLInputElement>('textbox', {
        name: 'Rename “Elodie’s friends”',
      });

      await focused(field);
      expect(field.value).toBe('Elodie’s friends');
      expect(within(popover()).getByText('16 of 60 characters')).toBeDefined();

      fireEvent.click(within(popover()).getByRole('button', { name: 'Save' }));
      await focused(
        within(popover()).getByRole('button', { name: 'More actions for Elodie’s friends' }),
      );
      expect(said()).not.toContain('Renamed');

      fireEvent.click(
        within(popover()).getByRole('button', { name: 'More actions for Elodie’s friends' }),
      );
      fireEvent.click(within(popover()).getByRole('menuitem', { name: 'Rename' }));
      const again = within(popover()).getByRole('textbox', { name: 'Rename “Elodie’s friends”' });

      fireEvent.change(again, { target: { value: 'No Reply Yet' } });
      fireEvent.click(within(popover()).getByRole('button', { name: 'Save' }));
      expect(within(popover()).getByRole('alert').textContent).toBe(
        'There’s already a saved audience called No reply yet.',
      );
      fireEvent.change(again, { target: { value: '   ' } });
      fireEvent.click(within(popover()).getByRole('button', { name: 'Save' }));
      expect(within(popover()).getByRole('alert').textContent).toBe(
        'Enter a name for this audience.',
      );
      fireEvent.change(again, { target: { value: 'élodie’s friends' } });
      fireEvent.click(within(popover()).getByRole('button', { name: 'Save' }));

      expect(within(popover()).getByRole('radio', { name: 'élodie’s friends' })).toBeDefined();
      await vi.waitFor(() => expect(said()).toContain('Renamed to élodie’s friends.'));
    },
  );

  it('saves a rename that changes only accents, and says so (renamed)', SLOW, async () => {
    await messages('renamed');

    expect(within(popover()).getByRole('radio', { name: 'Élodie’s friends' })).toBeDefined();
    await vi.waitFor(() => expect(said()).toContain('Renamed to Élodie’s friends.'));
    await focused(
      within(popover()).getByRole('button', { name: 'More actions for Élodie’s friends' }),
    );
  });

  it('asks before deleting, inline, the focus on Keep it (deleteAsk)', SLOW, async () => {
    await messages('deleteAsk');
    const ask = within(popover()).getByRole('alertdialog', {
      name: 'Delete the saved audience Coming, with a mobile?',
      description:
        'Messages that used it keep their own conditions. No sent, scheduled or automatic message changes.',
    });

    await focused(within(ask).getByRole('button', { name: 'Keep it' }));
    expect(within(ask).getByRole('button', { name: 'Delete saved audience' })).toBeDefined();

    fireEvent.click(within(ask).getByRole('button', { name: 'Keep it' }));
    expect(within(popover()).queryByRole('alertdialog')).toBeNull();
    await focused(
      within(popover()).getByRole('button', { name: 'More actions for Coming, with a mobile' }),
    );
    expect(within(popover()).getAllByRole('button', { name: /^More actions for / })).toHaveLength(
      5,
    );
  });

  it(
    'keeps Guests who… with the same chips and count when the picked one is deleted (deletedPicked)',
    SLOW,
    async () => {
      await messages('deletedPicked');
      const to = popover();

      expect(within(to).queryByRole('radio', { name: 'Coming, with a mobile' })).toBeNull();
      expect(checked()?.closest('label')?.textContent).toBe('Guests who…');
      expect(
        within(to)
          .getAllByRole('button', { name: /^Remove condition: / })
          .map((one) => one.getAttribute('aria-label')),
      ).toEqual(['Remove condition: Is coming', 'Remove condition: Has a mobile number']);
      expect(count()).toBe('31 guests');
      expect(within(to).queryByText(/From your saved audience/)).toBeNull();
      await vi.waitFor(() => expect(said()).toContain('Coming, with a mobile deleted.'));
    },
  );

  it('picks a saved audience, then deletes it after asking: never All guests', SLOW, async () => {
    await messages('to');
    const to = popover();

    fireEvent.click(within(to).getByRole('radio', { name: 'Coming, with a mobile' }));
    expect(count()).toBe('Counting…');
    await vi.waitFor(() => expect(count()).toBe('31 guests'), WAIT);
    expect(screen.getByRole('button', { name: 'Coming, with a mobile · 31 guests' })).toBeDefined();

    fireEvent.click(
      within(to).getByRole('button', { name: 'More actions for Coming, with a mobile' }),
    );
    fireEvent.click(within(to).getByRole('menuitem', { name: 'Delete…' }));
    await focused(within(to).getByRole('button', { name: 'Keep it' }));
    fireEvent.click(within(to).getByRole('button', { name: 'Delete saved audience' }));

    expect(within(to).getByRole('radio', { name: 'Guests who…' })).toHaveProperty('checked', true);
    expect(screen.getByRole('button', { name: 'Guests who… · 31 guests' })).toBeDefined();
    await vi.waitFor(() => expect(said()).toContain('Coming, with a mobile deleted.'));
    await focused(within(to).getByRole('radio', { name: 'Guests who…' }));
  });

  it(
    'saves the conditions under a name, refusing blank, long and used names, then the 21st',
    SLOW,
    async () => {
      const fetched = vi.spyOn(globalThis, 'fetch');

      await messages('whoMany');
      const to = popover();

      fireEvent.click(within(to).getByRole('button', { name: 'Save this audience' }));
      const field = within(to).getByRole('textbox', { name: 'Name this audience' });

      await focused(field);
      fireEvent.click(within(to).getByRole('button', { name: 'Save audience' }));
      expect(within(to).getByRole('alert').textContent).toBe('Enter a name for this audience.');
      fireEvent.change(field, { target: { value: `${'a'.repeat(60)}b` } });
      expect(within(to).queryByRole('alert')).toBeNull();
      expect(within(to).getByText('61 of 60 characters')).toBeDefined();
      fireEvent.click(within(to).getByRole('button', { name: 'Save audience' }));
      expect(within(to).getByRole('alert').textContent).toBe(
        'A saved audience’s name can be up to 60 characters.',
      );
      fireEvent.change(field, { target: { value: 'FAMILY WHO HAVEN’T REPLIED' } });
      fireEvent.click(within(to).getByRole('button', { name: 'Save audience' }));
      expect(within(to).getByRole('alert').textContent).toBe(
        'There’s already a saved audience called Family who haven’t replied.',
      );
      fireEvent.change(field, { target: { value: 'Reminder: Family, no reply' } });
      fireEvent.click(within(to).getByRole('button', { name: 'Save audience' }));

      const mine = within(to).getByRole('radio', { name: 'Reminder: Family, no reply' });

      expect(mine).toHaveProperty('checked', true);
      await focused(mine);
      await vi.waitFor(() =>
        expect(said()).toContain(
          'Saved as Reminder: Family, no reply. It is with your saved audiences, at the top of To.',
        ),
      );
      expect(radios().indexOf('Reminder: Family, no reply')).toBe(4);
      expect(fetched).not.toHaveBeenCalled();
      fetched.mockRestore();
    },
  );

  it('makes room for the 21st by deleting one (saveFull)', SLOW, async () => {
    await messages('saveFull');
    const to = popover();

    fireEvent.click(within(to).getByRole('button', { name: 'Cancel' }));
    await focused(within(to).getByRole('button', { name: 'Save this audience' }));
    fireEvent.click(within(to).getByRole('button', { name: 'More actions for Work' }));
    fireEvent.click(within(to).getByRole('menuitem', { name: 'Delete…' }));
    fireEvent.click(within(to).getByRole('button', { name: 'Delete saved audience' }));
    fireEvent.click(within(to).getByRole('button', { name: 'Save this audience' }));
    fireEvent.change(within(to).getByRole('textbox', { name: 'Name this audience' }), {
      target: { value: 'Reminder: Family, no reply' },
    });
    fireEvent.click(within(to).getByRole('button', { name: 'Save audience' }));

    expect(within(to).getByRole('radio', { name: 'Reminder: Family, no reply' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(to).getAllByRole('button', { name: /^More actions for / })).toHaveLength(20);
  });

  it('closes its menus, fields and questions with Escape, one at a time', SLOW, async () => {
    await messages('saveName');

    press('Escape');
    await focused(within(popover()).getByRole('button', { name: 'Save this audience' }));
    press('Escape');
    expect(screen.queryByRole('dialog', { name: 'To' })).toBeNull();
    await focused(screen.getByRole('button', { name: 'Guests who… · 6 guests' }));
  });

  it('offers no New and no composer without messages.manage (noManage)', SLOW, async () => {
    await messages('noManage');

    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Inês Duarte' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Your answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(
      screen.getByText('[Sending messages is for members who manage messages.]'),
    ).toBeDefined();
    expect(document.querySelector('.mg-keys-list')?.textContent).toBe('JKMove');
    press('c');
    expect(screen.queryByRole('dialog', { name: 'To' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Subject' })).toBeNull();
  });

  it(
    'is read only throughout without messages.manage: no done, no scheduled actions, no fixes (noManage)',
    SLOW,
    async () => {
      await messages('noManage');
      const list = screen.getByRole('region', { name: 'Messages' });
      const open = async (name: RegExp, heading: string) => {
        fireEvent.click(within(list).getByRole('link', { name }));
        await screen.findByRole('heading', { level: 2, name: heading }, WAIT);
      };
      const none = (names: readonly (string | RegExp)[]) => {
        for (const name of names)
          expect(screen.queryByRole('button', { name }), String(name)).toBeNull();
      };

      none(['Mark as done', 'Mark as waiting', 'Tell them', 'Dismiss']);
      expect(screen.queryByRole('heading', { name: 'Guests have not been told yet' })).toBeNull();
      press('e');
      expect(within(list).getByRole('heading', { name: 'Needs you · 5' })).toBeDefined();
      expect(
        screen.getAllByText('[Sending messages is for members who manage messages.]'),
      ).toHaveLength(1);

      await open(/^Marta Silva/, 'Marta Silva');
      none(['Mark as done', 'Mark as waiting']);

      await open(/^m\.dubois@orange\.fr/, 'm.dubois@orange.fr');
      expect(
        screen.getByText(
          'Soirely could not match m.dubois@orange.fr to a guest. Choose the guest to answer them.',
        ),
      ).toBeDefined();
      none(['Choose the guest', 'Change guest', 'Mark as done']);

      await open(/^On the day: where to find us/, 'On the day: where to find us');
      none(['Edit', 'Send now', 'Cancel…']);
      expect(screen.getByText(/^Goes Thu, Nov 5, 09:00 London time\./)).toBeDefined();

      await open(/^Parking at The Landmark/, 'Parking at The Landmark');
      fireEvent.click(screen.getByRole('button', { name: 'Who it reached' }));
      await screen.findByRole('heading', { level: 2, name: 'Reached 131 of 142' }, WAIT);
      expect(screen.getByText('Tomás Ferreira')).toBeDefined();
      none([
        'Fix email address',
        'Add an email address',
        'Add a phone number',
        'Mark as told in person',
        /^Send to .* again$/,
        /^Resend to the /,
      ]);
    },
  );

  it(
    'shows a message sent to conditions with who it was worked out to (resolvedRow)',
    SLOW,
    async () => {
      await messages('resolvedRow');
      const list = screen.getByRole('region', { name: 'Messages' });
      const row = within(list).getByRole('link', {
        name: 'Please reply by Friday, To Guests who… Hasn’t replied · Is in group: Family · Reached 6 of 6, Oct 29',
      });

      expect(row.getAttribute('aria-current')).toBe('true');
      expect(
        screen.getByRole('heading', { level: 2, name: 'Please reply by Friday' }),
      ).toBeDefined();
      expect(
        screen.getByText('To Guests who… Hasn’t replied · Is in group: Family · 6'),
      ).toBeDefined();
      expect(screen.getByText('Worked out at 10:00, when it went: 6 guests.')).toBeDefined();
      expect(screen.getByText('Reached 6 of 6 · seen by 4 on their page')).toBeDefined();
      expect(screen.getByRole('textbox', { name: 'Write a follow-up' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Guests who… · 6 guests' })).toBeDefined();
    },
  );

  it(
    'keeps a message nobody matched when it was due in Done, as an outcome (nobodyDue)',
    SLOW,
    async () => {
      await messages('nobodyDue');
      const list = screen.getByRole('region', { name: 'Messages' });
      const done = within(list).getByRole('heading', { name: 'Done' }).parentElement as HTMLElement;

      expect(
        within(done).getByRole('link', {
          name: 'Reply reminder, Nobody matched when it was due, 09:00 · sent nothing, Oct 30',
        }),
      ).toBeDefined();
      expect(within(done).getByRole('link', { name: /^Please reply by Friday/ })).toBeDefined();
      expect(screen.getByRole('heading', { level: 2, name: 'Reply reminder' })).toBeDefined();
      expect(screen.getByText('To Guests who… Is in group: Work · Hasn’t replied')).toBeDefined();
      expect(
        screen.getByText('At 09:00 no guest matched its conditions, so it sent nothing.'),
      ).toBeDefined();
      expect(screen.queryByRole('textbox', { name: 'Write a follow-up' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Who it reached/ })).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );
});
