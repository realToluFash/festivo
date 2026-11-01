import { type DeviceSession } from '@soirely/api-client';
import {
  type AppDevice,
  appDevice,
  formatDay,
  formatTimeOfDay,
  othersOf,
  readableAgent,
  thisDeviceFirst,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { AccountSections } from '../../../components/AccountSections.tsx';
import { LateStatus } from '../../../components/LateStatus.tsx';
import { StillSignedIn } from '../../../components/StillSignedIn.tsx';
import { EverywhereElse } from './EverywhereElse.tsx';
import { PasswordCard } from './PasswordCard.tsx';
import { TwoFactorCard } from './TwoFactorCard.tsx';
import { WaysCard } from './WaysCard.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import {
  type ProviderReturn,
  dropProviderReturn,
  heldProviderReturn,
} from '../../../providerSignIn.ts';
import { forgetSession, refreshAccount, rereadCredentials, useSession } from '../../../session.ts';
import { useFocusOnceShown, useStepFocus } from '../../../stepFocus.ts';
import { useSignOut } from '../../../signOut.ts';
import { Skeleton } from '../../../components/Skeleton.tsx';

type Devices =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; sessions: DeviceSession[] };

export function Security() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSession();

  const [devices, setDevices] = useState<Devices>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState<DeviceSession | null>(null);
  const [checkHeading, arriveAtCheck] = useStepFocus();
  const [ended, setEnded] = useState<string | null>(null);
  const [endFailed, setEndFailed] = useState(false);
  const [retried, setRetried] = useState(false);
  const [afterStep, setAfterStep] = useState(false);
  const devicesHeading = useRef<HTMLHeadingElement>(null);
  const said = useRef<HTMLDivElement>(null);
  const signOutButtons = useRef(new Map<string, HTMLButtonElement | null>());
  const everywhereButton = useRef<HTMLButtonElement>(null);
  const failedNotice = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const loaded = () => list.current != null || failedNotice.current != null;
  const passwordOpener = useRef<(() => HTMLElement | null) | null>(null);
  const land = useFocusOnceShown();
  const [settingUp, setSettingUp] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [returned] = useState<ProviderReturn | null>(() => heldProviderReturn(['signOutOthers']));
  const [everywhere, setEverywhere] = useState(
    returned != null && !('failed' in returned && returned.failed === 'cancelled'),
  );
  const [everywhereDone, setEverywhereDone] = useState<{
    count: number;
    arrived: boolean;
  } | null>(null);
  const [doneHeard, setDoneHeard] = useState(false);
  const [codesSpent, setCodesSpent] = useState(0);
  const codeSpent = () => setCodesSpent((n) => n + 1);
  const here = useSignOut(() => navigate('/sign-in'));

  // Removed only once committed: React may abandon a render and run the initializer again.
  useEffect(() => {
    if (returned != null) dropProviderReturn();
  }, [returned]);

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
    here.dismiss();
    setEverywhereDone(null);

    try {
      await api.endSession(device.id);
    } catch {
      setChecking(null);
      setEndFailed(true);
      land(() => said.current);

      return;
    }

    setChecking(null);
    setEnded(nameOf(device, t));
    land(() => said.current);
    setDevices((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', sessions: current.sessions.filter((s) => s.id !== device.id) }
        : current,
    );
  }

  function endedElsewhere(
    result: { signedOut: number; thisDevice: boolean },
    arrived: boolean,
  ): void {
    if (result.thisDevice) {
      forgetSession();
      navigate('/sign-in');

      return;
    }

    setEverywhere(false);
    setEnded(null);
    setEndFailed(false);
    setEverywhereDone({ count: result.signedOut, arrived });
    setDoneHeard(false);
    if (!arrived) land(() => said.current);
    setRetried(false);
    setAfterStep(true);
    setDevices({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  async function endHere(): Promise<void> {
    setEndFailed(false);
    setEnded(null);
    setEverywhereDone(null);
    await here.signOut();
  }

  const quiet = afterStep && !retried && devices.kind !== 'ready';
  const failed = devices.kind === 'failed' && (everywhereDone?.arrived !== true || doneHeard);

  return (
    <div className="account">
      <div className="account-heading">
        <h1>{t('account.title')}</h1>
        <p>{session.email}</p>
      </div>

      <AccountSections />

      <PasswordCard
        email={session.email}
        hasPassword={session.hasPassword}
        providers={session.providers}
        onChanged={() => {
          setEnded(null);
          setRetried(false);
          setAfterStep(true);
          setDevices({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
        onAdded={() => refreshAccount()}
        setting={settingPassword}
        onSetting={setSettingPassword}
        returnTo={() => passwordOpener.current?.() ?? null}
      />

      <WaysCard
        email={session.email}
        hasPassword={session.hasPassword}
        providers={session.providers}
        onChanged={() => refreshAccount()}
        onRefused={rereadCredentials}
        onSetPassword={(opener) => {
          passwordOpener.current = opener;
          setSettingPassword(true);
          document.getElementById('password-title')?.scrollIntoView({ block: 'start' });
        }}
        onSignedOutHere={() => {
          forgetSession();
          navigate('/sign-in');
        }}
        onCodeSpent={codeSpent}
      />

      <TwoFactorCard email={session.email} onBusy={setSettingUp} recount={codesSpent} />

      {/* Not rendered at all during setup: `.card` sets a display, which `hidden` cannot beat. */}
      {!settingUp && (
        <section className="card" aria-labelledby="devices-title">
          {checking == null && everywhere && devices.kind === 'ready' ? (
            <EverywhereElse
              {...othersOf(devices.sessions)}
              hasPassword={session.hasPassword}
              providers={session.providers}
              returned={returned}
              onDone={endedElsewhere}
              onKeep={() => {
                setEverywhere(false);
                land(() => everywhereButton.current ?? (loaded() ? devicesHeading.current : null));
              }}
              onCodeSpent={codeSpent}
            />
          ) : checking == null ? (
            <>
              <div className="card-heading">
                <h2 id="devices-title" ref={devicesHeading} tabIndex={-1}>
                  {t('devices.title')}
                </h2>
                {devices.kind === 'ready' && (
                  <span className="card-count">
                    {t('devices.count', { count: devices.sessions.length })}
                  </span>
                )}
              </div>

              <p>{t('devices.intro')}</p>

              {ended != null && (
                <div className="status-done" ref={said} tabIndex={-1}>
                  <span className="mark mark-done" aria-hidden="true">
                    ✓
                  </span>
                  <p>{t('devices.ended', { name: ended })}</p>
                </div>
              )}

              {everywhereDone != null &&
                (everywhereDone.arrived ? (
                  <LateStatus
                    className="status-done"
                    mark={
                      <span className="mark mark-done" aria-hidden="true">
                        ✓
                      </span>
                    }
                    words={everywhereWords(everywhereDone.count, t)}
                    onShown={() => setDoneHeard(true)}
                  />
                ) : (
                  <div className="status-done" ref={said} tabIndex={-1}>
                    <span className="mark mark-done" aria-hidden="true">
                      ✓
                    </span>
                    <p>{everywhereWords(everywhereDone.count, t)}</p>
                  </div>
                ))}

              {endFailed && (
                <div className="notice notice-broken">
                  <span className="mark mark-broken" aria-hidden="true">
                    ✕
                  </span>
                  <div className="notice-body" ref={said} tabIndex={-1}>
                    <p className="notice-title">{t('devices.endFailedTitle')}</p>
                    <p>{t('devices.endFailedBody')}</p>
                  </div>
                </div>
              )}

              {here.unreached && <StillSignedIn />}

              {devices.kind === 'loading' && (
                <Skeleton
                  words={t('pending.loading')}
                  shape="rows"
                  rowHeight={64}
                  rows={2}
                  inCard
                />
              )}

              {/* After a step succeeded, its success is read first, so this waits on the page as
                  a polite status: VoiceOver skips one added with its words already inside. */}
              {(quiet || failed) && (
                <div
                  className={failed ? 'notice notice-broken' : 'visually-hidden'}
                  role={quiet ? 'status' : retried ? undefined : 'alert'}
                >
                  {failed && (
                    <>
                      <span className="mark mark-broken" aria-hidden="true">
                        ✕
                      </span>
                      <div
                        className="notice-body"
                        ref={failedNotice}
                        tabIndex={retried ? -1 : undefined}
                      >
                        <p className="notice-title">{t('devices.failedTitle')}</p>
                        <p>{t('devices.failedBody')}</p>
                      </div>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          setRetried(true);
                          setDevices({ kind: 'loading' });
                          setAttempt((n) => n + 1);
                          land(
                            () =>
                              failedNotice.current ??
                              (list.current == null ? null : devicesHeading.current),
                          );
                        }}
                      >
                        {t('error.retry')}
                      </button>
                    </>
                  )}
                </div>
              )}

              {devices.kind === 'ready' && (
                <ul className="device-list arrives" ref={list} aria-label={t('devices.listLabel')}>
                  {thisDeviceFirst(devices.sessions).map((device) => (
                    <Row
                      key={device.id}
                      device={device}
                      here={device.thisDevice}
                      button={(element) => {
                        signOutButtons.current.set(device.id, element);
                      }}
                      onEndHere={() => void endHere()}
                      onCheck={() => {
                        setChecking(device);
                        arriveAtCheck();
                      }}
                    />
                  ))}
                </ul>
              )}

              {devices.kind === 'ready' && othersOf(devices.sessions).count > 0 && (
                <div className="device-footer">
                  <button
                    className="button"
                    type="button"
                    ref={everywhereButton}
                    onClick={() => {
                      setEverywhereDone(null);
                      setEnded(null);
                      setEverywhere(true);
                    }}
                  >
                    {t('devices.everywhere')}
                  </button>
                  <p className="muted">{t('devices.everywhereHint')}</p>
                </div>
              )}
            </>
          ) : (
            <Check
              device={checking}
              heading={checkHeading}
              onEnd={() => void end(checking)}
              onKeep={() => {
                setChecking(null);
                land(
                  () =>
                    signOutButtons.current.get(checking.id) ??
                    (loaded() ? devicesHeading.current : null),
                );
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}

function everywhereWords(count: number, t: TFunction): string {
  return count === 0 ? t('devices.everywhereNone') : t('devices.everywhereDone', { count });
}

function Row({
  device,
  here,
  button,
  onCheck,
  onEndHere,
}: {
  device: DeviceSession;
  here: boolean;
  button: (element: HTMLButtonElement | null) => void;
  onCheck: () => void;
  onEndHere: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();

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
      <button className="button" type="button" ref={button} onClick={here ? onEndHere : onCheck}>
        {t('devices.signOut')}
      </button>
    </li>
  );
}

function Check({
  device,
  heading,
  onEnd,
  onKeep,
}: {
  device: DeviceSession;
  heading: RefObject<HTMLHeadingElement | null>;
  onEnd: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  return (
    <>
      <h2 id="devices-title" ref={heading} tabIndex={-1}>
        {t('devices.checkTitle', { name: nameOf(device, t) })}
      </h2>
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
            {t('devices.signInAgain')} {t('devices.passwordAdvice')}
          </p>
        </div>
      </div>

      <div className="actions">
        <button className="link-button" type="button" onClick={onKeep}>
          {t('devices.keep')}
        </button>
        <button className="button button-danger" type="button" onClick={onEnd}>
          {t('devices.end')}
        </button>
      </div>
    </>
  );
}

const APP_NAMES = {
  iPhone: 'devices.appIPhone',
  iPad: 'devices.appIPad',
  phone: 'devices.appAndroidPhone',
  tablet: 'devices.appAndroidTablet',
} as const satisfies Record<AppDevice, string>;

function nameOf(device: DeviceSession, t: TFunction): string {
  const app = appDevice(device.userAgent);

  if (app != null) return t(APP_NAMES[app]);

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
