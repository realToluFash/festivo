import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { OnOffSwitch } from '../../components/OnOffSwitch.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { PassSetup, PrintChoices, PrintPlatform, Roll, Which } from './PassModel.ts';
import { InfoGlyph, NewWords, PrinterGlyph } from './PassParts.tsx';
import { DEVICE, PW } from './PassWords.ts';

export function Scrim({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      style={[StyleSheet.absoluteFill, onPress == null ? styles.scrimLight : styles.scrim]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={PW.close}
      disabled={onPress == null}
      importantForAccessibility={onPress == null ? 'no' : 'auto'}
      testID="pass.scrim"
    />
  );
}

function SidePanel({
  title,
  onClose,
  top,
  children,
  foot,
}: {
  title: string;
  onClose: () => void;
  top: number;
  children: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <View style={[styles.panel, { top }]} accessibilityViewIsModal testID="pass.panel">
      <View style={styles.panelHead}>
        <Text size={22} weight="bold" accessibilityRole="header" style={styles.flex}>
          {title}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={PW.close}
          testID="pass.panel.close"
        >
          <Svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.colorInk}
            strokeWidth={2}
            strokeLinecap="round"
          >
            <Path d="M18 6 6 18" />
            <Path d="m6 6 12 12" />
          </Svg>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.panelBody}>{children}</ScrollView>
      {foot}
    </View>
  );
}

/** Print tickets: Not printed yet, chosen unless nothing is left, or every ticket in the course again. */
export function PrintTicketsPanel({
  top,
  total,
  choices,
  stale,
  roll,
  platform,
  onWhich,
  onPrint,
  onClose,
}: {
  top: number;
  total: number;
  choices: PrintChoices;
  stale: boolean;
  roll: Roll;
  platform: PrintPlatform;
  onWhich: (which: Which) => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  const options = [
    {
      key: 'unprinted' as const,
      title: choices.noneLeft ? PW.noneLeft : PW.notPrintedYet(choices.unprinted.length),
      sub: choices.failedCount > 0 ? PW.includesFailed(choices.failedCount) : null,
      off: choices.noneLeft,
    },
    { key: 'all' as const, title: PW.allFor(total), sub: null, off: false },
  ];

  return (
    <SidePanel
      title={PW.printTickets}
      top={top}
      onClose={onClose}
      foot={
        <View style={styles.foot}>
          <Pressable
            style={styles.textAction}
            onPress={onClose}
            accessibilityRole="button"
            testID="pass.panel.cancel"
          >
            <Text size={15} weight="semibold" accessible={false}>
              {PW.cancel}
            </Text>
          </Pressable>
          <PrimaryButton
            label={PW.printN(choices.chosen.length)}
            onPress={onPrint}
            testID="pass.panel.print"
          />
        </View>
      }
    >
      <Text size={15} weight="semibold" style={styles.label}>
        {PW.which}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const on = choices.which === option.key;
          return (
            <Pressable
              key={option.key}
              style={[styles.option, on && styles.optionOn, option.off && styles.optionOff]}
              onPress={() => onWhich(option.key)}
              disabled={option.off}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: option.off }}
              accessibilityLabel={
                option.sub == null ? option.title : `${option.title} ${option.sub}`
              }
              testID={`pass.which.${option.key}`}
            >
              <RadioMark on={on} />
              <View style={styles.flex}>
                <Text
                  size={17}
                  weight="semibold"
                  style={option.off && styles.label}
                  accessible={false}
                >
                  {option.title}
                </Text>
                {option.sub != null && (
                  <Text size={14} style={styles.label} accessible={false}>
                    {option.sub}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      {stale && (
        <View style={styles.staleNote}>
          <View style={styles.ring} />
          <View style={styles.flexGap}>
            <Text size={15}>{PW.staleNote}</Text>
            <NewWords />
          </View>
        </View>
      )}
      <View style={styles.gap}>
        <Text size={14} style={styles.label}>
          {PW.dialogueLine(DEVICE[platform], PW.rolls[roll])}
        </Text>
        <NewWords />
      </View>
    </SidePanel>
  );
}

/** Printing for this device: A on the iPad with Print when fired, B on Android with the one line in its place. */
export function PrintingPanel({
  top,
  platform,
  setup,
  onRoll,
  onSwitch,
  onChangePrinter,
  onClose,
}: {
  top: number;
  platform: PrintPlatform;
  setup: PassSetup;
  onRoll: (roll: Roll) => void;
  onSwitch: () => void;
  onChangePrinter: () => void;
  onClose: () => void;
}) {
  const printerLine =
    setup.pickerClosed && setup.printer == null
      ? PW.pickerClosed
      : setup.printer == null
        ? PW.asksForPrinter
        : null;

  return (
    <SidePanel title={PW.printing} top={top} onClose={onClose}>
      <View style={styles.gap}>
        <Text size={15} style={styles.label}>
          {PW.deviceLine(DEVICE[platform])}
        </Text>
        <NewWords />
      </View>
      <Text size={17} weight="bold">
        {PW.paperRoll}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.rolls}>
        {(['80', '58'] as const).map((roll) => (
          <Pressable
            key={roll}
            style={[styles.roll, setup.roll === roll && styles.rollOn]}
            onPress={() => onRoll(roll)}
            accessibilityRole="radio"
            accessibilityState={{ checked: setup.roll === roll }}
            testID={`pass.roll.${roll}`}
          >
            <RadioMark on={setup.roll === roll} />
            <Text size={15} weight="semibold" accessible={false}>
              {PW.rolls[roll]}
            </Text>
          </Pressable>
        ))}
      </View>
      {platform === 'ipad' ? (
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.flexGap}>
              <Text size={17} weight="bold">
                {PW.whenFired}
              </Text>
              <Text size={14} style={styles.label}>
                {PW.whenFiredHint}
              </Text>
              <NewWords />
            </View>
            <OnOffSwitch
              on={setup.whenFired}
              words={{ on: PW.on, off: PW.off }}
              label={PW.whenFired}
              onChange={onSwitch}
              testID="pass.whenFired"
            />
          </View>
          {setup.printer != null && (
            <View style={styles.printer}>
              <PrinterGlyph side={20} />
              <View style={styles.flex}>
                <Text size={13} weight="semibold" style={styles.label}>
                  {PW.printer}
                </Text>
                <Text size={17} weight="semibold">
                  {setup.printer}
                </Text>
              </View>
              <SecondaryButton
                label={PW.changePrinter}
                onPress={onChangePrinter}
                testID="pass.changePrinter"
              />
            </View>
          )}
          {printerLine != null && (
            <View style={styles.gap}>
              <Text
                size={14}
                weight={setup.pickerClosed ? 'semibold' : 'regular'}
                style={!setup.pickerClosed && styles.label}
              >
                {printerLine}
              </Text>
              <NewWords />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.section, styles.infoRow]}>
          <InfoGlyph />
          <View style={styles.flexGap}>
            <Text size={17} weight="bold">
              {PW.whenFired}
            </Text>
            <Text size={15}>{PW.needsIpad}</Text>
            <NewWords />
          </View>
        </View>
      )}
    </SidePanel>
  );
}

function StandIn({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <View style={styles.standIn} accessibilityViewIsModal testID="pass.standIn">
      <View style={styles.caption}>
        <Text size={12} weight="semibold" style={[styles.label, styles.caps]}>
          {caption}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** iOS's AirPrint picker, as a plain stand-in: the demo cannot open the real one. */
export function PrinterPicker({
  printers,
  current,
  onPick,
  onCancel,
}: {
  printers: readonly string[];
  current: string | null;
  onPick: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <StandIn caption={PW.pickerCaption}>
      <Text size={17} weight="bold" style={styles.centred}>
        {PW.printer}
      </Text>
      {printers.map((name) => (
        <Pressable
          key={name}
          style={styles.pickRow}
          onPress={() => onPick(name)}
          accessibilityRole="button"
          testID={`pass.pick.${name}`}
        >
          <PrinterGlyph />
          <Text size={17} style={styles.flex}>
            {name}
          </Text>
          {current === name && (
            <Text size={14} style={styles.label}>
              Chosen
            </Text>
          )}
        </Pressable>
      ))}
      <Pressable
        style={styles.pickCancel}
        onPress={onCancel}
        accessibilityRole="button"
        testID="pass.pick.cancel"
      >
        <Text size={17} weight="semibold" accessible={false}>
          {PW.cancel}
        </Text>
      </Pressable>
    </StandIn>
  );
}

/** The device's own print dialogue, as a plain stand-in: Print records Printed {time}; Cancel records nothing. */
export function PrintDialogue({
  platform,
  what,
  paper,
  onPrint,
  onCancel,
}: {
  platform: PrintPlatform;
  what: string;
  paper: string;
  onPrint: () => void;
  onCancel: () => void;
}) {
  return (
    <StandIn caption={PW.dialogueCaption[platform]}>
      <View style={styles.dialogueBody}>
        <Text size={17} weight="bold">
          {what}
        </Text>
        <Text size={14} style={styles.label}>
          {paper}
        </Text>
      </View>
      <View style={styles.dialogueActions}>
        <SecondaryButton label={PW.cancel} onPress={onCancel} testID="pass.dialogue.cancel" />
        <SecondaryButton label={PW.print} onPress={onPrint} testID="pass.dialogue.print" />
      </View>
    </StandIn>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: tokens.scrimSheet },
  scrimLight: { backgroundColor: tokens.scrimSheet, opacity: 0.6 },
  panel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 420,
    backgroundColor: tokens.colorCard,
    borderLeftWidth: 1,
    borderLeftColor: tokens.colorBorder,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXxl,
    paddingBottom: tokens.spaceSm,
    paddingLeft: tokens.space3xl,
    paddingRight: tokens.spaceXl,
  },
  panelBody: {
    paddingHorizontal: tokens.space3xl,
    paddingBottom: tokens.space3xl,
    gap: tokens.spaceXl,
  },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeHit / 2,
  },
  pressed: { opacity: tokens.opacityPressed },
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: tokens.spaceXs },
  gap: { gap: tokens.spaceXs },
  label: { color: tokens.colorInkSecondary },
  caps: { textTransform: 'uppercase', letterSpacing: 0.7 },
  centred: { textAlign: 'center', paddingTop: tokens.spaceXl, paddingBottom: tokens.spaceXs },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  textAction: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
  },
  options: { gap: tokens.spaceMd },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    minHeight: 64,
    padding: tokens.spacePillEnd,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusInset,
  },
  optionOn: { borderWidth: 2, borderColor: tokens.colorAccent },
  optionOff: {
    borderStyle: 'dashed',
    borderColor: tokens.colorMarkEmpty,
    backgroundColor: tokens.colorInset,
  },
  staleNote: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAttentionTint,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
  },
  ring: {
    width: 12,
    height: 12,
    marginTop: 4,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: tokens.colorAttention,
  },
  rolls: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  roll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHit,
    paddingHorizontal: 18,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
  },
  rollOn: { borderWidth: 2, borderColor: tokens.colorAccent },
  section: {
    gap: tokens.spacePillEnd,
    paddingTop: tokens.spaceXxl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXl },
  printer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceLg,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  standIn: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    width: 420,
    backgroundColor: tokens.colorCard,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusCardDesktop,
    overflow: 'hidden',
  },
  caption: {
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXl,
    backgroundColor: tokens.colorInset,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: 52,
    marginHorizontal: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  pickCancel: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    margin: tokens.spaceLg,
  },
  dialogueBody: {
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: 18,
    paddingBottom: tokens.spaceSm,
  },
  dialogueActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: tokens.spaceLg,
    paddingBottom: 18,
  },
});
