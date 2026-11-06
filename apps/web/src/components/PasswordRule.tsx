import { PASSWORD_MINIMUM_LENGTH } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { Tick } from './Onboarding.tsx';

/** The length rule, said before submit and marked as it is met, wherever a password is chosen. */
export function PasswordRule({ met, id }: { met: boolean; id: string }) {
  const { t } = useTranslation();

  return (
    <div className="rule-inset" id={id}>
      <p className="rule-heading">{t('register.ruleHeading')}</p>
      <div className="rule">
        <span className={met ? 'rule-mark rule-mark-met' : 'rule-mark'} aria-hidden="true">
          {met ? '✓' : ''}
        </span>
        <span className="rule-text">
          {t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH })}
        </span>
        <span className={met ? 'rule-state rule-state-met' : 'rule-state'}>
          {met ? t('register.ruleMet') : t('register.ruleNotYet')}
        </span>
      </div>
      <p className="rule-note">{t('register.ruleNote')}</p>
    </div>
  );
}

/** The same rule on one line under the field, as the desktop frame draws it, ticked once it is met. */
export function PasswordRuleLine({ met, id }: { met: boolean; id: string }) {
  const { t } = useTranslation();

  return (
    <div className="auth-rule" id={id}>
      <p className={met ? 'auth-rule-line auth-rule-met' : 'auth-rule-line'}>
        {met ? <Tick /> : <span className="auth-ring" aria-hidden="true" />}
        {t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH })}
        {/* The mark's shape says it to the eye; the word says it to a screen reader. */}
        <span className="visually-hidden">
          {met ? t('register.ruleMet') : t('register.ruleNotYet')}
        </span>
      </p>
      <p className="auth-rule-note">{t('register.ruleNote')}</p>
    </div>
  );
}
