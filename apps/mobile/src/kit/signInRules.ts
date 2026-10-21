import {
  ApiError,
  type Membership,
  type Problem,
  type SignInRuleChange,
} from '@soirely/api-client';
import { type TwoFactorStanding } from '@soirely/domain';
import { type TFunction } from 'i18next';

/** Why an organisation's sign-in rule (sc-69) sent somebody to sign-in, named so the screen can say whose rule it was. */
export type RuleRefusal =
  | { kind: 'timedOut'; organisation: string; days: number; email: string }
  | { kind: 'providerOnly'; organisation: string; providers: string[]; email: string };

/** From the API's refusal: a session the inactivity limit ended, or a password the provider-only rule turned away. */
export function ruleRefusal(why: Problem | undefined): RuleRefusal | null {
  if (why == null || why.organisation == null) return null;

  const error = new ApiError(why);

  if (error.is('session_timed_out') && why.days != null) {
    return {
      kind: 'timedOut',
      organisation: why.organisation,
      days: why.days,
      email: why.email ?? '',
    };
  }

  if (error.is('oauth_only')) {
    return {
      kind: 'providerOnly',
      organisation: why.organisation,
      providers: why.providers ?? [],
      email: why.email ?? '',
    };
  }

  return null;
}

/** Sign-in, carrying the refusal in its query; `ended` adds "You were signed out" when no rule says more. */
export function signInRoute(refusal: RuleRefusal | null, ended: boolean): `/sign-in?${string}` {
  const query = new URLSearchParams(ended ? { signedOut: '1' } : {});

  if (refusal?.kind === 'timedOut') {
    query.set('rule', 'timedOut');
    query.set('organisation', refusal.organisation);
    query.set('days', String(refusal.days));
    query.set('email', refusal.email);
  }

  if (refusal?.kind === 'providerOnly') {
    query.set('rule', 'providerOnly');
    query.set('organisation', refusal.organisation);
    query.set('providers', refusal.providers.join(','));
    query.set('email', refusal.email);
  }

  return `/sign-in?${query.toString()}`;
}

/** The refusal back out of sign-in's query, or null when it carries none or a malformed one. */
export function refusalFromParams(params: Partial<Record<string, string>>): RuleRefusal | null {
  const organisation = params.organisation;
  if (organisation == null || organisation === '') return null;

  if (params.rule === 'timedOut') {
    const days = Number(params.days);

    return Number.isInteger(days) && days > 0
      ? { kind: 'timedOut', organisation, days, email: params.email ?? '' }
      : null;
  }

  if (params.rule === 'providerOnly') {
    const providers = (params.providers ?? '').split(',').filter((provider) => provider !== '');

    return { kind: 'providerOnly', organisation, providers, email: params.email ?? '' };
  }

  return null;
}

/** The providers named in the refusal, Google and Apple when it named none. */
export function providerNames(providers: readonly string[]): string[] {
  const names: Record<string, string> = { google: 'Google', apple: 'Apple' };

  return (providers.length > 0 ? providers : ['google', 'apple']).map(
    (provider) => names[provider] ?? provider,
  );
}

export type RulesNotice = 'due' | 'readOnly' | 'twoFactor' | 'changed';

/** What the member's organisation's rules ask of them, in the order the design stacks them. */
export function rulesNotices(
  organisation: Membership,
  seenAt: string | null | undefined,
  twoFactorPutOff: boolean,
  standing: TwoFactorStanding = 'clear',
): RulesNotice[] {
  const notices: RulesNotice[] = [];
  const changedAt = organisation.signInRules.changedAt;

  // Past the deadline the whole screen says it instead (TwoFactorOverdue).
  if (standing === 'overdue') return notices;
  if (standing === 'due') notices.push('due');
  if (organisation.readOnlyUntilLinked) notices.push('readOnly');
  if (organisation.withheldUntilTwoFactor.length > 0 && !twoFactorPutOff) notices.push('twoFactor');
  if (changedAt != null && seenAt !== undefined && changedAt !== seenAt) notices.push('changed');

  return notices;
}

/** The other organisation whose shorter limit applies to this member, or null when it is this one's own or none. */
export function limitFromElsewhere(
  limit: { organisationId: string; organisation: string; days: number } | null,
  organisationId: string,
): { organisation: string; days: number } | null {
  if (limit == null || limit.organisationId === organisationId) return null;

  return { organisation: limit.organisation, days: limit.days };
}

/** One rule's value as the member's view words it, for what holds now and for what it was. */
export function ruleValue(t: TFunction, rule: SignInRuleChange['rule'], value: unknown): string {
  if (rule === 'providerOnly')
    return t(value === true ? 'signInRules.valueProviderOnly' : 'signInRules.valueAnyMethod');
  if (rule === 'inactivityTimeoutDays')
    return typeof value === 'number'
      ? t('signInRules.valueIdle', { count: value })
      : t('signInRules.valueNoLimit');
  if (rule === 'everyoneNeedsTwoFactor')
    return t(value === true ? 'signInRules.valueEveryone' : 'signInRules.valueNoEveryone');

  return t(value === true ? 'signInRules.valueTwoFactor' : 'signInRules.valueNoTwoFactor');
}
