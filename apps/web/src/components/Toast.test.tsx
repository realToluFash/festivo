import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toast } from './Toast.tsx';

describe('the toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closes by itself after ten seconds', () => {
    const onClose = vi.fn();
    render(<Toast words="Guest removed." onClose={onClose} />);

    act(() => vi.advanceTimersByTime(9750));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('waits while the pointer is on it, so Undo is still there to reach', () => {
    const onClose = vi.fn();
    render(<Toast words="Guest removed." onUndo={() => undefined} onClose={onClose} />);

    fireEvent.pointerEnter(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(20000));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.pointerLeave(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(10000));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('takes it back with Undo, and closes', () => {
    const onUndo = vi.fn();
    const onClose = vi.fn();
    render(<Toast words="Guest removed." onUndo={onUndo} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers no Undo when there is nothing to take back', () => {
    render(<Toast words="Saved." onClose={() => undefined} />);

    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
