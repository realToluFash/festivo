import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { TitleRow } from '../../components/SettingsParts.tsx';
import { useDeskTop } from '../../deskTop.ts';

export function Forbidden() {
  const { t } = useTranslation();
  const desk = useDeskTop();

  return (
    <div className="panel" role="alert">
      {desk.bell == null ? (
        <h1>{t('forbidden.title')}</h1>
      ) : (
        <TitleRow title={t('forbidden.title')} />
      )}
      <p>{t('forbidden.body')}</p>
      <Link className="button" to="/app">
        {t('forbidden.back')}
      </Link>
    </div>
  );
}
