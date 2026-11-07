import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SCHEME_KEY,
  __resetColourScheme,
  followAccountScheme,
  startColourScheme,
} from '../../../colourScheme.ts';
import { Personalisation } from './Personalisation.tsx';

class FakeChannel {
  static posted: unknown[] = [];
  onmessage = null;

  postMessage(message: unknown): void {
    FakeChannel.posted.push(message);
  }

  close(): void {}
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let saves: unknown[] = [];

function page(put: (body: unknown) => Response | Promise<Response> = (body) => json(body)) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    if (init?.method !== 'PUT') return json({ id: 'u', colourScheme: null });
    const body: unknown = JSON.parse(String(init.body));
    saves.push(body);
    return put(body);
  });

  const router = createMemoryRouter(
    [{ path: '/app/account/personalisation', element: <Personalisation /> }],
    { initialEntries: ['/app/account/personalisation'] },
  );
  render(<RouterProvider router={router} />);
}

function radio(name: string): HTMLInputElement {
  return screen.getByRole('radio', { name }) as HTMLInputElement;
}

const root = document.documentElement;

beforeEach(() => {
  saves = [];
  FakeChannel.posted = [];
  vi.stubGlobal('BroadcastChannel', FakeChannel);
  localStorage.removeItem(SCHEME_KEY);
  __resetColourScheme();
  startColourScheme();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem(SCHEME_KEY);
  __resetColourScheme();
});

describe('Personalisation (sc-30441)', () => {
  it('is one of your own sections, after Notifications', () => {
    followAccountScheme(null);
    page();

    const sections = within(screen.getByRole('navigation', { name: 'Account sections' }))
      .getAllByRole('link')
      .map((link) => link.textContent);

    expect(sections).toEqual(['Account', 'Security', 'Notifications', 'Personalisation']);
  });

  it('shows Violet to somebody who never chose, and says where the colours go', () => {
    followAccountScheme(null);
    page();

    expect(screen.getByRole('group', { name: 'Your colours: Violet' })).toBeTruthy();
    expect(screen.getByText('You see Soirely in Violet')).toBeTruthy();
    expect(screen.getByText('Soirely’s own colours, until you choose others.')).toBeTruthy();
    expect(
      screen.getByText(
        'Your colours follow you on every device you sign in on. Only you see them.',
      ),
    ).toBeTruthy();
    expect(root.dataset.scheme).toBe('violet');
  });

  it('reads the account when it does not know the pick yet', async () => {
    page();

    expect(await screen.findByText('You see Soirely in Violet')).toBeTruthy();
    expect(root.dataset.scheme).toBe('violet');
  });

  it('opens Colours on the scheme in use, and the arrows move the pick and wrap', async () => {
    followAccountScheme('terracotta');
    page();

    fireEvent.click(screen.getByRole('button', { name: /Choose colours/ }));

    const dialog = screen.getByRole('dialog', { name: 'Colours' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(8);
    const current = radio('Terracotta, current');
    await waitFor(() => expect(document.activeElement).toBe(current));
    expect(current.checked).toBe(true);
    expect(within(dialog).getByText('In use now. Pick another to see it here.')).toBeTruthy();

    fireEvent.keyDown(current, { key: 'ArrowRight' });

    expect(radio('Violet').checked).toBe(true);
    expect(document.activeElement).toBe(radio('Violet'));
    expect(within(dialog).getByText('Not saved yet. Save puts Violet on every page.')).toBeTruthy();

    fireEvent.keyDown(radio('Violet'), { key: 'ArrowUp' });
    expect(radio('Terracotta, current').checked).toBe(true);

    fireEvent.keyDown(radio('Terracotta, current'), { key: 'ArrowLeft' });
    expect(radio('Sorbet').checked).toBe(true);

    fireEvent.keyDown(radio('Sorbet'), { key: 'ArrowDown' });
    expect(radio('Terracotta, current').checked).toBe(true);
    expect(root.dataset.scheme).toBe('terracotta');
  });

  it('closes on Esc without asking, and gives focus back to Choose colours', async () => {
    followAccountScheme(null);
    page();
    const step = screen.getByRole('button', { name: /Choose colours/ });

    fireEvent.click(step);
    fireEvent.click(radio('Garden'));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(step);
    expect(root.dataset.scheme).toBe('violet');
    expect(saves).toEqual([]);
  });

  it('saves the pick, recolours every page at once, keeps it here and tells the other tabs', async () => {
    followAccountScheme(null);
    page();

    fireEvent.click(screen.getByRole('button', { name: /Choose colours/ }));
    fireEvent.click(radio('Garden'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('You see Soirely in Garden')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(saves).toEqual([{ colourScheme: 'garden' }]);
    expect(root.dataset.scheme).toBe('garden');
    expect(localStorage.getItem(SCHEME_KEY)).toBe('garden');
    expect(FakeChannel.posted).toEqual(['garden']);
    expect(screen.getAllByText('Saved. Every page is in your colours now.').length).toBeGreaterThan(
      0,
    );
  });

  it('saves Violet as violet', async () => {
    followAccountScheme('berry');
    page();

    fireEvent.click(screen.getByRole('button', { name: /Choose colours/ }));
    fireEvent.click(radio('Violet'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saves).toEqual([{ colourScheme: 'violet' }]));
    await waitFor(() => expect(root.dataset.scheme).toBe('violet'));
  });

  it('holds Cancel, the swatches and Esc while it saves', async () => {
    followAccountScheme(null);
    let answer: (response: Response) => void = () => {};
    page(() => new Promise((resolve) => (answer = resolve)));

    fireEvent.click(screen.getByRole('button', { name: /Choose colours/ }));
    fireEvent.click(radio('Citrus'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const saving = await screen.findByRole('button', { name: 'Saving…' });
    expect(saving.getAttribute('aria-busy')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(radio('Citrus'), { key: 'ArrowRight' });

    expect(screen.getByRole('dialog', { name: 'Colours' })).toBeTruthy();
    expect(radio('Citrus').checked).toBe(true);

    answer(json({ colourScheme: 'citrus' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the colours as they were when a save fails, and offers Try again', async () => {
    followAccountScheme('cobalt');
    let fail = true;
    page((body) => (fail ? json({ title: 'Nope' }, 500) : json(body)));

    fireEvent.click(screen.getByRole('button', { name: /Choose colours/ }));
    fireEvent.click(radio('Garden'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Garden was not saved. Your colours stay Cobalt.',
    );
    expect(screen.getByRole('dialog', { name: 'Colours' })).toBeTruthy();
    expect(root.dataset.scheme).toBe('cobalt');
    expect(localStorage.getItem(SCHEME_KEY)).toBe('cobalt');
    expect(FakeChannel.posted).toEqual([]);

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(root.dataset.scheme).toBe('garden'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says so when the save failed because the browser is offline', async () => {
    followAccountScheme(null);
    page(() => Promise.reject(new TypeError('Failed to fetch')));

    fireEvent.click(screen.getByRole('button', { name: /Choose colours/ }));
    fireEvent.click(radio('Berry'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Berry was not saved because you are offline. Your colours stay Violet.',
    );
    expect(root.dataset.scheme).toBe('violet');
  });
});
