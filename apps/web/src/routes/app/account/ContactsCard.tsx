import { type Account, ApiError } from '@soirely/api-client';
import {
  CONTACTS_MOST,
  contactActions,
  contactsLeft,
  formatPhone,
  formatTimeOfDay,
  listedContacts,
  lockLiftsAt,
  phoneLengthProblem,
  refusedPhoneField,
} from '@soirely/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { PhoneEntry } from '../../../components/PhoneEntry.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { phoneProblemMessage } from '../../../phoneProblem.ts';

type Kind = 'email' | 'phone';

interface Row {
  id: string;
  shown: string;
  verified: boolean;
  primary: boolean;
  pending?: boolean;
}

type Asking = { id: string; what: 'promote' | 'remove' } | null;

/** Settings > Account: email addresses and phone numbers (sc-113). A primary address signs in; nothing else here does. */
export function ContactsCards({ onPrimaryChanged }: { onPrimaryChanged: () => Promise<void> }) {
  const [account, setAccount] = useState<Account | null>(null);

  async function reload(): Promise<void> {
    setAccount(await api.me());
  }

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  if (account == null) return null;

  return (
    <>
      <ContactsCard
        kind="email"
        rows={account.emailAddresses.map((held) => ({ ...held, shown: held.address }))}
        country={account.organisationCountry ?? ''}
        onChanged={reload}
        onPrimaryChanged={async () => {
          await reload();
          await onPrimaryChanged();
        }}
      />
      <ContactsCard
        kind="phone"
        rows={account.phoneNumbers.map((held) => ({ ...held, shown: formatPhone(held.number) }))}
        country={account.organisationCountry ?? ''}
        onChanged={reload}
        onPrimaryChanged={reload}
      />
    </>
  );
}

function ContactsCard({
  kind,
  rows: all,
  country,
  onChanged,
  onPrimaryChanged,
}: {
  kind: Kind;
  rows: Row[];
  country: string;
  onChanged: () => Promise<void>;
  onPrimaryChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const rows = listedContacts(all);
  const left = contactsLeft(all);
  const [asking, setAsking] = useState<Asking>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const doneLine = useRef<HTMLDivElement>(null);
  const email = kind === 'email';
  const primary = rows.find((row) => row.primary);

  useEffect(() => doneLine.current?.focus(), [done]);

  async function act(row: Row, what: 'promote' | 'remove'): Promise<void> {
    setRowError(null);

    try {
      if (what === 'promote') {
        await (email ? api.makeEmailPrimary(row.id) : api.makePhonePrimary(row.id));
        setAsking(null);
        setDone(
          email
            ? t('contacts.promoted', { address: row.shown })
            : t('contacts.promotedPhone', { number: row.shown }),
        );
        await onPrimaryChanged();
      } else {
        await (email ? api.removeEmailAddress(row.id) : api.removePhoneNumber(row.id));
        setAsking(null);
        setDone(t('contacts.removed', { address: row.shown }));
        await onChanged();
      }
    } catch (refusal) {
      setRowError({ id: row.id, message: rowRefusal(refusal, kind, t) });
    }
  }

  return (
    <section className="card settings-card" aria-labelledby={`${kind}s-title`}>
      <div className="contacts-head">
        <h2 id={`${kind}s-title`}>
          {email ? t('contacts.emailsTitle') : t('contacts.phonesTitle')}
        </h2>
        <span className="field-help">
          {t('contacts.count', { count: rows.length, most: CONTACTS_MOST })}
        </span>
      </div>
      <p>{email ? t('contacts.emailsIntro') : t('contacts.phonesIntro')}</p>

      {done != null && (
        <div className="notice notice-done" role="status" tabIndex={-1} ref={doneLine}>
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>{done}</p>
        </div>
      )}

      <ul
        className="ways-list"
        aria-label={email ? t('contacts.emailsList') : t('contacts.phonesList')}
      >
        {rows.map((row) => {
          const offers = contactActions(row);
          const here = asking?.id === row.id ? asking.what : null;

          return (
            <li className="way" key={row.id}>
              <div className="way-detail">
                <span className="way-name way-address">{row.shown}</span>
                <p className="way-state">
                  <span
                    className={row.verified ? 'mark mark-done' : 'mark mark-off'}
                    aria-hidden="true"
                  >
                    {row.verified ? '✓' : ''}
                  </span>
                  <span className={row.verified ? 'way-state-on' : undefined}>
                    {row.verified ? t('contacts.verified') : t('contacts.unverified')}
                  </span>
                  {row.primary && <span className="pill-quiet">{t('contacts.primary')}</span>}
                </p>
              </div>

              {here == null && (
                <div className="actions">
                  {offers.verify && (
                    <Link
                      className="button"
                      to={
                        email ? `/verify-email?address=${row.id}` : `/verify-phone?phone=${row.id}`
                      }
                    >
                      {t('contacts.sendCode')}
                    </Link>
                  )}
                  {offers.makePrimary && (
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        email
                          ? setAsking({ id: row.id, what: 'promote' })
                          : void act(row, 'promote')
                      }
                    >
                      {t('contacts.makePrimary')}
                    </button>
                  )}
                  {offers.remove && (
                    <button
                      className="button"
                      type="button"
                      aria-label={t('contacts.removeLabel', { address: row.shown })}
                      onClick={() =>
                        offers.askBeforeRemoving
                          ? setAsking({ id: row.id, what: 'remove' })
                          : void act(row, 'remove')
                      }
                    >
                      {t('contacts.remove')}
                    </button>
                  )}
                </div>
              )}

              {here === 'promote' && (
                <div className="notice notice-quiet way-last">
                  <div className="notice-body">
                    <p className="notice-title">{t('contacts.promoteTitle')}</p>
                    <p>{t('contacts.promoteBody', { old: primary?.shown ?? '' })}</p>
                    <div className="actions">
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => void act(row, 'promote')}
                      >
                        {t('contacts.promoteConfirm')}
                      </button>
                      <button className="button" type="button" onClick={() => setAsking(null)}>
                        {t('contacts.promoteKeep', { old: primary?.shown ?? '' })}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {here === 'remove' && (
                <div className="notice notice-quiet way-last">
                  <div className="notice-body">
                    <p className="notice-title">
                      {email ? t('contacts.removeTitle') : t('contacts.removeTitlePhone')}
                    </p>
                    <p>{t('contacts.removeBody')}</p>
                    <div className="actions">
                      <button
                        className="button button-dark"
                        type="button"
                        onClick={() => void act(row, 'remove')}
                      >
                        {t('contacts.removeConfirm')}
                      </button>
                      <button className="button" type="button" onClick={() => setAsking(null)}>
                        {t('contacts.removeKeep')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {rowError?.id === row.id && (
                <div className="way-last">
                  <FieldError id={`${kind}-${row.id}-error`} message={rowError.message} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        email ? (
          <AddEmail
            onAdded={async () => {
              setAdding(false);
              setDone(t('contacts.added'));
              await onChanged();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <AddPhone
            country={country}
            onAdded={async () => {
              setAdding(false);
              setDone(t('contacts.added'));
              await onChanged();
            }}
            onCancel={() => setAdding(false)}
          />
        )
      ) : (
        left > 0 && (
          <button
            className="button"
            type="button"
            onClick={() => {
              setDone(null);
              setAdding(true);
            }}
          >
            {email ? t('contacts.addEmail') : t('contacts.addPhone')}
          </button>
        )
      )}

      <p className="field-help">
        {left > 0
          ? t(email ? 'contacts.capEmails' : 'contacts.capPhones', {
              count: left,
              most: CONTACTS_MOST,
            })
          : t('contacts.capFull', { most: CONTACTS_MOST })}
      </p>
    </section>
  );
}

function AddEmail({ onAdded, onCancel }: { onAdded: () => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => field.current?.focus(), []);

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const typed = address.trim();
    const problem =
      typed === ''
        ? t('contacts.emailBlank')
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)
          ? null
          : t('contacts.emailInvalid');

    if (problem != null) {
      setError(problem);
      field.current?.focus();
      return;
    }

    setSending(true);

    try {
      await api.addEmailAddress(typed);
      await onAdded();
    } catch (refusal) {
      setSending(false);
      setError(addRefusal(refusal, 'email', t));
      field.current?.focus();
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={(event) => void send(event)}>
      <div className="field">
        <label htmlFor="contacts-email">{t('contacts.emailLabel')}</label>
        <input
          ref={field}
          className={error == null ? 'input' : 'input input-wrong'}
          id="contacts-email"
          type="email"
          autoComplete="email"
          autoCorrect="off"
          spellCheck={false}
          value={address}
          disabled={sending}
          aria-invalid={error != null}
          aria-describedby={
            error == null ? 'contacts-email-help' : 'contacts-email-error contacts-email-help'
          }
          onChange={(event) => {
            setAddress(event.target.value);
            setError(null);
          }}
        />
        {error != null && <FieldError id="contacts-email-error" message={error} />}
        <p className="field-help" id="contacts-email-help">
          {t('contacts.emailHelp')}
        </p>
      </div>
      <div className="actions">
        <button className="button button-primary" type="submit" aria-busy={sending}>
          {t('contacts.addEmailConfirm')}
        </button>
        <button className="button" type="button" onClick={onCancel} disabled={sending}>
          {t('contacts.cancel')}
        </button>
      </div>
    </form>
  );
}

function AddPhone({
  country: initialCountry,
  onAdded,
  onCancel,
}: {
  country: string;
  onAdded: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [country, setCountry] = useState(initialCountry);
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const found = phoneLengthProblem(number, country);
    const problem = phoneProblemMessage(found, country, t);

    if (problem != null) {
      setError(problem);
      document
        .getElementById(refusedPhoneField(found) === 'country' ? 'phone-country' : 'phone-number')
        ?.focus();
      return;
    }

    setSending(true);

    try {
      await api.addPhoneNumber(country, number);
      await onAdded();
    } catch (refusal) {
      setSending(false);
      setError(addRefusal(refusal, 'phone', t));
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={(event) => void send(event)}>
      <PhoneEntry
        label={t('contacts.phoneLabel')}
        country={country}
        number={number}
        error={error}
        disabled={sending}
        help={t('contacts.phoneHelp')}
        onCountry={(code) => {
          setCountry(code);
          setError(null);
        }}
        onNumber={(typed) => {
          setNumber(typed);
          setError(null);
        }}
      />
      <div className="actions">
        <button className="button button-primary" type="submit" aria-busy={sending}>
          {t('contacts.addPhoneConfirm')}
        </button>
        <button className="button" type="button" onClick={onCancel} disabled={sending}>
          {t('contacts.cancel')}
        </button>
      </div>
    </form>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

/** The server's answer to a race the screen did not invite: each is a reason with the next step. */
function rowRefusal(refusal: unknown, kind: Kind, t: T): string {
  const email = kind === 'email';

  if (refusal instanceof ApiError && refusal.is('address_not_verified'))
    return email ? t('contacts.refusedNotVerified') : t('contacts.refusedNotVerifiedPhone');
  if (refusal instanceof ApiError && refusal.is('primary_address'))
    return email ? t('contacts.refusedPrimary') : t('contacts.refusedPrimaryPhone');
  if (refusal instanceof ApiError && refusal.is('last_verified_address'))
    return email ? t('contacts.refusedLastVerified') : t('contacts.refusedLastVerifiedPhone');

  return t('contacts.failed');
}

function addRefusal(refusal: unknown, kind: Kind, t: T): string {
  const email = kind === 'email';

  if (refusal instanceof ApiError && refusal.is('already_linked'))
    return email ? t('contacts.alreadyLinked') : t('contacts.alreadyLinkedPhone');
  if (refusal instanceof ApiError && refusal.is('address_limit_reached'))
    return t(email ? 'contacts.limitEmails' : 'contacts.limitPhones', { most: CONTACTS_MOST });
  if (refusal instanceof ApiError && refusal.is('too_many_attempts')) {
    const lifts = lockLiftsAt(Number(refusal.response?.headers.get('Retry-After')));

    return lifts == null
      ? t('contacts.limitedSoon')
      : t('contacts.limitedBody', { time: formatTimeOfDay(lifts, currentLocale()) });
  }
  if (refusal instanceof ApiError && refusal.is('validation_failed'))
    return Object.values(refusal.fieldErrors())[0] ?? t('contacts.failed');

  return t('contacts.failed');
}
