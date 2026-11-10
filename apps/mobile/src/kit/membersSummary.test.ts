import type { OrganisationMember, OwnerClaimBanner } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import { membersCard, membersCounts, memberLine, memberTag } from './membersSummary.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

function member(
  id: string,
  name: string,
  status: OrganisationMember['status'] = 'active',
  more: Partial<OrganisationMember> = {},
): OrganisationMember {
  return {
    id,
    user: { id: `user_${id}`, name, email: `${id}@ire.events` },
    role: { id: 'role_member', seededAs: 'member', name: null },
    status,
    former: status === 'left_or_removed' ? 'left' : null,
    channel: 'domain',
    message: null,
    since: '2026-10-19T09:00:00Z',
    removesAt: null,
    invitedBy: null,
    invitedAt: null,
    self: false,
    history: [],
    suspension: null,
    ...more,
  };
}

const people = [
  member('folake', 'Folake Adeyemi', 'active', { self: true }),
  member('priya', 'Priya Shah'),
  member('marta', 'Marta Silva', 'suspended'),
  member('lucia', 'Lucía Gómez', 'pending_approval'),
  member('daniel', 'Daniel Kim', 'left_or_removed'),
];

const card = (over: Partial<Parameters<typeof membersCard>[0]> = {}) =>
  membersCard({
    t,
    members: people,
    manages: true,
    organisation: 'Ire Events',
    said: null,
    claim: null,
    ...over,
  });

describe("Members' card", () => {
  it('says how many people and how many wait, with answering the oldest as its step', () => {
    const shown = card();

    expect(shown.says).toBe('3 people · 1 waiting');
    expect(shown.step).toEqual({
      label: 'Answer Lucía Gómez',
      does: { does: 'answer', member: 'lucia' },
    });
    expect(shown.faces).toHaveLength(3);
  });

  it('has no step and counts nobody waiting for somebody who does not manage members', () => {
    const shown = card({ manages: false });

    expect(shown.says).toBe('3 people');
    expect(shown.step).toBeNull();
  });

  it('says who joined, and offers to see them', () => {
    const shown = card({
      said: { kind: 'approved', member: 'lucia', name: 'Lucía Gómez', role: 'Member' },
    });

    expect(shown.says).toBe('Lucía Gómez joined as Member');
    expect(shown.step?.does).toEqual({ does: 'seePerson', member: 'lucia' });
    expect(shown.readsOut).toBe(true);
  });

  it('says who was removed, and still offers the waiting request first', () => {
    const shown = card({ said: { kind: 'removed', name: 'Priya Shah' } });

    expect(shown.says).toBe('Priya Shah was removed');
    expect(shown.line).toContain('Their events stay with Ire Events.');
    expect(shown.step?.does).toEqual({ does: 'answer', member: 'lucia' });
  });

  it('says the organisation has no active owner, with Become the owner as its step', () => {
    const claim: OwnerClaimBanner = {
      state: 'no_owner',
      domain: 'ire.events',
      claim: null,
      stopped: null,
      lapsed: null,
    };
    const shown = card({ claim });

    expect(shown.says).toBe('Ire Events has no active owner');
    expect(shown.line).toBe(
      'Events, guests and your permissions keep working. Only Owner actions, such as billing, wait for an owner.',
    );
    expect(shown.step?.label).toBe('Become the owner');
  });

  const deadline = (written: string) => ({ at: '2026-11-13T08:41:00Z', written });
  const banner = (over: Partial<OwnerClaimBanner>): OwnerClaimBanner => ({
    state: 'open',
    domain: 'ire.events',
    claim: null,
    stopped: null,
    lapsed: null,
    ...over,
  });
  const claimBy = (mine: boolean, passes: string | null): OwnerClaimBanner['claim'] => ({
    id: 'claim_1',
    claimant: { id: 'user_ana', name: 'Ana Souza', email: 'ana.souza@ire.events' },
    mine,
    domain: 'ire.events',
    record: null,
    startedAt: deadline('8 November 2026 at 09:41 WAT'),
    lapsesAt: deadline('15 November 2026 at 16:20 WAT'),
    foundAt: passes == null ? null : deadline('10 November 2026 at 09:41 WAT'),
    passesAt: passes == null ? null : deadline(passes),
  });

  it('says a found claim of your own passes to you, with no step on the card', () => {
    const shown = card({
      claim: banner({ state: 'found', claim: claimBy(true, '13 November 2026 at 09:41 WAT') }),
    });

    expect(shown.says).toBe('Record found');
    expect(shown.line).toBe('Ownership passes to you on 13 November 2026 at 09:41 WAT.');
    expect(shown.step).toBeNull();
  });

  it("names the admin becoming the owner, with their record's state as the line", () => {
    const unfound = card({ claim: banner({ claim: claimBy(false, null) }) });
    const found = card({
      claim: banner({ state: 'found', claim: claimBy(false, '12 November 2026 at 16:20 WAT') }),
    });

    expect(unfound.says).toBe('Ana Souza is becoming the owner');
    expect(unfound.line).toBe(
      'Their DNS record has not been found yet. Without it, the claim lapses on 15 November 2026 at 16:20 WAT.',
    );
    expect(found.says).toBe('Ana Souza is becoming the owner');
    expect(found.line).toBe(
      'Their record is found. Ownership passes on 12 November 2026 at 16:20 WAT.',
    );
  });

  it('says you stopped the claim, and to anyone else that the organisation has no active owner', () => {
    const stopped = {
      by: 'user_folake',
      claimant: 'Ana Souza',
      mine: true,
      at: deadline('10 November 2026 at 10:00 WAT'),
    };
    const yours = card({ claim: banner({ state: 'closed', stopped }) });
    const closed = card({
      claim: banner({ state: 'closed', stopped: { ...stopped, mine: false } }),
    });

    expect(yours.says).toBe('You stopped Ana Souza’s claim');
    expect(yours.line).toBe(
      'Everybody who was told is emailed. Only Soirely support can restore an owner of Ire Events now.',
    );
    expect(closed.says).toBe('Ire Events has no active owner');
    expect(closed.line).toMatch(
      /^A claim was stopped, so only Soirely support can restore an owner\. Events, guests/,
    );
    expect(closed.step).toBeNull();
  });
});

describe("Members' rows", () => {
  it('tags only a state that is not the rule', () => {
    expect(memberTag(t, people[1] as OrganisationMember)).toBeNull();
    expect(memberTag(t, people[2] as OrganisationMember)).toEqual({
      kind: 'paused',
      word: 'Suspended',
    });
  });

  it('says the role, and you on your own row', () => {
    expect(memberLine(t, people[0] as OrganisationMember)).toBe('Member · you');
  });

  it('counts the filter menu as the web does: All is active and suspended', () => {
    expect(membersCounts(people)).toEqual({ all: 3, active: 2, suspended: 1, former: 1 });
  });
});
