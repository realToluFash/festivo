import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('goes on to the kitchen with Next, and Back there returns here', async () => {
    await guest('withYou');
    fireEvent.click(button('Next'));

    expect(screen.getByRole('heading', { name: 'Anything the kitchen must know?' })).toBeDefined();
    fireEvent.click(button('Back'));
    expect(screen.getByRole('heading', { name: 'Who’s coming with you?' })).toBeDefined();
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
      screen.getByText('You, Chidi Okonkwo-Williams, and Nneka Okonkwo-Williams · 3 people'),
    ).toBeDefined();
  });

  it('holds companions while Not sure yet', async () => {
    await guest('heldNotSure');
    expect(screen.getByText('Your companions are on hold until you decide.')).toBeDefined();
  });

  it('opens on the last choice after Not sure yet', async () => {
    await guest('heldThenBack');

    expect(button('Chidi Okonkwo-Williams is coming').getAttribute('aria-pressed')).toBe('true');
    expect(button('Nneka Okonkwo-Williams is coming').getAttribute('aria-pressed')).toBe('false');
  });
});
