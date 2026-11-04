import { describe, expect, it } from 'vitest';

import {
  approvalRoles,
  approved,
  counts,
  DEADLINES,
  grantable,
  membersSayIn,
  membersStart,
  membersStateOf,
  proofProblem,
  rowLine,
  samplePeople,
  standingOf,
  subtitle,
  turnedDown,
  VIEWERS,
} from './MembersSample.ts';

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
    expect(counts(approved(people, lucia, 'Read-only'))).toEqual({
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
      'Coordinator · Invitation · left Sep 30, 2026',
    );
  });

  it('writes deadlines in the organisation’s zone, the clock the locale keeps', () => {
    expect(us.deadline(DEADLINES.lucia)).toBe('Monday, Nov 16 at 9:12 AM WAT');
    expect(gb.deadline(DEADLINES.marta)).toBe('Wednesday 11 Nov at 10:00 WAT');
  });

  it('offers Read-only first and never Owner on approval', () => {
    expect(approvalRoles()).toEqual([
      'Read-only',
      'Administrator',
      'Event manager',
      'Coordinator',
      'Door staff',
    ]);
  });

  it('lets only an owner give Owner', () => {
    expect(grantable(VIEWERS.folake)).toContain('Owner');
    expect(grantable(VIEWERS.julien)).not.toContain('Owner');
    expect(grantable(VIEWERS.julien)).toContain('Door staff');
  });

  it('decides what each page offers', () => {
    expect(standingOf(person('Priya Shah'), people, VIEWERS.folake)).toBe('manageable');
    expect(standingOf(person('Folake Adeyemi'), people, VIEWERS.folake)).toBe('selfOwner');
    expect(standingOf(person('Priya Shah'), people, VIEWERS.tom)).toBe('readOnly');
    expect(standingOf(person('Julien Moreau'), people, VIEWERS.julien)).toBe('self');

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
});
