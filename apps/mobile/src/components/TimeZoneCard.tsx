import { ApiError, type TimeZoneOption } from '@soirely/api-client';
import { exactZone, formerName, matchingZones, zoneLabel } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { focusBackMs } from '../kit/focusBack.ts';
import { listRoom, shortWhileTyping } from '../kit/keyboard.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { useHeaderWithoutBack } from './AppFrame.tsx';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Field, focusChecked, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { useReadOut } from './ReadOut.tsx';
import {
  SETTLED_MS,
  type StepClosed,
  type StepHidden,
  useAboveKeyboard,
  useFocusBackToOpener,
  useFocusOnAnswer,
  useRoomAboveKeyboard,
  useScrolledToTop,
  useStepClose,
  useStepOpen,
} from './Screen.tsx';
import { Text } from './Text.tsx';

/** How many rows the list shows at once; the search narrows the rest. */
const SHOWN = 30;

/** The list scrolls inside this height, so the field and Save stay on screen (Account-*, Tweak `tz`). */
const LIST_HEIGHT = 264;

/** The list's padding and border, which the one-row floor counts along with the row. */
const LIST_PADDING = tokens.spaceXxs;
const LIST_BORDER = 1;
const LIST_FRAME = 2 * (LIST_PADDING + LIST_BORDER);

/** Your account > Account, the time zone the times sent to this person are written in (sc-868). */
export function TimeZoneCard({
  timezone,
  kind,
  onSaved,
}: {
  timezone: string | null;
  kind: LayoutKind;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [zones, setZones] = useState<TimeZoneOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedFocused, setSavedFocused] = useState(false);
  const [closed, setClosed] = useState<StepClosed | undefined>(undefined);
  const opener = useFocusBackToOpener(editing ? undefined : closed);
  const {
    opener: changeOpener,
    closing,
    closer,
    hidden,
    close,
  } = useStepClose(opener, 'change', 'opener', (back) => {
    setClosed(back);
    setEditing(false);
  });
  // Saving closes with the line in the opener's place, so TalkBack's focus is on the line before Save goes (sc-18587).
  const {
    opener: savedLine,
    holder: savedHolder,
    closing: savedClosing,
    // Keys a swap leaves up put the line out of sight, and a scroll to it that carries Save away moves TalkBack to the card's description first (sc-18587).
    closer: saveCloser,
    close: closeSaved,
  } = useStepClose(opener, 'saved', 'holder', (back) => {
    setSavedFocused(back == null);
    setEditing(false);
  });
  const savedGiven = savedFocused || savedClosing;
  // Change, or the saved line's holder, going as the step comes leaves input focus on nothing, which Android puts on the header's back row (sc-22392).
  const { opening, open, fieldFocused } = useStepOpen(
    () => {
      setClosed(undefined);
      setEditing(true);
    },
    () => {
      setSaved(null);
      setSavedFocused(false);
    },
  );
  const frame = cardFrame(kind);

  useEffect(() => {
    let live = true;

    api
      .timezones()
      .then((list) => {
        if (live) setZones(list);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  const current = zones.find((zone) => zone.id === timezone);
  const label = timezone == null ? null : current == null ? timezone : zoneLabel(current);
  // The scrolls of a save's close move TalkBack's focus off Save to the nearest view in sight, and the zone name, the intro or the title there is said before the line (sc-18587).
  const offWhileSaving = savedClosing ? 'no-hide-descendants' : 'auto';

  return (
    <View style={frame}>
      <Text
        size={tokens.typeTitleSection.size}
        weight="bold"
        accessibilityRole="header"
        accessibilityElementsHidden={savedClosing}
        importantForAccessibility={offWhileSaving}
        accessible={!savedClosing}
      >
        {t('timeZone.title')}
      </Text>
      <Text
        size={tokens.typeBodyPhone.size}
        style={styles.secondary}
        accessibilityElementsHidden={savedClosing}
        importantForAccessibility={offWhileSaving}
        accessible={!savedClosing}
      >
        {t('timeZone.intro')}
      </Text>

      {(!editing || opening || closing || savedClosing) && (
        <View
          style={styles.group}
          accessibilityElementsHidden={savedClosing}
          importantForAccessibility={offWhileSaving}
        >
          <Text size={tokens.typeRowTitle.size} weight="semibold" accessible={!savedClosing}>
            {label ?? t('timeZone.unset')}
          </Text>
          {timezone != null && (
            <Text size={tokens.typeSmall.size} style={styles.secondary} accessible={!savedClosing}>
              {timezone.replace(/_/g, ' ')}
            </Text>
          )}
        </View>
      )}
      {saved != null && (!editing || opening || savedClosing) && (
        <View>
          {savedHolder}
          <Notice
            tone="done"
            mark={tokens.marks.done.glyph}
            body={t('timeZone.saved', { zone: saved })}
            answer={savedGiven ? undefined : saved}
            takesFocus={!savedGiven}
            readMs={focusBackMs(Platform.OS, SETTLED_MS, 'step')}
            wordsRef={savedGiven ? savedLine : undefined}
          />
        </View>
      )}
      {(!editing || opening || closing) && (
        <SecondaryButton
          ref={changeOpener}
          label={t('timeZone.change')}
          onPress={open}
          testID="timeZone.change"
        />
      )}
      {editing && (
        <Choosing
          phone={kind === 'phone'}
          zones={zones}
          now={label}
          closing={closing || savedClosing}
          onSaved={async (zone) => {
            await onSaved();
            setSaved(zoneLabel(zone));
            closeSaved();
          }}
          onCancel={close}
          onFocused={fieldFocused}
          closer={closer}
          saveCloser={saveCloser}
          hidden={hidden}
        />
      )}
    </View>
  );
}

/** A search over every zone; only a listed zone is ever sent. */
function Choosing({
  phone,
  zones,
  now,
  closing,
  onSaved,
  onCancel,
  onFocused,
  closer,
  saveCloser,
  hidden,
}: {
  phone: boolean;
  zones: readonly TimeZoneOption[];
  now: string | null;
  closing: boolean;
  onSaved: (zone: TimeZoneOption) => Promise<void>;
  onCancel: () => void;
  onFocused: () => void;
  closer: RefObject<ViewInstance | null>;
  saveCloser: RefObject<ViewInstance | null>;
  /** Hides all but Cancel while Cancel closes the step. */
  hidden: StepHidden;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<TimeZoneOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<TextInputInstance>(null);
  // A zone picked from the list takes the list's place, so focus goes to the field now holding it.
  useFocusOnAnswer(picked ?? undefined, input);
  const aboveKeyboard = useAboveKeyboard(closing);
  const room = useRoomAboveKeyboard();
  // With no on-screen keyboard (a hardware one), nothing lifts, so the card is brought up on opening.
  const top = useScrolledToTop();
  const [groupHeight, setGroupHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [rowHeight, setRowHeight] = useState<number>(tokens.sizeHit);
  const { height } = useWindowDimensions();
  const short = shortWhileTyping({ os: Platform.OS, phone, height, keysUp: room != null });
  useHeaderWithoutBack(short);

  const showingPicked = picked != null && typed === zoneLabel(picked);
  const matches = showingPicked ? [] : matchingZones(zones, typed).slice(0, SHOWN);
  // "India · was Calcutta" only for the row a former name found (sc-986).
  const rowDetail = (zone: TimeZoneOption): string => {
    const was = formerName(zone, typed);

    if (was == null) return zone.country;

    return zone.country === ''
      ? t('timeZone.was', { name: was })
      : t('timeZone.countryWas', { country: zone.country, name: was });
  };
  const help = t('timeZone.help', { now: now ?? t('timeZone.nowUnset') });
  const noneMatch = typed.trim() !== '' && !showingPicked && matches.length === 0;
  const nothing = t('timeZone.noneMatch', { typed: typed.trim() });
  // Said as each key lands, it would talk over the typing (sc-10955); said only as it appears, it goes unheard by somebody still typing (sc-11930).
  useReadOut(noneMatch && error == null ? nothing : null, { afterTyping: typed });
  const listMost =
    room == null
      ? LIST_HEIGHT
      : listRoom({
          room,
          rest: groupHeight - (matches.length > 0 ? listHeight : 0),
          oneRow: rowHeight + LIST_FRAME,
          most: LIST_HEIGHT,
        });

  async function save(): Promise<void> {
    if (saving) return;

    const zone = showingPicked ? picked : exactZone(zones, typed);
    if (zone == null) {
      setError(
        typed.trim() === '' || matches.length > 0
          ? t('timeZone.choose')
          : t('timeZone.chooseNoMatch', { typed: typed.trim() }),
      );
      focusChecked(input);
      return;
    }

    setSaving(true);

    try {
      await api.setTimezone(zone.id);
      await onSaved(zone);
    } catch (refusal) {
      setSaving(false);
      setError(
        refusal instanceof ApiError && refusal.status === 422
          ? t('timeZone.refused')
          : t('timeZone.failed'),
      );
    }
  }

  return (
    <>
      <View {...aboveKeyboard} {...hidden}>
        <View
          ref={top}
          onLayout={(event) => setGroupHeight(event.nativeEvent.layout.height)}
          style={styles.choosing}
        >
          <Field label={t('timeZone.find')} error={error} help={short ? undefined : help}>
            <TextField
              ref={input}
              wrong={error != null}
              submitting={saving}
              autoFocus
              onFocus={onFocused}
              autoCapitalize="none"
              placeholder={t('timeZone.placeholder')}
              value={typed}
              onChangeText={(text) => {
                setTyped(text);
                setPicked(null);
                setError(null);
              }}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              submitBehavior="submit"
              accessibilityLabel={t('timeZone.find')}
              accessibilityHint={short ? help : undefined}
              testID="timeZone.search"
            />
          </Field>

          {matches.length > 0 && (
            <ScrollView
              style={[styles.list, { maxHeight: listMost }]}
              onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {matches.map((zone, index) => (
                <Pressable
                  key={zone.id}
                  onLayout={
                    index === 0
                      ? (event) => setRowHeight(event.nativeEvent.layout.height)
                      : undefined
                  }
                  style={styles.option}
                  accessibilityRole="button"
                  onPress={() => {
                    setPicked(zone);
                    setTyped(zoneLabel(zone));
                    setError(null);
                  }}
                  testID={`timeZone.option.${zone.id}`}
                >
                  <Text size={tokens.typeBodyPhone.size}>{zoneLabel(zone)}</Text>
                  <Text size={tokens.typeSmall.size} style={styles.secondary}>
                    {rowDetail(zone)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {noneMatch && error == null && (
            <Text
              size={tokens.typeBodyPhone.size}
              style={styles.secondary}
              accessibilityRole="alert"
            >
              {nothing}
            </Text>
          )}

          <PrimaryButton
            label={saving ? t('timeZone.saving') : t('timeZone.save')}
            onPress={() => void save()}
            busy={saving}
            ref={saveCloser}
            testID="timeZone.save"
          />
        </View>
      </View>
      <QuietButton
        label={t('timeZone.cancel')}
        ref={closer}
        onPress={onCancel}
        off={saving}
        testID="timeZone.cancel"
      />
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.spaceXxs },
  choosing: { gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  list: {
    borderWidth: LIST_BORDER,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusField,
    padding: LIST_PADDING,
  },
  option: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    gap: tokens.spaceXxs,
    paddingVertical: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusSmall,
  },
});
