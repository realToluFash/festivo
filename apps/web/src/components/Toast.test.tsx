import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toast } from './Toast.tsx';

describe('the toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.style.removeProperty('--toastLifetime');
  });

  it('closes by itself after ten seconds', () => {
    const onClose = vi.fn();
    render(<Toast words="Guest removed." onClose={onClose} />);

    act(() => vi.advanceTimersByTime(9750));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reads a lifetime the built stylesheet writes in seconds', () => {
    document.documentElement.style.setProperty('--toastLifetime', '10s');
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

  describe('counted (sc-3774)', () => {
    it('shows its seconds, hidden from screen readers, and has no ×', () => {
      render(
        <Toast
          words="Ngozi Eze removed."
          counted={{ said: 'Undo is open for 10 seconds.' }}
          onUndo={() => undefined}
          onClose={() => undefined}
        />,
      );

      expect(screen.getByRole('status').querySelector('.toast-words')?.textContent).toBe(
        'Ngozi Eze removed. Undo is open for 10 seconds.',
      );
      expect(screen.getByText('10 s').getAttribute('aria-hidden')).toBe('true');
      act(() => vi.advanceTimersByTime(3000));
      expect(screen.getByText('7 s')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    });

    it('counts only while focus and the pointer are off it, and starts again from 10 when they leave', () => {
      const onClose = vi.fn();
      render(
        <Toast
          words="Ngozi Eze removed."
          counted={{ said: '' }}
          onUndo={() => undefined}
          onClose={onClose}
        />,
      );

      act(() => vi.advanceTimersByTime(8000));
      fireEvent.pointerEnter(screen.getByRole('status'));
      act(() => vi.advanceTimersByTime(30000));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByText('10 s')).toBeDefined();

      fireEvent.pointerLeave(screen.getByRole('status'));
      act(() => vi.advanceTimersByTime(9000));
      expect(onClose).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1000));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps waiting while focus is on Undo, whatever the pointer does', () => {
      const onClose = vi.fn();
      render(
        <Toast
          words="Ngozi Eze removed."
          counted={{ said: '' }}
          onUndo={() => undefined}
          onClose={onClose}
        />,
      );

      fireEvent.focus(screen.getByRole('button', { name: 'Undo' }));
      fireEvent.pointerEnter(screen.getByRole('status'));
      fireEvent.pointerLeave(screen.getByRole('status'));
      act(() => vi.advanceTimersByTime(30000));
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.blur(screen.getByRole('button', { name: 'Undo' }));
      act(() => vi.advanceTimersByTime(10000));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps waiting while the pointer is on it, though focus moves past', () => {
      const onClose = vi.fn();
      render(
        <Toast
          words="Ngozi Eze removed."
          counted={{ said: '' }}
          onUndo={() => undefined}
          onClose={onClose}
        />,
      );

      fireEvent.pointerEnter(screen.getByRole('status'));
      fireEvent.focus(screen.getByRole('button', { name: 'Undo' }));
      fireEvent.blur(screen.getByRole('button', { name: 'Undo' }));
      act(() => vi.advanceTimersByTime(30000));
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.pointerLeave(screen.getByRole('status'));
      act(() => vi.advanceTimersByTime(10000));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('leaves closing to whoever holds Undo, since its end is what Undo takes back', () => {
      const onUndo = vi.fn();
      const onClose = vi.fn();
      render(
        <Toast
          words="Ngozi Eze removed."
          counted={{ said: '' }}
          onUndo={onUndo}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
