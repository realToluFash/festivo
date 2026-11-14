import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/messages';
const ITEM = 'Stop Inês Duarte writing from their page…';
const TITLE = 'Stop Inês Duarte writing from their page?';
const GO = 'Stop';
const SEEDED = 'Tunde Bakare stopped them writing from their page on Mon, Nov 2.';
const LIVE = 'You stopped them writing from their page on Tue, Nov 3.';

async function messages(state: string): Promise<void> {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function more(): HTMLElement {
  return screen.getByRole('button', { name: 'More actions' });
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

describe('stop writing from their page, at a desk (sc-3978)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    cleanup();
  });

  it('stops Inês Duarte after asking once, then lets them write again', SLOW, async () => {
    await messages('conversation');

    expect(more().getAttribute('aria-haspopup')).toBe('menu');
    expect(more().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more());
    expect(more().getAttribute('aria-expanded')).toBe('true');
    const item = within(screen.getByRole('menu', { name: 'More actions' })).getByRole('menuitem');

    expect(item.textContent).toBe(ITEM);
    await waitFor(() => expect(document.activeElement).toBe(item), WAIT);
    fireEvent.click(item);

    const ask = screen.getByRole('alertdialog', { name: TITLE });
    const buttons = within(ask).getAllByRole('button');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(within(ask).getByText(/^The box to write to you leaves their page/u)).toBeDefined();
    expect(buttons.map((one) => one.textContent)).toEqual(['Cancel', GO]);
    expect(buttons[1]?.classList.contains('is-red')).toBe(false);
    fireEvent.click(buttons[1] as HTMLElement);
    expect(within(ask).getByRole('button', { name: GO }).getAttribute('aria-busy')).toBe('true');

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);
    const line = screen.getByText(LIVE);

    await waitFor(() => expect(document.activeElement).toBe(line), WAIT);
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Let them write again' }));
    expect(
      screen.getByRole('button', { name: 'Let them write again' }).getAttribute('aria-busy'),
    ).toBe('true');
    await waitFor(() => expect(screen.queryByText(LIVE)).toBeNull(), WAIT);
    await waitFor(
      () => expect(said()).toContain('Inês Duarte can write from their page again.'),
      WAIT,
    );
    await waitFor(() => expect(document.activeElement).toBe(more()), WAIT);
  });

  it(
    'closes the menu on Escape and the confirm on Escape, focus back on More actions',
    SLOW,
    async () => {
      await messages('stopAction');
      const item = within(screen.getByRole('menu', { name: 'More actions' })).getByRole('menuitem');

      await waitFor(() => expect(document.activeElement).toBe(item), WAIT);
      fireEvent.keyDown(item, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(item);
      fireEvent.keyDown(item, { key: 'Escape' });
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(more());

      fireEvent.click(more());
      fireEvent.click(await screen.findByRole('menuitem', { name: ITEM }));
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(more()), WAIT);
      expect(screen.queryByText(LIVE)).toBeNull();
    },
  );

  it('opens stopAsk asked, and Cancel changes nothing', SLOW, async () => {
    await messages('stopAsk');
    const ask = screen.getByRole('alertdialog', { name: TITLE });

    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.querySelector('.mgs-inset')).toBeNull();
  });

  it(
    'keeps the confirm open with Not saved when refused, and the next press stops them',
    SLOW,
    async () => {
      await messages('stopFailed');
      const ask = screen.getByRole('alertdialog', { name: TITLE });

      expect(within(ask).getByRole('alert').textContent).toBe('Not saved. Try again.');
      fireEvent.click(within(ask).getByRole('button', { name: GO }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);
      expect(screen.getByText(LIVE)).toBeDefined();
    },
  );

  it('shows who stopped them, and Let them write again in the menu too', SLOW, async () => {
    await messages('stopped');

    expect(screen.getByText(SEEDED)).toBeDefined();
    fireEvent.click(more());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Let them write again' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(screen.queryByText(SEEDED)).toBeNull(), WAIT);
  });

  it(
    'keeps the inset with Not saved when letting them write again is refused, then lets them',
    SLOW,
    async () => {
      await messages('letAgainFailed');
      const inset = document.querySelector('.mgs-inset') as HTMLElement;

      expect(within(inset).getByRole('alert').textContent).toBe('Not saved. Try again.');
      fireEvent.click(within(inset).getByRole('button', { name: 'Let them write again' }));
      expect(within(inset).queryByRole('alert')).toBeNull();
      await waitFor(() => expect(document.querySelector('.mgs-inset')).toBeNull(), WAIT);
    },
  );

  it.each(['noManage', 'stoppedNoManage'])(
    'has no More actions in %s, without messages.manage',
    SLOW,
    async (state) => {
      await messages(state);

      expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Let them write again' })).toBeNull();
      if (state === 'stoppedNoManage') expect(screen.getByText(SEEDED)).toBeDefined();
      else expect(screen.queryByText(SEEDED)).toBeNull();
    },
  );

  it('offers no More actions on a sender not matched to a guest', SLOW, async () => {
    await messages('notMatched');

    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });
});
