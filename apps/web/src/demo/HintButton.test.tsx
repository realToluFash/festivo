import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HintButton } from './HintButton.tsx';

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
});
