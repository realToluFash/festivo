import { describe, expect, test } from 'vitest';

import { type OwnerClaimBannerInput, ownerClaimRefusalKey, ownerClaimView } from './ownerClaims.ts';

const lapsesAt = { at: '2026-10-31T09:00:00+00:00', written: 'Saturday 31 Oct at 10:00 WAT' };
const passesAt = { at: '2026-10-27T09:00:00+00:00', written: 'Tuesday 27 Oct at 10:00 WAT' };

function banner(overrides: Partial<OwnerClaimBannerInput> = {}): OwnerClaimBannerInput {
  return { state: 'no_owner', claim: null, stopped: null, lapsed: null, ...overrides };
}

function claim(mine: boolean, found: boolean): OwnerClaimBannerInput['claim'] {
  return {
    claimant: { name: 'Bisi' },
    mine,
    domain: 'ire.events',
    lapsesAt,
    passesAt: found ? passesAt : null,
  };
}

describe('the Members banner while no owner is active (sc-6640)', () => {
  test('with no claim, it offers Become the owner', () => {
    const view = ownerClaimView(banner(), 'Ìrè Events');

    expect(view.title).toEqual({
      key: 'ownerClaim.noOwner',
      values: { organisation: 'Ìrè Events' },
    });
    expect(view).toMatchObject({ tone: 'attention', become: true, stop: false, record: false });
  });

  test('the claimant is told their last claim lapsed, and why', () => {
    const unfound = ownerClaimView(banner({ lapsed: { outcome: 'unfound', at: lapsesAt } }), 'Ìrè');
    const removed = ownerClaimView(
      banner({ lapsed: { outcome: 'record_removed', at: passesAt } }),
      'Ìrè',
    );

    expect(unfound.lines[0]).toEqual({
      key: 'ownerClaim.lapsed',
      values: { when: lapsesAt.written },
    });
    expect(removed.lines[0]?.key).toBe('ownerClaim.recordRemoved');
  });

  test('the claimant is shown the record to publish until it is found', () => {
    const view = ownerClaimView(banner({ state: 'open', claim: claim(true, false) }), 'Ìrè');

    expect(view).toMatchObject({ tone: 'waiting', record: true, stop: false, become: false });
    expect(view.title.key).toBe('ownerClaim.prove');
  });

  test('another Administrator sees who is claiming and may stop it, before and after the record is found', () => {
    const waiting = ownerClaimView(banner({ state: 'open', claim: claim(false, false) }), 'Ìrè');
    const found = ownerClaimView(banner({ state: 'found', claim: claim(false, true) }), 'Ìrè');

    expect(waiting.title).toEqual({
      key: 'ownerClaim.becomingUnfound',
      values: { claimant: 'Bisi', domain: 'ire.events', when: lapsesAt.written },
    });
    expect(found.title).toEqual({
      key: 'ownerClaim.becoming',
      values: { claimant: 'Bisi', domain: 'ire.events', when: passesAt.written },
    });
    expect([waiting.stop, found.stop, waiting.record]).toEqual([true, true, false]);
  });

  test('the claimant sees the passing instant once found, and no Stop', () => {
    const view = ownerClaimView(banner({ state: 'found', claim: claim(true, true) }), 'Ìrè');

    expect(view.title.key).toBe('ownerClaim.found');
    expect(view.lines[0]?.values.when).toBe(passesAt.written);
    expect(view.stop).toBe(false);
  });

  test('after a stop, the way is closed and the stopper is told what happened', () => {
    const closed = ownerClaimView(
      banner({ state: 'closed', stopped: { claimant: 'Bisi', mine: true } }),
      'Ìrè',
    );

    expect(closed).toMatchObject({ tone: 'info', become: false, stop: false });
    expect(closed.title.key).toBe('ownerClaim.closed');
    expect(closed.lines).toEqual([{ key: 'ownerClaim.youStopped', values: { claimant: 'Bisi' } }]);
  });

  test('only the claimant is offered Withdraw my claim, before and after the record is found (sc-8204)', () => {
    const offered = [
      banner({ state: 'open', claim: claim(true, false) }),
      banner({ state: 'found', claim: claim(true, true) }),
      banner({ state: 'open', claim: claim(false, false) }),
      banner({ state: 'found', claim: claim(false, true) }),
      banner(),
      banner({ state: 'closed', stopped: { claimant: 'Bisi', mine: false } }),
    ].map((input) => ownerClaimView(input, 'Ìrè').withdraw);

    expect(offered).toEqual([true, true, false, false, false, false]);
  });

  test('only the two refusals are worded on the banner', () => {
    expect(ownerClaimRefusalKey('owner_claim_address')).toBe('ownerClaim.refusedAddress');
    expect(ownerClaimRefusalKey('owner_claim_managed')).toBe('ownerClaim.refusedManaged');
    expect(ownerClaimRefusalKey('owner_claim_open')).toBeNull();
  });
});
