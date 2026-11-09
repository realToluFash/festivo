import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const WAIT = { timeout: 3000 };

async function general(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'General' });

  return router;
}

function block(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

function steps(): string[] {
  return within(block('Ownership and leaving'))
    .getAllByRole('button')
    .map((one) => one.textContent ?? '');
}

describe('General at a desk (sc-30063)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => vi.restoreAllMocks());

  it('opens from the Settings list beside it, the tile no longer a design of its own', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings'] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' });

    fireEvent.click(within(list).getByRole('link', { name: 'General' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'General' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/settings/general');
    expect(within(list).getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('gives the owner the details, both ways to join and all three steps', async () => {
    await general('/demo/settings/general');

    expect(screen.getByText('hello@ire.events')).toBeDefined();
    expect(screen.getByText('Nigerian Naira (NGN)')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove ire.events' })).toBeDefined();
    expect(
      screen.getByRole('switch', { name: 'Requests to join' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(steps()).toEqual(['Transfer ownership', 'Leave Ire Events…', 'Delete organisation…']);
  });

  it('gives an admin the owner’s page without transfer and delete', async () => {
    await general('/demo/settings/general?as=julien');

    expect(screen.getByRole('button', { name: 'Edit details' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Company domain joining' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Requests to join' })).toBeDefined();
    expect(steps()).toEqual(['Leave Ire Events…']);
  });

  it('keeps General read only for a member, naming owners and admins', async () => {
    await general('/demo/settings/general?state=edit&as=ana');

    expect(
      screen.getByText(
        'Your role, Member, can see these but not change them. Owners and admins can.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit details' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Company domain joining' })).toBeNull();
    expect(steps()).toEqual(['Leave Ire Events…']);
  });

  it('holds an admin until two-factor is on, the card’s step going to Security', async () => {
    const router = await general('/demo/settings/general?state=heldTwoFactor&as=julien');

    expect(screen.queryByRole('heading', { level: 2, name: 'Requests to join' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on two-factor' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Security' })).toBeDefined();
    expect(router.state.location.search).toBe('?as=julien&state=setup');
    expect(screen.getByRole('dialog', { name: 'Set up two-factor' })).toBeDefined();
  });

  it('holds an admin until Google or Apple is linked, the step opening Security on both', async () => {
    const router = await general('/demo/settings/general?state=heldLinked&as=julien');

    fireEvent.click(screen.getByRole('button', { name: 'Link Google or Apple' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Security' })).toBeDefined();
    expect(router.state.location.search).toBe('?as=julien&state=linkPick');
    expect(screen.queryByRole('dialog')).toBeNull();
    const ways = within(block('Ways to sign in'));
    expect(ways.getAllByText('Not linked')).toHaveLength(2);
    expect(ways.queryByRole('group')).toBeNull();

    fireEvent.click(ways.getByRole('button', { name: /Google/ }));
    fireEvent.click(ways.getByRole('button', { name: 'Link Google' }));
    expect(screen.getByRole('dialog', { name: "Confirm it's you" })).toBeDefined();
  });

  it('opens a state it does not know as the page with no state', async () => {
    await general('/demo/settings/general?state=rules');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Ire Events', { selector: '.desk-name' })).toBeDefined();
  });

  it('saves nothing before Save, then says what saving did on the card', async () => {
    await general('/demo/settings/general?state=edit');
    const dialog = screen.getByRole('dialog', { name: 'Organisation details' });
    const save = within(dialog).getByRole('button', { name: 'Save' });

    expect(save.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Ire Studio' } });
    fireEvent.click(save);
    expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDefined();

    expect(await screen.findByText('Saved', {}, WAIT)).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('puts a malformed contact address in focus with what is wrong', async () => {
    await general('/demo/settings/general?state=contactError');
    const field = screen.getByLabelText('Contact address');

    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();
  });

  it('picks from a list over the dialog, and Escape goes back to the dialog, not out', async () => {
    await general('/demo/settings/general?state=currency');
    const list = screen.getByRole('dialog', { name: 'Currency' });

    expect(
      within(list)
        .getByRole('button', { name: 'Nigerian Naira (NGN)' })
        .getAttribute('aria-current'),
    ).toBe('true');
    fireEvent.change(within(list).getByRole('searchbox'), { target: { value: 'zealand' } });
    fireEvent.click(within(list).getByRole('button', { name: 'New Zealand Dollar (NZD)' }));

    const dialog = screen.getByRole('dialog', { name: 'Organisation details' });
    const row = within(dialog).getByRole('button', { name: 'Currency, New Zealand Dollar (NZD)' });
    await waitFor(() => expect(document.activeElement).toBe(row));

    fireEvent.click(row);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Currency' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Organisation details' })).toBeDefined();
  });

  it('asks before Cancel drops a change, and keeps the details when it does', async () => {
    await general('/demo/settings/general?state=edit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ire Studio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const ask = screen.getByRole('alertdialog', { name: 'Discard your change?' });
    expect(within(ask).getByText('Ire Events stays as it was.')).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Discard' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Ire Events', { selector: '.desk-name' })).toBeDefined();
  });

  it('puts the search field in focus when a list opens from the details', async () => {
    await general('/demo/settings/general?state=edit');
    const dialog = screen.getByRole('dialog', { name: 'Organisation details' });
    const real = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function focusUnlessInert(
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      if (this.closest('[inert]') == null) real.call(this, options);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Currency, Nigerian Naira (NGN)' }));
    const list = screen.getByRole('dialog', { name: 'Currency' });

    await waitFor(() => expect(document.activeElement).toBe(within(list).getByRole('searchbox')));
  });

  it('counts Transfer’s changes before asking to discard them', async () => {
    await general('/demo/settings/general');
    fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership' }));
    const dialog = screen.getByRole('dialog', { name: 'Transfer ownership' });

    fireEvent.click(within(dialog).getAllByRole('radio')[0] as HTMLElement);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const one = screen.getByRole('alertdialog', { name: 'Discard your change?' });
    fireEvent.click(within(one).getByRole('button', { name: 'Keep editing' }));

    fireEvent.change(within(dialog).getByLabelText('Your password'), { target: { value: 'x' } });
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: '714302' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeDefined();
  });

  it('adds only a domain the owner’s address is at, after the server says so', async () => {
    await general('/demo/settings/general?state=addDomain');
    const dialog = screen.getByRole('dialog', { name: 'Add a domain' });
    const field = within(dialog).getByLabelText('Domain');

    fireEvent.change(field, { target: { value: 'gmail.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(
      await within(dialog).findByText('You cannot use a public email domain.', {}, WAIT),
    ).toBeDefined();

    fireEvent.change(field, { target: { value: 'ire.events' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(
      await within(dialog).findByText('ire.events is already on the list.', {}, WAIT),
    ).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard your change?' })).toBeDefined();
  });

  it('removes a domain after asking, and joining by domain is then off', async () => {
    await general('/demo/settings/general?state=removeDomain');

    const ask = screen.getByRole('alertdialog', { name: 'Remove ire.events?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove' }));

    expect(screen.getByText('ire.events removed.')).toBeDefined();
    expect(screen.getByText('It is off until you add a domain.')).toBeDefined();
  });

  it('says why a stopped domain no longer works', async () => {
    await general('/demo/settings/general?state=domainStopped');

    expect(within(block('Company domain joining')).getByText('Stopped')).toBeDefined();
    expect(
      screen.getByText(/^Another organisation has proved ire.events on Enterprise/u),
    ).toBeDefined();
  });

  it('turns the request link back on as a new link', async () => {
    await general('/demo/settings/general?state=linkOff');
    const toggle = screen.getByRole('switch', { name: 'Requests to join' });

    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(
      screen.getByText(
        'The request link is off. It will not work again: turning it on makes a new one.',
      ),
    ).toBeDefined();
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'), WAIT);
    expect(screen.getByText('The request link is on.')).toBeDefined();
    expect(screen.getByText('https://soirely.app/join/r/m2w8xd')).toBeDefined();
  });

  it('says the link is copied only once the browser has copied it', async () => {
    await general('/demo/settings/general');

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await new Promise((settled) => setTimeout(settled, 0));
    expect(screen.queryByText('Link copied.')).toBeNull();
  });

  it('replaces the link after asking', async () => {
    await general('/demo/settings/general?state=replaceLink');

    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }));
    expect(screen.getByText('The link is replaced. The old one no longer works.')).toBeDefined();
  });

  it('shows the domains loading and the link not loaded, then loads it again', async () => {
    await general('/demo/settings/general?state=cardsLoading');

    expect(within(block('Company domain joining')).getByRole('status')).toBeDefined();
    expect(within(block('Requests to join')).getByRole('alert').textContent).toContain(
      'The request link could not be loaded.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('switch', {}, WAIT)).toBeDefined();
  });

  it('hands ownership over once the password and code are right', async () => {
    await general('/demo/settings/general?state=transfer');
    const dialog = screen.getByRole('dialog', { name: 'Transfer ownership' });

    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: '000000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Transfer' }));
    expect(
      await within(dialog).findByText(
        'That code did not work. Check your app and try again.',
        {},
        WAIT,
      ),
    ).toBeDefined();

    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: '714302' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Transfer' }));

    expect(await screen.findByText('Julien Moreau is now the owner', {}, WAIT)).toBeDefined();
    expect(screen.getByText('You are an Admin. You both have an email saying so.')).toBeDefined();
    expect(steps()).toEqual(['Leave Ire Events…']);
  });

  it('asks the only owner to transfer before leaving', async () => {
    await general('/demo/settings/general?state=onlyOwner');

    const ask = screen.getByRole('alertdialog', { name: 'You are the only owner' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Transfer ownership' }));
    expect(screen.getByRole('dialog', { name: 'Transfer ownership' })).toBeDefined();
  });

  it('lets a member leave, and goes to Today', async () => {
    const router = await general('/demo/settings/general?state=leave&as=ana');

    const ask = screen.getByRole('alertdialog', { name: 'Leave Ire Events?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Leave Ire Events' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/demo/today'), WAIT);
  });

  it('deletes only once the name is typed exactly', async () => {
    const router = await general('/demo/settings/general?state=delete');
    const dialog = screen.getByRole('dialog', { name: 'Delete Ire Events' });

    expect(
      within(dialog).getByText('Type Ire Events exactly as shown to delete it.'),
    ).toBeDefined();
    expect(within(dialog).getByText(/^4 events, 512 guests and 8 members/u)).toBeDefined();
    fireEvent.change(within(dialog).getByLabelText('Type Ire Events to confirm'), {
      target: { value: 'Ire Events' },
    });
    expect(within(dialog).getByText('That matches.')).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/demo/today'), WAIT);
  });

  it('says deleting still takes everything when it could not count, and counts again', async () => {
    await general('/demo/settings/general?state=deleteUncounted');
    const dialog = screen.getByRole('dialog', { name: 'Delete Ire Events' });

    expect(within(dialog).getByRole('alert').textContent).toContain(
      'We could not count what it holds.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(within(dialog).getByText('Counting what it holds…')).toBeDefined();
    expect(
      await within(dialog).findByText(/^4 events, 512 guests and 8 members/u, {}, WAIT),
    ).toBeDefined();
  });
});
