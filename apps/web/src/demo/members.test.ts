import { describe, expect, it } from 'vitest';

import {
  ANA,
  approvalRoles,
  counts,
  filtersFor,
  grantable,
  invitationRow,
  inviteProblem,
  KOFI,
  LUCIA,
  MARTA,
  MEMBERS_STATES,
  membersCard,
  membersStart,
  PRIYA,
  personView,
  proofProblem,
  recoveryEnds,
  recoveryRow,
  sampleInvitations,
  samplePeople,
  sampleRecoveries,
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

describe('Requests to get back in on Members at a desk (sc-30183)', () => {
  const RECOVERY_STATES = [
    'recovery',
    'recoveryApprove',
    'recoveryTurnDown',
    'recoveryApproved',
    'recoveryTurnedDown',
    'recoveryClosed',
    'recoveryDone',
    'recoveryOwn',
  ];
  const waitingIn = (state: string, viewer = VIEWERS.folake) =>
    membersStart(state, viewer).recoveries.map((one) => one.id);

  it('waits on Kofi’s request and then Priya’s, oldest first, and on none with no state', () => {
    expect(waitingIn('recovery')).toEqual([KOFI, PRIYA]);
    expect(waitingIn('recovery', VIEWERS.julien)).toEqual([KOFI, PRIYA]);
    expect(waitingIn('')).toEqual([]);
    expect(waitingIn('request')).toEqual([]);
  });

  it('ends a request exactly 7 × 24 hours after it was asked', () => {
    expect(recoveryEnds('2026-11-03T18:05')).toBe('2026-11-10T18:05');
    expect(recoveryEnds('2026-11-04T08:40')).toBe('2026-11-11T08:40');
  });

  it('writes each request in the product’s words', () => {
    const [kofi, priya] = sampleRecoveries();
    if (kofi == null || priya == null) throw new Error('no requests');

    expect(recoveryRow(kofi, samplePeople(), VIEWERS.folake, say)).toEqual({
      name: 'Kofi Mensah',
      lines: [
        'kofi@ire.events',
        'Asked to turn off two-factor · Proved with codes to their email and phone',
        'Asked Tuesday, Nov 3 at 6:05 PM WAT · ends Tuesday, Nov 10 at 6:05 PM WAT if nobody answers',
      ],
      own: null,
    });
    expect(recoveryRow(priya, samplePeople(), VIEWERS.folake, say).lines[1]).toBe(
      'Asked to turn off two-factor · Proved with a code to their email (no verified phone)',
    );
  });

  it('counts both kinds on the card and answers the request to get back in first', () => {
    expect(card('recovery')).toMatchObject({
      says: '7 people · 3 waiting',
      lines: ['2 to get back in · 1 to join'],
      step: { label: 'Answer Kofi Mensah', does: 'recover', id: KOFI },
    });
    expect(card('recovery', VIEWERS.julien).step?.label).toBe('Answer Kofi Mensah');
  });

  it('says the answer on the card and offers the next request', () => {
    expect(card('recoveryApproved')).toMatchObject({
      says: 'Kofi Mensah’s two-factor is off.',
      lines: ['They’re emailed now, and every session they had has ended.'],
      step: { label: 'Answer Priya Shah', does: 'recover', id: PRIYA },
      faces: [],
    });
    expect(card('recoveryTurnedDown')).toMatchObject({
      says: 'Kofi Mensah’s request is turned down.',
      lines: ['Two-factor stays on for them, and they’re emailed.'],
      step: { label: 'Answer Priya Shah' },
    });
    expect(waitingIn('recoveryApproved')).toEqual([PRIYA]);
    expect(
      membersStart('recoveryApproved', VIEWERS.folake).people.find((one) => one.id === KOFI),
    ).toMatchObject({ role: 'Member', status: 'active' });
  });

  it('opens each confirm on Kofi’s request, the answered one closed', () => {
    expect(membersStart('recoveryApprove', VIEWERS.folake).dialog).toEqual({
      kind: 'recovery',
      id: KOFI,
      answer: 'approve',
      closed: false,
    });
    expect(membersStart('recoveryTurnDown', VIEWERS.folake).dialog).toMatchObject({
      answer: 'turnDown',
    });
    const closed = membersStart('recoveryClosed', VIEWERS.folake);
    expect(closed.dialog).toMatchObject({ answer: 'approve', closed: true });
    expect(closed.recoveries.map((one) => one.ended)).toEqual([true, false]);
  });

  it('leaves nothing waiting once both are answered, and answers Lucía again', () => {
    expect(waitingIn('recoveryDone')).toEqual([]);
    expect(card('recoveryDone')).toMatchObject({
      says: 'Priya Shah’s two-factor is off.',
      step: { label: 'Answer Lucía Gómez', does: 'answer', id: LUCIA },
    });
  });

  it('shows Julien his own request alone, never as the card’s step', () => {
    expect(waitingIn('recoveryOwn', VIEWERS.julien)).toEqual([VIEWERS.julien.id]);
    expect(card('recoveryOwn', VIEWERS.julien)).toMatchObject({
      says: '7 people · 1 waiting',
      lines: [],
      step: { label: 'Answer Lucía Gómez' },
    });

    const [own] = membersStart('recoveryOwn', VIEWERS.julien).recoveries;
    if (own == null) throw new Error('no request');
    expect(recoveryRow(own, samplePeople(), VIEWERS.julien, say)).toMatchObject({
      name: 'Julien Moreau (you)',
      lines: [
        VIEWERS.julien.id,
        'Asked to turn off two-factor · Proved with codes to your email and phone',
        'Asked Wednesday, Nov 4 at 7:52 AM WAT · ends Wednesday, Nov 11 at 7:52 AM WAT if nobody answers',
      ],
      own: 'This is your own request. Somebody else in Ire Events has to answer it.',
    });
  });

  it('opens a state the viewer cannot reach with no state: every one as Ana, recoveryOwn as anybody but Julien', () => {
    const atRest = membersStart('', VIEWERS.ana);

    for (const state of RECOVERY_STATES) expect(membersStart(state, VIEWERS.ana)).toEqual(atRest);
    expect(membersStart('recoveryOwn', VIEWERS.folake)).toEqual(membersStart('', VIEWERS.folake));
  });

  it('links each state from the demo home as Folake, recoveryOwn as Julien only, and recovery as Julien too', () => {
    const links = SETTINGS_PAGES.flatMap((page) => page.states.map((state) => state.to)).filter(
      (to) => /state=recovery/u.test(to),
    );

    expect(links).toEqual([
      '/demo/settings/members?state=recovery',
      '/demo/settings/members?as=julien&state=recovery',
      '/demo/settings/members?state=recoveryApprove',
      '/demo/settings/members?state=recoveryTurnDown',
      '/demo/settings/members?state=recoveryApproved',
      '/demo/settings/members?state=recoveryTurnedDown',
      '/demo/settings/members?state=recoveryClosed',
      '/demo/settings/members?state=recoveryDone',
      '/demo/settings/members?as=julien&state=recoveryOwn',
    ]);
  });
});
