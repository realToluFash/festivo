import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { AccountSections } from '../../../components/AccountSections.tsx';
import { Pending } from '../../../components/Pending.tsx';

type Channel = 'push' | 'email';

type Grid =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; settings: NotificationSetting[] };

const ORDER: readonly NotificationCategory[] = [
  'guest_replies',
  'messages',
  'event_day',
  'event_changes',
  'money',
  'account_security',
];

const QUIET_HOURS = { start: 21, end: 8 };
const USAGE_THRESHOLDS = { low: 0.8, high: 1 };

/** Notification settings (sc-3980): six categories against Push and Email, each switch saved as it changes. */
export function NotificationSettings() {
  const { t } = useTranslation();
  const [grid, setGrid] = useState<Grid>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [said, setSaid] = useState('');
  const [unsaved, setUnsaved] = useState<{ category: NotificationCategory; channel: Channel }>();
  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied';

  useEffect(() => {
    let current = true;

    api.notificationSettings().then(
      (settings) => {
        if (current) setGrid({ status: 'loaded', settings });
      },
      () => {
        if (current) setGrid({ status: 'failed' });
      },
    );

    return () => {
      current = false;
    };
  }, [attempt]);

  async function change(category: NotificationCategory, channel: Channel, on: boolean) {
    if (grid.status !== 'loaded') return;

    const before = grid.settings;
    setUnsaved(undefined);
    setSaid('');
    setGrid({
      status: 'loaded',
      settings: before.map((setting) =>
        setting.category === category
          ? { ...setting, [channel]: { ...setting[channel], on } }
          : setting,
      ),
    });

    try {
      const settings = await api.setNotificationSetting(category, channel, on);
      setGrid({ status: 'loaded', settings });
      setSaid(t('notificationSettings.saved'));
    } catch {
      setGrid({ status: 'loaded', settings: before });
      setUnsaved({ category, channel });
    }
  }

  return (
    <div className="account">
      <div className="account-heading">
        <h1>{t('notificationSettings.title')}</h1>
      </div>

      <AccountSections />

      <div className="visually-hidden" aria-live="polite">
        {said}
      </div>

      {grid.status === 'loading' && <Pending />}

      {grid.status === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <p className="notice-title">{t('notificationSettings.couldNotLoad')}</p>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setGrid({ status: 'loading' });
              setAttempt((tries) => tries + 1);
            }}
          >
            {t('notificationSettings.tryAgain')}
          </button>
        </div>
      )}

      {grid.status === 'loaded' && (
        <section className="card notification-settings">
          {blocked && (
            <p className="notification-settings-blocked" role="note">
              <svg
                className="bell-mark"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
              >
                <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
                <path d="M10 20.5a2 2 0 0 0 4 0" />
                <path d="M4 4l16 16" />
              </svg>
              {t('notificationSettings.pushBlocked')}
            </p>
          )}

          <table className="notification-settings-grid">
            <thead>
              <tr>
                <td />
                <th scope="col">{t('notificationSettings.push')}</th>
                <th scope="col">{t('notificationSettings.email')}</th>
              </tr>
            </thead>
            <tbody>
              {ORDER.map((category) => {
                const setting = grid.settings.find((row) => row.category === category);
                if (setting == null) return null;

                const name = t(`notificationSettings.category.${category}`);
                const noteId = `notification-note-${category}`;
                const failed = unsaved?.category === category ? unsaved.channel : null;

                return (
                  <tr key={category}>
                    <th scope="row">
                      <span className="notification-settings-name">{name}</span>
                      <span id={noteId} className="notification-settings-note">
                        {t(`notificationSettings.note.${category}`, usageThresholds())}
                      </span>
                      {failed != null && (
                        <span className="field-error">
                          {t(
                            failed === 'push'
                              ? 'notificationSettings.pushNotSaved'
                              : 'notificationSettings.emailNotSaved',
                          )}
                        </span>
                      )}
                    </th>
                    {(['push', 'email'] as const).map((channel) => (
                      <td key={channel}>
                        <label className="notification-switch">
                          <input
                            type="checkbox"
                            role="switch"
                            checked={setting[channel].on}
                            disabled={!setting[channel].switchable}
                            aria-label={t('notificationSettings.switchName', {
                              category: name,
                              channel: t(`notificationSettings.${channel}`),
                            })}
                            aria-describedby={noteId}
                            onChange={(event) =>
                              void change(category, channel, event.currentTarget.checked)
                            }
                          />
                          <span aria-hidden="true">
                            {setting[channel].on
                              ? t('notificationSettings.on')
                              : t('notificationSettings.off')}
                          </span>
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="muted">{t('notificationSettings.quietHours', quietHours())}</p>
        </section>
      )}
    </div>
  );
}

function quietHours(): { start: string; end: string } {
  const time = new Intl.DateTimeFormat(currentLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const at = (hour: number) => time.format(new Date(2000, 0, 1, hour));

  return { start: at(QUIET_HOURS.start), end: at(QUIET_HOURS.end) };
}

function usageThresholds(): { low: string; high: string } {
  const percent = new Intl.NumberFormat(currentLocale(), { style: 'percent' });

  return { low: percent.format(USAGE_THRESHOLDS.low), high: percent.format(USAGE_THRESHOLDS.high) };
}
