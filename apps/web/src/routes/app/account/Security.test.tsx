import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../../index.tsx';

/**
 * The devices card, at its address inside the shell.
 *
 * The rows are still the design's sample values, so these assertions are about
 * what a row SAYS and what ending one asks first — the two things that must
 * survive the wiring unchanged.
 */
function openSecurity() {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/account/security'] })}
    />,
  );
}

describe('the devices signed in to an account', () => {
  it('lists one row per session, with its own description of itself', () => {
    openSecurity();

    expect(screen.getByRole('heading', { name: 'Signed in on' })).toBeDefined();
    expect(screen.getByText('3 devices')).toBeDefined();
    expect(screen.getByText('Chrome on macOS')).toBeDefined();
    expect(screen.getByText('Safari on iPhone')).toBeDefined();
    expect(screen.getByText('Chrome on Windows')).toBeDefined();
  });

  /**
   * Both values are what the client claimed and neither can be checked, so the
   * card says so rather than letting a row imply more than it knows.
   */
  it('says plainly that neither the name nor the address can be checked', () => {
    openSecurity();

    const card = screen.getByRole('heading', { name: 'Signed in on' }).closest('section');

    expect(card?.textContent).toMatch(/Soirely cannot check either, or tell where a device is/);
  });

  it('marks this device with words and not only with a dot', () => {
    openSecurity();

    expect(screen.getByText('This device')).toBeDefined();
  });

  it('says a row is in use now rather than giving it a last-used time', () => {
    openSecurity();

    expect(screen.getByText(/In use now/)).toBeDefined();
  });

  it('tells another device when it was last used and when it expires', () => {
    openSecurity();

    expect(screen.getByText(/Last used Wednesday, Oct 7 at 18:30/)).toBeDefined();
    expect(screen.getByText(/expires Friday, Nov 6 if not used again/)).toBeDefined();
  });

  /**
   * Your own session is reversible on the spot and a stray tap costs one
   * sign-in, so it is a link rather than a question.
   */
  it('signs this device out without asking, and lands on sign-in', () => {
    openSecurity();

    const here = screen.getByText('This device').closest('li');
    const signOut = [...(here?.querySelectorAll('a') ?? [])];

    expect(signOut.map((link) => link.getAttribute('href'))).toEqual(['/sign-in?signed-out']);
  });

  /**
   * Another device you cannot see: the row is only what it claimed, so it may
   * be the wrong one, and if it is mid-event ending it interrupts service.
   */
  it('asks before ending another device, naming it and what follows', () => {
    openSecurity();

    fireEvent.click(endOf('Chrome on Windows'));

    expect(screen.getByRole('heading', { name: 'Sign out Chrome on Windows?' })).toBeDefined();
    expect(screen.getByText(/Whoever has it is signed out/)).toBeDefined();
    expect(document.body.textContent).toMatch(/up to 15 minutes/);
    expect(document.body.textContent).toMatch(/change your password as well/);
  });

  it('leaves the list untouched when the check is declined', () => {
    openSecurity();

    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it signed in' }));

    expect(screen.getByRole('heading', { name: 'Signed in on' })).toBeDefined();
    expect(screen.getByText('Chrome on Windows')).toBeDefined();
  });

  it('confirms afterwards, and says the device may keep working for a while', () => {
    openSecurity();

    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));

    const done = screen.getByRole('status');
    expect(done.textContent).toMatch(/Chrome on Windows is signed out/);
    expect(done.textContent).toMatch(/up to 15 minutes/);
  });

  /**
   * The one word the design forbids on this page until sc-117 lands: nothing
   * takes effect immediately while an access token is good for fifteen
   * minutes, and saying so is a promise the product cannot keep.
   */
  it('never claims that any of this is immediate', () => {
    openSecurity();

    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));

    expect(document.body.textContent).not.toMatch(/immediate/i);
  });
});

/** The sign-out control in the row for a named device. */
function endOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  const button = row?.querySelector('button');

  if (button == null) throw new Error(`No sign-out control in the row for ${name}.`);

  return button as HTMLElement;
}
