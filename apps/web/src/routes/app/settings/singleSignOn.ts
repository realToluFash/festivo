import type {
  ApiError,
  SingleSignOnInput,
  SingleSignOnPage,
  SingleSignOnProvider,
} from '@soirely/api-client';
import type { TFunction } from 'i18next';

export const SINGLE_SIGN_ON = '/app/settings/sign-in-rules/single-sign-on';

const NAME_MAX = 40;

export interface Draft {
  protocol: 'saml' | 'oidc' | null;
  name: string;
  way: 'url' | 'file';
  url: string;
  file: { name: string; xml: string } | null;
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export type FieldKey = 'name' | 'metadata' | 'issuer' | 'clientId' | 'clientSecret';
type FaultKey =
  | 'sso.nameBlank'
  | 'sso.nameLong'
  | 'sso.metadataBlank'
  | 'sso.metadataShape'
  | 'sso.issuerBlank'
  | 'sso.issuerShape'
  | 'sso.clientIdBlank'
  | 'sso.clientSecretBlank';
export type Faults = Partial<Record<FieldKey, FaultKey | undefined>>;

export const emptyDraft: Draft = {
  protocol: null,
  name: '',
  way: 'url',
  url: '',
  file: null,
  issuer: '',
  clientId: '',
  clientSecret: '',
};

function isHttps(typed: string): boolean {
  return /^https:\/\/\S+$/iu.test(typed.trim());
}

/** What the form says before it sends: a blank, a name past 40, an address that is not https. */
export function faultKey(draft: Draft, field: FieldKey): FaultKey | null {
  switch (field) {
    case 'name':
      if (draft.name.trim() === '') return 'sso.nameBlank';
      return [...draft.name.trim()].length > NAME_MAX ? 'sso.nameLong' : null;
    case 'metadata':
      if (draft.way === 'file') return draft.file == null ? 'sso.metadataBlank' : null;
      if (draft.url.trim() === '') return 'sso.metadataBlank';
      return isHttps(draft.url) ? null : 'sso.metadataShape';
    case 'issuer':
      if (draft.issuer.trim() === '') return 'sso.issuerBlank';
      return isHttps(draft.issuer) ? null : 'sso.issuerShape';
    case 'clientId':
      return draft.clientId.trim() === '' ? 'sso.clientIdBlank' : null;
    case 'clientSecret':
      return draft.clientSecret === '' ? 'sso.clientSecretBlank' : null;
  }
}

export function fieldsOf(protocol: 'saml' | 'oidc'): FieldKey[] {
  return protocol === 'saml'
    ? ['name', 'metadata']
    : ['name', 'issuer', 'clientId', 'clientSecret'];
}

export function faultsOf(draft: Draft): Faults {
  if (draft.protocol == null) return {};

  return Object.fromEntries(
    fieldsOf(draft.protocol).flatMap((field) => {
      const fault = faultKey(draft, field);

      return fault == null ? [] : [[field, fault]];
    }),
  );
}

export function inputOf(draft: Draft, protocol: 'saml' | 'oidc'): SingleSignOnInput {
  const named = { protocol, name: draft.name.trim() };
  if (protocol === 'oidc') {
    const { issuer, clientId, clientSecret } = draft;

    return { ...named, issuer: issuer.trim(), clientId: clientId.trim(), clientSecret };
  }

  if (draft.way === 'url') return { ...named, metadataUrl: draft.url.trim() };

  const { xml = '', name = '' } = draft.file ?? {};

  return { ...named, metadataXml: xml, metadataFileName: name };
}

export function refusedField(error: ApiError): { field: FieldKey; words: string } | null {
  const fields: readonly string[] = ['name', 'metadata', 'issuer', 'clientId', 'clientSecret'];
  const violation = error.problem.violations?.find((one) => fields.includes(one.propertyPath));

  return violation == null
    ? null
    : { field: violation.propertyPath as FieldKey, words: violation.message };
}

export function ourValues(
  ours: SingleSignOnPage['ours'],
  protocol: 'saml' | 'oidc',
  t: TFunction,
): { label: string; value: string }[] {
  return protocol === 'saml'
    ? [
        { label: t('sso.entityId'), value: ours.saml.entityId },
        { label: t('sso.replyUrl'), value: ours.saml.replyUrl },
        { label: t('sso.metadataUrl'), value: ours.saml.metadataUrl },
      ]
    : [{ label: t('sso.redirectUrl'), value: ours.oidc.redirectUrl }];
}

export function providerTitle(provider: SingleSignOnProvider, t: TFunction): string {
  return `${provider.name} · ${t(provider.protocol === 'saml' ? 'sso.saml' : 'sso.oidc')}`;
}

export function providerLine(provider: SingleSignOnProvider): string {
  if (provider.protocol === 'oidc') return provider.issuer ?? '';

  return (provider.way === 'file' ? provider.file : provider.url) ?? '';
}

/** The provider people sign in through now: the new one once on, the old one while a change waits. */
export function liveOf(page: SingleSignOnPage): SingleSignOnProvider | null {
  return page.on ? page.provider : page.staying;
}

export type Standing = 'none' | 'saved' | 'on' | 'required' | 'free';

export function standingOf(page: SingleSignOnPage): Standing {
  if (page.plan === 'free') return 'free';
  if (page.domains.length === 0) return 'none';
  if (liveOf(page) != null) return page.required ? 'required' : 'on';

  return page.provider == null ? 'none' : 'saved';
}

export interface Status {
  kind: 'lock' | 'grey' | 'on' | 'running' | 'passed' | 'failed';
  word: string;
  lines: string[];
  step: 'test' | 'testAgain' | 'plans' | 'prove' | null;
}

export function ssoStatus(
  page: SingleSignOnPage,
  running: boolean,
  named: { organisation: string; domains: string },
  t: TFunction,
): Status | null {
  if (page.plan === 'free')
    return {
      kind: 'lock',
      word: t('sso.enterprise'),
      lines: [t('sso.enterpriseLine', named)],
      step: 'plans',
    };
  if (page.domains.length === 0)
    return {
      kind: 'grey',
      word: t('sso.proveFirst'),
      lines: [t('sso.proveFirstLine', named)],
      step: 'prove',
    };
  if (page.provider == null) return null;

  const words = { ...named, provider: page.provider.name };

  if (page.on)
    return {
      kind: 'on',
      word: t(page.required ? 'sso.requiredWord' : 'sso.onWord'),
      lines: [t(page.required ? 'sso.requiredStatus' : 'sso.onStatus', words)],
      step: null,
    };
  if (running)
    return {
      kind: 'running',
      word: t('sso.testing'),
      lines: [t('sso.testingLine', words)],
      step: null,
    };

  switch (page.test) {
    case 'passed':
      return {
        kind: 'passed',
        word: t('sso.testWorked'),
        lines: [
          t('sso.testWorkedLine', {
            ...words,
            email: page.testedEmail ?? '',
            name: page.testedName ?? '',
            time: page.tested ?? '',
          }),
        ],
        step: null,
      };
    case 'failed': {
      const said = page.testFailure ?? '';

      return {
        kind: 'failed',
        word: t('sso.testFailed'),
        lines: page.testFailureFromProvider
          ? [t('sso.providerSaid', { ...words, said }), t('sso.fixThere', words)]
          : [said, t('sso.checkBoth', words)],
        step: 'testAgain',
      };
    }
    case 'untested':
      return {
        kind: 'grey',
        word: t('sso.savedUntested'),
        lines: [t('sso.savedUntestedLine')],
        step: 'test',
      };
  }
}
