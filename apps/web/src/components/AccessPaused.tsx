import type { Membership, PausedOrganisation } from '@soirely/api-client';
import { pausedReasonKey, pausedSwitch } from '@soirely/domain';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { pageTitle, usePageTitle } from '../pageTitle.ts';
import { Notice } from './Notice.tsx';
import { PausedOwnerClaim } from './PausedOwnerClaim.tsx';
import './desk.css';

type Other = Pick<Membership, 'id' | 'name'>;

/** In place of every page of an organisation the account's access to is paused in (sc-564). */
export function AccessPaused<T extends Other>({
  paused,
  others,
  account = '/app/account',
  onSwitch,
  onChoose,
}: {
  paused: PausedOrganisation;
  others: readonly T[];
  account?: string;
  onSwitch: (to: T) => void;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const { suspension } = paused;
  const named = { organisation: paused.name, domain: suspension.domain ?? '' };
  const addressGone = suspension.reason === 'address_gone';
  const switchTo = pausedSwitch(others);

  usePageTitle(pageTitle(t, [t('accessPaused.badge'), paused.name]));

  return (
    <section className="sw-paused access-paused" aria-labelledby="paused-title">
      <span className="sw-paused-chip">{t('accessPaused.badge')}</span>
      <h1 id="paused-title">{t(pausedReasonKey(suspension.reason), named)}</h1>
      <p className="sw-paused-since">
        {t('accessPaused.since', { when: suspension.since.written })}
      </p>
      <p>{t('accessPaused.kept', named)}</p>
      <p>{t('accessPaused.untouched')}</p>
      {suspension.onlyOwner ? (
        <Notice kind="quiet" standing>
          {t('accessPaused.stillOnlyOwner', named)}
        </Notice>
      ) : (
        suspension.removesAt != null && (
          <Notice kind="attention" standing>
            {t('accessPaused.removedBy', { ...named, when: suspension.removesAt.written })}
          </Notice>
        )
      )}
      {paused.ownerClaim != null && (
        <PausedOwnerClaim
          organisationId={paused.id}
          organisation={paused.name}
          claim={paused.ownerClaim}
        />
      )}
      <h2>{t('accessPaused.nextTitle')}</h2>
      <p>
        {t(addressGone ? 'accessPaused.nextAddressGone' : 'accessPaused.nextNothingNeeded', named)}
      </p>
      <div className="sw-actions is-paused">
        {addressGone && (
          <Link className="sw-button is-primary" to={account}>
            {t('accessPaused.accountSettings')}
          </Link>
        )}
        {switchTo != null && (
          <button
            className="sw-button is-ghost"
            type="button"
            onClick={() => (switchTo === 'switcher' ? onChoose() : onSwitch(switchTo))}
          >
            {t('accessPaused.switch')}
          </button>
        )}
      </div>
    </section>
  );
}
