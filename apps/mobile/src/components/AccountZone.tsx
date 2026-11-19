import { exactZone, formerName, matchingZones, type ZoneRow, zoneLabel } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { discardAsk, type Saving } from './AccountName.tsx';
import { Field, focusChecked, focusRefused, keysStayDown, TextField } from './Field.tsx';
import { useReadOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { FocusedScreen, Line, Row, RowList } from './Summary.tsx';

export const ZONES_SHOWN = 8;

/** Finding a zone by city, country or offset; a tap on a match fills the field and closes the list. */
export function ZoneScreen<Zone extends ZoneRow>({
  open,
  zones,
  now,
  startTyped = '',
  opener,
  onClose,
  onSave,
}: {
  open: boolean;
  zones: readonly Zone[];
  /** The zone saved now, as its label; null while none is set. */
  now: string | null;
  startTyped?: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onSave: Saving<Zone>;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState(startTyped);
  const [picked, setPicked] = useState<Zone | null>(null);
  const [fills, setFills] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const field = useRef<TextInputInstance>(null);
  const showingPicked = picked != null && typed === zoneLabel(picked);
  const wanted = typed.trim();
  const matches =
    showingPicked || wanted === '' ? [] : matchingZones(zones, typed).slice(0, ZONES_SHOWN);
  const noneMatch = wanted !== '' && !showingPicked && matches.length === 0;
  const changed = wanted !== '';
  const nothing = t('timeZone.noneMatch', { typed: wanted });

  useReadOut(noneMatch && error == null ? nothing : null, { afterTyping: typed });

  function matchLine(zone: Zone): string {
    const was = formerName(zone, typed);
    if (was == null) return zone.country;

    return zone.country === ''
      ? t('timeZone.was', { name: was })
      : t('timeZone.countryWas', { country: zone.country, name: was });
  }

  async function save(): Promise<void> {
    if (saving) return;
    const zone = (showingPicked ? picked : null) ?? exactZone(zones, typed);
    if (zone == null) {
      setError(
        wanted === '' || matches.length > 0
          ? t('timeZone.choose')
          : t('timeZone.chooseNoMatch', { typed: wanted }),
      );
      focusChecked(field);
      return;
    }
    keysStayDown();
    setSaving(true);
    const refused = await onSave(zone);
    setSaving(false);
    if (refused == null) return;
    setError(refused);
    focusRefused(field);
  }

  return (
    <FocusedScreen
      open={open}
      title={t('timeZone.title')}
      verb={{
        label: t('account.save'),
        on: changed,
        busy: saving,
        onPress: () => void save(),
        testID: 'account.zone.save',
      }}
      waits={saving}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID="account.zone.cancel"
      opener={opener}
      ask={discardAsk(
        discarding,
        now == null ? t('account.zoneStaysUnset') : t('account.zoneStays', { zone: now }),
        { keep: () => setDiscarding(false), discard: onClose },
        'account.zone',
        t,
      )}
      testID="account.zone.screen"
    >
      <Line text={t('timeZone.intro')} />
      <Field
        label={t('timeZone.find')}
        error={error}
        help={t('timeZone.help', { now: now ?? t('timeZone.nowUnset') })}
      >
        <TextField
          key={fills}
          ref={field}
          defaultValue={typed}
          wrong={error != null}
          submitting={saving}
          autoFocus={fills === 0}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder={t('timeZone.placeholder')}
          returnKeyType="done"
          onChangeText={(text) => {
            setTyped(text);
            setPicked(null);
            setError(null);
          }}
          onSubmitEditing={() => void save()}
          submitBehavior="submit"
          accessibilityLabel={t('timeZone.find')}
          testID="account.zone.field"
        />
      </Field>
      {matches.length > 0 && (
        <RowList
          items={matches.map((zone) => ({
            key: zone.id,
            row: (
              <Row
                title={zoneLabel(zone)}
                line={matchLine(zone)}
                onPress={() => {
                  setPicked(zone);
                  setTyped(zoneLabel(zone));
                  setFills((count) => count + 1);
                  setError(null);
                }}
                testID={`account.zone.${zone.id}`}
              />
            ),
          }))}
        />
      )}
      {noneMatch && error == null && <Line text={nothing} />}
    </FocusedScreen>
  );
}
