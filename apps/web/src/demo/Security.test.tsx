import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { SAMPLE } from './rules.ts';
import { NEW_PASSWORD, SECURITY_STATES, WEB_MOMENTS } from './security.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 3000 };

async function security(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Security' });

  return { router, view };
}

function block(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function ask(name: string): HTMLElement {
  return screen.getByRole('alertdialog', { name });
}

function buttonsOf(box: HTMLElement): string[] {
  return within(box)
    .getAllByRole('button')
    .map((one) => one.textContent ?? '');
}

function type(label: string, value: string): void {
  fireEvent.change(within(dialog()).getByLabelText(label), { target: { value } });
}

function open(section: string, name: RegExp): HTMLElement {
  fireEvent.click(within(block(section)).getByRole('button', { name }));

  return screen.getByRole('group', { name: name.source.replace(/\\/g, '') });
}

describe('Security at a desk (sc-30223)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('opens from the Settings list’s Security row, the row no longer a design of its own', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings'] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' });

    fireEvent.click(within(list).getByRole('link', { name: 'Security' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Security' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/settings/security');
    expect(screen.queryByText('Security has its own design.')).toBeNull();
    expect(within(list).getByRole('link', { name: 'Account' })).toBeDefined();
  });

  it('puts how you are protected on the card, and the rows flat under it', async () => {
    await security('/demo/settings/security');

    expect(screen.getByText('Two-factor is on')).toBeDefined();
    expect(screen.getByText('2 ways to sign in · 3 devices')).toBeDefined();
    expect(within(block('Ways to sign in')).getAllByRole('button')).toHaveLength(3);
    expect(within(block('Two-factor authentication')).getAllByRole('button')).toHaveLength(2);
    expect(within(block('Signed in on')).getByText('This device · in use now')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out everywhere else…' })).toBeDefined();
  });

  it('shows the same page to an admin and a member, as their own sign-in', async () => {
    const { view } = await security('/demo/settings/security?as=julien');
    expect(screen.getByText('Two-factor is on')).toBeDefined();
    view.unmount();

    await security('/demo/settings/security?as=ana');
    expect(screen.getByText('Linked · ana.souza@gmail.com')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out everywhere else…' })).toBeDefined();
  });

  it('opens a state it does not know as the page with no state', async () => {
    await security('/demo/settings/security?state=rules');

    expect(screen.getByText('Two-factor is on')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('opens every state and moment the demo home links', async () => {
    for (const state of [...SECURITY_STATES, ...WEB_MOMENTS]) {
      const { view } = await security(`/demo/settings/security?state=${state}`);
      expect(screen.getByRole('heading', { level: 1, name: 'Security' }), state).toBeDefined();
      view.unmount();
    }
  });

  it('saves nothing before Save, and asks before a typed password is thrown away', async () => {
    await security('/demo/settings/security');
    fireEvent.click(screen.getByRole('button', { name: /Password/ }));

    expect(within(dialog()).getByRole('heading', { name: 'Change password' })).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(within(dialog()).getByText('Enter your current password.')).toBeDefined();
    expect(within(dialog()).getByText('Enter a new password.')).toBeDefined();

    type('Current password', SAMPLE.password);
    fireEvent.keyDown(document, { key: 'Escape' });
    const discard = ask('Discard your change?');
    expect(within(discard).getByText('Your password stays as it was.')).toBeDefined();
    expect(buttonsOf(discard)).toEqual(['Keep editing', 'Discard']);
    fireEvent.click(within(discard).getByRole('button', { name: 'Keep editing' }));

    type('New password', NEW_PASSWORD);
    expect(within(dialog()).getByText('Met')).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'Password changed. Your 2 other devices are signed out.',
        undefined,
        SLOW,
      ),
    ).toBeDefined();
    expect(within(block('Signed in on')).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Sign out everywhere else…' })).toBeNull();
  });

  it('leaves an empty edit at once, and sends a reset link from Forgot it?', async () => {
    await security('/demo/settings/security?state=changePassword');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Forgot it?' }));

    expect(within(dialog()).getByRole('heading', { name: 'Reset your password' })).toBeDefined();
    expect(within(dialog()).getByLabelText('Email')).toHaveProperty('value', SAMPLE.email);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Send' }));

    await screen.findByRole('heading', { name: 'Check your email' }, WAIT);
    expect(within(dialog()).queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Send it again' }));
    expect(within(dialog()).getByRole('heading', { name: 'Reset your password' })).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('unlinks after its Ask and a proof, then links without asking again inside 5 minutes', async () => {
    await security('/demo/settings/security');
    const google = open('Ways to sign in', /Google/);

    fireEvent.click(within(google).getByRole('button', { name: 'Unlink…' }));
    const unlink = ask('Unlink Google?');
    expect(buttonsOf(unlink)).toEqual(['Keep it linked', 'Unlink Google']);
    fireEvent.click(within(unlink).getByRole('button', { name: 'Unlink Google' }));

    expect(within(dialog()).getByRole('heading', { name: 'Confirm it’s you' })).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));
    expect(within(dialog()).getByText('Enter your password.')).toBeDefined();
    type('Your password', SAMPLE.password);
    type('Code', SAMPLE.authenticator);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        'Google is unlinked. Devices signed in with it are signed out.',
        undefined,
        SLOW,
      ),
    ).toBeDefined();
    const apple = open('Ways to sign in', /Apple/);
    fireEvent.click(within(apple).getByRole('button', { name: 'Link Apple' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByText('Apple is linked. We emailed your verified addresses to say so.'),
    ).toBeDefined();
  });

  it('shows an expired code in the field’s place, as Your account does, and a new one brings it back', async () => {
    await security('/demo/settings/security?state=setPasswordExpired');

    expect(within(dialog()).getByRole('heading', { name: 'Check your email' })).toBeDefined();
    expect(within(dialog()).getByRole('alert').textContent).toBe(
      'That code has expiredCodes only work for a while. Send a new one and use the code in the newest email.',
    );
    expect(within(dialog()).queryByLabelText('Code from the email')).toBeNull();
    expect(
      within(dialog()).getByRole('button', { name: 'Continue' }).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Send a new code' }));

    expect(within(dialog()).getByLabelText('Code from the email')).toHaveProperty('value', '');
    expect(within(dialog()).getByText('Send a new code in 0:42')).toBeDefined();
    expect(within(dialog()).queryByRole('alert')).toBeNull();
  });

  it('closes a proof at once on Cancel, whatever is typed', async () => {
    await security('/demo/settings/security?state=unlinkProve');
    type('Your password', SAMPLE.password);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Linked · folake.adeyemi@gmail.com')).toBeDefined();
  });

  it('keeps what a rule keeps, off and named, with words saying why', async () => {
    await security('/demo/settings/security?state=keptByRule');
    const google = screen.getByRole('group', { name: 'Google' });

    expect(
      within(google).getByRole('button', { name: 'Unlink' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(within(google).getByText(/A rule set by Ire Events/)).toBeDefined();
    fireEvent.click(within(google).getByRole('button', { name: 'Unlink' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    const auth = open('Two-factor authentication', /Authenticator app/);
    expect(
      within(auth)
        .getByRole('button', { name: 'Turn off two-factor' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      within(auth).getByText('Ire Events requires two-factor, so you cannot turn it off.'),
    ).toBeDefined();
  });

  it('carries the Google or Apple rule on linkPick, keeping Unlink once one is linked', async () => {
    await security('/demo/settings/security?state=linkPick');
    const auth = open('Two-factor authentication', /Authenticator app/);
    expect(within(auth).getByRole('button', { name: 'Turn off two-factor…' })).toBeDefined();

    const google = open('Ways to sign in', /Google/);
    fireEvent.click(within(google).getByRole('button', { name: 'Link Google' }));
    type('Your password', SAMPLE.password);
    type('Code', SAMPLE.authenticator);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText(
        'Google is linked. We emailed your verified addresses to say so.',
        undefined,
        SLOW,
      ),
    ).toBeDefined();

    const linked = open('Ways to sign in', /Google/);
    expect(
      within(linked).getByRole('button', { name: 'Unlink' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(within(linked).getByText(/A rule set by Ire Events/)).toBeDefined();
  });

  it('gives the last way in no way to remove it', async () => {
    await security('/demo/settings/security?state=googleOnly');

    expect(within(block('Ways to sign in')).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText(/Google is your only way to sign in/)).toBeDefined();
  });

  it('sets up two-factor from the card, then holds the codes until they are saved, saying Copied only once the browser has', async () => {
    await security('/demo/settings/security?state=googleOnly');
    fireEvent.click(screen.getByRole('button', { name: 'Turn on two-factor' }));

    expect(
      within(dialog()).getByRole('img', { name: 'QR code for your authenticator app' }),
    ).toBeDefined();
    type('Enter the 6-digit code the app shows', '714 320');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Turn on' }));
    expect(within(dialog()).getByText(/That code does not match/)).toBeDefined();
    type('Enter the 6-digit code the app shows', SAMPLE.authenticator);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Turn on' }));

    await screen.findByRole('heading', { name: 'Save your recovery codes' }, WAIT);
    const codes = within(dialog()).getByRole('list', { name: 'Recovery codes' });
    expect(within(codes).getAllByRole('listitem')).toHaveLength(10);
    expect(within(dialog()).queryByRole('button', { name: 'Cancel' })).toBeNull();
    const finish = within(dialog()).getByRole('button', { name: 'Finish' });
    expect(finish.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(finish);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeDefined();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Copy all' }));
    await new Promise((settled) => setTimeout(settled, 0));
    expect(within(dialog()).queryByText('All 10 codes are on your clipboard.')).toBeNull();
    expect(within(dialog()).getByRole('button', { name: 'Copy all' })).toBeDefined();

    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Copy all' }));
    expect(await within(dialog()).findByText('All 10 codes are on your clipboard.')).toBeDefined();
    expect(writeText).toHaveBeenCalledWith(
      within(codes)
        .getAllByRole('listitem')
        .map((one) => one.textContent)
        .join('\n'),
    );
    fireEvent.click(within(dialog()).getByLabelText('I have saved these codes somewhere safe'));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Finish' }));

    expect(
      screen.getByText('Two-factor is on. Every sign-in now asks for a code from your app.'),
    ).toBeDefined();
    expect(screen.getByText('10 of 10 unused · each works once')).toBeDefined();
  });

  it('turns two-factor off after its Ask and a code alone', async () => {
    await security('/demo/settings/security');
    const auth = open('Two-factor authentication', /Authenticator app/);

    fireEvent.click(within(auth).getByRole('button', { name: 'Turn off two-factor…' }));
    fireEvent.click(
      within(ask('Turn off two-factor?')).getByRole('button', { name: 'Turn it off' }),
    );
    expect(within(dialog()).queryByLabelText('Your password')).toBeNull();
    type('Code', SAMPLE.recovery);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        `Two-factor is off. We emailed ${SAMPLE.email} to say so.`,
        undefined,
        SLOW,
      ),
    ).toBeDefined();
    expect(screen.getByText('Two-factor is off')).toBeDefined();
  });

  it('signs out another device after its Ask, and this one goes to sign-in', async () => {
    const { router } = await security('/demo/settings/security');
    const phone = open('Signed in on', /Soirely app on iPhone/);

    fireEvent.click(within(phone).getByRole('button', { name: 'Sign out…' }));
    const out = ask('Sign out Soirely app on iPhone?');
    expect(buttonsOf(out)).toEqual(['Keep it signed in', 'Sign it out']);
    fireEvent.click(within(out).getByRole('button', { name: 'Sign it out' }));

    expect(screen.getByText('Soirely app on iPhone is signed out.')).toBeDefined();
    expect(within(block('Signed in on')).getAllByRole('button')).toHaveLength(2);

    const here = open('Signed in on', /Safari on macOS/);
    fireEvent.click(within(here).getByRole('button', { name: 'Sign out' }));
    expect(router.state.location.pathname).toBe('/demo/sign-in');
  });

  it('signs out everywhere else after its Ask and a password and code', async () => {
    await security('/demo/settings/security');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out everywhere else…' }));

    const everywhere = ask('Sign out everywhere else?');
    expect(buttonsOf(everywhere)).toEqual(['Keep them signed in', 'Sign them out']);
    fireEvent.click(within(everywhere).getByRole('button', { name: 'Sign them out' }));
    type('Your password', SAMPLE.password);
    type('Code', SAMPLE.authenticator);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText('Your 2 other devices are signed out.', undefined, WAIT),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Sign out everywhere else…' })).toBeNull();
  });
});
