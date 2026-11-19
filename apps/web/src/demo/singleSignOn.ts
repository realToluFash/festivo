import { PROVED_DOMAIN } from './dataControl.ts';
import { SAMPLE } from './rules.ts';
import { type DemoLink, VIEWERS, type Viewer } from './settings.ts';

const ORG = SAMPLE.organisation;
const NAME_MAX = 40;

export type Protocol = 'saml' | 'oidc';
export type MetadataWay = 'url' | 'file';
export type Plan = 'enterprise' | 'free';
export type Test = 'untested' | 'running' | 'passed' | 'failed';

export interface Provider {
  protocol: Protocol;
  name: string;
  way: MetadataWay;
  url: string;
  file: string | null;
  issuer: string;
  clientId: string;
}

export interface Sso {
  plan: Plan;
  domain: string | null;
  provider: Provider | null;
  test: Test;
  testedAt: string | null;
  on: boolean;
  required: boolean;
  /** The provider people still sign in through while a new one waits for its test. */
  staying: Provider | null;
}

export interface Draft {
  protocol: Protocol | null;
  name: string;
  way: MetadataWay;
  url: string;
  file: string | null;
  issuer: string;
  clientId: string;
  secret: string;
}

export type FieldKey = 'name' | 'metadata' | 'issuer' | 'clientId' | 'secret';
export type Faults = Partial<Record<FieldKey, string>>;

export interface Form {
  draft: Draft;
  pressed: boolean;
  refused: { field: FieldKey; words: string } | null;
  changing: boolean;
}

export type Ask = 'required' | 'change' | 'remove';
export type Refusal = 'untested' | 'removeRequired' | 'offRequired';

export const SSO_WORDS = {
  title: 'Single sign-on',
  back: 'Sign-in rules',
  intro: `Let people at ${PROVED_DOMAIN} sign in to Soirely through ${ORG}’s identity provider, like Microsoft Entra ID, Google Workspace or Okta. When IT turns someone off there, their Soirely access ends too.`,
  protocol: 'How your provider connects',
  saml: 'SAML 2.0',
  samlLine: 'For Microsoft Entra ID, Okta and most others.',
  oidc: 'OpenID Connect',
  oidcLine: 'For Google Workspace and newer setups.',
  name: 'Provider name',
  nameHelp: (name: string) =>
    `People see it when they sign in: “${ORG} signs you in through ${name}.”`,
  metadata: 'Provider metadata',
  pasteUrl: 'Paste its URL',
  uploadFile: 'Upload the file',
  metadataUrl: 'Metadata URL',
  urlHelp: 'Starts with https://.',
  chooseFile: 'Choose the metadata file',
  chooseAnother: 'Choose another',
  issuer: 'Issuer URL',
  issuerHelp: 'We read the rest from its /.well-known/openid-configuration.',
  clientId: 'Client ID',
  secret: 'Client secret',
  giveThese: 'Give these to your provider',
  giveThis: 'Give this to your provider',
  entityId: 'Entity ID',
  replyUrl: 'Reply URL',
  ourMetadata: 'Metadata URL',
  redirectUrl: 'Redirect URL',
  cancel: 'Cancel',
  save: 'Save provider',
  test: 'Test sign-on',
  testAgain: 'Test again',
  stopTesting: 'Stop testing',
  switchName: 'Single sign-on',
  switchLine: 'Switches on after a test works.',
  required: 'Required sign-on',
  change: 'Change provider…',
  ownerOnly: 'Only an owner can set up or change single sign-on.',
  provider: 'Provider',
  seePlans: 'See plans',
  plansTold: 'Plans has its own design.',
  proveDomain: 'Prove a domain',
  turnOffRequired: 'Turn off required sign-on',
  demoTab: 'Demo: in the product, a new tab opens at the provider. Come back from it:',
  itWorked: 'It worked',
  itFailed: 'It did not work',
} as const;

export const FAULT_WORDS = {
  nameBlank: 'Enter a name people will recognise, like Okta.',
  nameLong: 'Keep the name to 40 characters or fewer.',
  metadataBlank: 'Paste the metadata URL, or upload the metadata file.',
  metadataShape: 'Enter a metadata URL that starts with https://.',
  issuerBlank: 'Enter the issuer URL.',
  issuerShape: 'Enter an issuer URL that starts with https://.',
  clientIdBlank: 'Enter the client ID.',
  secretBlank: 'Enter the client secret.',
  badMetadata:
    'We could not read that metadata. Check that the URL opens your provider’s SAML metadata, or upload the file instead.',
} as const;

export const OURS = {
  entityId: 'https://soirely.app/sso/saml/ire-events',
  replyUrl: 'https://soirely.app/sso/saml/ire-events/acs',
  metadataUrl: 'https://soirely.app/sso/saml/ire-events/metadata',
  redirectUrl: 'https://soirely.app/sso/oidc/ire-events/callback',
} as const;

export function ourValues(protocol: Protocol): { label: string; value: string }[] {
  return protocol === 'saml'
    ? [
        { label: SSO_WORDS.entityId, value: OURS.entityId },
        { label: SSO_WORDS.replyUrl, value: OURS.replyUrl },
        { label: SSO_WORDS.ourMetadata, value: OURS.metadataUrl },
      ]
    : [{ label: SSO_WORDS.redirectUrl, value: OURS.redirectUrl }];
}

export const PROTOCOL_NAMES: Record<Protocol, string> = {
  saml: SSO_WORDS.saml,
  oidc: SSO_WORDS.oidc,
};

export function protocolOf(picked: string): Protocol | null {
  return picked === 'saml' || picked === 'oidc' ? picked : null;
}

function isHttps(typed: string): boolean {
  return /^https:\/\/\S+$/iu.test(typed.trim());
}

/** What the form says before it sends: a blank, a name past 40, an address that is not https. */
export function faultOf(draft: Draft, field: FieldKey): string | null {
  const name = draft.name.trim();

  switch (field) {
    case 'name':
      if (name === '') return FAULT_WORDS.nameBlank;
      return [...name].length > NAME_MAX ? FAULT_WORDS.nameLong : null;
    case 'metadata':
      if (draft.protocol !== 'saml') return null;
      if (draft.way === 'file') return draft.file == null ? FAULT_WORDS.metadataBlank : null;
      if (draft.url.trim() === '') return FAULT_WORDS.metadataBlank;
      return isHttps(draft.url) ? null : FAULT_WORDS.metadataShape;
    case 'issuer':
      if (draft.protocol !== 'oidc') return null;
      if (draft.issuer.trim() === '') return FAULT_WORDS.issuerBlank;
      return isHttps(draft.issuer) ? null : FAULT_WORDS.issuerShape;
    case 'clientId':
      return draft.protocol === 'oidc' && draft.clientId.trim() === ''
        ? FAULT_WORDS.clientIdBlank
        : null;
    case 'secret':
      return draft.protocol === 'oidc' && draft.secret === '' ? FAULT_WORDS.secretBlank : null;
  }
}

export function fieldsOf(protocol: Protocol): FieldKey[] {
  return protocol === 'saml' ? ['name', 'metadata'] : ['name', 'issuer', 'clientId', 'secret'];
}

export function faultsOf(draft: Draft): Faults {
  if (draft.protocol == null) return {};

  return Object.fromEntries(
    fieldsOf(draft.protocol).flatMap((field) => {
      const fault = faultOf(draft, field);

      return fault == null ? [] : [[field, fault]];
    }),
  );
}

export function withFault(faults: Faults, field: FieldKey, fault: string | null): Faults {
  const next = { ...faults };
  if (fault == null) delete next[field];
  else next[field] = fault;

  return next;
}

export function discoveryAt(issuer: string): string {
  return `${issuer.trim().replace(/\/+$/u, '')}/.well-known/openid-configuration`;
}

/** The server's answer to Save, which the demo gives to anything with `bad` in it. */
export function refusalOf(draft: Draft): Form['refused'] {
  if (draft.protocol === 'saml') {
    const read = draft.way === 'url' ? draft.url : (draft.file ?? '');

    return read.toLowerCase().includes('bad')
      ? { field: 'metadata', words: FAULT_WORDS.badMetadata }
      : null;
  }
  if (draft.protocol === 'oidc' && draft.issuer.toLowerCase().includes('bad'))
    return {
      field: 'issuer',
      words: `We could not find your provider’s settings at ${discoveryAt(draft.issuer)}. Check the issuer URL.`,
    };

  return null;
}

export function providerOf(draft: Draft): Provider | null {
  if (draft.protocol == null) return null;

  return {
    protocol: draft.protocol,
    name: draft.name.trim(),
    way: draft.way,
    url: draft.url.trim(),
    file: draft.file,
    issuer: draft.issuer.trim(),
    clientId: draft.clientId.trim(),
  };
}

export function providerLine(provider: Provider): string {
  if (provider.protocol === 'oidc') return provider.issuer;

  return provider.way === 'file' ? (provider.file ?? '') : provider.url;
}

export function providerTitle(provider: Provider): string {
  return `${provider.name} · ${PROTOCOL_NAMES[provider.protocol]}`;
}

export function emptyDraft(protocol: Protocol | null = null): Draft {
  return {
    protocol,
    name: '',
    way: 'url',
    url: '',
    file: null,
    issuer: '',
    clientId: '',
    secret: '',
  };
}

export type StatusKind = 'lock' | 'grey' | 'on' | 'running' | 'passed' | 'failed';

export interface Status {
  kind: StatusKind;
  word: string;
  lines: string[];
  step: 'test' | 'testAgain' | 'plans' | 'prove' | null;
}

export function ssoStatus(sso: Sso): Status | null {
  if (sso.plan === 'free')
    return {
      kind: 'lock',
      word: 'Comes with Enterprise',
      lines: [`Single sign-on is part of Enterprise. ${ORG} is on Free.`],
      step: 'plans',
    };
  if (sso.domain == null)
    return {
      kind: 'grey',
      word: 'Prove a domain first',
      lines: [`Single sign-on connects for a domain ${ORG} has proved.`],
      step: 'prove',
    };

  const provider = sso.provider;
  if (provider == null) return null;
  const name = provider.name;

  if (sso.on && sso.required)
    return {
      kind: 'on',
      word: 'Required',
      lines: [`Only ${name} signs in people at ${sso.domain}. Owners keep their own sign-in.`],
      step: null,
    };
  if (sso.on)
    return {
      kind: 'on',
      word: 'On',
      lines: [
        `People at ${sso.domain} sign in through ${name}. A password, Google and Apple still work for them.`,
      ],
      step: null,
    };

  switch (sso.test) {
    case 'running':
      return {
        kind: 'running',
        word: 'Testing sign-on…',
        lines: [`Finish signing in to ${name} in the new tab.`],
        step: null,
      };
    case 'passed':
      return {
        kind: 'passed',
        word: 'Test worked',
        lines: [`${name} signed in ${SAMPLE.email} · ${SAMPLE.name} at ${sso.testedAt ?? ''}.`],
        step: null,
      };
    case 'failed':
      return {
        kind: 'failed',
        word: 'Test did not work',
        lines: [
          `${name} said: This person is not assigned to the Soirely app in ${name}.`,
          `Nothing was switched on. Fix it in ${name}, then test again.`,
        ],
        step: 'testAgain',
      };
    case 'untested':
      return {
        kind: 'grey',
        word: 'Saved, not tested',
        lines: ['Test sign-on, then switch it on.'],
        step: 'test',
      };
  }
}

export function stayingNote(staying: Provider): string {
  return `${staying.name} stays on until the new provider is tested and switched on.`;
}

export function refusalWords(refusal: Refusal, sso: Sso): { line: string; action: string } {
  const name = sso.provider?.name ?? '';

  switch (refusal) {
    case 'untested':
      return {
        line: 'Test sign-on first. Single sign-on switches on only after a test works.',
        action: SSO_WORDS.test,
      };
    case 'removeRequired':
      return {
        line: `Turn off required sign-on first. While it is on, removing ${name} would leave people at ${sso.domain ?? PROVED_DOMAIN} with no way to sign in.`,
        action: SSO_WORDS.turnOffRequired,
      };
    case 'offRequired':
      return { line: 'Turn off required sign-on first.', action: SSO_WORDS.turnOffRequired };
  }
}

export function askWords(
  ask: Ask,
  sso: Sso,
): { title: string; lines: string[]; keep: string; go: string } {
  const name = sso.provider?.name ?? '';
  const domain = sso.domain ?? PROVED_DOMAIN;

  switch (ask) {
    case 'required':
      return {
        title: `Require sign-on through ${name}?`,
        lines: [
          `People at ${domain} will sign in only through ${name}. A password, Google and Apple will be refused.`,
          `Owners keep their own sign-in, so a broken provider cannot lock ${ORG} out. Every owner sign-in that skips ${name} is recorded and emailed to the other owners.`,
        ],
        keep: 'Keep it optional',
        go: 'Require sign-on',
      };
    case 'change':
      return {
        title: 'Change the identity provider?',
        lines: [
          `People keep signing in through ${name} until the new provider has passed Test sign-on and you switch it on.`,
        ],
        keep: `Keep ${name}`,
        go: 'Change provider',
      };
    case 'remove':
      return {
        title: `Remove ${name}?`,
        lines: [`People at ${domain} go back to signing in with a password, Google or Apple.`],
        keep: `Keep ${name}`,
        go: `Remove ${name}`,
      };
  }
}

export function removedWords(name: string, domain: string | null): string {
  return `${name} removed. People at ${domain ?? PROVED_DOMAIN} sign in with a password, Google or Apple.`;
}

export function requiredLine(sso: Sso): string {
  return `When it is on, people at ${sso.domain ?? PROVED_DOMAIN} can sign in only through ${sso.provider?.name ?? ''}.`;
}

export function removeLabel(sso: Sso): string {
  return `Remove ${sso.provider?.name ?? ''}…`;
}

/** Switching on waits for a test that worked; switching off waits for required sign-on to go first. */
export function switched(sso: Sso): { sso: Sso; refusal: Refusal | null } {
  if (sso.on)
    return sso.required
      ? { sso, refusal: 'offRequired' }
      : { sso: { ...sso, on: false }, refusal: null };
  if (sso.test !== 'passed') return { sso, refusal: 'untested' };

  return { sso: { ...sso, on: true, staying: null }, refusal: null };
}

export function saved(sso: Sso, provider: Provider, changing: boolean): Sso {
  const staying = changing && sso.on ? (sso.staying ?? sso.provider) : null;

  return {
    ...sso,
    provider,
    test: 'untested',
    testedAt: null,
    on: false,
    required: staying != null && sso.required,
    staying,
  };
}

export function removed(sso: Sso): Sso {
  return {
    ...sso,
    provider: null,
    test: 'untested',
    testedAt: null,
    on: false,
    required: false,
    staying: null,
  };
}

export function clockOf(at: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');

  return `${two(at.getHours())}:${two(at.getMinutes())}`;
}

export type Standing = 'none' | 'saved' | 'on' | 'required' | 'free';

export function standingOf(sso: Sso): Standing {
  if (sso.plan === 'free') return 'free';
  if (sso.provider == null || sso.domain == null) return 'none';
  if (sso.on) return sso.required ? 'required' : 'on';

  return 'saved';
}

export type RowMark = 'grey' | 'on' | 'lock';

export interface SsoRow {
  mark: RowMark;
  word: string;
  line: string;
}

export function ssoRow(standing: Standing, provider = OKTA.name): SsoRow {
  switch (standing) {
    case 'none':
      return {
        mark: 'grey',
        word: 'Not set up',
        line: `Connect ${ORG}’s identity provider for ${PROVED_DOMAIN}.`,
      };
    case 'saved':
      return {
        mark: 'grey',
        word: 'Saved, off',
        line: `${provider} is saved. Test sign-on, then switch it on.`,
      };
    case 'on':
      return {
        mark: 'on',
        word: 'On',
        line: `People at ${PROVED_DOMAIN} sign in through ${provider}.`,
      };
    case 'required':
      return {
        mark: 'on',
        word: 'Required',
        line: `Only ${provider} signs in people at ${PROVED_DOMAIN}. Owners keep their own sign-in.`,
      };
    case 'free':
      return {
        mark: 'lock',
        word: 'Comes with Enterprise',
        line: `Single sign-on is part of Enterprise. ${ORG} is on Free.`,
      };
  }
}

export const EXEMPT_LINE = 'Sign-in through your organisation’s own single sign-on is exempt.';

export function rowAction(standing: Standing, viewer: Pick<Viewer, 'owns'>): string {
  if (!viewer.owns) return 'See';

  return standing === 'none' ? 'Set up' : 'Change';
}

const SSO_STATE_OF: Record<Standing, string> = {
  none: 'none',
  saved: 'saved',
  on: 'on',
  required: 'required_on',
  free: 'none',
};

const RULES_STATE_OF: Record<Standing, string> = {
  none: 'not_set_up',
  saved: 'ssoSaved',
  on: 'ssoOn',
  required: 'ssoRequired',
  free: 'not_set_up',
};

function query(viewer: Pick<Viewer, 'key'>, state: string, plan: Plan): string {
  const search = new URLSearchParams();
  if (viewer.key !== 'folake') search.set('as', viewer.key);
  search.set('state', state);
  if (plan === 'free') search.set('plan', 'free');

  return search.toString();
}

export function ssoPath(
  viewer: Pick<Viewer, 'key'>,
  state: string,
  plan: Plan = 'enterprise',
): string {
  return `/demo/settings/sign-in-rules/single-sign-on?${query(viewer, state, plan)}`;
}

export function rulesPath(
  viewer: Pick<Viewer, 'key'>,
  state: string,
  plan: Plan = 'enterprise',
): string {
  return `/demo/settings/sign-in-rules?${query(viewer, state, plan)}`;
}

export function pageFor(standing: Standing, viewer: Pick<Viewer, 'key'>): string {
  return ssoPath(viewer, SSO_STATE_OF[standing], standing === 'free' ? 'free' : 'enterprise');
}

export function rulesFor(standing: Standing, viewer: Pick<Viewer, 'key'>): string {
  return rulesPath(viewer, RULES_STATE_OF[standing], standing === 'free' ? 'free' : 'enterprise');
}

export function standingOfRules(state: string): Standing {
  switch (state) {
    case 'ssoSaved':
      return 'saved';
    case 'ssoOn':
    case 'everyoneSso':
      return 'on';
    case 'ssoRequired':
      return 'required';
    default:
      return 'none';
  }
}

export const OKTA: Provider = {
  protocol: 'saml',
  name: 'Okta',
  way: 'url',
  url: 'https://ire-events.okta.com/app/exk1a2b3c4/sso/saml/metadata',
  file: null,
  issuer: '',
  clientId: '',
};

export const GOOGLE: Provider = {
  protocol: 'oidc',
  name: 'Google Workspace',
  way: 'url',
  url: '',
  file: null,
  issuer: 'https://accounts.google.com',
  clientId: '48120-ire.apps.googleusercontent.com',
};

const SECRET = 'gw-7Hq2xL9vR4mK8pT1';
const LONG_NAME = 'Okta for Ire Events staff, contractors and guests';

function draftOf(provider: Provider, secret = ''): Draft {
  return { ...provider, secret };
}

export interface SsoStart {
  sso: Sso;
  form: Form | null;
  ask: Ask | null;
  refusal: Refusal | null;
  told: string | null;
}

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

export function ssoStart(state: string, plan: Plan, now: string): SsoStart {
  const nothing: Sso = {
    plan,
    domain: PROVED_DOMAIN,
    provider: null,
    test: 'untested',
    testedAt: null,
    on: false,
    required: false,
    staying: null,
  };
  const start = (sso: Partial<Sso> = {}, more: Partial<SsoStart> = {}): SsoStart => ({
    sso: { ...nothing, ...sso },
    form: null,
    ask: null,
    refusal: null,
    told: null,
    ...more,
  });
  const form = (draft: Draft, pressed = false): Partial<SsoStart> => ({
    form: {
      draft,
      pressed,
      refused: pressed && Object.keys(faultsOf(draft)).length === 0 ? refusalOf(draft) : null,
      changing: false,
    },
  });
  const savedOkta: Partial<Sso> = { provider: OKTA };
  const passed: Partial<Sso> = { ...savedOkta, test: 'passed', testedAt: now };
  const on: Partial<Sso> = { ...passed, on: true };
  const required: Partial<Sso> = { ...on, required: true };

  switch (state) {
    case 'saml_form':
      return start({}, form(draftOf(OKTA)));
    case 'saml_blank':
      return start({}, form(emptyDraft('saml'), true));
    case 'saml_invalid':
      return start(
        {},
        form(
          {
            ...draftOf(OKTA),
            name: LONG_NAME,
            url: 'http://ire-events.okta.com/app/exk1a2b3c4/sso/saml/metadata',
          },
          true,
        ),
      );
    case 'saml_bad_metadata':
      return start(
        {},
        form(
          { ...draftOf(OKTA), url: 'https://ire-events.okta.com/app/bad/sso/saml/metadata' },
          true,
        ),
      );
    case 'oidc_form':
      return start({}, form(draftOf(GOOGLE, SECRET)));
    case 'oidc_blank':
      return start({}, form(emptyDraft('oidc'), true));
    case 'oidc_invalid':
      return start(
        {},
        form(
          { ...draftOf(GOOGLE, SECRET), name: LONG_NAME, issuer: 'http://accounts.google.com' },
          true,
        ),
      );
    case 'oidc_discovery_failed':
      return start(
        {},
        form({ ...draftOf(GOOGLE, SECRET), issuer: 'https://accounts.google.com/bad' }, true),
      );
    case 'saved':
      return start(savedOkta);
    case 'test_running':
      return start({ ...savedOkta, test: 'running' });
    case 'test_passed':
      return start(passed);
    case 'test_failed':
      return start({ ...savedOkta, test: 'failed' });
    case 'switch_untested':
      return start(savedOkta, { refusal: 'untested' });
    case 'on':
    case 'not_owner':
      return start(on);
    case 'required_confirm':
      return start(on, { ask: 'required' });
    case 'required_on':
      return start(required);
    case 'change_confirm':
      return start(on, { ask: 'change' });
    case 'remove_confirm':
      return start(on, { ask: 'remove' });
    case 'remove_refused':
      return start(required, { refusal: 'removeRequired' });
    case 'removed':
      return start({}, { told: removedWords(OKTA.name, PROVED_DOMAIN) });
    case 'no_domain':
      return start({ domain: null });
    default:
      return start();
  }
}

const SSO_STATE_NAMES: Record<(typeof SSO_STATES)[number], string> = {
  none: 'Nothing connected: pick SAML 2.0 or OpenID Connect',
  saml_form: 'SAML 2.0 picked, Okta typed',
  saml_blank: 'SAML 2.0, Save with nothing typed',
  saml_invalid: 'SAML 2.0, a name past 40 and an http:// URL',
  saml_bad_metadata: 'SAML 2.0, the metadata could not be read',
  oidc_form: 'OpenID Connect picked, Google Workspace typed',
  oidc_blank: 'OpenID Connect, Save with nothing typed',
  oidc_invalid: 'OpenID Connect, a name past 40 and an http:// issuer',
  oidc_discovery_failed: 'OpenID Connect, the issuer’s settings not found',
  saved: 'Okta saved, not tested',
  test_running: 'Testing sign-on…',
  test_passed: 'Test worked',
  test_failed: 'Test did not work',
  switch_untested: 'Switched before a test worked',
  on: 'On',
  required_confirm: 'Require sign-on, the confirm',
  required_on: 'Required',
  change_confirm: 'Change provider, the confirm',
  remove_confirm: 'Remove Okta, the confirm',
  remove_refused: 'Remove Okta refused while required',
  removed: 'Okta removed',
  no_domain: 'No proved domain',
  not_owner: 'An admin reads it',
};

export const SSO_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The row on Sign-in rules',
    states: [
      { to: rulesPath(VIEWERS.folake, 'not_set_up'), name: 'Not set up' },
      { to: rulesPath(VIEWERS.folake, 'ssoSaved'), name: 'Saved, off' },
      { to: rulesPath(VIEWERS.folake, 'ssoOn'), name: 'On' },
      { to: rulesPath(VIEWERS.folake, 'ssoRequired'), name: 'Required' },
      {
        to: rulesPath(VIEWERS.folake, 'not_set_up', 'free'),
        name: 'Comes with Enterprise, on Free',
      },
      {
        to: rulesPath(VIEWERS.folake, 'everyoneSso'),
        name: 'Two-factor for everyone, single sign-on exempt',
      },
    ],
  },
  {
    name: 'The Single sign-on page',
    states: [
      ...SSO_STATES.map((state) => ({
        to: ssoPath(state === 'not_owner' ? VIEWERS.julien : VIEWERS.folake, state),
        name: SSO_STATE_NAMES[state],
      })),
      { to: ssoPath(VIEWERS.folake, 'none', 'free'), name: 'Comes with Enterprise, on Free' },
    ],
  },
];

/** The sign-in's handoff: an address at a domain with single sign-on, which says only that the domain has it. */
export function ssoDomainOf(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${PROVED_DOMAIN}`);
}

export function refusedUnderRequired(email: string): boolean {
  return ssoDomainOf(email) && email.trim().toLowerCase() !== SAMPLE.email;
}

export const SIGN_IN_SSO = {
  sample: 'ade@ire.events',
  line: `${ORG} signs in through Okta.`,
  notice: `${ORG} signs you in through Okta.`,
  go: 'Continue to Okta',
  another: 'Sign in another way',
  demoGone: 'Demo: in the product this tab goes to Okta, and comes back here signed in.',
  back: 'Come back signed in',
  ownerStill: `Demo: an owner’s own address, ${SAMPLE.email}, still signs in another way, and the other owners get an email.`,
  seeEmail: 'See the email',
} as const;

export type SsoSignIn = 'handoff' | 'required';

export function ssoSignInOf(state: string): SsoSignIn | null {
  if (state === 'sso_handoff') return 'handoff';

  return state === 'sso_required' ? 'required' : null;
}

export const BREAK_GLASS_PATH = '/demo/emails/sso-break-glass';

export const BREAK_GLASS = {
  to: `The other owners of ${ORG}`,
  from: 'Soirely',
  subject: `${SAMPLE.name} signed in to ${ORG} without Okta`,
  lines: [
    `${SAMPLE.name}, an owner, signed in to ${ORG} with a password at 09:14 on Thursday, Nov 19, without going through Okta.`,
    `Owners can always do this, so a broken provider never locks ${ORG} out. The sign-in is recorded in the audit log.`,
    'If you did not expect it, check the audit log and talk to Folake.',
  ],
  button: 'Open the audit log',
  foot: `You get this because you are an owner of ${ORG}.`,
} as const;

export const SIGN_IN_SSO_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Single sign-on at sign-in (sc-610)',
    states: [
      {
        to: '/demo/sign-in?state=sso_handoff',
        name: 'An address at ire.events hands over to Okta',
      },
      {
        to: '/demo/sign-in?state=sso_required',
        name: 'Required sign-on refuses a password, Google and Apple; the owner still signs in',
      },
    ],
  },
  {
    name: 'The break-glass email (sc-610)',
    states: [{ to: BREAK_GLASS_PATH, name: 'An owner signed in without Okta' }],
  },
];
