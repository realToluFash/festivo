import { type ReactNode, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { FlagLine, Glyph } from '../queue/QueueParts.tsx';
import { Initials, PATHS, TextAction, shared } from '../service/HowItsGoingParts.tsx';
import {
  type Item,
  NOTHING_ELSE,
  type NextState,
  type Plate,
  REASONS,
  allServed,
  bringAfter,
  canBringAfter,
  carryOn,
  check,
  dish,
  guestOf,
  mark,
  onItsWay,
  openSendBack,
  owedLine,
  pause,
  route,
  sendBack,
  stageWord,
  takeOff,
  takeToTable,
  tick,
  trayPlates,
  trayTitle,
  unsettled,
} from './nextTrayModel.ts';

export type SetS = (next: NextState) => void;

export interface Z {
  phone: boolean;
  side: number;
}

export function Kicker({ children }: { children: string }) {
  return (
    <Text size={13} weight="bold" style={styles.kicker}>
      {children}
    </Text>
  );
}

export function Waiting({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <View style={styles.waiting}>
      <Glyph paths={PATHS.clock} ink={tokens.colorAttentionText} side={14} circle />
      <Text size={13} weight="semibold" style={styles.attention}>
        Waiting to send
      </Text>
    </View>
  );
}

export function Who({ plate, children }: { plate: Plate; children?: ReactNode }) {
  const g = guestOf(plate.guest);
  const owed = owedLine(plate);
  return (
    <View style={styles.who}>
      <Text size={17} weight="semibold">
        {`Seat ${g.seat} · ${g.name}`}
      </Text>
      {g.flags.map((f) => (
        <FlagLine key={f} flag={f} />
      ))}
      {owed !== '' && (
        <View style={styles.first}>
          <Glyph paths={PATHS.sentBack} ink={tokens.colorInk} side={14} />
          <Text size={14} weight="semibold">
            {owed}
          </Text>
        </View>
      )}
      {children}
    </View>
  );
}

function plateWords(p: Plate, extra: string): string {
  const g = guestOf(p.guest);
  return [`Seat ${g.seat}`, g.name, dish(p), ...g.flags, owedLine(p), extra]
    .filter((x) => x !== '')
    .join(', ');
}

export function TrayInHand({ s, setS, z }: { s: NextState; setS: SetS; z: Z }) {
  const t = s.tray;
  if (t == null) return null;
  const paused = t.paused != null;
  const away = onItsWay(s);
  return (
    <View style={[shared.card, styles.tray]} testID="nextTray.inHand">
      <Kicker>TRAY IN HAND</Kicker>
      <Text size={24} weight="bold" accessibilityRole="header">
        {trayTitle(s)}
      </Text>
      {t.paused != null && (
        <View style={styles.paused}>
          <Glyph paths={PATHS.pause} ink={tokens.colorPausedText} side={16} />
          <Text size={15} weight="semibold" style={styles.pausedText}>
            {`Paused since ${t.paused.at} · ${t.paused.by}`}
          </Text>
          <Waiting on={s.waiting.includes('pause')} />
        </View>
      )}
      {away ? <AtTable s={s} setS={setS} z={z} /> : <Route s={s} setS={setS} z={z} />}
      {paused ? (
        <PrimaryButton
          label="Carry on"
          onPress={() => setS(carryOn(s))}
          testID="nextTray.carryOn"
        />
      ) : (
        !away && (
          <SecondaryButton
            label="Pause the tray"
            onPress={() => setS(pause(s))}
            testID="nextTray.pause"
          />
        )
      )}
    </View>
  );
}

function Route({ s, setS, z }: { s: NextState; setS: SetS; z: Z }) {
  const t = s.tray;
  const firstLeft = useRef<ViewInstance | null>(null);
  const failed = t?.check === 'failed';
  const left = failed ? unsettled(s) : [];
  const firstKey = left[0] == null ? '' : `${left[0].plate.id}.${left[0].item}`;

  useEffect(() => {
    if (failed) moveScreenReaderFocus(firstLeft.current);
  }, [failed, s.say]);

  if (t == null) return null;
  const passed = t.check === 'passed';
  const readOnly = t.paused != null || passed;
  return (
    <>
      {route(s).map((stop, n) => (
        <View key={stop.station.id} style={styles.stop}>
          <View style={styles.stopHead}>
            <Text size={13} weight="bold" style={styles.kicker}>
              {`STOP ${n + 1}`}
            </Text>
            <Text size={19} weight="bold" accessibilityRole="header">
              {stop.station.name}
            </Text>
            <View style={styles.person}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Initials name={stop.station.who} />
              </View>
              <Text size={14} style={shared.secondary}>
                {`${stop.station.who} dishes here`}
              </Text>
            </View>
          </View>
          {stop.rows.length === 0 && (
            <Text size={14} style={shared.secondary}>
              Pick up the tray here.
            </Text>
          )}
          {stop.rows.map(({ plate, items }) => (
            <View key={plate.id} style={styles.plate}>
              <Who plate={plate} />
              {items.map((i) => {
                const key = `${plate.id}.${i.name}`;
                const isLeft = left.some((l) => `${l.plate.id}.${l.item}` === key);
                return (
                  <ItemRow
                    key={key}
                    plate={plate}
                    item={i}
                    s={s}
                    setS={setS}
                    z={z}
                    readOnly={readOnly}
                    left={isLeft}
                    target={key === firstKey ? firstLeft : null}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ))}
      {failed && left.length > 0 && (
        <View accessibilityRole="alert" style={styles.refused}>
          <Glyph paths={PATHS.ban} ink={tokens.colorBrokenText} side={18} circle />
          <Text size={15} weight="semibold" style={[shared.grow, styles.broken]}>
            {`${left.length === 1 ? '1 item' : `${left.length} items`} still to settle. Mark each one On, or Not on with Bring after, or take its plate off.`}
          </Text>
        </View>
      )}
      {passed ? (
        <>
          <View style={styles.checked}>
            <Glyph paths={PATHS.check} ink={tokens.colorAccentText} side={18} />
            <Text size={16} weight="semibold" style={[shared.accent, shared.grow]}>
              Checked
            </Text>
            <Waiting on={s.waiting.includes('check')} />
          </View>
          {t.paused == null && (
            <PrimaryButton
              label="Take to the table"
              onPress={() => setS(takeToTable(s))}
              testID="nextTray.take"
            />
          )}
        </>
      ) : (
        t.paused == null &&
        t.plates.length > 0 && (
          <PrimaryButton
            label="Check the tray"
            onPress={() => setS(check(s))}
            testID="nextTray.check"
          />
        )
      )}
    </>
  );
}

function ItemRow({
  plate,
  item,
  s,
  setS,
  z,
  readOnly,
  left,
  target,
}: {
  plate: Plate;
  item: Item;
  s: NextState;
  setS: SetS;
  z: Z;
  readOnly: boolean;
  left: boolean;
  target: { current: ViewInstance | null } | null;
}) {
  const g = guestOf(plate.guest);
  const key = `${plate.id}.${item.name}`;
  if (item.follow) {
    return (
      <View style={styles.item}>
        <Text size={16} weight="semibold" style={shared.grow}>
          {item.name}
        </Text>
        <Text size={14} weight="semibold" style={shared.secondary}>
          To follow
        </Text>
      </View>
    );
  }
  const notOn = item.mark === 'notOn';
  const after = item.mark === 'bringAfter';
  const canAfter = canBringAfter(plate, item.name);
  return (
    <View style={[styles.itemBox, left && styles.itemLeft]}>
      <View style={styles.item}>
        <View style={shared.grow}>
          <Text size={16} weight="semibold">
            {item.name}
          </Text>
          {left && (
            <View
              ref={target}
              accessible
              accessibilityLabel={`${item.name}, Seat ${g.seat}, ${g.name}, still to settle`}
            >
              <Text size={14} weight="semibold" style={styles.broken}>
                Still to settle
              </Text>
            </View>
          )}
          <Waiting on={s.waiting.includes(key)} />
        </View>
        {after ? (
          <Text size={14} weight="semibold">
            Bring after
          </Text>
        ) : (
          <View style={styles.segments} accessibilityRole="radiogroup">
            {(
              [
                ['on', 'On'],
                ['notOn', 'Not on'],
              ] as const
            ).map(([v, word]) => {
              const chosen = item.mark === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setS(mark(s, plate.id, item.name, v))}
                  disabled={readOnly}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chosen, disabled: readOnly }}
                  accessibilityLabel={`${item.name}, Seat ${g.seat}, ${word}`}
                  style={[styles.segment, { minHeight: z.side }, chosen && styles.segmentOn]}
                  testID={`nextTray.mark.${key}.${v}`}
                >
                  {chosen && v === 'on' && (
                    <Glyph paths={PATHS.check} ink={tokens.colorAccentText} side={15} />
                  )}
                  {chosen && v === 'notOn' && (
                    <Glyph paths={PATHS.close} ink={tokens.colorBrokenText} side={15} />
                  )}
                  <Text
                    size={15}
                    weight={chosen ? 'bold' : 'semibold'}
                    style={!chosen && shared.secondary}
                  >
                    {word}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      {notOn && !readOnly && (
        <View style={styles.resolve}>
          {canAfter ? (
            <SecondaryButton
              label="Bring after"
              paired={z.phone}
              onPress={() => setS(bringAfter(s, plate.id, item.name))}
              accessibilityLabel={`Bring ${item.name} after, Seat ${g.seat}`}
              testID={`nextTray.bringAfter.${key}`}
            />
          ) : (
            <Text size={14} weight="semibold" style={styles.nothingElse}>
              {NOTHING_ELSE}
            </Text>
          )}
          <SecondaryButton
            label="Take off the tray"
            paired={z.phone}
            onPress={() => setS(takeOff(s, plate.id))}
            accessibilityLabel={`Take Seat ${g.seat} off the tray`}
            testID={`nextTray.takeOff.${key}`}
          />
        </View>
      )}
    </View>
  );
}

function AtTable({ s, setS, z }: { s: NextState; setS: SetS; z: Z }) {
  const plates = trayPlates(s);
  const plain = plates.some((p) => p.stage === 'onItsWay' && guestOf(p.guest).flags.length === 0);
  return (
    <>
      <Text size={19} weight="bold" accessibilityRole="header">
        {`At ${s.tray?.table ?? ''}`}
      </Text>
      {plates.map((p) => {
        const g = guestOf(p.guest);
        const served = p.stage === 'served';
        return (
          <View key={p.id} style={styles.plate}>
            <Who plate={p}>
              <Text size={14} style={shared.secondary}>
                {dish(p)}
              </Text>
            </Who>
            <Pressable
              onPress={served ? undefined : () => setS(tick(s, p.id))}
              disabled={served}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: served }}
              accessibilityLabel={plateWords(p, stageWord(p))}
              style={[styles.tick, { minHeight: z.side }]}
              testID={`nextTray.tick.${p.id}`}
            >
              <View style={[styles.box, served ? styles.boxOn : styles.boxOff]}>
                {served && <Glyph paths={PATHS.check} ink={tokens.colorCard} side={18} />}
              </View>
              <Text size={16} weight="semibold" style={shared.grow}>
                {g.name}
              </Text>
              <Text size={14} weight="semibold" style={served ? shared.accent : shared.secondary}>
                {stageWord(p)}
              </Text>
            </Pressable>
            <Waiting on={s.waiting.includes(p.id)} />
            {p.stage === 'onItsWay' &&
              (s.sendingBack === p.id ? (
                <SendBack p={p} s={s} setS={setS} />
              ) : (
                <TextAction
                  label="Send back"
                  paths={PATHS.sentBack}
                  onPress={() => setS(openSendBack(s, p.id))}
                  accessibilityLabel={`Send back Seat ${g.seat}`}
                  testID={`nextTray.sendBack.${p.id}`}
                />
              ))}
          </View>
        );
      })}
      {s.servedLine !== '' && (
        <Text size={16} weight="semibold" testID="nextTray.servedLine">
          {s.servedLine}
        </Text>
      )}
      {plain && (
        <PrimaryButton
          label="All served"
          onPress={() => setS(allServed(s))}
          testID="nextTray.all"
        />
      )}
    </>
  );
}

function SendBack({ p, s, setS }: { p: Plate; s: NextState; setS: SetS }) {
  const g = guestOf(p.guest);
  return (
    <View style={styles.reasons} accessibilityRole="radiogroup">
      <Text size={15} weight="semibold">
        {`Why is Seat ${g.seat} going back?`}
      </Text>
      {REASONS.map((r) => (
        <SecondaryButton
          key={r}
          label={r}
          onPress={() => setS(sendBack(s, p.id, r))}
          testID={`nextTray.reason.${p.id}.${r}`}
        />
      ))}
      <QuietButton
        label="Keep it"
        onPress={() => setS(openSendBack(s, null))}
        testID={`nextTray.keep.${p.id}`}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.6 },
  tray: { borderWidth: 2, borderColor: tokens.colorAccent, gap: tokens.spaceLg },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
  attention: { color: tokens.colorAttentionText },
  broken: { color: tokens.colorBrokenText },
  who: { gap: tokens.spaceXxs },
  first: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  paused: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorPausedTint,
  },
  pausedText: { color: tokens.colorPausedText, flexShrink: 1 },
  stop: { gap: tokens.spaceSm, paddingTop: tokens.spaceSm },
  stopHead: { gap: tokens.spaceXxs },
  person: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  plate: {
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  itemBox: { gap: tokens.spaceSm, borderRadius: tokens.radiusInset },
  itemLeft: {
    padding: tokens.spaceSm,
    borderWidth: 2,
    borderColor: tokens.colorBroken,
    backgroundColor: tokens.colorBrokenTint,
  },
  item: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: tokens.spaceSm },
  segments: {
    flexDirection: 'row',
    padding: tokens.spaceHair,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    gap: tokens.spaceHair,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset - 2,
  },
  segmentOn: { backgroundColor: tokens.colorCard },
  resolve: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  nothingElse: { color: tokens.colorInk, flexShrink: 1 },
  refused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorBrokenTint,
  },
  checked: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: tokens.spaceSm },
  tick: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  box: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: tokens.colorAccent },
  boxOff: {
    backgroundColor: tokens.colorCard,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
  },
  reasons: { gap: tokens.spaceSm },
});
