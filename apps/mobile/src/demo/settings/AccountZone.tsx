import { exactZone, formerName, matchingZones, type ZoneRow, zoneLabel } from '@soirely/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field, TextField } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { RowPill, StepPill, WhiteRows } from './AccountParts.tsx';
import { ZONES } from './AccountSample.ts';
import { Card, CardHead, Pair, TYPE } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

const FIND_LABEL = 'Find your time zone';
const SHOWN = 8;

export function TimeZoneCard({
  layout,
  zone,
  onSaved,
  startTyped,
}: {
  layout: SettingsLayout;
  zone: ZoneRow;
  onSaved: (zone: ZoneRow) => void;
  /** Opens the card choosing, with this already typed. */
  startTyped: string | null;
}) {
  const [choosing, setChoosing] = useState(startTyped != null);
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <Card>
      <CardHead
        title="Time zone"
        line="Times in the emails and texts Soirely sends you are written in this zone."
      />
      {choosing ? (
        <Choosing
          layout={layout}
          now={zoneLabel(zone)}
          startTyped={startTyped ?? ''}
          onSave={(picked) => {
            onSaved(picked);
            setSaved(zoneLabel(picked));
            setChoosing(false);
          }}
          onCancel={() => setChoosing(false)}
        />
      ) : (
        <>
          {saved != null && (
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={`Time zone changed to ${saved}. Times in your emails now use it.`}
              announce
            />
          )}
          <View style={styles.line}>
            <View style={styles.value}>
              <Text size={17} weight="medium" style={styles.figures}>
                {zoneLabel(zone)}
              </Text>
              <Text size={TYPE.small} weight="medium" style={styles.secondary}>
                {zone.id.replace(/_/g, ' ')}
              </Text>
            </View>
            <RowPill
              label="Change"
              onPress={() => {
                setSaved(null);
                setChoosing(true);
              }}
              accessibilityLabel="Change your time zone"
            />
          </View>
        </>
      )}
    </Card>
  );
}

function Choosing({
  layout,
  now,
  startTyped,
  onSave,
  onCancel,
}: {
  layout: SettingsLayout;
  now: string;
  startTyped: string;
  onSave: (zone: ZoneRow) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState(startTyped);
  const [picked, setPicked] = useState<ZoneRow | null>(null);
  const [field, setField] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const showingPicked = picked != null && typed === zoneLabel(picked);
  const wanted = typed.trim();
  const matches = showingPicked || wanted === '' ? [] : matchingZones(ZONES, typed).slice(0, SHOWN);
  const noneMatch = wanted !== '' && !showingPicked && matches.length === 0;

  function save(): void {
    const zone = showingPicked ? picked : exactZone(ZONES, typed);

    if (zone == null) {
      setError(
        wanted === '' || matches.length > 0
          ? 'Choose a time zone from the list.'
          : `Choose a time zone from the list. Nothing matches “${wanted}”.`,
      );
      return;
    }
    onSave(zone);
  }

  return (
    <>
      <Field
        label={FIND_LABEL}
        error={error}
        help={`Type a city, a country or an offset, then pick from the list. Now: ${now}.`}
      >
        <TextField
          key={field}
          defaultValue={typed}
          wrong={error != null}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Lagos, Ghana or UTC+01"
          returnKeyType="done"
          onChangeText={(text) => {
            setTyped(text);
            setPicked(null);
            setError(null);
          }}
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={FIND_LABEL}
          testID="demo.account.zone"
        />
      </Field>
      {matches.length > 0 && (
        <WhiteRows>
          {matches.map((zone) => {
            const was = formerName(zone, typed);

            return (
              <Pressable
                key={zone.id}
                onPress={() => {
                  setPicked(zone);
                  setTyped(zoneLabel(zone));
                  setField((value) => value + 1);
                  setError(null);
                }}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                accessibilityRole="button"
                testID={`demo.account.zone.${zone.id}`}
              >
                <Text size={15.5} weight="semibold" style={styles.figures}>
                  {zoneLabel(zone)}
                </Text>
                <Text size={TYPE.small} weight="medium" style={styles.secondary}>
                  {was == null ? zone.country : `${zone.country} · was ${was}`}
                </Text>
              </Pressable>
            );
          })}
        </WhiteRows>
      )}
      {noneMatch && error == null && (
        <Text size={TYPE.body} weight="medium" style={styles.secondary} accessibilityRole="alert">
          {`No time zone matches “${wanted}”. Try a city, a country or an offset like UTC+01.`}
        </Text>
      )}
      <Pair
        layout={layout}
        dismiss={<StepPill layout={layout} label="Cancel" kind="secondary" onPress={onCancel} />}
        confirm={<StepPill layout={layout} label="Save time zone" onPress={save} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  value: { flex: 1, minWidth: 0, gap: 2 },
  figures: { fontVariant: ['tabular-nums'] },
  secondary: { color: tokens.colorInkSecondary },
  option: {
    minHeight: 56,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: tokens.spaceXl,
    paddingVertical: tokens.spaceMd,
  },
  pressed: { opacity: 0.8 },
});
