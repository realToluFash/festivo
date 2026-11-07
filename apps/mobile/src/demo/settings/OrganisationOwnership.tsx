import { typedNameMatches } from '@soirely/domain';
import { router } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import {
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from '../../components/Field.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { useShell } from './Frame.tsx';
import { ledEvents } from './MembersHandover.ts';
import { HandoverAsk } from './MembersHandover.tsx';
import { offeredFor, SAMPLE_LEADS, samplePeople } from './MembersSample.ts';
import {
  CANDIDATES,
  deleteBody,
  type OrganisationStart,
  type OwnershipStep,
  ownershipSteps,
  passwordRefused,
  SEND_MS,
  type TransferField,
  transferProblems,
} from './OrganisationModel.ts';
import { OWNERSHIP_WORDS as W } from './OrganisationWords.ts';
import {
  Ask,
  type AskProps,
  ChoiceRow,
  FocusedScreen,
  Line,
  RowList,
  SectionHead,
  StatusMark,
  TextAction,
} from './Summary.tsx';

/** The board's mismatch: Delete pressed with a lowercase e. */
const MISTYPED = 'Ire events';

const STEPS: Record<OwnershipStep, { label: string; note: string; removes: boolean }> = {
  transfer: { label: W.transfer, note: W.transferNote, removes: false },
  leave: { label: W.leaveOpener, note: W.leaveNote, removes: true },
  delete: { label: W.deleteOpener, note: W.deleteNote, removes: true },
};

function useSend() {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (then: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(then, SEND_MS);
  };
}

/** Transfer, leave and delete as text actions; transfer and delete on screens of their own, leaving as an Ask. */
export function OwnershipSection({
  start,
  role,
  locale,
  onTransferred,
}: {
  start: OrganisationStart;
  role: string;
  locale: string;
  onTransferred: (name: string) => void;
}) {
  const send = useSend();
  const { looking } = useShell();
  const [screen, setScreen] = useState<'transfer' | 'delete' | null>(
    start.screen === 'transfer' || start.screen === 'delete' ? start.screen : null,
  );
  const [visit, setVisit] = useState(0);
  const [leaveVisit, setLeaveVisit] = useState(0);
  // Whoever is looking leaves: Ana in Leave's states, Priya on a member's page at rest (sc-614).
  const events = start.leadsAny ? ledEvents(SAMPLE_LEADS[looking.email] ?? []) : [];
  const handsOver = role !== 'Owner' && events.length > 0;
  const [ask, setAsk] = useState<'leave' | 'onlyOwner' | null>(
    start.ask === 'leave' || start.ask === 'onlyOwner' ? start.ask : null,
  );
  const transferRef = useRef<ViewInstance>(null);
  const leaveRef = useRef<ViewInstance>(null);
  const deleteRef = useRef<ViewInstance>(null);
  const refs = { transfer: transferRef, leave: leaveRef, delete: deleteRef };
  const toToday = () => router.replace('/demo/today');

  function open(step: OwnershipStep): void {
    if (step === 'leave') {
      setLeaveVisit((count) => count + 1);
      setAsk(role === 'Owner' ? 'onlyOwner' : 'leave');
      return;
    }
    setVisit((count) => count + 1);
    setScreen(step);
  }

  const asked: AskProps =
    ask === 'onlyOwner'
      ? {
          title: W.onlyOwnerTitle,
          line: W.onlyOwnerBody,
          keep: { label: W.stay, testID: 'organisation.leave.stay' },
          confirm: { label: W.transfer, testID: 'organisation.leave.transfer' },
          onKeep: () => setAsk(null),
          onConfirm: () => {
            setAsk(null);
            open('transfer');
          },
        }
      : {
          title: W.leaveTitle,
          line: W.leaveBody,
          keep: { label: W.stay, testID: 'organisation.leave.stay' },
          confirm: { label: W.leave, testID: 'organisation.leave.confirm', removes: true },
          onKeep: () => setAsk(null),
          onConfirm: () => {
            setAsk(null);
            send(toToday);
          },
        };

  return (
    <>
      <View>
        <SectionHead title={W.title} />
        <RowList
          items={ownershipSteps(role).map((step) => ({
            key: step,
            row: (
              <View style={styles.step}>
                <TextAction
                  ref={refs[step]}
                  label={STEPS[step].label}
                  removes={STEPS[step].removes}
                  onPress={() => open(step)}
                  consequence={STEPS[step].note}
                  testID={`organisation.ownership.${step}`}
                />
              </View>
            ),
          }))}
        />
      </View>
      <Ask open={ask != null && !handsOver} opener={leaveRef} {...asked} />
      {handsOver && (
        <HandoverAsk
          key={`leave.${leaveVisit}`}
          open={ask === 'leave'}
          opener={leaveRef}
          kind="leave"
          departing={null}
          events={events}
          offered={offeredFor(samplePeople(), looking.email)}
          you={looking.email}
          words={{
            title: W.leaveTitle,
            tail: W.leaveBody,
            keep: { label: W.stay, testID: 'organisation.leave.stay' },
            verb: { label: W.leave, testID: 'organisation.leave.confirm', removes: true },
          }}
          start={leaveVisit === 0 ? start.leaving : null}
          onKeep={() => setAsk(null)}
          onDone={toToday}
          testID="organisation.leave"
        />
      )}
      <TransferScreen
        key={`transfer.${visit}`}
        open={screen === 'transfer'}
        picked={visit === 0 && start.transferPicked}
        opener={transferRef}
        onClose={() => setScreen(null)}
        onDone={(name) => {
          setScreen(null);
          onTransferred(name);
        }}
      />
      <DeleteScreen
        key={`delete.${visit}`}
        open={screen === 'delete'}
        locale={locale}
        mistyped={visit === 0 && start.deleteMistyped}
        opener={deleteRef}
        onClose={() => setScreen(null)}
        onDeleted={toToday}
      />
    </>
  );
}

function TransferScreen({
  open,
  picked,
  opener,
  onClose,
  onDone,
}: {
  open: boolean;
  picked: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const send = useSend();
  const [startPassword] = useState(picked ? SAMPLE.password : '');
  const [chosen, setChosen] = useState<string | null>(
    picked ? (CANDIDATES[0]?.name ?? null) : null,
  );
  const [errors, setErrors] = useState<Partial<Record<TransferField, string>>>({});
  const [ownerAnswer, setOwnerAnswer] = useState<object | undefined>(undefined);
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
    if (problems.owner != null) setOwnerAnswer({});
    else if (problems.password != null) focusChecked(input);
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
    <FocusedScreen
      open={open}
      title={W.transfer}
      verb={{
        label: W.transferVerb,
        on: !busy,
        onPress: transfer,
        testID: 'organisation.transfer.send',
      }}
      onCancel={onClose}
      cancelTestID="organisation.transfer.cancel"
      opener={opener}
      testID="organisation.transfer"
    >
      <Line text={W.transferBody} />
      <View>
        <SectionHead title={W.newOwner} />
        {errors.owner != null && <FieldError message={errors.owner} answer={ownerAnswer} />}
        <View accessibilityRole="radiogroup">
          <RowList
            items={CANDIDATES.map((member) => ({
              key: member.name,
              row: (
                <ChoiceRow
                  title={member.name}
                  line={member.role}
                  on={member.name === chosen}
                  onPress={() => {
                    setChosen(member.name);
                    drop('owner');
                  }}
                  testID={`organisation.transfer.${member.initials}`}
                />
              ),
            }))}
          />
        </View>
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
          testID="organisation.transfer.password"
        />
      </Field>
      <Line text={W.bothEmailed(chosen ?? W.theNewOwner)} />
    </FocusedScreen>
  );
}

function DeleteScreen({
  open,
  locale,
  mistyped,
  opener,
  onClose,
  onDeleted,
}: {
  open: boolean;
  locale: string;
  mistyped: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onDeleted: () => void;
}) {
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
    <FocusedScreen
      open={open}
      title={W.deleteTitle}
      verb={{
        label: W.deleteVerb,
        on: !busy,
        removes: true,
        onPress: remove,
        testID: 'organisation.delete.send',
      }}
      onCancel={onClose}
      cancelTestID="organisation.delete.cancel"
      opener={opener}
      testID="organisation.delete"
    >
      <View style={styles.warning}>
        <Text size={18} weight="bold" accessibilityRole="header">
          {W.deleteWarningTitle}
        </Text>
        <Line text={deleteBody(now, locale)} />
      </View>
      <View>
        <Field label={W.deleteType} error={mismatch} help={matches ? undefined : W.deleteExactly}>
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
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={remove}
            submitBehavior="submit"
            accessibilityLabel={W.deleteType}
            testID="organisation.delete.name"
          />
        </Field>
        {matches && (
          <View style={styles.matches} testID="organisation.delete.matches">
            <StatusMark kind="yes" side={16} ink={tokens.marks.done.ink} />
            <Text size={tokens.typeSmall.size} weight="medium" style={styles.secondary}>
              {W.deleteMatches}
            </Text>
          </View>
        )}
      </View>
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  step: { paddingVertical: tokens.spaceXs },
  warning: { gap: tokens.spaceXs },
  matches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingTop: tokens.spaceXs,
  },
});
