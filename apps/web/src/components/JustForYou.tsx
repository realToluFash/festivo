import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Alert, Lead } from './EventPageParts.tsx';
import { Switch } from './GeneralParts.tsx';
import { Head, RowWords, TextAction } from './SettingsParts.tsx';

/** An event's page, Just for you (sc-3980): the bell's row and its Mute switch, on while this person has muted the event. */
export function JustForYou({
  muted,
  loaded,
  failed,
  busy = false,
  settings,
  onRetry,
  onChange,
}: {
  muted: boolean;
  loaded: boolean;
  /** The last change was not saved. */
  failed: boolean;
  busy?: boolean;
  settings: string;
  onRetry: () => void;
  onChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <section className="desk-block" aria-labelledby={`${id}-heading`}>
      <Head title={<span id={`${id}-heading`}>{t('eventMute.heading')}</span>} />
      {loaded ? (
        <>
          <div className="desk-row">
            <Lead name="bell" />
            <RowWords title={t('notifications.muteEvent')} lines={[t('eventMute.note')]} />
            <Switch
              on={muted}
              label={t('notifications.muteEvent')}
              words={{ on: t('notificationSettings.on'), off: t('notificationSettings.off') }}
              told={`${id}-note`}
              busy={busy}
              onChange={onChange}
            />
          </div>
          <span id={`${id}-note`} className="desk-unseen">
            {t('eventMute.note')}
          </span>
          {failed && <Alert>{t('notifications.muteNotSaved')}</Alert>}
        </>
      ) : (
        <div className="ev-unknown">
          <p className="desk-line">{t('notifications.muteNotLoaded')}</p>
          <TextAction label={t('notifications.tryAgain')} onClick={onRetry} />
        </div>
      )}
      <Link className="desk-text" to={settings}>
        {t('notifications.settings')}
      </Link>
    </section>
  );
}
