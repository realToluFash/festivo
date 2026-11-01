import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import {
  NOTIFICATION_CATEGORY_ORDER,
  type SettingChannel,
  quietHoursIn,
  settingFlipped,
  usageThresholdsIn,
} from '@soirely/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { AccountHeader } from '../../../components/AccountHeader.tsx';
import { FieldError } from '../../../components/FieldError.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';

type Channel = SettingChannel;

type Grid =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; settings: NotificationSetting[] };

/** Notification settings (sc-3980): six categories against Push and Email, each switch saved as it changes. */
export function NotificationSettings() {
  const { t } = useTranslation();
  const [grid, setGrid] = useState<Grid>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [said, setSaid] = useState('');
  const [unsaved, setUnsaved] = useState<{ category: NotificationCategory; channel: Channel }>();
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
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
    const key = `${category}.${channel}`;
    if (grid.status !== 'loaded' || saving.has(key)) return;

    setSaving((busy) => new Set(busy).add(key));
    setUnsaved(undefined);
    setSaid('');
    setGrid({ status: 'loaded', settings: settingFlipped(grid.settings, category, channel, on) });

    let saved: boolean;
    try {
      const settings = await api.setNotificationSetting(category, channel, on);
      saved = settings.find((row) => row.category === category)?.[channel].on ?? on;
      setSaid(t('notificationSettings.saved'));
    } catch {
      saved = !on;
      setUnsaved({ category, channel });
    }

    setGrid((current) =>
      current.status === 'loaded'
        ? { status: 'loaded', settings: settingFlipped(current.settings, category, channel, saved) }
        : current,
    );
    setSaving((busy) => {
      const left = new Set(busy);
      left.delete(key);
      return left;
    });
  }

  return (
    <div className="account">
      <AccountHeader title={t('notificationSettings.title')} />

      <div className="visually-hidden" aria-live="polite">
        {said}
      </div>

      {grid.status === 'loading' && (
        <Skeleton words={t('pending.loading')} shape="rows" rowHeight={56} />
      )}

      {grid.status === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('notificationSettings.couldNotLoad')}</p>
            <p className="notice-action">
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
            </p>
          </div>
        </div>
      )}

      {grid.status === 'loaded' && (
        <section className="card notification-settings arrives">
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
                <th scope="col" className="notification-settings-channel">
                  {t('notificationSettings.push')}
                </th>
                <th scope="col" className="notification-settings-channel">
                  {t('notificationSettings.email')}
                </th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_CATEGORY_ORDER.map((category) => {
                const setting = grid.settings.find((row) => row.category === category);
                if (setting == null) return null;

                const name = t(`notificationSettings.category.${category}`);
                const noteId = `notification-note-${category}`;
                const errorId = `notification-error-${category}`;
                const failed = unsaved?.category === category ? unsaved.channel : null;

                return (
                  <tr key={category}>
                    <th scope="row">
                      <span className="notification-settings-name">{name}</span>
                      <span id={noteId} className="notification-settings-note">
                        {t(
                          `notificationSettings.note.${category}`,
                          usageThresholdsIn(currentLocale()),
                        )}
                      </span>
                      {failed != null && (
                        <FieldError
                          id={errorId}
                          message={t(
                            failed === 'push'
                              ? 'notificationSettings.pushNotSaved'
                              : 'notificationSettings.emailNotSaved',
                          )}
                        />
                      )}
                    </th>
                    {(['push', 'email'] as const).map((channel) => (
                      <td key={channel} className="notification-settings-channel">
                        <label className="notification-settings-switch">
                          <input
                            type="checkbox"
                            role="switch"
                            checked={setting[channel].on}
                            disabled={!setting[channel].switchable}
                            aria-busy={saving.has(`${category}.${channel}`)}
                            aria-disabled={saving.has(`${category}.${channel}`)}
                            aria-label={t('notificationSettings.switchName', {
                              category: name,
                              channel: t(`notificationSettings.${channel}`),
                            })}
                            aria-describedby={failed === channel ? `${noteId} ${errorId}` : noteId}
                            onChange={(event) =>
                              void change(category, channel, event.currentTarget.checked)
                            }
                          />
                          <SwitchPill
                            on={setting[channel].on}
                            words={{
                              on: t('notificationSettings.on'),
                              off: t('notificationSettings.off'),
                            }}
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="notification-settings-footer">
            {t('notificationSettings.quietHours', quietHoursIn(currentLocale()))}
          </p>
        </section>
      )}
    </div>
  );
}

/** The app's `OnOffSwitch` drawn over the checkbox: its dot and its word, as wide as the longer word. */
function SwitchPill({ on, words }: { on: boolean; words: { on: string; off: string } }) {
  return (
    <span className="notification-settings-switch-pill" aria-hidden="true">
      <span className="notification-settings-switch-track">
        <span className="notification-settings-switch-dot" />
      </span>
      <span className="notification-settings-switch-words">
        <span>{on ? words.on : words.off}</span>
        <span className="notification-settings-switch-reserved">{on ? words.off : words.on}</span>
      </span>
    </span>
  );
}
