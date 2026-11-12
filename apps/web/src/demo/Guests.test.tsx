import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function guests(state: string) {
  const router = open(`/demo/guests?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);

  return router;
}

function main(): HTMLElement {
  return screen.getByRole('main');
}

function column(): HTMLElement {
  return main().querySelector<HTMLElement>('.gs-column') as HTMLElement;
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('Guests, the list (sc-31781)', () => {
  it('leads with the card, then Find a guest and the groups', SLOW, async () => {
    await guests('inUse');

    expect(screen.getByText('96 coming of 142 invited')).toBeDefined();
    expect(
      screen.getByText(
        '25 haven’t replied (21 guests and 4 of their companions). Replies close tomorrow, Wed, Nov 4.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('searchbox', { name: 'Find a guest' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'All · 156' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Coming · 96' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'No reply · 21' })).toBeDefined();
    expect(screen.getByText('Pick a guest to see their details, or add one.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 96 coming' }));

    expect(screen.queryByRole('button', { name: 'Show all 96 coming' })).toBeNull();
    expect(screen.getByRole('link', { name: /^Temitope Oyelaran, Coming/u })).toBeDefined();
  });

  it('filters with the house menu and says how many are shown', SLOW, async () => {
    await guests('inUse');

    fireEvent.click(screen.getByRole('button', { name: 'All · 156' }));
    const menu = screen.getByRole('menu');

    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual([
      'All156',
      'Invited142',
      'Coming96',
      'Not sure yet10',
      'No reply21',
      'Held6',
      'Not coming9',
      'Not yet invited14',
    ]);

    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^Held/u }));

    expect(screen.getByText('6 of 156 shown')).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a guest' }), {
      target: { value: 'marta' },
    });

    expect(screen.getByText('0 of 156 shown')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'No guests match' })).toBeDefined();

    fireEvent.click(within(main()).getAllByRole('button', { name: 'Clear' })[0] as HTMLElement);

    expect(screen.getByRole('button', { name: 'All · 156' })).toBeDefined();
  });

  it('finds a guest and their companion as one types', SLOW, async () => {
    await guests('search');

    expect(screen.getByText('2 of 156 shown')).toBeDefined();
    expect(
      screen.getByRole('link', { name: /^Chief Mrs Folasade Okonkwo-Williams, Not sure yet/u }),
    ).toBeDefined();
  });

  it('starts with No guests yet and Add guest, nothing else', SLOW, async () => {
    await guests('first');

    expect(screen.getByText('No guests yet')).toBeDefined();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(within(main()).getAllByRole('button', { name: /Add guest/u })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add guest' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Add guest' })).toBeDefined();
  });

  it('says when the list did not load, and tries again', SLOW, async () => {
    await guests('failed');

    expect(screen.getByRole('alert').textContent).toContain('We could not load the guests.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('96 coming of 142 invited')).toBeDefined();
  });

  it('shows names and replies only to someone who can view', SLOW, async () => {
    await guests('viewer');

    expect(within(main()).queryByRole('button', { name: /Add guest/u })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Write to them' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByText('kwame.mensah@outlook.com')).toBeNull();
    expect(screen.queryByText('+44 7700 900412')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Invitation' })).toBeNull();
    expect(within(column()).getByText('Coming · replied Oct 2')).toBeDefined();
    expect(within(column()).getByText('Messages greet them by their full name.')).toBeDefined();
    expect(within(column()).queryByText('Added')).toBeNull();
    expect(within(column()).queryByRole('heading', { name: 'Their conversation' })).toBeNull();
    expect(within(column()).queryByRole('button')).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a guest' }), {
      target: { value: 'nhs.net' },
    });

    expect(screen.getByRole('heading', { name: 'No guests match' })).toBeDefined();
  });

  it(
    'shows door staff names, replies and companions, never a number or an email',
    SLOW,
    async () => {
      await guests('staffBefore');

      fireEvent.click(screen.getByRole('link', { name: /^Alhaji Musa Bello, Coming/u }));

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Alhaji Musa Bello' }),
      ).toBeDefined();
      expect(within(column()).getByText('Guest of Alhaji Musa Bello')).toBeDefined();
      expect(within(column()).queryByText('musa.bello@gmail.com')).toBeNull();
      expect(within(column()).queryByText('Mobile number')).toBeNull();
      expect(within(column()).getByRole('heading', { name: 'Details' })).toBeDefined();
      expect(within(column()).queryByText('Added')).toBeNull();
      expect(within(column()).queryByRole('heading', { name: 'Their conversation' })).toBeNull();
      expect(within(column()).queryByRole('button')).toBeNull();
    },
  );

  it('opens a Draft’s and a Paused event’s guests with their card', SLOW, async () => {
    await guests('draft');

    expect(screen.getByText('12 on the list')).toBeDefined();
    expect(screen.getByText('Guests can’t be invited until this event is live.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
  });

  it('answers not-found once the event is deleted (sc-1468)', SLOW, async () => {
    open('/demo/guests?state=eventDeleted');
    const gone = await screen.findByRole(
      'heading',
      { level: 1, name: 'This event is not available' },
      WAIT,
    );

    await waitFor(() => expect(document.activeElement).toBe(gone));
    expect(screen.queryByRole('heading', { level: 1, name: 'Guests' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Adaeze & Tunde’s wedding' })).toBeNull();
  });

  it('counts arrivals on the day, with a walk-in in the menu after Coming', SLOW, async () => {
    await guests('onTheDay');

    fireEvent.click(screen.getByRole('button', { name: 'All · 157' }));
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitemradio')
        .slice(2, 4)
        .map((item) => item.textContent),
    ).toEqual(['Coming96', 'Walk-in1']);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByText('41 of 98')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Walk-in · 1' })).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Kofi Asante, Walk-in · Arrived 18:20' }),
    ).toBeDefined();
  });
});

describe('Guests, a guest beside the list (sc-3773)', () => {
  it(
    'opens a guest in the column, focus on their name, and Escape brings it back',
    SLOW,
    async () => {
      await guests('inUse');
      const row = screen.getByRole('link', { name: /^Amaka Eze, Coming/u });

      fireEvent.click(row);
      const name = await screen.findByRole('heading', { level: 2, name: 'Amaka Eze' });

      await waitFor(() => expect(document.activeElement).toBe(name));
      expect(row.getAttribute('aria-current')).toBe('true');
      expect(within(column()).getByText('Coming · replied Oct 13')).toBeDefined();

      fireEvent.keyDown(name, { key: 'Escape' });

      await waitFor(() => expect(document.activeElement).toBe(row));
      expect(screen.queryByRole('heading', { level: 2, name: 'Amaka Eze' })).toBeNull();
    },
  );

  it('leads a guest with no reply with Record a reply', SLOW, async () => {
    await guests('guest');

    expect(
      within(column()).getAllByText('Invited by Folake Adeyemi, WhatsApp, Oct 9'),
    ).toHaveLength(2);
    expect(within(column()).getByRole('button', { name: 'Record a reply' })).toBeDefined();
    expect(
      within(column()).getByText('Companion · Held · comes only if their host accepts'),
    ).toBeDefined();
  });

  it('shows Can view only that replies closed, with no step', SLOW, async () => {
    await guests('repliesClosedViewer');

    expect(within(column()).getByText('Replies closed on Wed, Nov 4.')).toBeDefined();
    expect(within(column()).queryByText(/Record a reply opens again/u)).toBeNull();
    expect(
      within(column()).queryByRole('button', { name: 'Let them change their reply' }),
    ).toBeNull();
  });

  it('lets them change their reply once replies have closed', SLOW, async () => {
    await guests('repliesClosed');

    fireEvent.click(within(column()).getByRole('button', { name: 'Let them change their reply' }));

    expect(
      within(column()).getByText(
        'Reply reopened by Folake Adeyemi, Nov 5. They can answer until the event starts.',
      ),
    ).toBeDefined();
  });
});

describe('Guests, Edit in place (sc-3773)', () => {
  it('refuses before sending, each line under its field', SLOW, async () => {
    await guests('editErrors');

    expect(screen.getByText('Enter their full name.')).toBeDefined();
    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Full name' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('holds Save on a colleague’s change until Use theirs or Keep mine', SLOW, async () => {
    await guests('edit412');
    const save = within(column()).getByRole('button', { name: 'Save' });

    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('kwame.mensha@outlook.com')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Use theirs' }));

    expect(save.getAttribute('aria-disabled')).toBe('false');
    expect(
      (screen.getByRole('textbox', { name: /Email address/u }) as HTMLInputElement).value,
    ).toBe('kwame.mensha@outlook.com');
  });

  it('saves, back on the guest, and says Saved', SLOW, async () => {
    await guests('edit');

    fireEvent.change(screen.getByRole('textbox', { name: /Email address/u }), {
      target: { value: 'kwame@mensah.co.uk' },
    });
    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('kwame@mensah.co.uk', {}, WAIT)).toBeDefined();
    expect(screen.getByText('Saved')).toBeDefined();
  });

  it(
    'shows three companions, then how many more, a text action that shows the rest',
    SLOW,
    async () => {
      await guests('editMax');

      expect(
        within(column()).getAllByRole('textbox', { name: /^Companion’s full name/u }),
      ).toHaveLength(3);
      expect(screen.getByText('10 companions is the most one guest can bring.')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add a companion' })).toBeNull();

      fireEvent.click(within(column()).getByRole('button', { name: '7 more companions' }));
      const fields = within(column()).getAllByRole('textbox', { name: /^Companion’s full name/u });

      expect(fields).toHaveLength(10);
      expect(screen.queryByRole('button', { name: '7 more companions' })).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(fields[3]), WAIT);
    },
  );

  it('asks before removing a companion with a seat and a meal', SLOW, async () => {
    await guests('editSeated');
    const ask = await screen.findByRole('alertdialog', { name: 'Remove Rui Duarte?' });
    const companions = () =>
      within(column()).queryAllByRole('textbox', { name: /^Companion’s full name/u });

    expect(
      within(ask).getByText(
        'Rui Duarte has a seat at Table 4 and a meal chosen. Removing this companion frees the seat and drops the meal.',
      ),
    ).toBeDefined();

    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(companions()).toHaveLength(1);

    fireEvent.click(within(column()).getByRole('button', { name: 'Remove Rui Duarte' }));
    const again = await screen.findByRole('alertdialog', { name: 'Remove Rui Duarte?' });
    fireEvent.click(within(again).getByRole('button', { name: 'Remove' }));

    expect(screen.getByText('Rui Duarte removed. Save to keep the change.')).toBeDefined();
    expect(companions()).toHaveLength(0);
  });

  it('asks before throwing a change away', SLOW, async () => {
    await guests('edit');

    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Kwame A. Mensah' },
    });
    fireEvent.click(within(column()).getByRole('button', { name: 'Cancel' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Discard your changes?' });

    expect(
      within(ask).getByText('Your changes to Kwame Mensah have not been saved.'),
    ).toBeDefined();
  });

  it('asks about a name already on the list', SLOW, async () => {
    await guests('edit');

    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Marta Silva' },
    });
    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    expect(
      screen.getByRole('heading', { name: 'Marta Silva is already on the list' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save anyway' })).toBeDefined();
  });
});

describe('Guests, Record a reply in place (sc-3787)', () => {
  it(
    'puts a companion whose reply differs in their own group, so each group shows what it counts',
    SLOW,
    async () => {
      await guests('guest');

      fireEvent.click(within(column()).getByRole('button', { name: 'Record a reply' }));
      fireEvent.click(await screen.findByRole('radio', { name: 'Coming' }));
      fireEvent.click(screen.getByRole('radio', { name: 'By phone' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Adanna Nwosu' }));
      fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));
      await screen.findByText('Reply recorded. It counts like any other reply.', {}, WAIT);
      fireEvent.click(within(main()).getAllByRole('button', { name: 'Clear' })[0] as HTMLElement);
      for (const more of screen.queryAllByRole('button', { name: /^Show all/u }))
        fireEvent.click(more);

      const group = (name: RegExp) =>
        screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;

      expect(screen.getByRole('heading', { level: 2, name: 'Coming · 97' })).toBeDefined();
      expect(screen.getByRole('heading', { level: 2, name: 'Not coming · 10' })).toBeDefined();
      expect(
        within(group(/^Not coming/u)).getByRole('link', {
          name: 'Adanna Nwosu, Not coming, Guest of Dr Emeka Nwosu',
        }),
      ).toBeDefined();
      expect(
        within(group(/^Coming/u)).getByRole('link', {
          name: /^Dr Emeka Nwosu, Coming · recorded by Folake Adeyemi/u,
        }),
      ).toBeDefined();
      expect(within(group(/^Coming/u)).queryByRole('link', { name: /^Adanna Nwosu/u })).toBeNull();
      for (const heading of screen.getAllByRole('heading', { level: 2, name: / · \d+$/u })) {
        const count = Number(/(\d+)$/u.exec(heading.textContent ?? '')?.[1]);
        const rows = within(heading.closest('section') as HTMLElement)
          .getAllByRole('link')
          .filter((row) => !/, Held · /u.test(row.getAttribute('aria-label') ?? ''));

        expect(rows).toHaveLength(count);
      }
    },
  );

  it('refuses with nothing chosen, then records and counts it straight away', SLOW, async () => {
    await guests('record');

    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Choose their reply.')).toBeDefined();
    expect(screen.getByText('Choose how they told you.')).toBeDefined();

    fireEvent.click(screen.getByRole('radio', { name: 'Coming' }));
    fireEvent.click(screen.getByRole('radio', { name: 'By phone' }));

    expect(screen.getByText(/^1 place · 1 coming\./u)).toBeDefined();

    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Reply recorded. It counts like any other reply.', {}, WAIT),
    ).toBeDefined();
    expect(screen.getByText('98 coming of 142 invited')).toBeDefined();
    expect(
      within(column()).getAllByText('Coming · recorded by Folake Adeyemi, by phone, Nov 3'),
    ).toHaveLength(1);
  });

  it('asks before replacing a reply the guest gave themselves', SLOW, async () => {
    await guests('recordReplace');

    expect(
      screen.getByRole('heading', {
        name: 'Ngozi Eze replied Coming themselves on Oct 2. Replace it?',
      }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep their reply' })).toBeDefined();
  });
});

describe('Guests, Add guest in place (sc-1468)', () => {
  it('stays open after each guest, the form cleared', SLOW, async () => {
    await guests('add');

    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Bimpe Adeyemi' },
    });
    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));

    expect(screen.getByText('Bimpe Adeyemi added.')).toBeDefined();
    expect((screen.getByRole('textbox', { name: 'Full name' }) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'No reply · 21' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'No reply · 21' }));

    expect(screen.getByRole('menuitemradio', { name: /^Not yet invited\s*15/u })).toBeDefined();
  });

  it('refuses a blank name and a number too short', SLOW, async () => {
    await guests('addRefused');

    expect(screen.getByText('Enter their full name.')).toBeDefined();
    expect(
      screen.getByText('That number looks too short for United Kingdom. Check it and try again.'),
    ).toBeDefined();
  });
});

describe('Guests, the guest’s Language (sc-3790)', () => {
  const HINT =
    'Their page opens in their browser’s language when Soirely offers it, otherwise in this language. Messages use this language. When this is Not set, both use your organisation’s language.';

  it(
    'puts Language after the contact fields, Not set, each language in its own name',
    SLOW,
    async () => {
      await guests('add');
      const field = within(column()).getByRole('combobox', { name: /^Language/u });
      const options = within(field).getAllByRole('option');

      expect((field as HTMLSelectElement).value).toBe('');
      expect(options.map((one) => one.textContent)).toEqual([
        'Not set',
        'English',
        'Español',
        'Français',
        'Português',
      ]);
      expect(options.slice(1).map((one) => one.getAttribute('lang'))).toEqual([
        'en',
        'es',
        'fr',
        'pt',
      ]);
      expect(screen.getByText(HINT)).toBeDefined();
    },
  );

  it('adds a guest with the language chosen', SLOW, async () => {
    await guests('languageAdd');

    expect(
      (within(column()).getByRole('combobox', { name: /^Language/u }) as HTMLSelectElement).value,
    ).toBe('fr');
    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));

    expect(screen.getByText('Lucas Moreau added.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'No reply · 21' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Not yet invited\s*15/u }));
    fireEvent.click(screen.getByRole('link', { name: /^Lucas Moreau, Not yet invited/u }));

    expect(
      await within(column()).findByRole('heading', { name: 'Lucas Moreau' }, WAIT),
    ).toBeDefined();
    expect(within(column()).getByText('Français')).toBeDefined();
  });

  it('says in Details what Not set falls back to', SLOW, async () => {
    await guests('languageNotSet');

    expect(
      within(column()).getByText(
        'Not set · their browser’s language, or English when Soirely does not offer it',
      ),
    ).toBeDefined();
  });

  it('shows the host’s language, and the guest’s own choice when they made one', SLOW, async () => {
    await guests('languageGuestChose');

    expect(within(column()).getByText('Español')).toBeDefined();
    expect(
      within(column()).getByText('They chose Português on their page, and that wins.'),
    ).toBeDefined();
  });

  it(
    'keeps the host’s select set and enabled when the guest chose, and saves a change',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await guests('languageEdit');
      const field = within(column()).getByRole('combobox', {
        name: /^Language/u,
      }) as HTMLSelectElement;

      expect(field.value).toBe('es');
      expect(field.disabled).toBe(false);
      expect(field.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
      fireEvent.change(field, { target: { value: 'fr' } });
      fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

      expect(await within(column()).findByText('Français', {}, WAIT)).toBeDefined();
      expect(
        within(column()).getByText('They chose Português on their page, and that wins.'),
      ).toBeDefined();
      vi.useRealTimers();
    },
  );
});

describe('Guests, Greet as (sc-3960)', () => {
  const HINT =
    'How messages greet them, such as Auntie Bisi or Dr. Okafor. Leave it blank to use their full name.';
  const LONG = 'Auntie Bisi, who taught every one of us to dance at weddings!';

  function greetAs(): HTMLInputElement {
    return within(column()).getByRole('textbox', { name: /^Greet as/u }) as HTMLInputElement;
  }

  function told(field: HTMLElement): string[] {
    return (field.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '');
  }

  it('says in Details how messages greet Bisi Adewale', SLOW, async () => {
    await guests('greetAs');

    expect(within(column()).getByRole('heading', { name: 'Details' })).toBeDefined();
    expect(within(column()).getByText('Messages greet them as “Auntie Bisi”.')).toBeDefined();
    expect(within(column()).getByText('Greet as')).toBeDefined();
    expect(within(column()).getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('puts Greet as under Full name, optional, empty at 0 of 60, with its hint', SLOW, async () => {
    await guests('greetAsEmpty');
    const boxes = within(column()).getAllByRole('textbox');

    expect(boxes[0]?.getAttribute('data-focus')).toBe('name');
    expect(boxes[1]).toBe(greetAs());
    expect(document.querySelector(`label[for="${greetAs().id}"]`)?.textContent).toBe(
      'Greet asOptional',
    );
    expect(greetAs().value).toBe('');
    expect(told(greetAs())).toEqual([HINT, '0 of 60']);
    await vi.waitFor(() => expect(document.activeElement).toBe(greetAs()));
  });

  it('counts code points after trimming, and saves it trimmed', SLOW, async () => {
    await guests('greetAsEdit');

    expect(greetAs().value).toBe('Auntie Bisi');
    expect(told(greetAs())).toEqual([HINT, '11 of 60']);

    fireEvent.change(greetAs(), { target: { value: '  Tía Bisi 💃  ' } });
    expect(told(greetAs())).toEqual([HINT, '10 of 60']);
    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    expect(
      await within(column()).findByText('Messages greet them as “Tía Bisi 💃”.', {}, WAIT),
    ).toBeDefined();
    expect(screen.getByText('Saved')).toBeDefined();
  });

  it(
    'refuses over 60 on Save: the red edge, the line under it, the focus on it',
    SLOW,
    async () => {
      await guests('greetAsLong');

      expect(greetAs().value).toBe(LONG);
      expect(greetAs().getAttribute('aria-invalid')).toBe('true');
      expect(greetAs().closest('.desk-box')?.classList.contains('is-wrong')).toBe(true);
      expect(told(greetAs())).toEqual([
        HINT,
        '61 of 60',
        'Shorten Greet as to 60 characters or fewer.',
      ]);
      await vi.waitFor(() => expect(document.activeElement).toBe(greetAs()));

      within(column()).getByRole('textbox', { name: 'Full name' }).focus();
      fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));
      await vi.waitFor(() => expect(document.activeElement).toBe(greetAs()));
      expect(screen.queryByText('Saved')).toBeNull();

      fireEvent.change(greetAs(), { target: { value: LONG.slice(0, -1) } });
      expect(told(greetAs())).toEqual([HINT, '60 of 60']);
      fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));
      expect(
        await within(column()).findByText(
          `Messages greet them as “${LONG.slice(0, -1)}”.`,
          {},
          WAIT,
        ),
      ).toBeDefined();
    },
  );

  it('saves only spaces as empty: their full name', SLOW, async () => {
    await guests('greetAsSpaces');

    expect(screen.getByText('Saved')).toBeDefined();
    expect(within(column()).getByText('Messages greet them by their full name.')).toBeDefined();
  });

  it('shows Greet as to someone who can view, with no Edit', SLOW, async () => {
    await guests('greetAsViewer');

    expect(within(column()).getByRole('heading', { name: 'Details' })).toBeDefined();
    expect(within(column()).getByText('Messages greet them as “Auntie Bisi”.')).toBeDefined();
    expect(within(column()).queryByRole('button')).toBeNull();
    expect(within(column()).queryByText('bisi.adewale@yahoo.com')).toBeNull();
  });

  /** Add guest's Greet as, from the list's Not yet invited filter once it is added. */
  async function openAdded(name: string): Promise<void> {
    fireEvent.click(screen.getByRole('button', { name: 'No reply · 21' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Not yet invited\s*15/u }));
    fireEvent.click(
      screen.getByRole('link', { name: new RegExp(`^${name}, Not yet invited`, 'u') }),
    );
    expect(await within(column()).findByRole('heading', { name }, WAIT)).toBeDefined();
  }

  it('puts Greet as under Full name on Add guest, and adds it', SLOW, async () => {
    await guests('greetAsAdd');
    const boxes = within(column()).getAllByRole('textbox');

    expect(boxes[0]?.getAttribute('data-focus')).toBe('name');
    expect(boxes[1]).toBe(greetAs());
    expect(greetAs().value).toBe('Auntie Bisi');
    expect(told(greetAs())).toEqual([HINT, '11 of 60']);
    await vi.waitFor(() => expect(document.activeElement).toBe(greetAs()));

    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));
    expect(screen.getByText('Olabisi Martins added.')).toBeDefined();
    expect(greetAs().value).toBe('');
    await openAdded('Olabisi Martins');
    expect(within(column()).getByText('Messages greet them as “Auntie Bisi”.')).toBeDefined();
  });

  it('refuses a Greet as over 60 on Add guest, the focus on it', SLOW, async () => {
    await guests('add');

    fireEvent.change(within(column()).getByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Olabisi Martins' },
    });
    fireEvent.change(greetAs(), { target: { value: LONG } });
    expect(told(greetAs())).toEqual([HINT, '61 of 60']);
    within(column()).getByRole('textbox', { name: 'Full name' }).focus();
    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));

    expect(greetAs().getAttribute('aria-invalid')).toBe('true');
    expect(greetAs().closest('.desk-box')?.classList.contains('is-wrong')).toBe(true);
    expect(told(greetAs())).toEqual([
      HINT,
      '61 of 60',
      'Shorten Greet as to 60 characters or fewer.',
    ]);
    await vi.waitFor(() => expect(document.activeElement).toBe(greetAs()));
    expect(screen.queryByText('Olabisi Martins added.')).toBeNull();
  });

  it('adds a guest whose Greet as is only spaces as greeted by their full name', SLOW, async () => {
    await guests('add');

    fireEvent.change(within(column()).getByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Olabisi Martins' },
    });
    fireEvent.change(greetAs(), { target: { value: '    ' } });
    expect(told(greetAs())).toEqual([HINT, '0 of 60']);
    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));

    expect(screen.getByText('Olabisi Martins added.')).toBeDefined();
    await openAdded('Olabisi Martins');
    expect(within(column()).getByText('Messages greet them by their full name.')).toBeDefined();
  });
});

describe('Guests, the link and Mark as invited (sc-1526, sc-3788)', () => {
  it('shows the link to copy by hand when the browser refuses the clipboard', SLOW, async () => {
    await guests('guestComing');

    fireEvent.click(screen.getByRole('button', { name: /^Copy invitation link/u }));

    const link = await screen.findByRole('textbox', { name: 'Invitation link' });

    expect((link as HTMLTextAreaElement).value).toMatch(/^https:\/\/soirely\.app\/i\//u);
    expect(
      screen.getByText(
        'Your browser didn’t let Soirely copy it. It is selected: copy it from here.',
      ),
    ).toBeDefined();
  });

  it('asks before replacing the link, then says it was replaced', SLOW, async () => {
    await guests('replaceAsk');
    const ask = await screen.findByRole('alertdialog', { name: 'Replace Kwame Mensah’s link?' });

    fireEvent.click(within(ask).getByRole('button', { name: 'Replace link' }));

    expect(await screen.findByText('Link replaced Nov 3')).toBeDefined();
  });

  it('marks a guest as invited, nothing chosen until they say how', SLOW, async () => {
    await guests('markAsInvited');

    fireEvent.click(
      within(column()).getAllByRole('button', { name: 'Mark as invited' }).at(-1) as HTMLElement,
    );

    expect(screen.getByText('Choose how you invited them.')).toBeDefined();

    fireEvent.click(screen.getByRole('radio', { name: 'WhatsApp' }));
    fireEvent.click(
      within(column()).getAllByRole('button', { name: 'Mark as invited' }).at(-1) as HTMLElement,
    );

    expect(
      await within(column()).findAllByText('Invited by Folake Adeyemi, WhatsApp, Nov 3'),
    ).toHaveLength(2);
    expect(within(column()).getByRole('button', { name: 'Record a reply' })).toBeDefined();
  });

  it('undoes a mark made by hand with Mark as not invited, nothing asked', SLOW, async () => {
    await guests('guest');

    fireEvent.click(within(column()).getByRole('button', { name: 'Mark as not invited' }));

    expect(await within(column()).findByText('Marked as not invited.')).toBeDefined();
    expect(within(column()).getAllByRole('button', { name: /^Mark as invited/u })).toHaveLength(2);
    expect(within(column()).queryByRole('button', { name: 'Mark as not invited' })).toBeNull();
  });

  it.each([
    ['invitedByMessage', 'Invited by Soirely’s message, Oct 12'],
    ['invitedWhenReplied', 'Invited when they replied, Oct 2'],
  ])('offers no undo on %s', SLOW, async (state, line) => {
    await guests(state);

    expect(within(column()).getByText(line)).toBeDefined();
    expect(within(column()).queryByRole('button', { name: 'Mark as not invited' })).toBeNull();
  });

  it('says why the undo was refused when they replied first (409)', SLOW, async () => {
    await guests('unmarkRefused');

    expect(within(column()).getByRole('alert').textContent).toBe(
      'Not changed. Oluwaseun Ajayi replied Coming on Nov 3, so they stay invited.',
    );
    expect(within(column()).getByText('Invited by Ana Souza, text message, Oct 10')).toBeDefined();
    expect(within(column()).queryByRole('button', { name: 'Mark as not invited' })).toBeNull();
  });

  it('offers neither the mark nor the link once the event has finished', SLOW, async () => {
    await guests('finished');

    expect(screen.getByText('This event has finished, so guests can’t be invited.')).toBeDefined();
    expect(within(column()).queryByRole('button', { name: /Mark as invited/u })).toBeNull();
    expect(within(column()).queryByRole('button', { name: /Copy invitation link/u })).toBeNull();
    expect(within(column()).getByRole('button', { name: /Replace link/u })).toBeDefined();
  });

  it('tells someone who can view why nothing can be marked', SLOW, async () => {
    await guests('guestViewer');

    expect(
      within(column()).getByText(
        'You can see names, replies and who is invited. Marking guests as invited needs a host or organiser role.',
      ),
    ).toBeDefined();
    expect(within(column()).queryByRole('heading', { name: 'Invitation' })).toBeNull();
  });

  it('lists the guests not yet invited from the menu', SLOW, async () => {
    await guests('notYetFilter');

    expect(screen.getByRole('button', { name: 'Not yet invited · 14' })).toBeDefined();
    expect(screen.getByText('14 of 156 shown')).toBeDefined();
  });
});

describe('Guests, WhatsApp on a guest’s page (sc-3950)', () => {
  const agreeButton = () =>
    within(column()).getByRole('button', { name: 'The guest agreed to WhatsApp' });

  it('refuses Save with nothing picked, then records how they agreed', SLOW, async () => {
    await guests('whatsAppNone');

    expect(within(column()).getByText('Has not agreed to WhatsApp')).toBeDefined();
    fireEvent.click(agreeButton());

    expect(
      await within(column()).findByRole('heading', { name: 'Agreed to WhatsApp' }),
    ).toBeDefined();
    expect(
      screen.getByText('For Kwame Mensah, on +44 7700 900412. It will show as recorded by you.'),
    ).toBeDefined();

    const group = screen.getByRole('radiogroup', { name: 'How?' });
    const chips = within(group).getAllByRole('radio');

    expect(chips.map((chip) => chip.closest('label')?.textContent)).toEqual([
      'In person',
      'By phone',
      'In writing',
    ]);
    expect(chips.some((chip) => (chip as HTMLInputElement).checked)).toBe(false);

    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Choose how they agreed.')).toBeDefined();
    expect(group.getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(chips[0]), WAIT);

    fireEvent.click(within(group).getByRole('radio', { name: 'By phone' }));

    expect(screen.queryByText('Choose how they agreed.')).toBeNull();
    expect(group.getAttribute('aria-invalid')).toBeNull();

    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    expect(
      await within(column()).findByText(
        'Agreed to WhatsApp by phone, recorded by Folake Adeyemi on Nov 3',
        {},
        WAIT,
      ),
    ).toBeDefined();
    expect(screen.getByText('Saved')).toBeDefined();
    expect(
      within(column()).queryByRole('button', { name: 'The guest agreed to WhatsApp' }),
    ).toBeNull();
  });

  it('leaves nothing changed on Cancel', SLOW, async () => {
    await guests('whatsAppAgreePicked');

    expect(screen.getByRole('radio', { name: 'In person' })).toHaveProperty('checked', true);
    fireEvent.click(within(column()).getByRole('button', { name: 'Cancel' }));

    expect(await within(column()).findByText('Has not agreed to WhatsApp')).toBeDefined();
    expect(agreeButton()).toBeDefined();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('draws each state the spec names', SLOW, async () => {
    await guests('whatsAppAgreeBlank');
    expect(screen.getByText('Choose how they agreed.')).toBeDefined();
    cleanup();

    await guests('whatsAppNotSaved');
    expect(screen.getByText('Not saved. Nothing was changed. Try again.')).toBeDefined();
    expect(screen.getByRole('radio', { name: 'In person' })).toHaveProperty('checked', true);
    cleanup();

    await guests('whatsAppRecorded');
    expect(
      within(column()).getByText(
        'Agreed to WhatsApp in person, recorded by Folake Adeyemi on Nov 3',
      ),
    ).toBeDefined();
    cleanup();

    await guests('whatsAppGuestAgreed');
    expect(within(column()).getByText('Agreed to WhatsApp on Nov 2')).toBeDefined();
    expect(
      within(column()).queryByRole('button', { name: 'The guest agreed to WhatsApp' }),
    ).toBeNull();
    cleanup();

    await guests('whatsAppOptedOut');
    expect(within(column()).getByText('Unsubscribed from WhatsApp on Nov 1')).toBeDefined();
    expect(within(column()).getByText('Only the guest can change this.')).toBeDefined();
    expect(within(column()).getByText('+33 6 41 27 88 05')).toBeDefined();
    expect(within(column()).queryByText('WhatsApp')).toBeNull();
    expect(
      within(column()).queryByRole('button', { name: 'The guest agreed to WhatsApp' }),
    ).toBeNull();
    cleanup();

    await guests('whatsAppNoMobile');
    expect(within(column()).getByRole('heading', { name: 'Inês Duarte' })).toBeDefined();
    expect(within(column()).queryByText('WhatsApp')).toBeNull();
  });

  it('shows a view-only role neither the row nor the action', SLOW, async () => {
    await guests('whatsAppViewer');

    expect(within(column()).getByRole('heading', { name: 'Kwame Mensah' })).toBeDefined();
    expect(within(column()).queryByText('+44 7700 900412')).toBeNull();
    expect(within(column()).queryByText('WhatsApp')).toBeNull();
    expect(within(column()).queryByText('Has not agreed to WhatsApp')).toBeNull();
    cleanup();

    await guests('guestViewer');

    expect(within(column()).queryByText('WhatsApp')).toBeNull();
    expect(
      within(column()).queryByRole('button', { name: 'The guest agreed to WhatsApp' }),
    ).toBeNull();
  });
});

describe('Guests on sample data (sc-31781)', () => {
  it('sends nothing to the API', SLOW, async () => {
    const fetched = vi.spyOn(globalThis, 'fetch');

    await guests('guest');
    fireEvent.click(within(column()).getByRole('button', { name: 'Record a reply' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Not coming' }));
    fireEvent.click(screen.getByRole('radio', { name: 'In person' }));
    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));
    await screen.findByText('Reply recorded. It counts like any other reply.', {}, WAIT);

    fireEvent.click(within(column()).getByRole('button', { name: 'Edit' }));
    fireEvent.change(await screen.findByRole('textbox', { name: /Email address/u }), {
      target: { value: 'emeka@nwosu.co.uk' },
    });
    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));
    await screen.findByText('emeka@nwosu.co.uk', {}, WAIT);

    fireEvent.click(within(main()).getByRole('button', { name: 'Add guest' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Bimpe Adeyemi' },
    });
    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));

    expect(screen.getByText('Bimpe Adeyemi added.')).toBeDefined();
    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
  });
});

describe('the numbers on Overview and Events (sc-3786, sc-23284)', () => {
  it('lists Overview’s exclusive counts, each opening the guests it counts', SLOW, async () => {
    open('/demo/events/evt-wed-4?state=overview');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }, WAIT);

    expect(
      screen.getByText('96 coming of 142 invited. Each number opens the guests it counts.'),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: '21 No reply, opens No reply' }).getAttribute('href'),
    ).toBe('/demo/guests?filter=noReply');
    expect(
      screen.getByRole('link', {
        name: '142 Invited, opens the guest list showing invited guests',
      }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: /^14 not yet invited/u }).getAttribute('href')).toBe(
      '/demo/guests?filter=notYet',
    );
  });

  it('has no numbers without guests.read, and none invited on a draft', SLOW, async () => {
    open('/demo/events/evt-wed-4?state=overviewViewer');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }, WAIT);

    expect(screen.queryByText('Open the guest list')).toBeNull();
  });

  it('opens Guests on the filter a number counts', SLOW, async () => {
    open('/demo/guests?filter=held');
    await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);

    expect(screen.getByText('6 of 156 shown')).toBeDefined();
  });

  it('gives each event on Events its guests in the tiles’ measure', SLOW, async () => {
    open('/demo/events?state=events');
    await screen.findByRole('heading', { level: 1, name: 'Events' }, WAIT);

    expect(screen.getByText('96 coming · 25 haven’t replied')).toBeDefined();
    expect(screen.getByText('31 coming · 22 haven’t replied')).toBeDefined();
  });

  it('opens the wedding’s Guests from its sidebar', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4');
    const side = await screen.findByRole('navigation', { name: 'Adaeze & Tunde’s wedding' }, WAIT);

    expect(within(side).getByRole('link', { name: 'Guests' }).getAttribute('href')).toBe(
      '/demo/guests',
    );
    await act(() => router.navigate('/demo/events/evt-wed-4?area=guests'));
    expect(router.state.location.pathname).toBe('/demo/guests');
  });
});
