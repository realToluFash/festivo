import { useTranslation } from 'react-i18next';

const BROKEN = [
  'm18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71',
  'm5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71',
  'M8 2v3',
  'M2 8h3',
  'M16 22v-3',
  'M22 16h-3',
];

/** Says what probably happened and what to do: ask for another link. An unknown, a replaced and a malformed link all land here. */
export function InvalidInvitation() {
  const { t } = useTranslation();

  return (
    <div className="gp-alone-wrap">
      <div className="gp-alone" role="alert">
        <span className="gp-alone-mark" aria-hidden="true">
          <svg
            className="gp-line"
            width={26}
            height={26}
            viewBox="0 0 24 24"
            focusable="false"
            strokeWidth={2}
          >
            {BROKEN.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
        </span>
        <h1 className="gp-alone-title">{t('guest.invalidTitle')}</h1>
        <p>{t('guest.invalidBody')}</p>
      </div>
    </div>
  );
}
