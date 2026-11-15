import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LayoutKind } from '../layout/useLayout.ts';
import type { CardTag, Shown } from '../kit/eventsList.ts';
import { tokens } from '../theme/tokens.ts';
import { CardBackdrop, PhaseShape } from './EventCard.tsx';
import { eventColour } from './EventMesh.tsx';
import { type MarkKind, ReplyMark } from './ReplyMark.tsx';
import {
  type CardSize,
  CardSays,
  GlassStep,
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

/** Guests' card as the demo draws it (sc-31780): a Draft, Paused or Finished event's chip, the count line in the event's colours, the line under it, and its one step. */
export function GuestsCard({
  kind,
  event,
  tags = [],
  says,
  line,
  step,
  also = null,
  heading = false,
}: {
  kind: LayoutKind;
  event: Shown | null;
  tags?: readonly CardTag[];
  says: string;
  /** The empty list's "No guests yet" heads the area. */
  heading?: boolean;
  line: string | null;
  step: StepProps | null;
  /** The quieter second step beside the first: Make live on an empty Draft (sc-46879). */
  also?: StepProps | null;
}) {
  return (
    <SummaryCard
      size={CARD_SIZE[kind]}
      height={LIST_HEIGHT[kind]}
      backdrop={event == null ? undefined : <CardBackdrop event={event} />}
      testID="guests.card"
    >
      {tags.length > 0 && (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <GlassTag
              key={tag.word}
              word={tag.word}
              shape={tag.mark == null ? undefined : <PhaseShape mark={tag.mark} />}
            />
          ))}
        </View>
      )}
      <CardSays text={says} heading={heading} />
      {line != null && <OnCard text={line} />}
      {(step != null || also != null) && (
        <View style={styles.foot}>
          {step != null && <StepButton {...step} />}
          {also != null && <GlassStep {...also} />}
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
  step = null,
  nameRef,
}: {
  kind: LayoutKind;
  event: Shown | null;
  mark: MarkKind;
  word: string;
  name: string;
  line: string | null;
  /** Its one step: Let them change their reply, once replies close (sc-3780). */
  step?: StepProps | null;
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
      {step != null && (
        <View style={styles.foot}>
          <StepButton {...step} />
        </View>
      )}
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
    marginTop: 'auto',
    paddingTop: tokens.spaceXs,
  },
});
