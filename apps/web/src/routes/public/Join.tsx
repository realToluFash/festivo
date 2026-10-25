import { ApiError, type InvitationPreview, type InvitationRefusal } from '@soirely/api-client';
import {
  PASSWORD_MINIMUM_LENGTH,
  formatDay,
  initials,
  meetsPasswordLength,
  roleName,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { PasswordRule } from '../../components/PasswordRule.tsx';
import { Pending } from '../../components/Pending.tsx';
import { StillSignedIn } from '../../components/StillSignedIn.tsx';
import { RequestToJoin } from './RequestToJoin.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { useFormChecks } from '../../formChecks.ts';
import { dropHeldInvitation, holdInvitation } from '../../heldInvitation.ts';
import { dateLocale } from '../../i18n/index.ts';
import { useLinkRetry } from '../../linkRetry.ts';
import { offButton } from '../../offButton.ts';
import {
  adoptAccount,
  landingFor,
  refreshAccount,
  restoreSession,
  switchOrganisation,
  useSessionState,
} from '../../session.ts';
import { useStepFocus } from '../../stepFocus.ts';
import { useSignOut } from '../../signOut.ts';

type Refusal = InvitationRefusal | 'invitation_not_yours';

type View =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'unreachable' }
  | { kind: 'open'; preview: InvitationPreview }
  | { kind: 'emailTaken'; preview: InvitationPreview }
  | { kind: 'accepted'; preview: InvitationPreview }
  | { kind: 'declined'; preview: InvitationPreview }
  | { kind: 'refused'; preview: InvitationPreview; refusal: Refusal };

const REFUSALS: readonly Refusal[] = [
  'invitation_expired',
  'invitation_revoked',
  'invitation_accepted',
  'invitation_declined',
  'organisation_deleted',
  'invitation_not_yours',
];

/** An invitation's token is 64 hex characters; an organisation's request link (sc-562) is 32. */
const REQUEST_LINK_TOKEN = /^[0-9a-f]{32}$/i;

/** Both kinds of link open /join/<token>: a request link asks to join, anything else is an invitation. */
export function Join() {
  const { token = '' } = useParams();

  return REQUEST_LINK_TOKEN.test(token) ? (
    <RequestToJoin token={token} />
  ) : (
    <Invited token={token} />
  );
}

/** The page an invitation's email links to (sc-67): register, sign in, or answer it. */
function Invited({ token }: { token: string }) {
  const { t } = useTranslation();
  const session = useSessionState();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [stepHeading, arriveAtStep] = useStepFocus();
  const [brought, setBrought] = useState(false);
  const settled = session.status === 'signedIn' || session.status === 'signedOut';

  const [attempt, setAttempt] = useState(0);
  const reloadArrives = useRef(false);
  const reload = () => {
    reloadArrives.current = true;
    setAttempt((n) => n + 1);
  };
  const retry = useLinkRetry(view, reload);

  useEffect(() => {
    dropHeldInvitation();
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!settled) return;
    let current = true;

    api.invitationLink(token).then(
      (preview) => {
        if (!current) return;
        setView(viewOf(preview));
        if (reloadArrives.current) {
          setBrought(true);
          arriveAtStep();
        }
        reloadArrives.current = false;
      },
      (error: unknown) => {
        if (!current) return;
        const missing = error instanceof ApiError && error.is('invitation_not_found');
        setView({ kind: missing ? 'notFound' : 'unreachable' });
        if (missing && reloadArrives.current) {
          setBrought(true);
          arriveAtStep();
        }
        reloadArrives.current = false;
      },
    );

    return () => {
      current = false;
    };
  }, [settled, token, attempt, arriveAtStep]);

  if (session.status === 'unreachable') return <Unreachable signedIn={false} />;
  if (view.kind === 'unreachable') {
    return <Unreachable signedIn={session.status === 'signedIn'} retry={retry} />;
  }
  if (view.kind === 'loading') return <Pending />;

  if (view.kind === 'notFound') {
    return (
      <AuthPage>
        <div className="auth-heading">
          <h1 ref={stepHeading} tabIndex={-1}>
            {t('join.notFoundTitle')}
          </h1>
        </div>
        <div className="notice notice-quiet" role={brought ? undefined : 'status'}>
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <div className="notice-body">
            <p>{t('join.notFoundBody')}</p>
          </div>
        </div>
        <Link className="button" to="/">
          {t('join.goHome')}
        </Link>
      </AuthPage>
    );
  }

  return (
    <JoinPage
      key={brought ? `${view.kind}:brought` : view.kind}
      token={token}
      view={view}
      brought={brought}
      headingRef={stepHeading}
      onChange={(next) => {
        setView(next);
        setBrought(true);
        arriveAtStep();
      }}
      onReload={reload}
    />
  );
}

function viewOf(preview: InvitationPreview): View {
  if (preview.forYou === false) {
    return { kind: 'refused', preview, refusal: 'invitation_not_yours' };
  }
  if (preview.refusal != null) return { kind: 'refused', preview, refusal: preview.refusal };

  return { kind: 'open', preview };
}

function JoinPage({
  token,
  view,
  brought,
  headingRef,
  onChange,
  onReload,
}: {
  token: string;
  view: Exclude<View, { kind: 'loading' | 'notFound' | 'unreachable' }>;
  brought: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChange: (next: View) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const { preview } = view;
  const words = useWords(preview);
  const deleted = view.kind === 'refused' && view.refusal === 'organisation_deleted';

  return (
    <AuthPage>
      <div className="auth-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          {title(t, view, words.organisation)}
        </h1>
      </div>

      <div className="join-org">
        <span className="org-tile" aria-hidden="true">
          {initials(words.organisation)}
        </span>
        <div className="org-naming">
          <p className="org-name">{words.organisation}</p>
          <p className="org-role">
            {deleted
              ? t('join.orgDeleted')
              : t('join.orgLine', { inviter: words.inviter, role: words.role })}
          </p>
        </div>
      </div>

      {view.kind === 'open' && preview.forYou == null && (
        <Register token={token} preview={preview} onChange={onChange} />
      )}
      {view.kind === 'open' && preview.forYou === true && (
        <Answer preview={preview} onChange={onChange} />
      )}
      {view.kind === 'emailTaken' && <EmailTaken token={token} email={preview.email} />}
      {view.kind === 'accepted' && <Accepted preview={preview} />}
      {view.kind === 'declined' && <Declined inviter={words.inviter} />}
      {view.kind === 'refused' && (
        <Refused preview={preview} refusal={view.refusal} brought={brought} onReload={onReload} />
      )}
    </AuthPage>
  );
}

/** The names every sentence on the page is made of: the role worded in the reader's language. */
function useWords(preview: InvitationPreview) {
  const { t } = useTranslation();

  return {
    organisation: preview.organisation.name,
    inviter: preview.invitedBy?.name ?? preview.organisation.name,
    role: preview.role == null ? '' : roleName(t, preview.role),
    until: formatDay(preview.expiresAt, dateLocale()),
  };
}

function title(
  t: TFunction,
  view: Exclude<View, { kind: 'loading' | 'notFound' | 'unreachable' }>,
  organisation: string,
): string {
  if (view.kind === 'refused') return t(`join.refused.${view.refusal}.title`, { organisation });
  if (view.kind === 'emailTaken') return t('join.emailTakenTitle');
  if (view.kind === 'accepted') return t('join.acceptedTitle');
  if (view.kind === 'declined') return t('join.declinedTitle');

  return view.preview.forYou === true
    ? t('join.answerTitle', { organisation })
    : t('join.registerTitle', { organisation });
}

function Register({
  token,
  preview,
  onChange,
}: {
  token: string;
  preview: InvitationPreview;
  onChange: (next: View) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const words = useWords(preview);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState<Partial<Record<'name' | 'password', string>>>({});
  const passwordInput = useRef<HTMLInputElement>(null);
  const lengthMet = meetsPasswordLength(password);
  const checks = useFormChecks(
    ['name', 'password'] as const,
    (field, value) => {
      if (field === 'name') return value.trim() === '' ? t('register.nameBlank') : null;
      if (value === '') return t('join.passwordBlank');

      return meetsPasswordLength(value)
        ? null
        : t('join.passwordShort', { count: PASSWORD_MINIMUM_LENGTH });
    },
    (field) => document.getElementById(`join-${field}`)?.focus(),
  );
  const errors = { ...refused, ...checks.errors };

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const name = String(new FormData(event.currentTarget).get('name') ?? '');

    if (!checks.passes({ name, password })) return;

    setBusy(true);
    setFailed(false);

    try {
      const signedIn = await api.registerFromInvitation(
        token,
        preview.email,
        name.trim(),
        password,
      );
      await adoptAccount(signedIn.account);
      if (preview.organisation.id != null) switchOrganisation(preview.organisation.id);
      onChange({ kind: 'accepted', preview });
    } catch (error) {
      setBusy(false);
      settle(error);
    }
  }

  function settle(error: unknown): void {
    if (!(error instanceof ApiError)) {
      setFailed(true);
      return;
    }

    if (error.is('email_taken')) {
      onChange({ kind: 'emailTaken', preview });
      return;
    }

    const refusal = REFUSALS.find((code) => error.is(code));

    if (refusal != null) {
      onChange({ kind: 'refused', preview, refusal });
      return;
    }

    if (error.is('validation_failed')) {
      const found: Partial<Record<'name' | 'password', string>> = {};

      for (const violation of error.problem.violations ?? []) {
        if (violation.propertyPath === 'name' || violation.propertyPath === 'password') {
          found[violation.propertyPath] ??=
            violation.code === 'password_breached' ? t('register.breached') : violation.message;
        }
      }

      setRefused(found);
      return;
    }

    setFailed(true);
  }

  function signIn(): void {
    holdInvitation(token);
    navigate('/sign-in');
  }

  return (
    <>
      <p>{t('join.invited', { inviter: words.inviter, email: preview.email, role: words.role })}</p>
      <p className="muted">{t('join.worksUntil', { date: words.until })}</p>

      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('join.failedTitle')}</p>
            <p>{t('register.failedBody')}</p>
          </div>
        </div>
      )}

      <h2 className="join-subheading">{t('join.createTitle')}</h2>

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="join-email">{t('register.email')}</label>
          <input
            className="input input-locked"
            id="join-email"
            type="email"
            value={preview.email}
            readOnly
            aria-describedby="join-email-help"
          />
          <p className="field-help" id="join-email-help">
            {t('join.emailLocked')}
          </p>
        </div>

        <div className="field">
          <label htmlFor="join-name">{t('register.name')}</label>
          <input
            className={errors.name ? 'input input-wrong' : 'input'}
            id="join-name"
            name="name"
            type="text"
            autoComplete="name"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            aria-invalid={errors.name != null}
            aria-describedby={errors.name ? 'join-name-error' : undefined}
            onBlur={(event) => checks.left('name', event.target.value)}
            onChange={(event) => {
              setRefused(({ name: _, ...rest }) => rest);
              checks.edited('name', event.target.value);
            }}
          />
          {errors.name && <FieldError id="join-name-error" message={errors.name} />}
        </div>

        <div className="field">
          <label htmlFor="join-password">{t('register.password')}</label>
          <PasswordField
            id="join-password"
            autoComplete="new-password"
            inputRef={passwordInput}
            value={password}
            onChange={(value) => {
              setPassword(value);
              setRefused(({ password: _, ...rest }) => rest);
              checks.edited('password', value);
            }}
            onBlur={(value) => checks.left('password', value)}
            wrong={errors.password != null}
            disabled={busy}
            submitting={busy}
            describedBy={
              errors.password ? 'join-password-error join-password-rule' : 'join-password-rule'
            }
          />
          {errors.password && <FieldError id="join-password-error" message={errors.password} />}
        </div>

        <PasswordRule met={lengthMet} id="join-password-rule" />

        <button className="button button-primary" type="submit" aria-busy={busy}>
          {busy ? t('join.joining') : t('join.createAndJoin')}
        </button>
      </form>

      <div className="auth-footnote">
        <span>{t('join.haveAccount')}</span>
        <button className="link-button" type="button" onClick={signIn}>
          {t('register.signIn')}
        </button>
      </div>
    </>
  );
}

function EmailTaken({ token, email }: { token: string; email: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <div className="notice notice-quiet">
        <span className="mark mark-info" aria-hidden="true">
          i
        </span>
        <div className="notice-body">
          <p className="notice-title">{t('join.emailTakenHeading')}</p>
          <p>{t('join.emailTakenBody', { email })}</p>
        </div>
      </div>
      <button
        className="button button-primary"
        type="button"
        onClick={() => {
          holdInvitation(token);
          navigate('/sign-in');
        }}
      >
        {t('join.signInToAccept')}
      </button>
      <Link className="link-button" to="/forgot-password">
        {t('join.forgotPassword')}
      </Link>
    </>
  );
}

function Answer({
  preview,
  onChange,
}: {
  preview: InvitationPreview;
  onChange: (next: View) => void;
}) {
  const { t } = useTranslation();
  const words = useWords(preview);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [failed, setFailed] = useState(false);

  async function answer(choice: 'accept' | 'decline'): Promise<void> {
    setBusy(choice);
    setFailed(false);

    try {
      if (choice === 'accept') {
        const membership = await api.acceptInvitation(preview.id);
        await refreshAccount();
        switchOrganisation(membership.id);
        onChange({ kind: 'accepted', preview });
      } else {
        await api.declineInvitation(preview.id);
        onChange({ kind: 'declined', preview });
      }
    } catch (error) {
      setBusy(null);

      const refusal =
        error instanceof ApiError ? REFUSALS.find((code) => error.is(code)) : undefined;

      if (refusal != null) onChange({ kind: 'refused', preview, refusal });
      else setFailed(true);
    }
  }

  return (
    <>
      <p>{t('join.invitedYou', { inviter: words.inviter, role: words.role })}</p>
      <p className="muted">
        {t('join.signedInUntil', { email: preview.signedInAs ?? '', date: words.until })}
      </p>

      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('join.answerFailedTitle')}</p>
            <p>{t('register.failedBody')}</p>
          </div>
        </div>
      )}

      <button
        className="button button-primary"
        type="button"
        aria-busy={busy === 'accept'}
        disabled={busy === 'decline'}
        {...offButton(busy === 'accept')}
        onClick={() => void answer('accept')}
      >
        {t('join.accept')}
      </button>
      <button
        className="button"
        type="button"
        aria-busy={busy === 'decline'}
        disabled={busy === 'accept'}
        {...offButton(busy === 'decline')}
        onClick={() => void answer('decline')}
      >
        {t('join.decline')}
      </button>
      <p className="muted">{t('join.declineNote', { inviter: words.inviter })}</p>
    </>
  );
}

function useLanding(): string {
  const session = useSessionState();

  return session.status === 'signedIn' ? landingFor(session.session.awaiting) : '/app';
}

function Accepted({ preview }: { preview: InvitationPreview }) {
  const { t } = useTranslation();
  const words = useWords(preview);
  const landing = useLanding();

  return (
    <>
      <div className="notice notice-done">
        <span className="mark mark-done" aria-hidden="true">
          ✓
        </span>
        <p>{t('join.joined', { organisation: words.organisation, role: words.role })}</p>
      </div>
      <Link className="button button-primary" to={landing}>
        {t('join.open', { organisation: words.organisation })}
      </Link>
    </>
  );
}

function Declined({ inviter }: { inviter: string }) {
  const { t } = useTranslation();
  const landing = useLanding();

  return (
    <>
      <div className="notice notice-quiet">
        <span className="mark mark-info" aria-hidden="true">
          –
        </span>
        <p>{t('join.declinedBody', { inviter })}</p>
      </div>
      <Link className="button" to={landing}>
        {t('join.goToEvents')}
      </Link>
    </>
  );
}

function Refused({
  preview,
  refusal,
  brought,
  onReload,
}: {
  preview: InvitationPreview;
  refusal: Refusal;
  brought: boolean;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const words = useWords(preview);
  const landing = useLanding();
  const attention = refusal === 'invitation_expired' || refusal === 'invitation_not_yours';
  const done = refusal === 'invitation_accepted';
  const tone = attention ? 'notice-attention' : done ? 'notice-done' : 'notice-quiet';
  const mark = attention ? 'mark-attention' : done ? 'mark-done' : 'mark-info';

  const { signOut: switchAccount, unreached } = useSignOut(onReload);

  return (
    <>
      <div className={`notice ${tone}`} role={brought ? undefined : 'status'}>
        <span className={`mark ${mark}`} aria-hidden="true">
          {attention ? '!' : done ? '✓' : 'i'}
        </span>
        <div className="notice-body">
          <p className="notice-title">{t(`join.refused.${refusal}.word`)}</p>
          <p>
            {t(`join.refused.${refusal}.body`, {
              inviter: words.inviter,
              organisation: words.organisation,
              email: preview.email,
              signedInAs: preview.signedInAs ?? '',
            })}
          </p>
        </div>
      </div>

      {refusal === 'invitation_accepted' && (
        <Link className="button button-primary" to={landing}>
          {t('join.open', { organisation: words.organisation })}
        </Link>
      )}

      {refusal === 'invitation_not_yours' && (
        <>
          {unreached && <StillSignedIn />}
          <button
            className="button button-primary"
            type="button"
            onClick={() => void switchAccount()}
          >
            {t('join.signOutAndUse', { email: preview.email })}
          </button>
          <Link className="link-button" to={landing}>
            {t('join.staySignedIn', { email: preview.signedInAs ?? '' })}
          </Link>
        </>
      )}

      {refusal !== 'invitation_accepted' && refusal !== 'invitation_not_yours' && (
        <Link className="button" to="/">
          {t('join.goHome')}
        </Link>
      )}
    </>
  );
}
