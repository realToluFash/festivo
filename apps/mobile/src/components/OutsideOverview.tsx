import { isServiceLevel, type OrganisationEvent, type OutsideEvent } from '@soirely/api-client';
import { placeWords, venueCity } from '@soirely/domain';
import { type Ref, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { cardWhen, levelLine } from '../kit/outsideEvent.ts';
import { meshFor } from '../kit/today.ts';
import { signOutHere } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { AREA_GLYPH } from './areaGlyph.ts';
import { CARD_PIECES, Confetti } from './Cover.tsx';
import { EventMesh } from './EventMesh.tsx';
import { CardSays, OnCard, Row, RowList, SummaryCard, TextAction } from './Summary.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { useFloorRowItem } from './FloorWayIn.tsx';
import { useStationRowItem } from './StationWayIn.tsx';
import { useYourNightItem } from './YourNight.tsx';

/** Overview at Can view and Can check guests in held from outside an organisation, as the `no-org` demo draws it: the event's card with the level line, Guests and People, and on a phone or an upright tablet who is signed in (sc-71). A service level opens no Guests or People, and with nothing of tonight its Overview is the card alone (sc-96279). */
export function OutsideOverview({
  event,
  held,
  you,
  nameRef,
  onGuests,
  onPeople,
  onCheckIn,
}: {
  event: OrganisationEvent;
  held: Pick<OutsideEvent, 'role' | 'jobLabel'>;
  /** On its side, the sidebar's person button holds Signed in as and Sign out instead. */
  you: { name: string } | null;
  nameRef?: Ref<TextHandle> | undefined;
  onGuests: () => void;
  onPeople: () => void;
  /** At Can check guests in, on a phone and an upright tablet: Check guests in on the card, under the level line (sc-1454). */
  onCheckIn: (() => void) | null;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const reads = !isServiceLevel(held.role);
  const onEvent = usePeopleCount(reads ? event.id : null);
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const placeLine = placeWords(place, venueCity(event.venue), (key, values) =>
    t(key, values ?? {}),
  );
  const night = useYourNightItem(event.id);
  const station = useStationRowItem(event);
  const floor = useFloorRowItem(event);
  const rows = [
    ...(night == null ? [] : [night]),
    ...(station == null ? [] : [station]),
    ...(floor == null ? [] : [floor]),
    ...(reads
      ? [
          {
            key: 'guests',
            inset: 40,
            row: (
              <Row
                title={t('eventNav.guests')}
                line={t('outsideEvent.guestsLine')}
                lead={<LineIcon name={AREA_GLYPH.guests} />}
                opens
                onPress={onGuests}
                testID="outside.guests"
              />
            ),
          },
          {
            key: 'people',
            inset: 40,
            row: (
              <Row
                title={t('eventNav.people')}
                line={onEvent == null ? undefined : t('outsideEvent.onEvent', { count: onEvent })}
                lead={<LineIcon name={AREA_GLYPH.people} />}
                opens
                onPress={onPeople}
                testID="outside.people"
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <View style={styles.stack} testID="outside.overview">
      <SummaryCard
        height={200}
        gap={8}
        backdrop={
          <>
            <EventMesh event={{ mesh: meshFor(event.id), photo: null }} shade="side" />
            <Confetti pieces={CARD_PIECES} />
          </>
        }
        step={
          onCheckIn == null
            ? null
            : { label: t('checkIn.checkGuestsIn'), onPress: onCheckIn, testID: 'outside.checkIn' }
        }
        testID="outside.card"
      >
        <OnCard text={cardWhen(t, event, locale)} />
        <CardSays ref={nameRef} text={event.name} heading />
        <OnCard text={placeLine} />
        <OnCard text={levelLine(t, held, event, locale)} strong />
      </SummaryCard>
      {rows.length > 0 && <RowList items={rows} />}
      {you != null && (
        <View style={styles.you}>
          <Text size={15} weight="semibold">
            {t('settings.signedInAs', { email: you.name })}
          </Text>
          <TextAction
            label={t('settings.signOut')}
            plain
            glyph="signOut"
            onPress={signOutHere}
            testID="outside.signOut"
          />
        </View>
      )}
    </View>
  );
}

function usePeopleCount(eventId: string | null): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (eventId == null) return;
    let live = true;

    api.eventPeople(eventId).then(
      ({ people }) => live && setCount(people.length),
      () => undefined,
    );

    return () => {
      live = false;
    };
  }, [eventId]);

  return count;
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceXl },
  you: { gap: tokens.spaceHair },
});
