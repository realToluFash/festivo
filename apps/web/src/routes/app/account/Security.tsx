import { type DeviceSession } from '@soirely/api-client';
import { formatDay, formatTimeOfDay, readableAgent, thisDeviceFirst } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { Pending } from '../../../components/Pending.tsx';
import { TwoFactorCard } from './TwoFactorCard.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { forgetSession, useSession } from '../../../session.ts';
import { currentSessionId } from '../../../tokens.ts';

type Devices =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; sessions: DeviceSession[] };

export function Security() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSession();

  const [devices, setDevices] = useState<Devices>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState<DeviceSession | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const [endFailed, setEndFailed] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  // The loading state belongs to the event that asks for a reload, not to the effect.
  useEffect(() => {
    let live = true;

    api
      .sessions()
      .then((sessions) => {
        if (live) setDevices({ kind: 'ready', sessions });
      })
      .catch(() => {
        if (live) setDevices({ kind: 'failed' });
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  async function end(device: DeviceSession): Promise<void> {
    setEndFailed(false);

    try {
      await api.endSession(device.id);
    } catch {
      setChecking(null);
      setEndFailed(true);

      return;
    }

    setChecking(null);
    setEnded(nameOf(device, t));
    setDevices((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', sessions: current.sessions.filter((s) => s.id !== device.id) }
        : current,
    );
  }

  async function endHere(): Promise<void> {
    await api.signOut();
    forgetSession();
    navigate('/sign-in');
  }

  return (
    <div className="account">
      <div className="account-heading">
        <h1>{t('account.title')}</h1>
        <p>{session.email}</p>
      </div>

      <TwoFactorCard email={session.email} onBusy={setSettingUp} />

      {/* Not rendered at all during setup: `.card` sets a display, which `hidden` cannot beat. */}
      {!settingUp && (
        <section className="card" aria-labelledby="devices-title">
          {checking == null ? (
            <>
              <div className="card-heading">
                <h2 id="devices-title">{t('devices.title')}</h2>
                {devices.kind === 'ready' && (
                  <span className="card-count">
                    {t('devices.count', { count: devices.sessions.length })}
                  </span>
                )}
              </div>

              <p>{t('devices.intro')}</p>

              {ended != null && (
                <div className="status-done" role="status">
                  <span className="mark mark-done" aria-hidden="true">
                    ✓
                  </span>
                  {/* Two sentences rather than one interpolated into the other,
                    so the delay reads identically wherever it appears and
                    sc-117 deletes it from one key. */}
                  <p>
                    {t('devices.ended', { name: ended })} {t('devices.delay')}
                  </p>
                </div>
              )}

              {endFailed && (
                <div className="notice notice-broken" role="alert">
                  <span className="mark mark-broken" aria-hidden="true">
                    ✕
                  </span>
                  <div className="notice-body">
                    <p className="notice-title">{t('devices.endFailedTitle')}</p>
                    <p>{t('devices.endFailedBody')}</p>
                  </div>
                </div>
              )}

              {devices.kind === 'loading' && <Pending />}

              {devices.kind === 'failed' && (
                <div className="notice notice-broken" role="alert">
                  <span className="mark mark-broken" aria-hidden="true">
                    ✕
                  </span>
                  <div className="notice-body">
                    <p className="notice-title">{t('devices.failedTitle')}</p>
                    <p>{t('devices.failedBody')}</p>
                  </div>
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      setDevices({ kind: 'loading' });
                      setAttempt((n) => n + 1);
                    }}
                  >
                    {t('error.retry')}
                  </button>
                </div>
              )}

              {devices.kind === 'ready' && (
                <ul className="device-list" aria-label={t('devices.listLabel')}>
                  {thisDeviceFirst(devices.sessions, currentSessionId()).map((device) => (
                    <Row
                      key={device.id}
                      device={device}
                      here={device.id === currentSessionId()}
                      onEndHere={() => void endHere()}
                      onCheck={() => setChecking(device)}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Check
              device={checking}
              onEnd={() => void end(checking)}
              onKeep={() => setChecking(null)}
            />
          )}
        </section>
      )}
    </div>
  );
}

function Row({
  device,
  here,
  onCheck,
  onEndHere,
}: {
  device: DeviceSession;
  here: boolean;
  onCheck: () => void;
  onEndHere: () => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();

  return (
    <li className="device">
      <div className="device-detail">
        <div className="device-name">
          <span>{nameOf(device, t)}</span>
          {/* A dot and the words, never the dot alone. */}
          {here && (
            <span className="pill-here">
              <span className="pill-dot" aria-hidden="true" />
              {t('devices.here')}
            </span>
          )}
        </div>
        <p className="device-meta">
          {t('devices.signedInFrom', {
            started: moment(device.startedAt, locale, t),
            ip: device.ipAddress ?? t('devices.unknownAddress'),
          })}
        </p>
        <p className="device-meta">
          {t('devices.expiry', {
            usage: here
              ? t('devices.inUseNow')
              : t('devices.lastUsed', { used: moment(device.renewedAt, locale, t) }),
            expires: formatDay(device.expiresAt, locale),
          })}
        </p>
      </div>

      {/* Your own signs out at once and lands on sign-in. Another device opens
          a check first: you cannot see it, the row is only what it claimed,
          and it may be mid-event. */}
      <button className="button" type="button" onClick={here ? onEndHere : onCheck}>
        {t('devices.signOut')}
      </button>
    </li>
  );
}

function Check({
  device,
  onEnd,
  onKeep,
}: {
  device: DeviceSession;
  onEnd: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();

  return (
    <>
      <h2 id="devices-title">{t('devices.checkTitle', { name: nameOf(device, t) })}</h2>
      <p>
        {t('devices.checkBody', {
          started: moment(device.startedAt, locale, t),
          ip: device.ipAddress ?? t('devices.unknownAddress'),
          used: moment(device.renewedAt, locale, t),
        })}
      </p>

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

function nameOf(device: DeviceSession, t: TFunction): string {
  const parts = readableAgent(device.userAgent);

  if (parts != null) {
    return t('devices.agent', { browser: parts.browser, platform: parts.platform });
  }

  return device.userAgent ?? t('devices.unknownDevice');
}

function moment(iso: string, locale: string, t: TFunction): string {
  return t('devices.dayAtTime', {
    day: formatDay(iso, locale),
    time: formatTimeOfDay(iso, locale),
  });
}
