import { act, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Arrived, Skeleton } from './Skeleton.tsx';
import { STYLES } from '../test-styles.ts';

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

  it("draws a month as the grid's own weeks, one bar in each head and each day, and nothing to press", () => {
    const { container } = render(
      <Skeleton words="Loading the calendar…" shape="month" weeks={6} />,
    );

    expect(container.querySelector('table.calendar-grid')?.getAttribute('role')).toBe(
      'presentation',
    );
    expect(container.querySelectorAll('.skeleton-bar-weekday')).toHaveLength(7);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(container.querySelectorAll('.calendar-cell .skeleton-bar-day')).toHaveLength(42);
    expect(container.querySelector('button, [tabindex]')).toBeNull();
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
  it('pulses as the tokens say, and never when less motion is asked for', () => {
    expect(STYLES).toMatch(
      /animation: skeleton-pulse var\(--motionPulse\) ease-in-out var\(--motionPulseTimes\);/u,
    );
    expect(STYLES).toMatch(
      /@keyframes skeleton-pulse \{\s*50% \{\s*opacity: var\(--opacityPulse\);/u,
    );
    const reduced = STYLES.slice(STYLES.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.skeleton-shown \.skeleton-blocks,[^}]*animation: none;/su);
  });
});

describe('what arrived with a load (sc-23303)', () => {
  it('fades once, so a view or a dialog that mounts later keeps its own motion', () => {
    const { container } = render(
      <Arrived>
        <p>Members</p>
      </Arrived>,
    );
    const wrapper = container.firstElementChild as HTMLElement;

    expect(wrapper.className).toBe('arrived');
    const faded = createEvent.animationEnd(screen.getByText('Members'));
    Object.defineProperty(faded, 'animationName', { value: 'fade-in' });
    fireEvent(screen.getByText('Members'), faded);
    expect(wrapper.className).toBe('arrived-settled');
    expect(STYLES).not.toMatch(/\.arrived-settled[^{,]*>/u);
  });

  it('never fades a dialog in its place, which rises in as sc-22092 drew it', () => {
    const fade = STYLES.slice(STYLES.indexOf('.arrives,'));
    const selectors = fade.slice(0, fade.indexOf('{')).split(',\n').slice(1);

    expect(selectors).toHaveLength(5);
    for (const selector of selectors) {
      expect(selector).toMatch(/:not\([^)]*\.dialog, \.dialog-scrim\)/u);
    }
  });
});
