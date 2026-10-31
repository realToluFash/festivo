import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LanguagePicker } from '../../components/LanguagePicker.tsx';
import { usePageTitle } from '../../pageTitle.ts';

export function Home() {
  const { t } = useTranslation();

  // The heading is the tagline, so the tab names Soirely alone.
  usePageTitle(t('app.name'));

  return (
    <div className="front">
      <header className="front-header">
        <span className="brand">{t('app.name')}</span>
        <LanguagePicker pill />
        <Link className="button" to="/sign-in">
          {t('public.signIn')}
        </Link>
      </header>
      <main id="content" className="front-main">
        <h1>{t('public.tagline')}</h1>
        <p>{t('public.body')}</p>
        <Link className="button button-primary" to="/register">
          {t('public.getStarted')}
        </Link>
      </main>
      <footer className="front-footer">
        <Link className="link-button link-button-quiet" to="/status">
          {t('status.title')}
        </Link>
      </footer>
    </div>
  );
}
