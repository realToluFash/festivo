import type { Membership } from '@soirely/api-client';
import { formatDay } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { SECURITY, securityOn } from '../routes/app/settings/signInRulesDesk.ts';
import { markRulesSeen, useRulesSeen } from '../signInRulesSeen.ts';
import { afterNotice, useFocusOnceShown } from '../stepFocus.ts';
import { useTwoFactorStanding } from '../twoFactorStanding.ts';
import { RuleNoticeBox } from './RuleNoticeBox.tsx';

/** What the organisation's sign-in rules ask of this member (sc-69, sc-609), named after the organisation. */
export function SignInRulesNotices({
  organisation,
  later,
  onLater,
}: {
  organisation: Membership;
  later: boolean;
  onLater: () => void;
}) {
  const { t } = useTranslation();
  const seen = useRulesSeen(organisation.id);
  const name = organisation.name;
  const changedAt = organisation.signInRules.changedAt;
  const standing = useTwoFactorStanding(organisation);
  const land = useFocusOnceShown();

  function close(closing: () => void): (box: HTMLElement | null) => void {
    return (box) => {
      const next = afterNotice(box);
      closing();
      land(() => next);
    };
  }

  // Past the deadline the whole page says it instead (TwoFactorOverdue).
  if (standing === 'overdue') return null;

  return (
    <>
      {standing === 'due' && organisation.twoFactorDue != null && (
        <RuleNoticeBox
          words={{
            kind: 'attention',
            title: t('signInRules.dueBody', {
              organisation: name,
              deadline: organisation.twoFactorDue.written,
            }),
            body: null,
            step: { label: t('signInRules.dueSetUp'), to: SECURITY, state: securityOn('turnOn') },
            close: null,
          }}
        />
      )}

      {organisation.readOnlyUntilLinked && (
        <RuleNoticeBox
          words={{
            kind: 'attention',
            title: t('signInRules.unlinkedTitle'),
            body: t('signInRules.unlinkedBody', { organisation: name }),
            step: { label: t('signInRules.unlinkedLink'), to: SECURITY },
            close: null,
          }}
        />
      )}

      {organisation.withheldUntilTwoFactor.length > 0 && !later && (
        <RuleNoticeBox
          words={{
            kind: 'quiet',
            title: t('signInRules.gateTitle', { organisation: name }),
            body: t('signInRules.gateBody', { organisation: name }),
            step: { label: t('signInRules.gateTurnOn'), to: SECURITY, state: securityOn('turnOn') },
            close: t('signInRules.gateLater'),
          }}
          onClose={close(onLater)}
        />
      )}

      {changedAt != null && changedAt !== seen && (
        <RuleNoticeBox
          words={{
            kind: 'quiet',
            title: t('signInRules.changedTitle'),
            body: t('signInRules.changedBody', {
              organisation: name,
              day: formatDay(changedAt, dateLocale()),
            }),
            step: { label: t('signInRules.changedSee'), to: '/app/settings/sign-in-rules' },
            close: t('signInRules.changedClose'),
          }}
          onClose={close(() => markRulesSeen(organisation))}
        />
      )}
    </>
  );
}
