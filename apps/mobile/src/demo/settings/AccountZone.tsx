import { type ZoneRow, zoneLabel } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { Field, focusChecked, TextField } from '../../components/Field.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import {
  matchLine,
  noZoneLine,
  WORDS,
  zoneHelp,
  zoneMatches,
  zoneStays,
  zoneToSave,
} from './AccountModel.ts';
import { discardAsk } from './AccountName.tsx';
import { FocusedScreen, Line, Row, RowList } from './Summary.tsx';

/** Finding a zone by city, country or offset; a tap on a match fills the field and closes the list. */
export function ZoneScreen({
  open,
  held,
  startTyped,
  opener,
  onClose,
  onSaved,
}: {
  open: boolean;
  held: ZoneRow;
  startTyped: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onSaved: (zone: ZoneRow) => void;
}) {
  const [typed, setTyped] = useState(startTyped);
  const [picked, setPicked] = useState<ZoneRow | null>(null);
  const [fills, setFills] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const field = useRef<TextInputInstance>(null);
  const showingPicked = picked != null && typed === zoneLabel(picked);
  const matches = showingPicked ? [] : zoneMatches(typed);
  const noneMatch = typed.trim() !== '' && !showingPicked && matches.length === 0;
  const changed = typed.trim() !== '';

  useReadOut(noneMatch && error == null ? noZoneLine(typed) : null, { afterTyping: typed });

  function save(): void {
    const answer = zoneToSave(typed, showingPicked ? picked : null);
    if ('zone' in answer) {
      onSaved(answer.zone);
      return;
    }
    setError(answer.problem);
    focusChecked(field);
  }

  return (
    <FocusedScreen
      open={open}
      title={WORDS.zoneTitle}
      verb={{ label: WORDS.save, on: changed, onPress: save, testID: 'account.zone.save' }}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID="account.zone.cancel"
      opener={opener}
      ask={discardAsk(
        discarding,
        zoneStays(held),
        { keep: () => setDiscarding(false), discard: onClose },
        'account.zone',
      )}
      testID="account.zone.screen"
    >
      <Line text={WORDS.zoneLead} />
      <Field label={WORDS.zoneLabel} error={error} help={zoneHelp(held)}>
        <TextField
          key={fills}
          ref={field}
          defaultValue={typed}
          wrong={error != null}
          autoFocus={fills === 0}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder={WORDS.zonePlaceholder}
          returnKeyType="done"
          onChangeText={(text) => {
            setTyped(text);
            setPicked(null);
            setError(null);
          }}
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={WORDS.zoneLabel}
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
                line={matchLine(zone, typed)}
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
      {noneMatch && error == null && <Line text={noZoneLine(typed)} />}
    </FocusedScreen>
  );
}
