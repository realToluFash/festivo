import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LayoutKind } from '../layout/useLayout.ts';
import type { Shown } from '../kit/eventsList.ts';
import { tokens } from '../theme/tokens.ts';
import { CardBackdrop } from './EventCard.tsx';
import { eventColour } from './EventMesh.tsx';
import { type MarkKind, ReplyMark } from './ReplyMark.tsx';
import {
  type CardSize,
  CardSays,
  GlassTag,
  OnCard,
  StepButton,
  type StepProps,
  SummaryCard,
} from './Summary.tsx';
import type { TextHandle } from './Text.tsx';

const CARD_SIZE: Record<LayoutKind, CardSize> = {
  phone: 'page',
  tabletPortrait: 'wide',
  tabletLandscape: 'compact',
};
const LIST_HEIGHT: Record<LayoutKind, number> = {
  phone: 180,
  tabletPortrait: 170,
  tabletLandscape: 140,
};

/** Guests' card as the demo draws it (sc-31780): the count line in the event's colours, the line under it, and on an empty list Add guest. */
export function GuestsCard({
  kind,
  event,
  says,
  line,
  step,
  heading = false,
}: {
  kind: LayoutKind;
  event: Shown | null;
  says: string;
  /** The empty list's "No guests yet" heads the area. */
  heading?: boolean;
  line: string | null;
  step: StepProps | null;
}) {
  return (
    <SummaryCard
      size={CARD_SIZE[kind]}
      height={LIST_HEIGHT[kind]}
      backdrop={event == null ? undefined : <CardBackdrop event={event} />}
      testID="guests.card"
    >
      <CardSays text={says} heading={heading} />
      {line != null && <OnCard text={line} />}
      {step != null && (
        <View style={styles.foot}>
          <StepButton {...step} />
        </View>
      )}
    </SummaryCard>
  );
}

/** A guest's details lead with their reply on glass, their name and one line, as the demo's guest page does. */
export function GuestCover({
  kind,
  event,
  mark,
  word,
  name,
  line,
  nameRef,
}: {
  kind: LayoutKind;
  event: Shown | null;
  mark: MarkKind;
  word: string;
  name: string;
  line: string | null;
  nameRef: Ref<TextHandle>;
}) {
  return (
    <SummaryCard
      size={CARD_SIZE[kind]}
      height={kind === 'tabletLandscape' ? 160 : 190}
      backdrop={event == null ? undefined : <CardBackdrop event={event} />}
      testID="guest.card"
    >
      <View style={styles.tags}>
        <GlassTag
          word={word}
          shape={
            <ReplyMark kind={mark} side={16} cover={event == null ? null : eventColour(event)} />
          }
        />
      </View>
      <CardSays text={name} heading ref={nameRef} />
      {line != null && <OnCard text={line} />}
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  foot: { marginTop: 'auto', paddingTop: tokens.spaceXs },
});
