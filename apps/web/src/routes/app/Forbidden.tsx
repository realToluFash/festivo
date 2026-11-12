import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { TextAction, TitleRow } from '../../components/SettingsParts.tsx';
import { useDeskTop } from '../../deskTop.ts';

export function Forbidden() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const desk = useDeskTop();

  if (desk.bell != null)
    return (
      <div className="desk desk-page">
        <div className="desk-column" role="alert">
          <TitleRow title={t('forbidden.title')} />
          <p className="desk-line">{t('forbidden.body')}</p>
          <TextAction label={t('forbidden.back')} onClick={() => void navigate('/app')} />
        </div>
      </div>
    );

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
