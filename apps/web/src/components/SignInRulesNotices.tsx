import type { Membership } from '@soirely/api-client';
import { formatDay } from '@soirely/domain';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { dateLocale } from '../i18n/index.ts';
import { markRulesSeen, useRulesSeen } from '../signInRulesSeen.ts';
import { afterNotice, useFocusOnceShown } from '../stepFocus.ts';
import { useTwoFactorStanding } from '../twoFactorStanding.ts';

/** What the organisation's sign-in rules ask of this member (sc-69, sc-609), named after the organisation. */
export function SignInRulesNotices({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const [later, setLater] = useState(false);
  const seen = useRulesSeen(organisation.id);
  const name = organisation.name;
  const changedAt = organisation.signInRules.changedAt;
  const standing = useTwoFactorStanding(organisation);
  const gate = useRef<HTMLDivElement>(null);
  const changed = useRef<HTMLDivElement>(null);
  const land = useFocusOnceShown();

  function close(notice: HTMLElement | null, closing: () => void): void {
    const next = afterNotice(notice);
    closing();
    land(() => next);
  }

  // Past the deadline the whole page says it instead (TwoFactorOverdue).
  if (standing === 'overdue') return null;

  return (
    <>
      {standing === 'due' && organisation.twoFactorDue != null && (
        <div className="notice notice-rule notice-attention" role="status">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <div className="notice-words" data-notice-lead tabIndex={-1}>
              <p>
                {t('signInRules.dueBody', {
                  organisation: name,
                  deadline: organisation.twoFactorDue.written,
                })}
              </p>
            </div>
            <div className="notice-actions">
              <Link className="button" to="/app/account/security">
                {t('signInRules.dueSetUp')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {organisation.readOnlyUntilLinked && (
        <div className="notice notice-rule notice-attention" role="status">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <div className="notice-words" data-notice-lead tabIndex={-1}>
              <p className="notice-title">{t('signInRules.unlinkedTitle')}</p>
              <p>{t('signInRules.unlinkedBody', { organisation: name })}</p>
            </div>
            <div className="notice-actions">
              <Link className="button" to="/app/account/security">
                {t('signInRules.unlinkedLink')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {organisation.withheldUntilTwoFactor.length > 0 && !later && (
        <div className="notice notice-rule notice-quiet" role="status" ref={gate}>
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <div className="notice-body">
            <div className="notice-words" data-notice-lead tabIndex={-1}>
              <p className="notice-title">{t('signInRules.gateTitle', { organisation: name })}</p>
              <p>{t('signInRules.gateBody', { organisation: name })}</p>
            </div>
            <div className="notice-actions">
              <Link className="button" to="/app/account/security">
                {t('signInRules.gateTurnOn')}
              </Link>
              <button
                className="link-button notice-text-action"
                type="button"
                onClick={() => close(gate.current, () => setLater(true))}
              >
                {t('signInRules.gateLater')}
              </button>
            </div>
          </div>
        </div>
      )}

      {changedAt != null && changedAt !== seen && (
        <div className="notice notice-rule notice-quiet" role="status" ref={changed}>
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <div className="notice-body">
            <div className="notice-words" data-notice-lead tabIndex={-1}>
              <p className="notice-title">{t('signInRules.changedTitle')}</p>
              <p>
                {t('signInRules.changedBody', {
                  organisation: name,
                  day: formatDay(changedAt, dateLocale()),
                })}
              </p>
            </div>
            <div className="notice-actions">
              <Link className="button" to="/app/settings/sign-in-rules">
                {t('signInRules.changedSee')}
              </Link>
              <button
                className="link-button notice-text-action"
                type="button"
                onClick={() => close(changed.current, () => markRulesSeen(organisation))}
              >
                {t('signInRules.changedClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
