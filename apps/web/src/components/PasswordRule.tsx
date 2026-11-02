import { PASSWORD_MINIMUM_LENGTH } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

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
