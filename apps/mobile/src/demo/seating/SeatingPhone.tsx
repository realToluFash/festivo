import { useRef } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Row, RowList, TextAction } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { PHONE_TAB_BAR } from '../../components/TodayCover.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventFrame } from '../events/EventFrame.tsx';
import type { Shown as EventShown } from '../events/EventsModel.ts';
import type { AreaKey } from '../events/EventsSample.ts';
import type { Action } from './SeatingActs.ts';
import { free } from './SeatingGeometry.ts';
import {
  type ListTab,
  type Seating,
  editable,
  hexOf,
  itemOf,
  listed,
  namesLine,
  ofWords,
  partyOf,
  partySize,
  partyWho,
  nobodyComing,
  sectionName,
  sectionOf,
  shapeWord,
  summaryLine,
  trayCount,
  withSpace,
} from './SeatingModel.ts';
import { ChairRow, Tray } from './SeatingPanel.tsx';
import {
  MessageBar,
  Notice,
  SeatIcon,
  Segments,
  ShapeTile,
  SheetTitle,
  SUNK,
} from './SeatingParts.tsx';
import { RoomCard } from './SeatingRoom.tsx';
import { COMING, EVENT_NAME, type Item, OFFLINE_AT } from './SeatingSample.ts';
import { Overlays } from './SeatingTablet.tsx';
import { FailedView } from './SeatingViews.tsx';
import { W, say } from './SeatingWords.ts';

type Go = (action: Action) => void;

const TABS: readonly ListTab[] = ['With space', 'Full', 'All'];

function tile(m: Seating, it: Item) {
  const sec = sectionOf(m, it.sec);
  return <ShapeTile kind={it.kind} hex={sec == null ? null : hexOf(sec.colour)} />;
}

function ListRow({ m, go, it }: { m: Seating; go: Go; it: Item }) {
  const picked = m.picked != null;
  const off = !editable(m);
  const names = namesLine(it);
  const label = picked ? W.seatHere : W.seatsButton;
  return (
    <Row
      title={it.name}
      line={`${sectionName(m, it)} · ${shapeWord(it)}${names == null ? '' : `\n${names}`}`}
      lead={tile(m, it)}
      selected={m.lit.includes(it.id)}
      pad={11}
      trail={
        <View style={styles.trail}>
          <Text size={14.5} weight="semibold" style={styles.figures}>
            {ofWords(it)}
          </Text>
          <Pressable
            onPress={() =>
              picked
                ? go({ type: 'seatAt', id: it.id })
                : go({ type: 'sheet', sheet: { kind: 'table', id: it.id } })
            }
            disabled={m.offline}
            style={({ pressed }) => [
              styles.button,
              picked ? styles.buttonOn : styles.buttonQuiet,
              off && styles.buttonOff,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${it.name}`}
            testID={`seating.row.${it.id}`}
          >
            <Text
              size={14}
              weight="semibold"
              accessible={false}
              style={off ? styles.off : picked ? styles.onDark : undefined}
            >
              {label}
            </Text>
          </Pressable>
        </View>
      }
    />
  );
}

function Without({ m, go }: { m: Seating; go: Go }) {
  if (m.trayOpen || m.tray.length === 0) return <Tray m={m} go={go} chips={false} phone />;
  const n = trayCount(m.tray);
  return (
    <Row
      title={W.withoutSeat}
      line={m.tray.map((p) => say.party(partyWho(p), p.plus)).join(', ')}
      lead={
        <View style={styles.count}>
          <Text size={16} weight="bold" accessible={false} style={styles.accent}>
            {String(n)}
          </Text>
        </View>
      }
      opens
      onPress={() => go({ type: 'trayOpen' })}
      accessibilityLabel={`${W.withoutSeat}, ${n}`}
      testID="seating.without"
    />
  );
}

function ChairActions({ m, go, it, chair }: { m: Seating; go: Go; it: Item; chair: number }) {
  const state = it.chairs[chair]?.state;
  if (!editable(m) || state == null) return null;
  return (
    <View style={styles.actions}>
      {state === 'taken' && (
        <TextAction
          label={W.unseat}
          onPress={() => go({ type: 'unseat', id: it.id, chair })}
          testID="seating.sheet.unseat"
        />
      )}
      {state === 'taken' && (
        <TextAction
          label={W.moveTo}
          onPress={() => go({ type: 'sheet', sheet: { kind: 'move', id: it.id, chair } })}
          testID="seating.sheet.moveTo"
        />
      )}
      <TextAction
        label={state === 'unusable' ? W.markUsable : W.markUnusable}
        onPress={() => go({ type: 'mark', id: it.id, chair })}
        testID="seating.sheet.mark"
      />
    </View>
  );
}

function TableSheet({ m, go, close }: { m: Seating; go: Go; close: () => void }) {
  const it = m.sheet?.kind === 'table' ? itemOf(m, m.sheet.id) : null;
  if (it == null) return null;
  const party = partyOf(m, m.picked);
  return (
    <ScrollView contentContainerStyle={styles.sheet}>
      <SheetTitle title={it.name} onClose={close} />
      <Text size={14} weight="medium" style={styles.secondary}>
        {`${sectionName(m, it)} · ${shapeWord(it)} · ${ofWords(it)}`}
      </Text>
      {party != null && <Notice words={say.pick(partyWho(party), party.plus)} tone="note" />}
      {it.chairs.map((chair, i) => (
        <View key={i}>
          <ChairRow
            it={it}
            index={i}
            selected={m.chair === i}
            onPress={party == null ? () => go({ type: 'sheetChair', chair: i }) : undefined}
            trail={
              party != null &&
              editable(m) &&
              (chair.state === 'empty' || chair.state === 'taken') ? (
                <Pill
                  label={chair.state === 'empty' ? W.seatHere : W.swap}
                  kind={chair.state === 'empty' ? 'primary' : 'secondary'}
                  full={false}
                  height={tokens.sizeHit}
                  onPress={() =>
                    chair.state === 'empty'
                      ? go({ type: 'seatAt', id: it.id, chair: i })
                      : go({ type: 'ask', ask: { kind: 'swap', id: it.id, chair: i } })
                  }
                  testID={`seating.sheet.${chair.state === 'empty' ? 'seatHere' : 'swap'}.${i}`}
                />
              ) : undefined
            }
          />
          {m.chair === i && party == null && <ChairActions m={m} go={go} it={it} chair={i} />}
          {m.chair === i && m.fields.errors.chair != null && (
            <Notice words={m.fields.errors.chair} tone="red" />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function MoveSheet({ m, go, close }: { m: Seating; go: Go; close: () => void }) {
  const sheet = m.sheet?.kind === 'move' ? m.sheet : null;
  const it = sheet == null ? null : itemOf(m, sheet.id);
  const who = sheet == null ? null : it?.chairs[sheet.chair]?.who;
  if (sheet == null || it == null || who == null) return null;
  return (
    <ScrollView contentContainerStyle={styles.sheet}>
      <SheetTitle title={say.moveWho(who)} onClose={close} />
      <Text size={14} weight="medium" style={styles.secondary}>
        {W.moveToLine}
      </Text>
      <RowList
        items={withSpace(m.items)
          .filter((t) => t.id !== it.id)
          .map((t) => ({
            key: t.id,
            inset: 52,
            row: (
              <Row
                title={t.name}
                line={say.freeLine(sectionName(m, t), free(t))}
                lead={tile(m, t)}
                opens
                pad={8}
                onPress={() => go({ type: 'moveTo', id: it.id, chair: sheet.chair, to: t.id })}
                testID={`seating.move.${t.id}`}
              />
            ),
          }))}
      />
    </ScrollView>
  );
}

function ShortSheet({ m, go }: { m: Seating; go: Go }) {
  const it = m.sheet?.kind === 'short' ? itemOf(m, m.sheet.id) : null;
  const party = partyOf(m, m.picked);
  if (it == null || party == null) return null;
  return (
    <View style={styles.sheet}>
      <SheetTitle
        title={say.short(it.name, free(it))}
        onClose={() => go({ type: 'sheet', sheet: null })}
      />
      <Text size={16} weight="medium">
        {say.partyIs(partyWho(party), partySize(party))}
      </Text>
      <Pill
        label={say.seatJust(partyWho(party))}
        onPress={() => go({ type: 'seatJust' })}
        testID="seating.short.just"
      />
      <Pill
        label={W.cancel}
        kind="secondary"
        onPress={() => go({ type: 'cancelPick' })}
        testID="seating.short.cancel"
      />
    </View>
  );
}

function Sheets({ m, go }: { m: Seating; go: Go }) {
  const opener = useRef<ViewInstance>(null);
  const close = () => go({ type: 'sheet', sheet: null });
  const kind = m.sheet?.kind;
  return (
    <Sheet
      open={kind === 'table' || kind === 'move' || kind === 'short'}
      onClose={close}
      scrimLabel={W.close}
      opener={opener}
      testID="seating.sheet"
    >
      {kind === 'table' && <TableSheet m={m} go={go} close={close} />}
      {kind === 'move' && <MoveSheet m={m} go={go} close={close} />}
      {kind === 'short' && <ShortSheet m={m} go={go} />}
    </Sheet>
  );
}

function GuestPage({ m, go }: { m: Seating; go: Go }) {
  const seated = m.guest === 'seat';
  const t8 = itemOf(m, 't8');
  return (
    <View style={styles.page}>
      <View>
        <Text size={30} weight="bold" accessibilityRole="header" style={styles.title}>
          {seated ? 'Kwame Mensah' : 'Marta Silva'}
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {seated ? `${W.coming} · Friends · + 1` : `${W.coming} · Work`}
        </Text>
      </View>
      <View>
        <Text size={17} weight="bold" accessibilityRole="header">
          {W.seatBlock}
        </Text>
        {seated && t8 != null ? (
          <Row
            title={say.tableSeat('Table 8', 6)}
            line={`${sectionName(m, t8)} · ${shapeWord(t8)}`}
            lead={tile(m, t8)}
            trail={
              <TextAction
                label={W.change}
                onPress={() => go({ type: 'fromGuest', sheet: 't8', chair: 5, pick: null })}
                testID="seating.guest.change"
              />
            }
          />
        ) : (
          <Row
            title={W.noSeat}
            line={W.notSeatedYet}
            lead={
              <View style={styles.seatTile}>
                <Glyph name="seating" size={20} ink={tokens.colorInkSecondary} />
              </View>
            }
            trail={
              <TextAction
                label={W.seatBlock}
                onPress={() => go({ type: 'fromGuest', sheet: null, chair: null, pick: 'marta' })}
                testID="seating.guest.seat"
              />
            }
          />
        )}
      </View>
      <View>
        <Text size={17} weight="bold" accessibilityRole="header">
          {W.details}
        </Text>
        <RowList
          items={[
            { key: 'reply', row: <Row title={W.reply} value={W.coming} /> },
            { key: 'group', row: <Row title={W.group} value={seated ? 'Friends' : 'Work'} /> },
          ]}
        />
      </View>
    </View>
  );
}

function Body({ m, go }: { m: Seating; go: Go }) {
  if (m.load === 'loading')
    return (
      <View style={styles.page} accessible accessibilityLabel={W.loading}>
        {[20, 236, 64, 44, 72, 72, 72].map((h, i) => (
          <View key={i} style={[styles.shape, { height: h }]} />
        ))}
      </View>
    );
  if (m.load === 'failed')
    return (
      <View style={styles.failed}>
        <FailedView onTry={() => go({ type: 'retry' })} />
      </View>
    );
  if (m.load !== 'ready')
    return (
      <View style={styles.noPlan}>
        <View style={styles.laptop}>
          <Glyph name="laptop" size={26} ink={tokens.colorInkSecondary} weight={1.9} />
        </View>
        <Text size={17} weight="semibold" style={styles.noPlanText}>
          {W.noPlanPhone}
        </Text>
      </View>
    );
  const party = partyOf(m, m.picked);
  const lit =
    party == null ? m.lit : m.items.filter((it) => free(it) >= partySize(party)).map((it) => it.id);
  return (
    <View style={styles.page}>
      {m.offline && (
        <View style={styles.band}>
          <View style={styles.bandHead}>
            <SeatIcon name="cloudoff" size={18} ink={tokens.colorInkSecondary} />
            <Text size={15} weight="semibold">
              {say.offline(OFFLINE_AT)}
            </Text>
          </View>
          <Text size={14} weight="medium" style={[styles.secondary, styles.bandLine]}>
            {W.changesNeedConnection}
          </Text>
        </View>
      )}
      <View style={styles.summary}>
        <Text size={15} weight="semibold" style={[styles.grow, styles.figures]}>
          {summaryLine(m, nobodyComing(m) ? 0 : COMING)}
        </Text>
        <TextAction
          label={W.print}
          onPress={() => go({ type: 'sheet', sheet: { kind: 'print' } })}
          testID="seating.print.open"
        />
      </View>
      {m.readOnly && (
        <Text size={14} weight="medium" style={styles.secondary}>
          {W.readOnly}
        </Text>
      )}
      <RoomCard m={m} lit={lit} />
      <Without m={m} go={go} />
      <Segments
        items={TABS.map((tab) => ({ key: tab, label: say.tab(tab, listed(m.items, tab).length) }))}
        on={m.listTab}
        onPick={(tab) => go({ type: 'listTab', tab })}
        testID="seating.listTab"
      />
      <RowList
        items={listed(m.items, m.listTab).map((it) => ({
          key: it.id,
          inset: 52,
          selected: m.lit.includes(it.id),
          row: <ListRow m={m} go={go} it={it} />,
        }))}
      />
    </View>
  );
}

/** Seating on the iPhone (sc-4027): under More, the summary line, the room card to find a table, Without a seat, then the List. */
export function SeatingPhone({
  m,
  go,
  event,
  now,
  more,
  onMore,
  onArea,
}: {
  m: Seating;
  go: Go;
  event: EventShown;
  now: Date;
  more: boolean;
  onMore: (open: boolean) => void;
  onArea: (area: AreaKey) => void;
}) {
  const insets = useSafeAreaInsets();
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);
  const guest = m.guest != null;
  const refresh = (
    <RefreshControl
      refreshing={m.refreshing}
      onRefresh={() => go({ type: 'refresh' })}
      tintColor={tokens.colorInkSecondary}
    />
  );
  return (
    <EventFrame
      event={event}
      now={now}
      area={guest ? 'guests' : 'seating'}
      onArea={onArea}
      more={more}
      onMore={onMore}
      fill
      phoneBack={
        guest
          ? { label: W.guests, onPress: () => onArea('guests') }
          : { label: W.more, onPress: () => onMore(true) }
      }
      overlay={
        <>
          <Sheets m={m} go={go} />
          <Overlays m={m} go={go} />
          {m.bar != null && !guest && (
            <View style={[styles.pinned, { bottom: foot + PHONE_TAB_BAR + tokens.spaceSm }]}>
              <MessageBar
                bar={m.bar}
                onUndo={() => go({ type: 'undo' })}
                onCancel={() => go({ type: 'cancelPick' })}
                onCentre={() => undefined}
                onStop={() => undefined}
                testID="seating.bar"
              />
            </View>
          )}
        </>
      }
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl * 2 },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={guest ? undefined : refresh}
      >
        {guest ? (
          <GuestPage m={m} go={go} />
        ) : (
          <>
            <View>
              <Text size={30} weight="bold" accessibilityRole="header" style={styles.title}>
                {W.seating}
              </Text>
              <Text size={15} weight="medium" style={styles.secondary}>
                {event.name || EVENT_NAME}
              </Text>
            </View>
            <Body m={m} go={go} />
          </>
        )}
      </ScrollView>
    </EventFrame>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  onDark: { color: tokens.colorInkOnDark },
  off: { color: tokens.colorInkTertiary },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  scroll: { paddingHorizontal: tokens.spaceXxl, paddingTop: 14, gap: 14 },
  title: { letterSpacing: 30 * -0.02, lineHeight: 34 },
  page: { gap: 14 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  trail: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  button: {
    minHeight: tokens.sizeHit,
    paddingHorizontal: 14,
    borderRadius: 22,
    justifyContent: 'center',
  },
  buttonOn: { backgroundColor: tokens.colorAccent },
  buttonQuiet: { backgroundColor: tokens.colorInset },
  buttonOff: { backgroundColor: SUNK },
  count: {
    width: 40,
    height: 40,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorAccentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, paddingLeft: 34 },
  sheet: {
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  pinned: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
  shape: { borderRadius: 14, backgroundColor: SUNK },
  failed: { minHeight: 360 },
  noPlan: { gap: 14, paddingTop: tokens.spaceSm },
  laptop: {
    width: 56,
    height: 56,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPlanText: { lineHeight: 17 * 1.4 },
  band: {
    gap: 2,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: tokens.spaceXl,
    backgroundColor: SUNK,
  },
  bandHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  bandLine: { paddingLeft: 26, lineHeight: 14 * 1.4 },
  seatTile: {
    width: 40,
    height: 40,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
