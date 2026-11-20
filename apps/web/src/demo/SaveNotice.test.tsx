import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample, sampleEvent } from './events.ts';
import { SAVE_WORDS, type SaveAnswer } from './saveAnswer.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WEDDING = 'Adaeze & Tunde’s wedding';

async function page(state: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, {
        initialEntries: [`/demo/events/evt-wed-4?state=${state}`],
      })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: WEDDING }, { timeout: 8000 });
}

const part = (name: string): HTMLElement => {
  const found = screen
    .getAllByRole('group', { name })
    .find((group) => group.classList.contains('ev-opened'));

  if (found == null) throw new Error(`${name} is not open`);

  return found;
};

/** The notice sits after everything else in the part, with Cancel and Save the very next thing. */
function directlyAboveSave(group: HTMLElement): HTMLElement {
  const notices = within(group).getAllByRole('alert');

  expect(notices).toHaveLength(1);

  const said = notices[0]?.parentElement;

  expect(said?.classList.contains('ev-save-said')).toBe(true);
  expect(said?.nextElementSibling?.classList.contains('ev-opened-actions')).toBe(true);
  expect(said?.nextElementSibling?.nextElementSibling ?? null).toBeNull();

  return notices[0] as HTMLElement;
}

let fetching: ReturnType<typeof vi.spyOn>;
let scrolled: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;
  resetSample();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  __setConfig(tested);
});

const CASES: readonly (readonly [string, string, SaveAnswer])[] = [
  ['nameNotSaved', 'Event name', 'notSaved'],
  ['nameForbidden', 'Event name', 'forbidden'],
  ['nameChangedElsewhere', 'Event name', 'changedElsewhere'],
  ['currencyNotSaved', 'Currency', 'notSaved'],
  ['currencyForbidden', 'Currency', 'forbidden'],
  ['currencyChangedElsewhere', 'Currency', 'changedElsewhere'],
];

describe('A part’s save notices sit directly above Cancel and Save (sc-74398)', () => {
  it.each(CASES)(
    '%s: after the fields, focus on Save, one notice however often',
    SLOW,
    async (state, name, answer) => {
      await page(state);

      const save = within(part(name)).getByRole('button', { name: 'Save' });

      expect(within(part(name)).queryByRole('alert')).toBeNull();
      save.focus();
      fireEvent.click(save);

      expect(directlyAboveSave(part(name)).textContent).toContain(SAVE_WORDS[answer]);
      expect(document.activeElement).toBe(save);
      expect(scrolled).toHaveBeenCalled();

      fireEvent.click(save);
      expect(directlyAboveSave(part(name)).textContent).toContain(SAVE_WORDS[answer]);
      expect(document.activeElement).toBe(save);
      expect(sampleEvent('evt-wed-4')?.name).toBe(WEDDING);
    },
  );

  it(
    'puts Show the latest before Cancel, so Shift+Tab from Save reaches it after Cancel',
    SLOW,
    async () => {
      await page('nameChangedElsewhere');
      fireEvent.click(within(part('Event name')).getByRole('button', { name: 'Save' }));

      const buttons = within(part('Event name')).getAllByRole('button');
      const names = buttons.map((button) => button.textContent);

      expect(names.slice(-3)).toEqual(['Show the latest', 'Cancel', 'Save']);
    },
  );

  it('Show the latest asks, then takes the latest and the notice goes', SLOW, async () => {
    await page('currencyChangedElsewhere');
    fireEvent.click(within(part('Currency')).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(part('Currency')).getByRole('button', { name: 'Show the latest' }));

    const ask = await screen.findByRole('alertdialog', { name: 'Show the latest version?' });

    fireEvent.click(within(ask).getByRole('button', { name: 'Show the latest' }));
    expect(within(part('Currency')).queryByRole('alert')).toBeNull();
  });

  it('Dates, changed elsewhere: the notice opens above Cancel and Save', SLOW, async () => {
    await page('changedElsewhere');

    expect(directlyAboveSave(part('Dates')).textContent).toContain(SAVE_WORDS.changedElsewhere);
  });
});
