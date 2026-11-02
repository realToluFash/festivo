import { useTranslation } from 'react-i18next';

/** A figure the product has no data for yet: its label, then Coming soon in its place, never a number (sc-22103). */
export function Placeholder({
  label,
  labelHidden = false,
  labelClass = 'placeholder-label',
}: {
  label: string;
  labelHidden?: boolean;
  labelClass?: string;
}) {
  const { t } = useTranslation();

  return (
    <span className="placeholder">
      <span className={labelHidden ? 'visually-hidden' : labelClass}>{label}</span>{' '}
      <span className="placeholder-soon">{t('events.comingSoon')}</span>
    </span>
  );
}
