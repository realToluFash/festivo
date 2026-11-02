import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function Forbidden() {
  const { t } = useTranslation();

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
