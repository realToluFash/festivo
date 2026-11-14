import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function guests(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/guests?state=${state}`],
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function column(): HTMLElement {
  return screen.getByRole('main').querySelector<HTMLElement>('.gs-column') as HTMLElement;
}

function row(name: RegExp): HTMLElement | null {
  return screen.queryByRole('link', { name });
}

function undoMessage(): HTMLElement {
  return screen
    .getByText(/removed/u, { selector: '.toast-words' })
    .closest('.toast') as HTMLElement;
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Remove from the list (sc-3774)', () => {
  it(
    'offers Remove at the foot of Details, and asks with Keep on the list focused',
    SLOW,
    async () => {
      await guests('removeOffered');
      fireEvent.click(within(column()).getByRole('button', { name: 'Remove from the list' }));

      const dialog = await screen.findByRole('alertdialog', { name: 'Remove Dr Emeka Nwosu?' });

      expect(dialog.textContent).toContain('No reply');
      expect(dialog.textContent).toContain('Their reply');
      expect(dialog.textContent).toContain('Adanna Nwosu');
      expect(dialog.textContent).toContain('Companion · Held');
      expect(dialog.textContent).toContain('Nothing is sent to them.');
      await waitFor(
        () =>
          expect(document.activeElement).toBe(
            within(dialog).getByRole('button', { name: 'Keep on the list' }),
          ),
        WAIT,
      );
    },
  );

  it('Keep on the list changes nothing and goes back to Remove', SLOW, async () => {
    await guests('removeAsk');
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Dr Emeka Nwosu?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep on the list' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(row(/^Dr Emeka Nwosu/u)).not.toBeNull();
    await waitFor(
      () =>
        expect(document.activeElement).toBe(
          within(column()).getByRole('button', { name: 'Remove from the list' }),
        ),
      WAIT,
    );
  });

  it(
    'names a seat and a meal only where they exist, and an unnamed companion as Guest of',
    SLOW,
    async () => {
      await guests('removeAskSeated');
      const seated = await screen.findByRole('alertdialog', { name: 'Remove Inês Duarte?' });

      expect(seated.textContent).toContain('Companion · Coming · seated at Table 4 · meal chosen');
    },
  );

  it(
    'Remove takes them and their companion off at once, focus on Undo, and the counts drop',
    SLOW,
    async () => {
      await guests('removeAsk');
      expect(screen.getByRole('button', { name: /^No reply · 21/u })).toBeDefined();
      const dialog = await screen.findByRole('alertdialog', { name: 'Remove Dr Emeka Nwosu?' });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

      expect(row(/^Dr Emeka Nwosu/u)).toBeNull();
      expect(screen.getByRole('button', { name: /^No reply · 20/u })).toBeDefined();
      expect(undoMessage().textContent).toContain('Dr Emeka Nwosu removed, with Adanna Nwosu.');
      expect(undoMessage().textContent).toContain('Undo is open for 10 seconds.');
      await waitFor(
        () => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo' })),
        WAIT,
      );
    },
  );

  it('Undo puts them back with their details open and focus on their name', SLOW, async () => {
    await guests('removed');
    expect(row(/^Dr Emeka Nwosu/u)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(row(/^Dr Emeka Nwosu/u)).not.toBeNull();
    expect(screen.getByRole('button', { name: /^No reply · 21/u })).toBeDefined();
    expect(column().textContent).toContain('Back on the list.');
    await waitFor(
      () =>
        expect(document.activeElement).toBe(
          within(column()).getByRole('heading', { level: 2, name: 'Dr Emeka Nwosu' }),
        ),
      WAIT,
    );
  });

  it('counts 10 seconds only while focus and the pointer are off the message', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guests('removed');
    const message = undoMessage();

    await waitFor(
      () => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo' })),
      WAIT,
    );
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(message.textContent).toContain('10 s');

    act(() => {
      (document.activeElement as HTMLElement).blur();
      fireEvent.blur(screen.getByRole('button', { name: 'Undo' }));
      vi.advanceTimersByTime(4000);
    });
    expect(message.textContent).toContain('6 s');

    act(() => {
      fireEvent.pointerEnter(message);
      vi.advanceTimersByTime(3000);
    });
    expect(message.textContent).toContain('10 s');

    act(() => {
      fireEvent.pointerLeave(message);
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(row(/^Dr Emeka Nwosu/u)).toBeNull();
  });

  it('an arrived guest shows Arrival · Arrived and no Remove', SLOW, async () => {
    await guests('removeArrived');

    expect(column().textContent).toContain('Arrived');
    expect(column().textContent).toContain('They have arrived, so they stay on the list.');
    expect(within(column()).queryByRole('button', { name: 'Remove from the list' })).toBeNull();
  });

  it('a 409 says they have just arrived, and goes back to their details', SLOW, async () => {
    await guests('removeArrives');
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Kwame Mensah?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(dialog.textContent).toContain(
      'Kwame Mensah has just arrived, so they stay on the list.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to their details' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(row(/^Kwame Mensah/u)).not.toBeNull();
    expect(within(column()).queryByRole('button', { name: 'Remove from the list' })).toBeNull();
    expect(column().textContent).toContain('They have arrived, so they stay on the list.');
  });

  it('a 404 says someone else removed them, and Back to guests drops the row', SLOW, async () => {
    await guests('removeGoes');
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Tomás Ferreira?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(dialog.textContent).toContain('Tomás Ferreira was already removed by someone else.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to guests' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(row(/^Tomás Ferreira/u)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('without guests.manage there is no Remove', SLOW, async () => {
    await guests('removeViewer');

    expect(within(column()).queryByRole('button', { name: 'Remove from the list' })).toBeNull();
  });
});
