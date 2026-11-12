import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

async function guest(state: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/demo/guest?state=${state}`] })}
    />,
  );
  await screen.findByRole('banner', undefined, { timeout: 15000 });
}

const step = () =>
  screen.getByRole('heading', { name: 'Who’s coming with you?' }).closest('section')!;
const button = (name: string | RegExp) => screen.getByRole('button', { name });

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  __setConfig(tested);
  vi.useRealTimers();
});

describe('Who’s coming with you? on the guest’s page (sc-3779)', { timeout: 20000 }, () => {
  it('lists the guest as That’s you, then each companion with a Coming toggle', async () => {
    await guest('withYou');

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Who’s coming with you?' }),
    );
    expect(
      within(step()).getByText(
        'Adaeze Obi and Tunde Bakare have saved places for you and up to 2 others.',
      ),
    ).toBeDefined();
    expect(within(step()).getByText('That’s you')).toBeDefined();
    const toggle = button('Chidi Okonkwo-Williams is coming');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.textContent).toBe('Not coming');
  });

  it('adds a named companion while places remain, and no blank one', async () => {
    await guest('withYou');
    fireEvent.click(button('Add someone · 1 place left'));
    const field = screen.getByRole('textbox', { name: 'Their name' });

    expect(document.activeElement).toBe(field);
    fireEvent.click(button('Add someone · 1 place left'));
    expect(button('Type their name')).toBeDefined();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(field, { target: { value: 'Nneka Okonkwo-Williams' } });
    fireEvent.click(button('Add someone · 1 place left'));
    expect(button('Nneka Okonkwo-Williams is coming')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Add someone/u })).toBeNull();
  });

  it('renames a companion by selecting the name', async () => {
    await guest('withYou');
    fireEvent.click(button('Change Chidi Okonkwo-Williams’s name'));
    const field = screen.getByRole('textbox', { name: 'Their name' });

    fireEvent.change(field, { target: { value: 'Chidi Okonkwo' } });
    fireEvent.click(button('Done'));
    expect(button('Change Chidi Okonkwo’s name')).toBeDefined();
    expect(within(step()).getAllByText('Named by you')).toHaveLength(1);
  });

  it('goes on to the kitchen with Next, each person by name, and Back there returns here', async () => {
    await guest('withYou');
    fireEvent.click(button('Add someone · 1 place left'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Their name' }), {
      target: { value: 'Nneka Okonkwo-Williams' },
    });
    fireEvent.click(button('Add someone · 1 place left'));
    fireEvent.click(button('Chidi Okonkwo-Williams is coming'));
    fireEvent.click(button('Next'));

    const step = screen
      .getByRole('heading', { name: 'Anything the kitchen must know?' })
      .closest('section')!;
    expect(within(step).getAllByText('Nneka Okonkwo-Williams').length).toBeGreaterThan(0);
    expect(within(step).queryByText('Chidi Okonkwo-Williams')).toBeNull();
    expect(within(step).queryByText(/^Your (first |)guest/u)).toBeNull();
    fireEvent.click(button('Back'));
    expect(screen.getByRole('heading', { name: 'Who’s coming with you?' })).toBeDefined();
  });

  it('keeps a returning guest’s record through the step, each person by name', async () => {
    await guest('comingWithCompanions');
    fireEvent.click(button('Change my answer'));
    fireEvent.click(button(/^Yes, I’ll be there/u));
    fireEvent.click(button('Next'));

    const you = screen.getByRole('group', { name: 'You' });
    expect(
      within(you).getByText(
        'Last changed by Adaeze Obi and Tunde Bakare on Saturday, October 3. Change anything that is not right.',
      ),
    ).toBeDefined();
    expect(button('Remove Step-free access')).toBeDefined();
    const chidi = screen.getByRole('group', { name: 'Chidi Okonkwo-Williams' });
    expect(within(chidi).getByText(/^Last changed by you on /u)).toBeDefined();
    expect(within(chidi).getByDisplayValue('A seat I can reach without stairs')).toBeDefined();
    expect(button('Leave it as it is')).toBeDefined();

    fireEvent.click(button('Back'));
    fireEvent.click(button('Chidi Okonkwo-Williams is coming'));
    fireEvent.click(button('Next'));
    expect(screen.queryByRole('group', { name: 'Chidi Okonkwo-Williams' })).toBeNull();
    fireEvent.click(button('Back'));
    fireEvent.click(button('Chidi Okonkwo-Williams is coming'));
    fireEvent.click(button('Next'));

    const back = screen.getByRole('group', { name: 'Chidi Okonkwo-Williams' });
    expect(within(back).getByText(/^Last changed by you on /u)).toBeDefined();
    expect(within(back).getByDisplayValue('A seat I can reach without stairs')).toBeDefined();
    expect(button('Leave it as it is')).toBeDefined();
  });

  it('keeps the names when the guest has nothing to add', async () => {
    await guest('withYou');
    fireEvent.click(button('Add someone · 1 place left'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Their name' }), {
      target: { value: 'Nneka Okonkwo-Williams' },
    });
    fireEvent.click(button('Add someone · 1 place left'));
    fireEvent.click(button('Next'));
    fireEvent.click(button('Nothing to add'));
    fireEvent.click(button('Change what the kitchen must know'));

    expect(screen.getByRole('group', { name: 'Nneka Okonkwo-Williams' })).toBeDefined();
    expect(screen.queryByRole('group', { name: /^Your (first |)guest/u })).toBeNull();
  });

  it('words the step in the guest’s language', async () => {
    await guest('withYou');
    fireEvent.click(button('Language: English'));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Français' }));

    expect(screen.getByRole('heading', { name: '[Qui vient avec vous ?]' })).toBeDefined();
  });

  it('is reached from Coming, and skipped with no places', async () => {
    await guest('withYouNoPlaces');
    fireEvent.click(button(/^Yes, I’ll be there/u));

    expect(screen.queryByRole('heading', { name: 'Who’s coming with you?' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Anything the kitchen must know?' })).toBeDefined();
  });

  it('lists who is coming on Check and send', async () => {
    await guest('checkWithCompanions');

    expect(
      screen.getByText(/^You, Chidi Okonkwo-Williams,? and Nneka Okonkwo-Williams · 3 people$/u),
    ).toBeDefined();
  });

  it('holds companions while Not sure yet, and says nothing of them with no places', async () => {
    await guest('heldNotSure');
    expect(screen.getByText('Your companions are on hold until you decide.')).toBeDefined();
  });

  it('has no held line for a guest with no places', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('withYouNoPlaces');
    fireEvent.click(button(/^I’m not sure yet/u));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(screen.getByRole('heading', { name: /^Thanks for letting us know/u })).toBeDefined();
    expect(screen.queryByText('Your companions are on hold until you decide.')).toBeNull();
  });

  it('opens on the last choice after Not sure yet', async () => {
    await guest('heldThenBack');

    expect(button('Chidi Okonkwo-Williams is coming').getAttribute('aria-pressed')).toBe('true');
    expect(button('Nneka Okonkwo-Williams is coming').getAttribute('aria-pressed')).toBe('false');
  });
});
