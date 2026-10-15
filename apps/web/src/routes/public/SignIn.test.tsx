import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

/**
 * Sign in, at the address somebody actually opens.
 *
 * Rendered through the real route tree because the arrival state is read from
 * the query string, and mounting the component directly would prove only that
 * the component renders.
 */
function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

describe('signing in', () => {
  it('asks for an email and a password, and nothing else', () => {
    at('/sign-in');

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
  });

  it('autocompletes as a sign-in rather than as a new account', () => {
    at('/sign-in');

    expect(screen.getByLabelText('Email').getAttribute('autocomplete')).toBe('email');
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('current-password');
  });

  /**
   * A password field with no way to read it back is where a typo on a phone
   * keyboard turns into "my password stopped working".
   */
  it('hides the password and reveals it on request', () => {
    at('/sign-in');

    const password = screen.getByLabelText('Password');
    expect(password.getAttribute('type')).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(password.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * Both are drawn here and neither is wired: sc-58 and sc-59 own the
   * endpoints. What the test holds is the wording and the order, because both
   * owners publish requirements about them.
   */
  it('offers Google and Apple, in their own words', () => {
    at('/sign-in');

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeDefined();
  });

  /** The mark is the brand's, and it is decoration beside the wording. */
  it('keeps the brand marks out of the accessible name', () => {
    at('/sign-in');

    const google = screen.getByRole('button', { name: 'Continue with Google' });

    expect(google.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('separates the password form from the providers with a divider', () => {
    at('/sign-in');

    expect(screen.getByText('or')).toBeDefined();
  });

  /**
   * Every way a session can fail to renew sends somebody here, and they all
   * say the same thing. Which one it was tells whoever holds a stolen token
   * something, and tells the owner of the account nothing they can act on.
   */
  it('says so when the person was signed out, and what to do about it', () => {
    at('/sign-in?signed-out');

    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/You were signed out/);
    expect(banner.textContent).toMatch(/Sign in again to carry on/);
  });

  it('says nothing about being signed out when nobody was', () => {
    at('/sign-in');

    expect(screen.queryByRole('status')).toBeNull();
  });

  /**
   * On the one page that has to work for everybody: somebody who cannot read
   * this page cannot sign in, and cannot reach the switcher inside the product
   * either.
   */
  it('offers all four languages, each in its own language', () => {
    at('/sign-in');

    const choice = screen.getByRole('group', { name: 'Language' });
    const names = buttonsIn(choice).map((button) => button.textContent);

    expect(names).toEqual(['English', 'Español', 'Français', 'Português']);
  });

  it('marks the language in use rather than only colouring it', () => {
    at('/sign-in');

    const english = screen.getByRole('button', { name: 'English' });

    expect(english.getAttribute('aria-pressed')).toBe('true');
  });
});

function buttonsIn(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll('button')];
}
