import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { freshWalk } from '../kit/createWalk.ts';
import { createStateOf, SAMPLE_DEVICE, walkFor } from './createOrg/CreateWalk.ts';
import {
  currentPlace,
  expand,
  openerLabel,
  sessionFor,
  settled,
  switcherStateOf,
  waitingOf,
} from './OrgSwitcherModel.ts';
import { MANAGED_WORDS } from './settings/DataWords.ts';
import { membersStart, membersStateOf } from './settings/MembersSample.ts';
import { organisationStart, organisationStateOf } from './settings/OrganisationModel.ts';
import { managedStateOf, managedStep, signUpEndOf, signUpLanding } from './signUpEnd.ts';

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});
const read = (...path: string[]) => readFileSync(join(...path), 'utf8');

describe('a managed account, wherever a membership path ends (sc-563, enterprise-b-spec.md §10)', () => {
  it('says the banner in the spec’s words', () => {
    expect(MANAGED_WORDS).toMatchObject({
      title: 'Managed by Ire Events',
      body: 'Your ire.events address is managed by Ire Events, so you can only be a member there.',
      single: 'Access to a single event still works.',
      change: 'Change your main email address',
    });
    expect(read('src', 'demo', 'Managed.tsx')).toMatch(/tone="quiet"\s+mark="i"/u);
  });

  it('replaces Create an organisation’s first step with the refusal, and Close', () => {
    expect(createStateOf('managed')).toBe('managed');
    expect(walkFor('managed', i18n.t, true)).toEqual({
      ...freshWalk(SAMPLE_DEVICE),
      managed: true,
    });
    expect(freshWalk(SAMPLE_DEVICE).managed).toBe(false);
    const window = read('src', 'components', 'CreateWalkWindow.tsx');
    expect(window).toMatch(/managed \? refusal : steps/u);
    expect(window).toMatch(/managed \? closeAction/u);
  });

  it('refuses Join on the switcher’s invitation with the banner in place of its buttons', () => {
    expect(switcherStateOf('managed')).toBe('managed');
    const session = sessionFor('managed');
    expect(session.expanded).toBe('org-celebraciones-alameda');
    expect(session.managed).toBe('org-celebraciones-alameda');
    expect(session.outcomes['org-celebraciones-alameda']?.kind).toBe('managed');
    expect(waitingOf(session)).toBe(1);
    expect(read('src', 'components', 'OrgDropDown.tsx')).toMatch(
      /managed=\{session\.managed === opened\.invite\.id \? managed : undefined\}/u,
    );
    expect(read('src', 'demo', 'OrgSwitcher.tsx')).toMatch(/managed=\{\s*<ManagedBanner/u);
  });

  it('counts none of two invitations a managed account cannot accept, from the start (sc-73668)', () => {
    const CELEBRACIONES = 'org-celebraciones-alameda';
    const BLUEBIRD = 'org-bluebird-gatherings';
    const session = sessionFor('managed-listed');

    expect(session.invitations.map((invite) => invite.id)).toEqual([CELEBRACIONES, BLUEBIRD]);
    expect(waitingOf(session)).toBe(0);
    expect(openerLabel(currentPlace(session), waitingOf(session))).toBe(
      'Organisation: Ire Events, your role Owner. Switch organisation',
    );
    expect(session.expanded).toBeNull();

    for (const id of [CELEBRACIONES, BLUEBIRD]) {
      const opened = expand(session, id);
      expect(opened.managed).toBe(id);
      expect(expand(opened, id).managed).toBeUndefined();
    }

    const again = settled(expand(session, BLUEBIRD));
    expect(again.invitations.map((invite) => invite.id)).toEqual([CELEBRACIONES, BLUEBIRD]);
    expect(waitingOf(again)).toBe(0);
    expect(expand(again, CELEBRACIONES).managed).toBe(CELEBRACIONES);
  });

  it('refuses Ask to join on the request link', () => {
    const join = read('app', 'demo', 'join.tsx');
    expect(join).toMatch(/state === 'managed'/u);
    expect(join).toMatch(/<ManagedBanner testID="join\.managed" \/>/u);
  });

  it('stands in for the organisation fields on A few details, with no way to Account settings', () => {
    expect(managedStateOf('managed')).toBe('managed');
    expect(managedStateOf('managedOffer')).toBe('managedOffer');
    expect(managedStateOf(undefined)).toBeNull();
    expect(managedStep('managed')).toEqual({
      offer: false,
      way: false,
      action: 'Continue',
      end: 'none',
    });
    expect(managedStep('managedOffer')).toMatchObject({
      offer: true,
      way: false,
      action: 'Ask to join Ire Events',
    });
  });

  it('ends a managed sign-up with nothing to join at You are not in an organisation', () => {
    const end = managedStep('managed').end;

    expect(signUpLanding(signUpEndOf(end))).toEqual({
      pathname: '/demo/today',
      params: { orgs: 'none', state: 'managed' },
    });
  });

  it('ends Ask to join with no organisation yet, told it asked, never inside Ire Events', () => {
    const end = managedStep('managedOffer').end;

    expect(signUpLanding(signUpEndOf(end))).toEqual({
      pathname: '/demo/today',
      params: {
        orgs: 'none',
        state: 'managed',
        toast: 'Asked to join Ire Events. We’ll email you when they answer.',
      },
    });
  });

  it('puts the banner in place of Start your own on You are not in an organisation', () => {
    const none = read('src', 'demo', 'createOrg', 'NoOrganisation.tsx');
    expect(none).toMatch(/managed \? \(\s*<ManagedBanner testID="noOrganisation\.managed" \/>/u);
    expect(read('app', 'demo', 'today.tsx')).toMatch(/managed=\{params\.state === 'managed'\}/u);
  });

  it('ends any other sign-up at Home, as before', () => {
    expect(signUpLanding(signUpEndOf(undefined))).toBe('/demo/today');
    expect(signUpLanding(signUpEndOf('elsewhere'))).toBe('/demo/today');
  });

  it('says a member is also in 2 other organisations, never which', () => {
    expect(membersStateOf('alsoMember')).toBe('alsoMember');
    expect(membersStart('alsoMember')).toMatchObject({
      open: 'priya@ire.events',
      otherOrganisations: 2,
    });
    expect(membersStart('priya').otherOrganisations).toBeNull();
    expect(MANAGED_WORDS.alsoMember(2)).toBe('Also a member of 2 other organisations');
    expect(MANAGED_WORDS.alsoMember(1)).toBe('Also a member of 1 other organisation');
  });

  it('tags ire.events Proved in Company domain joining when it is on both lists', () => {
    expect(organisationStateOf('domainBoth')).toBe('domainBoth');
    expect(organisationStart('domainBoth', 'Owner').proved).toEqual(['ire.events']);
    expect(organisationStart(null, 'Owner').proved).toEqual([]);
    expect(read('src', 'components', 'OrganisationJoining.tsx')).toMatch(
      /proved \? \{ kind: 'yes', word: t\('companyDomains\.proved'\) \}/u,
    );
    expect(read('src', 'demo', 'settings', 'OrganisationCalls.ts')).toContain(
      'proved: start.proved.includes(YOUR_DOMAIN)',
    );
  });
});
