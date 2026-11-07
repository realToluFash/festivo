import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { startSwitcher } from './switcher.ts';

const tested = config();
const SLOW = { timeout: 8000 };
const WALK = 'Create an organisation';

function open(path: string): void {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

async function walk(): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: WALK }, SLOW);
}

function press(key: string): void {
  fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

describe('creating an organisation in B · A short walk at a desk (sc-30335)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    startSwitcher(null);
  });

  it('refuses Continue with no name, then goes on to the country', SLOW, async () => {
    open('/demo/events?create=name');
    const dialog = await walk();
    const field = screen.getByLabelText('Organisation name');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('alert').textContent).toBe("Enter the organisation's name.");
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);

    fireEvent.change(field, { target: { value: 'Lumen Feiras' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

    const question = screen.getByRole('heading', { level: 1, name: 'Where is it based?' });
    expect(document.activeElement).toBe(question);
    expect(
      screen
        .getAllByRole('option', { name: 'Portugal, Euro (EUR)' })[0]
        ?.getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('searches the countries, and picks one with the keyboard', SLOW, async () => {
    open('/demo/events?create=country');
    await walk();
    const search = screen.getByRole('searchbox', { name: 'Search countries' });

    fireEvent.change(search, { target: { value: 'bra' } });
    const listbox = screen.getByRole('listbox', { name: 'Country' });
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((one) => one.textContent),
    ).toEqual([
      'BrazilBrazilian Real (BRL)',
      'Congo - BrazzavilleCentral African CFA Franc (XAF)',
      'GibraltarGibraltar Pound (GIP)',
    ]);

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    const brazil = screen.getByRole('option', { name: 'Brazil, Brazilian Real (BRL)' });
    expect(document.activeElement).toBe(brazil);
    fireEvent.keyDown(brazil, { key: 'Enter' });
    expect(brazil.getAttribute('aria-selected')).toBe('true');
  });

  it('names Antarctica’s currency as none yet', SLOW, async () => {
    open('/demo/events?create=country');
    await walk();

    expect(screen.getByRole('option', { name: 'Antarctica, None yet' })).toBeDefined();
  });

  it(
    'asks before discarding what is entered, and closes at once when nothing is',
    SLOW,
    async () => {
      open('/demo/events?create=typing');
      const dialog = await walk();
      press('Escape');

      const ask = await screen.findByRole('alertdialog', { name: 'Discard this organisation?' });
      fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(document.activeElement).toBe(screen.getByLabelText('Organisation name'));

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: WALK })).toBeNull());
      cleanup();

      open('/demo/events?create=name');
      await walk();
      press('Escape');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: WALK })).toBeNull());
      expect(screen.queryByRole('alertdialog')).toBeNull();
    },
  );

  it(
    'creates it, onto the page now its own, with focus on the button naming it',
    SLOW,
    async () => {
      open('/demo/events?create=ready');
      await walk();
      fireEvent.click(screen.getByRole('button', { name: 'Create organisation' }));

      const busy = screen.getByRole('button', { name: 'Creating…' });
      expect(busy.hasAttribute('disabled')).toBe(true);
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

      const notice = await screen.findByText('Now working in Lumen Feiras.', {}, SLOW);
      expect(notice.closest('[role="status"]')).not.toBeNull();
      const button = screen.getByRole('button', { name: /^Organisation: Lumen Feiras/ });
      await waitFor(() => expect(document.activeElement).toBe(button));
      expect(screen.getByRole('heading', { name: 'Set up your first event' })).toBeDefined();
    },
  );

  it('holds too many for now, and says when to try again', SLOW, async () => {
    open('/demo/events?create=limited');
    await walk();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Too many new organisations for now.');
    expect(alert.textContent).toContain('Try again at 10:41.');
  });

  it('opens from no organisation, and lands on Today with the notice focused', SLOW, async () => {
    open('/demo/today?orgs=none');

    await screen.findByRole('heading', { level: 1, name: 'You are not in an organisation' });
    const start = screen.getByRole('button', { name: 'Start organisation' });
    expect(document.activeElement).toBe(start);
    fireEvent.click(start);
    expect(await walk()).toBeDefined();
    cleanup();

    open('/demo/today?orgs=none&create=created');
    const notice = await screen.findByText('Now working in Lumen Feiras.', {}, SLOW);
    await waitFor(() => expect(document.activeElement).toBe(notice.closest('.sw-notice')));
    expect(screen.getByRole('button', { name: 'Start your first event' })).toBeDefined();
  });
});
