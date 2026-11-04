import { typedNameMatches } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';

import {
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import {
  CANDIDATES,
  deleteBody,
  type OrganisationState,
  passwordRefused,
  SEND_MS,
  type TransferField,
  transferProblems,
} from './OrganisationModel.ts';
import { OWNERSHIP_WORDS as W } from './OrganisationWords.ts';
import { Card, CardHead, Pair, Pill, type PillKind, TYPE } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

type Step = 'transfer' | 'leave' | 'delete' | null;

/** The board's mismatch: Delete pressed with a lowercase e. */
const MISTYPED = 'Ire events';

function firstStep(start: OrganisationState | null, owner: boolean): Step {
  if (start === 'onlyOwner') return 'leave';
  if (!owner) return null;
  if (start === 'delete') return 'delete';

  return start === 'transfer' ? 'transfer' : null;
}

function useSend() {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (then: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(then, SEND_MS);
  };
}

/** Each step opens inside the card, in place of the rows that opened it; leaving or deleting lands on Today. */
export function OwnershipCard({
  start,
  layout,
  owner,
  locale,
}: {
  start: OrganisationState | null;
  layout: SettingsLayout;
  owner: boolean;
  locale: string;
}) {
  const [role, setRole] = useState(owner ? 'Owner' : 'Planner');
  const [step, setStep] = useState<Step>(() => firstStep(start, owner));
  const [back, setBack] = useState<Step>(null);
  const [flash, setFlash] = useState<{ words: string; tap: object } | null>(null);
  const isOwner = role === 'Owner';
  const toToday = () => router.replace('/demo/today');

  function open(next: Step, from: Step = null): void {
    setFlash(null);
    setBack(from);
    setStep(next);
  }

  const rows: { title: string; note: string; action: string; kind: PillKind; to: Step }[] = [
    ...(isOwner
      ? [
          {
            title: W.transfer,
            note: W.transferNote,
            action: W.transfer,
            kind: 'secondary' as const,
            to: 'transfer' as const,
          },
        ]
      : []),
    {
      title: W.leave,
      note: W.leaveNote,
      action: W.leaveOpener,
      kind: 'dangerQuiet',
      to: 'leave',
    },
    ...(isOwner
      ? [
          {
            title: W.delete,
            note: W.deleteNote,
            action: W.deleteOpener,
            kind: 'dangerQuiet' as const,
            to: 'delete' as const,
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHead title={W.title} />
      {flash != null && (
        <Notice tone="done" mark={tokens.marks.done.glyph} body={flash.words} answer={flash.tap} />
      )}
      {step === null &&
        rows.map((row, index) => (
          <View
            key={row.title}
            style={[
              layout === 'phone' ? styles.rowPhone : styles.rowTablet,
              index > 0 && styles.divided,
            ]}
          >
            <View style={styles.words}>
              <Text size={TYPE.row} weight="semibold">
                {row.title}
              </Text>
              <Text size={TYPE.small} weight="medium" muted>
                {row.note}
              </Text>
            </View>
            <Pill
              label={row.action}
              kind={row.kind}
              height={tokens.sizeHit}
              full={false}
              onPress={() => open(row.to)}
              testID={`demo.organisation.ownership.${row.to ?? 'none'}`}
            />
          </View>
        ))}
      {step === 'transfer' && (
        <TransferStep
          layout={layout}
          picked={start === 'transfer'}
          onKeep={() => setStep(back)}
          onDone={(name) => {
            setRole('Administrator');
            setStep(null);
            setFlash({ words: W.transferred(name), tap: {} });
          }}
        />
      )}
      {step === 'leave' && (
        <LeaveStep
          layout={layout}
          onlyOwner={isOwner}
          onStay={() => setStep(null)}
          onTransfer={() => open('transfer', 'leave')}
          onLeave={toToday}
        />
      )}
      {step === 'delete' && (
        <DeleteStep
          layout={layout}
          locale={locale}
          mistyped={start === 'delete'}
          onKeep={() => setStep(null)}
          onDeleted={toToday}
        />
      )}
    </Card>
  );
}

function StepHead({ words }: { words: string }) {
  return (
    <Text size={TYPE.row} weight="semibold" accessibilityRole="header">
      {words}
    </Text>
  );
}

function TransferStep({
  layout,
  picked,
  onKeep,
  onDone,
}: {
  layout: SettingsLayout;
  picked: boolean;
  onKeep: () => void;
  onDone: (name: string) => void;
}) {
  const phone = layout === 'phone';
  const send = useSend();
  const [startPassword] = useState(picked ? SAMPLE.password : '');
  const [chosen, setChosen] = useState<string | null>(
    picked ? (CANDIDATES[0]?.name ?? null) : null,
  );
  const [errors, setErrors] = useState<Partial<Record<TransferField, string>>>({});
  const [busy, setBusy] = useState(false);
  const typed = useRef(startPassword);
  const input = useRef<TextInputInstance>(null);

  function drop(field: TransferField): void {
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];

      return next;
    });
  }

  function transfer(): void {
    if (busy) return;
    const problems = transferProblems(chosen, typed.current);
    setErrors(problems);
    if (problems.owner == null && problems.password != null) focusChecked(input);
    if (chosen == null || problems.password != null) return;

    keysStayDown();
    setBusy(true);
    send(() => {
      setBusy(false);
      const refused = passwordRefused(typed.current);
      if (refused == null) {
        onDone(chosen);
        return;
      }
      setErrors({ password: refused });
      focusRefused(input);
    });
  }

  return (
    <View style={styles.step}>
      <StepHead words={W.transfer} />
      <Text size={TYPE.small} weight="medium" muted>
        {W.transferBody}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        <Text size={14} weight="semibold">
          {W.newOwner}
        </Text>
        {CANDIDATES.map((member) => {
          const on = member.name === chosen;

          return (
            <Pressable
              key={member.name}
              onPress={() => {
                setChosen(member.name);
                drop('owner');
              }}
              style={({ pressed }) => [
                styles.choice,
                on && styles.choiceOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${member.name}, ${member.role}`}
              testID={`demo.organisation.transfer.${member.name}`}
            >
              <View
                style={styles.mark}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <RadioMark on={on} />
              </View>
              <View style={styles.words}>
                <Text
                  size={15.5}
                  weight="semibold"
                  accessible={false}
                  style={on ? styles.accent : undefined}
                >
                  {member.name}
                </Text>
                <Text size={TYPE.small} weight="medium" muted accessible={false}>
                  {member.role}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {errors.owner != null && <FieldError message={errors.owner} />}
      </View>
      <Field label={W.password} error={errors.password} help={W.passwordWhy}>
        <PasswordField
          ref={input}
          defaultValue={startPassword}
          onChangeText={(text) => {
            typed.current = text;
            if (errors.password != null && text !== '') drop('password');
          }}
          wrong={errors.password != null}
          submitting={busy}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={transfer}
          submitBehavior="submit"
          accessibilityLabel={W.password}
          testID="demo.organisation.transfer.password"
        />
      </Field>
      <Text size={TYPE.line} weight="medium" muted>
        {W.bothEmailed(chosen ?? W.theNewOwner)}
      </Text>
      <Pair
        layout={layout}
        dismiss={
          <Pill
            label={W.keep}
            kind="secondary"
            full={phone}
            onPress={onKeep}
            testID="demo.organisation.transfer.keep"
          />
        }
        confirm={
          <Pill
            label={chosen == null ? W.transfer : W.makeOwner(chosen)}
            full={phone}
            onPress={transfer}
            testID="demo.organisation.transfer.send"
          />
        }
      />
    </View>
  );
}

function LeaveStep({
  layout,
  onlyOwner,
  onStay,
  onTransfer,
  onLeave,
}: {
  layout: SettingsLayout;
  onlyOwner: boolean;
  onStay: () => void;
  onTransfer: () => void;
  onLeave: () => void;
}) {
  const phone = layout === 'phone';
  const send = useSend();
  const [busy, setBusy] = useState(false);
  const stay = (
    <Pill
      label={W.stay}
      kind="secondary"
      full={phone}
      onPress={onStay}
      testID="demo.organisation.leave.stay"
    />
  );

  return (
    <View style={styles.step}>
      <StepHead words={W.leaveTitle} />
      {onlyOwner ? (
        <>
          <Notice
            tone="attention"
            mark="!"
            title={W.onlyOwnerTitle}
            body={W.onlyOwnerBody}
            announce
          />
          <Pair
            layout={layout}
            dismiss={stay}
            confirm={
              <Pill
                label={W.transfer}
                full={phone}
                onPress={onTransfer}
                testID="demo.organisation.leave.transfer"
              />
            }
          />
        </>
      ) : (
        <>
          <Text size={TYPE.body} weight="medium">
            {W.leaveBody}
          </Text>
          <Pair
            layout={layout}
            dismiss={stay}
            confirm={
              <Pill
                label={W.leave}
                kind="danger"
                full={phone}
                onPress={() => {
                  if (busy) return;
                  setBusy(true);
                  send(onLeave);
                }}
                testID="demo.organisation.leave.send"
              />
            }
          />
        </>
      )}
    </View>
  );
}

function DeleteStep({
  layout,
  locale,
  mistyped,
  onKeep,
  onDeleted,
}: {
  layout: SettingsLayout;
  locale: string;
  mistyped: boolean;
  onKeep: () => void;
  onDeleted: () => void;
}) {
  const phone = layout === 'phone';
  const send = useSend();
  const [now] = useState(() => new Date());
  const [startTyped] = useState(mistyped ? MISTYPED : '');
  const [matches, setMatches] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(mistyped ? W.deleteMismatch : null);
  const [busy, setBusy] = useState(false);
  const typed = useRef(startTyped);
  const input = useRef<TextInputInstance>(null);

  function remove(): void {
    if (busy) return;
    if (!typedNameMatches(typed.current, SAMPLE.organisation)) {
      setMismatch(W.deleteMismatch);
      focusChecked(input);
      return;
    }

    keysStayDown();
    setBusy(true);
    send(onDeleted);
  }

  return (
    <View style={styles.step}>
      <StepHead words={W.deleteTitle} />
      <Notice
        tone="attention"
        mark="!"
        title={W.deleteWarningTitle}
        body={deleteBody(now, locale)}
      />
      <Field
        label={W.deleteType}
        error={mismatch}
        help={matches ? W.deleteMatches : W.deleteExactly}
      >
        <TextField
          ref={input}
          defaultValue={startTyped}
          onChangeText={(text) => {
            typed.current = text;
            const same = typedNameMatches(text, SAMPLE.organisation);
            setMatches(same);
            if (same) setMismatch(null);
          }}
          wrong={mismatch != null}
          submitting={busy}
          autoCapitalize="words"
          returnKeyType="done"
          accessibilityLabel={W.deleteType}
          testID="demo.organisation.delete.name"
        />
      </Field>
      <Pair
        layout={layout}
        dismiss={
          <Pill
            label={W.deleteKeep}
            kind="secondary"
            full={phone}
            onPress={onKeep}
            testID="demo.organisation.delete.keep"
          />
        }
        confirm={
          <Pill
            label={W.deleteButton}
            kind="danger"
            full={phone}
            onPress={remove}
            testID="demo.organisation.delete.send"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rowPhone: { gap: tokens.spaceMd },
  rowTablet: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxl },
  divided: { paddingTop: 14, borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  words: { flex: 1, minWidth: 0, gap: 3 },
  step: { gap: 14 },
  choices: { gap: tokens.spaceSm },
  choice: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: tokens.spaceXl,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  choiceOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  mark: { marginTop: 1 },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: 0.8 },
});
