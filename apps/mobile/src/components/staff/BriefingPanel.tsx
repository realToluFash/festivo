import { ApiError, type MyNight, STAFF_RULES_MAXIMUM, type StaffEntry } from '@soirely/api-client';
import { setStringAsync } from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../../api.ts';
import { dateLocale } from '../../i18n/index.ts';
import { clockAt, headingOf, weekdayOf } from '../../kit/myNight.ts';
import { shiftLine } from '../../kit/staffRoster.ts';
import {
  copies,
  countLine,
  fitRules,
  noteOf,
  offersMark,
  withShifts,
} from '../../kit/staffBriefing.ts';
import { tokens } from '../../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from '../Buttons.tsx';
import { Field, TextField } from '../Field.tsx';
import { Glyph } from '../Glyph.tsx';
import { ListPicker } from '../ListPicker.tsx';
import { BoxField } from '../MomentPick.tsx';
import { readOut } from '../ReadOut.tsx';
import { Skeleton } from '../Skeleton.tsx';
import { Text } from '../Text.tsx';
import { BriefWord } from './BriefingCard.tsx';

export type BriefingSide =
  { kind: 'copy' } | { kind: 'rules'; editing: boolean } | { kind: 'preview'; id: string };

function say(words: string): void {
  readOut(words, { interrupts: true });
}

/** The briefing's panel (sc-95654): docked beside the roster on a tablet on its side, a centred dialog upright. One body for both. */
export function BriefingPanel({
  eventId,
  side,
  people,
  rules,
  acts,
  onSide,
  onEntry,
  onRules,
  onClose,
}: {
  eventId: string;
  side: BriefingSide;
  people: readonly StaffEntry[];
  rules: string | null;
  /** staff.manage, on an event not yet finished. */
  acts: boolean;
  onSide: (side: BriefingSide) => void;
  onEntry: (entry: StaffEntry) => void;
  onRules: (rules: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const title =
    side.kind === 'copy'
      ? t('briefing.copyTitle')
      : side.kind === 'rules'
        ? t('briefing.rules')
        : t('briefing.previewAs');

  return (
    <View style={styles.panel} testID="briefing.panel">
      <View style={styles.top}>
        <View style={styles.shrink}>
          <Text size={13} weight="semibold" style={styles.secondary}>
            {t('briefing.card')}
          </Text>
          <Text size={22} weight="bold" accessibilityRole="header">
            {title}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('briefing.close')}
          style={styles.close}
          testID="briefing.close"
        >
          <Glyph name="x" size={18} ink={tokens.colorInkSecondary} weight={2.4} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {side.kind === 'copy' && (
          <CopyList
            eventId={eventId}
            people={people}
            acts={acts}
            onEntry={onEntry}
            onClose={onClose}
          />
        )}
        {side.kind === 'rules' && (
          <Rules
            eventId={eventId}
            rules={rules ?? ''}
            editing={side.editing}
            acts={acts}
            onEdit={(editing) => onSide({ kind: 'rules', editing })}
            onRules={onRules}
          />
        )}
        {side.kind === 'preview' && (
          <Preview
            eventId={eventId}
            people={people}
            id={side.id}
            onPick={(id) => onSide({ kind: 'preview', id })}
          />
        )}
      </ScrollView>
    </View>
  );
}

function CopyList({
  eventId,
  people,
  acts,
  onEntry,
  onClose,
}: {
  eventId: string;
  people: readonly StaffEntry[];
  acts: boolean;
  onEntry: (entry: StaffEntry) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  const [held, setHeld] = useState<{ id: string; url: string } | null>(null);
  const listed = withShifts(people);

  async function copy(entry: StaffEntry): Promise<void> {
    if (busy != null) return;
    setBusy(entry.id);
    setMissed(null);
    if (held?.id === entry.id) setHeld(null);
    let answer;
    try {
      answer = await api.copyBriefingLink(eventId, entry.id);
    } catch {
      setBusy(null);
      setMissed(entry.id);
      say(t('staffLink.notIssued'));
      return;
    }
    const copied = await setStringAsync(answer.url).then(
      () => true,
      () => false,
    );
    setBusy(null);
    onEntry(answer.staff);
    if (copied) say(t('staffLink.copiedSaid'));
    else {
      setHeld({ id: entry.id, url: answer.url });
      say(t('staffLink.refused'));
    }
  }

  async function mark(entry: StaffEntry): Promise<void> {
    if (busy != null) return;
    setMissed(null);
    setBusy(entry.id);
    try {
      onEntry(await api.markBriefingSent(eventId, entry.id));
      if (held?.id === entry.id) setHeld(null);
      say(t('staffLink.marked', { name: entry.fullName }));
    } catch {
      setMissed(entry.id);
      say(t('staffLink.notIssued'));
    } finally {
      setBusy(null);
    }
  }

  if (listed.length === 0)
    return (
      <View style={styles.empty} testID="briefing.nobody">
        <Text size={17} weight="semibold" accessibilityRole="header">
          {t('briefing.nobody')}
        </Text>
        <SecondaryButton
          label={t('briefing.giveShift')}
          onPress={onClose}
          testID="briefing.giveShift"
        />
      </View>
    );

  const locale = dateLocale();

  return (
    <View style={styles.list}>
      <Text size={15} style={styles.secondary}>
        {t('briefing.copySub')}
      </Text>
      {listed.map((one) => {
        const note = noteOf(one, t);
        const copied = one.briefingCopy;
        const offered = acts && copies(one, true);
        const line = [one.job?.name, shiftLine(t, one, locale), one.station?.name]
          .filter(Boolean)
          .join(' · ');
        const heldHere = held?.id === one.id ? held.url : null;

        return (
          <View key={one.id} style={styles.copyRow} testID={`briefing.copy.row.${one.id}`}>
            <View style={styles.shrink}>
              <Text size={17} weight="semibold">
                {one.fullName}
              </Text>
              <Text size={15} style={styles.secondary}>
                {line}
              </Text>
              <BriefWord briefing={one.briefing} />
              {note != null && (
                <Text size={14} weight="medium" style={styles.secondary}>
                  {note}
                </Text>
              )}
              {copied != null && (
                <Text size={14} style={styles.secondary}>
                  {t(copied.marked ? 'staffLink.trailSent' : 'staffLink.trailCopied', {
                    name: copied.by ?? '',
                    time: clockAt(copied.at, locale),
                  })}
                </Text>
              )}
              {missed === one.id && (
                <View style={styles.missed}>
                  <Glyph name="alert" size={16} ink={tokens.colorBrokenText} />
                  <Text size={15} weight="semibold" style={styles.broken}>
                    {t('staffLink.notIssued')}
                  </Text>
                </View>
              )}
              {heldHere != null && (
                <View style={styles.held} testID={`briefing.held.${one.id}`}>
                  <View style={styles.missed}>
                    <Glyph name="alert" size={16} ink={tokens.colorBrokenText} />
                    <Text size={15} weight="semibold" style={styles.broken}>
                      {t('staffLink.refused')}
                    </Text>
                  </View>
                  <Field label={t('staffLink.linkFor', { name: one.fullName })}>
                    <TextField
                      value={heldHere}
                      editable={false}
                      accessibilityLabel={t('staffLink.linkFor', { name: one.fullName })}
                      selectTextOnFocus
                      testID={`briefing.held.field.${one.id}`}
                    />
                  </Field>
                </View>
              )}
            </View>
            {offered && (
              <View style={styles.acts}>
                <SecondaryButton
                  label={t('staffLink.copy')}
                  accessibilityLabel={t('briefing.copyFor', { name: one.fullName })}
                  off={busy === one.id}
                  onPress={() => void copy(one)}
                  testID={`briefing.copy.${one.id}`}
                />
                {offersMark(one) && (
                  <QuietButton
                    label={t('staffLink.markSent')}
                    accessibilityLabel={t('briefing.markFor', { name: one.fullName })}
                    onPress={() => void mark(one)}
                    testID={`briefing.mark.${one.id}`}
                  />
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Rules({
  eventId,
  rules,
  editing,
  acts,
  onEdit,
  onRules,
}: {
  eventId: string;
  rules: string;
  editing: boolean;
  acts: boolean;
  onEdit: (editing: boolean) => void;
  onRules: (rules: string | null) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(rules);
  const [cut, setCut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);
  const was = useRef(editing);

  useEffect(() => {
    if (editing && !was.current) {
      setDraft(rules);
      setCut(false);
      setWrong(null);
    }
    was.current = editing;
  }, [editing, rules]);

  function typed(next: string): void {
    const fitted = fitRules(draft, next);
    setDraft(fitted.text);
    setCut(fitted.cut);
    if (fitted.cut) say(t('briefing.cut', { max: STAFF_RULES_MAXIMUM }));
  }

  async function save(): Promise<void> {
    if (saving) return;
    setSaving(true);
    setWrong(null);
    try {
      onRules(await api.saveHouseRules(eventId, draft));
      setSaved(true);
      setCut(false);
      onEdit(false);
      say(t('briefing.saved'));
    } catch (error) {
      const field =
        error instanceof ApiError && error.code === 'validation_failed'
          ? error.fieldErrors().rules
          : undefined;
      setWrong(field ?? t('briefing.notSaved'));
    } finally {
      setSaving(false);
    }
  }

  const count = countLine(draft, t);
  const atLimit = count?.limit === true;
  useEffect(() => {
    if (atLimit) say(t('briefing.atLimit', { max: STAFF_RULES_MAXIMUM }));
  }, [atLimit, t]);

  if (!editing)
    return (
      <View style={styles.list} testID="briefing.rules.view">
        {saved && (
          <View style={styles.saved} testID="briefing.rules.saved">
            <Glyph name="tick" size={16} ink={tokens.colorAccentText} weight={2.6} />
            <Text size={15} weight="semibold" style={styles.shrink}>
              {t('briefing.saved')}
            </Text>
          </View>
        )}
        {rules === '' ? (
          <Text size={17} weight="semibold" testID="briefing.rules.none">
            {t('briefing.rulesNone')}
          </Text>
        ) : (
          <Text size={17} testID="briefing.rules.text">
            {rules}
          </Text>
        )}
        <Text size={15} style={styles.secondary}>
          {t('briefing.rulesWhere')}
        </Text>
        {acts && (
          <SecondaryButton
            label={t('briefing.editRules')}
            onPress={() => {
              setSaved(false);
              onEdit(true);
            }}
            testID="briefing.rules.edit"
          />
        )}
      </View>
    );

  return (
    <View style={styles.list} testID="briefing.rules.editing">
      <Field label={t('briefing.rules')} error={wrong}>
        <BoxField
          value={draft}
          wrong={wrong != null}
          onChangeText={typed}
          submitting={saving}
          multiline
          accessibilityLabel={t('briefing.rules')}
          testID="briefing.rules.box"
        />
      </Field>
      <Text size={15} style={styles.secondary}>
        {t('briefing.rulesWhere')}
      </Text>
      {count != null && (
        <Text
          size={14}
          weight="semibold"
          style={count.limit ? styles.broken : styles.secondary}
          testID="briefing.rules.count"
        >
          {count.words}
        </Text>
      )}
      {cut && (
        <View style={styles.missed} testID="briefing.rules.cut">
          <Glyph name="info" size={16} ink={tokens.colorInkSecondary} />
          <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
            {t('briefing.cut', { max: STAFF_RULES_MAXIMUM })}
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        <QuietButton
          label={t('briefing.cancel')}
          onPress={() => onEdit(false)}
          testID="briefing.rules.cancel"
        />
        <PrimaryButton
          label={t('briefing.save')}
          busy={saving}
          onPress={() => void save()}
          testID="briefing.rules.save"
        />
      </View>
    </View>
  );
}

type Previewed = { key: string; kind: 'shown'; night: MyNight } | { key: string; kind: 'failed' };

function Preview({
  eventId,
  people,
  id,
  onPick,
}: {
  eventId: string;
  people: readonly StaffEntry[];
  id: string;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const one = people.find((person) => person.id === id) ?? people[0];
  const [answered, setAnswered] = useState<Previewed | null>(null);
  const [round, setRound] = useState(0);
  const oneId = one?.id;
  const key = `${oneId}:${round}`;
  const shown = answered?.key === key ? answered : null;

  useEffect(() => {
    if (oneId == null) return undefined;
    let current = true;
    api.previewStaffNight(eventId, oneId).then(
      (night) => current && setAnswered({ key, kind: 'shown', night }),
      () => current && setAnswered({ key, kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [eventId, key, oneId]);

  if (one == null) return null;

  return (
    <View style={styles.list} testID="briefing.preview.panel">
      <Field label={t('briefing.previewWho')}>
        <ListPicker
          label={t('briefing.previewWho')}
          searchLabel={t('briefing.previewSearch')}
          choices={people.map((person) => ({ code: person.id, name: person.fullName }))}
          value={one.id}
          onChange={onPick}
          testID="briefing.preview.who"
        />
      </Field>
      <View style={styles.saved}>
        <Glyph name="eye" size={16} ink={tokens.colorInkSecondary} />
        <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
          {t('briefing.previewBanner')}
        </Text>
      </View>
      {shown == null && (
        <Skeleton shape="rows" rowHeight={64} rows={2} words={t('briefing.previewLoading')} />
      )}
      {shown?.kind === 'failed' && (
        <View style={styles.list}>
          <View style={styles.missed}>
            <Glyph name="alert" size={16} ink={tokens.colorBrokenText} />
            <Text size={15} weight="semibold" style={styles.broken}>
              {t('staffLink.notIssued')}
            </Text>
          </View>
          <SecondaryButton
            label={t('staffRoster.tryAgain')}
            onPress={() => setRound((n) => n + 1)}
            testID="briefing.preview.retry"
          />
        </View>
      )}
      {shown?.kind === 'shown' && (
        <View
          style={styles.phone}
          accessible
          accessibilityLabel={t('briefing.previewPage', { name: one.fullName })}
          testID="briefing.preview.page"
        >
          {shown.night.shift == null ? (
            <Text size={17} weight="semibold">
              {t('briefing.previewNoShift', {
                day: weekdayOf(shown.night.doorsAt, locale),
              })}
            </Text>
          ) : (
            <>
              <Text size={13} weight="semibold" style={styles.secondary}>
                {t('myNight.onTonight')}
              </Text>
              <Text size={24} weight="bold">
                {headingOf(shown.night)}
              </Text>
              <Text size={16} weight="medium">
                {`${shown.night.shift.job} · ${t('staffRoster.shift', {
                  start: clockAt(shown.night.shift.startsAt, locale),
                  end: clockAt(shown.night.shift.endsAt, locale),
                })}`}
              </Text>
              {shown.night.lead != null && (
                <Text size={15} style={styles.secondary}>
                  {`${t('myNight.yourLead')}: ${shown.night.lead.name}`}
                </Text>
              )}
            </>
          )}
          {shown.night.rules != null && (
            <View style={styles.rulesBlock}>
              <Text size={15} weight="bold">
                {t('myNight.beforeYouStart')}
              </Text>
              <Text size={15}>{shown.night.rules}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export const PANEL_WIDTH = 400;

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: tokens.colorCard,
    gap: tokens.spaceMd,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { gap: tokens.spaceLg, paddingBottom: tokens.spaceXl },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  list: { gap: tokens.spaceMd },
  empty: { gap: tokens.spaceMd, alignItems: 'flex-start' },
  copyRow: {
    gap: tokens.spaceMd,
    paddingBottom: tokens.spaceMd,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm, alignItems: 'center' },
  missed: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  held: { gap: tokens.spaceSm },
  saved: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spaceMd },
  phone: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  rulesBlock: { gap: tokens.spaceXxs, paddingTop: tokens.spaceSm },
});
