import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

async function page(query: string, title = 'Single sign-on') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/settings/sign-in-rules/single-sign-on?${query}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title });

  return router;
}

async function at(path: string, title: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('heading', { level: 1, name: title });
}

describe('single sign-on in the web demo (sc-610)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => {
    cleanup();
    __setConfig(tested);
    vi.useRealTimers();
  });

  it('picks a protocol and checks the form before it saves', async () => {
    await page('state=none');

    fireEvent.click(screen.getByLabelText(/SAML 2.0/u));
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));

    expect(screen.getByText('Enter a name people will recognise, like Okta.')).toBeDefined();
    expect(screen.getByText('Paste the metadata URL, or upload the metadata file.')).toBeDefined();
    expect(screen.getByText('https://soirely.app/sso/saml/ire-events/acs')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Provider name'), { target: { value: 'Okta' } });
    fireEvent.change(screen.getByLabelText('Metadata URL'), {
      target: { value: 'https://ire-events.okta.com/metadata' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));

    expect(screen.getByText('Saved, not tested')).toBeDefined();
    expect(
      screen.getByRole('switch', { name: 'Single sign-on' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('says the server could not read the metadata under its field', async () => {
    await page('state=saml_bad_metadata');

    expect(screen.getByText(/We could not read that metadata/u)).toBeDefined();
  });

  it('refuses the switch until a test worked, then tests and switches on', async () => {
    await page('state=saved');

    fireEvent.click(screen.getByRole('switch', { name: 'Single sign-on' }));
    expect(screen.getByRole('alert').textContent).toContain('Test sign-on first.');

    fireEvent.click(screen.getAllByRole('button', { name: 'Test sign-on' })[0] as HTMLElement);
    expect(screen.getByText('Testing sign-on…')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'It did not work' }));
    expect(screen.getByText('Test did not work')).toBeDefined();
    expect(screen.getByText(/Okta said:/u)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Test again' }));
    fireEvent.click(screen.getByRole('button', { name: 'It failed Soirely’s checks' }));
    expect(screen.getByText('Test did not work')).toBeDefined();
    expect(screen.getByText(/not at one of your proved domains/u)).toBeDefined();
    expect(screen.queryByText(/said:/u)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Test again' }));
    fireEvent.click(screen.getByRole('button', { name: 'It worked' }));
    expect(screen.getByText('Test worked')).toBeDefined();
    expect(screen.getByText(/signed in folake@ire.events · Folake Adeyemi/u)).toBeDefined();

    fireEvent.click(screen.getByRole('switch', { name: 'Single sign-on' }));
    expect(screen.getByText('On')).toBeDefined();
  });

  it('asks before requiring sign-on, naming the owners’ way in', async () => {
    await page('state=on');

    fireEvent.click(screen.getByRole('switch', { name: 'Required sign-on' }));
    const ask = await screen.findByRole('alertdialog');
    expect(within(ask).getByText(/Owners keep their own sign-in/u)).toBeDefined();

    fireEvent.click(within(ask).getByRole('button', { name: 'Require sign-on' }));
    expect(screen.getByText('Required')).toBeDefined();
  });

  it('refuses removing while required is on', async () => {
    await page('state=required_on');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Okta…' }));
    expect(screen.getByRole('alert').textContent).toContain('Turn off required sign-on first.');
  });

  it('asks before a change, the old provider staying', async () => {
    await page('state=on');

    fireEvent.click(screen.getByRole('button', { name: 'Change provider…' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Change provider',
      }),
    );
    expect(
      screen.getByText('Okta stays on until the new provider is tested and switched on.'),
    ).toBeDefined();
  });

  it('locks it on Free and reads it to an admin', async () => {
    await page('state=none&plan=free');
    expect(screen.getByText('Comes with Enterprise')).toBeDefined();
    expect(screen.getByRole('button', { name: 'See plans' })).toBeDefined();
    cleanup();

    await page('as=julien&state=not_owner');
    expect(screen.getByText('Only an owner can set up or change single sign-on.')).toBeDefined();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('names the exemption under two-factor for everyone on Sign-in rules', async () => {
    await at('/demo/settings/sign-in-rules?state=everyoneSso', 'Sign-in rules');

    expect(
      screen.getByText('Sign-in through your organisation’s own single sign-on is exempt.'),
    ).toBeDefined();
  });

  it('hands an address at ire.events to Okta at sign-in, another way kept', async () => {
    await at('/demo/sign-in?state=sso_handoff', 'Sign in');

    expect(screen.getByText('Ire Events signs in through Okta.')).toBeDefined();
    expect(screen.queryByLabelText('Password')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Okta' }));
    expect(screen.getByRole('link', { name: 'Come back signed in' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in another way' }));
    expect(screen.getByLabelText('Password')).toBeDefined();
  });

  it('refuses a password under required sign-on, and lets the owner in', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await at('/demo/sign-in?state=sso_required', 'Sign in');

    expect(screen.getByText('Ire Events signs you in through Okta.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue to Okta' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct horse battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(screen.queryByRole('heading', { level: 1, name: 'Sign in' })).toBeNull();
  });

  it('shows the break-glass email to the other owners', async () => {
    await at('/demo/emails/sso-break-glass', 'Folake Adeyemi signed in to Ire Events without Okta');

    expect(screen.getByText(/with a password at 09:14/u)).toBeDefined();
    expect(screen.getByText(/recorded in the audit log/u)).toBeDefined();
  });
});
