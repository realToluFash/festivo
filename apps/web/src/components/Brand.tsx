import { useTranslation } from 'react-i18next';

import lockupUrl from '../brand/lockup.svg';
import wordmarkUrl from '../brand/wordmark.svg';

/** The drawing is decorative: a screen reader reads the hidden name, once. */
export function Brand({ lockup = false }: { lockup?: boolean }) {
  const { t } = useTranslation();
  const wordmark = <img src={wordmarkUrl} alt="" />;

  return (
    <span className={lockup ? 'brand brand-lockup' : 'brand'}>
      {lockup ? (
        <picture>
          <source media="(width > 40rem)" srcSet={lockupUrl} />
          {wordmark}
        </picture>
      ) : (
        wordmark
      )}
      <span className="visually-hidden">{t('app.name')}</span>
    </span>
  );
}
