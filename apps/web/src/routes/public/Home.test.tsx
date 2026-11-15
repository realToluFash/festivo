import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

function open() {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
}

describe('The front page signed out (sc-23145)', () => {
  it('offers Sign in in its header, after the language switch', () => {
    open();

    const header = screen.getByRole('banner');
    const signIn = within(header).getByRole('link', { name: 'Sign in' });
    const language = within(header).getByRole('combobox', { name: 'Language' });

    expect(signIn.getAttribute('href')).toBe('/sign-in');
    expect(signIn.getAttribute('target')).toBeNull();
    expect(
      language.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps Get started as its only primary button', () => {
    const { container } = open();

    const primary = container.querySelectorAll('.button-primary');
    expect(primary).toHaveLength(1);
    expect(primary[0]?.textContent).toBe('Get started');
    expect(primary[0]?.getAttribute('href')).toBe('/register');
    expect(screen.getByRole('link', { name: 'Sign in' }).classList.contains('button-primary')).toBe(
      false,
    );
    expect(screen.getByRole('link', { name: 'Service status' }).getAttribute('href')).toBe(
      '/status',
    );
  });
});

describe('The front page in the settled look (sc-23146)', () => {
  it('puts Service status at its foot as a text link, not beside Get started', () => {
    open();

    const footer = screen.getByRole('contentinfo');
    const status = within(footer).getByRole('link', { name: 'Service status' });

    expect(status.classList.contains('link-button')).toBe(true);
    expect(status.classList.contains('button')).toBe(false);
    expect(
      within(screen.getByRole('main')).queryByRole('link', { name: 'Service status' }),
    ).toBeNull();
  });

  it('draws the language switch as a pill naming the language, over the same select', () => {
    open();

    const language = within(screen.getByRole('banner')).getByRole('combobox', {
      name: 'Language',
    });

    expect(language.closest('.language-pill')?.textContent).toContain('English');
    expect(
      within(language)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Automatic (en)', 'English', 'Español', 'Français', 'Português']);
  });

  it('carries no em dash in the line under the tagline', () => {
    open();

    expect(screen.getByRole('main').textContent).not.toContain('—');
  });
});
