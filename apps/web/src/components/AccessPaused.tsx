import type { Membership, PausedOrganisation } from '@soirely/api-client';
import { pausedReasonKey } from '@soirely/domain';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** In place of every page of an organisation the account's access to is paused in (sc-564). */
export function AccessPaused({
  paused,
  other,
  onSwitch,
}: {
  paused: PausedOrganisation;
  other: Membership | null;
  onSwitch: (to: Membership) => void;
}) {
  const { t } = useTranslation();
  const { suspension } = paused;
  const named = { organisation: paused.name, domain: suspension.domain ?? '' };
  const addressGone = suspension.reason === 'address_gone';

  return (
    <section className="card settings-card access-paused" aria-labelledby="paused-title">
      <p>
        <span className="members-state" data-state="suspended">
          {t('accessPaused.badge')}
        </span>
      </p>
      <h1 id="paused-title">{t(pausedReasonKey(suspension.reason), named)}</h1>
      <p className="muted">{t('accessPaused.since', { when: suspension.since.written })}</p>
      <p>{t('accessPaused.kept', named)}</p>
      <p>{t('accessPaused.untouched')}</p>
      <div className="notice notice-attention" role="note">
        <span className="mark mark-attention" aria-hidden="true">
          !
        </span>
        <p>{t('accessPaused.removedBy', { ...named, when: suspension.removesAt.written })}</p>
      </div>
      <h2>{t('accessPaused.nextTitle')}</h2>
      <p>
        {t(addressGone ? 'accessPaused.nextAddressGone' : 'accessPaused.nextNothingNeeded', named)}
      </p>
      <div className="actions">
        {addressGone && (
          <Link className="button button-primary" to="/app/account">
            {t('accessPaused.accountSettings')}
          </Link>
        )}
        {other != null && (
          <button className="button" type="button" onClick={() => onSwitch(other)}>
            {t('accessPaused.switch')}
          </button>
        )}
      </div>
    </section>
  );
}
