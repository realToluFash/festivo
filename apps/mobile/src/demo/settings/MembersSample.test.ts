import { describe, expect, it } from 'vitest';

import { endedByRemoval, JULIEN, KOFI, PRIYA } from './MembersRecoverySample.ts';
import {
  approvalRoles,
  approved,
  counts,
  DEADLINES,
  grantable,
  MEMBERS_STATES,
  membersCard,
  membersSayIn,
  membersStart,
  membersStateOf,
  type MembersViewer,
  membersViewerOf,
  personLine,
  proofProblem,
  reachableState,
  RECOVERY_STATES,
  removed,
  ROLE_MEANS,
  rowLine,
  samplePeople,
  standingOf,
  subtitle,
  tagOf,
  turnedDown,
  underRoles,
  VIEWERS,
  waitingLine,
  whenWord,
} from './MembersSample.ts';
import { memberLooking } from './sample.ts';

const us = membersSayIn('en-US');
const gb = membersSayIn('en-GB');
const people = samplePeople();
const person = (name: string) => {
  const found = people.find((one) => one.name === name);
  if (found == null) throw new Error(`The sample has ${name}.`);

  return found;
};

describe('Members in the demo', () => {
  it('counts the chips as the board does', () => {
    expect(counts(people)).toEqual({ all: 7, active: 6, suspended: 1, former: 1 });
    expect(subtitle(people)).toBe('Ire Events · 6 active');
  });

  it('counts Lucía once she is approved, and under Former once turned down', () => {
    const lucia = person('Lucía Gómez').id;
    expect(counts(approved(people, lucia, 'Member'))).toEqual({
      all: 8,
      active: 7,
      suspended: 1,
      former: 1,
    });
    expect(counts(turnedDown(people, lucia)).former).toBe(2);
  });

  it('counts the owner claim’s organisation, Folake suspended', () => {
    const claim = membersStart('claim');
    expect(counts(claim.people)).toEqual({ all: 7, active: 5, suspended: 2, former: 1 });
    expect(claim.viewer).toBe(VIEWERS.julien);
  });

  it('writes a row’s line, dated the reader’s way', () => {
    expect(rowLine(person('Folake Adeyemi'), VIEWERS.folake.id, us)).toBe(
      'Owner · you · Created Ire Events · since Mar 2, 2025',
    );
    expect(rowLine(person('Lucía Gómez'), VIEWERS.folake.id, gb)).toBe(
      'No role yet · Asked to join · asked 2 Nov 2026',
    );
    expect(rowLine(person('Daniel Kim'), VIEWERS.folake.id, us)).toBe(
      'Member · Invitation · left Sep 30, 2026',
    );
  });

  it('writes deadlines in the organisation’s zone, on the 24-hour clock in every locale', () => {
    expect(us.deadline(DEADLINES.lucia)).toBe('Monday, Nov 16 at 09:12 WAT');
    expect(gb.deadline(DEADLINES.marta)).toBe('Wednesday 11 Nov at 10:00 WAT');
  });

  it('holds three roles: Folake owns, Julien is an admin, and everyone else a member', () => {
    expect(people.map(({ name, role }) => [name, role])).toEqual([
      ['Folake Adeyemi', 'Owner'],
      ['Julien Moreau', 'Admin'],
      ['Priya Shah', 'Member'],
      ['Ana Souza', 'Member'],
      ['Tom Becker', 'Member'],
      ['Kofi Mensah', 'Member'],
      ['Marta Silva', 'Member'],
      ['Lucía Gómez', null],
      ['Daniel Kim', 'Member'],
    ]);
    expect(ROLE_MEANS).toEqual({
      Owner: 'Everything, including billing and deleting the organisation.',
      Admin: 'Everything except billing. Sees every event and manages members.',
      Member: 'Works on the events they’re added to, and sees no others.',
    });
  });

  it('offers Member first and never Owner on approval', () => {
    expect(approvalRoles()).toEqual(['Member', 'Admin']);
  });

  it('lets only an owner give Owner, and says where a member’s events come from', () => {
    expect(grantable(VIEWERS.folake)).toEqual(['Owner', 'Admin', 'Member']);
    expect(grantable(VIEWERS.julien)).toEqual(['Admin', 'Member']);
    expect(underRoles(VIEWERS.folake)).toBe('A member’s events come from each event’s People.');
    expect(underRoles(VIEWERS.julien)).toBe(
      'Only an owner makes someone an owner. A member’s events come from each event’s People.',
    );
  });

  it('decides what each page offers', () => {
    expect(standingOf(person('Priya Shah'), people, VIEWERS.folake)).toBe('manageable');
    expect(standingOf(person('Folake Adeyemi'), people, VIEWERS.folake)).toBe('selfOwner');
    expect(standingOf(person('Priya Shah'), people, VIEWERS.tom)).toBe('readOnly');
    expect(standingOf(person('Julien Moreau'), people, VIEWERS.julien)).toBe('self');
    expect(standingOf(person('Folake Adeyemi'), people, VIEWERS.julien)).toBe('onlyOwner');
    expect(standingOf(person('Priya Shah'), people, VIEWERS.julien)).toBe('manageable');

    const claim = membersStart('claim').people;
    const folake = claim.find((one) => one.name === 'Folake Adeyemi');
    if (folake == null) throw new Error('Folake is in the claim.');
    expect(standingOf(folake, claim, VIEWERS.julien)).toBe('suspendedOnlyOwner');
  });

  it('checks Confirm it’s you against the demo’s password and codes', () => {
    const sample = { password: 'pw', authenticator: '714302', recovery: 'vtxp-rh7y' };
    expect(proofProblem('', '', sample)?.field).toBe('password');
    expect(proofProblem('pw', ' ', sample)?.field).toBe('code');
    expect(proofProblem('nope', '714302', sample)?.message).toMatch(/^That is not your password/u);
    expect(proofProblem('pw', '000000', sample)?.message).toMatch(/^That code did not work/u);
    expect(proofProblem('pw', '714302', sample)).toBeNull();
    expect(proofProblem('pw', 'VTXP-RH7Y', sample)).toBeNull();
  });

  it('starts each state a link names', () => {
    expect(membersStateOf('makingOwner')).toBe('makingOwner');
    expect(membersStateOf('anything')).toBe('list');
    expect(counts(membersStart('nobodySuspended').people).suspended).toBe(0);
    expect(counts(membersStart('nobodyLeft').people).former).toBe(0);
    expect(membersStart('withdraw').withdrawing).toBe(true);
  });

  it('opens your own page as Julien, an active admin, or as Folake, the owner', () => {
    const own = (state: 'self' | 'selfOwner') => {
      const start = membersStart(state);
      const you = start.people.find((one) => one.id === start.open);
      if (you == null) throw new Error(`${state} opens somebody.`);

      return { you, standing: standingOf(you, start.people, start.viewer) };
    };

    expect(own('self').you).toMatchObject({
      name: 'Julien Moreau',
      role: 'Admin',
      status: 'active',
    });
    expect(own('self').standing).toBe('self');
    expect(membersStart('self').people.every((one) => one.status !== 'suspended')).toBe(true);
    expect(own('selfOwner').you.name).toBe('Folake Adeyemi');
    expect(own('selfOwner').standing).toBe('selfOwner');
  });

  it('puts whoever looks at the sidebar’s foot: Julien in self and claim, Tom read only', () => {
    const foot = (state: Parameters<typeof membersStart>[0]) => {
      const { name, role } = memberLooking(membersStart(state).viewer.id);

      return `${name} · ${role}`;
    };

    expect(foot('self')).toBe('Julien Moreau · Admin');
    expect(foot('claim')).toBe('Julien Moreau · Admin');
    expect(foot('withdraw')).toBe('Julien Moreau · Admin');
    expect(foot('readOnly')).toBe('Tom Becker · Member');
    expect(foot('list')).toBe('Folake Adeyemi · Owner');
  });

  it('says the count on the card, with who waits and the step to answer them', () => {
    const card = membersCard({ ...plainCard, people });
    expect(card.says).toBe('7 people · 1 waiting');
    expect(card.faces.map((one) => one.initials)).toEqual(['FA', 'JM', 'PS', 'AS', 'TB']);
    expect(card.more).toBe(2);
    expect(card.step).toEqual({ label: 'Answer Lucía Gómez', does: 'answer' });
    expect(membersCard({ ...plainCard, people, viewer: VIEWERS.tom })).toMatchObject({
      says: '7 people',
      step: null,
    });
  });

  it('says an answer or a removal on the card until the person moves on', () => {
    const lucia = person('Lucía Gómez').id;
    const priya = person('Priya Shah');
    expect(
      membersCard({ ...plainCard, people, request: { approved: lucia, role: 'Member' } }),
    ).toMatchObject({ says: 'Lucía Gómez joined as Member', step: { does: 'seePerson' } });
    expect(membersCard({ ...plainCard, people, request: { turnedDown: lucia } })).toMatchObject({
      says: 'You turned down Lucía Gómez',
      line: 'They are listed under Former.',
      step: { label: 'See Former' },
    });
    expect(
      membersCard({
        ...plainCard,
        people: removed(people, priya.id),
        gone: { person: priya, handed: null },
      }),
    ).toMatchObject({
      says: 'Priya Shah was removed',
      line: 'Their events stay with Ire Events. They are listed under Former, with everything they did kept.',
    });
  });

  it('says the claim on the card while nobody owns the organisation', () => {
    const { people: claimed } = membersStart('claim');
    const card = (claim: 'unclaimed' | 'open' | 'withdrawn') =>
      membersCard({ ...plainCard, people: claimed, viewer: VIEWERS.julien, claim });
    expect(card('unclaimed')).toMatchObject({
      says: 'Ire Events has no active owner',
      step: { label: 'Become the owner' },
    });
    expect(card('open')).toMatchObject({
      says: 'Your claim is open',
      line: 'We check every hour until Wednesday, Nov 11 at 09:41 WAT.',
      step: { label: 'Check record' },
    });
    expect(card('withdrawn').says).toBe('You withdrew your claim');
    expect(membersStart('claim').claim).toBe('unclaimed');
    expect(membersStart('withdraw').claim).toBe('open');
  });

  it('tags only who is off the rule, and keeps the dates for their page', () => {
    expect(tagOf(person('Priya Shah'))).toBeNull();
    expect(tagOf(person('Marta Silva'))).toEqual({
      kind: 'paused',
      word: 'Suspended: company domain',
    });
    expect(tagOf(person('Daniel Kim'))).toEqual({ kind: 'ended', word: 'Left' });
    expect(personLine(person('Folake Adeyemi'), VIEWERS.folake.id)).toBe('Owner · you');
    expect(waitingLine(person('Lucía Gómez'), us)).toBe('lucia.gomez@outlook.com · asked Nov 2');
    expect(whenWord(person('Priya Shah'))).toBe('Member since');
    expect(us.date(person('Priya Shah').when)).toBe('Jun 3, 2025');
  });
});

describe('Requests to get back in, in the app’s Members (sc-30893)', () => {
  const cardOf = (
    state: (typeof RECOVERY_STATES)[number],
    viewer: MembersViewer = VIEWERS.folake,
  ) => {
    const start = membersStart(state, viewer);

    return membersCard({
      ...plainCard,
      people: start.people,
      viewer: start.viewer,
      recovery: { waiting: start.recovery, answer: start.recoveryAnswer },
    });
  };

  it('keeps every state Members had, the handover’s with them, and adds the ten recovery states', () => {
    expect(MEMBERS_STATES).toEqual([
      'list',
      'readOnly',
      'nobodySuspended',
      'nobodyLeft',
      'loading',
      'failed',
      'approving',
      'turningDown',
      'approved',
      'priya',
      'removing',
      'makingOwner',
      'marta',
      'self',
      'selfOwner',
      'claim',
      'withdraw',
      'handover',
      'handoverMenu',
      'handoverPicked',
      'handoverLong',
      'handoverSearch',
      'handoverSearchNobody',
      'removingNoWork',
      'handoverSending',
      'handoverFailed',
      'handoverDone',
      'handoverNow',
      'handoverNowSending',
      'handoverNowFailed',
      'handoverNowDone',
      'handoverReadOnly',
      'recovery',
      'recoveryApprove',
      'recoveryTurnDown',
      'recoveryApproved',
      'recoveryTurnedDown',
      'recoveryClosed',
      'recoverySending',
      'recoveryFailed',
      'recoveryDone',
      'recoveryOwn',
    ]);
  });

  it('holds no request to get back in, and Lucía’s request to join, in every state before it', () => {
    for (const state of MEMBERS_STATES.filter((one) => !one.startsWith('recovery'))) {
      const start = membersStart(state);
      expect(start.recovery, state).toEqual([]);
      expect(start.recoveryAsk, state).toBeNull();
      expect(start.recoveryAnswer, state).toBeNull();
    }
    expect(membersCard({ ...plainCard, people }).step).toEqual({
      label: 'Answer Lucía Gómez',
      does: 'answer',
    });
  });

  it('takes who looks from as=, and gives the states before it the viewers they had', () => {
    expect(membersViewerOf('julien')).toBe(VIEWERS.julien);
    expect(membersViewerOf('tom')).toBe(VIEWERS.tom);
    expect(membersViewerOf('folake')).toBe(VIEWERS.folake);
    expect(membersViewerOf('ana')).toBeNull();
    expect(membersViewerOf(undefined)).toBeNull();
    expect(membersStart('recovery', VIEWERS.julien).viewer).toBe(VIEWERS.julien);
    expect(membersStart('list', VIEWERS.tom).viewer).toBe(VIEWERS.tom);
    expect(membersStart('readOnly', VIEWERS.julien).viewer).toBe(VIEWERS.tom);
    expect(membersStart('self', VIEWERS.folake).viewer).toBe(VIEWERS.julien);
  });

  it('opens Members with no state as Tom, and Julien’s own request only for Julien', () => {
    for (const state of RECOVERY_STATES) {
      expect(reachableState(state, VIEWERS.tom), state).toBe('list');
      expect(reachableState(state, VIEWERS.julien), state).toBe(state);
    }
    expect(reachableState('recoveryOwn', VIEWERS.folake)).toBe('list');
    expect(reachableState('recoveryOwn', null)).toBe('list');
    expect(reachableState('recovery', null)).toBe('recovery');
    expect(reachableState('readOnly', VIEWERS.tom)).toBe('readOnly');
    expect(membersStart('list', VIEWERS.tom).recovery).toEqual([]);
  });

  it('starts each recovery state at the moment its board draws', () => {
    expect(membersStart('recovery')).toMatchObject({
      viewer: VIEWERS.folake,
      recovery: [KOFI, PRIYA],
      recoveryAsk: null,
      recoveryAnswer: null,
    });
    expect(membersStart('recoveryApprove').recoveryAsk).toEqual({
      id: KOFI,
      answer: 'approve',
      phase: 'asking',
    });
    expect(membersStart('recoveryTurnDown').recoveryAsk).toEqual({
      id: KOFI,
      answer: 'turnDown',
      phase: 'asking',
    });
    expect(membersStart('recoveryApproved')).toMatchObject({
      recovery: [PRIYA],
      recoveryAnswer: { id: KOFI, kind: 'approved' },
    });
    expect(membersStart('recoveryTurnedDown')).toMatchObject({
      recovery: [PRIYA],
      recoveryAnswer: { id: KOFI, kind: 'turnedDown' },
    });
    expect(membersStart('recoveryClosed')).toMatchObject({
      recovery: [KOFI, PRIYA],
      recoveryAsk: { id: KOFI, answer: 'approve', phase: 'closed' },
    });
    expect(membersStart('recoverySending')).toMatchObject({
      recovery: [KOFI, PRIYA],
      recoveryAsk: { id: KOFI, answer: 'approve', phase: 'sending' },
      answering: 'holds',
    });
    expect(membersStart('recoveryFailed')).toMatchObject({
      recovery: [KOFI, PRIYA],
      recoveryAsk: { id: KOFI, answer: 'approve', phase: 'failed' },
      answering: 'answers',
    });
    expect(membersStart('recovery').answering).toBe('answers');
    expect(membersStart('recoveryDone')).toMatchObject({
      recovery: [],
      recoveryAnswer: { id: PRIYA, kind: 'approved' },
    });
    expect(membersStart('recoveryOwn')).toMatchObject({
      viewer: VIEWERS.julien,
      recovery: [JULIEN],
    });
  });

  it('leaves Kofi in People as he was, a Member and active, once answered', () => {
    for (const state of ['recoveryApproved', 'recoveryTurnedDown'] as const)
      expect(membersStart(state).people.find((one) => one.id === KOFI)).toMatchObject({
        role: 'Member',
        status: 'active',
      });
  });

  it('counts both kinds on the card, and answers Kofi first, ahead of Lucía', () => {
    expect(cardOf('recovery')).toMatchObject({
      says: '7 people · 3 waiting',
      line: '2 to get back in · 1 to join',
      step: { label: 'Answer Kofi Mensah', does: 'answerRecovery' },
      readsOut: false,
      takesFocus: false,
    });
    expect(cardOf('recovery', VIEWERS.julien).says).toBe('7 people · 3 waiting');
  });

  it('says the answer on the card, then offers Priya’s request', () => {
    expect(cardOf('recoveryApproved')).toMatchObject({
      says: 'Kofi Mensah’s two-factor is off.',
      line: 'They’re emailed now, and every session they had has ended.',
      step: { label: 'Answer Priya Shah', does: 'answerRecovery' },
      faces: [],
      readsOut: false,
      takesFocus: true,
    });
    expect(cardOf('recoveryTurnedDown')).toMatchObject({
      says: 'Kofi Mensah’s request is turned down.',
      line: 'Two-factor stays on for them, and they’re emailed.',
      step: { label: 'Answer Priya Shah' },
    });
  });

  it('has the answer heard once, by its focus, while Lucía’s answer is still read out', () => {
    const lucia = person('Lucía Gómez').id;
    expect(cardOf('recoveryTurnedDown')).toMatchObject({ readsOut: false, takesFocus: true });
    expect(cardOf('recoveryDone')).toMatchObject({ readsOut: false, takesFocus: true });
    expect(
      membersCard({ ...plainCard, people, request: { approved: lucia, role: 'Member' } }),
    ).toMatchObject({ readsOut: true, takesFocus: false });
    expect(
      membersCard({
        ...plainCard,
        people: removed(people, lucia),
        gone: { person: person('Lucía Gómez'), handed: null },
      }),
    ).toMatchObject({ readsOut: true, takesFocus: false });
  });

  it('answers the oldest request to get back in first after a removal, as the count does', () => {
    const ana = person('Ana Souza');
    const gone = { person: ana, handed: null };
    const after = removed(people, ana.id);
    expect(
      membersCard({
        ...plainCard,
        people: after,
        gone,
        recovery: { waiting: [KOFI], answer: null },
      }).step,
    ).toEqual({ label: 'Answer Kofi Mensah', does: 'answerRecovery' });
    expect(membersCard({ ...plainCard, people: after, gone }).step).toEqual({
      label: 'Answer Lucía Gómez',
      does: 'answer',
    });
  });

  it('ends Priya’s own request when she is removed, and keeps answering Kofi first', () => {
    const start = membersStart('recovery');
    const priya = person('Priya Shah');
    const waiting = endedByRemoval(start.recovery, priya.id);
    const card = membersCard({
      ...plainCard,
      people: removed(start.people, priya.id),
      gone: { person: priya, handed: { count: 3, to: 'Folake Adeyemi', you: true } },
      recovery: { waiting, answer: null },
    });

    expect(start.recovery).toEqual([KOFI, PRIYA]);
    expect(waiting).toEqual([KOFI]);
    expect(card).toMatchObject({
      says: 'Priya Shah was removed',
      step: { label: 'Answer Kofi Mensah', does: 'answerRecovery' },
    });
  });

  it('moves the step on to the next request, then to Lucía, as removals end requests', () => {
    const start = membersStart('recovery');
    const kofi = person('Kofi Mensah');
    const priya = person('Priya Shah');
    const card = (gone: typeof kofi, waiting: readonly string[]) =>
      membersCard({
        ...plainCard,
        people: removed(start.people, gone.id),
        gone: { person: gone, handed: null },
        recovery: { waiting, answer: null },
      }).step;

    const afterKofi = endedByRemoval(start.recovery, kofi.id);
    expect(afterKofi).toEqual([PRIYA]);
    expect(card(kofi, afterKofi)).toEqual({ label: 'Answer Priya Shah', does: 'answerRecovery' });
    expect(card(priya, endedByRemoval(afterKofi, priya.id))).toEqual({
      label: 'Answer Lucía Gómez',
      does: 'answer',
    });
    expect(endedByRemoval(start.recovery, person('Tom Becker').id)).toEqual([KOFI, PRIYA]);
  });

  it('counts again once a request answered elsewhere is closed', () => {
    const closed = membersCard({
      ...plainCard,
      people,
      recovery: { waiting: [PRIYA], answer: null },
    });
    expect(closed).toMatchObject({
      says: '7 people · 2 waiting',
      line: '1 to get back in · 1 to join',
      step: { label: 'Answer Priya Shah', does: 'answerRecovery' },
    });
  });

  it('leaves the last answer once none is left, and goes back to Lucía', () => {
    expect(cardOf('recoveryDone')).toMatchObject({
      says: 'Priya Shah’s two-factor is off.',
      step: { label: 'Answer Lucía Gómez', does: 'answer' },
    });
  });

  it('never offers Julien his own request: the step is Lucía’s', () => {
    expect(cardOf('recoveryOwn', VIEWERS.julien)).toMatchObject({
      says: '7 people · 1 waiting',
      line: null,
      step: { label: 'Answer Lucía Gómez', does: 'answer' },
    });
  });

  it('shows a Member no request, and nothing that says one exists', () => {
    expect(
      membersCard({
        ...plainCard,
        people,
        viewer: VIEWERS.tom,
        recovery: { waiting: [KOFI, PRIYA], answer: null },
      }),
    ).toMatchObject({ says: '7 people', line: null, step: null });
  });

  it('drops the card’s line once only requests to get back in wait', () => {
    const lucia = person('Lucía Gómez').id;
    expect(
      membersCard({
        ...plainCard,
        people: approved(people, lucia, 'Member'),
        recovery: { waiting: [KOFI, PRIYA], answer: null },
      }),
    ).toMatchObject({
      says: '8 people · 2 waiting',
      line: null,
      step: { label: 'Answer Kofi Mensah' },
    });
  });
});

const plainCard = {
  viewer: VIEWERS.folake,
  request: 'resting',
  gone: null,
  claim: null,
  say: us,
} as const;
