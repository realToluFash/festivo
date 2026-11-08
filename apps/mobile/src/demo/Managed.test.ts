import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { createStateOf, freshWalk, SAMPLE_DEVICE, walkFor } from './createOrg/CreateWalk.ts';
import { sessionFor, switcherStateOf, waitingOf } from './OrgSwitcherModel.ts';
import { MANAGED_WORDS } from './settings/DataWords.ts';
import { membersStart, membersStateOf } from './settings/MembersSample.ts';
import { organisationStart, organisationStateOf } from './settings/OrganisationModel.ts';

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
    const window = read('src', 'demo', 'createOrg', 'CreateWalkWindow.tsx');
    expect(window).toMatch(/managed \? refusal : steps/u);
    expect(window).toMatch(/managed \? closeAction/u);
  });

  it('refuses Join on the switcher’s invitation with the banner in place of its buttons', () => {
    expect(switcherStateOf('managed')).toBe('managed');
    const session = sessionFor('managed');
    expect(session.expanded).toBe('org-celebraciones-alameda');
    expect(session.managed).toBe('org-celebraciones-alameda');
    expect(waitingOf(session)).toBe(2);
    expect(read('src', 'demo', 'OrgSwitcher.tsx')).toMatch(
      /managed=\{session\.managed === opened\.invite\.id\}/u,
    );
  });

  it('refuses Ask to join on the request link', () => {
    const join = read('app', 'demo', 'join.tsx');
    expect(join).toMatch(/state === 'managed'/u);
    expect(join).toMatch(/<ManagedBanner testID="join\.managed" \/>/u);
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
    expect(read('src', 'demo', 'settings', 'OrganisationJoining.tsx')).toMatch(
      /tag=\{start\.proved\.includes\(domain\) \? \{ kind: 'yes', word: PROVED \} : null\}/u,
    );
  });
});
