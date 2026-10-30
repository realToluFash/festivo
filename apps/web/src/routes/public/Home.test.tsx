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
