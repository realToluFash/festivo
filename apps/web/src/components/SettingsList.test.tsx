import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../session.ts';
import { membership } from '../test-memberships.ts';
import { SettingsList } from './SettingsList.tsx';

function listFor(
  seededAs: 'owner' | 'administrator' | 'member',
  at = '/app/settings',
): HTMLElement {
  const organisation = membership({
    role: { id: `role_${seededAs}`, seededAs, name: null },
    ...(seededAs === 'member' ? { permissions: [] } : {}),
  });
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u_folake',
    needsOrganisation: false,
    hasPassword: true,
    organisation,
    organisations: [organisation],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };
  __setSessionState({ status: 'signedIn', session });

  render(
    <MemoryRouter initialEntries={[at]}>
      <SettingsList />
    </MemoryRouter>,
  );

  return screen.getByRole('navigation', { name: 'Settings' });
}

function groupOf(list: HTMLElement, name: string): string[] {
  const heading = within(list).getByRole('heading', { name });
  const group = heading.parentElement;
  if (group == null) throw new Error(`no group under ${name}`);

  return within(group)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

describe('the Settings list (sc-30190)', () => {
  it('lists your account first: Account, Security, Notifications and Personalisation (sc-30441)', () => {
    expect(groupOf(listFor('member'), 'Your account')).toEqual([
      'FAAccount',
      'Security',
      'Notifications',
      'Personalisation',
    ]);
  });

  it.each(['owner', 'administrator'] as const)(
    'gives an %s General, Members and Sign-in rules, and no Roles',
    (seededAs) => {
      expect(groupOf(listFor(seededAs), 'Organisation settings')).toEqual([
        expect.stringMatching(/General$/),
        'Members',
        'Sign-in rules',
      ]);
    },
  );

  it('gives a member General and Sign-in rules, and no Members', () => {
    expect(groupOf(listFor('member'), 'Organisation settings')).toEqual([
      expect.stringMatching(/General$/),
      'Sign-in rules',
    ]);
  });

  it.each([
    ['/app/account', 'Account', 'Account – Your account – Soirely'],
    ['/app/account/security', 'Security', 'Security – Your account – Soirely'],
    ['/app/account/notifications', 'Notifications', 'Notifications – Your account – Soirely'],
    ['/app/account/personalisation', 'Personalisation', 'Personalisation – Your account – Soirely'],
    ['/app/settings', 'General', 'General – Settings – Soirely'],
    ['/app/settings/members', 'Members', 'Members – Settings – Soirely'],
    ['/app/settings/sign-in-rules', 'Sign-in rules', 'Sign-in rules – Settings – Soirely'],
  ])('at %s selects %s alone, and titles the page', (at, name, title) => {
    const list = listFor('owner', at);
    const current = within(list)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current.map((link) => link.textContent)).toEqual([expect.stringMatching(`${name}$`)]);
    expect(current[0]?.className).toContain('is-on');
    expect(document.title).toBe(title);
  });
});
