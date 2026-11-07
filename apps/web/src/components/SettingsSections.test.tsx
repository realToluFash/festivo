import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../session.ts';
import { membership } from '../test-memberships.ts';
import { SettingsSections } from './SettingsSections.tsx';

function sectionsFor(seededAs: 'owner' | 'administrator' | 'member'): string[] {
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
    <MemoryRouter initialEntries={['/app/settings']}>
      <SettingsSections />
    </MemoryRouter>,
  );

  return within(screen.getByRole('navigation', { name: 'Organisation settings' }))
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

describe('the organisation settings list (sc-29915)', () => {
  it.each(['owner', 'administrator'] as const)(
    'gives an %s General, Members and Sign-in rules, and no Roles',
    (seededAs) => {
      expect(sectionsFor(seededAs)).toEqual(['General', 'Members', 'Sign-in rules']);
    },
  );

  it('gives a member General and Sign-in rules, and no Members', () => {
    expect(sectionsFor('member')).toEqual(['General', 'Sign-in rules']);
  });
});
