import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActionPair } from './ActionPair.tsx';

function aWindowThatTurns() {
  let phone = false;
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        get matches() {
          return phone;
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      }) as never,
  );

  return (narrow: boolean) => {
    phone = narrow;
    act(() => listeners.forEach((listener) => listener()));
  };
}

function aPair() {
  render(
    <>
      <ActionPair
        className="dialog-actions"
        dismiss={<button type="button">Keep it</button>}
        confirm={<button type="button">Remove it</button>}
      />
      <button type="button">Elsewhere</button>
    </>,
  );
}

const order = () =>
  [...screen.getByRole('button', { name: 'Keep it' }).parentElement!.children].map(
    (button) => button.textContent,
  );

describe('a pair of actions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('takes a class beside its own', () => {
    aWindowThatTurns();
    aPair();

    expect(screen.getByRole('button', { name: 'Keep it' }).parentElement!.className).toBe(
      'actions actions-pair dialog-actions',
    );
  });

  it('gives focus back to its button when a turn moves it and the browser drops it', () => {
    const turn = aWindowThatTurns();
    aPair();
    const keep = screen.getByRole('button', { name: 'Keep it' });

    keep.focus();
    keep.blur();
    turn(true);

    expect(order()).toEqual(['Remove it', 'Keep it']);
    expect(document.activeElement).toBe(keep);
  });

  it('leaves focus where it went once it has left the pair', () => {
    const turn = aWindowThatTurns();
    aPair();
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });

    screen.getByRole('button', { name: 'Keep it' }).focus();
    elsewhere.focus();
    turn(true);

    expect(document.activeElement).toBe(elsewhere);
  });
});
