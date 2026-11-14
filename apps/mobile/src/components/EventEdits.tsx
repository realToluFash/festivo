import { EVENT_TYPES, type EventType, HOSTS_MAXIMUM, foldedName } from '@soirely/domain';
import { type ComponentProps, type ReactNode, type RefObject, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { type EditPart } from '../kit/eventNav.ts';
import { meshFor } from '../kit/today.ts';
import { weight } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { AlertLine } from './AlertLine.tsx';
import { EventField as ProductField } from './EventField.tsx';
import { EventMesh } from './EventMesh.tsx';
import { EventNotice } from './EventNotice.tsx';
import { SearchField } from './EventsSearch.tsx';
import { TextField, type TextFieldProps } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { BoxField, MomentBox, type Picking, PickerLayer } from './MomentPick.tsx';
import { RadioMark } from './RadioMark.tsx';
import { type ScreenReaderTarget } from './screenReaderFocus.ts';
import { useShell } from './settingsShell.ts';
import { Pill } from './SettingsParts.tsx';
import { ASK_WIDTH, type AskProps, FocusedScreen, Row, RowList, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

export const EDIT_PARTS: readonly EditPart[] = [
  'dates',
  'venue',
  'hosts',
  'type',
  'currency',
  'name',
  'cover',
];

const TITLE_KEY: Record<EditPart, string> = {
  dates: 'eventPage.dates',
  venue: 'eventPage.venue',
  hosts: 'eventHosts.heading',
  type: 'eventForm.type',
  currency: 'eventForm.currency',
  name: 'eventPage.eventName',
  cover: 'eventCover.dialogTitle',
};

export function useEditTitle(): (part: EditPart) => string {
  const { t } = useTranslation();

  return (part) => t(TITLE_KEY[part]);
}

type Opener = RefObject<ScreenReaderTarget | null>;

export interface ShellProps {
  open: boolean;
  title: string;
  testID: string;
  opener: Opener;
  verb?: string;
  changed: boolean;
  /** A save out: Save says so, and Cancel waits until it answers. */
  busy?: boolean;
  onSave: () => void;
  onClose: () => void;
  asking?: 'discard' | 'latest' | null;
  /** Somebody else saved since it opened (412): what was typed stays, and Show the latest asks first. */
  elsewhere?: { onLatest: () => void; pending?: boolean } | null;
  failed?: boolean;
  ask?: AskProps | null;
  over?: { layer: ReactNode; onClose: () => void } | null;
  toast?: { words: string; onClose: () => void } | null;
  children: ReactNode;
}

export function useEditGap(): number {
  return useShell().layout === 'phone' ? tokens.spaceXl : tokens.spaceLg;
}

/** Each part on its own screen: Cancel, the part's title and Save, which stays off until something changes. */
export function EditShell({
  open,
  title,
  testID,
  opener,
  verb,
  changed,
  busy = false,
  onSave,
  onClose,
  asking = null,
  elsewhere = null,
  failed = false,
  ask = null,
  over = null,
  toast = null,
  children,
}: ShellProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState<'discard' | 'latest' | null>(asking);
  const gap = useEditGap();
  const discard: AskProps | null =
    question === 'discard'
      ? {
          title: t('eventEdit.discardTitle'),
          line: t('eventEdit.discardLine'),
          keep: { label: t('eventEdit.keepEditing'), testID: `${testID}.keep` },
          confirm: { label: t('eventEdit.discard'), testID: `${testID}.discard`, removes: true },
          onKeep: () => setQuestion(null),
          onConfirm: onClose,
        }
      : null;
  const latest: AskProps | null =
    question === 'latest' && elsewhere != null
      ? {
          title: t('eventEdit.showLatestTitle'),
          line: t('eventEdit.showLatestBody'),
          keep: { label: t('eventEdit.keepEditing'), testID: `${testID}.latest.keep` },
          confirm: {
            label: t('eventEdit.showLatest'),
            testID: `${testID}.latest.show`,
            removes: true,
            ...(elsewhere.pending === true ? { busy: t('eventEdit.showLatest') } : {}),
          },
          onKeep: () => setQuestion(null),
          onConfirm: () => {
            setQuestion(null);
            elsewhere.onLatest();
          },
        }
      : null;
  const asked = latest ?? ask ?? discard;

  return (
    <FocusedScreen
      gap={gap}
      open={open}
      title={title}
      verb={{
        label: busy ? t('eventEdit.saving') : (verb ?? t('eventEdit.savePart')),
        on: changed && !busy,
        onPress: onSave,
        busy,
        testID: `${testID}.save`,
      }}
      waits={busy}
      onCancel={() => (changed ? setQuestion('discard') : onClose())}
      cancelTestID={`${testID}.cancel`}
      opener={opener}
      ask={asked && { ...asked, width: ASK_WIDTH }}
      over={over}
      toast={toast}
      testID={testID}
    >
      {elsewhere != null && (
        <EventNotice
          tone="broken"
          words={t('eventEdit.changedElsewhere')}
          interrupts
          actions={
            <TextAction
              label={t('eventEdit.showLatest')}
              onPress={() => setQuestion('latest')}
              testID={`${testID}.latest`}
            />
          }
        />
      )}
      {failed && <EventNotice tone="broken" words={t('eventEdit.notSaved')} interrupts />}
      {children}
    </FocusedScreen>
  );
}

export function EventField({
  optional = false,
  ...rest
}: Omit<ComponentProps<typeof ProductField>, 'optional'> & { optional?: boolean }) {
  const { t } = useTranslation();

  return <ProductField {...rest} optional={optional ? t('eventForm.optional') : undefined} />;
}

export function Choices<Key extends string>({
  items,
  on,
  onPick,
  testID,
}: {
  items: readonly { key: Key; title: string }[];
  on: Key | null;
  onPick: (key: Key) => void;
  testID: string;
}) {
  return (
    <View accessibilityRole="radiogroup">
      <RowList
        items={items.map((one) => ({
          key: one.key,
          row: (
            <Row
              title={one.title}
              trail={<RadioMark on={one.key === on} />}
              accent={one.key === on}
              onPress={() => onPick(one.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: one.key === on }}
              testID={`${testID}.${one.key}`}
            />
          ),
        }))}
      />
    </View>
  );
}

export function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.labelled}>
      <Text size={14} weight="semibold" style={styles.label}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function DatePair({
  label,
  at,
  locale,
  wrong = false,
  firstRef,
  onPick,
  testID,
  children,
}: {
  label: string;
  at: { date: string; time: string };
  locale: string;
  wrong?: boolean;
  firstRef?: RefObject<ViewInstance | null>;
  onPick: (mode: 'date' | 'time') => void;
  testID: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const slot = (mode: 'date' | 'time') => {
    const value = mode === 'date' ? at.date : at.time;
    const word = mode === 'date' ? t('eventForm.date') : t('eventForm.time');
    const width = mode === 'time' ? 104 : undefined;
    const id = `${testID}${mode === 'date' ? 'Date' : 'Time'}`;
    const ref = mode === 'date' ? firstRef : undefined;

    return value === '' ? (
      <Pressable
        ref={ref}
        onPress={() => onPick(mode)}
        style={({ pressed }) => [
          styles.select,
          width == null ? styles.grow : { width },
          wrong && styles.selectWrong,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${word}`}
        testID={id}
      >
        <Text size={16} weight="medium" accessible={false} style={styles.secondary}>
          {word}
        </Text>
      </Pressable>
    ) : (
      <MomentBox
        {...(ref == null ? {} : { ref })}
        label={`${label}, ${word}`}
        mode={mode}
        value={value}
        locale={locale}
        {...(width == null ? {} : { width })}
        wrong={wrong}
        onPress={() => onPick(mode)}
        testID={id}
      />
    );
  };

  return (
    <Labelled label={label}>
      <View style={styles.pair}>
        {slot('date')}
        {slot('time')}
      </View>
      {children}
    </Labelled>
  );
}

export function SelectBox({
  label,
  value,
  placeholder,
  expanded,
  wrong = false,
  onPress,
  ref,
  testID,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  expanded?: boolean;
  wrong?: boolean;
  onPress: () => void;
  ref?: RefObject<ViewInstance | null>;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [
        styles.select,
        wrong && styles.selectWrong,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      {...(expanded == null ? {} : { accessibilityState: { expanded } })}
      accessibilityLabel={`${label}, ${value ?? placeholder ?? ''}`}
      testID={testID}
    >
      <Text
        size={16}
        weight="medium"
        accessible={false}
        style={[styles.grow, value == null && styles.secondary]}
      >
        {value ?? placeholder}
      </Text>
      <Glyph name="down" size={18} ink={tokens.colorInkSecondary} weight={2.3} />
    </Pressable>
  );
}

export function Hint({ words, said = false }: { words: string; said?: boolean }) {
  return (
    <Text
      size={13.5}
      weight={said ? 'semibold' : 'medium'}
      style={[styles.hint, !said && styles.secondary]}
    >
      {words}
    </Text>
  );
}

export interface Wall {
  date: string;
  time: string;
}

export function DatesView({
  from,
  to,
  zone,
  locale,
  startError = null,
  startLine = null,
  endError = null,
  moved = null,
  endLine = null,
  zones,
  zonesOpen,
  onZonesOpen,
  onZone,
  onPickStart,
  onPickEnd,
  startRef,
}: {
  from: Wall;
  to: Wall;
  zone: string;
  locale: string;
  startError?: string | null;
  /** Under Starts: a time the clocks skip, or what moving the start does to Reply by (sc-3780). */
  startLine?: string | null;
  endError?: string | null;
  moved?: string | null;
  /** Under Ends instead of its hint: a time the clocks skip. */
  endLine?: string | null;
  zones: readonly string[];
  zonesOpen: boolean;
  onZonesOpen: (open: boolean) => void;
  onZone: (zone: string) => void;
  onPickStart: (mode: 'date' | 'time') => void;
  onPickEnd: (mode: 'date' | 'time') => void;
  startRef?: RefObject<ViewInstance | null>;
}) {
  const { t } = useTranslation();

  return (
    <>
      <DatePair
        label={t('eventForm.starts')}
        at={from}
        locale={locale}
        wrong={startError != null}
        {...(startRef == null ? {} : { firstRef: startRef })}
        onPick={onPickStart}
        testID="event.edit.dates.start"
      >
        {startError != null && <AlertLine text={startError} />}
        {startLine != null && <Hint words={startLine} said />}
      </DatePair>
      <DatePair
        label={t('eventForm.ends')}
        at={to}
        locale={locale}
        wrong={endError != null}
        onPick={onPickEnd}
        testID="event.edit.dates.end"
      />
      {endError != null ? (
        <AlertLine text={endError} />
      ) : moved != null ? (
        <Hint words={moved} said />
      ) : (
        <Hint words={endLine ?? t('eventForm.endsHint')} />
      )}
      <Labelled label={t('eventForm.timeZone')}>
        <SelectBox
          label={t('eventForm.timeZone')}
          value={zone}
          expanded={zonesOpen}
          onPress={() => onZonesOpen(!zonesOpen)}
          testID="event.edit.dates.zone"
        />
        <Hint words={t('eventForm.timesIn', { zone })} />
      </Labelled>
      {zonesOpen && (
        <Choices
          items={zones.map((one) => ({ key: one, title: one }))}
          on={zone}
          onPick={(one) => {
            onZone(one);
            onZonesOpen(false);
          }}
          testID="event.edit.dates.zone"
        />
      )}
    </>
  );
}

export function pickerOver(
  picking: Picking | null,
  locale: string,
  onClose: () => void,
): { layer: ReactNode; onClose: () => void } | null {
  return picking == null
    ? null
    : { layer: <PickerLayer picking={picking} locale={locale} onClose={onClose} />, onClose };
}

export interface Suggested {
  key: string;
  title: string;
  line?: string | undefined;
}

export function VenueFieldsView({
  name,
  address,
  onName,
  onAddress,
  suggestions,
  onSuggestion,
  down,
  offer = null,
  nameError = null,
  addressError = null,
  nameRef,
  addressRef,
  autoFocus = false,
  off = false,
  testID,
}: {
  name: string;
  address: string;
  onName: (name: string) => void;
  onAddress: (address: string) => void;
  suggestions: readonly Suggested[];
  onSuggestion: (key: string) => void;
  down: boolean;
  /** A venue chosen in another zone: Use it or Keep the event's. */
  offer?: { zone: string; keep: string; onUse: () => void; onKeep: () => void } | null;
  nameError?: string | null;
  addressError?: string | null;
  nameRef?: RefObject<TextInputInstance | null>;
  addressRef?: RefObject<TextInputInstance | null>;
  autoFocus?: boolean;
  off?: boolean;
  testID: string;
}) {
  const { t } = useTranslation();
  const optional = t('eventForm.optional');
  const below =
    suggestions.length > 0
      ? t('eventForm.venueSuggestionsBelow', { count: suggestions.length })
      : null;

  return (
    <>
      <EventField label={t('eventForm.venueName')} optional error={nameError}>
        <BoxField
          ref={nameRef}
          value={name}
          wrong={nameError != null}
          editable={!off}
          onChangeText={onName}
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => addressRef?.current?.focus()}
          accessibilityLabel={`${t('eventForm.venueName')} · ${optional}`}
          testID={`${testID}.name`}
        />
      </EventField>
      <EventField
        label={t('eventForm.venueAddress')}
        optional
        error={addressError}
        help={down || below != null || offer != null ? undefined : t('eventForm.venueAddressHint')}
      >
        <BoxField
          ref={addressRef}
          value={address}
          wrong={addressError != null}
          editable={!off}
          autoFocus={autoFocus}
          onChangeText={onAddress}
          autoCorrect={false}
          accessibilityLabel={`${t('eventForm.venueAddress')} · ${optional}`}
          testID={`${testID}.address`}
        />
      </EventField>
      {down && <AlertLine text={t('eventForm.venueLookupDown')} />}
      {below != null && (
        <>
          <Hint words={below} />
          <RowList
            items={suggestions.map((one) => ({
              key: one.key,
              inset: 40,
              row: (
                <Row
                  title={one.title}
                  line={one.line}
                  lead={<LineIcon name="pin" />}
                  onPress={() => onSuggestion(one.key)}
                  testID={`${testID}.suggestion.${one.title}`}
                />
              ),
            }))}
          />
        </>
      )}
      {offer != null && (
        <EventNotice
          tone="quiet"
          words={t('eventForm.venueZoneOffer', { zone: offer.zone })}
          actions={
            <View style={styles.offer}>
              <TextAction
                label={t('eventForm.venueZoneUse', { zone: offer.zone })}
                onPress={offer.onUse}
                testID={`${testID}.useZone`}
              />
              <TextAction
                label={t('eventForm.venueZoneKeep', { zone: offer.keep })}
                onPress={offer.onKeep}
                testID={`${testID}.keepZone`}
              />
            </View>
          }
        />
      )}
    </>
  );
}

export function ArrivalNoteField({
  note,
  onNote,
  error = null,
  autoFocus = false,
  noteRef,
  testID,
}: {
  note: string;
  onNote: (note: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  noteRef?: RefObject<TextInputInstance | null>;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <EventField
      label={t('eventForm.arrivalNote')}
      optional
      error={error}
      help={t('eventForm.arrivalNoteHint')}
    >
      <NoteBox
        ref={noteRef}
        value={note}
        onChangeText={onNote}
        autoFocus={autoFocus}
        wrong={error != null}
        accessibilityLabel={`${t('eventForm.arrivalNote')} · ${t('eventForm.optional')}`}
        accessibilityHint={t('eventForm.arrivalNoteHint')}
        testID={testID}
      />
    </EventField>
  );
}

export interface Host {
  key: number;
  name: string;
}

export function HostRows({
  hosts,
  onHosts,
  errors,
  kept = false,
  focusAt = null,
  refs,
  off = false,
  onSaid,
  testID,
}: {
  hosts: readonly Host[];
  onHosts: (hosts: Host[]) => void;
  errors: readonly (string | null)[];
  kept?: boolean;
  focusAt?: number | null;
  refs?: RefObject<Map<number, TextInputInstance>>;
  off?: boolean;
  onSaid: (words: string) => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const label = (position: number) => t('eventHosts.label', { position });
  const move = (from: number, to: number) => {
    const moved = [...hosts];
    const [one] = moved.splice(from, 1);
    if (one == null) return;
    moved.splice(to, 0, one);
    onHosts(moved);
    onSaid(
      t('eventHosts.moved', {
        name: one.name.trim() || label(from + 1),
        position: to + 1,
        count: moved.length,
      }),
    );
  };

  return (
    <>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {t('eventHosts.explainer')}
      </Text>
      {hosts.map((host, index) => {
        const error = errors[index] ?? null;
        const named = host.name.trim() || label(index + 1);

        return (
          <View key={host.key} style={styles.host}>
            <View style={styles.hostHead}>
              <Text size={14} weight="semibold" style={styles.grow}>
                {label(index + 1)}
              </Text>
              {!kept && !off && (
                <TextAction
                  label={t('eventHosts.remove')}
                  onPress={() => {
                    onHosts(hosts.filter((one) => one.key !== host.key));
                    onSaid(t('eventHosts.removed', { name: named }));
                  }}
                  accessibilityLabel={t('eventHosts.removeNamed', { name: named })}
                  testID={`${testID}.remove.${index}`}
                />
              )}
            </View>
            <View style={styles.hostRow}>
              <View style={styles.grow}>
                <BoxField
                  ref={(input) => {
                    if (input == null) refs?.current.delete(host.key);
                    else refs?.current.set(host.key, input);
                  }}
                  value={host.name}
                  wrong={error != null}
                  editable={!off}
                  autoFocus={focusAt === index}
                  onChangeText={(typed) =>
                    onHosts(
                      hosts.map((one) => (one.key === host.key ? { ...one, name: typed } : one)),
                    )
                  }
                  autoCapitalize="words"
                  autoCorrect={false}
                  accessibilityLabel={label(index + 1)}
                  testID={`${testID}.field.${index}`}
                />
              </View>
              {!kept && !off && (
                <>
                  <MoveButton
                    glyph="up"
                    label={t('eventHosts.moveUp', { name: named })}
                    off={index === 0}
                    onPress={() => move(index, index - 1)}
                  />
                  <MoveButton
                    glyph="down"
                    label={t('eventHosts.moveDown', { name: named })}
                    off={index === hosts.length - 1}
                    onPress={() => move(index, index + 1)}
                  />
                </>
              )}
            </View>
            {error != null && <AlertLine text={error} />}
          </View>
        );
      })}
      {kept && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
          {t('eventHosts.lastHost')}
        </Text>
      )}
      {hosts.length >= HOSTS_MAXIMUM ? (
        <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
          {t('eventHosts.most', { most: HOSTS_MAXIMUM })}
        </Text>
      ) : (
        !off && (
          <TextAction
            label={t('eventHosts.add')}
            glyph="plus"
            onPress={() =>
              onHosts([
                ...hosts,
                { key: Math.max(HOSTS_MAXIMUM, ...hosts.map((one) => one.key + 1)), name: '' },
              ])
            }
            testID={`${testID}.add`}
          />
        )
      )}
    </>
  );
}

function MoveButton({
  glyph,
  label,
  off,
  onPress,
}: {
  glyph: 'up' | 'down';
  label: string;
  off: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.move, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={label}
    >
      <Glyph
        name={glyph}
        size={18}
        ink={off ? tokens.colorInkTertiary : tokens.colorInk}
        weight={2.4}
      />
    </Pressable>
  );
}

export function TypeChoices({
  type,
  onPick,
  testID,
}: {
  type: EventType | null;
  onPick: (type: EventType) => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const word = (one: EventType) => t(`eventTypes.${one}`);
  const shown = EVENT_TYPES.filter((one) => foldedName(word(one)).includes(foldedName(typed)));

  return (
    <>
      <View style={styles.searchRow}>
        <SearchField
          typed={typed}
          off={false}
          width={null}
          onTyped={setTyped}
          onSearch={() => undefined}
          onClear={() => setTyped('')}
          label={t('eventForm.searchType')}
          testID={`${testID}.search`}
        />
      </View>
      <Choices
        items={shown.map((one) => ({ key: one, title: word(one) }))}
        on={type}
        onPick={onPick}
        testID={testID}
      />
    </>
  );
}

export function CurrencyView({
  code,
  choices,
  refused,
  onPick,
}: {
  code: string;
  choices: readonly { code: string; name: string }[];
  refused: boolean;
  onPick: (code: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {refused && <EventNotice tone="broken" words={t('eventEdit.currencyInUse')} interrupts />}
      <Choices
        items={choices.map((one) => ({ key: one.code, title: `${one.code} · ${one.name}` }))}
        on={code}
        onPick={onPick}
        testID="event.edit.currency"
      />
    </>
  );
}

export function NameView({
  name,
  error,
  count,
  most,
  onName,
  nameRef,
}: {
  name: string;
  error: string | null;
  count: number;
  most: number;
  onName: (name: string) => void;
  nameRef?: RefObject<TextInputInstance | null>;
}) {
  const { t } = useTranslation();

  return (
    <EventField
      label={t('eventForm.name')}
      error={error}
      help={t('eventForm.nameCount', { count, most })}
    >
      <BoxField
        ref={nameRef}
        value={name}
        wrong={error != null}
        autoFocus
        maxLength={most}
        onChangeText={onName}
        accessibilityLabel={t('eventForm.name')}
        testID="event.edit.name.field"
      />
    </EventField>
  );
}

export type Position = 'top' | 'middle' | 'bottom';

export function CoverPreview({ photo, meshKey }: { photo: ReactNode | null; meshKey: string }) {
  return (
    <View
      style={styles.preview}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {photo ?? <EventMesh event={{ mesh: meshFor(meshKey), photo: null }} />}
    </View>
  );
}

export function CoverUpload({
  refused = null,
  off = false,
  kind,
  onUpload,
  testID,
}: {
  refused?: string | null;
  off?: boolean;
  kind?: 'secondary';
  onUpload: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <>
      {refused != null ? (
        <EventNotice tone="broken" words={refused} interrupts />
      ) : (
        <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
          {t('eventCover.meshLine')}
        </Text>
      )}
      {!off && (
        <Pill
          label={t('eventCover.upload')}
          {...(kind == null ? {} : { kind })}
          glyph="camera"
          onPress={onUpload}
          testID={testID}
        />
      )}
      <Hint words={t('eventCover.accepted')} />
    </>
  );
}

export function CoverPhotoFields({
  position,
  onPosition,
  described,
  onDescribed,
  count,
  most,
  describeError = null,
  describeRef,
  onChange,
  onRemove,
  off = false,
}: {
  position: Position;
  onPosition: (position: Position) => void;
  described: string;
  onDescribed: (described: string) => void;
  count: number;
  most: number;
  describeError?: string | null;
  describeRef?: RefObject<TextInputInstance | null>;
  onChange: () => void;
  onRemove: () => void;
  off?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <TextAction
        label={t('eventCover.change')}
        glyph="camera"
        off={off}
        onPress={onChange}
        testID="event.edit.cover.change"
      />
      <PositionSlider position={position} onPosition={onPosition} />
      <EventField
        label={t('eventCover.describe')}
        optional
        error={describeError}
        help={t('eventCover.describeHint')}
      >
        <BoxField
          ref={describeRef}
          value={described}
          wrong={describeError != null}
          onChangeText={onDescribed}
          multiline
          accessibilityLabel={`${t('eventCover.describe')} · ${t('eventForm.optional')}`}
          testID="event.edit.cover.describe"
        />
      </EventField>
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint, styles.figures]}>
        {t('eventCover.describeCount', { count, most })}
      </Text>
      <TextAction
        label={t('eventCover.remove')}
        removes
        off={off}
        consequence={t('eventCover.removeLine')}
        onPress={onRemove}
        testID="event.edit.cover.remove"
      />
    </>
  );
}

const POSITIONS: readonly Position[] = ['top', 'middle', 'bottom'];

/** Top to Bottom in three stops, as the board draws it; a screen reader moves it a stop at a time. */
function PositionSlider({
  position,
  onPosition,
}: {
  position: Position;
  onPosition: (position: Position) => void;
}) {
  const { t } = useTranslation();
  const at = POSITIONS.indexOf(position);
  const showing = t(`eventCover.showing_${position}`);
  const step = (by: number) => {
    const next = POSITIONS[Math.min(2, Math.max(0, at + by))];
    if (next != null) onPosition(next);
  };

  return (
    <View style={styles.slider}>
      <Text size={14} weight="semibold" style={styles.label}>
        {t('eventCover.position')}
      </Text>
      <View style={styles.track}>
        <View
          style={styles.track}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('eventCover.position')}
          accessibilityValue={{ text: showing }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(action) =>
            step(action.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
          testID="event.edit.cover.position"
        >
          <View style={styles.rail} />
          <View style={styles.stops}>
            {POSITIONS.map((one) => (
              <View key={one} style={styles.stop}>
                {one === position && <View style={styles.knob} />}
              </View>
            ))}
          </View>
        </View>
        <View
          style={styles.stops}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {POSITIONS.map((one) => (
            <Pressable key={one} onPress={() => onPosition(one)} style={styles.stop} />
          ))}
        </View>
      </View>
      <View style={styles.ends}>
        <Text size={13.5} weight="medium" style={[styles.grow, styles.secondary]}>
          {t('eventCover.top')}
        </Text>
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {t('eventCover.bottom')}
        </Text>
      </View>
      <Hint words={showing} />
    </View>
  );
}

/** The arrival note's box: BoxField's look, four lines tall at first, growing to ten and then scrolling inside. */
export function NoteBox({
  wrong = false,
  accessibilityLabel,
  ...rest
}: TextFieldProps & { accessibilityLabel: string }) {
  const [focused, setFocused] = useState(false);

  return (
    <TextField
      {...rest}
      multiline
      scrollEnabled
      accessibilityLabel={accessibilityLabel}
      wrong={wrong}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.noteBox, (focused || wrong) && styles.noteBoxLit]}
    />
  );
}

const NOTE_LINE = 24;

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  searchRow: { flexDirection: 'row' },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  figures: { fontVariant: ['tabular-nums'] },
  noteBox: {
    minHeight: NOTE_LINE * 4 + tokens.spaceSm * 2,
    maxHeight: NOTE_LINE * 10 + tokens.spaceSm * 2,
    paddingLeft: 14.5,
    paddingRight: 10.5,
    borderWidth: 1.5,
    borderRadius: tokens.radiusInset,
    lineHeight: NOTE_LINE,
    textAlignVertical: 'top',
    ...weight('medium'),
  },
  noteBoxLit: { paddingLeft: tokens.spacePillEnd, paddingRight: tokens.spaceMd, borderWidth: 2 },
  labelled: { gap: 7 },
  label: { lineHeight: 14 * 1.3 },
  hint: { lineHeight: 13.5 * 1.4 },
  said: { lineHeight: 14 * 1.45 },
  lines: { lineHeight: 15 * 1.45 },
  pair: { flexDirection: 'row', gap: tokens.spaceSm },
  select: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: 14.5,
    paddingRight: 12.5,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    borderRadius: 14,
  },
  selectWrong: { borderWidth: 2, borderColor: tokens.colorBroken, paddingLeft: 14 },
  offer: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXxl },
  host: { gap: tokens.spaceHair },
  hostHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  move: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slider: { gap: tokens.spaceXxs },
  track: { height: tokens.sizeHit, justifyContent: 'center' },
  rail: { height: 6, borderRadius: 3, backgroundColor: tokens.colorNeutralFill },
  stops: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -tokens.spaceSm,
  },
  stop: { width: tokens.sizeHit, alignItems: 'center', justifyContent: 'center' },
  knob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.raised.ios,
  },
  ends: { flexDirection: 'row' },
});
