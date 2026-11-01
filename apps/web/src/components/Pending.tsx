import { useTranslation } from 'react-i18next';

import { SKELETON_AFTER_MS, useShownAfter } from '../shownAfter.ts';

/**
 * The shell's loading state.
 *
 * Here rather than per screen so a slow read never leaves an empty area with
 * no explanation — the failure mode where a person cannot tell a loading page
 * from a broken one.
 *
 * `late` is the signed-in shell reading the session: nothing for a second,
 * then the words in the middle of the window, with no frame.
 */
export function Pending({ late = false }: { late?: boolean }) {
  const { t } = useTranslation();
  const shown = useShownAfter(late ? SKELETON_AFTER_MS : 0);

  return (
    <div className={late ? 'pending pending-centred' : 'pending'} role="status" aria-live="polite">
      {(shown || !late) && (
        <>
          <span className="pending-spinner" aria-hidden="true" />
          {t('pending.loading')}
        </>
      )}
    </div>
  );
}
