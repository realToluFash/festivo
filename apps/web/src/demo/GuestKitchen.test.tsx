import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { GUEST_KITCHEN_PAGES } from './guestKitchen.ts';

const tested = config();
const NAME = 'Maria Fernanda Albuquerque Santos';
const FIRST = 'Your guest 1';
const SECOND = 'Your guest 2';
const REFUSED =
  'Not saved. This page is out of date. Reload it, then choose again. What you chose stays on screen until you do.';
const plain = window.matchMedia;

function widthIs(width: number): void {
  window.matchMedia = (query: string) => {
    const found = /\(width (<=|<|>=) ([\d.]+)rem\)/u.exec(query);
    const edge = Number(found?.[2] ?? 0) * 16;
    const matches =
      found == null
        ? false
        : found[1] === '<'
          ? width < edge
          : found[1] === '<='
            ? width <= edge
            : width >= edge;

    return { matches, media: query, addEventListener() {}, removeEventListener() {} } as never;
  };
}

async function guest(state?: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [state == null ? '/demo/guest' : `/demo/guest?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('banner');

  return router;
}

async function wait(ms = 1000): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

const heading = () => screen.getByRole('heading', { name: 'Anything the kitchen must know?' });
const card = (legend: string) => screen.getByRole('group', { name: legend });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const kitchenRow = () =>
  button('Change what the kitchen must know').closest('.gk-row') as HTMLElement;

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  // The demo sends nothing: no state, no tap and no Send reaches the network.
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  __setConfig(tested);
  window.matchMedia = plain;
  vi.useRealTimers();
});

describe('the kitchen step in the demo home (sc-3778)', () => {
  it('is linked from the home, every state once, under its own heading', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo'] });
    render(<RouterProvider router={router} />);
    const head = await screen.findByRole('heading', { level: 3, name: /^The kitchen step/u });
    const links = within(head.nextElementSibling as HTMLElement)
      .getAllByRole('link')
      .map((one) => one.getAttribute('href'));

    expect(links).toEqual(GUEST_KITCHEN_PAGES.flatMap((one) => one.states).map((one) => one.to));
    expect(links).toHaveLength(13);
  });
});

const SAYS: [string, () => void][] = [
  ['kitchen', () => expect(heading()).toBe(document.activeElement)],
  ['kitchen_alone', () => screen.getByText('Choose anything that applies to you.')],
  ['kitchen_one_guest', () => card('Your guest')],
  ['kitchen_picked', () => screen.getByText(/^Peanuts and sesame\. The kitchen/u)],
  ['kitchen_say_which', () => screen.getByText('Say which')],
  ['kitchen_returning', () => button('Leave it as it is')],
  [
    'kitchen_access_removed',
    () => screen.getByText('Step-free access will be removed when you send.'),
  ],
  ['check_and_send', () => screen.getByText('Removed: Step-free access')],
  ['kitchen_nothing', () => expect(screen.getAllByText('Nothing to add')).toHaveLength(1)],
  [
    'kitchen_sending',
    () => expect(button('Send my answer').getAttribute('aria-busy')).toBe('true'),
  ],
  [
    'kitchen_not_sent',
    () =>
      screen.getByText('Your answer wasn’t sent. Everything you chose is still here. Try again.'),
  ],
  ['meal_ruled_out', () => screen.getByText('Your guest 1 is allergic to: milk.')],
  ['refused', () => expect(screen.getByRole('alert').textContent).toBe(REFUSED)],
];

describe('every kitchen state, deep-linked by ?state=', () => {
  it('covers every state the home links', () => {
    expect(SAYS.map(([state]) => state)).toEqual(
      GUEST_KITCHEN_PAGES.flatMap((one) => one.states).map(
        (one) => /state=(\w+)/u.exec(one.to)?.[1],
      ),
    );
  });

  it.each(SAYS)('%s', async (state, says) => {
    await guest(state);

    says();
  });
});

describe('the step: after Yes, before Check and send', () => {
  it('Yes leads to it, the heading focused and described by who will see it', async () => {
    await guest();

    fireEvent.click(button('Yes, I’ll be there'));
    expect(document.activeElement).toBe(heading());
    expect(
      document.getElementById(heading().getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe(
      'Only Adaeze Obi and Tunde Bakare and the people who cook and serve your meal will see this.',
    );
    expect(
      screen.getByText('Choose anything that applies to you and to each person coming with you.'),
    ).toBeDefined();
    expect(screen.queryByText('Hosted by')).toBeNull();
  });

  it('has one fieldset per person, legend the person, allergies then diet as named groups', async () => {
    await guest('kitchen');
    const legends = [...document.querySelectorAll('fieldset > legend')].map(
      (one) => one.textContent,
    );

    expect(legends).toEqual(['You', FIRST, SECOND]);
    const you = card('You');
    expect(within(you).getAllByRole('button', { pressed: false })).toHaveLength(15 + 8);
    expect(within(you).getByRole('group', { name: 'Allergies' })).toBeDefined();
    expect(within(you).getByRole('group', { name: 'Diet' })).toBeDefined();
    expect(within(you).getByLabelText(/^Anything else, in your own words/u)).toBeDefined();
    expect(
      within(you).getByLabelText(/^Anything that would make it easier to get in or around\?/u),
    ).toBeDefined();
    expect(within(you).queryByText(/also noted/u)).toBeNull();
  });

  it('marks a picked allergy with “!” and “Allergy”, never colour alone, and says so in a polite region', async () => {
    await guest('kitchen');
    const you = card('You');
    const peanuts = within(you).getByRole('button', { name: /^Peanuts/u });

    fireEvent.click(peanuts);
    expect(peanuts.getAttribute('aria-pressed')).toBe('true');
    expect(peanuts.textContent).toBe('!Peanuts· Allergy');
    fireEvent.click(within(you).getByRole('button', { name: /^Sesame/u }));
    const line = within(you).getByText(
      'Peanuts and sesame. The kitchen and your server will see this.',
    );
    expect(line.closest('[aria-live="polite"]')).not.toBeNull();

    fireEvent.click(within(you).getByRole('button', { name: /^Halal/u }));
    expect(
      within(you)
        .getByRole('button', { name: /^Halal/u })
        .querySelector('svg'),
    ).not.toBeNull();
  });

  it('opens Which allergy? for Other allergy with focus kept on the chip; Next asks Say which, then clears it', async () => {
    await guest('kitchen');
    const you = card('You');
    const other = within(you).getByRole('button', { name: /^Other allergy/u });

    other.focus();
    fireEvent.click(other);
    expect(document.activeElement).toBe(other);
    const which = within(you).getByLabelText('Which allergy?');

    fireEvent.click(button('Next'));
    expect(document.activeElement).toBe(which);
    expect(which.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(which.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Say which',
    );
    expect(heading()).toBeDefined();

    fireEvent.change(which, { target: { value: 'Kiwi' } });
    expect(within(you).queryByText('Say which')).toBeNull();
    expect(within(you).getByText('Kiwi. The kitchen and your server will see this.')).toBeDefined();
    fireEvent.click(button('Next'));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Check and send' }));
    expect(within(kitchenRow()).getByText('Allergy: Kiwi')).toBeDefined();
  });

  it('refuses over 100 characters in any of the three, focus on the first, and Next stays enabled', async () => {
    await guest('kitchen_say_which');
    const ana = card(FIRST);

    expect(within(ana).getByText('Shorten it to 100 characters or fewer.')).toBeDefined();
    fireEvent.change(within(card('You')).getByLabelText('Which allergy?'), {
      target: { value: 'Kiwi' },
    });
    const words = within(card(SECOND)).getByLabelText(/^Anything else/u);
    fireEvent.change(words, { target: { value: 'x'.repeat(101) } });
    expect(
      within(card(SECOND)).queryByText('Shorten it to 100 characters or fewer.'),
    ).not.toBeNull();

    fireEvent.click(button('Next'));
    expect(document.activeElement).toBe(within(ana).getByLabelText('Which allergy?'));
    expect(button('Next').hasAttribute('disabled')).toBe(false);
    expect(words.hasAttribute('maxlength')).toBe(false);
  });

  it('Nothing to add goes on with nothing chosen: the row says it once', async () => {
    await guest('kitchen_picked');

    fireEvent.click(button('Nothing to add'));
    expect(within(kitchenRow()).getAllByText('Nothing to add')).toHaveLength(1);
    expect(within(kitchenRow()).queryByText('You')).toBeNull();
  });

  it('Back goes to the three answers with Yes focused, and Yes comes back with every pick', async () => {
    await guest('kitchen_picked');

    fireEvent.click(button('Back'));
    expect(document.activeElement).toBe(button('Yes, I’ll be there'));
    fireEvent.click(button('Yes, I’ll be there'));
    expect(document.activeElement).toBe(heading());
    expect(
      within(card('You'))
        .getByRole('button', { name: /^Peanuts/u })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('a guest coming alone gets one card, You, and the one-person intro', async () => {
    await guest('kitchen_alone');

    expect(
      [...document.querySelectorAll('fieldset > legend')].map((one) => one.textContent),
    ).toEqual(['You']);
    expect(screen.queryByText(/each person coming with you/u)).toBeNull();
  });
});

describe('a returning guest', () => {
  it('sees each record with who last changed it, the hosts’ picks included', async () => {
    await guest('kitchen_returning');

    expect(
      within(card('You')).getByText(
        'Last changed by Adaeze Obi and Tunde Bakare on Saturday, October 3. Change anything that is not right.',
      ),
    ).toBeDefined();
    expect(
      within(card(FIRST)).getByText('Last changed by you on Tuesday, October 20.'),
    ).toBeDefined();
    expect(within(card(SECOND)).queryByText(/^Last changed/u)).toBeNull();
    expect(
      within(card('You')).getByRole('group', { name: 'Adaeze Obi and Tunde Bakare also noted:' }),
    ).toBeDefined();
    expect(
      within(card(FIRST)).getByDisplayValue('A seat I can reach without stairs'),
    ).toBeDefined();
  });

  it('Remove turns the row into its line with Keep it focused and described by it; Keep it puts it back', async () => {
    await guest('kitchen_returning');

    fireEvent.click(button('Remove Step-free access'));
    const keep = button('Keep it, Step-free access');
    expect(document.activeElement).toBe(keep);
    expect(document.getElementById(keep.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Step-free access will be removed when you send.',
    );
    expect(button('Remove A seat near an exit')).toBeDefined();

    fireEvent.click(keep);
    expect(document.activeElement).toBe(button('Remove Step-free access'));
  });

  it('Leave it as it is puts the record back as it was, the hosts’ access included', async () => {
    await guest('kitchen_access_removed');

    fireEvent.click(within(card('You')).getByRole('button', { name: /^Peanuts/u }));
    fireEvent.click(button('Leave it as it is'));
    const row = kitchenRow();
    expect(within(row).getByText('Allergies: peanuts and sesame')).toBeDefined();
    expect(within(row).getByText('Step-free access')).toBeDefined();
    expect(within(row).queryByText(/^Removed/u)).toBeNull();
  });
});

describe('a returning guest who opens the step without a kitchen link (lead, 4506149260)', () => {
  const recordShown = () => {
    expect(
      within(card('You')).getByText(
        'Last changed by Adaeze Obi and Tunde Bakare on Saturday, October 3. Change anything that is not right.',
      ),
    ).toBeDefined();
    expect(
      within(card(FIRST)).getByText('Last changed by you on Tuesday, October 20.'),
    ).toBeDefined();
    expect(button('Remove Step-free access')).toBeDefined();
    expect(button('Leave it as it is')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Nothing to add' })).toBeNull();
  };

  it('from Update what the kitchen should know, after the date to answer by', async () => {
    await guest('replyByClosed');

    fireEvent.click(button('Update what the kitchen should know'));
    recordShown();
  });

  it('from Change my answer, then Yes', async () => {
    await guest('changing');

    fireEvent.click(button(/^Yes, I’ll be there/u));
    recordShown();
  });

  it('a first reply still opens blank, with Nothing to add', async () => {
    await guest();

    fireEvent.click(button('Yes, I’ll be there'));
    expect(button('Nothing to add')).toBeDefined();
    expect(screen.queryByText(/^Last changed/u)).toBeNull();
  });
});

describe('Check and send, For the kitchen', () => {
  it('reads every person, Change goes back to the step with focus on the heading and nothing lost', async () => {
    await guest('check_and_send');
    const row = kitchenRow();

    expect(within(row).getByText('For the kitchen')).toBeDefined();
    expect(within(row).getByText('“No raw onion, please.”')).toBeDefined();
    expect(
      within(row).getByText('Getting in and around: A seat I can reach without stairs'),
    ).toBeDefined();

    fireEvent.click(button('Change what the kitchen must know'));
    expect(document.activeElement).toBe(heading());
    expect(within(card('You')).getByDisplayValue('No raw onion, please.')).toBeDefined();
  });

  it('Change your answer goes to the three answers, Coming lit', async () => {
    await guest('check_and_send');

    fireEvent.click(button('Change your answer'));
    expect(screen.getByRole('heading', { name: 'Your new answer' })).toBeDefined();
    expect(button(/^Yes, I’ll be there/u).getAttribute('aria-pressed')).toBe('true');
  });

  it('sends: busy with its words, nothing changeable, then the greeting; coming back shows what was sent', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('check_and_send');
    const send = button('Send my answer');

    fireEvent.click(send);
    expect(send.getAttribute('aria-busy')).toBe('true');
    expect(button('Change what the kitchen must know').getAttribute('aria-disabled')).toBe('true');
    await wait();

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: `See you there, ${NAME}.` }),
    );
    expect(screen.queryByText(/Nothing has changed/u)).toBeNull();

    fireEvent.click(button('Change my answer'));
    fireEvent.click(button(/^Yes, I’ll be there/u));
    expect(
      within(card('You')).getByText('Last changed by you on Tuesday, October 27.'),
    ).toBeDefined();
    expect(button('Remove A seat near an exit')).toBeDefined();
    expect(screen.queryByText('Step-free access')).toBeNull();
  });

  it('a failed send shows sc-1439’s line, keeps everything, and sends again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('kitchen_not_sent');

    fireEvent.click(button('Send my answer'));
    expect(screen.queryByRole('alert')).toBeNull();
    await wait();
    expect(screen.getByRole('heading', { name: `See you there, ${NAME}.` })).toBeDefined();
  });
});

describe('refused, the 422', () => {
  it('keeps what was chosen, never says try again, and the same answer is refused again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('refused');

    expect(screen.queryByText(/try again/iu)).toBeNull();
    expect(screen.queryByText(/step_free|422/u)).toBeNull();
    fireEvent.click(button('Send my answer'));
    expect(screen.queryByRole('alert')).toBeNull();
    await wait();

    expect(screen.getByRole('alert').textContent).toBe(REFUSED);
    expect(button('Send my answer').textContent).toBe('Send my answer');
    expect(within(kitchenRow()).getByText('Removed: Step-free access')).toBeDefined();
  });
});

describe('meal_ruled_out (sc-3907’s rule)', () => {
  it('refuses Send before anything goes, focus on the marked row’s Change; unpicking clears it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('meal_ruled_out');
    const change = screen.getByRole('link', { name: `Change ${FIRST}’s meals` });

    expect(document.activeElement).toBe(change);
    expect(
      document.getElementById(change.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Your guest 1 is allergic to: milk.');
    fireEvent.click(button('Send my answer'));
    expect(button('Send my answer').getAttribute('aria-busy')).toBe('false');
    expect(screen.getByRole('alert').textContent).toBe(
      '[A pick contains an allergen. Change it before you send.]',
    );

    fireEvent.click(button('Change what the kitchen must know'));
    fireEvent.click(within(card(FIRST)).getByRole('button', { name: /^Milk/u }));
    fireEvent.click(button('Next'));
    expect(screen.queryByText(/is allergic to/u)).toBeNull();
    fireEvent.click(button('Send my answer'));
    await wait();
    expect(screen.getByRole('heading', { name: `See you there, ${NAME}.` })).toBeDefined();
  });
});

describe('after the date to answer by (sc-3780)', () => {
  it('Update what the kitchen should know opens the step on its own: For the kitchen, Save and Leave it as it is', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('replyByClosed');
    const update = () => button('Update what the kitchen should know');

    fireEvent.click(update());
    expect(document.activeElement).toBe(heading());
    const step = heading().closest('section')!;
    expect(within(step).getByText('For the kitchen')).toBeDefined();
    expect(
      within(step).getByText(
        'Your answer stays Coming, and who is coming with you stays the same.',
      ),
    ).toBeDefined();
    expect(within(step).queryByRole('button', { name: 'Next' })).toBeNull();
    fireEvent.click(button('Back'));
    expect(document.activeElement).toBe(update());

    fireEvent.click(update());
    fireEvent.click(within(card('You')).getByRole('button', { name: /^Vegan/u }));
    fireEvent.click(button('Save'));
    expect(button('Save').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Check and send' })).toBeNull();
    await wait();

    expect(document.activeElement).toBe(update());
    expect(screen.getByText(/^Answers closed on Friday, October 30\./u)).toBeDefined();
    fireEvent.click(update());
    expect(within(card('You')).getByRole('button', { name: /^Vegan/u })).toHaveProperty(
      'ariaPressed',
      'true',
    );
  });

  it('Leave it as it is puts the record back and returns to Update; nothing is sent', async () => {
    await guest('replyByClosedKitchen');

    fireEvent.click(within(card('You')).getByRole('button', { name: /^Vegan/u }));
    fireEvent.click(button('Leave it as it is'));
    expect(document.activeElement).toBe(button('Update what the kitchen should know'));
    expect(screen.queryByText('Saved. The kitchen will see this.')).toBeNull();
    fireEvent.click(button('Update what the kitchen should know'));
    expect(within(card('You')).getByRole('button', { name: /^Vegan/u })).toHaveProperty(
      'ariaPressed',
      'false',
    );
  });

  it('Save keeps the step’s Say which check and sends nothing until it is named', async () => {
    await guest('replyByClosedKitchen');

    fireEvent.click(within(card('You')).getByRole('button', { name: /^Other allergy/u }));
    fireEvent.click(button('Save'));
    expect(screen.getByText('Say which')).toBeDefined();
    expect(button('Save').getAttribute('aria-busy')).toBe('false');
  });

  it('once saved, says “Saved. The kitchen will see this.” under the reply, Update focused and described by it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('replyByClosedKitchen');
    const update = () => button('Update what the kitchen should know');

    expect(screen.queryByText('Saved. The kitchen will see this.')).toBeNull();
    fireEvent.click(button('Save'));
    await wait();

    const saved = screen.getByRole('status');
    expect(saved.textContent).toBe('Saved. The kitchen will see this.');
    const reply = screen.getByRole('heading', {
      name: 'You answered Coming on Tuesday, October 27.',
    });
    expect(reply.nextElementSibling).toBe(saved);
    expect(document.activeElement).toBe(update());
    expect(
      document.getElementById(update().getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Saved. The kitchen will see this.');

    fireEvent.click(update());
    fireEvent.click(button('Back'));
    expect(screen.getByRole('status').textContent).toBe('Saved. The kitchen will see this.');
    fireEvent.click(update());
    fireEvent.click(button('Leave it as it is'));
    expect(screen.getByRole('status').textContent).toBe('Saved. The kitchen will see this.');
  });

  it('?state=replyByClosedSaved opens on the saved line, Update focused', async () => {
    await guest('replyByClosedSaved');

    expect(screen.getByRole('status').textContent).toBe('Saved. The kitchen will see this.');
    expect(document.activeElement).toBe(button('Update what the kitchen should know'));
  });
});

describe('a companion the host never named (sc-3778, 8 Nov)', () => {
  it('is “Your guest” alone, and “Your guest 1”, “Your guest 2” when there are more', async () => {
    await guest('kitchen_one_guest');
    expect(card('Your guest')).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Your guest 1' })).toBeNull();
    cleanup();

    await guest('kitchen');
    expect(card('Your guest 1')).toBeDefined();
    expect(card('Your guest 2')).toBeDefined();
  });
});

describe('the step in Spanish and Portuguese (lead, 4506242145)', () => {
  it.each([
    [
      'es',
      '[Sí, asistiré]',
      '[¿Hay algo que la cocina deba saber?]',
      '[Su invitado 1]',
      '[Cacahuetes]',
    ],
    [
      'pt',
      '[Sim, vou estar presente]',
      '[Há alguma coisa que a cozinha deva saber?]',
      '[O seu convidado 1]',
      '[Amendoins]',
    ],
  ])(
    '?state=%s reads the step in its bracketed samples',
    async (state, yes, title, first, peanuts) => {
      await guest(state);

      fireEvent.click(button(yes));
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: title }));
      expect(card(first)).toBeDefined();
      expect(within(card(first)).getByRole('button', { name: peanuts })).toBeDefined();
    },
  );
});

describe('the layouts', () => {
  it.each([
    [320, 'is-small', 'is-one'],
    [390, 'is-phone', 'is-one'],
    [834, 'is-upright', 'is-one'],
    [1194, 'is-side', 'is-two'],
    [1280, 'is-desk', 'is-two'],
  ] as const)(
    '%i wide: the step under the cover, alone, in %s %s',
    async (width, layout, columns) => {
      widthIs(width);
      await guest('kitchen');
      const order = [...document.querySelectorAll('.gp-columns > *')].map(
        (one) => one.className.split(' ')[0],
      );

      expect(document.querySelector('.gp')?.classList.contains(layout)).toBe(true);
      expect(document.querySelector('main')?.classList.contains(columns)).toBe(true);
      expect(order).toEqual(['gp-cover', 'gp-under']);
    },
  );
});
