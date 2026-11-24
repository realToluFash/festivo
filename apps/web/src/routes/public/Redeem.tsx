import { ApiError, type OpenedDoorCode, type RedeemedDoorCode } from '@soirely/api-client';
import { formatDay, formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { api } from '../../api.ts';
import { Brand } from '../../components/Brand.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { dateLocale } from '../../i18n/index.ts';
import { meshFor } from '../../mesh.ts';
import {
  refreshAccount,
  rereadOutsideEvents,
  restoreSession,
  useSessionState,
} from '../../session.ts';
import { useSignOut } from '../../signOut.ts';
import { atWords } from '../app/events/doorCodes.ts';
import { dayWords } from '../app/events/staffTimes.ts';
import '../../components/desk.css';
import './redeem.css';

const CODE_LENGTH = 8;

type Line = 'blank' | 'short' | 'refused' | 'failed';

type Step =
  | { kind: 'enter'; typed: string; line: Line | null; busy: boolean; signedOut: boolean }
  | { kind: 'tooMany'; when: string | null; words: string }
  | {
      kind: 'event';
      code: string;
      opened: OpenedDoorCode;
      busy: boolean;
      trouble: 'refused' | 'failed' | null;
      named: string;
      checked: boolean;
    }
  | { kind: 'member'; organisation: string; eventId: string }
  | { kind: 'in'; redeemed: RedeemedDoorCode; event: OpenedDoorCode['event']; held: boolean };

/** A door code as typed: any case, spaces and hyphens ignored (sc-72). */
function normalCode(typed: string): string {
  return typed.replace(/[\s-]/gu, '').toUpperCase();
}

/** /d and /d/:code (sc-72): the browser's redeem pages, 390 first and one centred column wider, as the web demo's redeem draws them. */
export function RedeemPage() {
  const { code = '' } = useParams();

  return <Redeem key={code} code={code} />;
}

function Redeem({ code }: { code: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useSessionState();
  const signedIn = state.status === 'signedIn';
  const name = state.status === 'signedIn' ? state.session.name : '';
  const [step, setStep] = useState<Step>({
    kind: 'enter',
    typed: code,
    line: null,
    busy: code !== '',
    signedOut: false,
  });
  const title = useRef<HTMLHeadingElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<{ to: 'title' | 'field'; n: number }>({
    to: code === '' ? 'field' : 'title',
    n: 0,
  });

  useEffect(() => {
    (focus.to === 'title' ? title : field).current?.focus();
  }, [focus]);

  const go = (next: Step, to: 'title' | 'field' = 'title') => {
    setStep(next);
    setFocus((was) => ({ to, n: was.n + 1 }));
  };

  function open(typed: string): Promise<void> {
    return restoreSession()
      .then(() => opening(typed))
      .then(({ next, to }) => go(next, to));
  }

  // A code in the address, as the QR carries it, is opened as soon as the page is, and as whoever this browser's cookie signs in.
  useEffect(() => {
    let current = true;
    void restoreSession().then(async () => {
      if (code === '') return;
      const { next, to } = await opening(code);
      if (!current) return;
      setStep(next);
      setFocus((was) => ({ to, n: was.n + 1 }));
    });

    return () => {
      current = false;
    };
  }, [code]);

  async function join(event: Extract<Step, { kind: 'event' }>): Promise<void> {
    setStep({ ...event, busy: true, trouble: null });
    try {
      const redeemed = await api.redeemDoorCode(event.code, signedIn ? null : event.named.trim());
      if (signedIn) await rereadOutsideEvents().catch(() => undefined);
      else await refreshAccount();
      go({ kind: 'in', redeemed, event: event.opened.event, held: !signedIn });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        go({
          kind: 'member',
          organisation: event.opened.event.organisation,
          eventId: event.opened.event.id,
        });
      else if (error instanceof ApiError && error.status === 429) go(tooMany(error));
      else
        setStep({
          ...event,
          busy: false,
          trouble:
            error instanceof ApiError && error.is('door_code_invalid') ? 'refused' : 'failed',
        });
    }
  }

  const { signOut } = useSignOut(() =>
    go({ kind: 'enter', typed: '', line: null, busy: false, signedOut: true }, 'title'),
  );
  const leave = signOut;

  function body(): ReactNode {
    switch (step.kind) {
      case 'enter':
        return (
          <EnterStep
            step={step}
            titleRef={title}
            fieldRef={field}
            onType={(typed) => setStep({ ...step, typed, line: null })}
            onContinue={() => {
              const normal = normalCode(step.typed);
              if (normal.length !== CODE_LENGTH) {
                setStep({ ...step, line: normal === '' ? 'blank' : 'short' });
                field.current?.focus();
                return;
              }
              setStep({ ...step, line: null, busy: true });
              void open(step.typed);
            }}
          />
        );
      case 'tooMany':
        return (
          <>
            <Title titleRef={title}>{t('redeem.tooMany')}</Title>
            <p className="rd-intro">
              {step.when == null ? step.words : t('redeem.tryAt', { when: step.when })}
            </p>
          </>
        );
      case 'event':
        return (
          <>
            <Tile id={step.opened.event.id} />
            <Title titleRef={title}>{step.opened.event.name}</Title>
            <p className="rd-intro">{eventLine(step.opened, t)}</p>
            {step.trouble != null && (
              <p className="rd-alert" role="alert">
                <Glyph name="alert" size={17} weight={2.2} />
                {t(step.trouble === 'refused' ? 'redeem.refused' : 'redeem.line.failed')}
              </p>
            )}
            {!signedIn && (
              <NameStep
                step={step}
                fieldRef={field}
                onName={(named) => setStep({ ...step, named })}
                onJoin={() => {
                  if (nameLine(step.named, t) != null) {
                    setStep({ ...step, checked: true });
                    field.current?.focus();
                    return;
                  }
                  void join({ ...step, checked: true });
                }}
              />
            )}
            {signedIn && (
              <div className="rd-pair">
                <Primary busy={step.busy} onClick={() => void join(step)}>
                  {t('redeem.joinAs', { name })}
                </Primary>
                <button type="button" className="rd-quiet is-centre" onClick={() => void leave()}>
                  {t('redeem.signOut')}
                </button>
              </div>
            )}
          </>
        );
      case 'member':
        return (
          <>
            <Tile id={step.eventId} />
            <Title titleRef={title}>
              {t('redeem.memberTitle', { organisation: step.organisation })}
            </Title>
            <p className="rd-intro">{t('redeem.memberLine')}</p>
            <Primary onClick={() => void navigate('/app/events')}>{t('redeem.openEvents')}</Primary>
          </>
        );
      case 'in':
        return (
          <>
            <Tile id={step.event.id} />
            <Title titleRef={title}>
              {step.redeemed.jobLabel == null
                ? t('redeem.inTitleNoJob', { event: step.event.name })
                : t('redeem.inTitle', { event: step.event.name, job: step.redeemed.jobLabel })}
            </Title>
            <p className="rd-intro">{t('redeem.endsLine')}</p>
            <Primary onClick={() => void navigate(`/app/events/${step.redeemed.eventId}`)}>
              {t('redeem.openEvent')}
            </Primary>
            <div className="rd-you">
              <p className="rd-you-name">{t('redeem.signedInAs', { name: step.redeemed.name })}</p>
              {step.held && step.redeemed.endsAt != null && (
                <p className="rd-you-line">
                  {t('redeem.signedOutAt', {
                    time: atWords(
                      step.redeemed.endsAt,
                      {
                        endsAt: step.redeemed.endsAt,
                        timeZone: step.event.timeZone,
                        locale: dateLocale(),
                        now: new Date(),
                      },
                      t,
                    ),
                  })}
                </p>
              )}
              <button type="button" className="rd-out" onClick={() => void leave()}>
                <SignOutLine />
                {t('redeem.signOut')}
              </button>
            </div>
          </>
        );
    }
  }

  return (
    <main id="content" className="rd">
      <div className="rd-column" data-step={step.kind}>
        <div className="rd-brand">
          <Brand />
        </div>
        {body()}
      </div>
    </main>
  );
}

/** Where a typed or scanned code leads: its event, the member's refusal, too many tries, or the one refusal. */
async function opening(typed: string): Promise<{ next: Step; to: 'title' | 'field' }> {
  const normal = normalCode(typed);
  try {
    const opened = await api.openDoorCode(normal);
    if (opened.standing === 'member')
      return {
        next: { kind: 'member', organisation: opened.event.organisation, eventId: opened.event.id },
        to: 'title',
      };

    return {
      next: {
        kind: 'event',
        code: normal,
        opened,
        busy: false,
        trouble: null,
        named: '',
        checked: false,
      },
      to: 'title',
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 429)
      return { next: tooMany(error), to: 'title' };
    const line: Line = error instanceof ApiError && error.status === 404 ? 'refused' : 'failed';

    return { next: { kind: 'enter', typed, line, busy: false, signedOut: false }, to: 'field' };
  }
}

/** Too many tries, lifting at the minute Retry-After gives on the reader's clock, with the day only when it is not today's. */
function tooMany(error: ApiError): Step {
  const lifts = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));
  const words = error.problem.detail ?? error.problem.title;
  if (lifts == null) return { kind: 'tooMany', when: null, words };

  const time = formatTimeOfDay(lifts, dateLocale());

  return {
    kind: 'tooMany',
    when: isSameLocalDay(lifts, new Date()) ? time : `${formatDay(lifts, dateLocale())} ${time}`,
    words,
  };
}

function isSameLocalDay(one: Date, other: Date): boolean {
  return one.toDateString() === other.toDateString();
}

/** "Sat 14 Nov · Lumen Feiras · Can check guests in · Bar and drinks", the day on the event's clock. */
function eventLine(opened: OpenedDoorCode, t: TFunction): string {
  const times = { long: false, timeZone: opened.event.timeZone, locale: dateLocale() };

  return [
    dayWords(opened.event.startsAt, times),
    opened.event.organisation,
    t(`eventPeople.role.${opened.role}`),
    opened.jobLabel,
  ]
    .filter((part) => part != null && part !== '')
    .join(' · ');
}

function Title({
  titleRef,
  children,
}: {
  titleRef: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <h1 ref={titleRef} className="rd-title" tabIndex={-1}>
      {children}
    </h1>
  );
}

function Tile({ id }: { id: string }) {
  return <span className={`rd-tile today-cover is-${meshFor(id)}`} aria-hidden="true" />;
}

function Primary({
  busy = false,
  submit = false,
  onClick,
  children,
}: {
  busy?: boolean;
  submit?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      className="rd-primary"
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={(event) => {
        if (busy) event.preventDefault();
        else onClick?.();
      }}
    >
      {busy && <span className="rd-spin" aria-hidden="true" />}
      <span className="rd-primary-words">{children}</span>
    </button>
  );
}

function EnterStep({
  step,
  titleRef,
  fieldRef,
  onType,
  onContinue,
}: {
  step: Extract<Step, { kind: 'enter' }>;
  titleRef: RefObject<HTMLHeadingElement | null>;
  fieldRef: RefObject<HTMLInputElement | null>;
  onType: (typed: string) => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const wrong = step.line != null;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!step.busy) onContinue();
  }

  return (
    <form className="rd-form" noValidate onSubmit={submit}>
      {step.signedOut && (
        <p className="rd-signed-out" role="status">
          <SignOutLine size={26} />
          {t('redeem.signedOut')}
        </p>
      )}
      <Title titleRef={titleRef}>{t('redeem.enterTitle')}</Title>
      <div
        className={['rd-field', wrong && 'is-wrong', step.typed !== '' && 'is-filled']
          .filter(Boolean)
          .join(' ')}
      >
        <label htmlFor="rd-code" className="rd-label">
          {t('redeem.doorCode')}
        </label>
        <input
          ref={fieldRef}
          id="rd-code"
          className="rd-input is-code"
          value={step.typed}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={wrong}
          aria-describedby={wrong ? 'rd-code-line' : undefined}
          onChange={(event) => onType(event.target.value)}
        />
      </div>
      {step.line != null && (
        <p
          id="rd-code-line"
          className="rd-says"
          role={step.line === 'refused' || step.line === 'failed' ? 'alert' : undefined}
        >
          {t(`redeem.line.${step.line}`)}
        </p>
      )}
      <Primary submit busy={step.busy}>
        {t('redeem.continue')}
      </Primary>
    </form>
  );
}

function nameLine(named: string, t: TFunction): string | null {
  return named.trim() === '' ? t('redeem.nameBlank') : null;
}

/** Signed out, the device-held grant asks a name and nothing else: no number, no phone code (sc-72, until sc-4235). */
function NameStep({
  step,
  fieldRef,
  onName,
  onJoin,
}: {
  step: Extract<Step, { kind: 'event' }>;
  fieldRef: RefObject<HTMLInputElement | null>;
  onName: (named: string) => void;
  onJoin: () => void;
}) {
  const { t } = useTranslation();
  const said = step.checked ? nameLine(step.named, t) : null;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!step.busy) onJoin();
  }

  return (
    <form className="rd-form" noValidate onSubmit={submit}>
      <div className="rd-group">
        <div
          className={['rd-field', said != null && 'is-wrong', step.named !== '' && 'is-filled']
            .filter(Boolean)
            .join(' ')}
        >
          <label htmlFor="rd-name" className="rd-label">
            {t('redeem.yourName')}
          </label>
          <input
            ref={fieldRef}
            id="rd-name"
            className="rd-input"
            value={step.named}
            autoComplete="name"
            spellCheck={false}
            aria-invalid={said != null}
            aria-describedby={said == null ? undefined : 'rd-name-line'}
            onChange={(event) => onName(event.target.value)}
          />
        </div>
        {said != null && (
          <p id="rd-name-line" className="rd-says">
            {said}
          </p>
        )}
      </div>
      <Primary submit busy={step.busy}>
        {step.busy ? t('redeem.joining') : t('redeem.join')}
      </Primary>
    </form>
  );
}

function SignOutLine({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="rd-out-mark"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
