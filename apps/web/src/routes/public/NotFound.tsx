import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFound() {
  const { t } = useTranslation();

  return (
    <main id="content" className="public-main">
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.body')}</p>
      <Link className="button" to="/">
        {t('notFound.home')}
      </Link>
    </main>
  );
}
