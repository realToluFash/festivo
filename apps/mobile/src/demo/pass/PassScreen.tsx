import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnOffSwitch } from '../../components/OnOffSwitch.tsx';
import { SecondaryButton } from '../../components/Buttons.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  type PassState,
  type PrintPlatform,
  canPrintTickets,
  choicesOf,
  passStateOf,
  pickerDismissed,
  platformOf,
  pressSwitch,
  printWhenFired,
  printerChosen,
  sentByHand,
  startOf,
} from './PassModel.ts';
import {
  PrintDialogue,
  PrintingPanel,
  PrinterPicker,
  PrintTicketsPanel,
  Scrim,
} from './PassOverlays.tsx';
import { PrinterGlyph, TicketCard } from './PassParts.tsx';
import { FIRED_LATER, FIRE_AT, NOW, PRINTERS, TICKETS } from './PassSample.ts';
import { PW } from './PassWords.ts';

/** /demo/pass: sc-4018's print controls on sc-4012's pass, at tablet landscape, by ?state= and ?platform=. */
export function PassRoute() {
  const params = useLocalSearchParams<{ state?: string; platform?: string }>();
  const state = passStateOf(params.state);
  const [platform, setPlatform] = useState(() => platformOf(params.platform, Platform.OS));

  return (
    <PassScreen
      key={`${state}.${platform}`}
      state={state}
      platform={platform}
      onPlatform={setPlatform}
    />
  );
}

interface Dialogue {
  tables: readonly string[];
  what: string;
}

function PassScreen({
  state,
  platform,
  onPlatform,
}: {
  state: PassState;
  platform: PrintPlatform;
  onPlatform: (platform: PrintPlatform) => void;
}) {
  const insets = useSafeAreaInsets();
  const landscape = useLayout().kind === 'tabletLandscape';
  const tables = TICKETS.map((ticket) => ticket.table);
  const [setup, setSetup] = useState(() => startOf(state, platform, tables, PRINTERS[0]));
  const [fired, setFired] = useState(false);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const tickets = setup.noTickets ? [] : fired ? [...TICKETS, FIRED_LATER] : TICKETS;
  const choices = choicesOf(tickets, setup.record, setup.which);
  const stale = setup.connection === 'none';
  const covered = setup.panel != null || setup.picker || dialogue != null;
  const ipad = platform === 'ipad';
  const change = (next: Partial<typeof setup>) => setSetup((was) => ({ ...was, ...next }));
  const allergyPlates = tickets.reduce((sum, ticket) => sum + ticket.allergies.length, 0);
  const totals = new Map<string, number>();
  for (const ticket of tickets)
    for (const line of ticket.lines) {
      const dish = line.dish.split(' · ').slice(0, 2).join(' · ');
      totals.set(dish, (totals.get(dish) ?? 0) + line.count);
    }

  const shown = useModalOpen(covered);

  function closeAll(): void {
    setDialogue(null);
    change({ panel: null, picker: false });
  }

  function pressedSwitch(): void {
    const press = pressSwitch(setup, NOW);
    if ('open' in press) change({ picker: true });
    else change(press.set);
  }

  function fire(): void {
    setFired(true);
    if (!setup.whenFired || !ipad) return;
    setSetup((was) => ({
      ...was,
      record: printWhenFired(
        [...TICKETS, FIRED_LATER],
        was.record,
        was.onSince,
        !unreachable,
        FIRE_AT,
      ),
    }));
  }

  function refetch(): void {
    if (!setup.whenFired || !ipad) return;
    setSetup((was) => ({
      ...was,
      record: printWhenFired(tickets, was.record, was.onSince, !unreachable, NOW),
    }));
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            style={styles.back}
            onPress={goBack}
            accessibilityRole="button"
            testID="pass.back"
          >
            <Text size={14} weight="semibold" accessible={false}>
              ‹ Design demo
            </Text>
          </Pressable>
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <View style={styles.row}>
                <View style={styles.happening}>
                  <Text size={12} weight="semibold" style={styles.attention}>
                    {PW.happening}
                  </Text>
                </View>
                <Text size={14} style={styles.secondary}>
                  {PW.event}
                </Text>
              </View>
              <View style={styles.row}>
                <Text size={30} weight="bold" accessibilityRole="header">
                  {PW.title}
                </Text>
                {ipad && setup.whenFired && (
                  <View style={styles.whenChip} testID="pass.whenChip">
                    <PrinterGlyph side={16} ink={tokens.colorAccentText} />
                    <Text size={14} weight="semibold">
                      {PW.whenOnChip}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.flex} />
            <View style={styles.tabs}>
              {PW.tabs.map((tab, index) => (
                <View key={tab} style={[styles.tab, index === 0 && styles.tabOn]}>
                  <Text size={14} weight="semibold">
                    {tab}
                  </Text>
                  <Text size={13} weight="medium" style={styles.secondary}>
                    {index === 1 ? 0 : tickets.length}
                  </Text>
                </View>
              ))}
            </View>
            <SecondaryButton
              label={PW.printing}
              onPress={() => change({ panel: 'printing' })}
              testID="pass.printing"
            />
            <PrintTicketsButton
              on={canPrintTickets(tickets)}
              onPress={() => {
                if (canPrintTickets(tickets)) change({ panel: 'tickets' });
              }}
            />
          </View>
        </View>
        <View style={[styles.strip, stale && styles.stripStale]}>
          <View style={[styles.stripDot, stale ? styles.stripDotStale : styles.stripDotLive]} />
          <Text size={14} weight="bold" style={stale ? styles.attention : styles.accent}>
            {stale ? PW.noConnection : PW.connected}
          </Text>
        </View>
        <View style={styles.body}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.tickets}>
            <View style={styles.headingRow}>
              <Text size={18} weight="bold" accessibilityRole="header">
                {PW.ticketsHeading}
              </Text>
            </View>
            {!landscape && (
              <Text size={14} style={styles.secondary}>
                {PW.turn}
              </Text>
            )}
            {tickets.length === 0 && (
              <View style={styles.empty}>
                <Text size={20} weight="bold">
                  {PW.emptyTitle}
                </Text>
                <Text size={17} style={styles.secondary}>
                  {PW.emptyBody}
                </Text>
              </View>
            )}
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.table}
                ticket={ticket}
                record={setup.record}
                stale={stale}
                onPrint={() =>
                  setDialogue({ tables: [ticket.table], what: PW.oneTicket(ticket.table) })
                }
              />
            ))}
          </ScrollView>
          <ScrollView style={styles.side} contentContainerStyle={styles.sideBody}>
            <View style={styles.sideCard}>
              <Text size={12} weight="semibold" style={[styles.secondary, styles.caps]}>
                {PW.stillToMake}
              </Text>
              {[...totals].map(([dish, count]) => (
                <View key={dish} style={styles.total}>
                  <Text size={15} style={styles.flex}>
                    {dish}
                  </Text>
                  <Text size={18} weight="bold">
                    {count}
                  </Text>
                </View>
              ))}
              <Text size={14} weight="semibold">
                {PW.allergyPlates(allergyPlates)}
              </Text>
            </View>
            <DemoOnly title={PW.demoTitle}>
              <View style={styles.demoBox}>
                <View style={styles.rowWrap}>
                  {(['ipad', 'android'] as const).map((each) => (
                    <SecondaryButton
                      key={each}
                      label={
                        each === 'ipad'
                          ? `iPad${platform === each ? ' ✓' : ''}`
                          : `Android${platform === each ? ' ✓' : ''}`
                      }
                      onPress={() => onPlatform(each)}
                      testID={`pass.demo.${each}`}
                    />
                  ))}
                </View>
                <SecondaryButton
                  label={PW.demoFire}
                  onPress={fire}
                  off={fired}
                  testID="pass.demo.fire"
                />
                <SecondaryButton
                  label={PW.demoRefetch}
                  onPress={refetch}
                  testID="pass.demo.refetch"
                />
                {ipad && (
                  <OnOffSwitch
                    on={unreachable}
                    words={{ on: PW.demoUnreachable, off: PW.demoUnreachable }}
                    label={PW.demoUnreachable}
                    onChange={setUnreachable}
                    testID="pass.demo.unreachable"
                  />
                )}
                <Text size={13} style={styles.secondary}>
                  {PW.demoNote}
                </Text>
              </View>
            </DemoOnly>
          </ScrollView>
        </View>
      </View>
      <Modal
        transparent
        visible={shown}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        supportedOrientations={['landscape', 'portrait']}
        onRequestClose={closeAll}
      >
        <View
          style={StyleSheet.absoluteFill}
          accessibilityViewIsModal
          onAccessibilityEscape={closeAll}
        >
          {setup.panel != null && <Scrim onPress={() => change({ panel: null })} />}
          {setup.panel === 'tickets' && (
            <PrintTicketsPanel
              top={insets.top}
              total={tickets.length}
              choices={choices}
              stale={stale}
              roll={setup.roll}
              platform={platform}
              onWhich={(which) => change({ which })}
              onClose={() => change({ panel: null })}
              onPrint={() => {
                change({ panel: null });
                setDialogue({
                  tables: choices.chosen.map((ticket) => ticket.table),
                  what: PW.forMain(choices.chosen.length),
                });
              }}
            />
          )}
          {setup.panel === 'printing' && (
            <PrintingPanel
              top={insets.top}
              platform={platform}
              setup={setup}
              onRoll={(roll) => change({ roll })}
              onSwitch={pressedSwitch}
              onChangePrinter={() => change({ picker: true })}
              onClose={() => change({ panel: null })}
            />
          )}
          {ipad && setup.picker && (
            <>
              <Scrim />
              <PrinterPicker
                printers={PRINTERS}
                current={setup.printer}
                onPick={(name) => change(printerChosen(setup, name, NOW))}
                onCancel={() => change(pickerDismissed(setup))}
              />
            </>
          )}
          {dialogue != null && (
            <>
              <Scrim />
              <PrintDialogue
                platform={platform}
                what={dialogue.what}
                paper={PW.laidOut(PW.rolls[setup.roll], stale)}
                onCancel={() => setDialogue(null)}
                onPrint={() => {
                  change({ record: sentByHand(setup.record, dialogue.tables, NOW) });
                  setDialogue(null);
                }}
              />
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

function PrintTicketsButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.printAll,
        !on && styles.printAllOff,
        pressed && on && styles.pressed,
      ]}
      onPress={onPress}
      disabled={!on}
      accessibilityRole="button"
      accessibilityState={{ disabled: !on }}
      accessibilityLabel={on ? PW.printTickets : `${PW.printTickets} ${PW.noneInCourse}`}
      testID="pass.printTickets"
    >
      <PrinterGlyph side={16} ink={on ? tokens.colorInkSecondary : tokens.colorInkTertiary} />
      <Text size={14} weight="semibold" style={!on && styles.tertiary} accessible={false}>
        {PW.printTickets}
      </Text>
      {!on && (
        <Text size={14} weight="semibold" style={styles.secondary} accessible={false}>
          {PW.noneInCourse}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colorPage },
  flex: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceLg },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  secondary: { color: tokens.colorInkSecondary },
  tertiary: { color: tokens.colorInkTertiary },
  attention: { color: tokens.colorAttentionText },
  accent: { color: tokens.colorAccentText },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  pressed: { opacity: tokens.opacityPressed },
  header: {
    backgroundColor: tokens.colorHeader,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorHeaderBorder,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.spacePillEnd,
  },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacePillEnd,
  },
  titleBlock: { gap: tokens.spaceXxs, flexShrink: 1 },
  happening: {
    paddingHorizontal: 9,
    paddingVertical: tokens.spaceXxs,
    borderRadius: 12,
    backgroundColor: tokens.colorAttentionTint,
  },
  whenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: 32,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorCard,
  },
  tabs: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 25,
    backgroundColor: tokens.colorHeaderTrack,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
  },
  tabOn: { backgroundColor: tokens.colorCard },
  printAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHit,
    paddingHorizontal: 18,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  printAllOff: {
    borderStyle: 'dashed',
    borderColor: tokens.colorMarkEmpty,
    backgroundColor: tokens.colorInset,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceLg,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.space5xl,
    backgroundColor: tokens.colorCard,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  stripStale: {
    backgroundColor: tokens.colorAttentionTint,
    borderBottomColor: tokens.colorAttentionBorder,
  },
  stripDot: { width: 12, height: 12, borderRadius: 6 },
  stripDotLive: { backgroundColor: tokens.colorAccent },
  stripDotStale: {
    borderWidth: 3,
    borderColor: tokens.colorAttention,
    backgroundColor: tokens.colorCard,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: tokens.spaceXxl,
    paddingHorizontal: tokens.space5xl,
    paddingTop: tokens.spaceXxl,
  },
  tickets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spaceLg,
    paddingBottom: tokens.space4xl,
  },
  headingRow: { width: '100%' },
  empty: {
    width: '100%',
    gap: tokens.spaceSm,
    padding: tokens.space4xl,
    borderRadius: tokens.radiusCardDesktop,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  side: { width: 300, flexGrow: 0 },
  sideBody: { gap: tokens.spaceLg, paddingBottom: tokens.space4xl },
  sideCard: {
    gap: tokens.spaceSm,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardDesktop,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  total: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd, minHeight: 32 },
  demoBox: { gap: tokens.spaceSm },
});
