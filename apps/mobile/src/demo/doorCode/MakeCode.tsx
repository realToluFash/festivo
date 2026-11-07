import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import { Field, focusChecked, TextField } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { AlertLine } from '../events/EventEdits.tsx';
import { MomentBox, pick, type Picking, PickerLayer } from '../events/EventsPick.tsx';
import { HELD_MS, ROLE_LINES } from '../people/PeopleSample.ts';
import { RoleLayer } from '../people/PeopleAdd.tsx';
import { DoneAction } from '../people/PeopleRole.tsx';
import { RoleChoices } from '../settings/MembersRequest.tsx';
import { FocusedScreen, type Layer, Row, RowList, SectionHead } from '../settings/Summary.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import {
  clockWords,
  CODE_ROLES,
  type CodeForm,
  type CodeRole,
  dayWords,
  earlierEnds,
  type Ends,
  endMoment,
  endsRowLine,
  EVENT,
  firstProblem,
  formProblems,
  JOB_MOST,
  type MakeStart,
} from './DoorCodeModel.ts';
import { jobCount, W } from './DoorCodeWords.ts';
import { SEND_MS } from './HoldItUp.tsx';

/** Make a door code: Cancel · Door code · Make, a whole screen on a phone and the 540 sheet on an iPad; checked before it is sent. */
export function MakeCode({
  open,
  start,
  locale,
  opener,
  onClose,
  onMade,
}: {
  open: boolean;
  start: MakeStart;
  locale: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onMade: (form: CodeForm) => void;
}) {
  const [form, setForm] = useState(start.form);
  const [problems, setProblems] = useState(start.problems);
  const [failed, setFailed] = useState(start.failed);
  const [sending, setSending] = useState(start.sending !== 'idle');
  const [draft, setDraft] = useState<Ends | null>(start.endsDraft);
  const [picking, setPicking] = useState<Picking | null>(null);
  const held = useRef(start.sending === 'held');
  const capField = useRef<TextInputInstance>(null);
  const endsRow = useRef<ViewInstance>(null);
  const made = useRef(onMade);

  useEffect(() => {
    made.current = onMade;
  }, [onMade]);

  useEffect(() => {
    if (!sending) return;
    const answer = setTimeout(() => made.current(form), held.current ? HELD_MS : SEND_MS);
    held.current = false;

    return () => clearTimeout(answer);
  }, [sending, form]);

  function make(): void {
    if (sending) return;
    const found = formProblems(form);
    setProblems(found);
    const first = firstProblem(found);
    if (first === 'cap') {
      focusChecked(capField);
      return;
    }
    if (first === 'ends') {
      moveScreenReaderFocus(endsRow.current);
      return;
    }
    setFailed(false);
    setSending(true);
  }

  function closeEnds(): void {
    if (draft == null) return;
    setForm((now) => ({ ...now, ends: draft }));
    setProblems((now) => ({ ...now, ends: null }));
    setDraft(null);
  }

  const take = (next: { date: string; time: string }) =>
    setDraft(earlierEnds(next.date, next.time));
  const earlier = draft != null && draft.kind === 'earlier' ? draft : null;
  const choose = (mode: 'date' | 'time') => {
    const at = earlier ?? endMoment({ kind: 'event' });
    pick({ title: mode === 'date' ? W.day : W.time, mode, field: at, take }, setPicking);
  };
  const over: Layer | null =
    draft == null
      ? null
      : {
          layer: (
            <>
              <RoleLayer onClose={closeEnds}>
                <View style={styles.layerHead}>
                  <Text size={18} weight="bold" accessibilityRole="header" style={styles.grow}>
                    {W.ends}
                  </Text>
                  <DoneAction onPress={closeEnds} testID="door.make.ends.done" />
                </View>
                <View accessibilityRole="radiogroup">
                  <RowList
                    items={[
                      {
                        key: 'event',
                        row: (
                          <Row
                            title={W.whenEventEnds}
                            line={`${dayWords(EVENT.day, locale)}, ${clockWords(EVENT.ends, locale)}`}
                            accent={draft.kind === 'event'}
                            trail={<RadioMark on={draft.kind === 'event'} />}
                            onPress={() => setDraft({ kind: 'event' })}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: draft.kind === 'event' }}
                            testID="door.make.ends.event"
                          />
                        ),
                      },
                      {
                        key: 'earlier',
                        row: (
                          <Row
                            title={W.earlier}
                            line={W.earlierLine}
                            accent={draft.kind === 'earlier'}
                            trail={<RadioMark on={draft.kind === 'earlier'} />}
                            onPress={() =>
                              setDraft(
                                earlier ?? { kind: 'earlier', date: EVENT.day, time: '18:00' },
                              )
                            }
                            accessibilityRole="radio"
                            accessibilityState={{ checked: draft.kind === 'earlier' }}
                            testID="door.make.ends.earlier"
                          />
                        ),
                      },
                    ]}
                  />
                </View>
                {earlier != null && (
                  <View style={styles.moment}>
                    <View style={styles.labelled}>
                      <Text size={15} weight="medium" accessible={false}>
                        {W.day}
                      </Text>
                      <MomentBox
                        label={W.day}
                        mode="date"
                        value={earlier.date}
                        locale={locale}
                        year={false}
                        onPress={() => choose('date')}
                        testID="door.make.ends.day"
                      />
                    </View>
                    <View style={styles.labelled}>
                      <Text size={15} weight="medium" accessible={false}>
                        {W.time}
                      </Text>
                      <MomentBox
                        label={W.time}
                        mode="time"
                        value={earlier.time}
                        locale={locale}
                        onPress={() => choose('time')}
                        testID="door.make.ends.time"
                      />
                    </View>
                  </View>
                )}
              </RoleLayer>
              {picking != null && (
                <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
              )}
            </>
          ),
          onClose: picking != null ? () => setPicking(null) : closeEnds,
        };

  return (
    <FocusedScreen
      open={open}
      title={W.doorCode}
      verb={{
        label: sending ? W.making : W.make,
        on: !sending,
        busy: sending,
        onPress: make,
        testID: 'door.make.make',
      }}
      waits={sending}
      onCancel={onClose}
      cancelTestID="door.make.cancel"
      opener={opener}
      over={over}
      testID="door.make"
    >
      {failed && <Said words={W.makeFailed} interrupts />}
      <View>
        <SectionHead title={W.theirRole} />
        <View accessibilityRole="radiogroup">
          <RoleChoices
            roles={CODE_ROLES}
            picked={form.role}
            lines={ROLE_LINES}
            off={{ roles: ['Can edit'], line: W.noEdit }}
            onPick={(role) => {
              if (role !== 'Can edit') setForm((now) => ({ ...now, role: role as CodeRole }));
            }}
            testID="door.make.role"
          />
        </View>
      </View>
      <Field label={W.jobLabel} help={jobCount(form.job)}>
        <TextField
          value={form.job}
          onChangeText={(job) => setForm((now) => ({ ...now, job }))}
          maxLength={JOB_MOST}
          autoCapitalize="sentences"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => capField.current?.focus()}
          submitting={sending}
          accessibilityLabel={W.jobLabel}
          testID="door.make.job"
        />
      </Field>
      <Field
        label={W.howMany}
        error={problems.cap}
        help={problems.cap == null ? W.howManyHelp : undefined}
      >
        <TextField
          ref={capField}
          value={form.cap}
          onChangeText={(cap) => {
            setForm((now) => ({ ...now, cap }));
            if (problems.cap != null) setProblems((now) => ({ ...now, cap: null }));
          }}
          wrong={problems.cap != null}
          keyboardType="number-pad"
          autoFocus={problems.cap != null}
          submitting={sending}
          accessibilityLabel={W.howMany}
          testID="door.make.cap"
        />
      </Field>
      <View>
        <Row
          ref={endsRow}
          title={W.ends}
          line={endsRowLine(form.ends, locale)}
          trail={<Glyph name="down" size={18} ink={tokens.colorAccentText} weight={2.3} />}
          invalid={problems.ends != null}
          onPress={() => setDraft(form.ends)}
          testID="door.make.ends"
        />
        {problems.ends != null && <Said words={problems.ends} />}
      </View>
    </FocusedScreen>
  );
}

/** A refusal under its row, or the failure at the form's top, read out as it comes. */
function Said({ words, interrupts = false }: { words: string; interrupts?: boolean }) {
  useReadOut(words, { interrupts });

  return <AlertLine text={words} />;
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  layerHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  moment: { flexDirection: 'row', gap: tokens.spaceLg },
  labelled: { flex: 1, minWidth: 0, gap: tokens.spaceXs },
});
