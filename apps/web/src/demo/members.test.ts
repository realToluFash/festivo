import { describe, expect, it } from 'vitest';

import {
  ANA,
  approvalRoles,
  counts,
  filtersFor,
  grantable,
  invitationRow,
  inviteProblem,
  LUCIA,
  MARTA,
  MEMBERS_STATES,
  membersCard,
  membersStart,
  PRIYA,
  personView,
  proofProblem,
  sampleInvitations,
  samplePeople,
  tagOf,
} from './members.ts';
import { SAMPLE } from './rules.ts';
import { SETTINGS_PAGES, settingsSayIn, VIEWERS } from './settings.ts';

const say = settingsSayIn('en-US');

function card(state: string, viewer = VIEWERS.folake) {
  const start = membersStart(state, viewer);

  return membersCard({ ...start, viewer, say });
}

function viewOf(id: string, viewer = VIEWERS.folake, state = '') {
  const start = membersStart(state, viewer);
  const person = start.people.find((one) => one.id === id);
  if (person == null) throw new Error(`nobody is ${id}`);

  return personView({ ...start, person, viewer, say });
}

describe('Members at a desk (sc-29708)', () => {
  it('starts on everybody, nothing open, for a name it does not know', () => {
    expect(membersStart('nobody', VIEWERS.folake)).toMatchObject({
      load: 'loaded',
      filter: 'all',
      menu: false,
      open: null,
      notice: null,
      claim: null,
      dialog: null,
    });
  });

  it('opens each state the boards draw where they draw it', () => {
    expect(membersStart('menu', VIEWERS.folake).menu).toBe(true);
    expect(membersStart('revoked', VIEWERS.folake).filter).toBe('invited');
    expect(membersStart('self', VIEWERS.julien).open).toBe(VIEWERS.julien.id);
    expect(membersStart('roleAdmin', VIEWERS.folake).dialog).toMatchObject({
      kind: 'role',
      picked: 'Admin',
    });
    expect(membersStart('makeOwnerWrong', VIEWERS.folake).dialog).toMatchObject({
      kind: 'role',
      id: ANA,
      proving: { problem: { field: 'code' } },
    });
  });

  it('suspends the only owner in every state of a claim', () => {
    const owner = (state: string) =>
      membersStart(state, VIEWERS.julien).people.find((one) => one.role === 'Owner');

    for (const state of ['noOwner', 'claim', 'found', 'lapsed', 'stopped'])
      expect(owner(state)?.status).toBe('suspended');
    expect(owner('priya')?.status).toBe('active');
  });

  it('counts everybody and those waiting, and offers the first request', () => {
    expect(card('')).toMatchObject({
      says: '7 people · 1 waiting',
      step: { label: 'Answer Lucía Gómez', does: 'answer', id: LUCIA },
      more: 2,
    });
    expect(card('', VIEWERS.julien).says).toBe('7 people · 1 waiting');
  });

  it('tells what just happened, and that nobody owns it while it is so', () => {
    expect(card('sent').says).toBe('Invitation sent to chidi.okafor@ire.events');
    expect(card('approved').step).toEqual({ label: 'See Lucía Gómez', does: 'see', id: LUCIA });
    expect(card('noOwner', VIEWERS.julien)).toMatchObject({
      says: 'Ire Events has no active owner',
      step: { does: 'become' },
    });
    expect(card('found', VIEWERS.julien).lines[0]).toBe(
      'Ownership passes on Friday, Nov 6 at 9:41 AM WAT.',
    );
  });

  it('gives what the viewer may do to a person by their standing', () => {
    expect(viewOf(PRIYA)).toMatchObject({
      step: { label: 'Change role', does: 'role' },
      suspend: true,
    });
    expect(viewOf(MARTA)).toMatchObject({ step: { label: 'Restore' }, kept: true });
    expect(viewOf(PRIYA, VIEWERS.julien).step).toMatchObject({ does: 'role' });
    expect(viewOf(SAMPLE.email, VIEWERS.julien).after).toContain(
      'Only an owner can make somebody else an owner. Ask Folake Adeyemi.',
    );
    expect(viewOf(VIEWERS.julien.id, VIEWERS.julien).after).toEqual([
      'You cannot change your own role. An owner or another admin can.',
    ]);
  });

  it('shows Awaiting approval only to those who manage members', () => {
    expect(filtersFor(VIEWERS.folake)).toContain('waiting');
    expect(filtersFor(VIEWERS.ana)).not.toContain('waiting');
    expect(counts(samplePeople(), sampleInvitations())).toEqual({
      all: 7,
      active: 6,
      invited: 1,
      waiting: 1,
      suspended: 1,
      former: 1,
    });
  });

  it('lets an owner give all three roles, an admin Admin and Member, and approve as Member first', () => {
    expect(grantable(VIEWERS.folake)).toEqual(['Owner', 'Admin', 'Member']);
    expect(grantable(VIEWERS.julien)).toEqual(['Admin', 'Member']);
    expect(grantable(VIEWERS.ana)).toEqual([]);
    expect(approvalRoles(VIEWERS.folake)).toEqual(['Member', 'Admin']);
  });

  it('tags a person by how they stand', () => {
    expect(tagOf({ status: 'domainSuspended', gone: null }).word).toBe('Suspended: company domain');
    expect(tagOf({ status: 'former', gone: 'removed' })).toEqual({
      kind: 'ended',
      word: 'Removed',
    });
  });

  it('writes who sent an invitation, and when it ends or ended', () => {
    const [pending, expired] = sampleInvitations();
    if (pending == null || expired == null) throw new Error('no invitations');

    expect(invitationRow(pending, samplePeople(), VIEWERS.folake, say)).toEqual({
      tag: null,
      line: 'Member · invited by you',
      dates: 'Sent Nov 2, 2026 · expires Nov 9, 2026',
    });
    expect(invitationRow(expired, samplePeople(), VIEWERS.folake, say).tag).toBe('Expired');
  });

  it('asks for an address that looks like one', () => {
    expect(inviteProblem(' ')).toBe('Enter their email address.');
    expect(inviteProblem('chidi.okafor')).toMatch(/^That does not look like an email address/u);
    expect(inviteProblem('chidi.okafor@ire.events')).toBeNull();
  });

  it('takes the sample password with the app’s code or a recovery code', () => {
    expect(proofProblem('', '')).toEqual({ field: 'password', message: 'Enter your password.' });
    expect(proofProblem(SAMPLE.password, '')?.field).toBe('code');
    expect(proofProblem('wrong', '714302')?.field).toBe('password');
    expect(proofProblem(SAMPLE.password, '481207')?.field).toBe('code');
    expect(proofProblem(SAMPLE.password, '714 302')).toBeNull();
    expect(proofProblem(SAMPLE.password, 'VTXP-RH7Y')).toBeNull();
  });

  it('opens each Members state from one link of its own', () => {
    const links = SETTINGS_PAGES.flatMap((page) => page.states.map((state) => state.to));
    const named = links.flatMap((to) => new URL(to, 'http://demo').searchParams.get('state') ?? []);

    expect(new Set(links).size).toBe(links.length);
    expect(named.every((state) => (MEMBERS_STATES as readonly string[]).includes(state))).toBe(
      true,
    );
  });
});
