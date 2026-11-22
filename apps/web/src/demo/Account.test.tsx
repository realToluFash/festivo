import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetNames } from './savedName.ts';

const tested = config();
const WAIT = { timeout: 3000 };

async function account(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Your account' });

  return router;
}

function block(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

describe('Your account at a desk (sc-30209)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => {
    vi.useRealTimers();
    forgetNames();
  });

  it('opens from the Settings list beside it, the row no longer a design of its own', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings'] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' });

    fireEvent.click(within(list).getByRole('link', { name: 'Account' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Your account' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/settings/account');
    expect(screen.queryByText('Account has its own design.')).toBeNull();
    expect(within(list).getByRole('link', { name: 'Members' })).toBeDefined();
    expect(within(list).getByRole('link', { name: 'General' })).toBeDefined();
  });

  it('puts you on the card with the one thing left to do, and the rows flat under it', async () => {
    await account('/demo/settings/account');

    expect(screen.getByText('folake.adeyemi@gmail.com is not verified yet.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send a code' })).toBeDefined();
    expect(within(block('About you')).getAllByRole('button')).toHaveLength(2);
    expect(within(block('Email addresses')).getByText('Unverified')).toBeDefined();
    expect(
      within(block('Email addresses')).queryByRole('button', { name: 'Add an email address' }),
    ).toBeNull();
    expect(
      within(block('Phone numbers')).getByRole('button', { name: 'Add a phone number' }),
    ).toBeDefined();
  });

  it('shows the same page to a member, as their own account', async () => {
    await account('/demo/settings/account?as=ana');

    expect(screen.getAllByText('Ana Souza').length).toBeGreaterThan(0);
    expect(screen.getByText('ana.souza@outlook.com is not verified yet.')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Phone numbers' })).toBeDefined();
  });

  it('opens a row in place, one at a time, and removes an unverified one at once', async () => {
    await account('/demo/settings/account');
    const row = within(block('Email addresses')).getByRole('button', {
      name: /folake.adeyemi@gmail.com/,
    });

    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    const panel = screen.getByRole('group', { name: 'folake.adeyemi@gmail.com' });
    expect(within(panel).getByRole('button', { name: 'Send a code' })).toBeDefined();

    fireEvent.click(within(panel).getByRole('button', { name: 'Remove' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('folake.adeyemi@gmail.com has been removed.')).toBeDefined();
    expect(
      within(block('Email addresses')).getByRole('button', { name: 'Add an email address' }),
    ).toBeDefined();
  });

  it('asks before making an address primary, then asks for proof', async () => {
    await account('/demo/settings/account?state=promote');
    const ask = screen.getByRole('alertdialog');

    expect(within(ask).getByRole('button', { name: 'Keep folake@ire.events' })).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Make it primary' }));

    expect(within(dialog()).getByRole('heading', { name: "Confirm it's you" })).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));
    expect(within(dialog()).getByText('Enter your password.')).toBeDefined();

    fireEvent.change(within(dialog()).getByLabelText('Your password'), {
      target: { value: 'correct horse battery' },
    });
    fireEvent.change(within(dialog()).getByLabelText('Code'), { target: { value: '714302' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        'folake.adeyemi@gmail.com is now your primary address. Sign in with it from now on.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks before removing a verified address, the way back first', async () => {
    await account('/demo/settings/account?state=remove');
    const ask = screen.getByRole('alertdialog');
    const [keep, go] = within(ask).getAllByRole('button');

    expect(keep?.textContent).toBe('Keep it');
    expect(go?.textContent).toBe('Remove it');
    fireEvent.click(go!);

    expect(screen.getByText('folake.adeyemi@gmail.com has been removed.')).toBeDefined();
  });

  it('saves nothing before Save, and asks before a change is thrown away', async () => {
    await account('/demo/settings/account?state=name');
    const field = within(dialog()).getByLabelText('Full name');

    expect(
      within(dialog()).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.change(field, { target: { value: 'Folake Adeyemi-Bello' } });
    fireEvent.keyDown(document, { key: 'Escape' });

    const ask = screen.getByRole('alertdialog', { name: 'Discard your change?' });
    expect(within(ask).getByText('Your name stays Folake Adeyemi.')).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Name changed to Folake Adeyemi-Bello.', undefined, WAIT),
    ).toBeDefined();
  });

  it('opens the Name row on the saved name, and Escape closes it at once', async () => {
    await account('/demo/settings/account');

    fireEvent.click(within(block('About you')).getByRole('button', { name: /Folake Adeyemi/ }));
    expect(within(dialog()).getByLabelText('Full name')).toHaveProperty('value', 'Folake Adeyemi');
    expect(
      within(dialog()).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes Confirm it’s you on Escape with something typed, and nothing changes', async () => {
    await account('/demo/settings/account?state=confirm');

    fireEvent.change(within(dialog()).getByLabelText('Your password'), {
      target: { value: 'correct horse battery' },
    });
    fireEvent.change(within(dialog()).getByLabelText('Code'), { target: { value: '714302' } });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/is now your primary address/)).toBeNull();
    expect(
      within(block('Email addresses')).getByRole('button', { name: /folake.adeyemi@gmail.com/ }),
    ).toBeDefined();
  });

  it('closes Verify on Cancel with a code typed, and the address stays unverified', async () => {
    await account('/demo/settings/account?state=verifyEmail');

    fireEvent.change(within(dialog()).getByLabelText('Code from the email'), {
      target: { value: '482913' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(block('Email addresses')).getByText('Unverified')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send a code' })).toBeDefined();
  });

  it('puts the saved name’s initials on the card', async () => {
    await account('/demo/settings/account?state=name');

    fireEvent.change(within(dialog()).getByLabelText('Full name'), {
      target: { value: 'Oluwafolakemi Bello' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Name changed to Oluwafolakemi Bello.', undefined, WAIT),
    ).toBeDefined();
    expect(screen.getAllByText('OB')).toHaveLength(3);
  });

  it('refuses a blank name on the field', async () => {
    await account('/demo/settings/account?state=nameBlank');

    expect(within(dialog()).getByText('Enter your name.')).toBeDefined();
  });

  it('puts a picked time zone in the field and saves it', async () => {
    await account('/demo/settings/account?state=zone');

    fireEvent.click(within(dialog()).getByRole('button', { name: /San Marino/ }));
    expect(within(dialog()).getByLabelText('Find your time zone')).toHaveProperty(
      'value',
      'San Marino (UTC+01:00)',
    );
    expect(within(dialog()).queryByRole('list', { name: 'Matching time zones' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'Time zone changed to San Marino (UTC+01:00). Times in your emails now use it.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    expect(screen.getByText('Time zone · Europe/San Marino')).toBeDefined();
  });

  it('says nothing matches, and asks for a zone from the list', async () => {
    await account('/demo/settings/account?state=zoneNone');

    expect(
      within(dialog()).getByText(
        'No time zone matches “Atlantis”. Try a city, a country or an offset like UTC+01.',
      ),
    ).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(
      within(dialog()).getByText('Choose a time zone from the list. Nothing matches “Atlantis”.'),
    ).toBeDefined();
  });

  it('adds an address unverified, and the card says so', async () => {
    await account('/demo/settings/account?state=addEmail');

    fireEvent.change(within(dialog()).getByLabelText('Email address to add'), {
      target: { value: 'folake@lumen.studio' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByText(
        'Added. It is unverified until you enter the code we sent.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    expect(within(block('Email addresses')).getByText('folake@lumen.studio')).toBeDefined();
  });

  it('adds a number with its country, refusing one too short', async () => {
    await account('/demo/settings/account?state=addPhoneShort');

    expect(
      within(dialog()).getByText(
        'That number looks too short for United Kingdom. Check it and try again.',
      ),
    ).toBeDefined();
    fireEvent.change(within(dialog()).getByLabelText('Mobile number to add'), {
      target: { value: '7700 900461' },
    });
    expect((within(dialog()).getByLabelText('Code') as HTMLSelectElement).value).toBe('GB');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('+44 7700 900461', undefined, WAIT)).toBeDefined();
  });

  it('verifies an address: a wrong code on the field, a right one closes and the card says so', async () => {
    await account('/demo/settings/account?state=verifyEmailWrong');

    expect(
      await within(dialog()).findByText(
        'That code does not match. Check the newest email from Soirely and try again.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    fireEvent.change(within(dialog()).getByLabelText('Code from the email'), {
      target: { value: '482913' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));

    expect(
      await screen.findByText(
        'folake.adeyemi@gmail.com is verified. It stays an alternative address until you make it primary.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Send a code' })).toBeNull();
  });

  it('offers a new code once an old one expired, and the field comes back empty', async () => {
    await account('/demo/settings/account?state=verifyEmailExpired');

    expect(within(dialog()).getByRole('alert').textContent).toContain('That code has expired');
    expect(
      within(dialog()).getByRole('button', { name: 'Verify' }).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Send a new code' }));

    expect(
      await within(dialog()).findByLabelText('Code from the email', undefined, WAIT),
    ).toHaveProperty('value', '');
    expect(within(dialog()).getAllByText('Send a new code in 0:42')).toHaveLength(2);
  });

  it('counts down to a new code, and texts the code instead of WhatsApp', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await account('/demo/settings/account?state=verifyPhone');

    expect(
      await within(dialog()).findByText('We sent a code to your WhatsApp on +44 7700 900461.'),
    ).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Text it to me instead' }));
    expect(
      await within(dialog()).findByText(
        'We texted the same code to +44 7700 900461. The one on WhatsApp works too.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    expect(within(dialog()).getByLabelText('Code from the text')).toBeDefined();

    for (let second = 0; second < 42; second += 1) await act(() => vi.advanceTimersByTime(1000));
    await waitFor(() =>
      expect(
        within(dialog())
          .getByRole('button', { name: 'Send a new code' })
          .getAttribute('aria-disabled'),
      ).toBe('false'),
    );
  });

  it('offers the four languages, each in its own, and saves the one chosen at once (sc-39509)', async () => {
    await account('/demo/settings/account');
    const language = block('Language');
    const radios = within(language).getAllByRole('radio');

    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual([
      'English',
      'Español',
      'Français',
      'Português',
    ]);
    expect(
      radios.map((radio) => radio.closest('label')?.querySelector('[lang]')?.getAttribute('lang')),
    ).toEqual(['en', 'es', 'fr', 'pt']);
    expect(within(language).queryByText(/Automatic/)).toBeNull();
    expect(within(language).getByRole('radio', { name: 'English' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(language).queryByRole('button', { name: 'Save' })).toBeNull();

    fireEvent.click(within(language).getByRole('radio', { name: 'Español' }));
    fireEvent.click(within(language).getByRole('radio', { name: 'Français' }));

    expect(within(language).getByRole('radio', { name: 'Français' })).toHaveProperty(
      'checked',
      true,
    );
    expect(
      screen.getByText('Soirely is now in Français, on every device and in your emails.'),
    ).toBeDefined();
  });

  it('opens with Français saved on its state link', async () => {
    await account('/demo/settings/account?state=languageSaved');

    expect(within(block('Language')).getByRole('radio', { name: 'Français' })).toHaveProperty(
      'checked',
      true,
    );
  });
});

describe('Your account says which address Soirely could not deliver to (sc-44949)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => forgetNames());

  const line = (address: string) => `We couldn’t deliver email to ${address}.`;

  it('says so for the one address, and Change email opens Add an email address', async () => {
    await account('/demo/settings/account?state=undeliverable');

    expect(screen.getByText(line('folake@ire.events'))).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: 'Change email, instead of folake@ire.events' }),
    );

    expect(within(dialog()).getByLabelText('Email address to add')).toBeDefined();
  });

  it('gives each address its own line, and at two Change email opens the other row', async () => {
    await account('/demo/settings/account?state=undeliverableTwo');

    expect(screen.getByText(line('folake@ire.events'))).toBeDefined();
    expect(screen.getByText(line('folake.adeyemi@gmail.com'))).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: 'Change email, instead of folake@ire.events' }),
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    const row = within(block('Email addresses')).getByRole('button', {
      name: /folake.adeyemi@gmail.com/,
    });
    expect(row.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it('keeps the card’s line first, and a code typed takes both away', async () => {
    await account('/demo/settings/account?state=undeliverableUnverified');

    expect(screen.getByText('folake.adeyemi@gmail.com is not verified yet.')).toBeDefined();
    expect(screen.getByText(line('folake.adeyemi@gmail.com'))).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Send a code' }));
    fireEvent.change(await within(dialog()).findByLabelText('Code from the email'), {
      target: { value: '482913' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));

    await waitFor(
      () => expect(screen.queryByText(line('folake.adeyemi@gmail.com'))).toBeNull(),
      WAIT,
    );
    expect(screen.queryByText('folake.adeyemi@gmail.com is not verified yet.')).toBeNull();
  });

  it('goes once the address is removed, and shows nothing at rest', async () => {
    await account('/demo/settings/account?state=undeliverableUnverified');
    const row = within(block('Email addresses')).getByRole('button', {
      name: /folake.adeyemi@gmail.com/,
    });

    fireEvent.click(row);
    fireEvent.click(
      within(screen.getByRole('group', { name: 'folake.adeyemi@gmail.com' })).getByRole('button', {
        name: 'Remove',
      }),
    );

    expect(screen.queryByText(line('folake.adeyemi@gmail.com'))).toBeNull();
  });

  it('shows nothing about delivery on the page at rest', async () => {
    await account('/demo/settings/account');

    expect(screen.queryByText(/couldn’t deliver/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Change email/ })).toBeNull();
  });
});
