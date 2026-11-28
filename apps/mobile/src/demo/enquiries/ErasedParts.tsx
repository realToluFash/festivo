import { StyleSheet, View } from 'react-native';

import { SheetLayer } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { Pair, Pill } from '../../components/SettingsParts.tsx';
import { TextAction, TurningMark } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { openEvent } from '../events/openEvent.ts';
import { CREATED_ID } from '../events/NewEvent.tsx';
import {
  type Consultation,
  CW,
  dayWords,
  earliestFirst,
  leaderOf,
  timesWords,
} from './ConsultationsModel.ts';
import { type Asking, ERASE_WORDS as E, WON_EVENT } from './EraseModel.ts';
import { PagePart } from './EnquiryParts.tsx';

/** A dashed ring and the word, white on the control border, as the Cancelled chip is: never colour alone. */
export function ErasedChip({ testID }: { testID?: string }) {
  return (
    <View style={styles.chip} testID={testID}>
      <View style={styles.ring} />
      <Text size={13} weight="semibold" accessible={false}>
        {E.erased}
      </Text>
    </View>
  );
}

export function WarningLine({ words, testID }: { words: string; testID?: string }) {
  return (
    <View style={styles.warnLine} testID={testID}>
      <Glyph name="clock" size={15} ink={tokens.colorAttentionText} weight={2.4} />
      <Text size={14} weight="semibold" accessible={false} style={styles.warnInk}>
        {words}
      </Text>
    </View>
  );
}

/** At the top of the page, on the attention tint: a note, not a status, so Open stays the status. */
export function WarningNote({ words }: { words: string }) {
  return (
    <View style={styles.warnNote} accessible accessibilityLabel={words} testID="enquiry.warning">
      <Glyph name="clock" size={18} ink={tokens.colorAttentionText} weight={2.4} />
      <Text size={15} weight="semibold" accessible={false} style={[styles.warnInk, styles.grow]}>
        {words}
      </Text>
    </View>
  );
}

export function ErasedStatus({ date }: { date: string }) {
  return (
    <View style={styles.erasedCard} testID="enquiry.erased">
      <View style={styles.head}>
        <ErasedChip />
      </View>
      <Text size={15} weight="medium" style={styles.lines}>
        {E.erasedLine(date)}
      </Text>
    </View>
  );
}

export function ErasedConsultations({
  wide,
  list,
  locale,
}: {
  wide: boolean;
  list: readonly Consultation[];
  locale: string;
}) {
  if (list.length === 0) return null;

  return (
    <PagePart wide={wide} title={E.consultations} testID="enquiry.erased.consultations">
      {earliestFirst(list).map((one) => {
        const leader = leaderOf(one);
        const words = [
          dayWords(one, locale),
          timesWords(one, locale),
          CW.how[one.how],
          leader == null ? null : E.ledBy(leader.name),
        ].filter((part) => part != null);

        return (
          <View
            key={one.id}
            style={styles.consultation}
            accessible
            accessibilityLabel={words.join(', ')}
            testID={`enquiry.erased.consultation.${one.id}`}
          >
            <Text size={16} weight="semibold" accessible={false}>
              {words[0]}
            </Text>
            <Text size={14} weight="medium" accessible={false} style={styles.secondary}>
              {words.slice(1).join(' · ')}
            </Text>
          </View>
        );
      })}
    </PagePart>
  );
}

export function DeleteFoot({ erased, onPress }: { erased: boolean; onPress: () => void }) {
  return (
    <View style={styles.start}>
      <TextAction
        label={E.deleteOpen}
        removes
        consequence={erased ? E.deleteLineErased : E.deleteLine}
        onPress={onPress}
        testID="enquiry.delete"
      />
    </View>
  );
}

/** Where Delete would be, for an Owner or Admin: why not, and the event to delete first. */
export function WonNote() {
  return (
    <View style={styles.wonNote} testID="enquiry.won.note">
      <View style={styles.wonHead}>
        <Glyph name="info" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
        <Text size={15} weight="medium" style={[styles.grow, styles.lines]}>
          {E.deleteEventFirst}
        </Text>
      </View>
      <View style={styles.start}>
        <TextAction
          label={WON_EVENT}
          after="chevron"
          wraps
          onPress={() => openEvent(CREATED_ID, { state: 'from-enquiry' })}
          testID="enquiry.won.event"
        />
      </View>
    </View>
  );
}

/** Delete this enquiry?: a sheet on the phone, centred on the iPad, never docked; Keep it is the way back. */
export function DeleteSheet({
  asking,
  body,
  onKeep,
  onDelete,
  onCloseRace,
}: {
  asking: Exclude<Asking, 'none'>;
  body: string;
  onKeep: () => void;
  onDelete: () => void;
  onCloseRace: () => void;
}) {
  const shell = useShell();
  const phone = shell.layout === 'phone';
  const busy = asking === 'deleting';
  const refused = asking === 'failed' ? E.notDeleted : asking === 'offline' ? E.offline : null;
  const keep = (
    <Pill
      label={asking === 'race' ? E.close : E.keepIt}
      kind="quiet"
      full={phone}
      height={tokens.sizeHitPhonePrimary}
      busy={busy}
      onPress={asking === 'race' ? onCloseRace : onKeep}
      testID={asking === 'race' ? 'enquiry.delete.close' : 'enquiry.delete.keep'}
    />
  );

  return (
    <SheetLayer
      onClose={busy ? () => undefined : asking === 'race' ? onCloseRace : onKeep}
      label={asking === 'race' ? E.close : E.keepIt}
    >
      <View style={styles.panel} accessibilityState={{ busy }} testID="enquiry.delete.ask">
        <View style={styles.panelHead}>
          <Text size={20} weight="bold" accessibilityRole="header">
            {E.deleteTitle}
          </Text>
          {asking === 'race' ? (
            <WonNote />
          ) : (
            <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
              {body}
            </Text>
          )}
        </View>
        {refused != null && (
          <View style={styles.refused} accessibilityRole="alert" testID="enquiry.delete.refused">
            <Glyph name="alert" size={18} ink={tokens.colorBrokenText} weight={2.2} />
            <Text size={15} weight="medium" style={[styles.grow, styles.lines]}>
              {refused}
            </Text>
          </View>
        )}
        {asking === 'race' ? (
          <View style={phone ? undefined : styles.end}>{keep}</View>
        ) : (
          <Pair
            layout={phone ? 'phone' : 'portrait'}
            dismiss={keep}
            confirm={
              busy ? (
                <View style={[styles.busy, phone && styles.busyFull]} testID="enquiry.delete.busy">
                  <TurningMark side={14} />
                  <Text size={16} weight="semibold" style={styles.secondary}>
                    {E.deleting}
                  </Text>
                </View>
              ) : (
                <Pill
                  label={refused == null ? E.delete : E.tryAgain}
                  kind="dangerQuiet"
                  full={phone}
                  height={tokens.sizeHitPhonePrimary}
                  onPress={onDelete}
                  testID="enquiry.delete.confirm"
                />
              )
            }
          />
        )}
      </View>
    </SheetLayer>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 15 * 1.45 },
  start: { flexDirection: 'row', alignItems: 'flex-start' },
  end: { flexDirection: 'row', justifyContent: 'flex-end' },
  head: { flexDirection: 'row' },
  chip: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  ring: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorInk,
  },
  warnLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  warnInk: { flexShrink: 1, color: tokens.colorAttentionText },
  warnNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  erasedCard: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  consultation: {
    gap: 2,
    paddingTop: tokens.spaceMd,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  wonNote: {
    gap: tokens.spaceXs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorNeutralFill,
  },
  wonHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  panel: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.space4xl,
  },
  panelHead: { gap: tokens.spaceSm },
  refused: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorBrokenTint,
  },
  busy: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXxl,
  },
  busyFull: { alignSelf: 'stretch' },
});
