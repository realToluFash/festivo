import { NAME_LIMIT, SSO_WORDS as W } from './SingleSignOnWords.ts';

export type Protocol = 'saml' | 'oidc';
export type MetadataWay = 'url' | 'file';
export type FieldKey = 'name' | 'metadata' | 'issuer' | 'clientId' | 'secret';
export type Problems = Partial<Record<FieldKey, string>>;

export interface Typed {
  name: string;
  way: MetadataWay;
  url: string;
  file: string | null;
  issuer: string;
  clientId: string;
  secret: string;
}

export interface Provider {
  protocol: Protocol;
  name: string;
  source: string;
}

export type Test = 'untested' | 'running' | 'passed' | 'failed';

export interface Setup {
  protocol: Protocol | null;
  typed: Typed;
  problems: Problems;
  pressed: boolean;
}

export type SsoAsk = 'required' | 'change' | 'remove';
export type SsoRefusal = 'untested' | 'switchOff' | 'remove';

export interface SsoModel {
  plan: 'enterprise' | 'free';
  domainProved: boolean;
  owns: boolean;
  provider: Provider | null;
  /** The provider still on while a new one is set up and tested. */
  previous: Provider | null;
  test: Test;
  testedAt: string | null;
  on: boolean;
  required: boolean;
  setup: Setup | null;
  refusal: SsoRefusal | null;
  ask: SsoAsk | null;
  toast: string | null;
}

export const SAML_URL = 'https://ire-events.okta.com/app/exk1a2b3c4/sso/saml/metadata';
export const SAMPLE_FILE = 'ire-events-okta-metadata.xml';
export const OIDC_ISSUER = 'https://accounts.google.com';
export const OIDC_CLIENT = '48120-ire.apps.googleusercontent.com';
export const OIDC_SECRET = 'GOCSPX-r4Nd0mS3cr3tF0rTh3D3m0';

export const SOIRELY_VALUES = {
  entityId: 'https://soirely.app/sso/saml/ire-events',
  replyUrl: 'https://soirely.app/sso/saml/ire-events/acs',
  metadataUrl: 'https://soirely.app/sso/saml/ire-events/metadata',
  redirectUrl: 'https://soirely.app/sso/oidc/ire-events/callback',
} as const;

export const OKTA: Provider = { protocol: 'saml', name: 'Okta', source: SAML_URL };

export const EMPTY: Typed = {
  name: '',
  way: 'url',
  url: '',
  file: null,
  issuer: '',
  clientId: '',
  secret: '',
};

const SAML_TYPED: Typed = { ...EMPTY, name: 'Okta', url: SAML_URL };
const OIDC_TYPED: Typed = {
  ...EMPTY,
  name: 'Google Workspace',
  issuer: OIDC_ISSUER,
  clientId: OIDC_CLIENT,
  secret: OIDC_SECRET,
};
const TOO_LONG = 'Okta single sign-on for the Ire Events Lagos office';

export const FIELDS: Record<Protocol, readonly FieldKey[]> = {
  saml: ['name', 'metadata'],
  oidc: ['name', 'issuer', 'clientId', 'secret'],
};

function https(text: string): boolean {
  const trimmed = text.trim().toLowerCase();

  return trimmed.startsWith('https://') && trimmed.length > 'https://'.length;
}

export function fieldProblem(field: FieldKey, typed: Typed): string | null {
  switch (field) {
    case 'name': {
      const name = typed.name.trim();
      if (name === '') return W.problem.name;

      return name.length > NAME_LIMIT ? W.problem.nameLong : null;
    }
    case 'metadata':
      if (typed.way === 'file') return typed.file == null ? W.problem.metadata : null;
      if (typed.url.trim() === '') return W.problem.metadata;

      return https(typed.url) ? null : W.problem.url;
    case 'issuer':
      if (typed.issuer.trim() === '') return W.problem.issuer;

      return https(typed.issuer) ? null : W.problem.issuerHttps;
    case 'clientId':
      return typed.clientId.trim() === '' ? W.problem.clientId : null;
    case 'secret':
      return typed.secret === '' ? W.problem.secret : null;
  }
}

export function formProblems(protocol: Protocol, typed: Typed): Problems {
  const problems: Problems = {};
  for (const field of FIELDS[protocol]) {
    const problem = fieldProblem(field, typed);
    if (problem != null) problems[field] = problem;
  }

  return problems;
}

export function firstProblem(protocol: Protocol, problems: Problems): FieldKey | null {
  return FIELDS[protocol].find((field) => problems[field] != null) ?? null;
}

/** The server's refusals, which only it can know: in the demo, a URL or issuer with "bad" in it. */
export function serverRefusal(
  protocol: Protocol,
  typed: Typed,
): { field: FieldKey; words: string } | null {
  if (protocol === 'saml')
    return typed.way === 'url' && typed.url.toLowerCase().includes('bad')
      ? { field: 'metadata', words: W.badMetadata }
      : null;
  const issuer = typed.issuer.trim().replace(/\/+$/u, '');

  return issuer.toLowerCase().includes('bad')
    ? { field: 'issuer', words: W.discoveryFailed(issuer) }
    : null;
}

export function providerOf(protocol: Protocol, typed: Typed): Provider {
  const source =
    protocol === 'oidc'
      ? typed.issuer.trim()
      : typed.way === 'file'
        ? (typed.file ?? '')
        : typed.url.trim();

  return { protocol, name: typed.name.trim(), source };
}

export function protocolWord(protocol: Protocol): string {
  return protocol === 'saml' ? W.saml.title : W.oidc.title;
}

export function picked(model: SsoModel, protocol: Protocol): SsoModel {
  const setup = model.setup ?? { protocol: null, typed: EMPTY, problems: {}, pressed: false };

  return { ...model, setup: { ...setup, protocol, problems: {}, pressed: false } };
}

export function setupCancelled(model: SsoModel): SsoModel {
  if (model.provider == null)
    return {
      ...model,
      setup: { protocol: null, typed: EMPTY, problems: {}, pressed: false },
    };

  return { ...model, setup: null };
}

function stillWrong(before: Problems, now: Problems): Problems {
  const kept: Problems = {};
  for (const field of Object.keys(before) as FieldKey[]) {
    const problem = now[field];
    if (problem != null) kept[field] = problem;
  }

  return kept;
}

/** Once Save was pressed, a field's problem goes as it is fixed; a new one waits for the next Save. */
export function retyped(model: SsoModel, patch: Partial<Typed>): SsoModel {
  const setup = model.setup;
  if (setup?.protocol == null) return model;
  const typed = { ...setup.typed, ...patch };
  const problems = setup.pressed
    ? stillWrong(setup.problems, formProblems(setup.protocol, typed))
    : {};

  return { ...model, setup: { ...setup, typed, problems } };
}

export function savePressed(model: SsoModel): SsoModel {
  const setup = model.setup;
  if (setup?.protocol == null) return model;

  return {
    ...model,
    setup: { ...setup, pressed: true, problems: formProblems(setup.protocol, setup.typed) },
  };
}

/** Saving switches nothing on: a change keeps the old provider on until the new one is tested and switched on. */
export function withSaved(model: SsoModel, provider: Provider): SsoModel {
  const keeps = model.on && model.provider != null ? model.provider : model.previous;

  return {
    ...model,
    provider,
    previous: keeps,
    on: false,
    test: 'untested',
    testedAt: null,
    setup: null,
    refusal: null,
  };
}

export function testStarted(model: SsoModel): SsoModel {
  return { ...model, test: 'running', refusal: null };
}

export function testCame(model: SsoModel, worked: boolean, at: string): SsoModel {
  return worked
    ? { ...model, test: 'passed', testedAt: at }
    : { ...model, test: 'failed', testedAt: null };
}

export function testStopped(model: SsoModel): SsoModel {
  return { ...model, test: 'untested' };
}

/** The switch is never disabled: pressed before a test worked, it stays off and says why. */
export function switched(model: SsoModel, next: boolean): SsoModel {
  if (next) {
    if (model.test !== 'passed') return { ...model, refusal: 'untested' };

    return { ...model, on: true, previous: null, refusal: null };
  }
  if (model.required) return { ...model, refusal: 'switchOff' };

  return { ...model, on: false, refusal: null };
}

export function askKept(model: SsoModel): SsoModel {
  return { ...model, ask: null };
}

export function requiredConfirmed(model: SsoModel): SsoModel {
  return { ...model, required: true, ask: null, refusal: null };
}

export function requiredSwitched(model: SsoModel, next: boolean): SsoModel {
  if (next) return { ...model, ask: 'required' };

  return { ...model, required: false, refusal: null };
}

/** Turning required sign-on off from a refusal lets what was refused go ahead: Remove asks next. */
export function requiredTurnedOff(model: SsoModel): SsoModel {
  const removing = model.refusal === 'remove';

  return { ...model, required: false, refusal: null, ask: removing ? 'remove' : model.ask };
}

export function removeAsked(model: SsoModel): SsoModel {
  if (model.required) return { ...model, refusal: 'remove' };

  return { ...model, ask: 'remove', refusal: null };
}

export function changeAsked(model: SsoModel): SsoModel {
  if (model.on) return { ...model, ask: 'change' };

  return changeStarted(model);
}

export function changeStarted(model: SsoModel): SsoModel {
  return {
    ...model,
    ask: null,
    setup: { protocol: null, typed: EMPTY, problems: {}, pressed: false },
  };
}

export function removed(model: SsoModel): SsoModel {
  const name = model.provider?.name ?? '';

  return {
    ...model,
    provider: null,
    previous: null,
    on: false,
    required: false,
    test: 'untested',
    testedAt: null,
    ask: null,
    refusal: null,
    setup: { protocol: null, typed: EMPTY, problems: {}, pressed: false },
    toast: W.removed(name),
  };
}

export function setsIt(model: SsoModel): boolean {
  return model.owns && model.plan === 'enterprise' && model.domainProved;
}

export type CardMark = 'notyet' | 'yes' | 'turning' | 'alert' | 'lock';

export interface SsoCard {
  mark: CardMark;
  word: string;
  says: string;
  lines: readonly string[];
  step: { label: string; go: 'test' | 'plans' | 'prove' } | null;
}

export function ssoCard(model: SsoModel): SsoCard | null {
  if (model.plan === 'free')
    return {
      mark: 'lock',
      word: W.free,
      says: W.freeLine,
      lines: [],
      step: model.owns ? { label: W.seePlans, go: 'plans' } : null,
    };
  if (!model.domainProved)
    return {
      mark: 'notyet',
      word: W.noDomain,
      says: W.noDomainLine,
      lines: [],
      step: model.owns ? { label: W.proveDomain, go: 'prove' } : null,
    };
  const provider = model.provider;
  if (provider == null)
    return model.owns
      ? null
      : { mark: 'notyet', word: W.notSetUp, says: W.notSetUpLine, lines: [], step: null };
  const says = `${provider.name} · ${protocolWord(provider.protocol)}`;
  const name = provider.name;
  const staying = model.previous != null && !model.on ? [W.changeNote(model.previous.name)] : [];
  const lines = (more: readonly string[]) => [provider.source, ...more, ...staying];
  const owner = model.owns;

  if (model.on && model.required)
    return {
      mark: 'yes',
      word: W.required,
      says,
      lines: lines([W.requiredOnLine(name)]),
      step: null,
    };
  if (model.on)
    return { mark: 'yes', word: W.on, says, lines: lines([W.onLine(name)]), step: null };

  switch (model.test) {
    case 'running':
      return {
        mark: 'turning',
        word: W.testing,
        says,
        lines: lines([W.testingLine(name)]),
        step: null,
      };
    case 'passed':
      return {
        mark: 'yes',
        word: W.passed,
        says,
        lines: lines([W.passedLine(name, model.testedAt ?? '')]),
        step: null,
      };
    case 'failed':
      return {
        mark: 'alert',
        word: W.failed,
        says,
        lines: lines([W.failedLine(name), W.failedNext(name)]),
        step: owner ? { label: W.testAgain, go: 'test' } : null,
      };
    case 'untested':
      return {
        mark: 'notyet',
        word: W.savedNotTested,
        says,
        lines: lines([W.savedOffLine(name)]),
        step: owner ? { label: W.test, go: 'test' } : null,
      };
  }
}

export type Standing = 'notSetUp' | 'saved' | 'on' | 'required' | 'free';

export function standingOf(model: SsoModel): Standing {
  if (model.plan === 'free') return 'free';
  const live = model.on ? model.provider : model.previous;
  if (live != null && model.required) return 'required';
  if (live != null) return 'on';

  return model.provider == null ? 'notSetUp' : 'saved';
}

export interface StandingRow {
  tag: { kind: 'notyet' | 'yes' | 'lock'; word: string };
  line: string;
  action: string | null;
}

export function standingRow(standing: Standing, name = OKTA.name): StandingRow {
  switch (standing) {
    case 'notSetUp':
      return { tag: { kind: 'notyet', word: W.notSetUp }, line: W.notSetUpLine, action: W.setUp };
    case 'saved':
      return {
        tag: { kind: 'notyet', word: W.savedOff },
        line: W.savedOffLine(name),
        action: null,
      };
    case 'on':
      return { tag: { kind: 'yes', word: W.on }, line: W.onRow(name), action: null };
    case 'required':
      return { tag: { kind: 'yes', word: W.required }, line: W.requiredOnLine(name), action: null };
    case 'free':
      return { tag: { kind: 'lock', word: W.free }, line: W.freeLine, action: W.seePlans };
  }
}

export const STANDING_STATE: Record<Standing, SsoState> = {
  notSetUp: 'none',
  saved: 'saved',
  on: 'on',
  required: 'required_on',
  free: 'none',
};

export const SSO_STATES = [
  'none',
  'saml_form',
  'saml_blank',
  'saml_invalid',
  'saml_bad_metadata',
  'oidc_form',
  'oidc_blank',
  'oidc_invalid',
  'oidc_discovery_failed',
  'saved',
  'test_running',
  'test_passed',
  'test_failed',
  'switch_untested',
  'on',
  'required_confirm',
  'required_on',
  'change_confirm',
  'remove_confirm',
  'remove_refused',
  'removed',
  'no_domain',
  'not_owner',
] as const;

export type SsoState = (typeof SSO_STATES)[number];

export function ssoStateOf(name: string | undefined): SsoState {
  return SSO_STATES.find((state) => state === name) ?? 'none';
}

/** An admin looks with `as=julien`, and `not_owner` is always him; anybody else is Folake, the owner. */
export function ssoOwns(state: SsoState, as: string | undefined): boolean {
  return state !== 'not_owner' && as !== 'julien';
}

export interface SsoStart {
  model: SsoModel;
  refused: { field: FieldKey; words: string } | null;
}

function setupOf(protocol: Protocol | null, typed: Typed, pressed = false): Setup {
  const problems = pressed && protocol != null ? formProblems(protocol, typed) : {};

  return { protocol, typed, problems, pressed };
}

export function ssoStart(
  state: SsoState,
  { owns, plan, at }: { owns: boolean; plan: 'enterprise' | 'free'; at: string },
): SsoStart {
  const base: SsoModel = {
    plan,
    domainProved: true,
    owns,
    provider: null,
    previous: null,
    test: 'untested',
    testedAt: null,
    on: false,
    required: false,
    setup: setupOf(null, EMPTY),
    refusal: null,
    ask: null,
    toast: null,
  };
  const start = (next: Partial<SsoModel>, refused: SsoStart['refused'] = null): SsoStart => ({
    model: { ...base, ...next },
    refused,
  });
  const saved: Partial<SsoModel> = { provider: OKTA, setup: null };
  const on: Partial<SsoModel> = { ...saved, test: 'passed', testedAt: at, on: true };
  const required: Partial<SsoModel> = { ...on, required: true };

  switch (state) {
    case 'none':
      return start({});
    case 'saml_form':
      return start({ setup: setupOf('saml', SAML_TYPED) });
    case 'saml_blank':
      return start({ setup: setupOf('saml', EMPTY, true) });
    case 'saml_invalid':
      return start({
        setup: setupOf(
          'saml',
          { ...EMPTY, name: TOO_LONG, url: SAML_URL.replace('https', 'http') },
          true,
        ),
      });
    case 'saml_bad_metadata': {
      const typed = { ...SAML_TYPED, url: 'https://ire-events.okta.com/app/bad/sso/saml/metadata' };

      return start({ setup: setupOf('saml', typed, true) }, serverRefusal('saml', typed));
    }
    case 'oidc_form':
      return start({ setup: setupOf('oidc', OIDC_TYPED) });
    case 'oidc_blank':
      return start({ setup: setupOf('oidc', EMPTY, true) });
    case 'oidc_invalid':
      return start({
        setup: setupOf(
          'oidc',
          { ...OIDC_TYPED, name: TOO_LONG, issuer: 'accounts.google.com' },
          true,
        ),
      });
    case 'oidc_discovery_failed': {
      const typed = { ...OIDC_TYPED, issuer: 'https://accounts.bad-provider.com' };

      return start({ setup: setupOf('oidc', typed, true) }, serverRefusal('oidc', typed));
    }
    case 'saved':
      return start(saved);
    case 'test_running':
      return start({ ...saved, test: 'running' });
    case 'test_passed':
      return start({ ...saved, test: 'passed', testedAt: at });
    case 'test_failed':
      return start({ ...saved, test: 'failed' });
    case 'switch_untested':
      return start({ ...saved, refusal: 'untested' });
    case 'on':
      return start(on);
    case 'required_confirm':
      return start({ ...on, ask: 'required' });
    case 'required_on':
      return start(required);
    case 'change_confirm':
      return start({ ...on, ask: 'change' });
    case 'remove_confirm':
      return start({ ...on, ask: 'remove' });
    case 'remove_refused':
      return start({ ...required, refusal: 'remove' });
    case 'removed':
      return start({ toast: W.removed(OKTA.name) });
    case 'no_domain':
      return start({ domainProved: false, setup: null });
    case 'not_owner':
      return start(on);
  }
}

export function ssoHref(
  state: SsoState | null,
  query: { plan?: 'free' | null; as?: string | null } = {},
): string {
  const parts = [
    state == null || state === 'none' ? '' : `state=${state}`,
    query.plan === 'free' ? 'plan=free' : '',
    query.as == null ? '' : `as=${query.as}`,
  ].filter((part) => part !== '');

  return `/demo/settings/sign-in-rules/single-sign-on${parts.length === 0 ? '' : `?${parts.join('&')}`}`;
}

export const STANDINGS: readonly Standing[] = ['notSetUp', 'saved', 'on', 'required', 'free'];

export function standingNamed(name: string | undefined): Standing | null {
  return STANDINGS.find((standing) => standing === name) ?? null;
}

/** Where the Sign-in rules row opens: the page in the state the row stands at, as whoever is looking. */
export function standingHref(standing: Standing, owns: boolean): string {
  return ssoHref(STANDING_STATE[standing], {
    plan: standing === 'free' ? 'free' : null,
    as: owns ? null : 'julien',
  });
}

const RULES_STATE: Record<Standing, string | null> = {
  notSetUp: null,
  saved: 'ssoSaved',
  on: 'ssoOn',
  required: 'ssoRequired',
  free: 'ssoFree',
};

export function rulesHref(standing: Standing): string {
  const state = RULES_STATE[standing];

  return `/demo/settings/sign-in-rules${state == null ? '' : `?state=${state}`}`;
}

export const FIELD_OF: Record<keyof Typed, FieldKey> = {
  name: 'name',
  way: 'metadata',
  url: 'metadata',
  file: 'metadata',
  issuer: 'issuer',
  clientId: 'clientId',
  secret: 'secret',
};
