import { ApiError, type InvitationPreview, type InvitationRefusal } from '@soirely/api-client';
import { PASSWORD_MINIMUM_LENGTH, formatDay, meetsPasswordLength, roleName } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { HaveAccount, OrganisationLine, SignedInAs } from '../../components/Onboarding.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { PasswordRule } from '../../components/PasswordRule.tsx';
import { PendingPage } from '../../components/Pending.tsx';
import { StillSignedIn } from '../../components/StillSignedIn.tsx';
import { RequestToJoin } from './RequestToJoin.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { useFormChecks } from '../../formChecks.ts';
import { dropHeldInvitation, holdInvitation } from '../../heldInvitation.ts';
import { dateLocale } from '../../i18n/index.ts';
import { useLinkRetry } from '../../linkRetry.ts';
import { offButton } from '../../offButton.ts';
import { focusWhereSent, offField } from '../../offField.ts';
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

  if (session.status === 'unreachable') return <Unreachable signedIn={false} bare />;
  if (view.kind === 'unreachable') {
    return <Unreachable signedIn={session.status === 'signedIn'} retry={retry} bare />;
  }
  if (view.kind === 'loading') return <PendingPage />;

  if (view.kind === 'notFound') {
    return (
      <AuthPage bare end={null}>
        <div className="auth-heading">
          <h1 ref={stepHeading} tabIndex={-1}>
            {t('join.notFoundTitle')}
          </h1>
          <p role={brought ? undefined : 'status'}>{t('join.notFoundBody')}</p>
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
  const session = useSessionState();
  const { preview } = view;
  const words = useWords(preview);
  const deleted = view.kind === 'refused' && view.refusal === 'organisation_deleted';
  const registering = view.kind === 'open' && preview.forYou == null;
  const { signOut, unreached } = useSignOut(onReload);
  const organisation = (
    <OrganisationLine
      name={words.organisation}
      line={
        deleted
          ? t('join.orgDeleted')
          : t('join.orgLine', { inviter: words.inviter, role: words.role })
      }
    />
  );

  return (
    <AuthPage
      bare
      end={
        registering ? (
          <HaveAccount onSignIn={() => holdInvitation(token)} />
        ) : session.status === 'signedIn' ? (
          <SignedInAs email={session.session.email} onSignOut={() => void signOut()} />
        ) : null
      }
    >
      <div className="auth-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          {title(t, view, words.organisation)}
        </h1>
        {underTitle(t, view, words, brought)}
      </div>

      {view.kind === 'open' ? (
        <div className="auth-invited">
          {organisation}
          <div className="auth-invited-lines">
            <p>
              {registering
                ? t('join.invited', {
                    inviter: words.inviter,
                    email: preview.email,
                    role: words.role,
                  })
                : t('join.invitedYou', { inviter: words.inviter, role: words.role })}
            </p>
            <p className="muted">{t('join.worksUntil', { date: words.until })}</p>
          </div>
        </div>
      ) : (
        organisation
      )}

      {view.kind === 'open' && preview.forYou == null && (
        <Register token={token} preview={preview} onChange={onChange} />
      )}
      {view.kind === 'open' && preview.forYou === true && (
        <Answer preview={preview} onChange={onChange} />
      )}
      {view.kind === 'emailTaken' && <EmailTaken token={token} />}
      {view.kind === 'accepted' && <Accepted preview={preview} />}
      {view.kind === 'declined' && <Declined />}
      {view.kind === 'refused' && (
        <Refused preview={preview} refusal={view.refusal} onSignOut={() => void signOut()} />
      )}
      {unreached && <StillSignedIn />}
    </AuthPage>
  );
}

/** The one line under the title: what happened, without saying the title again. */
function underTitle(
  t: TFunction,
  view: Exclude<View, { kind: 'loading' | 'notFound' | 'unreachable' }>,
  words: ReturnType<typeof useWords>,
  brought: boolean,
) {
  const said = (text: string) => <p role={brought ? undefined : 'status'}>{text}</p>;

  if (view.kind === 'accepted') {
    return said(t('join.joined', { organisation: words.organisation, role: words.role }));
  }
  if (view.kind === 'declined') return said(t('join.declinedBody', { inviter: words.inviter }));
  if (view.kind === 'emailTaken') {
    return said(t('join.emailTakenBody', { email: view.preview.email }));
  }
  if (view.kind === 'refused') {
    return said(
      t(`join.refused.${view.refusal}.line`, {
        inviter: words.inviter,
        organisation: words.organisation,
        email: view.preview.email,
        signedInAs: view.preview.signedInAs ?? '',
      }),
    );
  }

  return null;
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
    if (busy) return;

    const name = String(new FormData(event.currentTarget).get('name') ?? '');

    if (!checks.passes({ name, password })) return;

    setBusy(true);
    setFailed(false);
    const land = focusWhereSent();

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
      settle(error, land);
    }
  }

  function settle(error: unknown, land: (id: string) => void): void {
    if (!(error instanceof ApiError)) {
      setFailed(true);
      return;
    }

    if (error.is('invitation_not_found')) {
      onChange({ kind: 'notFound' });
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

      const first = (['name', 'password'] as const).find((field) => found[field] != null);
      if (first != null) land(`join-${first}`);
      return;
    }

    setFailed(true);
  }

  return (
    <>
      {failed && (
        <div className="auth-notice" role="alert">
          <p className="auth-notice-title">{t('join.failedTitle')}</p>
          <p>{t('register.failedBody')}</p>
        </div>
      )}

      <form className="auth-form join-register" noValidate onSubmit={(event) => void submit(event)}>
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
            {...offField(busy)}
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
    </>
  );
}

function EmailTaken({ token }: { token: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
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
        onChange({ kind: 'accepted', preview: { ...preview, role: membership.role } });
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
      {failed && (
        <div className="auth-notice" role="alert">
          <p className="auth-notice-title">{t('join.answerFailedTitle')}</p>
          <p>{t('register.failedBody')}</p>
        </div>
      )}

      <div className="auth-choices">
        <div className="auth-answers">
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
        </div>
        <p className="muted">{t('join.declineNote', { inviter: words.inviter })}</p>
      </div>
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
    <Link className="button button-primary" to={landing}>
      {t('join.open', { organisation: words.organisation })}
    </Link>
  );
}

function Declined() {
  const { t } = useTranslation();
  const landing = useLanding();

  return (
    <Link className="button" to={landing}>
      {t('join.goHome')}
    </Link>
  );
}

function Refused({
  preview,
  refusal,
  onSignOut,
}: {
  preview: InvitationPreview;
  refusal: Refusal;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const words = useWords(preview);
  const landing = useLanding();

  return (
    <>
      {refusal === 'invitation_accepted' && (
        <Link className="button button-primary" to={landing}>
          {t('join.open', { organisation: words.organisation })}
        </Link>
      )}

      {refusal === 'invitation_not_yours' && (
        <>
          <button className="button button-primary" type="button" onClick={onSignOut}>
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
