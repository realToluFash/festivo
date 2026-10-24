import {
  ApiError,
  type Membership,
  type SignInRuleChange,
  type SignInRulesChanges,
  type SignInRulesPage,
} from '@soirely/api-client';
import { formatDay, formatTimeOfDay, roleName } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { SettingsSections } from '../../../components/SettingsSections.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { can, replaceOrganisation, useSession } from '../../../session.ts';
import { markRulesSeen } from '../../../signInRulesSeen.ts';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; page: SignInRulesPage };

type Rules = Required<SignInRulesChanges>;

/** Settings > Sign-in rules (sc-69, sc-609): every member reads them, organisation.manage changes them. */
export function SignInRules() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const organisationId = organisation?.id;

  useEffect(() => {
    if (organisationId == null) return;
    let current = true;

    api.signInRules(organisationId).then(
      (page) => current && setLoad({ kind: 'loaded', page }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

  useEffect(() => {
    if (organisation != null) markRulesSeen(organisation);
  }, [organisation]);

  if (organisation == null) return null;

  const manages = can(session, 'organisation.manage');

  return (
    <div className="settings settings-wide">
      <SettingsSections />
      <div className="settings-heading">
        <h1>
          {manages
            ? t('signInRules.title')
            : t('signInRules.readTitle', { organisation: organisation.name })}
        </h1>
        <p>
          {manages
            ? t('signInRules.intro', { organisation: organisation.name })
            : t('signInRules.readIntro')}
        </p>
      </div>

      {load.kind === 'loading' && (
        <p className="muted" role="status">
          {t('signInRules.loading')}
        </p>
      )}
      {load.kind === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p>{t('signInRules.failedLoad')}</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              {t('signInRules.retry')}
            </button>
          </div>
        </div>
      )}
      {load.kind === 'loaded' &&
        load.page.inactivityLimit != null &&
        load.page.inactivityLimit.organisationId !== organisation.id && (
          <div className="notice notice-quiet" role="status">
            <span className="mark mark-info" aria-hidden="true">
              i
            </span>
            <div className="notice-body">
              <p>
                {t('signInRules.limitApplies', {
                  count: load.page.inactivityLimit.days,
                  organisation: load.page.inactivityLimit.organisation,
                })}
              </p>
            </div>
          </div>
        )}
      {load.kind === 'loaded' &&
        (manages ? (
          <Editable
            key={organisation.id}
            organisation={organisation}
            page={load.page}
            onSaved={(page) => {
              setLoad({ kind: 'loaded', page });
              const {
                providerOnly,
                inactivityTimeoutDays,
                administratorsNeedTwoFactor,
                everyoneNeedsTwoFactor,
                changedAt,
              } = page;
              const saved = {
                ...organisation,
                signInRules: {
                  providerOnly,
                  inactivityTimeoutDays,
                  administratorsNeedTwoFactor,
                  everyoneNeedsTwoFactor,
                  changedAt,
                },
              };
              markRulesSeen(saved);
              replaceOrganisation(saved);
            }}
          />
        ) : (
          <InForce organisation={organisation} page={load.page} />
        ))}
    </div>
  );
}

function Editable({
  organisation,
  page,
  onSaved,
}: {
  organisation: Membership;
  page: SignInRulesPage;
  onSaved: (page: SignInRulesPage) => void;
}) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<Rules>(() => rulesOf(page));
  const [status, setStatus] = useState<'editing' | 'saving' | 'saved' | 'failed'>('editing');
  const [needsOwnTwoFactor, setNeedsOwnTwoFactor] = useState(false);
  const [everyoneNeedsOwn, setEveryoneNeedsOwn] = useState(false);
  const [needsOwnProvider, setNeedsOwnProvider] = useState(false);
  const [hasProvider, setHasProvider] = useState(page.ownProvider);
  const changed = differences(rulesOf(page), rules);
  const dirty = Object.keys(changed).length > 0;
  const stranded = page.passwordOnly ?? [];
  const withoutTwoFactor = page.withoutTwoFactor ?? [];
  const deadline = page.twoFactorDeadline?.written ?? '';
  const name = organisation.name;
  const requiresProvider = rules.providerOnly && !needsOwnProvider;
  const effective: SignInRulesChanges = { ...changed };
  if (needsOwnProvider) delete effective.providerOnly;

  function pick(next: SignInRulesChanges): void {
    setRules((previous) => ({ ...previous, ...next }));
    setStatus('editing');
  }

  function pickMethod(providerOnly: boolean): void {
    setNeedsOwnProvider(providerOnly && !hasProvider && !page.providerOnly);
    pick({ providerOnly });
  }

  /** The choice goes back to "Any method" with the notice kept up, and the other choices stay, unsaved. */
  function refuseProvider(): void {
    setRules((previous) => ({ ...previous, providerOnly: false }));
    setNeedsOwnProvider(true);
    setStatus('editing');
  }

  async function save(): Promise<void> {
    if (!dirty || status === 'saving') return;

    if (needsOwnProvider && rules.providerOnly) {
      refuseProvider();
      return;
    }

    setStatus('saving');

    try {
      onSaved(await api.updateSignInRules(organisation.id, changed));
      setNeedsOwnProvider(false);
      setStatus('saved');
    } catch (error) {
      // Google or Apple unlinked in another tab, say.
      if (error instanceof ApiError && error.is('oauth_only_unlinked') && changed.providerOnly) {
        setHasProvider(false);
        refuseProvider();
        return;
      }

      // Two-factor removed in another tab, say: the switch goes back off and the other choices stay, unsaved.
      if (error instanceof ApiError && error.is('two_factor_off')) {
        setRules((previous) => ({
          ...previous,
          administratorsNeedTwoFactor: changed.administratorsNeedTwoFactor
            ? false
            : previous.administratorsNeedTwoFactor,
          everyoneNeedsTwoFactor: changed.everyoneNeedsTwoFactor
            ? false
            : previous.everyoneNeedsTwoFactor,
        }));
        setNeedsOwnTwoFactor(changed.administratorsNeedTwoFactor === true);
        setEveryoneNeedsOwn(changed.everyoneNeedsTwoFactor === true);
        setStatus('editing');
        return;
      }

      setStatus('failed');
    }
  }

  function switchTwoFactor(): void {
    const required = !rules.administratorsNeedTwoFactor;

    if (required && !page.ownTwoFactor) {
      setNeedsOwnTwoFactor(true);
      return;
    }

    setNeedsOwnTwoFactor(false);
    pick({ administratorsNeedTwoFactor: required });
  }

  function switchEveryone(): void {
    const required = !rules.everyoneNeedsTwoFactor;

    if (required && !page.ownTwoFactor) {
      setEveryoneNeedsOwn(true);
      return;
    }

    setEveryoneNeedsOwn(false);
    pick({ everyoneNeedsTwoFactor: required });
  }

  return (
    <>
      {status === 'saved' && (
        <div className="notice notice-done" role="status">
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>{t('signInRules.saved')}</p>
        </div>
      )}
      {status === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('signInRules.failedSave')}</p>
        </div>
      )}

      <div className="sign-in-rules">
        <div className="sign-in-rules-main">
          <section className="card settings-card" aria-labelledby="rules-method">
            <h2 id="rules-method">{t('signInRules.methodTitle')}</h2>
            <fieldset className="roles-replacements sign-in-rules-methods">
              <legend className="visually-hidden">{t('signInRules.methodTitle')}</legend>
              {[false, true].map((providerOnly) => (
                <label
                  key={String(providerOnly)}
                  className="roles-replacement"
                  htmlFor={`rules-method-${providerOnly ? 'provider' : 'any'}`}
                >
                  <input
                    id={`rules-method-${providerOnly ? 'provider' : 'any'}`}
                    type="radio"
                    name="rules-method"
                    checked={rules.providerOnly === providerOnly}
                    onChange={() => pickMethod(providerOnly)}
                  />
                  <span className="roles-row-name">
                    {t(providerOnly ? 'signInRules.providerOnly' : 'signInRules.anyMethod')}
                  </span>
                  <span className="muted roles-replacement-means">
                    {t(
                      providerOnly ? 'signInRules.providerOnlyMeans' : 'signInRules.anyMethodMeans',
                      {
                        organisation: name,
                      },
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
            {needsOwnProvider && (
              <div className="notice notice-attention sign-in-rules-needs-own" role="alert">
                <span className="mark mark-attention" aria-hidden="true">
                  !
                </span>
                <div className="notice-body">
                  <p className="notice-title">{t('signInRules.needsOwnProviderTitle')}</p>
                  <p>{t('signInRules.needsOwnProviderBody')}</p>
                  <Link className="button" to="/app/account/security">
                    {t('signInRules.unlinkedLink')}
                  </Link>
                </div>
              </div>
            )}
            {requiresProvider && stranded.length > 0 && (
              <div className="notice notice-attention">
                <span className="mark mark-attention" aria-hidden="true">
                  !
                </span>
                <div className="notice-body">
                  <p className="notice-title">
                    {t('signInRules.strandedTitle', { count: stranded.length })}
                  </p>
                  <p>{t('signInRules.strandedBody', { organisation: name })}</p>
                  <ul aria-label={t('signInRules.strandedList')}>
                    {stranded.map((member) => (
                      <li key={member.userId}>
                        {t('signInRules.strandedPerson', {
                          name: member.name,
                          role: roleName(t, member.role),
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section className="card settings-card" aria-labelledby="rules-idle">
            <h2 id="rules-idle">{t('signInRules.idleTitle')}</h2>
            <p className="muted">{t('signInRules.idleIntro')}</p>
            <div
              className="sign-in-rules-choices"
              role="group"
              aria-label={t('signInRules.idleTitle')}
            >
              {[...page.inactivityChoices, null].map((days) => (
                <button
                  key={String(days)}
                  type="button"
                  className="roles-level"
                  aria-pressed={rules.inactivityTimeoutDays === days}
                  onClick={() => pick({ inactivityTimeoutDays: days })}
                >
                  {idleLabel(t, days)}
                </button>
              ))}
            </div>
          </section>

          <section className="card settings-card" aria-labelledby="rules-two-factor">
            <div className="sign-in-rules-switch">
              <h2 id="rules-two-factor">{t('signInRules.twoFactorTitle')}</h2>
              <span className="muted">
                {t(
                  rules.administratorsNeedTwoFactor
                    ? 'signInRules.required'
                    : 'signInRules.notRequired',
                )}
              </span>
              <button
                type="button"
                className="roles-level"
                aria-pressed={rules.administratorsNeedTwoFactor}
                aria-label={t('signInRules.twoFactorLabel')}
                onClick={switchTwoFactor}
              >
                {t(
                  rules.administratorsNeedTwoFactor ? 'signInRules.turnOff' : 'signInRules.turnOn',
                )}
              </button>
            </div>
            {needsOwnTwoFactor && (
              <div className="notice notice-attention sign-in-rules-needs-own" role="alert">
                <span className="mark mark-attention" aria-hidden="true">
                  !
                </span>
                <div className="notice-body">
                  <p className="notice-title">{t('signInRules.needsOwnTitle')}</p>
                  <p>{t('signInRules.needsOwnBody')}</p>
                  <Link className="button" to="/app/account/security">
                    {t('signInRules.needsOwnTurnOn')}
                  </Link>
                </div>
              </div>
            )}
            <p className="muted">
              {t(
                rules.everyoneNeedsTwoFactor
                  ? 'signInRules.twoFactorCovered'
                  : rules.administratorsNeedTwoFactor
                    ? 'signInRules.twoFactorOn'
                    : 'signInRules.twoFactorOff',
              )}
            </p>
          </section>

          <section className="card settings-card" aria-labelledby="rules-everyone">
            <div className="sign-in-rules-switch">
              <h2 id="rules-everyone">{t('signInRules.everyoneTitle')}</h2>
              <span className="muted">
                {t(
                  rules.everyoneNeedsTwoFactor ? 'signInRules.required' : 'signInRules.notRequired',
                )}
              </span>
              <button
                type="button"
                className="roles-level"
                aria-pressed={rules.everyoneNeedsTwoFactor}
                aria-label={t('signInRules.everyoneLabel')}
                onClick={switchEveryone}
              >
                {t(rules.everyoneNeedsTwoFactor ? 'signInRules.turnOff' : 'signInRules.turnOn')}
              </button>
            </div>
            {everyoneNeedsOwn && (
              <div className="notice notice-attention sign-in-rules-needs-own" role="alert">
                <span className="mark mark-attention" aria-hidden="true">
                  !
                </span>
                <div className="notice-body">
                  <p className="notice-title">{t('signInRules.needsOwnTitle')}</p>
                  <p>{t('signInRules.needsOwnBody')}</p>
                  <Link className="button" to="/app/account/security">
                    {t('signInRules.needsOwnTurnOn')}
                  </Link>
                </div>
              </div>
            )}
            {rules.everyoneNeedsTwoFactor && page.everyoneNeedsTwoFactor && (
              <p>{t('signInRules.everyoneRequiredFrom', { deadline })}</p>
            )}
            {rules.everyoneNeedsTwoFactor &&
              !page.everyoneNeedsTwoFactor &&
              withoutTwoFactor.length > 0 && (
                <div className="notice notice-attention">
                  <span className="mark mark-attention" aria-hidden="true">
                    !
                  </span>
                  <div className="notice-body">
                    <p className="notice-title">
                      {t('signInRules.everyoneWithoutTitle', { count: withoutTwoFactor.length })}
                    </p>
                    <p>
                      {t('signInRules.everyoneWithoutBody', {
                        count: withoutTwoFactor.length,
                        deadline,
                        organisation: name,
                      })}
                    </p>
                    <ul aria-label={t('signInRules.everyoneWithoutList')}>
                      {withoutTwoFactor.map((member) => (
                        <li key={member.userId}>
                          {t('signInRules.everyoneWithoutPerson', {
                            name: member.name,
                            role: roleName(t, member.role),
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            <p className="muted">
              {t(
                rules.everyoneNeedsTwoFactor ? 'signInRules.everyoneOn' : 'signInRules.everyoneOff',
                { organisation: name },
              )}
            </p>
          </section>
        </div>

        <div className="sign-in-rules-side">
          <section className="card settings-card" aria-labelledby="rules-effects">
            <h2 id="rules-effects">{t('signInRules.effectsTitle')}</h2>
            <ul className="sign-in-rules-effects">
              {effects(
                t,
                effective,
                stranded.map(({ name: who }) => who),
              ).map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
            <button
              className="button button-primary"
              type="button"
              disabled={!dirty}
              aria-busy={status === 'saving'}
              onClick={() => void save()}
            >
              {status === 'saving'
                ? t('signInRules.saving')
                : dirty
                  ? t('signInRules.save')
                  : t('signInRules.inForce')}
            </button>
            <p className="muted">{t('signInRules.emailNote')}</p>
          </section>

          {(requiresProvider || rules.inactivityTimeoutDays != null) && (
            <section className="card settings-card" aria-labelledby="rules-see">
              <h2 id="rules-see">{t('signInRules.seeTitle')}</h2>
              <div className="notice notice-quiet">
                <span className="mark mark-info" aria-hidden="true">
                  i
                </span>
                <div className="notice-body">
                  {requiresProvider ? (
                    <>
                      <p className="notice-title">
                        {t('signIn.providerOnlyTitle', { organisation: name })}
                      </p>
                      <p>{t('signInRules.seeProviderBody', { organisation: name })}</p>
                    </>
                  ) : (
                    <>
                      <p className="notice-title">
                        {t('signIn.timedOutTitle', { organisation: name })}
                      </p>
                      <p>
                        {t('signIn.timedOutBody', {
                          organisation: name,
                          count: rules.inactivityTimeoutDays ?? 0,
                        })}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <p className="muted">{t('signInRules.seeNote', { organisation: name })}</p>
            </section>
          )}

          <Changes changes={page.changes} />
        </div>
      </div>
    </>
  );
}

/** The member's view, which the "Sign-in rules changed" notice opens: what changed, then what holds. */
function InForce({ organisation, page }: { organisation: Membership; page: SignInRulesPage }) {
  const { t } = useTranslation();
  const rules = rulesOf(page);

  return (
    <div className="sign-in-rules">
      <div className="sign-in-rules-main">
        <Changes changes={page.changes} />
      </div>
      <div className="sign-in-rules-side">
        <section className="card settings-card" aria-labelledby="rules-in-force">
          <h2 id="rules-in-force">{t('signInRules.inForceTitle')}</h2>
          <dl className="settings-read-only">
            <div>
              <dt>{t('signInRules.methodTitle')}</dt>
              <dd>{ruleValue(t, 'providerOnly', rules.providerOnly)}</dd>
            </div>
            <div>
              <dt>{t('signInRules.idleTitle')}</dt>
              <dd>{ruleValue(t, 'inactivityTimeoutDays', rules.inactivityTimeoutDays)}</dd>
            </div>
            <div>
              <dt>{t('signInRules.twoFactorShort')}</dt>
              <dd>
                {ruleValue(t, 'administratorsNeedTwoFactor', rules.administratorsNeedTwoFactor)}
              </dd>
            </div>
            <div>
              <dt>{t('signInRules.everyoneTitle')}</dt>
              <dd>
                {rules.everyoneNeedsTwoFactor
                  ? t('signInRules.everyoneRequiredFrom', {
                      deadline: page.twoFactorDeadline?.written ?? '',
                    })
                  : ruleValue(t, 'everyoneNeedsTwoFactor', false)}
              </dd>
            </div>
          </dl>
          <p className="muted">{t('signInRules.askOwner', { organisation: organisation.name })}</p>
        </section>
      </div>
    </div>
  );
}

function Changes({ changes }: { changes: SignInRuleChange[] }) {
  const { t } = useTranslation();
  const locale = dateLocale();

  return (
    <section className="card settings-card" aria-labelledby="rules-changes">
      <h2 id="rules-changes">{t('signInRules.changesTitle')}</h2>
      {changes.length === 0 ? (
        <p className="muted">{t('signInRules.noChanges')}</p>
      ) : (
        <ol className="sign-in-rules-changes">
          {changes.map((change) => (
            <li key={`${change.at}-${change.rule}`}>
              <p className="muted">
                {t('signInRules.changeWhen', {
                  day: formatDay(change.at, locale),
                  time: formatTimeOfDay(change.at, locale),
                  who:
                    change.by.role == null
                      ? change.by.name
                      : t('signInRules.changeWho', {
                          name: change.by.name,
                          role: roleName(t, change.by.role),
                        }),
                })}
              </p>
              <p>{ruleValue(t, change.rule, change.now)}</p>
              <p className="muted">
                {t('signInRules.changeWas', { was: ruleValue(t, change.rule, change.was) })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function rulesOf(page: SignInRulesPage): Rules {
  return {
    providerOnly: page.providerOnly,
    inactivityTimeoutDays: page.inactivityTimeoutDays,
    administratorsNeedTwoFactor: page.administratorsNeedTwoFactor,
    everyoneNeedsTwoFactor: page.everyoneNeedsTwoFactor,
  };
}

/** Only what the person changed is sent, so a save that changes nothing is not offered. */
function differences(saved: Rules, chosen: Rules): SignInRulesChanges {
  const changes: SignInRulesChanges = {};

  if (saved.providerOnly !== chosen.providerOnly) changes.providerOnly = chosen.providerOnly;
  if (saved.inactivityTimeoutDays !== chosen.inactivityTimeoutDays)
    changes.inactivityTimeoutDays = chosen.inactivityTimeoutDays;
  if (saved.administratorsNeedTwoFactor !== chosen.administratorsNeedTwoFactor)
    changes.administratorsNeedTwoFactor = chosen.administratorsNeedTwoFactor;
  if (saved.everyoneNeedsTwoFactor !== chosen.everyoneNeedsTwoFactor)
    changes.everyoneNeedsTwoFactor = chosen.everyoneNeedsTwoFactor;

  return changes;
}

function idleLabel(t: TFunction, days: number | null): string {
  return days == null ? t('signInRules.noLimit') : t('signInRules.days', { count: days });
}

function ruleValue(t: TFunction, rule: SignInRuleChange['rule'], value: unknown): string {
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

function effects(t: TFunction, changed: SignInRulesChanges, stranded: string[]): string[] {
  const said: string[] = [];

  if (changed.providerOnly === true) {
    said.push(t('signInRules.effectProviderOnly'));
    if (stranded.length > 0)
      said.push(
        t('signInRules.effectStranded', {
          names: new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(stranded),
        }),
      );
  }
  if (changed.providerOnly === false) said.push(t('signInRules.effectAnyMethod'));
  if (changed.inactivityTimeoutDays !== undefined)
    said.push(
      changed.inactivityTimeoutDays == null
        ? t('signInRules.effectNoLimit')
        : t('signInRules.effectIdle', { count: changed.inactivityTimeoutDays }),
    );
  if (changed.administratorsNeedTwoFactor !== undefined)
    said.push(
      t(
        changed.administratorsNeedTwoFactor
          ? 'signInRules.effectTwoFactorOn'
          : 'signInRules.effectTwoFactorOff',
      ),
    );
  if (changed.everyoneNeedsTwoFactor !== undefined)
    said.push(
      t(
        changed.everyoneNeedsTwoFactor
          ? 'signInRules.effectEveryoneOn'
          : 'signInRules.effectEveryoneOff',
      ),
    );

  return said.length > 0 ? said : [t('signInRules.effectNothing')];
}
