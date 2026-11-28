import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => __setConfig(tested));

async function open(path: string, title: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title });

  return router;
}

function footer() {
  return within(screen.getByRole('navigation', { name: 'Legal and language' }));
}

describe('Terms and Privacy in the signed-out frame (sc-28982)', () => {
  it('opens Terms signed out: its title, its date as a long date, and the sample marked', async () => {
    await open('/demo/terms', 'Terms');

    expect(screen.getByText('Last updated November 4, 2026')).toBeDefined();
    expect(screen.getByText('Sample text, not Soirely’s Terms.')).toBeDefined();
    expect(screen.getByText('New to Soirely?')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Terms – Soirely'));
  });

  it('keeps the document’s headings, lists and links as headings, lists and links', async () => {
    await open('/demo/terms', 'Terms');

    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(3);
    expect(screen.getByRole('heading', { level: 3, name: '2.1 Lists' })).toBeDefined();
    const [bullets, numbered] = screen.getAllByRole('list');
    expect(bullets?.tagName).toBe('UL');
    expect(numbered?.tagName).toBe('OL');
    expect(screen.getByRole('link', { name: 'sample Privacy notice' }).getAttribute('href')).toBe(
      '/demo/privacy',
    );
  });

  it('is the same page signed in, with no way in offered and no sign-in', async () => {
    await open('/demo/terms?state=signed-in', 'Terms');

    expect(screen.queryByText('New to Soirely?')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create an account' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
    expect(footer().getByRole('link', { name: 'Terms' })).toBeDefined();
  });

  it('puts Terms, Privacy and the language in the footer in that order', async () => {
    await open('/demo/privacy', 'Privacy notice');

    const order = [
      ...screen
        .getByRole('navigation', { name: 'Legal and language' })
        .querySelectorAll('a, button'),
    ].map((each) => each.textContent);
    expect(order).toEqual(['Terms', 'Privacy', 'English']);
    expect(footer().getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/demo/terms');
    await waitFor(() => expect(document.title).toBe('Privacy – Soirely'));
  });

  it('shows the French, its date as French writes it, and the footer’s words in French', async () => {
    await open('/demo/terms?state=fr', 'Conditions');

    expect(screen.getByText(/^\[Dernière mise à jour/u).textContent).toBe(
      '[Dernière mise à jour\u00a0: 4 novembre 2026]',
    );
    expect(footer().getByRole('link', { name: '[Conditions]' }).getAttribute('href')).toBe(
      '/demo/terms?state=fr',
    );
    expect(footer().getByRole('link', { name: '[Confidentialité]' })).toBeDefined();
    expect(footer().getByRole('button', { name: 'Langue\u00a0: Français' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('[Conditions] – Soirely'));
  });

  it('changes the text from the language button without leaving the page', async () => {
    const router = await open('/demo/privacy', 'Privacy notice');

    fireEvent.click(footer().getByRole('button', { name: 'Language: English' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Français/u }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Politique de confidentialité' }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/privacy');
  });

  it('shows the English sample in Spanish, and says so', async () => {
    await open('/demo/terms', 'Terms');

    fireEvent.click(footer().getByRole('button', { name: 'Language: English' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Español/u }));

    expect(
      await screen.findByText(/The demo writes the sample in English and French only\./u),
    ).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Terms' })).toBeDefined();
  });

  it('says Terms and Privacy in French as the guest’s page’s footer does, from one table', async () => {
    const footerWords = (footer: Element | null) =>
      [...(footer?.querySelectorAll('a') ?? [])].map((link) => link.textContent);

    const legal = render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/demo/terms?state=fr'] })}
      />,
    );
    await screen.findByRole('heading', { level: 1, name: 'Conditions' });
    const signedOut = footerWords(document.querySelector('.demo-page-links'));
    legal.unmount();

    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/demo/guest?state=french'] })}
      />,
    );
    await screen.findByRole('link', { name: '[Conditions]' });
    const guest = footerWords(document.querySelector('.gp-footer-links'));

    expect(signedOut).toEqual(['[Conditions]', '[Confidentialité]']);
    expect(guest).toEqual(signedOut);
  });

  it('opens from the sign-in footer, and the old stand-in’s address opens the page', async () => {
    await open('/demo/sign-in', 'Sign in');

    fireEvent.click(footer().getByRole('link', { name: 'Privacy' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy notice' })).toBeDefined();

    await open('/demo/later?screen=terms', 'Terms');
  });
});
