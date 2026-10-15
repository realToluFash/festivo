import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/**
 * The devices signed in to this account, drawn from `Security-*.dc.html` and
 * NOT yet wired: the rows are the artboard's own sample values, and
 * `SAMPLE_DEVICES` is the name to grep for when `GET /api/auth/sessions`
 * replaces them.
 *
 * A card on this page rather than a screen of its own. One row per session,
 * never more than a handful, and idle rows expire, so it cannot grow into
 * something needing its own address — and somebody who finds a stranger in
 * this list wants to change their password and turn on two-factor in the same
 * minute. Both of those are cards on this page, which is why this is too.
 */
interface Device {
  id: string;
  name: string;
  here: boolean;
  started: string;
  ip: string;
  used: string;
  expires: string;
}

/** The signed-in person's own address, until the session carries it. */
const SAMPLE_EMAIL = 'folake@ire.events';

const SAMPLE_DEVICES: readonly Device[] = [
  {
    id: 'a',
    name: 'Chrome on macOS',
    here: true,
    started: 'Thursday, Oct 15 at 08:40',
    ip: '102.89.33.14',
    used: 'Thursday, Oct 15 at 08:40',
    expires: 'Saturday, Nov 14',
  },
  {
    id: 'b',
    name: 'Safari on iPhone',
    here: false,
    started: 'Tuesday, Oct 13 at 17:05',
    ip: '102.89.33.14',
    used: 'Thursday, Oct 15 at 07:55',
    expires: 'Saturday, Nov 14',
  },
  {
    id: 'c',
    name: 'Chrome on Windows',
    here: false,
    started: 'Monday, Oct 5 at 11:22',
    ip: '197.210.78.3',
    used: 'Wednesday, Oct 7 at 18:30',
    expires: 'Friday, Nov 6',
  },
];

type View =
  { kind: 'list' } | { kind: 'confirm'; device: Device } | { kind: 'ended'; name: string };

export function Security() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>({ kind: 'list' });
  const devices = SAMPLE_DEVICES;

  return (
    <div className="account">
      <div className="account-heading">
        <h1>{t('account.title')}</h1>
        <p>{SAMPLE_EMAIL}</p>
      </div>

      <section className="card" aria-labelledby="devices-title">
        {view.kind === 'confirm' ? (
          <Confirm
            device={view.device}
            onKeep={() => setView({ kind: 'list' })}
            onEnd={() => setView({ kind: 'ended', name: view.device.name })}
          />
        ) : (
          <>
            <div className="card-heading">
              <h2 id="devices-title">{t('devices.title')}</h2>
              <span className="card-count">{t('devices.count', { count: devices.length })}</span>
            </div>

            <p>{t('devices.intro')}</p>

            {view.kind === 'ended' && (
              <div className="status-done" role="status">
                <span className="mark mark-done" aria-hidden="true">
                  ✓
                </span>
                {/* Two sentences rather than one interpolated into the other,
                    so the delay reads identically wherever it appears and
                    sc-117 deletes it from one key. */}
                <p>
                  {t('devices.ended', { name: view.name })} {t('devices.delay')}
                </p>
              </div>
            )}

            <ul className="device-list" aria-label={t('devices.listLabel')}>
              {devices.map((device) => (
                <li className="device" key={device.id}>
                  <div className="device-detail">
                    <div className="device-name">
                      <span>{device.name}</span>
                      {/* A dot and the words, never the dot alone. */}
                      {device.here && (
                        <span className="pill-here">
                          <span className="pill-dot" aria-hidden="true" />
                          {t('devices.here')}
                        </span>
                      )}
                    </div>
                    <p className="device-meta">
                      {t('devices.signedInFrom', { started: device.started, ip: device.ip })}
                    </p>
                    <p className="device-meta">
                      {t('devices.expiry', {
                        usage: device.here
                          ? t('devices.inUseNow')
                          : t('devices.lastUsed', { used: device.used }),
                        expires: device.expires,
                      })}
                    </p>
                  </div>

                  {/* Your own signs out at once and lands on sign-in. Another
                      device opens a check first: you cannot see it, the row is
                      only what it claimed, and it may be mid-event. */}
                  {device.here ? (
                    <Link className="button" to="/sign-in?signed-out">
                      {t('devices.signOut')}
                    </Link>
                  ) : (
                    <button
                      className="button"
                      type="button"
                      onClick={() => setView({ kind: 'confirm', device })}
                    >
                      {t('devices.signOut')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Confirm({
  device,
  onEnd,
  onKeep,
}: {
  device: Device;
  onEnd: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <h2 id="devices-title">{t('devices.checkTitle', { name: device.name })}</h2>
      <p>{t('devices.checkBody', { started: device.started, ip: device.ip, used: device.used })}</p>

      <div className="notice notice-attention">
        <span className="mark mark-attention" aria-hidden="true">
          !
        </span>
        <div className="notice-body">
          <p className="notice-title">{t('devices.checkWarning')}</p>
          <p>
            {t('devices.delay')} {t('devices.passwordAdvice')}
          </p>
        </div>
      </div>

      <div className="actions">
        <button className="button button-dark" type="button" onClick={onEnd}>
          {t('devices.end')}
        </button>
        <button className="button" type="button" onClick={onKeep}>
          {t('devices.keep')}
        </button>
      </div>
    </>
  );
}
