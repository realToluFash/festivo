import { type Account, ApiError, type TimeZoneOption } from '@soirely/api-client';
import {
  confirmWith,
  contactActions,
  contactsLeft,
  formatPhone,
  initials,
  listedContacts,
  rereadAfterRefusal,
  zoneLabel,
  zoneValue,
  firstUnverified,
  primaryOf,
} from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ContactKind,
  type ContactRow,
  KIND_KEYS,
  addRefusal,
  cardLine,
  codeOf,
  contactLine,
  contactsFoot,
  promotedWords,
  rowRefusal,
  verifiedWords,
  zoneLine,
} from '../../../accountPage.ts';
import { api } from '../../../api.ts';
import { apiCodeSource } from '../../../codeCheck.ts';
import {
  AboutRow,
  ContactsBlock,
  LanguageBlock,
  PersonCard,
  RowOffers,
} from '../../../components/AccountParts.tsx';
import { FieldError } from '../../../components/FieldError.tsx';
import { Bones } from '../../../components/GeneralParts.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { Ask, DeskPage, Head, TextAction, TitleRow } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { useOffline } from '../../../offline.ts';
import { dropProviderReturn, heldProviderReturn } from '../../../providerSignIn.ts';
import { dropProof, heldProof, holdProof } from '../../../recentProof.ts';
import { followAccountRead, refreshAccount, useSession } from '../../../session.ts';
import {
  AddEmailDialog,
  AddPhoneDialog,
  NameDialog,
  ProveDialog,
  VerifyDialog,
  ZoneDialog,
} from '../../../components/AccountDialogs.tsx';
import '../../../components/SettingsParts.css';

type Opened =
  | { kind: 'name' | 'zone' | 'addEmail' | 'addPhone' }
  | { kind: 'confirm'; id: string }
  | { kind: 'verify'; contact: ContactKind; id: string };

type Load = Account | 'failed' | null;

/** Your account at a desk in B · Summary first (sc-30411), as the design demo's /demo/settings/account draws it. */
export function AccountDesk() {
  const { t } = useTranslation();
  const session = useSession();
  const locale = currentLocale();
  const title = useRef<HTMLHeadingElement>(null);
  const saidLine = useRef<HTMLParagraphElement | null>(null);
  const { layers, covered, setHost } = useDeskLayers();
  const [account, setAccount] = useState<Load>(null);
  const [zones, setZones] = useState<TimeZoneOption[] | null>(null);
  const [twoFactorOn, setTwoFactorOn] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [said, setSaid] = useState<string | null>(null);
  // The language just chosen, said in the page's language once it has redrawn; focus stays on the choice.
  const [chosen, setChosen] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{
    id: string;
    kind: ContactKind;
    message: string;
  } | null>(null);

  // From an effect, so it lands after the closing Ask has handed focus back to its opener.
  useEffect(() => {
    if (rowError == null) return;
    focusWhenFree(() => document.getElementById(`${rowError.kind}-${rowError.id}-error`));
  }, [rowError]);
  const [ask, setAsk] = useState<'promote' | 'remove' | null>(null);
  const [acting, setActing] = useState(false);
  // Back from Google or Apple, started by Make primary: once, on arrival.
  const [returned] = useState(() => heldProviderReturn(['makePrimary']));
  const back =
    returned != null && 'signIn' in returned && returned.purpose.kind === 'makePrimary'
      ? { address: returned.purpose.address, signIn: returned.signIn }
      : null;
  const [dialog, setDialog] = useState<Opened | null>(() =>
    back == null ? null : { kind: 'confirm', id: back.address },
  );
  const loaded = account != null && account !== 'failed';
  const { watch, refreshing } = useOffline({
    loaded,
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  // Removed only once committed: React may abandon a render and run the initializer again.
  useEffect(() => {
    if (returned != null) dropProviderReturn();
  }, [returned]);

  useEffect(() => {
    let live = true;

    watch(api.me())
      .then((me) => {
        if (!live) return;
        setAccount(me);
        followAccountRead(me);
      })
      .catch(() => {
        if (live) setAccount((held) => held ?? 'failed');
      });
    api
      .twoFactorStatus()
      .then((status) => live && setTwoFactorOn(status.on))
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [attempt, refresh, watch]);

  // The API names the zones in the request's language, so a language change asks again (sc-1800).
  useEffect(() => {
    let live = true;

    api
      .timezones()
      .then((list) => live && setZones(list))
      .catch(() => live && setZones((shown) => shown ?? []));

    return () => {
      live = false;
    };
  }, [locale]);

  useEffect(() => {
    if (said != null) saidLine.current?.focus();
  }, [said]);

  async function reread(): Promise<void> {
    const me = await api.me();
    setAccount(me);
    followAccountRead(me);
  }

  const emails: ContactRow[] = loaded
    ? listedContacts(account.emailAddresses).map((held) => ({
        id: held.id,
        shown: held.address,
        verified: held.verified,
        primary: held.primary,
      }))
    : [];
  const phones: ContactRow[] = loaded
    ? listedContacts(account.phoneNumbers).map((held) => ({
        id: held.id,
        shown: formatPhone(held.number),
        verified: held.verified,
        primary: held.primary,
      }))
    : [];
  const all = [...emails, ...phones];
  const openedRow = all.find((row) => row.id === open) ?? null;
  const openedKind: ContactKind = emails.some((row) => row.id === open) ? 'email' : 'phone';
  const primaryEmail = loaded ? (primaryOf(emails)?.shown ?? null) : session.email;
  const waiting = firstUnverified(emails, phones);
  const zone = zoneValue(session.timezone, zones);
  const zoneNow = zone.kind === 'shown' ? zone.name : null;
  const name = session.name ?? '';

  function done(words: string): void {
    setSaid(words);
    setChosen(null);
    setOpen(null);
    setRowError(null);
    setAsk(null);
    setDialog(null);
  }

  /** Makes a row primary or removes it; a refusal stays under the row's offers, the list read again where it changed. */
  async function act(
    kind: ContactKind,
    row: ContactRow,
    what: 'promote' | 'remove',
    proof: string | null,
  ): Promise<void> {
    if (acting) return;
    setActing(true);
    setRowError(null);

    try {
      if (what === 'promote') {
        await (kind === 'email' && proof != null
          ? api.makeEmailPrimary(row.id, proof)
          : api.makePhonePrimary(row.id));
        await reread();
        if (kind === 'email') await refreshAccount();
      } else {
        await (kind === 'email' ? api.removeEmailAddress(row.id) : api.removePhoneNumber(row.id));
        await reread();
      }
      done(
        what === 'promote'
          ? promotedWords(kind, row.shown, t)
          : t('contacts.removed', { address: row.shown }),
      );
    } catch (refusal) {
      const changed = await rereadAfterRefusal(codeOf(refusal), reread);
      const message = rowRefusal(refusal, kind, t);
      setAsk(null);
      setDialog(null);
      // The row may be gone, so the reason goes on the card's line, where it can be read out.
      if (changed) done(message);
      else setRowError({ id: row.id, kind, message });
    } finally {
      setActing(false);
    }
  }

  function promoteEmail(row: ContactRow): void {
    const proof = heldProof();
    // An address signs the account in, so it is proved first; a proof still standing is enough.
    if (proof == null) {
      setAsk(null);
      setDialog({ kind: 'confirm', id: row.id });
    } else void act('email', row, 'promote', proof);
  }

  function contacts(kind: ContactKind) {
    const rows = kind === 'email' ? emails : phones;
    const keys = KIND_KEYS[kind];

    return (
      <ContactsBlock
        key={kind}
        kind={kind}
        title={t(keys.section)}
        add={contactsLeft(rows) > 0 ? t(keys.add) : null}
        rows={rows}
        open={open}
        unverified={t('contacts.unverified')}
        lineOf={(row) => contactLine(kind, row, t)}
        foot={contactsFoot(kind, rows, t)}
        onToggle={(row) => {
          setRowError(null);
          setOpen((now) => (now === row.id ? null : row.id));
        }}
        onAdd={() => setDialog({ kind: kind === 'email' ? 'addEmail' : 'addPhone' })}
        renderOffers={(row) => {
          const offers = contactActions(row);

          return (
            <>
              <RowOffers line={t('contacts.removeBody')}>
                {offers.verify && (
                  <TextAction
                    label={t('contacts.sendCode')}
                    onClick={() => setDialog({ kind: 'verify', contact: kind, id: row.id })}
                  />
                )}
                {offers.makePrimary && (
                  <TextAction
                    label={t(keys.makePrimary)}
                    onClick={() => {
                      setRowError(null);
                      if (kind === 'email') setAsk('promote');
                      else void act(kind, row, 'promote', null);
                    }}
                  />
                )}
                {offers.remove && (
                  <TextAction
                    label={t(offers.askBeforeRemoving ? 'contacts.removeAsks' : 'contacts.remove')}
                    red
                    onClick={() => {
                      setRowError(null);
                      if (offers.askBeforeRemoving) setAsk('remove');
                      else void act(kind, row, 'remove', null);
                    }}
                  />
                )}
              </RowOffers>
              {rowError?.id === row.id && (
                <FieldError id={`${kind}-${row.id}-error`} message={rowError.message} focusable />
              )}
            </>
          );
        }}
      />
    );
  }

  const verifyRow =
    dialog?.kind === 'verify'
      ? ((dialog.contact === 'email' ? emails : phones).find((row) => row.id === dialog.id) ?? null)
      : null;
  const confirmRow =
    dialog?.kind === 'confirm' ? (emails.find((row) => row.id === dialog.id) ?? null) : null;

  return (
    <DeskPage layers={layers}>
      <div className="desk-column account-desk" inert={covered}>
        {refreshing && <Refreshing />}
        <TitleRow title={t('account.title')} titleRef={title} />
        <PersonCard
          initials={initials(name)}
          name={name}
          address={primaryEmail}
          said={cardLine(
            emails,
            phones,
            said ?? (chosen == null ? null : t('account.languageSaved', { language: chosen })),
            t,
          )}
          saidRef={(line) => {
            saidLine.current = line;
          }}
          step={
            waiting == null
              ? null
              : {
                  label: t('contacts.sendCode'),
                  onClick: () =>
                    setDialog({ kind: 'verify', contact: waiting.kind, id: waiting.row.id }),
                }
          }
        />
        <section className="desk-block">
          <Head title={t('account.aboutYou')} />
          <ul className="desk-rows account-rows">
            <AboutRow
              lead="user"
              title={name}
              line={t('account.yourName')}
              onOpen={() => setDialog({ kind: 'name' })}
            />
            <AboutRow
              lead="globe"
              title={
                zone.kind === 'shown' ? zone.name : zone.kind === 'unset' ? t('timeZone.unset') : ''
              }
              line={zoneLine(zone.kind === 'shown' ? zone.id : null, t)}
              onOpen={() => setDialog({ kind: 'zone' })}
            />
          </ul>
        </section>
        <LanguageBlock
          onChosen={(language) => {
            setSaid(null);
            setChosen(language);
          }}
        />
        {loaded
          ? (['email', 'phone'] as const).map(contacts)
          : (['email', 'phone'] as const).map((kind) => (
              <section key={kind} className="desk-block">
                <Head title={t(KIND_KEYS[kind].section)} />
                {account === 'failed' ? (
                  <div className="desk-failed" role={attempt > 0 ? undefined : 'alert'}>
                    <p className="desk-line">
                      {t(kind === 'email' ? 'contacts.emailsFailed' : 'contacts.phonesFailed')}
                    </p>
                    <TextAction
                      label={t('error.retry')}
                      onClick={() => {
                        setAccount(null);
                        setAttempt((n) => n + 1);
                      }}
                    />
                  </div>
                ) : (
                  <Bones count={kind === 'email' ? 2 : 1} label={t('pending.loading')} />
                )}
              </section>
            ))}
      </div>
      <div ref={setHost} className="desk-layers" />
      {ask === 'promote' && openedRow != null && (
        <Ask
          title={t('contacts.promoteTitle')}
          line={t('contacts.promoteBody', { old: primaryEmail ?? '' })}
          keep={t('contacts.promoteKeep', { old: primaryEmail ?? '' })}
          go={t('contacts.promoteConfirm')}
          red={false}
          busy={acting ? t('contacts.promoting') : undefined}
          onKeep={() => !acting && setAsk(null)}
          onGo={() => promoteEmail(openedRow)}
        />
      )}
      {ask === 'remove' && openedRow != null && (
        <Ask
          title={t(KIND_KEYS[openedKind].removeTitle)}
          line={t('contacts.removeBody')}
          keep={t(KIND_KEYS[openedKind].removeKeep)}
          go={t(KIND_KEYS[openedKind].removeConfirm)}
          busy={acting ? t('contacts.removing') : undefined}
          onKeep={() => !acting && setAsk(null)}
          onGo={() => void act(openedKind, openedRow, 'remove', null)}
        />
      )}
      {dialog?.kind === 'name' && (
        <NameDialog
          saved={name}
          onClose={() => setDialog(null)}
          onSave={async (next) => {
            try {
              await api.setName(next);
              await refreshAccount();
              done(t('nameCard.saved', { name: next }));

              return null;
            } catch (refusal) {
              return refusal instanceof ApiError && refusal.status === 422
                ? (refusal.problem.detail ?? t('nameCard.failed'))
                : t('nameCard.failed');
            }
          }}
        />
      )}
      {dialog?.kind === 'zone' && (
        <ZoneDialog
          zones={zones ?? []}
          now={zoneNow}
          onClose={() => setDialog(null)}
          onSave={async (next) => {
            try {
              await api.setTimezone(next.id);
              await refreshAccount();
              done(t('timeZone.saved', { zone: zoneLabel(next) }));

              return null;
            } catch (refusal) {
              return refusal instanceof ApiError && refusal.status === 422
                ? t('timeZone.refused')
                : t('timeZone.failed');
            }
          }}
        />
      )}
      {dialog?.kind === 'addEmail' && (
        <AddEmailDialog
          onClose={() => setDialog(null)}
          onAdd={async (address) => {
            try {
              await api.addEmailAddress(address);
              await reread();
              done(t('contacts.added'));

              return null;
            } catch (refusal) {
              await rereadAfterRefusal(codeOf(refusal), reread);

              return addRefusal(refusal, 'email', t);
            }
          }}
        />
      )}
      {dialog?.kind === 'addPhone' && (
        <AddPhoneDialog
          startCountry={loaded ? (account.organisationCountry ?? '') : ''}
          onClose={() => setDialog(null)}
          onAdd={async (country, number) => {
            try {
              await api.addPhoneNumber(country, number);
              await reread();
              done(t('contacts.added'));

              return null;
            } catch (refusal) {
              await rereadAfterRefusal(codeOf(refusal), reread);

              return addRefusal(refusal, 'phone', t);
            }
          }}
        />
      )}
      {confirmRow != null && loaded && (
        <ProveDialog
          via={confirmWith(account.hasPassword, account.providers)}
          twoFactorOn={twoFactorOn}
          returned={back?.address === confirmRow.id ? back.signIn : null}
          purpose={{ kind: 'makePrimary', address: confirmRow.id }}
          prove={(first, code) =>
            api.prove(first, code).then(
              (proof) => {
                holdProof(proof);

                return proof.proof;
              },
              (refusal: unknown) => {
                dropProof();
                throw refusal;
              },
            )
          }
          onClose={() => setDialog(null)}
          onProved={(proof) => void act('email', confirmRow, 'promote', proof)}
        />
      )}
      {dialog?.kind === 'verify' && verifyRow != null && (
        <VerifyDialog
          key={verifyRow.id}
          kind={dialog.contact}
          row={verifyRow}
          source={apiCodeSource(dialog.contact, verifyRow.id)}
          onClose={() => setDialog(null)}
          onVerified={async (primary) => {
            const kind = dialog.contact;
            await reread().catch(() => {});
            done(verifiedWords({ ...verifyRow, primary }, kind, t));
          }}
        />
      )}
    </DeskPage>
  );
}
