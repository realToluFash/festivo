import { describe, expect, it } from 'vitest';

import {
  FAULT_WORDS,
  GOOGLE,
  OKTA,
  SSO_STATES,
  type Sso,
  emptyDraft,
  faultsOf,
  refusalOf,
  refusedUnderRequired,
  removed,
  saved,
  ssoDomainOf,
  ssoStart,
  ssoStatus,
  switched,
  withFault,
} from './singleSignOn.ts';

const base: Sso = {
  plan: 'enterprise',
  domain: 'ire.events',
  provider: OKTA,
  test: 'untested',
  testedAt: null,
  on: false,
  required: false,
  staying: null,
};

describe('single sign-on’s rules (sc-610)', () => {
  it('asks SAML for a name and its metadata, and OpenID Connect for all four', () => {
    expect(faultsOf(emptyDraft('saml'))).toEqual({
      name: FAULT_WORDS.nameBlank,
      metadata: FAULT_WORDS.metadataBlank,
    });
    expect(Object.keys(faultsOf(emptyDraft('oidc')))).toEqual([
      'name',
      'issuer',
      'clientId',
      'secret',
    ]);
    expect(faultsOf(emptyDraft())).toEqual({});
  });

  it('keeps a name to 40 and an address to https://', () => {
    const draft = { ...emptyDraft('saml'), name: 'x'.repeat(41), url: 'http://okta.com/m' };

    expect(faultsOf(draft)).toEqual({
      name: FAULT_WORDS.nameLong,
      metadata: FAULT_WORDS.metadataShape,
    });
    expect(faultsOf({ ...draft, name: 'x'.repeat(40), url: 'https://okta.com/m' })).toEqual({});
    expect(faultsOf({ ...emptyDraft('saml'), name: 'Okta', way: 'file', file: 'a.xml' })).toEqual(
      {},
    );
    expect(faultsOf({ ...GOOGLE, secret: 's', issuer: 'http://accounts.google.com' })).toEqual({
      issuer: FAULT_WORDS.issuerShape,
    });
  });

  it('leaves reading the metadata to the server, which refuses anything with bad in it', () => {
    expect(refusalOf({ ...OKTA, url: 'https://x/bad', secret: '' })?.field).toBe('metadata');
    expect(refusalOf({ ...GOOGLE, issuer: 'https://bad.example', secret: 's' })?.words).toContain(
      'https://bad.example/.well-known/openid-configuration',
    );
    expect(refusalOf({ ...OKTA, secret: '' })).toBeNull();
  });

  it('drops a fault that is fixed and keeps the rest', () => {
    expect(withFault({ name: 'a', issuer: 'b' }, 'name', null)).toEqual({ issuer: 'b' });
    expect(withFault({}, 'secret', 'c')).toEqual({ secret: 'c' });
  });

  it('switches on only after a test worked, and off only once required is off', () => {
    expect(switched(base)).toEqual({ sso: base, refusal: 'untested' });
    expect(switched({ ...base, test: 'passed' }).sso.on).toBe(true);
    const on = { ...base, test: 'passed' as const, on: true };
    expect(switched({ ...on, required: true }).refusal).toBe('offRequired');
    expect(switched(on)).toEqual({ sso: { ...on, on: false }, refusal: null });
  });

  it('saves without switching anything on, the old provider staying while a new one waits', () => {
    const fresh = saved({ ...base, provider: null }, OKTA, false);
    expect(fresh).toMatchObject({ provider: OKTA, on: false, test: 'untested', staying: null });

    const on = { ...base, test: 'passed' as const, on: true, required: true };
    const changing = saved(on, GOOGLE, true);
    expect(changing).toMatchObject({ provider: GOOGLE, on: false, staying: OKTA, required: true });
    expect(switched({ ...changing, test: 'passed' }).sso).toMatchObject({
      on: true,
      staying: null,
    });
  });

  it('removes everything, required included', () => {
    expect(removed({ ...base, on: true, required: true })).toMatchObject({
      provider: null,
      on: false,
      required: false,
    });
  });

  it.each(SSO_STATES)('opens %s', (state) => {
    const start = ssoStart(state, 'enterprise', '13:45');

    expect(start.sso.plan).toBe('enterprise');
    if (state.endsWith('_blank') || state.endsWith('_invalid')) {
      expect(Object.keys(faultsOf(start.form?.draft ?? emptyDraft())).length).toBeGreaterThan(0);
    }
    if (state === 'saml_bad_metadata') expect(start.form?.refused?.field).toBe('metadata');
    if (state === 'oidc_discovery_failed') expect(start.form?.refused?.field).toBe('issuer');
    if (state === 'test_passed') expect(ssoStatus(start.sso)?.lines[0]).toContain('13:45');
    if (state === 'required_on') expect(start.sso).toMatchObject({ on: true, required: true });
    if (state === 'remove_refused') expect(start.refusal).toBe('removeRequired');
    if (state === 'switch_untested') expect(start.refusal).toBe('untested');
    if (state === 'no_domain') expect(ssoStatus(start.sso)?.step).toBe('prove');
    if (state === 'removed') expect(start.told).toContain('Okta removed');
  });

  it('opens on Free with the lock and See plans', () => {
    expect(ssoStatus(ssoStart('none', 'free', '13:45').sso)).toMatchObject({
      kind: 'lock',
      step: 'plans',
    });
  });

  it('hands an address at the proved domain over, and spares the owner under required', () => {
    expect(ssoDomainOf('Ade@Ire.Events ')).toBe(true);
    expect(ssoDomainOf('ade@gmail.com')).toBe(false);
    expect(refusedUnderRequired('ade@ire.events')).toBe(true);
    expect(refusedUnderRequired('folake@ire.events')).toBe(false);
  });
});
