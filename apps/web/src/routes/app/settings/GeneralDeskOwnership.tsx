import {
  ApiError,
  type Membership,
  type OrganisationDeletion,
  type OrganisationMember,
  type Provider,
  type ProviderSignInAttempt,
} from '@soirely/api-client';
import { PROOF_MINUTES, confirmWith, roleName, typedNameMatches } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { AppleMark, GoogleMark } from '../../../components/ProviderSignIn.tsx';
import {
  Ask,
  Choices,
  Dialog,
  Field,
  Head,
  Mark,
  Note,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { offButton } from '../../../offButton.ts';
import {
  PROVIDER_NAMES,
  type ProviderReturn,
  dropProviderReturn,
  heldProviderReturn,
  startProviderSignIn,
} from '../../../providerSignIn.ts';
import { refreshAccount, useSession } from '../../../session.ts';
import { DialogAlert } from './GeneralDeskDialogs.tsx';
import { ownsAndManages } from './organisationDetails.ts';

type Opened =
  | { kind: 'transfer'; returned: ProviderReturn | null }
  | { kind: 'delete' }
  | { kind: 'leave' }
  | { kind: 'onlyOwner' }
  | null;

/** Ownership and leaving at a desk: each step a text action with its note, each opening its dialog or confirm. */
export function Ownership({
  organisation,
  onTransferred,
}: {
  organisation: Membership;
  onTransferred: (name: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const owner = ownsAndManages(organisation);
  const { hasPassword, providers } = useSession();
  const via = confirmWith(hasPassword, providers);
  // Back from Google or Apple, started by Transfer ownership in this organisation: once, on arrival.
  const [returned] = useState(() => {
    const held = heldProviderReturn(['transfer']);

    return held?.purpose.kind === 'transfer' && held.purpose.organisation === organisation.id
      ? held
      : null;
  });
  const [opened, setOpened] = useState<Opened>(
    returned == null ? null : { kind: 'transfer', returned },
  );
  const [members, setMembers] = useState<OrganisationMember[] | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveFailed, setLeaveFailed] = useState<string | null>(null);

  // Removed only once committed: React may abandon a render and run the initializer again.
  useEffect(() => {
    if (returned != null) dropProviderReturn();
  }, [returned]);

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

  const others = (members ?? []).filter((one) => one.status === 'active' && !one.self);
  const onlyOwner =
    owner &&
    members != null &&
    !members.some((one) => !one.self && one.status === 'active' && one.role.seededAs === 'owner');

  async function leave(): Promise<void> {
    setLeaving(true);
    setLeaveFailed(null);

    try {
      await api.leaveOrganisation(organisation.id);
      await refreshAccount();
      void navigate('/app');
    } catch (error) {
      setLeaving(false);
      if (error instanceof ApiError && error.is('last_owner')) setOpened({ kind: 'onlyOwner' });
      else
        setLeaveFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
    }
  }

  const steps = [
    ...(owner
      ? [
          {
            key: 'transfer',
            label: t('ownership.transfer'),
            note:
              via === 'password' || via == null
                ? t('ownership.transferNote', { organisation: organisation.name })
                : t('ownership.transferNoteProvider', {
                    organisation: organisation.name,
                    provider: PROVIDER_NAMES[via],
                  }),
            red: false,
            open: () => setOpened({ kind: 'transfer', returned: null }),
          },
        ]
      : []),
    {
      key: 'leave',
      label: t('ownership.leaveOpener', { organisation: organisation.name }),
      note: t('ownership.leaveNote', { organisation: organisation.name }),
      red: true,
      open: () => {
        setLeaveFailed(null);
        setOpened({ kind: onlyOwner ? 'onlyOwner' : 'leave' });
      },
    },
    ...(owner
      ? [
          {
            key: 'delete',
            label: t('ownership.deleteOpener'),
            note: t('ownership.deleteNote'),
            red: true,
            open: () => setOpened({ kind: 'delete' }),
          },
        ]
      : []),
  ];

  return (
    <section className="desk-block">
      <Head title={t('ownership.title')} />
      <ul className="general-steps">
        {steps.map((step) => (
          <li key={step.key} className="desk-red">
            <TextAction label={step.label} red={step.red} onClick={step.open} />
            <p className="desk-note">{step.note}</p>
          </li>
        ))}
      </ul>
      {opened?.kind === 'onlyOwner' && (
        <Ask
          title={t('ownership.onlyOwnerTitle')}
          line={t('ownership.onlyOwnerBody')}
          keep={t('ownership.stay')}
          red={false}
          {...(owner
            ? {
                go: t('ownership.transfer'),
                onGo: () => setOpened({ kind: 'transfer', returned: null }),
              }
            : {})}
          onKeep={() => setOpened(null)}
        />
      )}
      {opened?.kind === 'leave' && (
        <Ask
          title={t('ownership.leaveTitle', { organisation: organisation.name })}
          line={t('ownership.leaveBody', { organisation: organisation.name })}
          keep={t('ownership.stay')}
          go={t('ownership.leave', { organisation: organisation.name })}
          busy={leaving ? t('generalDesk.leaving') : undefined}
          failed={leaveFailed ?? undefined}
          onKeep={() => setOpened(null)}
          onGo={() => void leave()}
        />
      )}
      {opened?.kind === 'transfer' && owner && (
        <TransferDialog
          organisation={organisation}
          via={via}
          returned={opened.returned}
          candidates={others}
          onClose={() => setOpened(null)}
          onDone={(name) => {
            setOpened(null);
            onTransferred(name);
          }}
        />
      )}
      {opened?.kind === 'delete' && owner && (
        <DeleteDialog organisation={organisation} onClose={() => setOpened(null)} />
      )}
    </section>
  );
}

type TransferField = 'owner' | 'password' | 'code';
type Problems = Partial<Record<TransferField | 'all', string>>;

/** Google or Apple brought the owner back: the proof, or the code still to come when two-factor is on. */
interface Vouched {
  email: string | null;
  proof: string | null;
}

/** Who becomes the owner, then the password, or Google or Apple; the code only once the server asks for it. */
function TransferDialog({
  organisation,
  via,
  returned,
  candidates,
  onClose,
  onDone,
}: {
  organisation: Membership;
  via: 'password' | Provider | null;
  returned: ProviderReturn | null;
  candidates: OrganisationMember[];
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation();
  const provider = via === 'password' ? null : via;
  const [opening] = useState<string | null>(
    returned?.purpose.kind === 'transfer' ? returned.purpose.owner : null,
  );
  const [picked, setPicked] = useState<string | null>(opening);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeAsked, setCodeAsked] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [vouched, setVouched] = useState<Vouched | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(returned != null && 'signIn' in returned);
  const [problems, setProblems] = useState<Problems>(() =>
    returned != null && 'failed' in returned
      ? { all: t('waysCard.providerFailed', { provider: PROVIDER_NAMES[returned.provider] }) }
      : {},
  );
  const [asking, setAsking] = useState(false);
  const group = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const exchanged = useRef(false);
  const chosen = candidates.find((one) => one.id === picked) ?? null;
  const asksPassword = provider == null && pending == null;
  const changes = [picked !== opening, password !== '', code !== ''].filter(Boolean).length;

  function land(found: Problems): void {
    setProblems(found);
    if (found.owner != null) group.current?.querySelector('input')?.focus();
    else if (found.password != null) passwordRef.current?.focus();
    else if (found.code != null) codeRef.current?.focus();
  }

  async function vouch(by: Provider, signIn: ProviderSignInAttempt): Promise<void> {
    try {
      const { proof } = await api.prove({ provider: by, signIn });
      setVouched({ email: null, proof });
    } catch (error) {
      if (error instanceof ApiError && error.is('two_factor_required')) {
        setPending(error.problem.pendingProof ?? null);
        setVouched({ email: error.problem.providerEmail ?? null, proof: null });
        flushSync(() => setCodeAsked(true));
        codeRef.current?.focus();
      } else {
        setProblems({
          all:
            error instanceof ApiError && error.is('invalid_credentials')
              ? t('waysCard.providerRefused', { provider: PROVIDER_NAMES[by] })
              : t('waysCard.providerFailed', { provider: PROVIDER_NAMES[by] }),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (returned == null || !('signIn' in returned) || exchanged.current) return;
    exchanged.current = true;
    void vouch(returned.provider, returned.signIn);
    // Once, on arrival: Google's or Apple's sign-in is single-use, and its five minutes count from now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function checked(): Problems {
    return {
      ...(picked == null && { owner: t('ownership.ownerBlank') }),
      ...(asksPassword && password === '' && { password: t('ownership.passwordBlank') }),
      ...(codeAsked && code.trim() === '' && { code: t('waysCard.codeBlank') }),
    };
  }

  function continueWith(by: Provider): void {
    const found = checked();
    if (busy || Object.keys(found).length > 0 || picked == null) return land(found);

    setProblems({});
    setExpired(false);
    void startProviderSignIn(by, {
      kind: 'transfer',
      organisation: organisation.id,
      owner: picked,
    }).catch(() =>
      setProblems({ all: t('waysCard.providerFailed', { provider: PROVIDER_NAMES[by] }) }),
    );
  }

  async function transfer(): Promise<void> {
    if (busy) return;
    const found = checked();
    if (Object.keys(found).length > 0) return land(found);
    if (chosen == null || (provider != null && vouched == null)) return;

    setBusy(true);
    setProblems({});

    try {
      const proof =
        vouched?.proof ??
        (
          await api.prove(
            pending != null ? { pendingProof: pending } : { password },
            codeAsked ? code.trim() : undefined,
          )
        ).proof;
      await api.transferOwnership(organisation.id, chosen.id, proof);
      await refreshAccount();
      onDone(chosen.user.name);
    } catch (error) {
      setBusy(false);
      if (!(error instanceof ApiError))
        return setProblems({ all: t('membersScreen.actionFailed') });

      if (vouched != null && error.is('proof_required')) {
        setVouched(null);
        setPending(null);
        setCodeAsked(false);
        setCode('');
        setExpired(true);
        return;
      }

      setPending(error.problem.pendingProof ?? pending);

      if (error.is('two_factor_required')) {
        // The field the answer asks for, once it is there to take focus.
        flushSync(() => setCodeAsked(true));
        codeRef.current?.focus();
      } else if (error.is('invalid_credentials')) {
        land({ password: t('ownership.passwordWrong') });
      } else if (error.is('two_factor_code_invalid')) {
        land({ code: t('waysCard.codeWrong') });
      } else if (error.is('recovery_code_used')) {
        land({ code: error.problem.title });
      } else {
        setProblems({ all: error.problem.title });
      }
    }
  }

  const proving = provider != null && vouched == null;

  return (
    <>
      <Dialog
        title={t('ownership.transfer')}
        verb={t('generalDesk.transferVerb')}
        on={!busy && !proving}
        locked={busy}
        onDismiss={() => {
          if (busy) return;
          if (changes > 0) setAsking(true);
          else onClose();
        }}
        onConfirm={() => void transfer()}
      >
        {problems.all != null && <DialogAlert>{problems.all}</DialogAlert>}
        {expired && provider != null && (
          <p className="desk-line is-ink" role="status">
            {t('waysCard.proofExpired', {
              provider: PROVIDER_NAMES[provider],
              count: PROOF_MINUTES,
            })}
          </p>
        )}
        <Note>{t('ownership.transferBody', { organisation: organisation.name })}</Note>
        <div ref={group} className="desk-group-in">
          <Head title={t('ownership.newOwner')} level={3} />
          {problems.owner != null && (
            <p className="desk-error" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {problems.owner}
            </p>
          )}
          <Choices
            legend={t('ownership.newOwner')}
            hideLegend
            choices={candidates.map((one) => ({
              id: one.id,
              name: one.user.name,
              line: roleName(t, one.role),
            }))}
            picked={picked ?? ''}
            onPick={(id) => {
              if (busy) return;
              setPicked(id);
              setProblems(({ owner: _gone, ...rest }) => rest);
            }}
          />
        </div>
        <div className="desk-fields">
          {asksPassword && (
            <Field
              label={t('ownership.password')}
              value={password}
              secret
              autoComplete="current-password"
              help={t('ownership.passwordWhy', { organisation: organisation.name })}
              error={problems.password ?? null}
              inputRef={passwordRef}
              onChange={(value) => {
                setPassword(value);
                setProblems(({ password: _gone, ...rest }) => rest);
              }}
            />
          )}
          {proving && (
            <div className="desk-field">
              <Note strong>
                {t('waysCard.proveWithProvider', { provider: PROVIDER_NAMES[provider] })}
              </Note>
              <Note>{t('ownership.passwordWhy', { organisation: organisation.name })}</Note>
              <button
                className={provider === 'google' ? 'button button-google' : 'button button-apple'}
                type="button"
                aria-busy={busy}
                {...offButton(busy, { dim: false })}
                onClick={() => continueWith(provider)}
              >
                {provider === 'google' ? <GoogleMark /> : <AppleMark />}
                <span>{t('waysCard.continueWith', { provider: PROVIDER_NAMES[provider] })}</span>
              </button>
            </div>
          )}
          {provider != null && vouched != null && (
            <p className="desk-help general-matches" role="status">
              <Mark kind="yes" />
              {t('waysCard.signedInWith', { provider: PROVIDER_NAMES[provider] })}
              {vouched.email != null && ` · ${vouched.email}`}
            </p>
          )}
          {codeAsked && (
            <Field
              label={t('waysCard.code')}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              help={t('waysCard.codeHelp')}
              error={problems.code ?? null}
              inputRef={codeRef}
              onChange={(value) => {
                setCode(value);
                setProblems(({ code: _gone, ...rest }) => rest);
              }}
            />
          )}
        </div>
        <Note>
          {t('ownership.bothEmailed', { name: chosen?.user.name ?? t('ownership.theNewOwner') })}
        </Note>
      </Dialog>
      {asking && (
        <Ask
          title={t('generalDesk.discard', { count: changes })}
          line={t('generalDesk.discardTransfer')}
          keep={t('generalDesk.keepEditing')}
          go={t('generalDesk.discardVerb')}
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

type Preview =
  { kind: 'counting' } | { kind: 'counted'; counted: OrganisationDeletion } | { kind: 'failed' };

function DeleteDialog({
  organisation,
  onClose,
}: {
  organisation: Membership;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview>({ kind: 'counting' });
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState('');
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const matches = typedNameMatches(typed, organisation.name);

  useEffect(() => {
    let current = true;

    api.organisationDeletion(organisation.id).then(
      (counted) => current && setPreview({ kind: 'counted', counted }),
      () => current && setPreview({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisation.id, attempt]);

  async function remove(): Promise<void> {
    if (busy || !matches) return;

    setBusy(true);
    setFailed(null);

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
        input.current?.focus();
      } else {
        setFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
      }
    }
  }

  return (
    <Dialog
      title={t('ownership.deleteTitle', { organisation: organisation.name })}
      verb={t('generalDesk.deleteVerb')}
      red
      on={matches && !busy}
      locked={busy}
      first={input}
      onDismiss={() => {
        if (!busy) onClose();
      }}
      onConfirm={() => void remove()}
    >
      {failed != null && <DialogAlert>{failed}</DialogAlert>}
      <div className="desk-group-in">
        <Head title={t('ownership.deleteWarningTitle')} level={3} />
        {preview.kind === 'counting' && (
          <p className="desk-line" role="status">
            {t('ownership.deleteLoading')}
          </p>
        )}
        {preview.kind === 'counted' && (
          <p className="desk-line is-ink" role="status">
            {t('ownership.deleteCounts', {
              events: t('ownership.events', { count: preview.counted.events }),
              guests: t('ownership.guests', { count: preview.counted.guests }),
              members: t('ownership.members', { count: preview.counted.members }),
            })}{' '}
            {t('ownership.deleteWindow', { deadline: preview.counted.restoreCloses })}
          </p>
        )}
        {preview.kind === 'failed' && (
          <div className="desk-red" role="alert">
            <p className="desk-line is-ink">{t('ownership.deleteUncounted')}</p>
            <TextAction
              label={t('ownership.deleteRetry')}
              onClick={() => {
                setPreview({ kind: 'counting' });
                setAttempt((count) => count + 1);
              }}
            />
          </div>
        )}
      </div>
      <div className="general-typed">
        <Field
          label={t('ownership.deleteType', { organisation: organisation.name })}
          value={typed}
          {...(matches ? {} : { help: t('ownership.deleteExactly') })}
          error={mismatch}
          inputRef={input}
          autoComplete="off"
          onChange={(value) => {
            setTyped(value);
            if (typedNameMatches(value, organisation.name)) setMismatch(null);
          }}
        />
        <div role="status">
          {matches && (
            <p className="desk-help general-matches">
              <Mark kind="yes" />
              {t('ownership.deleteMatches')}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
