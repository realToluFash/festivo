import {
  ApiError,
  type DoorCodeSignedIn,
  type OpenedDoorCode,
  type RedeemedDoorCode,
} from '@soirely/api-client';
import { formatDay, formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import { api } from '../../api.ts';
import { Brand } from '../../components/Brand.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { ProviderSignIn } from '../../components/ProviderSignIn.tsx';
import { providerList } from '../../providerList.ts';
import { dateLocale } from '../../i18n/index.ts';
import { meshFor } from '../../mesh.ts';
import { doorAddress } from './doorCheckIn.ts';
import {
  type ProviderOnly,
  outsideOn,
  refreshAccount,
  rereadOutsideEvents,
  restoreSession,
  useSessionState,
} from '../../session.ts';
import { holdReturn } from '../../heldReturn.ts';
import { useSignOut } from '../../signOut.ts';
import { atWords } from '../app/events/doorCodes.ts';
import { dayWords } from '../app/events/staffTimes.ts';
import {
  type Leave,
  PhoneCodeStep,
  PhoneEntryStep,
  Primary,
  SignOutLine,
  Title,
} from './RedeemPhone.tsx';
import { type PhoneEntry, shownNumber, startingEntry } from './redeemEntry.ts';
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
      entry: PhoneEntry;
    }
  | {
      kind: 'code';
      code: string;
      opened: OpenedDoorCode;
      entry: PhoneEntry;
      handle: string;
    }
  | { kind: 'member'; organisation: string; eventId: string }
  | { kind: 'providerOnly'; code: string; eventId: string; refusal: ProviderOnly }
  | { kind: 'in'; you: YoureIn };

/** "You're in for…": after redeeming, or again from check-in's way back, which redeems nothing (sc-28230). */
interface YoureIn {
  eventId: string;
  event: string;
  timeZone: string | null;
  jobLabel: string | null;
  role: string;
  name: string;
  endsAt: string | null;
  held: boolean;
}

function youreIn(
  redeemed: RedeemedDoorCode,
  event: OpenedDoorCode['event'],
  signedOutAt: string | null,
): YoureIn {
  return {
    eventId: redeemed.eventId,
    event: event.name,
    timeZone: event.timeZone,
    jobLabel: redeemed.jobLabel,
    role: redeemed.role,
    name: redeemed.name,
    endsAt: signedOutAt ?? redeemed.endsAt,
    held: signedOutAt != null,
  };
}

/** A door code as typed: any case, spaces and hyphens ignored (sc-72). */
function normalCode(typed: string): string {
  return typed.replace(/[\s-]/gu, '').toUpperCase();
}

/** /d and /d/:code (sc-72): the browser's redeem pages, 390 first and one centred column wider, as the web demo's redeem draws them. */
export function RedeemPage() {
  const { code = '', eventId } = useParams();

  return <Redeem key={eventId ?? code} code={eventId == null ? code : ''} again={eventId} />;
}

function Redeem({ code, again }: { code: string; again: string | undefined }) {
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

  // From check-in's way back (/d/in/:eventId): the grant the account already holds, redeeming nothing again.
  const account = state.status === 'signedIn' ? state.session : null;
  const held = again == null || account == null ? null : outsideOn(account, again);
  const back: YoureIn | null =
    held == null || step.kind !== 'enter' || step.signedOut
      ? null
      : {
          eventId: held.id,
          event: held.name,
          timeZone: held.timeZone,
          jobLabel: held.jobLabel,
          role: held.role,
          name,
          endsAt: account?.signedOutAt ?? held.endsAt,
          held: account?.signedOutAt != null,
        };
  const backShown = back != null;

  useEffect(() => {
    if (backShown) title.current?.focus();
  }, [backShown]);

  async function join(event: Extract<Step, { kind: 'event' }>): Promise<void> {
    setStep({ ...event, busy: true, trouble: null });
    try {
      const redeemed = await api.redeemDoorCode(event.code);
      const signedOutAt = await rereadOutsideEvents().catch(() => null);
      go({ kind: 'in', you: youreIn(redeemed, event.opened.event, signedOutAt) });
    } catch (error) {
      refused(event, error);
    }
  }

  /** Signed out, Send code: the code goes to the number typed, whether or not it has an account (sc-4235). */
  async function send(event: Extract<Step, { kind: 'event' }>): Promise<void> {
    setStep({ ...event, busy: true, trouble: null });
    try {
      const { handle } = await api.sendDoorCodeSignIn(
        event.code,
        event.entry.named.trim(),
        event.entry.country,
        event.entry.number,
      );
      go(
        { kind: 'code', code: event.code, opened: event.opened, entry: event.entry, handle },
        'field',
      );
    } catch (error) {
      const said = error instanceof ApiError && error.status === 422 ? error.fieldErrors() : {};
      if (said.name == null && said.number == null) {
        refused(event, error);
        return;
      }
      setStep({
        ...event,
        busy: false,
        trouble: null,
        entry: {
          ...event.entry,
          checked: true,
          refused: { name: said.name ?? null, number: said.number ?? null },
        },
      });
      document.getElementById(said.name == null ? 'rd-number' : 'rd-name')?.focus();
    }
  }

  function refused(event: Extract<Step, { kind: 'event' }>, error: unknown): void {
    if (error instanceof ApiError && error.is('already_a_member'))
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
          error instanceof ApiError && (error.is('door_code_invalid') || error.status === 404)
            ? 'refused'
            : 'failed',
      });
  }

  async function left(
    at: Extract<Step, { kind: 'code' }>,
    leave: Leave<DoorCodeSignedIn>,
  ): Promise<void> {
    const back: Extract<Step, { kind: 'event' }> = {
      kind: 'event',
      code: at.code,
      opened: at.opened,
      busy: false,
      trouble: null,
      entry: at.entry,
    };
    if (leave.kind === 'alternative') {
      go({ ...back, entry: { ...at.entry, alternative: true } });
      document.getElementById('rd-number')?.focus();
      return;
    }
    if (leave.kind === 'refused') {
      refused(back, leave.error);
      return;
    }
    if (leave.kind === 'providerOnly') {
      go({
        kind: 'providerOnly',
        code: at.code,
        eventId: at.opened.event.id,
        refusal: leave.refusal,
      });
      return;
    }
    const { outcome, redeemed } = leave.signedIn;
    if ('challenge' in outcome) {
      // Two-factor is asked before the grant: its code screen, then back here to join as the account.
      holdReturn(`/d/${at.code}`);
      void navigate('/sign-in/code', { replace: true, state: outcome });
      return;
    }
    await refreshAccount();
    if (redeemed != null)
      go({ kind: 'in', you: youreIn(redeemed, at.opened.event, redeemed.endsAt) });
  }

  const { signOut } = useSignOut(() =>
    go({ kind: 'enter', typed: '', line: null, busy: false, signedOut: true }, 'title'),
  );
  const leave = signOut;

  function youreInBody(you: YoureIn): ReactNode {
    const toEvent = () => void navigate(`/app/events/${you.eventId}`);

    return (
      <>
        <Tile id={you.eventId} />
        <Title titleRef={title}>
          {you.jobLabel == null
            ? t('redeem.inTitleNoJob', { event: you.event })
            : t('redeem.inTitle', { event: you.event, job: you.jobLabel })}
        </Title>
        <p className="rd-intro">{t('redeem.endsLine')}</p>
        {you.role === 'can_check_in' ? (
          <div className="rd-pair">
            <Link className="rd-primary" to={doorAddress(you.eventId)}>
              {t('checkIn.title')}
            </Link>
            <button type="button" className="rd-secondary" onClick={toEvent}>
              {t('redeem.openEvent')}
            </button>
          </div>
        ) : (
          <Primary onClick={toEvent}>{t('redeem.openEvent')}</Primary>
        )}
        <div className="rd-you">
          <p className="rd-you-name">{t('redeem.signedInAs', { name: you.name })}</p>
          {you.held && you.endsAt != null && you.timeZone != null && (
            <p className="rd-you-line">
              {t('redeem.signedOutAt', {
                time: atWords(
                  you.endsAt,
                  {
                    endsAt: you.endsAt,
                    timeZone: you.timeZone,
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

  function body(): ReactNode {
    if (back != null) return youreInBody(back);
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
              <PhoneEntryStep
                entry={step.entry}
                busy={step.busy}
                fieldRef={field}
                onChange={(entry) => setStep({ ...step, entry })}
                onSend={() => void send(step)}
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
      case 'code': {
        const signInWith = (typed: string) => api.doorCodeSignIn(step.code, step.handle, typed);

        return (
          <PhoneCodeStep
            signIn={signInWith}
            handle={step.handle}
            number={shownNumber(step.entry)}
            titleRef={title}
            fieldRef={field}
            onLeave={(leave) => void left(step, leave)}
          />
        );
      }
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
      case 'providerOnly':
        return (
          <>
            <Tile id={step.eventId} />
            <Title titleRef={title}>
              {t('signIn.providerOnlyTitle', { organisation: step.refusal.organisation })}
            </Title>
            <p className="rd-intro">
              {t('signIn.providerOnlyCode', {
                organisation: step.refusal.organisation,
                providers: providerList(step.refusal.providers),
              })}
            </p>
            <ProviderSignIn only={step.refusal.providers} returnTo={`/d/${step.code}`} />
          </>
        );
      case 'in':
        return youreInBody(step.you);
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
        entry: startingEntry(),
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

function Tile({ id }: { id: string }) {
  return <span className={`rd-tile today-cover is-${meshFor(id)}`} aria-hidden="true" />;
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
