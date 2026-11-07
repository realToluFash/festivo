import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 3000 };
const PAGE = '/demo/settings/personalisation';

async function personalisation(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Personalisation' });

  return router;
}

function card(name: string): HTMLElement {
  return screen.getByRole('group', { name: `Your colours: ${name}` });
}

function step(): HTMLElement {
  return screen.getByRole('button', { name: 'Choose colours' });
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Colours' });
}

function swatch(name: RegExp): HTMLElement {
  return within(dialog()).getByRole('radio', { name });
}

function press(key: string): void {
  fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

function checked(): string | null {
  return within(dialog())
    .getAllByRole('radio')
    .filter((one) => one.getAttribute('aria-checked') === 'true')
    .map((one) => one.getAttribute('aria-label'))
    .join();
}

describe('Personalisation at a desk (sc-30441)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development', scheme: 'violet' }));
  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.scheme;
  });

  it('is the last of your own sections in the Settings list', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings'] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' });
    const yours = within(list).getAllByRole('list')[0] as HTMLElement;

    expect(
      within(yours)
        .getAllByRole('link')
        .map((one) => one.querySelector('.today-grow')?.textContent),
    ).toEqual(['Account', 'Security', 'Notifications', 'Personalisation']);
    fireEvent.click(within(list).getByRole('link', { name: 'Personalisation' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Personalisation' })).toBeDefined();
    expect(router.state.location.pathname).toBe(PAGE);
  });

  it('says Soirely’s own colours until you choose, then what follows you and what keeps its own', async () => {
    await personalisation(`${PAGE}?state=never`);

    expect(within(card('Violet')).getByText('You see Soirely in Violet')).toBeDefined();
    expect(
      within(card('Violet')).getByText('Soirely’s own colours, until you choose others.'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Your colours follow you on every device you sign in on. Only you see them.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText('Event covers, emails, messages and guests’ pages keep their own colours.'),
    ).toBeDefined();
  });

  it('opens Colours as a modal dialog, focus on the scheme in use and Save waiting', async () => {
    await personalisation(`${PAGE}?state=never`);
    fireEvent.click(step());

    expect(dialog().getAttribute('aria-modal')).toBe('true');
    const group = within(dialog()).getByRole('radiogroup', { name: 'Colours' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((one) => one.getAttribute('aria-label')),
    ).toEqual([
      'Violet, current',
      'Cobalt',
      'Garden',
      'Citrus',
      'Berry',
      'Black tie',
      'Sorbet',
      'Terracotta',
    ]);
    await waitFor(() => expect(document.activeElement).toBe(swatch(/^Violet/)));
    expect(
      within(group)
        .getAllByRole('radio')
        .filter((one) => one.tabIndex === 0),
    ).toEqual([swatch(/^Violet/)]);
    expect(within(dialog()).getByText('In use now. Pick another to see it here.')).toBeDefined();
    expect(
      within(dialog()).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(within(dialog()).queryByText(/restart/i)).toBeNull();
  });

  it('moves the pick with the arrow keys in reading order, round at both ends', async () => {
    await personalisation(`${PAGE}?state=colours`);
    await waitFor(() => expect(document.activeElement).toBe(swatch(/^Violet/)));

    press('ArrowRight');
    press('ArrowRight');
    expect(checked()).toBe('Garden');
    expect(document.activeElement).toBe(swatch(/^Garden/));
    expect(swatch(/^Garden/).tabIndex).toBe(0);
    expect(swatch(/^Violet/).tabIndex).toBe(-1);
    expect(screen.getByRole('img', { name: 'Preview: Garden' })).toBeDefined();
    expect(
      within(dialog()).getByText('Not saved yet. Save puts Garden on every page.'),
    ).toBeDefined();
    expect(
      within(dialog()).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled'),
    ).toBe('false');

    press('ArrowUp');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(checked()).toBe('Terracotta');
    press('ArrowDown');
    expect(checked()).toBe('Violet, current');
    expect(document.activeElement).toBe(swatch(/^Violet/));
  });

  it('cancels on Esc, keeps the colours, and puts focus back on Choose colours', async () => {
    await personalisation(`${PAGE}?state=never`);
    step().focus();
    fireEvent.click(step());
    await waitFor(() => expect(document.activeElement).toBe(swatch(/^Violet/)));
    press('ArrowRight');
    press('Escape');

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(step()));
    expect(card('Violet')).toBeDefined();
    expect(document.documentElement.dataset.scheme).toBe('violet');
  });

  it('saves, holding Cancel and Esc, and puts every page in the pick at once', async () => {
    await personalisation(`${PAGE}?state=never`);
    fireEvent.click(step());
    await waitFor(() => expect(document.activeElement).toBe(swatch(/^Violet/)));
    press('ArrowRight');
    press('ArrowRight');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));

    const saving = within(dialog()).getByRole('button', { name: 'Saving…' });
    expect(saving.getAttribute('aria-busy')).toBe('true');
    expect(
      within(dialog()).getByRole('button', { name: 'Cancel' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(within(dialog()).getByRole('radiogroup').getAttribute('aria-disabled')).toBe('true');
    press('Escape');
    press('ArrowRight');
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(checked()).toBe('Garden');

    expect(await screen.findByText('You see Soirely in Garden')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.documentElement.dataset.scheme).toBe('garden');
    expect(
      within(card('Garden')).getByText('Saved. Every page is in your colours now.'),
    ).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(step()));
    expect(JSON.stringify({ ...localStorage })).not.toContain('garden');
  });

  it('keeps the pick for this visit only, and puts the build’s scheme back on leaving the demo', async () => {
    const router = await personalisation(`${PAGE}?state=chosen`);

    expect(document.documentElement.dataset.scheme).toBe('garden');
    expect(within(card('Garden')).getByText('Your choice. Violet is Soirely’s own.')).toBeDefined();
    await router.navigate('/demo/settings/notifications');
    await router.navigate(PAGE);
    expect(await screen.findByText('You see Soirely in Garden')).toBeDefined();

    await router.navigate('/sign-in');
    await waitFor(() => expect(document.documentElement.dataset.scheme).toBe('violet'));
    expect(document.documentElement.style.getPropertyValue('--coverAccent')).toBe('');
  });

  it('is in Violet while never chosen, whatever the build’s scheme, and leaves the build its own', async () => {
    __setConfig({ ...tested, environment: 'development', scheme: null });
    const router = await personalisation(`${PAGE}?state=never`);

    expect(document.documentElement.dataset.scheme).toBe('violet');
    expect(within(card('Violet')).getByText('You see Soirely in Violet')).toBeDefined();
    fireEvent.click(step());
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(document.documentElement.dataset.scheme).toBe('violet');

    await router.navigate('/sign-in');
    await waitFor(() => expect(document.documentElement.dataset.scheme).toBeUndefined());
  });

  it('keeps event covers in the build’s accent under a pick', async () => {
    const root = document.documentElement;
    root.style.setProperty('--colorAccent', '#1E9A64');

    try {
      const router = await personalisation(`${PAGE}?state=chosen`);

      expect(root.dataset.scheme).toBe('garden');
      expect(root.style.getPropertyValue('--coverAccent')).toBe('#1E9A64');
      await router.navigate('/sign-in');
      await waitFor(() => expect(root.style.getPropertyValue('--coverAccent')).toBe(''));
    } finally {
      root.style.removeProperty('--colorAccent');
    }
  });

  it('keeps Colours open with the reason and Try again when a save fails, and Try again saves', async () => {
    await personalisation(`${PAGE}?state=saveFailed`);

    expect(within(dialog()).getByRole('alert').textContent).toBe(
      'Garden was not saved. Your colours stay Violet.',
    );
    expect(checked()).toBe('Garden');
    expect(document.documentElement.dataset.scheme).toBe('violet');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('You see Soirely in Garden', {}, SLOW)).toBeDefined();
    expect(document.documentElement.dataset.scheme).toBe('garden');
  });

  it('says a save offline was not sent, until another pick replaces the reason', async () => {
    await personalisation(`${PAGE}?state=offline`);

    expect(within(dialog()).getByRole('alert').textContent).toBe(
      'Garden was not saved because you are offline. Your colours stay Violet.',
    );
    await waitFor(() => expect(document.activeElement).toBe(swatch(/^Garden/)));
    press('ArrowLeft');
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    expect(
      within(dialog()).getByText('Not saved yet. Save puts Cobalt on every page.'),
    ).toBeDefined();
  });

  it('opens Colours on a keyboard pick, and saving on its own', async () => {
    await personalisation(`${PAGE}?state=picked`);
    await waitFor(() => expect(document.activeElement).toBe(swatch(/^Garden/)));
    expect(checked()).toBe('Garden');
    cleanup();

    await personalisation(`${PAGE}?state=saving`);
    expect(within(dialog()).getByRole('button', { name: 'Saving…' })).toBeDefined();
  });

  it('opens with focus on Choose colours after Esc and after a save', async () => {
    await personalisation(`${PAGE}?state=escaped`);
    await waitFor(() => expect(document.activeElement).toBe(step()));
    cleanup();

    await personalisation(`${PAGE}?state=saved`);
    await waitFor(() => expect(document.activeElement).toBe(step()));
    expect(document.documentElement.dataset.scheme).toBe('garden');
  });

  it('loads in the browser’s last colours, and offers Try again when the load fails', async () => {
    await personalisation(`${PAGE}?state=failed`);

    expect(document.documentElement.dataset.scheme).toBe('garden');
    expect(screen.getByRole('alert').textContent).toContain('Your colours did not load.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeDefined();
    expect(await screen.findByText('You see Soirely in Garden', {}, SLOW)).toBeDefined();
  });
});
