import type { DoorCodeCard } from '@soirely/api-client';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  CODE_CHOICES,
  type CodeChoice,
  type CodeClock,
  earlierEnds,
  earlierStart,
  type Ends,
  endsWords,
  eventEndWords,
  firstLine,
  LABEL_MOST,
  type MakeForm,
  makeLines,
  newCode,
  NO_LINES,
  wallOf,
} from '../kit/doorCodes.ts';
import { refusalSaid } from '../kit/refusal.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { Field, focusChecked, TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { MomentBox, pick, type Picking, PickerLayer } from './MomentPick.tsx';
import { DoneAction, RoleLayer } from './PeopleParts.tsx';
import { RadioMark } from './RadioMark.tsx';
import { useReadOut } from './ReadOut.tsx';
import { RoleChoices } from './RoleChoices.tsx';
import { moveScreenReaderFocus, type ScreenReaderTarget } from './screenReaderFocus.ts';
import { FocusedScreen, type Layer, Row, RowList, SectionHead, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

/** Make a door code: Cancel · Door code · Make, a whole screen on a phone and the sheet on an iPad; checked before it is sent. */
export function MakeDoorCode({
  open,
  eventId,
  form: start,
  replaces,
  clock,
  opener,
  onClose,
  onMade,
}: {
  open: boolean;
  eventId: string;
  form: MakeForm;
  replaces: string | null;
  clock: CodeClock;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onMade: (card: DoorCodeCard) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [form, setForm] = useState(start);
  const [lines, setLines] = useState(NO_LINES);
  const [failed, setFailed] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Ends | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const going = useRef(false);
  const capField = useRef<TextInputInstance>(null);
  const endsRow = useRef<ViewInstance>(null);

  async function make(): Promise<void> {
    if (going.current) return;
    const found = makeLines(form, clock, t);
    setLines(found);
    const first = firstLine(found);
    if (first === 'cap') {
      focusChecked(capField);
      return;
    }
    if (first === 'ends') {
      moveScreenReaderFocus(endsRow.current);
      return;
    }
    going.current = true;
    setFailed(null);
    setSending(true);

    try {
      onMade(await api.makeDoorCode(eventId, newCode(form, clock, replaces)));
    } catch (error) {
      setFailed(refusalSaid(error, t('doorCodes.failMake')));
    } finally {
      going.current = false;
      setSending(false);
    }
  }

  function closeEnds(): void {
    if (draft == null) return;
    setForm((now) => ({ ...now, ends: draft }));
    setLines((now) => ({ ...now, ends: null }));
    setDraft(null);
  }

  const take = (next: { date: string; time: string }) =>
    setDraft(earlierEnds(next.date, next.time, clock));
  const earlier = draft?.kind === 'earlier' ? draft : null;
  const choose = (mode: 'date' | 'time') => {
    const at = earlier ?? wallOf(clock.endsAt, clock.timeZone);
    pick(
      {
        title: t(mode === 'date' ? 'doorCodes.day' : 'doorCodes.time'),
        mode,
        field: at,
        take,
      },
      setPicking,
    );
  };
  const over: Layer | null =
    draft == null
      ? null
      : {
          layer: (
            <>
              <RoleLayer closeLabel={t('doorCodes.close')} onClose={closeEnds}>
                <View style={styles.layerHead}>
                  <Text size={18} weight="bold" accessibilityRole="header" style={styles.grow}>
                    {t('doorCodes.ends')}
                  </Text>
                  <DoneAction
                    label={t('eventPeople.done')}
                    onPress={closeEnds}
                    testID="door.make.ends.done"
                  />
                </View>
                <View accessibilityRole="radiogroup">
                  <RowList
                    items={[
                      {
                        key: 'event',
                        row: (
                          <Row
                            title={t('doorCodes.whenEventEnds')}
                            line={eventEndWords(clock)}
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
                            title={t('doorCodes.earlier')}
                            line={t('doorCodes.earlierLine')}
                            accent={draft.kind === 'earlier'}
                            trail={<RadioMark on={draft.kind === 'earlier'} />}
                            onPress={() => setDraft(earlier ?? earlierStart(clock))}
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
                        {t('doorCodes.day')}
                      </Text>
                      <MomentBox
                        label={t('doorCodes.day')}
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
                        {t('doorCodes.time')}
                      </Text>
                      <MomentBox
                        label={t('doorCodes.time')}
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
      title={t('doorCodes.doorCode')}
      verb={{
        label: t(sending ? 'doorCodes.making' : 'doorCodes.make'),
        on: !sending,
        busy: sending,
        onPress: () => void make(),
        testID: 'door.make.make',
      }}
      waits={sending}
      onCancel={onClose}
      cancelTestID="door.make.cancel"
      opener={opener}
      over={over}
      testID="door.make"
    >
      {failed != null && (
        <View style={styles.failed}>
          <Said words={failed} interrupts />
          <TextAction
            label={t('doorCodes.tryAgain')}
            onPress={() => void make()}
            testID="door.make.tryAgain"
          />
        </View>
      )}
      <View>
        <SectionHead title={t('doorCodes.theirRole')} />
        <View accessibilityRole="radiogroup">
          <RoleChoices<CodeChoice>
            roles={CODE_CHOICES}
            picked={form.role}
            name={(role) => t(`eventPeople.role.${role}`)}
            lines={{
              can_view: t('eventPeople.roleMeans.can_view'),
              can_check_in: t('eventPeople.roleMeans.can_check_in'),
            }}
            off={{ roles: ['can_edit'], line: t('doorCodes.noEdit') }}
            onPick={(role) => {
              if (role !== 'can_edit') setForm((now) => ({ ...now, role }));
            }}
            testID="door.make.role"
          />
        </View>
      </View>
      <Field
        label={t('eventPeople.jobLabel')}
        help={t('eventPeople.jobHelp', { length: [...form.label].length, most: LABEL_MOST })}
      >
        <TextField
          value={form.label}
          onChangeText={(label) => setForm((now) => ({ ...now, label }))}
          autoCapitalize="sentences"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => capField.current?.focus()}
          submitting={sending}
          accessibilityLabel={t('eventPeople.jobLabel')}
          testID="door.make.job"
        />
      </Field>
      <Field
        label={t('doorCodes.howMany')}
        error={lines.cap}
        help={lines.cap == null ? t('doorCodes.howManyHelp') : undefined}
      >
        <TextField
          ref={capField}
          value={form.cap}
          onChangeText={(cap) => {
            setForm((now) => ({ ...now, cap }));
            if (lines.cap != null) setLines((now) => ({ ...now, cap: null }));
          }}
          wrong={lines.cap != null}
          keyboardType="number-pad"
          submitting={sending}
          accessibilityLabel={t('doorCodes.howMany')}
          testID="door.make.cap"
        />
      </Field>
      <View>
        <Row
          ref={endsRow}
          title={t('doorCodes.ends')}
          line={endsWords(form.ends, clock, t)}
          trail={<Glyph name="down" size={18} ink={tokens.colorAccentText} weight={2.3} />}
          invalid={lines.ends != null}
          onPress={() => setDraft(form.ends)}
          testID="door.make.ends"
        />
        {lines.ends != null && <Said words={lines.ends} />}
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
  failed: { alignItems: 'flex-start' },
});
