import { NOTHING_SEEN, type VenueDraft, addressLookup } from '@soirely/domain';
import { type RefObject, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type EventErrors } from '../kit/eventForm.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { Field, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut, readOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

/** The form's venue (sc-3589), as the web's VenueSection: a name, an address picked from suggestions or typed, and the arrival note (sc-24385). */
export function VenueFields({
  venue,
  errors,
  busy,
  timeZone,
  nameInput,
  addressInput,
  noteInput,
  onVenue,
  onUseZone,
}: {
  venue: VenueDraft;
  errors: EventErrors;
  busy: boolean;
  timeZone: string;
  nameInput: RefObject<TextInputInstance | null>;
  addressInput: RefObject<TextInputInstance | null>;
  noteInput: RefObject<TextInputInstance | null>;
  onVenue: (change: Partial<VenueDraft>) => void;
  /** Left out where the zone can't change, and then nothing is offered. */
  onUseZone?: (zone: string) => void;
}) {
  const { t } = useTranslation();
  const [seen, setSeen] = useState(NOTHING_SEEN);
  const lookup = useMemo(
    () =>
      addressLookup({
        suggest: (query) => api.addressSuggestions(query),
        resolve: (id) => api.address(id),
        onVenue,
        onSeen: setSeen,
      }),
    // The form's setter is stable for the form's life, and a new lookup would drop the answer in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => () => lookup.stop(), [lookup]);

  const { suggestions, down } = seen;
  const offer =
    seen.offered != null && seen.offered.zone !== timeZone && onUseZone != null
      ? seen.offered
      : null;
  const found =
    suggestions.length === 0
      ? null
      : t('eventForm.venueSuggestionsBelow', { count: suggestions.length });

  return (
    <>
      <Field
        label={t('eventForm.venueName')}
        pill={t('eventForm.optional')}
        error={errors.venueName}
      >
        <TextField
          ref={nameInput}
          value={venue.name}
          onChangeText={(name) => onVenue({ name })}
          wrong={errors.venueName != null}
          submitting={busy}
          returnKeyType="next"
          onSubmitEditing={() => addressInput.current?.focus()}
          accessibilityLabel={t('eventForm.venueName')}
          testID="eventForm.venueName"
        />
      </Field>

      <Field
        label={t('eventForm.venueAddress')}
        pill={t('eventForm.optional')}
        error={errors.venueAddress}
        help={t('eventForm.venueAddressHint')}
      >
        <TextField
          ref={addressInput}
          value={venue.address}
          onChangeText={(address) => lookup.type(address)}
          wrong={errors.venueAddress != null}
          submitting={busy}
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={t('eventForm.venueAddress')}
          testID="eventForm.venueAddress"
        />
      </Field>

      {found != null && (
        <ReadOut words={found}>
          <View style={styles.suggestions} testID="eventForm.venueSuggestions">
            {suggestions.map((suggestion, index) => (
              <Pressable
                key={suggestion.id}
                style={[styles.suggestion, index > 0 && styles.divided]}
                onPress={() => void lookup.pick(suggestion, timeZone)}
                disabled={busy}
                accessibilityRole="button"
                testID={`eventForm.venueSuggestion.${index}`}
              >
                <Text size={tokens.typeBodyPhone.size}>{suggestion.text}</Text>
                {suggestion.secondaryText != null && (
                  <Text size={tokens.typeSmall.size} muted>
                    {suggestion.secondaryText}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </ReadOut>
      )}

      {down && (
        <Notice
          tone="attention"
          mark={tokens.marks.info.glyph}
          body={t('eventForm.venueLookupDown')}
          announce
        />
      )}

      <Field
        label={t('eventForm.arrivalNote')}
        pill={t('eventForm.optional')}
        error={errors.arrivalNote}
        help={t('eventForm.arrivalNoteHint')}
      >
        <TextField
          ref={noteInput}
          value={venue.note}
          onChangeText={(note) => onVenue({ note })}
          wrong={errors.arrivalNote != null}
          submitting={busy}
          multiline
          scrollEnabled
          style={styles.note}
          accessibilityLabel={t('eventForm.arrivalNote')}
          accessibilityHint={t('eventForm.arrivalNoteHint')}
          testID="eventForm.arrivalNote"
        />
      </Field>

      {offer != null && (
        <View style={styles.offer} testID="eventForm.venueZoneOffer">
          <Notice
            tone="attention"
            mark={tokens.marks.info.glyph}
            title={t('eventForm.venueZoneOffer', { zone: offer.zone })}
            announce
          />
          <View style={styles.actions}>
            <PrimaryButton
              label={t('eventForm.venueZoneUse', { zone: offer.zone })}
              onPress={() => {
                onUseZone?.(offer.zone);
                lookup.answered();
                readOut(t('eventForm.venueZoneSet', { zone: offer.zone }));
              }}
              off={busy}
              testID="eventForm.venueZoneUse"
            />
            <SecondaryButton
              label={t('eventForm.venueZoneKeep', { zone: offer.keep })}
              onPress={() => lookup.answered()}
              off={busy}
              testID="eventForm.venueZoneKeep"
            />
          </View>
        </View>
      )}
    </>
  );
}

const NOTE_LINE = 24;

const styles = StyleSheet.create({
  suggestions: {
    borderRadius: tokens.radiusRow,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  suggestion: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
  },
  divided: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  note: {
    minHeight: NOTE_LINE * 4 + tokens.spaceSm * 2,
    maxHeight: NOTE_LINE * 10 + tokens.spaceSm * 2,
    lineHeight: NOTE_LINE,
    textAlignVertical: 'top',
  },
  offer: { gap: tokens.spaceSm },
  actions: { gap: tokens.spaceSm },
});
