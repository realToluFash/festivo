import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LanguagePicker } from '../../components/LanguagePicker.tsx';
import { usePageTitle } from '../../pageTitle.ts';

export function Home() {
  const { t } = useTranslation();

  // The heading is the tagline, so the tab names Soirely alone.
  usePageTitle(t('app.name'));

  return (
    <div className="public">
      <header className="public-header">
        <span className="brand">{t('app.name')}</span>
        <LanguagePicker />
      </header>
      <main id="content" className="public-main">
        <h1>{t('public.tagline')}</h1>
        <p>{t('public.body')}</p>
        <nav className="public-actions">
          <Link className="button button-primary" to="/register">
            {t('public.getStarted')}
          </Link>
          <Link className="button" to="/status">
            {t('status.title')}
          </Link>
        </nav>
      </main>
    </div>
  );
}
