import { type Account, ApiError, type Provider } from '@soirely/api-client';
import {
  CONTACTS_MOST,
  contactActions,
  contactsLeft,
  formatPhone,
  formatTimeOfDay,
  listedContacts,
  lockLiftsAt,
  phoneLengthProblem,
} from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { emailMessage, useFormChecks } from '../kit/formChecks.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { phoneProblemMessage } from '../phoneProblem.ts';
import { heldProof } from '../recentProof.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { ConfirmItsYou } from './ConfirmItsYou.tsx';
import { Field, FieldError, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { PhoneEntry } from './PhoneEntry.tsx';
import { useAboveKeyboard } from './Screen.tsx';
import { Text } from './Text.tsx';

type Kind = 'email' | 'phone';

interface Row {
  id: string;
  shown: string;
  verified: boolean;
  primary: boolean;
  pending?: boolean;
}

type Asking = { id: string; what: 'promote' | 'prove' | 'remove' } | null;

/** Settings > Account in the app: email addresses and phone numbers (sc-113), the rules shared with web. */
export function ContactsCards({
  account,
  kind: layout,
  onChanged,
}: {
  account: Account;
  kind: LayoutKind;
  onChanged: () => Promise<void>;
}) {
  const [twoFactorOn, setTwoFactorOn] = useState(false);

  useEffect(() => {
    let live = true;

    api
      .twoFactorStatus()
      .then((status) => {
        if (live) setTwoFactorOn(status.on);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <ContactsCard
        kind="email"
        layout={layout}
        rows={account.emailAddresses.map((held) => ({ ...held, shown: held.address }))}
        country={account.organisationCountry ?? ''}
        confirming={{
          via: account.hasPassword ? 'password' : (account.providers[0]?.provider ?? null),
          twoFactorOn,
        }}
        onChanged={onChanged}
      />
      <ContactsCard
        kind="phone"
        layout={layout}
        rows={account.phoneNumbers.map((held) => ({ ...held, shown: formatPhone(held.number) }))}
        country={account.organisationCountry ?? ''}
        onChanged={onChanged}
      />
    </>
  );
}

function ContactsCard({
  kind,
  layout,
  rows: all,
  country,
  confirming,
  onChanged,
}: {
  kind: Kind;
  layout: LayoutKind;
  rows: Row[];
  country: string;
  /** How the person proves it is them before an address becomes the one signing in. */
  confirming?: { via: 'password' | Provider | null; twoFactorOn: boolean };
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const rows = listedContacts(all);
  const left = contactsLeft(all);
  const [asking, setAsking] = useState<Asking>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const email = kind === 'email';
  const primary = rows.find((row) => row.primary);

  async function act(row: Row, what: 'promote' | 'remove', proof?: string): Promise<void> {
    setRowError(null);
    const standing = proof ?? heldProof();

    // An address signs the account in, so it is proved first; a number never does.
    if (email && what === 'promote' && standing == null) {
      setAsking({ id: row.id, what: 'prove' });
      return;
    }

    try {
      if (what === 'promote') {
        await (email && standing != null
          ? api.makeEmailPrimary(row.id, standing)
          : api.makePhonePrimary(row.id));
        setDone(
          email
            ? t('contacts.promoted', { address: row.shown })
            : t('contacts.promotedPhone', { number: row.shown }),
        );
      } else {
        await (email ? api.removeEmailAddress(row.id) : api.removePhoneNumber(row.id));
        setDone(t('contacts.removed', { address: row.shown }));
      }

      setAsking(null);
      await onChanged();
    } catch (refusal) {
      setRowError({ id: row.id, message: rowRefusal(refusal, kind, t) });
    }
  }

  return (
    <View style={cardFrame(layout)}>
      <View style={styles.head}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {email ? t('contacts.emailsTitle') : t('contacts.phonesTitle')}
        </Text>
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {t('contacts.count', { count: rows.length, most: CONTACTS_MOST })}
        </Text>
      </View>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {email ? t('contacts.emailsIntro') : t('contacts.phonesIntro')}
      </Text>

      {done != null && <Notice tone="done" mark={tokens.marks.done.glyph} body={done} />}

      <View>
        {rows.map((row) => {
          const offers = contactActions(row);
          const here = asking?.id === row.id ? asking.what : null;

          return (
            <View key={row.id} style={styles.row}>
              <View style={styles.detail}>
                <Text size={tokens.typeRowTitle.size} weight="semibold">
                  {row.shown}
                </Text>
                <View style={styles.state}>
                  <View style={row.verified ? styles.markOn : styles.markOff}>
                    {row.verified && (
                      <Text size={tokens.typePill.size} weight="bold" style={styles.markInk}>
                        {tokens.marks.done.glyph}
                      </Text>
                    )}
                  </View>
                  <Text
                    size={tokens.typeSmall.size}
                    weight="semibold"
                    style={row.verified ? styles.on : styles.secondary}
                  >
                    {row.verified ? t('contacts.verified') : t('contacts.unverified')}
                  </Text>
                  {row.primary && (
                    <View style={styles.pill}>
                      <Text size={tokens.typePill.size} weight="semibold" style={styles.secondary}>
                        {t('contacts.primary')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {here == null && offers.verify && (
                <SecondaryButton
                  label={t('contacts.sendCode')}
                  onPress={() =>
                    router.push(
                      email ? `/verify-email?address=${row.id}` : `/verify-phone?phone=${row.id}`,
                    )
                  }
                  testID={`contacts.${row.id}.verify`}
                />
              )}
              {here == null && offers.makePrimary && (
                <SecondaryButton
                  label={t('contacts.makePrimary')}
                  onPress={() =>
                    email ? setAsking({ id: row.id, what: 'promote' }) : void act(row, 'promote')
                  }
                  testID={`contacts.${row.id}.primary`}
                />
              )}
              {here == null && offers.remove && (
                <SecondaryButton
                  label={t('contacts.remove')}
                  accessibilityLabel={t('contacts.removeLabel', { address: row.shown })}
                  onPress={() =>
                    offers.askBeforeRemoving
                      ? setAsking({ id: row.id, what: 'remove' })
                      : void act(row, 'remove')
                  }
                  testID={`contacts.${row.id}.remove`}
                />
              )}

              {here === 'prove' && confirming != null && (
                <View style={styles.asking}>
                  <ConfirmItsYou
                    idPrefix={`contacts.${row.id}.prove`}
                    intro={t('contacts.proveIntro')}
                    via={confirming.via}
                    twoFactorOn={confirming.twoFactorOn}
                    onProved={(proved) => void act(row, 'promote', proved)}
                    onCancel={() => setAsking(null)}
                  />
                </View>
              )}

              {(here === 'promote' || here === 'remove') && (
                <View style={styles.asking}>
                  <Text size={tokens.typeBodyPhone.size} weight="semibold">
                    {here === 'promote'
                      ? t('contacts.promoteTitle')
                      : email
                        ? t('contacts.removeTitle')
                        : t('contacts.removeTitlePhone')}
                  </Text>
                  <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
                    {here === 'promote'
                      ? t('contacts.promoteBody', { old: primary?.shown ?? '' })
                      : t('contacts.removeBody')}
                  </Text>
                  <PrimaryButton
                    label={
                      here === 'promote'
                        ? t('contacts.promoteConfirm')
                        : t('contacts.removeConfirm')
                    }
                    onPress={() => void act(row, here)}
                    testID={`contacts.${row.id}.confirm`}
                  />
                  <QuietButton
                    label={
                      here === 'promote'
                        ? t('contacts.promoteKeep', { old: primary?.shown ?? '' })
                        : t('contacts.removeKeep')
                    }
                    onPress={() => setAsking(null)}
                    testID={`contacts.${row.id}.keep`}
                  />
                </View>
              )}

              {rowError?.id === row.id && (
                <View style={styles.full}>
                  <FieldError message={rowError.message} />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {adding ? (
        <Adding
          kind={kind}
          country={country}
          onAdded={async () => {
            setAdding(false);
            setDone(t('contacts.added'));
            await onChanged();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        left > 0 && (
          <SecondaryButton
            label={email ? t('contacts.addEmail') : t('contacts.addPhone')}
            onPress={() => {
              setDone(null);
              setAdding(true);
            }}
            testID={`contacts.${kind}.add`}
          />
        )
      )}

      <Text size={tokens.typeSmall.size} style={styles.secondary}>
        {left > 0
          ? t(email ? 'contacts.capEmails' : 'contacts.capPhones', {
              count: left,
              most: CONTACTS_MOST,
            })
          : t('contacts.capFull', { most: CONTACTS_MOST })}
      </Text>
    </View>
  );
}

function Adding({
  kind,
  country: initialCountry,
  onAdded,
  onCancel,
}: {
  kind: Kind;
  country: string;
  onAdded: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const email = kind === 'email';
  const typed = useRef('');
  const field = useRef<TextInput>(null);
  const aboveKeyboard = useAboveKeyboard();
  const [country, setCountry] = useState(initialCountry);
  const [refused, setRefused] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const checks = useFormChecks(
    ['value'] as const,
    (_field, value) =>
      email
        ? emailMessage(value, t)
        : phoneProblemMessage(phoneLengthProblem(value, country), country, t),
    () => field.current?.focus(),
  );
  const error = checks.errors.value ?? refused;

  async function send(): Promise<void> {
    if (sending || !checks.passes({ value: typed.current })) return;

    const value = typed.current.trim();
    setSending(true);

    try {
      await (email ? api.addEmailAddress(value) : api.addPhoneNumber(country, value));
      await onAdded();
    } catch (refusal) {
      setSending(false);
      setRefused(addRefusal(refusal, kind, t));
    }
  }

  return (
    <View ref={aboveKeyboard} style={styles.group}>
      {email ? (
        <Field label={t('contacts.emailLabel')} error={error} help={t('contacts.emailHelp')}>
          <TextField
            ref={field}
            wrong={error != null}
            editable={!sending}
            autoFocus
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onChangeText={(text) => {
              typed.current = text;
              setRefused(null);
              checks.edited('value', text);
            }}
            onBlur={() => checks.left('value', typed.current)}
            onSubmitEditing={() => void send()}
            accessibilityLabel={t('contacts.emailLabel')}
            testID="contacts.email.field"
          />
        </Field>
      ) : (
        <PhoneEntry
          ref={field}
          label={t('contacts.phoneLabel')}
          help={t('contacts.phoneHelp')}
          country={country}
          error={error}
          disabled={sending}
          onCountry={(code) => {
            setCountry(code);
            setRefused(null);
          }}
          onNumber={(text) => {
            typed.current = text;
            setRefused(null);
            checks.edited('value', text);
          }}
          onSubmit={() => void send()}
          testID="contacts.phone.field"
        />
      )}
      <PrimaryButton
        label={email ? t('contacts.addEmailConfirm') : t('contacts.addPhoneConfirm')}
        onPress={() => void send()}
        busy={sending}
        testID={`contacts.${kind}.send`}
      />
      <QuietButton
        label={t('contacts.cancel')}
        onPress={onCancel}
        testID={`contacts.${kind}.cancel`}
      />
    </View>
  );
}

/** The server's answer to a race the screen did not invite: each is a reason with the next step. */
export function rowRefusal(refusal: unknown, kind: Kind, t: TFunction): string {
  const email = kind === 'email';

  if (refusal instanceof ApiError && refusal.is('address_not_verified'))
    return email ? t('contacts.refusedNotVerified') : t('contacts.refusedNotVerifiedPhone');
  if (refusal instanceof ApiError && refusal.is('primary_address'))
    return email ? t('contacts.refusedPrimary') : t('contacts.refusedPrimaryPhone');
  if (refusal instanceof ApiError && refusal.is('last_verified_address'))
    return email ? t('contacts.refusedLastVerified') : t('contacts.refusedLastVerifiedPhone');

  return t('contacts.failed');
}

function addRefusal(refusal: unknown, kind: Kind, t: TFunction): string {
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

const styles = StyleSheet.create({
  group: { gap: tokens.spaceLg },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  secondary: { color: tokens.colorInkSecondary },
  on: { color: tokens.colorAccentText },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  detail: { flex: 1, minWidth: 160, gap: tokens.spaceXxs },
  state: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceXs },
  markOn: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    borderRadius: tokens.sizeMark / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.marks.done.fill,
  },
  markOff: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    borderColor: tokens.marks.notStarted.ring,
  },
  markInk: { color: tokens.marks.done.ink },
  pill: {
    height: tokens.sizePill,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  asking: {
    flexBasis: '100%',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorInset,
  },
  full: { flexBasis: '100%' },
});
