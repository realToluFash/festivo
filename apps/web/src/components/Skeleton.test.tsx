import { act, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Skeleton } from './Skeleton.tsx';

describe('a screen waiting for its content (sc-23303)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing for the first second, already busy, and says nothing', () => {
    const { container } = render(
      <Skeleton words="Loading members…" shape="rows" rowHeight={64} picture />,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Loading members…')).toBeNull();
    expect(container.querySelector('.skeleton-shown')).toBeNull();
  });

  it('from one second says its words as a polite status over its blocks', () => {
    const { container } = render(
      <Skeleton words="Loading members…" shape="rows" rowHeight={64} rows={4} picture />,
    );

    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByRole('status').textContent).toBe('Loading members…');
    expect(container.querySelector('.skeleton-shown')).not.toBeNull();
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(4);
    expect(container.querySelectorAll('.skeleton-tile')).toHaveLength(4);
    expect(container.querySelector('.skeleton-blocks')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[tabindex], button, a, input')).toBeNull();
  });

  it("draws a page's cards with its title bar in the first, and each card's fields and options", () => {
    const { container } = render(
      <Skeleton
        words="Loading the event…"
        shape="cards"
        titled
        cards={[{ cover: true, lines: 2 }, { fields: 2 }, { options: 3 }]}
      />,
    );

    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(3);
    expect(container.querySelectorAll('.skeleton-bar-title')).toHaveLength(1);
    expect(container.querySelectorAll('.skeleton-cover')).toHaveLength(1);
    expect(container.querySelectorAll('.skeleton-field')).toHaveLength(2);
    expect(container.querySelectorAll('.skeleton-option')).toHaveLength(3);
  });

  it('inside a card that is already there, draws no card of its own', () => {
    const { container } = render(
      <Skeleton words="Loading…" shape="rows" rowHeight={56} rows={2} inCard />,
    );

    expect(container.querySelector('.skeleton-card')).toBeNull();
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(2);
  });
});

describe('how a skeleton moves (sc-23303)', () => {
  const styles = readFileSync(join(import.meta.dirname, '../styles.css'), 'utf8');

  it('pulses as the tokens say, and never when less motion is asked for', () => {
    expect(styles).toMatch(
      /animation: skeleton-pulse var\(--motionPulse\) ease-in-out var\(--motionPulseTimes\);/u,
    );
    expect(styles).toMatch(
      /@keyframes skeleton-pulse \{\s*50% \{\s*opacity: var\(--opacityPulse\);/u,
    );
    const reduced = styles.slice(styles.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.skeleton-shown \.skeleton-blocks,[^}]*animation: none;/su);
  });
});
