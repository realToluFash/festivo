import { useTranslation } from 'react-i18next';

/**
 * The shell's loading state.
 *
 * Here rather than per screen so a slow read never leaves an empty area with
 * no explanation — the failure mode where a person cannot tell a loading page
 * from a broken one.
 */
export function Pending() {
  const { t } = useTranslation();

  return (
    <div className="pending" role="status" aria-live="polite">
      <span className="pending-spinner" aria-hidden="true" />
      {t('pending.loading')}
    </div>
  );
}
