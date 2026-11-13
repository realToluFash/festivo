import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { SAMPLE } from './rules.ts';
import { SAVE_MS, U } from './unsubscribe.ts';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => {
  __setConfig(tested);
  vi.useRealTimers();
});

async function open(state: string, title: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/unsubscribe?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title });

  return router;
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const page = () => within(document.getElementById('content') as HTMLElement);
const status = () => screen.getByRole('status');
const buttons = () =>
  page()
    .queryAllByRole('button')
    .map((each) => each.textContent);

/** The pill as a person presses it: focused first, as a click or a key leaves it. */
function press(name: string): HTMLElement {
  const button = page().getByRole('button', { name });
  button.focus();
  fireEvent.click(button);

  return button;
}

describe('the unsubscribe page the daily summary’s link opens, signed out (sc-4331)', () => {
  it('opens while they are on: the mark, the heading, one button and Notification settings', async () => {
    await open('on', U.onTitle);

    expect(document.querySelector('.unsub-mark')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.unsub-body')).toBeNull();
    expect(buttons()).toEqual([U.turnOff]);
    expect(page().getByRole('link', { name: U.settings }).getAttribute('href')).toBe(
      '/demo/settings/notifications',
    );
    expect(status().textContent).toBe('');
    await waitFor(() => expect(document.title).toBe(`${U.onTitle} – Soirely`));
  });

  it('is the signed-out frame with an empty right end, kept out of search and referrers', async () => {
    await open('on', U.onTitle);

    const header = document.querySelector('.demo-page-header');
    expect(header?.querySelector('.demo-page-new')).toBeNull();
    expect(
      within(header as HTMLElement).queryByRole('link', { name: /Sign in|Create/u }),
    ).toBeNull();
    const order = [
      ...screen
        .getByRole('navigation', { name: 'Legal and language' })
        .querySelectorAll('a, button'),
    ].map((each) => each.textContent);
    expect(order).toEqual(['Terms', 'Privacy', 'English']);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe(
      'no-referrer',
    );
  });

  it.each([
    ['on', U.onTitle],
    ['off', U.offTitle],
    ['backOn', U.backOnTitle],
    ['failed', U.onTitle],
    ['unknown', U.unknownTitle],
  ])('names no member, address or event in %s', async (state, title) => {
    await open(state, title);

    const words = document.getElementById('content')?.textContent ?? '';
    for (const named of [SAMPLE.email, SAMPLE.organisation, SAMPLE.name, '@', 'wedding'])
      expect(words).not.toContain(named);
  });

  it('turns them off after a short save: the label and focus kept, Saving… said once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('on', U.onTitle);

    const button = press(U.turnOff);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toBe(U.turnOff);
    expect(button.querySelector('.demo-spinner')).not.toBeNull();
    expect(status().textContent).toBe(U.saving);
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    await wait(SAVE_MS);

    const heading = screen.getByRole('heading', { level: 1, name: U.offTitle });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByText(U.offBody)).toBeDefined();
    expect(buttons()).toEqual([U.turnOn]);
    expect(status().textContent).toBe('');
    await waitFor(() => expect(document.title).toBe(`${U.offTitle} – Soirely`));
    await wait(SAVE_MS);
    expect(screen.getByRole('heading', { level: 1, name: U.offTitle })).toBeDefined();
  });

  it('opens while they are off with Turn them back on and no other button, then turns them back on', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('off', U.offTitle);

    expect(buttons()).toEqual([U.turnOn]);
    press(U.turnOn);
    await wait(SAVE_MS);

    const heading = screen.getByRole('heading', { level: 1, name: U.backOnTitle });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByText(U.backOnBody)).toBeDefined();
    expect(buttons()).toEqual([]);
    expect(page().getByRole('link', { name: U.settings })).toBeDefined();
  });

  it('never shows a save that failed as made, and Try again retries the same change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('on', U.onTitle);

    fireEvent.click(screen.getByRole('switch', { name: U.saveFails }));
    const button = press(U.turnOff);
    await wait(SAVE_MS);

    expect(screen.getByRole('heading', { level: 1, name: U.onTitle })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe(U.failed);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-busy')).toBe('false');
    const parts = [...document.querySelectorAll('.unsub-actions > *:not([role="status"])')];
    expect(parts.map((part) => part.className)).toEqual([
      'button button-primary unsub-pill',
      'unsub-failed',
      'link-button unsub-link',
    ]);

    const retry = press(U.tryAgain);
    expect(retry.getAttribute('aria-busy')).toBe('true');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(retry.textContent).toBe(U.tryAgain);
    expect(status().textContent).toBe(U.saving);
    const first = screen.getByRole('alert');
    await wait(SAVE_MS);

    expect(screen.getByRole('alert')).not.toBe(first);
    expect(document.activeElement).toBe(retry);

    fireEvent.click(screen.getByRole('switch', { name: U.saveFails }));
    press(U.tryAgain);
    await wait(SAVE_MS);

    const heading = screen.getByRole('heading', { level: 1, name: U.offTitle });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('fails Turn them back on the same way, with the page left off', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('off', U.offTitle);

    fireEvent.click(screen.getByRole('switch', { name: U.saveFails }));
    press(U.turnOn);
    await wait(SAVE_MS);

    expect(screen.getByRole('heading', { level: 1, name: U.offTitle })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe(U.failed);
    expect(page().getByRole('button', { name: U.tryAgain })).toBeDefined();
  });

  it('holds the saving state, the pill focused, busy and refused, and Saving… in the status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('saving', U.onTitle);

    const button = page().getByRole('button', { name: U.turnOff });
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(status().textContent).toBe(U.saving);
    fireEvent.click(button);
    await wait(SAVE_MS * 2);
    expect(screen.getByRole('heading', { level: 1, name: U.onTitle })).toBeDefined();
  });

  it('opens on the failed save with the pill focused and Try again under it', async () => {
    await open('failed', U.onTitle);

    await waitFor(() =>
      expect(document.activeElement).toBe(page().getByRole('button', { name: U.turnOff })),
    );
    expect(screen.getByRole('alert').textContent).toBe(U.failed);
    expect(page().getByRole('button', { name: U.tryAgain }).getAttribute('aria-busy')).toBe(
      'false',
    );
  });

  it('says a link that does not work changed nothing, and offers sign-in, not Notification settings', async () => {
    await open('unknown', U.unknownTitle);

    expect(screen.getByText(U.unknownBody)).toBeDefined();
    expect(page().getByRole('link', { name: U.signIn }).getAttribute('href')).toBe(
      '/demo/settings/notifications',
    );
    expect(page().queryByRole('link', { name: U.settings })).toBeNull();
    expect(buttons()).toEqual([]);
    await waitFor(() => expect(document.title).toBe(`${U.unknownTitle} – Soirely`));
  });

  it('is listed on the demo home under Messaging, a row per state', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { name: 'Design demo' }, { timeout: 8000 });

    const rows = ['on', 'off', 'backOn', 'saving', 'failed', 'unknown'].map((key) =>
      document.querySelector(`a[href="/demo/unsubscribe?state=${key}"]`),
    );
    expect(rows.every((row) => row != null)).toBe(true);
    expect(
      screen.getByRole('heading', {
        name: 'The unsubscribe page, signed out · phone, tablet and desk',
      }),
    ).toBeDefined();
  });
});
