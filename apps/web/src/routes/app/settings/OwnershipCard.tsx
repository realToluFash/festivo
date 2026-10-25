import {
  ApiError,
  type Membership,
  type OrganisationDeletion,
  type OrganisationMember,
} from '@soirely/api-client';
import { roleName } from '@soirely/domain';
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { useFormChecks } from '../../../formChecks.ts';
import { offButton } from '../../../offButton.ts';
import { focusWhereSent, offField } from '../../../offField.ts';
import { refreshAccount } from '../../../session.ts';
import { focusStep, useFocusOnceShown, useStepFocus } from '../../../stepFocus.ts';

type Opener = 'transfer' | 'leave' | 'delete';

type Step =
  | { kind: 'resting'; flash: string | null }
  | { kind: 'transfer'; from: Opener }
  | { kind: 'leave' }
  | { kind: 'delete' };

/** General's "Ownership and leaving" (sc-68): hand the organisation on, leave it, or delete it. */
export function OwnershipCard({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const owner = organisation.role.seededAs === 'owner';
  const [step, setStep] = useState<Step>({ kind: 'resting', flash: null });
  const [members, setMembers] = useState<OrganisationMember[] | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const transferButton = useRef<HTMLButtonElement>(null);
  const leaveButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const land = useFocusOnceShown();

  useEffect(() => {
    if (!owner) return;
    let current = true;

    api.members(organisation.id).then(
      (list) => current && setMembers(list.members),
      () => current && setMembers(null),
    );

    return () => {
      current = false;
    };
  }, [organisation.id, owner]);

  function rest(back: Opener): void {
    setStep({ kind: 'resting', flash: null });
    const opener = { transfer: transferButton, leave: leaveButton, delete: deleteButton }[back];
    land(() => opener.current ?? title.current);
  }

  const others = (members ?? []).filter((one) => one.status === 'active' && !one.self);
  const onlyOwner =
    owner &&
    members != null &&
    !members.some((one) => !one.self && one.status === 'active' && one.role.seededAs === 'owner');

  return (
    <section className="card settings-card" aria-labelledby="ownership-title">
      <h2 id="ownership-title" ref={title} tabIndex={-1}>
        {t('ownership.title')}
      </h2>

      {step.kind === 'resting' && (
        <>
          {step.flash != null && (
            <div className="notice notice-done" ref={flash} tabIndex={-1}>
              <span className="mark mark-done" aria-hidden="true">
                ✓
              </span>
              <p>{step.flash}</p>
            </div>
          )}
          {owner && (
            <div className="ownership-row">
              <div>
                <p className="notice-title">{t('ownership.transfer')}</p>
                <p className="muted">
                  {t('ownership.transferNote', { organisation: organisation.name })}
                </p>
              </div>
              <button
                type="button"
                className="button"
                ref={transferButton}
                onClick={() => setStep({ kind: 'transfer', from: 'transfer' })}
              >
                {t('ownership.transfer')}
              </button>
            </div>
          )}
          <div className="ownership-row">
            <div>
              <p className="notice-title">
                {t('ownership.leave', { organisation: organisation.name })}
              </p>
              <p className="muted">
                {t('ownership.leaveNote', { organisation: organisation.name })}
              </p>
            </div>
            <button
              type="button"
              className="button"
              ref={leaveButton}
              onClick={() => setStep({ kind: 'leave' })}
            >
              {t('ownership.leave', { organisation: organisation.name })}
            </button>
          </div>
          {owner && (
            <div className="ownership-row">
              <div>
                <p className="notice-title">{t('ownership.delete')}</p>
                <p className="muted">{t('ownership.deleteNote')}</p>
              </div>
              <button
                type="button"
                className="button button-danger"
                ref={deleteButton}
                onClick={() => setStep({ kind: 'delete' })}
              >
                {t('ownership.delete')}
              </button>
            </div>
          )}
        </>
      )}

      {step.kind === 'transfer' && (
        <Transfer
          organisation={organisation}
          candidates={others}
          onCancel={() => rest(step.from)}
          onDone={(name) => {
            setStep({
              kind: 'resting',
              flash: t('ownership.transferred', { name, organisation: organisation.name }),
            });
            land(() => flash.current);
          }}
        />
      )}

      {step.kind === 'leave' && (
        <Leave
          organisation={organisation}
          onlyOwner={onlyOwner}
          onTransfer={() => setStep({ kind: 'transfer', from: 'leave' })}
          onStay={() => rest('leave')}
        />
      )}

      {step.kind === 'delete' && (
        <Delete organisation={organisation} onKeep={() => rest('delete')} />
      )}
    </section>
  );
}

type TransferField = 'owner' | 'password' | 'code';

function Transfer({
  organisation,
  candidates,
  onCancel,
  onDone,
}: {
  organisation: Membership;
  candidates: OrganisationMember[];
  onCancel: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeAsked, setCodeAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<{ field: TransferField | null; message: string } | null>(
    null,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const chosen = candidates.find((one) => one.id === picked) ?? null;

  useEffect(() => heading.current?.focus(), []);

  const checks = useFormChecks<TransferField>(
    ['owner', 'password', 'code'],
    (field, value) => {
      if (field === 'owner') return value === '' ? t('ownership.ownerBlank') : null;
      if (field === 'password')
        return pending == null && value === '' ? t('ownership.passwordBlank') : null;

      return codeAsked && value.trim() === '' ? t('ownership.codeBlank') : null;
    },
    (field) =>
      field === 'password'
        ? passwordInput.current?.focus()
        : document.getElementById(field === 'owner' ? 'transfer-owner' : 'transfer-code')?.focus(),
  );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || !checks.passes({ owner: picked ?? '', password, code })) return;
    if (chosen == null) return;

    setBusy(true);
    setRefused(null);
    const land = focusWhereSent();

    try {
      const first = pending != null ? { pendingProof: pending } : { password };
      const { proof } = await api.prove(first, codeAsked ? code.trim() : undefined);
      await api.transferOwnership(organisation.id, chosen.id, proof);
      await refreshAccount();
      onDone(chosen.user.name);
    } catch (error) {
      setBusy(false);
      if (!(error instanceof ApiError)) {
        setRefused({ field: null, message: t('membersScreen.actionFailed') });

        return;
      }

      setPending(error.problem.pendingProof ?? pending);

      if (error.is('two_factor_required')) {
        // The field the answer asks for, once it is there to take focus.
        flushSync(() => setCodeAsked(true));
        land('transfer-code');
      } else if (error.is('invalid_credentials')) {
        setRefused({ field: 'password', message: t('ownership.passwordWrong') });
        land('transfer-password');
      } else if (error.is('two_factor_code_invalid') || error.is('recovery_code_used')) {
        setRefused({ field: 'code', message: error.problem.title });
        land('transfer-code');
      } else {
        setRefused({ field: null, message: error.problem.title });
      }
    }
  }

  const ownerError = checks.errors.owner ?? null;
  const passwordError =
    checks.errors.password ?? (refused?.field === 'password' ? refused.message : null);
  const codeError = checks.errors.code ?? (refused?.field === 'code' ? refused.message : null);

  return (
    <form className="settings-form" noValidate onSubmit={(event) => void submit(event)}>
      <h3 tabIndex={-1} ref={heading}>
        {t('ownership.transfer')}
      </h3>
      <p className="muted">{t('ownership.transferBody', { organisation: organisation.name })}</p>

      {refused?.field === null && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{refused.message}</p>
        </div>
      )}

      <fieldset
        className="members-roles"
        id="transfer-owner"
        tabIndex={-1}
        aria-invalid={ownerError != null}
        aria-describedby={ownerError != null ? 'transfer-owner-error' : undefined}
      >
        <legend>{t('ownership.newOwner')}</legend>
        {candidates.map((one) => (
          <label key={one.id} className="members-role">
            <input
              type="radio"
              aria-label={one.user.name}
              name="new-owner"
              value={one.id}
              checked={picked === one.id}
              disabled={busy}
              onChange={() => {
                setPicked(one.id);
                checks.edited('owner', one.id);
              }}
            />
            <span className="members-role-text">
              <span className="members-row-name">{one.user.name}</span>
              <span className="muted">{roleName(t, one.role)}</span>
            </span>
          </label>
        ))}
        {ownerError != null && <FieldError id="transfer-owner-error" message={ownerError} />}
      </fieldset>

      {pending == null && (
        <div className="field">
          <label htmlFor="transfer-password">{t('ownership.password')}</label>
          <PasswordField
            id="transfer-password"
            autoComplete="current-password"
            wrong={passwordError != null}
            disabled={busy}
            submitting={busy}
            describedBy={
              passwordError != null ? 'transfer-password-error' : 'transfer-password-why'
            }
            value={password}
            inputRef={passwordInput}
            onChange={(typed) => {
              setPassword(typed);
              if (refused?.field === 'password') setRefused(null);
              checks.edited('password', typed);
            }}
            onBlur={(typed) => checks.left('password', typed)}
          />
          {passwordError != null && (
            <FieldError id="transfer-password-error" message={passwordError} />
          )}
          <p className="muted" id="transfer-password-why">
            {t('ownership.passwordWhy', { organisation: organisation.name })}
          </p>
        </div>
      )}

      {codeAsked && (
        <div className="field">
          <label htmlFor="transfer-code">{t('ownership.code')}</label>
          <input
            className={codeError != null ? 'input input-wrong' : 'input'}
            id="transfer-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            {...offField(busy)}
            aria-invalid={codeError != null}
            aria-describedby={codeError != null ? 'transfer-code-error' : undefined}
            onChange={(event) => {
              setCode(event.target.value);
              if (refused?.field === 'code') setRefused(null);
              checks.edited('code', event.target.value);
            }}
            onBlur={(event) => checks.left('code', event.target.value)}
          />
          {codeError != null && <FieldError id="transfer-code-error" message={codeError} />}
        </div>
      )}

      <p className="muted">
        {t('ownership.bothEmailed', {
          name: chosen?.user.name ?? t('ownership.theNewOwner'),
        })}
      </p>

      <div className="actions">
        <button className="button button-primary" type="submit" aria-busy={busy}>
          {chosen == null
            ? t('ownership.transfer')
            : t('ownership.makeOwner', { name: chosen.user.name })}
        </button>
        <button className="button" type="button" onClick={onCancel}>
          {t('ownership.keep')}
        </button>
      </div>
    </form>
  );
}

function Leave({
  organisation,
  onlyOwner,
  onTransfer,
  onStay,
}: {
  organisation: Membership;
  onlyOwner: boolean;
  onTransfer: () => void;
  onStay: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [refusedLast, setRefusedLast] = useState(false);
  const [openedOnlyOwner] = useState(onlyOwner);
  const lastOwner = onlyOwner || refusedLast;
  const heading = useRef<HTMLHeadingElement>(null);
  const [onlyOwnerNotice, arriveAtOnlyOwner] = useStepFocus<HTMLDivElement>();

  useLayoutEffect(() => focusStep(heading.current), []);

  async function leave(): Promise<void> {
    setBusy(true);
    setRefused(null);

    try {
      await api.leaveOrganisation(organisation.id);
      await refreshAccount();
      void navigate('/app');
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.is('last_owner')) {
        setRefusedLast(true);
        arriveAtOnlyOwner();
      } else
        setRefused(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
    }
  }

  return (
    <div className="settings-form">
      <h3 tabIndex={-1} ref={heading}>
        {t('ownership.leaveTitle', { organisation: organisation.name })}
      </h3>
      {lastOwner ? (
        <>
          <div
            className="notice notice-attention"
            role={openedOnlyOwner || refusedLast ? undefined : 'alert'}
          >
            <span className="mark mark-attention" aria-hidden="true">
              !
            </span>
            <div className="notice-body" ref={onlyOwnerNotice} tabIndex={-1}>
              <p className="notice-title">{t('ownership.onlyOwnerTitle')}</p>
              <p>{t('ownership.onlyOwnerBody')}</p>
            </div>
          </div>
          <div className="actions">
            <button type="button" className="button button-primary" onClick={onTransfer}>
              {t('ownership.transfer')}
            </button>
            <button type="button" className="button" onClick={onStay}>
              {t('ownership.stay')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{t('ownership.leaveBody', { organisation: organisation.name })}</p>
          {refused != null && <FieldError id="leave-failed" message={refused} />}
          <div className="actions">
            <button
              type="button"
              className="button button-danger"
              aria-busy={busy}
              {...offButton(busy)}
              onClick={() => void leave()}
            >
              {t('ownership.leave', { organisation: organisation.name })}
            </button>
            <button type="button" className="button" onClick={onStay}>
              {t('ownership.stay')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Delete({ organisation, onKeep }: { organisation: Membership; onKeep: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<OrganisationDeletion | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const matches = typed.trim() === organisation.name;
  const heading = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => focusStep(heading.current), []);

  useEffect(() => {
    let current = true;

    api.organisationDeletion(organisation.id).then(
      (counted) => current && setPreview(counted),
      () => {},
    );

    return () => {
      current = false;
    };
  }, [organisation.id]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;

    if (!matches) {
      setMismatch(t('ownership.deleteMismatch', { organisation: organisation.name }));
      document.getElementById('delete-confirm')?.focus();

      return;
    }

    setBusy(true);
    setFailed(null);
    const land = focusWhereSent();

    try {
      await api.deleteOrganisation(organisation.id, typed);
      await refreshAccount();
      void navigate('/app');
    } catch (error) {
      setBusy(false);
      const violation =
        error instanceof ApiError
          ? error.problem.violations?.find((one) => one.propertyPath === 'name')
          : undefined;

      if (violation != null) {
        setMismatch(violation.message);
        land('delete-confirm');
      } else {
        setFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
      }
    }
  }

  return (
    <form className="settings-form" noValidate onSubmit={(event) => void submit(event)}>
      <h3 tabIndex={-1} ref={heading}>
        {t('ownership.deleteTitle', { organisation: organisation.name })}
      </h3>
      <div className="notice notice-attention">
        <span className="mark mark-attention" aria-hidden="true">
          !
        </span>
        <div className="notice-body">
          <p className="notice-title">{t('ownership.deleteWarningTitle')}</p>
          <div>
            {preview == null && <p>{t('ownership.deleteLoading')}</p>}
            {/* Mounted empty with the heading, so only the counts are announced, when they come. */}
            <div role="alert">
              {preview != null && (
                <p>
                  {t('ownership.deleteCounts', {
                    events: t('ownership.events', { count: preview.events }),
                    guests: t('ownership.guests', { count: preview.guests }),
                    members: t('ownership.members', { count: preview.members }),
                  })}{' '}
                  {t('ownership.deleteWindow', { deadline: preview.restoreCloses })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {failed != null && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{failed}</p>
        </div>
      )}

      <div className="field">
        <label htmlFor="delete-confirm">
          {t('ownership.deleteType', { organisation: organisation.name })}
        </label>
        <input
          className={mismatch != null ? 'input input-wrong' : 'input'}
          id="delete-confirm"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={typed}
          {...offField(busy)}
          aria-invalid={mismatch != null}
          aria-describedby={mismatch != null ? 'delete-confirm-error' : 'delete-confirm-note'}
          onChange={(event) => {
            setTyped(event.target.value);
            if (event.target.value.trim() === organisation.name) setMismatch(null);
          }}
        />
        {mismatch != null && <FieldError id="delete-confirm-error" message={mismatch} />}
        <p className="muted" id="delete-confirm-note">
          {matches ? t('ownership.deleteMatches') : t('ownership.deleteExactly')}
        </p>
      </div>

      <div className="actions">
        <button className="button button-danger" type="submit" aria-busy={busy}>
          {t('ownership.deleteButton', { organisation: organisation.name })}
        </button>
        <button className="button" type="button" onClick={onKeep}>
          {t('ownership.deleteKeep', { organisation: organisation.name })}
        </button>
      </div>
    </form>
  );
}
