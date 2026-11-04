import {
  CONTACTS_MOST,
  contactActions,
  contactsLeft,
  emailProblem,
  phoneLengthProblem,
} from '@soirely/domain';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, TextField } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { PhoneEntry } from '../../components/PhoneEntry.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { ConfirmItsYou } from './AccountConfirm.tsx';
import {
  ItemRow,
  Lead,
  Note,
  RowPill,
  StateMark,
  Step,
  StepPill,
  SubHead,
  WhiteRows,
} from './AccountParts.tsx';
import { type Contact, countryName, PHONE_COUNTRY, phoneShown, plural } from './AccountSample.ts';
import { Card, CardHead, Chip, Pair, Pill } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

export type Asking = { id: string; what: 'promote' | 'prove' | 'remove' } | null;

const EMAIL_LABEL = 'Email address to add';
const PHONE_LABEL = 'Mobile number to add';

/** Email addresses or phone numbers: the rows, what each offers, and adding one. */
export function ContactsCard({
  kind,
  layout,
  rows,
  onRows,
  arrived,
  startAsking,
  startAdding,
  onVerify,
}: {
  kind: 'email' | 'phone';
  layout: SettingsLayout;
  rows: readonly Contact[];
  onRows: (rows: Contact[]) => void;
  arrived: string | null;
  startAsking: Asking;
  startAdding: boolean;
  onVerify: (row: Contact) => void;
}) {
  const email = kind === 'email';
  const wide = layout === 'portrait';
  const [asking, setAsking] = useState<Asking>(startAsking);
  const [proved, setProved] = useState(false);
  const [adding, setAdding] = useState(startAdding);
  const [said, setSaid] = useState<string | null>(null);
  const [arrival, setArrival] = useState(arrived);
  const primary = rows.find((row) => row.primary);
  const left = contactsLeft(rows);
  const landed = rows.find((row) => row.id === arrival && row.verified);
  const done = said ?? (landed == null ? null : `${landed.shown} is verified.`);

  function tellDone(line: string | null): void {
    setArrival(null);
    setSaid(line);
  }

  function promote(row: Contact, proof: boolean): void {
    if (email && !proof) {
      setAsking({ id: row.id, what: 'prove' });
      return;
    }
    onRows(rows.map((each) => ({ ...each, primary: each.id === row.id })));
    setAsking(null);
    tellDone(
      email
        ? `${row.shown} is now your primary address. Sign in with it from now on.`
        : `${row.shown} is now your primary number.`,
    );
  }

  function remove(row: Contact): void {
    onRows(rows.filter((each) => each.id !== row.id));
    setAsking(null);
    tellDone(`${row.shown} has been removed.`);
  }

  return (
    <Card>
      <CardHead
        title={email ? 'Email addresses' : 'Phone numbers'}
        line={
          email
            ? 'Your primary address signs you in and gets account mail. Other addresses can reach you, but they cannot sign you in.'
            : 'Your primary number is the one on your profile. Other numbers can reach you too.'
        }
        right={<Chip word={`${rows.length} of ${CONTACTS_MOST}`} kind="built" />}
      />
      {done != null && (
        <Notice tone="done" mark={tokens.marks.done.glyph} body={done} announce={said != null} />
      )}
      <WhiteRows>
        {rows.map((row) => {
          const offers = contactActions(row);
          const here = asking?.id === row.id ? asking.what : null;
          const acts = here == null && (offers.verify || offers.makePrimary || offers.remove);

          return (
            <ItemRow
              key={row.id}
              wide={wide}
              who={
                <>
                  <Text size={15.5} weight="semibold" style={styles.figures}>
                    {row.shown}
                  </Text>
                  <View style={styles.marks}>
                    <StateMark on={row.verified} word={row.verified ? 'Verified' : 'Unverified'} />
                    {row.primary && <Chip word="Primary" kind="accent" />}
                  </View>
                </>
              }
              actions={
                acts ? (
                  <>
                    {offers.verify && (
                      <RowPill
                        label="Send a code"
                        onPress={() => onVerify(row)}
                        accessibilityLabel={`Send a code to ${row.shown}`}
                      />
                    )}
                    {offers.makePrimary && (
                      <RowPill
                        label="Make primary"
                        onPress={() => {
                          setSaid(null);
                          if (email) setAsking({ id: row.id, what: 'promote' });
                          else promote(row, false);
                        }}
                        accessibilityLabel={`Make primary: ${row.shown}`}
                      />
                    )}
                    {offers.remove && (
                      <RowPill
                        label={offers.askBeforeRemoving ? 'Remove…' : 'Remove'}
                        kind={offers.askBeforeRemoving ? 'dangerQuiet' : 'secondary'}
                        onPress={() =>
                          offers.askBeforeRemoving
                            ? setAsking({ id: row.id, what: 'remove' })
                            : remove(row)
                        }
                        accessibilityLabel={`Remove ${row.shown}`}
                      />
                    )}
                  </>
                ) : null
              }
            >
              {here === 'promote' && (
                <Step>
                  <SubHead text="Make this your primary address?" />
                  <Lead
                    text={`You will sign in with it from now on, and account mail goes there. ${primary?.shown ?? ''} stays linked and stops signing you in.`}
                  />
                  <Pair
                    layout={layout}
                    dismiss={
                      <StepPill
                        layout={layout}
                        label={`Keep ${primary?.shown ?? ''}`}
                        kind="secondary"
                        onPress={() => setAsking(null)}
                      />
                    }
                    confirm={
                      <StepPill
                        layout={layout}
                        label="Make it primary"
                        onPress={() => promote(row, proved)}
                      />
                    }
                  />
                </Step>
              )}
              {here === 'prove' && (
                <Step>
                  <ConfirmItsYou
                    layout={layout}
                    intro="Confirm it's you before changing the address you sign in with."
                    onProved={() => {
                      setProved(true);
                      promote(row, true);
                    }}
                    onCancel={() => setAsking(null)}
                    testID={`demo.account.${row.id}.prove`}
                  />
                </Step>
              )}
              {here === 'remove' && (
                <Step>
                  <SubHead text={email ? 'Remove this address?' : 'Remove this number?'} />
                  <Lead text="Soirely stops sending anything to it. You can add it again later, with a new code." />
                  <Pair
                    layout={layout}
                    dismiss={
                      <StepPill
                        layout={layout}
                        label="Keep it"
                        kind="quiet"
                        onPress={() => setAsking(null)}
                      />
                    }
                    confirm={
                      <StepPill
                        layout={layout}
                        label="Remove it"
                        kind="danger"
                        onPress={() => remove(row)}
                      />
                    }
                  />
                </Step>
              )}
            </ItemRow>
          );
        })}
      </WhiteRows>
      <Note
        text={
          left > 0
            ? `${plural(left, 'You can add one more.', `You can add ${left} more.`)} An account holds up to ${CONTACTS_MOST} ${email ? 'email addresses' : 'phone numbers'}, including the primary.`
            : `You have ${CONTACTS_MOST}, the most an account can hold. Remove one to add another.`
        }
      />
      {adding ? (
        <Adding
          kind={kind}
          layout={layout}
          rows={rows}
          onAdded={(row) => {
            onRows([...rows, row]);
            setAdding(false);
            tellDone('Added. It is unverified until you enter the code we sent.');
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        left > 0 && (
          <Pill
            label={email ? 'Add an email address' : 'Add a phone number'}
            kind="secondary"
            glyph="plus"
            full={layout === 'phone'}
            height={tokens.sizeHitPhonePrimary}
            onPress={() => {
              tellDone(null);
              setAdding(true);
            }}
          />
        )
      )}
    </Card>
  );
}

function Adding({
  kind,
  layout,
  rows,
  onAdded,
  onCancel,
}: {
  kind: 'email' | 'phone';
  layout: SettingsLayout;
  rows: readonly Contact[];
  onAdded: (row: Contact) => void;
  onCancel: () => void;
}) {
  const email = kind === 'email';
  const typed = useRef('');
  const [country, setCountry] = useState(PHONE_COUNTRY);
  const [error, setError] = useState<string | null>(null);

  function add(): void {
    const problem = email
      ? emailProblem(typed.current)
      : phoneLengthProblem(typed.current, country);
    const name = countryName(country);
    const says = {
      blank: email ? 'Enter your email address.' : 'Enter your mobile number.',
      shape: 'That does not look like an email address. Check it has an @ and a domain.',
      noCountry: 'Choose a country.',
      tooShort: `That number looks too short for ${name}. Check it and try again.`,
      tooLong: `That number looks too long for ${name}. Check it and try again.`,
    };
    if (problem != null) {
      setError(says[problem]);
      return;
    }

    const shown = email ? typed.current.trim() : phoneShown(country, typed.current);
    if (rows.some((row) => row.shown.toLowerCase() === shown.toLowerCase())) {
      setError(
        email
          ? 'That address is already linked to an account.'
          : 'That number is already linked to an account.',
      );
      return;
    }
    onAdded({ id: `${kind}-${shown}`, shown, verified: false, primary: false });
  }

  return (
    <View style={styles.adding}>
      {email ? (
        <Field
          label={EMAIL_LABEL}
          error={error}
          help="We email a code to prove it is yours. Until then it stays unverified."
        >
          <TextField
            wrong={error != null}
            autoFocus
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="done"
            onChangeText={(text) => {
              typed.current = text;
              if (error != null) setError(null);
            }}
            onSubmitEditing={add}
            submitBehavior="submit"
            accessibilityLabel={EMAIL_LABEL}
            testID="demo.account.addEmail"
          />
        </Field>
      ) : (
        <PhoneEntry
          label={PHONE_LABEL}
          help="We text a code to prove it is yours. Until then it stays unverified."
          country={country}
          error={error}
          submitting={false}
          onCountry={(code) => {
            setCountry(code);
            setError(null);
          }}
          onNumber={(text) => {
            typed.current = text;
            if (error != null) setError(null);
          }}
          onSubmit={add}
          testID="demo.account.addPhone"
        />
      )}
      <Pair
        layout={layout}
        dismiss={<StepPill layout={layout} label="Cancel" kind="secondary" onPress={onCancel} />}
        confirm={
          <StepPill layout={layout} label={email ? 'Add address' : 'Add number'} onPress={add} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  figures: { fontVariant: ['tabular-nums'] },
  marks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  adding: { gap: tokens.spaceLg },
});
