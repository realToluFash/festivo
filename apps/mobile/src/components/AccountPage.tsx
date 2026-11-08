import { type Account, ApiError, type TimeZoneOption } from '@soirely/api-client';
import {
  CONTACTS_MOST,
  cleanCode,
  codeProblem,
  confirmWith,
  formatPhone,
  formatTimeOfDay,
  listedContacts,
  lockLiftsAt,
  PROOF_MINUTES,
  rereadAfterRefusal,
  zoneLabel,
  zoneValue,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { createRef, type RefObject, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  type CodeLine,
  cardLine,
  type Contact,
  type ContactKind,
  firstUnverified,
  KIND_KEYS,
  primaryOf,
  promotedWords,
  verifiedWords,
  verifyWords,
  zoneLine,
} from '../kit/accountPage.ts';
import { codeHelp } from '../kit/waysProof.ts';
import { PROVIDER_NAMES } from '../providerSignIn.ts';
import { heldProof } from '../recentProof.ts';
import { rereadAccount } from '../signedIn.ts';
import { useCodeCheck } from '../steps/useCodeCheck.ts';
import { AddScreen } from './AccountAdd.tsx';
import { AboutSection, YouCard } from './AccountCard.tsx';
import { ConfirmScreen, type ConfirmSays } from './AccountConfirm.tsx';
import { ContactsSection } from './AccountContacts.tsx';
import { NameScreen } from './AccountName.tsx';
import { type CodeSays, VerifyScreen } from './AccountVerify.tsx';
import { ZoneScreen } from './AccountZone.tsx';
import { useProof } from './ConfirmItsYou.tsx';
import { SETTLED_MS, ScreenScroll } from './Screen.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { useShellLayout } from './settingsShell.ts';
import { Ask, bringIntoView, useRowClear } from './Summary.tsx';
import type { TextHandle } from './Text.tsx';

type Screen = 'name' | 'zone' | 'addEmail' | 'addPhone' | 'confirm' | 'verify';

type Target =
  'card' | 'step' | 'name' | 'zone' | 'addEmail' | 'addPhone' | 'send' | 'promote' | 'remove';

/** Settings › Your account in the app, summary first, as its demo draws it (sc-30411). */
export function AccountPage({
  account,
  onChanged,
}: {
  account: Account;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const layout = useShellLayout();
  const clear = useRowClear();
  const screenScroll = useContext(ScreenScroll);
  const [zones, setZones] = useState<TimeZoneOption[] | null>(null);
  const [twoFactorOn, setTwoFactorOn] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [ask, setAsk] = useState<'promote' | 'remove' | null>(null);
  const [acting, setActing] = useState(false);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [verifying, setVerifying] = useState<{ kind: ContactKind; id: string } | null>(null);
  const [visit, setVisit] = useState(0);
  const blocks = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const [targets] = useState(() => ({
    card: createRef<TextHandle>(),
    step: createRef<ViewInstance>(),
    name: createRef<ViewInstance>(),
    zone: createRef<ViewInstance>(),
    addEmail: createRef<ViewInstance>(),
    addPhone: createRef<ViewInstance>(),
    send: createRef<ViewInstance>(),
    promote: createRef<ViewInstance>(),
    remove: createRef<ViewInstance>(),
  }));
  const from = useRef<Target>('card');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return targets[from.current].current ?? targets.card.current;
      },
    }),
    [targets],
  );
  const emails: Contact[] = listedContacts(account.emailAddresses).map((held) => ({
    id: held.id,
    shown: held.address,
    verified: held.verified,
    primary: held.primary,
  }));
  const phones: Contact[] = listedContacts(account.phoneNumbers).map((held) => ({
    id: held.id,
    shown: formatPhone(held.number),
    verified: held.verified,
    primary: held.primary,
  }));
  const waiting = firstUnverified(emails, phones);
  const primaryEmail = primaryOf(emails)?.shown ?? '';
  const openedRow = [...emails, ...phones].find((row) => row.id === opened) ?? null;
  const openedKind: ContactKind = emails.some((row) => row.id === opened) ? 'email' : 'phone';
  const zone = zoneValue(account.timezone, zones);
  const zoneNow = zone.kind === 'shown' ? zone.name : null;
  const verifyRow =
    verifying == null
      ? null
      : ((verifying.kind === 'email' ? emails : phones).find((row) => row.id === verifying.id) ??
        null);

  useEffect(() => {
    let live = true;

    api
      .timezones()
      .then((list) => live && setZones(list))
      .catch(() => live && setZones([]));
    api
      .twoFactorStatus()
      .then((status) => live && setTwoFactorOn(status.on))
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (said != null) screenScroll?.ref.current?.scrollTo({ y: 0, animated: true });
  }, [said, screenScroll]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function show(next: Screen, target: Target): void {
    from.current = target;
    setVisit((count) => count + 1);
    setScreen(next);
  }

  function done(words: string): void {
    from.current = 'card';
    setSaid(words);
    setOpened(null);
    setRowError(null);
    setAsk(null);
    setScreen(null);
  }

  function doneAtOnce(words: string): void {
    done(words);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => moveScreenReaderFocus(targets.card.current), SETTLED_MS);
  }

  function asking(question: 'promote' | 'remove', row: Contact): void {
    setRowError(null);
    setAsk(question);
    bringIntoView(blocks.current[row.id], screenScroll?.ref.current ?? null, clear, true);
  }

  function verify(kind: ContactKind, row: Contact, target: Target): void {
    setVerifying({ kind, id: row.id });
    show('verify', target);
  }

  /** Makes a row primary or removes it; a refusal stays under the row's offers, the list read again where it changed. */
  async function act(
    kind: ContactKind,
    row: Contact,
    what: 'promote' | 'remove',
    proof: string | null,
    atOnce: boolean,
  ): Promise<void> {
    if (acting) return;
    setActing(true);
    setRowError(null);

    try {
      if (what === 'promote')
        await (kind === 'email' && proof != null
          ? api.makeEmailPrimary(row.id, proof)
          : api.makePhonePrimary(row.id));
      else
        await (kind === 'email' ? api.removeEmailAddress(row.id) : api.removePhoneNumber(row.id));
      await onChanged();
      const words =
        what === 'promote'
          ? promotedWords(kind, row.shown, t)
          : t('contacts.removed', { address: row.shown });
      if (atOnce) doneAtOnce(words);
      else done(words);
    } catch (refusal) {
      const changed = await rereadAfterRefusal(codeOf(refusal), rereadAccount);
      const message = rowRefusal(refusal, kind, t);
      setAsk(null);
      setScreen(null);
      // The row may be gone, so the reason goes on the card's line, where it can be read out.
      if (changed) doneAtOnce(message);
      else setRowError({ id: row.id, message });
    } finally {
      setActing(false);
    }
  }

  function promoteEmail(row: Contact): void {
    const proof = heldProof();
    // An address signs the account in, so it is proved first; a proof still standing is enough.
    if (proof == null) {
      setAsk(null);
      show('confirm', 'promote');
    } else void act('email', row, 'promote', proof, false);
  }

  const contacts = (kind: ContactKind) => {
    const rows = kind === 'email' ? emails : phones;
    const adding = kind === 'email' ? 'addEmail' : 'addPhone';

    return (
      <ContactsSection
        kind={kind}
        rows={rows}
        opened={opened}
        error={rowError != null && rowError.id === opened ? rowError.message : null}
        addRef={targets[adding]}
        sendRef={targets.send}
        promoteRef={targets.promote}
        removeRef={targets.remove}
        onAdd={() => show(adding, adding)}
        onBlock={(id, block) => {
          blocks.current[id] = block;
        }}
        onToggle={(id) => {
          setRowError(null);
          setOpened((now) => (now === id ? null : id));
        }}
        onVerify={(row) => verify(kind, row, 'send')}
        onMakePrimary={(row) => {
          from.current = 'promote';
          if (kind === 'email') asking('promote', row);
          else void act(kind, row, 'promote', null, true);
        }}
        onRemove={(row) => {
          from.current = 'remove';
          if (row.verified) asking('remove', row);
          else void act(kind, row, 'remove', null, true);
        }}
      />
    );
  };

  return (
    <>
      <YouCard
        name={account.name}
        email={primaryEmail}
        line={cardLine(emails, phones, said, t)}
        wide={layout === 'portrait'}
        nameRef={targets.card}
        step={
          waiting == null
            ? null
            : {
                label: t('contacts.sendCode'),
                onPress: () => verify(waiting.kind, waiting.row, 'step'),
                testID: 'account.step',
                ref: targets.step,
              }
        }
      />
      <AboutSection
        name={account.name}
        zone={{
          title:
            zone.kind === 'shown' ? zone.name : zone.kind === 'unset' ? t('timeZone.unset') : '',
          line: zoneLine(zone.kind === 'shown' ? zone.id : null, t),
        }}
        nameRef={targets.name}
        zoneRef={targets.zone}
        onName={() => show('name', 'name')}
        onZone={() => show('zone', 'zone')}
      />
      {contacts('email')}
      {contacts('phone')}
      <Ask
        open={ask === 'promote' && openedRow != null}
        opener={opener}
        title={t('contacts.promoteTitle')}
        line={t('contacts.promoteBody', { old: primaryEmail })}
        keep={{
          label: t('contacts.promoteKeep', { old: primaryEmail }),
          testID: 'account.promote.keep',
          off: acting,
        }}
        confirm={{
          label: t('contacts.promoteConfirm'),
          testID: 'account.promote.confirm',
          busy: acting ? t('contacts.promoting') : undefined,
        }}
        onKeep={() => {
          if (!acting) setAsk(null);
        }}
        onConfirm={() => {
          if (openedRow != null) promoteEmail(openedRow);
        }}
        testID="account.promote"
      />
      <Ask
        open={ask === 'remove' && openedRow != null}
        opener={opener}
        title={t(KIND_KEYS[openedKind].removeTitle)}
        line={t('contacts.removeBody')}
        keep={{
          label: t(KIND_KEYS[openedKind].removeKeep),
          testID: 'account.remove.keep',
          off: acting,
        }}
        confirm={{
          label: t(KIND_KEYS[openedKind].removeConfirm),
          testID: 'account.remove.confirm',
          removes: true,
          busy: acting ? t('contacts.removing') : undefined,
        }}
        onKeep={() => {
          if (!acting) setAsk(null);
        }}
        onConfirm={() => {
          if (openedRow != null) void act(openedKind, openedRow, 'remove', null, false);
        }}
        testID="account.remove"
      />
      <NameScreen
        key={`name.${visit}`}
        open={screen === 'name'}
        held={account.name}
        opener={opener}
        onClose={() => setScreen(null)}
        onSave={async (next) => {
          try {
            await api.setName(next);
            await onChanged();
            done(t('nameCard.saved', { name: next }));

            return null;
          } catch (refusal) {
            return refusal instanceof ApiError && refusal.status === 422
              ? (refusal.problem.detail ?? t('nameCard.failed'))
              : t('nameCard.failed');
          }
        }}
      />
      <ZoneScreen
        key={`zone.${visit}`}
        open={screen === 'zone'}
        zones={zones ?? []}
        now={zoneNow}
        opener={opener}
        onClose={() => setScreen(null)}
        onSave={async (next) => {
          try {
            await api.setTimezone(next.id);
            await onChanged();
            done(t('timeZone.saved', { zone: zoneLabel(next) }));

            return null;
          } catch (refusal) {
            return refusal instanceof ApiError && refusal.status === 422
              ? t('timeZone.refused')
              : t('timeZone.failed');
          }
        }}
      />
      {(['email', 'phone'] as const).map((kind) => (
        <AddScreen
          key={`${kind}.${visit}`}
          kind={kind}
          open={screen === (kind === 'email' ? 'addEmail' : 'addPhone')}
          startCountry={account.organisationCountry ?? ''}
          opener={opener}
          onClose={() => setScreen(null)}
          onAdd={async ({ typed, country }) => {
            try {
              await (kind === 'email'
                ? api.addEmailAddress(typed)
                : api.addPhoneNumber(country, typed));
              await onChanged();
              done(t('contacts.added'));

              return null;
            } catch (refusal) {
              await rereadAfterRefusal(codeOf(refusal), rereadAccount);

              return addRefusal(refusal, kind, t);
            }
          }}
        />
      ))}
      {openedRow != null && (
        <ConfirmStep
          key={`confirm.${visit}.${twoFactorOn}`}
          open={screen === 'confirm'}
          account={account}
          twoFactorOn={twoFactorOn}
          opener={opener}
          onClose={() => setScreen(null)}
          onProved={(proof) => void act('email', openedRow, 'promote', proof, false)}
        />
      )}
      {verifying != null && verifyRow != null && (
        <VerifyStep
          key={`verify.${verifying.id}.${visit}`}
          open={screen === 'verify'}
          kind={verifying.kind}
          row={verifyRow}
          opener={opener}
          onClose={() => setScreen(null)}
          onVerified={async (primary) => {
            await onChanged();
            done(verifiedWords({ ...verifyRow, primary }, verifying.kind, t));
          }}
        />
      )}
    </>
  );
}

/** Confirm it's you before the address you sign in with changes: the password, or the provider, then the code. */
function ConfirmStep({
  open,
  account,
  twoFactorOn,
  opener,
  onClose,
  onProved,
}: {
  open: boolean;
  account: Account;
  twoFactorOn: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onProved: (proof: string) => void;
}) {
  const { t } = useTranslation();
  const via = confirmWith(account.hasPassword, account.providers);
  const proving = useProof(via, twoFactorOn);
  const provider = via === 'password' || via == null ? null : PROVIDER_NAMES[via];
  const stepTwo = provider != null && proving.signedIn != null ? provider : null;

  return (
    <ConfirmScreen
      open={open}
      asks={{
        lead:
          provider == null || proving.codeAsked
            ? t('contacts.proveIntro')
            : t('waysCard.proveWithProvider', { provider }),
        note:
          proving.expired != null && provider != null
            ? t('waysCard.proofExpired', { provider, count: PROOF_MINUTES })
            : undefined,
        password: via === 'password',
        code: proving.codeAsked,
        codeHelp: codeHelp(t, stepTwo),
        instead: provider,
      }}
      opener={opener}
      onClose={onClose}
      onContinue={async (password, code): Promise<ConfirmSays | null> => {
        const blank = {
          password: via === 'password' && password === '' ? t('waysCard.passwordBlank') : null,
          code: proving.codeAsked && code.trim() === '' ? t('waysCard.codeBlank') : null,
        };
        if (blank.password != null || blank.code != null) return { ...blank, checked: true };
        const outcome = await proving.submit(password, code);
        if (outcome.kind === 'proved') {
          onProved(outcome.proof);
          return null;
        }
        if (outcome.kind !== 'refused') return { password: null, code: null, checked: false };
        const { field, message } = outcome.refusal;

        return {
          password: field === 'password' ? message : null,
          code: field === 'code' ? message : null,
          checked: false,
          other: field === 'failed' ? message : null,
        };
      }}
    />
  );
}

/** Check your email or your messages for one of the account's own rows, as the verify screens do it. */
function VerifyStep({
  open,
  kind,
  row,
  opener,
  onClose,
  onVerified,
}: {
  open: boolean;
  kind: ContactKind;
  row: Contact;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onVerified: (primary: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const email = kind === 'email';
  const check = useCodeCheck(kind, row.id);
  const { status, setStatus, cooldown, wording } = check;
  const [resendFailed, setResendFailed] = useState(false);
  const line: CodeLine = email ? 'email' : wording.line;
  const words = verifyWords(line, row.shown, t);
  const spent =
    status.kind === 'expired'
      ? words.expired
      : status.kind === 'exhausted'
        ? words.exhausted
        : null;

  return (
    <VerifyScreen
      open={open}
      title={words.title}
      lead={words.lead}
      codeLabel={words.codeLabel}
      spent={spent}
      wait={cooldown}
      startError={null}
      opener={opener}
      onClose={onClose}
      onVerify={async (typed): Promise<CodeSays | null> => {
        const problem = codeProblem(typed);
        if (problem != null)
          return { error: problem === 'blank' ? words.blank : words.short, checked: true };
        setResendFailed(false);
        setStatus({ kind: 'verifying' });
        const checked = await check.verify(cleanCode(typed));
        if (checked.verified) {
          await onVerified(checked.primary);
          return null;
        }
        if (checked.refusal.kind === 'wrong') return { error: words.wrong, checked: false };
        if (checked.refusal.kind === 'failed')
          return { error: t('verifyEmail.failedBody'), checked: false };

        return null;
      }}
      onResend={async () => {
        setResendFailed((await check.resend()) === 'failed');
      }}
      onTextInstead={!email && wording.offerText ? check.textInstead : null}
      note={
        check.textingFailed != null
          ? t('verifyPhone.textInsteadFailed')
          : resendFailed
            ? t('verifyEmail.failedBody')
            : null
      }
    />
  );
}

function codeOf(refusal: unknown): string | null {
  return refusal instanceof ApiError ? refusal.code : null;
}

/** The server's answer to a race the page did not invite: each is a reason with the next step. */
function rowRefusal(refusal: unknown, kind: ContactKind, t: TFunction): string {
  const email = kind === 'email';

  if (refusal instanceof ApiError && refusal.is('address_not_verified'))
    return email ? t('contacts.refusedNotVerified') : t('contacts.refusedNotVerifiedPhone');
  if (refusal instanceof ApiError && refusal.is('primary_address'))
    return email ? t('contacts.refusedPrimary') : t('contacts.refusedPrimaryPhone');
  if (refusal instanceof ApiError && refusal.is('last_verified_address'))
    return email ? t('contacts.refusedLastVerified') : t('contacts.refusedLastVerifiedPhone');

  return t('contacts.failed');
}

function addRefusal(refusal: unknown, kind: ContactKind, t: TFunction): string {
  const email = kind === 'email';

  if (refusal instanceof ApiError && refusal.is('already_linked'))
    return email ? t('contacts.alreadyLinked') : t('contacts.alreadyLinkedPhone');
  if (refusal instanceof ApiError && refusal.is('address_limit_reached'))
    return t(email ? 'contacts.limitEmails' : 'contacts.limitPhones', { most: CONTACTS_MOST });
  if (refusal instanceof ApiError && refusal.is('too_many_attempts')) {
    const lifts = lockLiftsAt(Number(refusal.response?.headers.get('Retry-After')));

    return lifts == null
      ? t('contacts.limitedSoon')
      : t('contacts.limitedBody', { time: formatTimeOfDay(lifts, dateLocale()) });
  }
  if (refusal instanceof ApiError && refusal.is('validation_failed'))
    return Object.values(refusal.fieldErrors())[0] ?? t('contacts.failed');

  return t('contacts.failed');
}
