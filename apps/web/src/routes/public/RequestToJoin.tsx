import { ApiError, type RequestLinkPreview } from '@soirely/api-client';
import {
  REQUEST_MESSAGE_MAXIMUM,
  formatDay,
  formatTimeOfDay,
  initials,
  lockLiftsAt,
} from '@soirely/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { Pending } from '../../components/Pending.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { useFormChecks } from '../../formChecks.ts';
import { dropHeldInvitation, holdInvitation } from '../../heldInvitation.ts';
import { currentLocale } from '../../i18n/index.ts';
import { landingFor, refreshAccount, restoreSession, useSessionState } from '../../session.ts';

type View =
  | { kind: 'loading' }
  | { kind: 'dead' }
  | { kind: 'unreachable' }
  | { kind: 'open'; preview: RequestLinkPreview }
  | { kind: 'sent'; preview: RequestLinkPreview }
  | { kind: 'limited'; preview: RequestLinkPreview; until: Date | null };

/** The page an organisation's request link opens (sc-562): its name, and Ask to join. */
export function RequestToJoin({ token }: { token: string }) {
  const session = useSessionState();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const settled = session.status === 'signedIn' || session.status === 'signedOut';

  useEffect(() => {
    dropHeldInvitation();
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!settled) return;
    let current = true;

    api.requestLinkPreview(token).then(
      (preview) => current && setView({ kind: 'open', preview }),
      (error: unknown) => {
        if (!current) return;
        const dead = error instanceof ApiError && error.is('request_link_dead');
        setView({ kind: dead ? 'dead' : 'unreachable' });
      },
    );

    return () => {
      current = false;
    };
  }, [settled, token]);

  if (session.status === 'unreachable' || view.kind === 'unreachable') return <Unreachable />;
  if (view.kind === 'loading') return <Pending />;

  return (
    <AuthPage>
      {view.kind === 'dead' ? (
        <Dead />
      ) : (
        <Asking
          token={token}
          view={view}
          signedIn={session.status === 'signedIn'}
          onChange={setView}
        />
      )}
    </AuthPage>
  );
}

/** Unknown, switched off and replaced alike, with no organisation named. */
function Dead() {
  const { t } = useTranslation();

  return (
    <>
      <div className="auth-heading">
        <h1>{t('requestToJoin.deadTitle')}</h1>
      </div>
      <div className="notice notice-quiet" role="status">
        <span className="mark mark-info" aria-hidden="true">
          i
        </span>
        <p>{t('requestToJoin.deadBody')}</p>
      </div>
      <Link className="button" to="/">
        {t('requestToJoin.goHome')}
      </Link>
    </>
  );
}

function Asking({
  token,
  view,
  signedIn,
  onChange,
}: {
  token: string;
  view: Exclude<View, { kind: 'loading' | 'dead' | 'unreachable' }>;
  signedIn: boolean;
  onChange: (next: View) => void;
}) {
  const { t } = useTranslation();
  const { preview } = view;
  const organisation = preview.organisation.name;

  return (
    <>
      <div className="auth-heading">
        <h1>{t('requestToJoin.title', { organisation })}</h1>
      </div>

      <div className="join-org">
        <span className="org-tile" aria-hidden="true">
          {initials(organisation)}
        </span>
        <div className="org-naming">
          <p className="org-name">{organisation}</p>
          <p className="org-role">{t('requestToJoin.requestLink')}</p>
        </div>
      </div>

      {view.kind === 'sent' && <Sent organisation={organisation} />}
      {view.kind === 'limited' && <Limited until={view.until} />}
      {view.kind === 'open' && !signedIn && <SignedOut token={token} organisation={organisation} />}
      {view.kind === 'open' && signedIn && preview.standing != null && (
        <Standing preview={preview} />
      )}
      {view.kind === 'open' && signedIn && preview.standing == null && (
        <Ask token={token} preview={preview} onChange={onChange} />
      )}
    </>
  );
}

function SignedOut({ token, organisation }: { token: string; organisation: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Either way, the link is held so the sign-in or the new account comes back here.
  function go(to: '/sign-in' | '/register'): void {
    holdInvitation(token);
    navigate(to);
  }

  return (
    <>
      <p>{t('requestToJoin.signedOut', { organisation })}</p>
      <button className="button button-primary" type="button" onClick={() => go('/sign-in')}>
        {t('requestToJoin.signIn')}
      </button>
      <button className="button" type="button" onClick={() => go('/register')}>
        {t('requestToJoin.register')}
      </button>
    </>
  );
}

function Ask({
  token,
  preview,
  onChange,
}: {
  token: string;
  preview: RequestLinkPreview;
  onChange: (next: View) => void;
}) {
  const { t } = useTranslation();
  const organisation = preview.organisation.name;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const asking = useRef(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const checks = useFormChecks(
    ['message'] as const,
    (_, value) =>
      Array.from(value.trim()).length > REQUEST_MESSAGE_MAXIMUM
        ? t('requestToJoin.messageLong', { count: REQUEST_MESSAGE_MAXIMUM })
        : null,
    () => document.getElementById('request-message')?.focus(),
  );
  const error = checks.errors.message ?? refused;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (asking.current || !checks.passes({ message })) return;

    asking.current = true;
    setBusy(true);
    setFailed(false);

    try {
      await api.askThroughRequestLink(token, message);
      onChange({ kind: 'sent', preview });
      // An account with no organisation now waits on this request; the session learns so.
      await refreshAccount().catch(() => {});
    } catch (problem) {
      asking.current = false;
      setBusy(false);
      settle(problem);
    }
  }

  function settle(problem: unknown): void {
    if (!(problem instanceof ApiError)) {
      setFailed(true);
      return;
    }

    if (problem.is('too_many_attempts')) {
      const until = lockLiftsAt(Number(problem.response?.headers.get('Retry-After')));
      onChange({ kind: 'limited', preview, until });
      return;
    }

    const standing = problem.is('already_a_member')
      ? 'member'
      : problem.is('join_request_waiting')
        ? 'waiting'
        : problem.is('join_request_cooling_off')
          ? 'cooling_off'
          : null;

    if (standing != null) {
      const until = problem.problem.until;
      onChange({
        kind: 'open',
        preview: {
          ...preview,
          standing,
          askAgainFrom: typeof until === 'string' ? until : preview.askAgainFrom,
        },
      });
      return;
    }

    if (problem.is('request_link_dead')) {
      setFailed(true);
      return;
    }

    if (problem.is('validation_failed')) {
      setRefused(problem.fieldErrors().message ?? null);
      return;
    }

    setFailed(true);
  }

  return (
    <>
      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('requestToJoin.failedTitle')}</p>
            <p>{t('requestToJoin.failedBody')}</p>
          </div>
        </div>
      )}

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="request-message">
            {t('requestToJoin.message')}{' '}
            <span className="pill-quiet">{t('requestToJoin.optional')}</span>
          </label>
          <textarea
            className={error == null ? 'input' : 'input input-wrong'}
            id="request-message"
            name="message"
            rows={4}
            value={message}
            disabled={busy}
            aria-invalid={error != null}
            aria-describedby={
              error == null ? 'request-message-help' : 'request-message-error request-message-help'
            }
            onBlur={(event) => checks.left('message', event.target.value)}
            onChange={(event) => {
              setMessage(event.target.value);
              setRefused(null);
              checks.edited('message', event.target.value);
            }}
          />
          {error != null && <FieldError id="request-message-error" message={error} />}
          <p className="field-help" id="request-message-help">
            {t('requestToJoin.messageHelp', {
              count: REQUEST_MESSAGE_MAXIMUM,
              used: Array.from(message.trim()).length,
            })}
          </p>
        </div>

        <button className="button button-primary" type="submit" aria-busy={busy}>
          {busy ? t('requestToJoin.asking') : t('requestToJoin.ask')}
        </button>
        <p className="muted">{t('requestToJoin.whatTheySee', { organisation })}</p>
      </form>
    </>
  );
}

function useLanding(): string {
  const session = useSessionState();

  return session.status === 'signedIn' ? landingFor(session.session.awaiting) : '/app';
}

function Sent({ organisation }: { organisation: string }) {
  const { t } = useTranslation();
  const landing = useLanding();

  return (
    <>
      <div className="notice notice-done" role="status">
        <span className="mark mark-done" aria-hidden="true">
          ✓
        </span>
        <p>{t('requestToJoin.sent', { organisation })}</p>
      </div>
      <Link className="button button-primary" to={landing}>
        {t('requestToJoin.carryOn')}
      </Link>
    </>
  );
}

function Limited({ until }: { until: Date | null }) {
  const { t } = useTranslation();
  const landing = useLanding();

  return (
    <>
      <div className="notice notice-attention" role="status">
        <span className="mark mark-attention" aria-hidden="true">
          !
        </span>
        <p>
          {until == null
            ? t('requestToJoin.limitedLater')
            : t('requestToJoin.limited', { time: formatTimeOfDay(until, currentLocale()) })}
        </p>
      </div>
      <Link className="button" to={landing}>
        {t('requestToJoin.carryOn')}
      </Link>
    </>
  );
}

function Standing({ preview }: { preview: RequestLinkPreview }) {
  const { t } = useTranslation();
  const landing = useLanding();
  const organisation = preview.organisation.name;
  const from = preview.askAgainFrom;
  const body =
    preview.standing === 'member'
      ? t('requestToJoin.member', { organisation })
      : preview.standing === 'waiting'
        ? t('requestToJoin.waiting', { organisation })
        : from == null
          ? t('requestToJoin.coolingOffLater', { organisation })
          : t('requestToJoin.coolingOff', {
              organisation,
              date: formatDay(from, currentLocale()),
            });

  return (
    <>
      <div className="notice notice-quiet" role="status">
        <span className="mark mark-info" aria-hidden="true">
          i
        </span>
        <p>{body}</p>
      </div>
      <Link className="button button-primary" to={landing}>
        {preview.standing === 'member'
          ? t('requestToJoin.open', { organisation })
          : t('requestToJoin.carryOn')}
      </Link>
    </>
  );
}
