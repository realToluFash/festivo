import type { Membership } from '@soirely/api-client';
import { formatDay } from '@soirely/domain';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { currentLocale } from '../i18n/index.ts';
import { markRulesSeen, useRulesSeen } from '../signInRulesSeen.ts';
import { useTwoFactorStanding } from '../twoFactorStanding.ts';

/** What the organisation's sign-in rules ask of this member (sc-69, sc-609), named after the organisation. */
export function SignInRulesNotices({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const [later, setLater] = useState(false);
  const seen = useRulesSeen(organisation.id);
  const name = organisation.name;
  const changedAt = organisation.signInRules.changedAt;
  const standing = useTwoFactorStanding(organisation);

  // Past the deadline the whole page says it instead (TwoFactorOverdue).
  if (standing === 'overdue') return null;

  return (
    <>
      {standing === 'due' && organisation.twoFactorDue != null && (
        <div className="notice notice-attention" role="status">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p>
              {t('signInRules.dueBody', {
                organisation: name,
                deadline: organisation.twoFactorDue.written,
              })}
            </p>
            <Link className="link-button" to="/app/account/security">
              {t('signInRules.dueSetUp')}
            </Link>
          </div>
        </div>
      )}

      {organisation.readOnlyUntilLinked && (
        <div className="notice notice-attention" role="status">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('signInRules.unlinkedTitle')}</p>
            <p>{t('signInRules.unlinkedBody', { organisation: name })}</p>
            <Link className="link-button" to="/app/account/security">
              {t('signInRules.unlinkedLink')}
            </Link>
          </div>
        </div>
      )}

      {organisation.withheldUntilTwoFactor.length > 0 && !later && (
        <div className="notice notice-quiet" role="status">
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('signInRules.gateTitle', { organisation: name })}</p>
            <p>{t('signInRules.gateBody', { organisation: name })}</p>
            <Link className="link-button" to="/app/account/security">
              {t('signInRules.gateTurnOn')}
            </Link>
            <button className="link-button" type="button" onClick={() => setLater(true)}>
              {t('signInRules.gateLater')}
            </button>
          </div>
        </div>
      )}

      {changedAt != null && changedAt !== seen && (
        <div className="notice notice-quiet" role="status">
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('signInRules.changedTitle')}</p>
            <p>
              {t('signInRules.changedBody', {
                organisation: name,
                day: formatDay(changedAt, currentLocale()),
              })}
            </p>
            <Link className="link-button" to="/app/settings/sign-in-rules">
              {t('signInRules.changedSee')}
            </Link>
          </div>
          <button
            className="link-button notice-dismiss"
            type="button"
            aria-label={t('signInRules.changedClose')}
            onClick={() => markRulesSeen(organisation)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
