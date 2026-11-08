import { describe, expect, it } from 'vitest';

import {
  type SignInRulesState,
  signInRulesStart,
  signInRulesStateOf,
  standRules,
  standViewer,
} from './SignInRulesSample.ts';
import { memberLooking } from './sample.ts';

describe('the Sign-in rules sample', () => {
  it('counts a shorter limit elsewhere, and not this organisation’s own', () => {
    expect(standRules(signInRulesStart('rules').page).elsewhere).toEqual({
      organisation: 'Lumen Studio',
      days: 7,
    });
    expect(standRules(signInRulesStart('notYours').page).elsewhere).toBeNull();
  });

  it('reads as the sample’s organisation', () => {
    expect(standViewer(signInRulesStart('googleOnly').viewer)).toEqual({
      organisation: 'Ire Events',
      role: 'Member',
      manages: [],
      setsRules: false,
      linked: null,
    });
  });

  it('opens each state a link names, and the whole page otherwise', () => {
    expect(signInRulesStateOf('googleOnly')).toBe('googleOnly');
    expect(signInRulesStateOf('owner')).toBe('rules');
    expect(signInRulesStateOf(undefined)).toBe('rules');
    expect(signInRulesStart('failed').load).toBe('failed');
    expect(signInRulesStart('loading').load).toBe('loading');
    expect(signInRulesStart('noChanges').page.changes).toEqual([]);
  });

  it('is seen by a member of the sample, whose role the page reads', () => {
    const looking = (state: SignInRulesState) => {
      const { viewer } = signInRulesStart(state);

      return { ...memberLooking(viewer.id), held: viewer.role };
    };

    expect(looking('rules')).toMatchObject({ name: 'Julien Moreau', role: 'Admin', held: 'Admin' });
    expect(looking('notYours')).toMatchObject({ name: 'Priya Shah', held: 'Member' });
    expect(looking('googleOnly')).toMatchObject({ name: 'Ana Souza', held: 'Member' });
  });
});
