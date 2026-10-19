import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useSession } from '../../session.ts';

/** A permission kept back by the organisation's two-factor rule names the rule, not a missing grant; the notice above offers the set-up (sc-69). */
export function Forbidden({ permission }: { permission?: string }) {
  const { t } = useTranslation();
  const organisation = useSession().organisation;

  if (permission != null && organisation?.withheldUntilTwoFactor.includes(permission) === true) {
    return (
      <div className="panel" role="alert">
        <h1>{t('signInRules.gateTitle', { organisation: organisation.name })}</h1>
        <p>{t('signInRules.gateBody', { organisation: organisation.name })}</p>
        <Link className="button" to="/app">
          {t('forbidden.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="panel" role="alert">
      <h1>{t('forbidden.title')}</h1>
      <p>{t('forbidden.body')}</p>
      <Link className="button" to="/app">
        {t('forbidden.back')}
      </Link>
    </div>
  );
}
