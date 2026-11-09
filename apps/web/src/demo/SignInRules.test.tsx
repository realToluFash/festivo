import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

async function rules(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Sign-in rules' });
}

function block(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name });

  return heading.closest('section') as HTMLElement;
}

function titles(name: string): string[] {
  return [...block(name).querySelectorAll('.desk-row-name')].map((one) => one.textContent ?? '');
}

describe('Sign-in rules at a desk (sc-30064)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('opens from the Settings list beside it, the tile no longer a design of its own', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings'] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' });

    fireEvent.click(within(list).getByRole('link', { name: 'Sign-in rules' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign-in rules' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/settings/sign-in-rules');
    expect(
      within(list).getByRole('link', { name: 'Sign-in rules' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.queryByText('Sign-in rules has its own design.')).toBeNull();
  });

  it('says where an owner stands, in the app’s order, and what changed, newest first', async () => {
    await rules('/demo/settings/sign-in-rules');

    expect(screen.getByText('You meet Ire Events’ rules')).toBeDefined();
    expect(screen.getByText('As an owner, you can change them below.')).toBeDefined();
    expect(titles('Where you stand')).toEqual([
      'Sign in any way',
      'Signed out after 30 days unused',
      'Two-factor for managers',
    ]);
    expect(screen.getByText('Managers are owners and admins.')).toBeDefined();
    expect(titles('What changed')).toEqual([
      'Two-factor for managers: on',
      'Signed out after: 30 days unused',
    ]);
    expect(within(block('What changed')).queryByText('New')).toBeNull();
  });

  it('opens a state it does not know as the page with no state', async () => {
    await rules('/demo/settings/sign-in-rules?state=rules');

    expect(screen.getByText('You meet Ire Events’ rules')).toBeDefined();
    expect(screen.getAllByText('Change')).toHaveLength(3);
  });

  it('gives a member the same page with no changes, naming owners and admins', async () => {
    await rules('/demo/settings/sign-in-rules?as=ana');

    expect(screen.queryByText('Change')).toBeNull();
    expect(
      screen.getByText('Set by its owners and admins. Only they can change them.'),
    ).toBeDefined();
    expect(screen.getByText('Questions? Ask an owner or admin of Ire Events.')).toBeDefined();
    expect(screen.getByText('Doesn’t apply to your role, Member.')).toBeDefined();
  });

  it('still gives a member the card’s step when a rule needs them', async () => {
    await rules('/demo/settings/sign-in-rules?state=googleOnly&as=ana');

    expect(screen.getByText('1 rule needs you')).toBeDefined();
    expect(within(block('What changed')).getAllByText('New')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Link Google or Apple' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Security' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(block('Ways to sign in')).getByRole('button', { name: /Apple/ }));
    fireEvent.click(within(block('Ways to sign in')).getByRole('button', { name: 'Link Apple' }));
    expect(screen.getByRole('dialog', { name: "Confirm it's you" })).toBeDefined();
  });

  it('holds an admin’s changes until their own two-factor is on', async () => {
    await rules('/demo/settings/sign-in-rules?state=twoFactorDue&as=julien');

    expect(screen.queryByText('Change')).toBeNull();
    expect(
      screen.getByText(
        'Until it’s on, changes to members or security wait. Your events keep working.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText('Not on yet. Changes to members and security wait until it is.'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Until you turn on two-factor, you can see these rules but not change them.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on two-factor' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Security' })).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Set up two-factor' })).toBeDefined();
  });

  it('changes a rule from its row, adds the change at the top and gives focus back', async () => {
    await rules('/demo/settings/sign-in-rules');
    const row = screen.getByRole('button', { name: /Signed out after 30 days unused/u });

    row.focus();
    fireEvent.click(row);
    const dialog = screen.getByRole('dialog', { name: 'How long a sign-in lasts unused' });
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(save.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(within(dialog).getByRole('radio', { name: '7 days' }));
    expect(
      within(dialog).getByText(
        'Anyone who has not used Soirely for 7 days is asked to sign in again, from their next visit.',
      ),
    ).toBeDefined();
    fireEvent.click(save);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(titles('Where you stand')[1]).toBe('Signed out after 7 days unused');
    expect(titles('What changed')[0]).toBe('Signed out after: 7 days unused');
    expect(screen.getByText(/· was 30 days · Folake Adeyemi$/u)).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /Signed out after 7 days unused/u }),
      ),
    );
  });

  it('asks before Cancel drops a change, and keeps the rule when it does', async () => {
    await rules('/demo/settings/sign-in-rules?state=limitPicked');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const ask = screen.getByRole('alertdialog', { name: 'Discard your change?' });
    expect(within(ask).getByText('Signed out after 30 days unused stays the rule.')).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    expect((screen.getByRole('radio', { name: '7 days' }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(titles('Where you stand')[1]).toBe('Signed out after 30 days unused');
  });

  it('closes an untouched edit on Escape and gives focus back to its row', async () => {
    await rules('/demo/settings/sign-in-rules');
    const row = screen.getByRole('button', { name: /Sign in any way/u });

    row.focus();
    fireEvent.click(row);
    expect(screen.getByRole('dialog', { name: 'How people sign in' })).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it('refuses a rule the viewer does not meet yet', async () => {
    await rules('/demo/settings/sign-in-rules?state=twoFactorRefused');

    const dialog = screen.getByRole('dialog', { name: 'Two-factor' });
    expect(within(dialog).getByText('Turn on two-factor for yourself first')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Not required/u }));
    expect(within(dialog).queryByText('Turn on two-factor for yourself first')).toBeNull();
  });

  it('requires two-factor of everyone, then drops it for everyone and managers in one save', async () => {
    await rules('/demo/settings/sign-in-rules?state=twoFactorEveryone');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(titles('What changed')[0]).toBe('Two-factor for everyone: on');
    expect(titles('Where you stand')[2]).toBe('Two-factor for everyone');

    fireEvent.click(screen.getByRole('button', { name: /Two-factor for everyone/u }));
    fireEvent.click(screen.getByRole('radio', { name: /^Not required/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(titles('What changed').slice(0, 3)).toEqual([
      'Two-factor for managers: off',
      'Two-factor for everyone: off',
      'Two-factor for everyone: on',
    ]);
    expect(titles('Where you stand')[2]).toBe('Two-factor not required');
  });

  it('holds every change while the viewer’s own two-factor is due under the managers rule', async () => {
    await rules('/demo/settings/sign-in-rules?state=everyone&as=julien');

    expect(screen.getByText(/^Not on yet. Turn it on by Wednesday, Nov 11/u)).toBeDefined();
    expect(screen.queryByText('Change')).toBeNull();
    expect(screen.queryByText('Managers are owners and admins.')).toBeNull();
  });

  it('loads, and tries again after failing', async () => {
    await rules('/demo/settings/sign-in-rules?state=failed');

    expect(screen.getByRole('alert').textContent).toContain('We could not load the sign-in rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status', { name: 'Loading the sign-in rules…' })).toBeDefined();
    expect(await screen.findByText('Where you stand', {}, { timeout: 3000 })).toBeDefined();
  });
});
