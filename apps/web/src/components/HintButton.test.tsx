import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { HINT_LINGER_MS, HintButton, LONG_PRESS_MS } from './HintButton.tsx';

beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class StandIn extends MouseEvent {
      pointerType: string;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerType = init.pointerType ?? 'mouse';
      }
    }
    Object.defineProperty(window, 'PointerEvent', { value: StandIn, configurable: true });
  }
});

afterEach(cleanup);

function shown() {
  const onClick = vi.fn();
  render(
    <HintButton id="hb" label="Edit Jollof rice" hint="Edit" onClick={onClick}>
      <span />
    </HintButton>,
  );
  const button = screen.getByRole('button', { name: 'Edit Jollof rice' });

  return { button, wrap: button.parentElement as HTMLElement, onClick };
}

describe('the hint over a round button (WCAG 1.4.13)', () => {
  it('is dismissed with Esc while hovered, and comes back on the next hover', () => {
    const { wrap } = shown();
    fireEvent.pointerEnter(wrap);
    expect(wrap.classList.contains('is-dismissed')).toBe(false);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(wrap.classList.contains('is-dismissed')).toBe(true);

    fireEvent.pointerLeave(wrap);
    expect(wrap.classList.contains('is-dismissed')).toBe(false);
  });

  it('is dismissed with Esc while focused, and focus stays on the button', () => {
    const { button, wrap } = shown();
    act(() => button.focus());
    fireEvent.keyDown(button, { key: 'Escape' });

    expect(wrap.classList.contains('is-dismissed')).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('keeps the hint inside the hovered area, so the pointer can move onto it', () => {
    const { wrap } = shown();

    expect(wrap.querySelector('.mn-hint')?.parentElement).toBe(wrap);
  });

  it('does nothing when disabled', () => {
    cleanup();
    const onClick = vi.fn();
    render(
      <HintButton id="hb" label="Up" hint="Up" disabled onClick={onClick}>
        <span />
      </HintButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Up' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows on a long press, and lifting the finger then does not press the button', () => {
    vi.useFakeTimers();
    try {
      const { button, wrap, onClick } = shown();
      fireEvent.pointerDown(button, { pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      expect(wrap.classList.contains('is-held')).toBe(true);

      fireEvent.pointerUp(button, { pointerType: 'touch' });
      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(HINT_LINGER_MS));
      expect(wrap.classList.contains('is-held')).toBe(false);

      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('presses as usual on a short tap', () => {
    vi.useFakeTimers();
    try {
      const { button, wrap, onClick } = shown();
      fireEvent.pointerDown(button, { pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 100));
      fireEvent.pointerUp(button, { pointerType: 'touch' });
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledOnce();
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      expect(wrap.classList.contains('is-held')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it('presses on the next tap when a long press ended with no click, as when the finger scrolled', () => {
    vi.useFakeTimers();
    try {
      const { button, onClick } = shown();
      fireEvent.pointerDown(button, { pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      fireEvent.pointerCancel(button, { pointerType: 'touch' });

      fireEvent.pointerDown(button, { pointerType: 'touch' });
      fireEvent.pointerUp(button, { pointerType: 'touch' });
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
