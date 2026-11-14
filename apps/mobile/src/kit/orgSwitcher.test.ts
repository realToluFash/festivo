import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { InvitationPreview, JoinOffer, Membership } from '@soirely/api-client';
import type { InvitationOutcome } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import type { WaitingInvitations } from '../invitations.ts';
import type { DomainOffer } from '../joinOffers.ts';
import { switcherSession, tilesOf } from './orgSwitcher.ts';

const membership = (id: string, name: string): Membership =>
  ({ id, name, role: 'member' }) as unknown as Membership;
const IRE = membership('org-ire', 'Ire Events');
const CASA = membership('org-casa', 'Casa Lumen');
const ALAMEDA = membership('org-alameda', 'Celebraciones Alameda');

const invitation = {
  id: 'inv-alameda',
  organisation: { id: ALAMEDA.id, name: ALAMEDA.name },
  invitedBy: { name: 'Kemi Adeyemi' },
  role: 'member',
  expiresAt: '2026-11-20T12:00:00Z',
  email: 'folake@ire.events',
  signedInAs: 'folake@ire.events',
} as unknown as InvitationPreview;

function waiting(outcomes: Record<string, InvitationOutcome> = {}): WaitingInvitations {
  return { invitations: [invitation], outcomes, answer: () => Promise.resolve({ kind: 'failed' }) };
}

const noOffer: DomainOffer = {
  organisation: null,
  domain: null,
  asked: false,
  ask: () => Promise.resolve(),
  dismiss: () => Promise.resolve(),
};

function session(
  overrides: Partial<Parameters<typeof switcherSession>[0]> = {},
): ReturnType<typeof switcherSession> {
  return switcherSession({
    organisations: [IRE, CASA],
    current: IRE,
    waiting: waiting(),
    answeredHere: new Set(),
    offer: noOffer,
    offerRefused: false,
    expanded: null,
    role: (role) => `role:${role}`,
    ...overrides,
  });
}

const kinds = (shown: ReturnType<typeof switcherSession>) =>
  tilesOf(shown, '').map((tile) =>
    tile.kind === 'place' ? `${tile.place.name}${tile.current ? '*' : ''}` : tile.kind,
  );

describe('the switcher in the signed-in app', () => {
  it('shows your organisations, the current one marked, then the invitations, then Create', () => {
    expect(kinds(session())).toEqual(['Ire Events*', 'Casa Lumen', 'invitation', 'create']);
    expect(session().places[0]?.role).toBe('role:member');
  });

  it('marks none current while access is paused', () => {
    expect(kinds(session({ current: null }))).toEqual([
      'Ire Events',
      'Casa Lumen',
      'invitation',
      'create',
    ]);
  });

  it('keeps an invitation joined while it is open as its invitation, not a second tile', () => {
    const joined = session({
      organisations: [IRE, CASA, ALAMEDA],
      waiting: waiting({ [invitation.id]: { kind: 'accepted', organisationId: ALAMEDA.id } }),
      answeredHere: new Set([invitation.id]),
    });

    expect(kinds(joined)).toEqual(['Ire Events*', 'Casa Lumen', 'joined', 'create']);
  });

  it('shows the organisation joined before it opened as a place, and the invitation gone', () => {
    const earlier = session({
      organisations: [IRE, CASA, ALAMEDA],
      waiting: waiting({ [invitation.id]: { kind: 'accepted', organisationId: ALAMEDA.id } }),
    });

    expect(kinds(earlier)).toEqual([
      'Ire Events*',
      'Casa Lumen',
      'Celebraciones Alameda',
      'create',
    ]);
  });

  it('keeps an answer that did not reach us waiting', () => {
    expect(kinds(session({ waiting: waiting({ [invitation.id]: { kind: 'failed' } }) }))).toEqual([
      'Ire Events*',
      'Casa Lumen',
      'invitation',
      'create',
    ]);
  });

  it('offers the organisation at your domain: open, asked, or refused', () => {
    const offer = (asked: boolean): DomainOffer => ({
      ...noOffer,
      organisation: { id: 'org-weddings', name: 'Ire Weddings' } as JoinOffer,
      domain: 'ire.events',
      asked,
    });

    expect(session({ offer: offer(false) }).offer?.status).toBe('open');
    expect(session({ offer: offer(true) }).offer?.status).toBe('asked');
    expect(session({ offer: offer(false), offerRefused: true }).offer?.status).toBe('unavailable');
    expect(session({ offer: offer(false) }).offer?.domain).toBe('ire.events');
  });
});

const read = (...path: string[]) => readFileSync(join(import.meta.dirname, '..', ...path), 'utf8');

describe('Today’s openers', () => {
  it('are the product’s, with no slot left for the demo to fill', () => {
    const shell = read('components', 'todayShell.ts');

    expect(shell).not.toMatch(/OrgOpener\?|OpenerAt/u);
    expect(read('demo', 'demoShell.ts')).toMatch(/useOrgOpener,/u);
    expect(read('components', 'TodayLanding.tsx')).toMatch(/useOrgOpener: useFrameOrgOpener/u);
  });

  it('leave the iPad sidebar’s switcher out for someone in no organisation', () => {
    expect(read('components', 'TodaySidebar.tsx')).toMatch(/\{org && <SidebarOrg \/>\}/u);
    expect(read('demo', 'settings', 'Frame.tsx')).toMatch(/org=\{shell\.viewer !== 'noOrg'\}/u);
  });
});
