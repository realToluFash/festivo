import { describe, expect, it } from 'vitest';

import {
  askKept,
  changeAsked,
  EMPTY,
  fieldProblem,
  firstProblem,
  formProblems,
  OKTA,
  picked,
  providerOf,
  removeAsked,
  removed,
  requiredConfirmed,
  requiredSwitched,
  requiredTurnedOff,
  retyped,
  rulesHref,
  savePressed,
  serverRefusal,
  setupCancelled,
  ssoCard,
  ssoHref,
  type SsoModel,
  ssoOwns,
  ssoStart,
  ssoStateOf,
  SSO_STATES,
  standingHref,
  standingOf,
  standingRow,
  STANDINGS,
  switched,
  testCame,
  testStarted,
  withSaved,
} from './SingleSignOnModel.ts';
import { atSsoDomain, signInSsoOf, ssoWayFor } from './SingleSignOnSignIn.ts';
import { SSO_WORDS as W } from './SingleSignOnWords.ts';

const AT = '10:42';
const begin = (state: Parameters<typeof ssoStart>[0], owns = true, plan: 'enterprise' | 'free' = 'enterprise') =>
  ssoStart(state, { owns, plan, at: AT });

describe('the single sign-on form’s checks', () => {
  it('needs a name, kept to 40 characters', () => {
    expect(fieldProblem('name', { ...EMPTY, name: '  ' })).toBe(W.problem.name);
    expect(fieldProblem('name', { ...EMPTY, name: 'x'.repeat(41) })).toBe(W.problem.nameLong);
    expect(fieldProblem('name', { ...EMPTY, name: 'x'.repeat(40) })).toBeNull();
  });

  it('needs SAML metadata as an https:// URL or a file', () => {
    expect(fieldProblem('metadata', EMPTY)).toBe(W.problem.metadata);
    expect(fieldProblem('metadata', { ...EMPTY, url: 'http://okta.com/m' })).toBe(W.problem.url);
    expect(fieldProblem('metadata', { ...EMPTY, url: 'https://' })).toBe(W.problem.url);
    expect(fieldProblem('metadata', { ...EMPTY, url: 'https://okta.com/m' })).toBeNull();
    expect(fieldProblem('metadata', { ...EMPTY, way: 'file' })).toBe(W.problem.metadata);
    expect(fieldProblem('metadata', { ...EMPTY, way: 'file', file: 'm.xml' })).toBeNull();
  });

  it('needs every OpenID Connect field, the issuer on https://', () => {
    expect(formProblems('oidc', EMPTY)).toEqual({
      name: W.problem.name,
      issuer: W.problem.issuer,
      clientId: W.problem.clientId,
      secret: W.problem.secret,
    });
    expect(fieldProblem('issuer', { ...EMPTY, issuer: 'accounts.google.com' })).toBe(
      W.problem.issuerHttps,
    );
    expect(firstProblem('oidc', { secret: 'x', issuer: 'y' })).toBe('issuer');
  });

  it('leaves the metadata and discovery to the server, which refuses anything with “bad”', () => {
    expect(serverRefusal('saml', { ...EMPTY, url: 'https://x/bad/m' })?.field).toBe('metadata');
    expect(serverRefusal('saml', { ...EMPTY, way: 'file', url: 'bad' })).toBeNull();
    expect(serverRefusal('oidc', { ...EMPTY, issuer: 'https://bad.example/' })).toEqual({
      field: 'issuer',
      words: W.discoveryFailed('https://bad.example'),
    });
    expect(serverRefusal('oidc', { ...EMPTY, issuer: 'https://accounts.google.com' })).toBeNull();
  });
});

describe('the single sign-on transitions', () => {
  const none = begin('none').model;

  it('checks only once Save is pressed, then drops each problem as it is fixed', () => {
    const typing = retyped(picked(none, 'saml'), { name: 'Okta' });
    expect(typing.setup?.problems).toEqual({});
    const pressed = savePressed(typing);
    expect(pressed.setup?.problems).toEqual({ metadata: W.problem.metadata });
    expect(retyped(pressed, { url: 'https://okta.com/m' }).setup?.problems).toEqual({});
    expect(retyped(pressed, { name: '' }).setup?.problems).toEqual({
      metadata: W.problem.metadata,
    });
  });

  it('switches nothing on when it saves, and the old provider stays on until the new one is', () => {
    const google = providerOf('oidc', { ...EMPTY, name: ' Google ', issuer: 'https://g' });
    expect(google).toEqual({ protocol: 'oidc', name: 'Google', source: 'https://g' });
    const on = begin('on').model;
    const changing = withSaved(on, google);
    expect(changing).toMatchObject({ provider: google, previous: OKTA, on: false });
    expect(standingOf(changing)).toBe('on');
    expect(ssoCard(changing)?.lines).toContain(W.changeNote('Okta'));
    expect(switched(changing, true).refusal).toBe('untested');
    const tested = testCame(testStarted(changing), true, AT);
    expect(switched(tested, true)).toMatchObject({ on: true, previous: null, refusal: null });
    expect(setupCancelled({ ...changing, setup: none.setup }).previous).toBe(OKTA);
  });

  it('says what came back from a test', () => {
    const saved = begin('saved').model;
    expect(testStarted(saved).test).toBe('running');
    expect(testCame(saved, true, AT)).toMatchObject({ test: 'passed', testedAt: AT });
    expect(testCame(saved, false, AT)).toMatchObject({ test: 'failed', testedAt: null });
  });

  it('asks before required sign-on, and refuses switching off or removing while it is on', () => {
    const on = begin('on').model;
    expect(requiredSwitched(on, true).ask).toBe('required');
    expect(askKept(requiredSwitched(on, true))).toMatchObject({ ask: null, required: false });
    const required = requiredConfirmed(requiredSwitched(on, true));
    expect(required).toMatchObject({ required: true, ask: null });
    expect(switched(required, false)).toMatchObject({ on: true, refusal: 'switchOff' });
    expect(removeAsked(required).refusal).toBe('remove');
    expect(requiredTurnedOff(removeAsked(required))).toMatchObject({
      required: false,
      ask: 'remove',
    });
    expect(removeAsked(on).ask).toBe('remove');
  });

  it('asks before a change only while it is on, and removes to an empty form', () => {
    expect(changeAsked(begin('on').model).ask).toBe('change');
    expect(changeAsked(begin('saved').model).setup?.protocol).toBeNull();
    const gone = removed(begin('on').model);
    expect(gone).toMatchObject({ provider: null, on: false, toast: W.removed('Okta') });
  });
});

describe('each state a link names', () => {
  it('starts every state, and none for anything else', () => {
    expect(ssoStateOf('nope')).toBe('none');
    for (const state of SSO_STATES) {
      expect(ssoStateOf(state)).toBe(state);
      expect(begin(state).model.plan).toBe('enterprise');
    }
  });

  it('starts each state as the board draws it', () => {
    expect(begin('none').model.setup?.protocol).toBeNull();
    expect(begin('saml_form').model.setup).toMatchObject({ protocol: 'saml', problems: {} });
    expect(Object.keys(begin('saml_blank').model.setup?.problems ?? {})).toEqual([
      'name',
      'metadata',
    ]);
    expect(begin('saml_invalid').model.setup?.problems).toEqual({
      name: W.problem.nameLong,
      metadata: W.problem.url,
    });
    expect(begin('saml_bad_metadata').refused?.words).toBe(W.badMetadata);
    expect(begin('oidc_form').model.setup?.protocol).toBe('oidc');
    expect(Object.keys(begin('oidc_blank').model.setup?.problems ?? {})).toHaveLength(4);
    expect(begin('oidc_invalid').model.setup?.problems.issuer).toBe(W.problem.issuerHttps);
    expect(begin('oidc_discovery_failed').refused?.field).toBe('issuer');
    expect(begin('saved').model).toMatchObject({ provider: OKTA, on: false, test: 'untested' });
    expect(begin('test_running').model.test).toBe('running');
    expect(begin('test_passed').model).toMatchObject({ test: 'passed', testedAt: AT });
    expect(begin('test_failed').model.test).toBe('failed');
    expect(begin('switch_untested').model.refusal).toBe('untested');
    expect(begin('on').model).toMatchObject({ on: true, required: false });
    expect(begin('required_confirm').model.ask).toBe('required');
    expect(begin('required_on').model.required).toBe(true);
    expect(begin('change_confirm').model.ask).toBe('change');
    expect(begin('remove_confirm').model.ask).toBe('remove');
    expect(begin('remove_refused').model.refusal).toBe('remove');
    expect(begin('removed').model.toast).toBe(W.removed('Okta'));
    expect(begin('no_domain').model.domainProved).toBe(false);
    expect(begin('not_owner', false).model).toMatchObject({ owns: false, on: true });
  });

  it('is an owner’s unless it is Julien’s', () => {
    expect(ssoOwns('on', undefined)).toBe(true);
    expect(ssoOwns('on', 'julien')).toBe(false);
    expect(ssoOwns('not_owner', undefined)).toBe(false);
  });

  it('links each state, and back to Sign-in rules where it stands', () => {
    expect(ssoHref('none')).toBe('/demo/settings/sign-in-rules/single-sign-on');
    expect(ssoHref('on', { as: 'julien' })).toBe(
      '/demo/settings/sign-in-rules/single-sign-on?state=on&as=julien',
    );
    expect(standingHref('free', true)).toBe(
      '/demo/settings/sign-in-rules/single-sign-on?plan=free',
    );
    expect(rulesHref('notSetUp')).toBe('/demo/settings/sign-in-rules');
    expect(rulesHref('required')).toBe('/demo/settings/sign-in-rules?state=ssoRequired');
  });
});

describe('the card and the Sign-in rules row', () => {
  const card = (model: SsoModel) => ssoCard(model);

  it('gives the card a shape and a word for every state', () => {
    expect(card(begin('none').model)).toBeNull();
    expect(card(begin('none', false).model)?.word).toBe(W.notSetUp);
    expect(card(begin('none', true, 'free').model)).toMatchObject({
      mark: 'lock',
      step: { go: 'plans' },
    });
    expect(card(begin('none', false, 'free').model)?.step).toBeNull();
    expect(card(begin('no_domain').model)).toMatchObject({ mark: 'notyet', step: { go: 'prove' } });
    expect(card(begin('saved').model)).toMatchObject({ mark: 'notyet', step: { go: 'test' } });
    expect(card(begin('test_running').model)?.mark).toBe('turning');
    expect(card(begin('test_passed').model)?.lines).toContain(W.passedLine('Okta', AT));
    expect(card(begin('test_failed').model)).toMatchObject({ mark: 'alert', word: W.failed });
    expect(card(begin('on').model)).toMatchObject({ mark: 'yes', word: W.on });
    expect(card(begin('required_on').model)?.word).toBe(W.required);
  });

  it('stands as the page does', () => {
    expect(standingOf(begin('none').model)).toBe('notSetUp');
    expect(standingOf(begin('saved').model)).toBe('saved');
    expect(standingOf(begin('on').model)).toBe('on');
    expect(standingOf(begin('required_on').model)).toBe('required');
    expect(standingOf(begin('on', true, 'free').model)).toBe('free');
    for (const standing of STANDINGS) expect(standingRow(standing).tag.word).not.toBe('');
    expect(standingRow('on').tag).toEqual({ kind: 'yes', word: W.on });
    expect(standingRow('free').tag.kind).toBe('lock');
  });
});

describe('signing in through the organisation’s provider', () => {
  it('knows the states and the domain', () => {
    expect(signInSsoOf('sso_required')).toBe('sso_required');
    expect(signInSsoOf('email')).toBeNull();
    expect(atSsoDomain(' Priya@IRE.events ')).toBe(true);
    expect(atSsoDomain('priya@ire.events.com')).toBe(false);
    expect(atSsoDomain('@ire.events')).toBe(false);
  });

  it('hands over, refuses, or lets an owner past', () => {
    expect(ssoWayFor(null, 'priya@ire.events', false)).toBe('password');
    expect(ssoWayFor('sso_handoff', 'ana@gmail.com', false)).toBe('password');
    expect(ssoWayFor('sso_handoff', 'priya@ire.events', false)).toBe('handoff');
    expect(ssoWayFor('sso_handoff', 'priya@ire.events', true)).toBe('password');
    expect(ssoWayFor('sso_required', 'priya@ire.events', true)).toBe('required');
    expect(ssoWayFor('sso_required', 'folake@ire.events', false)).toBe('handoff');
    expect(ssoWayFor('sso_required', 'folake@ire.events', true)).toBe('breakGlass');
  });
});
