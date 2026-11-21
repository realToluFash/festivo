import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { useFocusBack, useWindowTurn } from '../../components/Sheet.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { glide } from '../../motion.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import { Glyph } from '../queue/QueueParts.tsx';
import { PATHS, shared } from './HowItsGoingParts.tsx';
import {
  type Can,
  type Flag,
  type Guest,
  type RunOut,
  ITEM,
  MARKED,
  NOBODY_WAITING,
  STANDS_LINE,
  TITLE,
  bulkLabel,
  bulkRows,
  cancel,
  changed,
  closePanel,
  confirmBulk,
  confirmTitle,
  markAvailable,
  nowLine,
  openChoose,
  options,
  pick,
  pressBulk,
  waiting,
  where,
} from './RunOutModel.ts';

const DOCK = 520;

/** The choice panel (RunOutChoice.dc.html): docked at 520 on a tablet, a full-height sheet on a phone; its confirmations sit in the same window, as iOS holds one at a time. */
export function RunOutPanel({
  r,
  can,
  onChange,
  opener,
}: {
  r: RunOut | null;
  can: Can;
  onChange: (next: RunOut) => void;
  opener: RefObject<ViewInstance | null>;
}) {
  const open = r?.panel === true;
  const phone = useLayout().kind === 'phone';
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { shown, gone } = useWindowTurn(useModalOpen(open));
  const heading = useRef<TextHandle | null>(null);
  const inner = useRef<ViewInstance | null>(null);
  const [away] = useState(() => new Animated.Value(1));
  const remember = (ref: ViewInstance | null) => {
    inner.current = ref;
  };
  const backTo = useCallback((): ScreenReaderTarget | null => inner.current ?? heading.current, []);
  useFocusBack(open, opener);

  useEffect(() => {
    if (!shown) return;
    away.setValue(reduced ? 0 : 1);
    if (!reduced) glide(away, 0, tokens.motionSlow).start();
  }, [shown, reduced, away]);

  const close = () => {
    if (r != null) onChange(closePanel(r));
  };
  const overlay = r != null && (r.confirm != null || r.choosing != null);
  const hit = phone ? tokens.sizeHitPhonePrimary : tokens.sizeHit;

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
      onShow={() => {
        setTimeout(() => moveScreenReaderFocus(heading.current), SETTLED_MS);
      }}
      onDismiss={gone}
    >
      <View style={[styles.fill, phone ? styles.endPhone : styles.endDock]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: tokens.scrimDialog }]}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close the choice panel"
          importantForAccessibility={overlay ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={overlay}
        />
        <Animated.View
          style={[
            styles.panel,
            phone
              ? [styles.panelPhone, { marginTop: insets.top + tokens.spaceSm }]
              : [styles.panelDock, { paddingTop: insets.top, paddingRight: insets.right }],
            {
              transform: [
                phone
                  ? { translateY: Animated.multiply(away, 600) }
                  : { translateX: Animated.multiply(away, DOCK) },
              ],
            },
          ]}
          accessibilityViewIsModal={!overlay}
          accessibilityElementsHidden={overlay}
          importantForAccessibility={overlay ? 'no-hide-descendants' : 'auto'}
          onAccessibilityEscape={close}
          testID="runOut.panel"
        >
          {r != null && (
            <>
              <View style={styles.head}>
                <View style={[shared.grow, styles.headText]}>
                  <View style={styles.titleRow}>
                    <Glyph paths={PATHS.ban} ink={tokens.colorInk} side={22} circle />
                    <Text
                      ref={heading}
                      size={phone ? 22 : 24}
                      weight="bold"
                      accessibilityRole="header"
                      style={shared.grow}
                    >
                      {TITLE}
                    </Text>
                  </View>
                  <Text size={14} weight="medium" style={shared.secondary}>
                    {MARKED}
                  </Text>
                </View>
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={({ pressed }) => [
                    styles.close,
                    { width: hit, height: hit, borderRadius: hit / 2 },
                    pressed && styles.pressed,
                  ]}
                  testID="runOut.close"
                >
                  <Glyph paths={PATHS.close} ink={tokens.colorInk} side={20} />
                </Pressable>
              </View>
              <ScrollView
                contentContainerStyle={[
                  styles.body,
                  { paddingBottom: insets.bottom + tokens.spaceXl },
                ]}
              >
                <Body
                  r={r}
                  can={can}
                  onChange={onChange}
                  remember={remember}
                  backTo={backTo}
                  phone={phone}
                />
              </ScrollView>
            </>
          )}
        </Animated.View>
        {r != null && overlay && (
          <Overlay
            r={r}
            can={can}
            onChange={onChange}
            remember={remember}
            backTo={backTo}
            phone={phone}
          />
        )}
      </View>
    </Modal>
  );
}

type Parts = {
  r: RunOut;
  can: Can;
  onChange: (next: RunOut) => void;
  remember: (ref: ViewInstance | null) => void;
  backTo: () => ScreenReaderTarget | null;
  phone: boolean;
};

function Body({ r, can, onChange, remember, phone }: Parts) {
  const list = waiting(r);
  const done = changed(r);
  const pressFrom = (ref: ViewInstance | null, next: RunOut) => {
    remember(ref);
    onChange(next);
  };
  return (
    <>
      <View style={styles.status}>
        {can.online ? (
          <View style={styles.dot} />
        ) : (
          <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={16} />
        )}
        <Text size={14} weight="medium" style={shared.secondary}>
          {can.online ? 'Connected' : 'Offline · as of 20:22'}
        </Text>
      </View>
      <Refusal words={r.refused} offline={!can.online} />
      <View style={styles.part}>
        <Text size={17} weight="bold" accessibilityRole="header">
          Everyone at once
        </Text>
        {bulkRows(r).map((b) =>
          b.stands ? (
            <View key={b.label} style={styles.stands} testID={`runOut.stands.${b.label}`}>
              <Glyph paths={PATHS.given} ink={tokens.colorInk} side={18} />
              <View style={[shared.grow, styles.headText]}>
                <Text size={15} weight="bold">
                  {b.label}
                </Text>
                <Text size={14} weight="semibold">
                  {STANDS_LINE}
                </Text>
              </View>
            </View>
          ) : (
            <RowButton
              key={b.label}
              label={b.label}
              phone={phone}
              onPress={(ref) => pressFrom(ref, pressBulk(r, can, b.bulk))}
              testID={`runOut.bulk.${b.label}`}
            />
          ),
        )}
      </View>
      <View style={styles.part}>
        <Text size={17} weight="bold" accessibilityRole="header">
          {`Waiting for a choice · ${list.length}`}
        </Text>
        {list.length === 0 && (
          <Text size={15} style={shared.secondary}>
            {NOBODY_WAITING}
          </Text>
        )}
        {list.map((g) => (
          <GuestRow key={g.id} g={g}>
            <ChooseFor
              g={g}
              phone={phone}
              onPress={(ref) => pressFrom(ref, openChoose(r, can, g.id))}
            />
          </GuestRow>
        ))}
      </View>
      {done.length > 0 && (
        <View style={styles.part}>
          <Text size={17} weight="bold" accessibilityRole="header">
            Already changed
          </Text>
          {done.map((g) => (
            <GuestRow key={g.id} g={g}>
              <View style={styles.now}>
                <Glyph paths={PATHS.given} ink={tokens.colorAccentText} side={16} />
                <Text size={15} weight="semibold">
                  {nowLine(g)}
                </Text>
                {g.stage !== 'To serve' && (
                  <Text size={14} weight="medium" style={shared.secondary}>
                    {`· ${g.stage}`}
                  </Text>
                )}
              </View>
              {g.stage === 'To serve' && (
                <ChooseFor
                  g={g}
                  phone={phone}
                  onPress={(ref) => pressFrom(ref, openChoose(r, can, g.id))}
                />
              )}
            </GuestRow>
          ))}
        </View>
      )}
      <View style={[styles.part, shared.sep, styles.foot]}>
        <SecondaryButton
          label="Mark available again"
          accessibilityLabel={`Mark ${ITEM} available again`}
          stacked={phone}
          onPress={() => onChange(markAvailable(r, can))}
          testID="runOut.available"
        />
      </View>
    </>
  );
}

function ChooseFor({
  g,
  phone,
  onPress,
}: {
  g: Guest;
  phone: boolean;
  onPress: (ref: ViewInstance | null) => void;
}) {
  const ref = useRef<ViewInstance | null>(null);
  return (
    <SecondaryButton
      ref={ref}
      label={`Choose for ${g.name}`}
      stacked={phone}
      onPress={() => onPress(ref.current)}
      testID={`runOut.choose.${g.id}`}
    />
  );
}

function RowButton({
  label,
  phone,
  onPress,
  testID,
}: {
  label: string;
  phone: boolean;
  onPress: (ref: ViewInstance | null) => void;
  testID: string;
}) {
  const ref = useRef<ViewInstance | null>(null);
  return (
    <Pressable
      ref={ref}
      onPress={() => onPress(ref.current)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { minHeight: phone ? tokens.sizeHitPhonePrimary : tokens.sizeHit },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <Text size={15} weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

function GuestRow({ g, children }: { g: Guest; children: ReactNode }) {
  return (
    <View style={[styles.guest, shared.sep]} testID={`runOut.guest.${g.id}`}>
      <View style={styles.headText}>
        <Text size={16} weight="semibold">
          {g.name}
        </Text>
        <Text size={14} weight="medium" style={shared.secondary}>
          {where(g)}
        </Text>
        {g.flags.map((f) => (
          <FlagWords key={f.words} f={f} />
        ))}
      </View>
      {children}
    </View>
  );
}

function FlagWords({ f }: { f: Flag }) {
  const ink = f.kind === 'diet' ? tokens.colorInk : tokens.colorBrokenText;
  return (
    <View style={styles.flag}>
      <Glyph paths={PATHS.flag} ink={ink} side={14} />
      <Text size={14} weight="semibold" style={{ color: ink }}>
        {f.words}
      </Text>
    </View>
  );
}

export function Refusal({ words, offline }: { words: string; offline: boolean }) {
  if (words === '') return null;
  return (
    <View accessibilityRole="alert" style={styles.refused} testID="runOut.refused">
      <Glyph
        paths={offline ? PATHS.offline : PATHS.ban}
        circle={!offline}
        ink={tokens.colorInk}
        side={18}
      />
      <Text size={15} weight="semibold" style={shared.grow}>
        {words}
      </Text>
    </View>
  );
}

function Overlay({ r, can, onChange, backTo, phone }: Parts) {
  const title = useRef<TextHandle | null>(null);
  const step = r.confirm != null ? 'confirm' : (r.choosing ?? '');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const focus = setTimeout(() => moveScreenReaderFocus(title.current), SETTLED_MS);
    return () => {
      clearTimeout(focus);
      // The control that opened it can be gone once a choice is made: its guest has moved to Already changed.
      setTimeout(() => moveScreenReaderFocus(backTo()), SETTLED_MS);
    };
  }, [step, backTo]);

  const leave = () => onChange(cancel(r));
  const g = r.guests.find((x) => x.id === r.choosing);

  return (
    <View style={[StyleSheet.absoluteFill, phone ? styles.endPhone : styles.centre]}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: tokens.scrimDialog }]}
        onPress={leave}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      />
      <View
        style={[
          styles.card,
          phone
            ? [styles.cardPhone, { paddingBottom: insets.bottom + tokens.spaceLg }]
            : styles.cardTablet,
        ]}
        accessibilityViewIsModal
        onAccessibilityEscape={leave}
        testID={r.confirm != null ? 'runOut.confirm' : 'runOut.chooseFor'}
      >
        {r.confirm != null ? (
          <>
            <Text ref={title} size={20} weight="bold" accessibilityRole="header">
              {confirmTitle(r, r.confirm)}
            </Text>
            {phone ? (
              <View style={styles.actionsPhone}>
                <PrimaryButton
                  label={bulkLabel(r.confirm)}
                  onPress={() => onChange(confirmBulk(r, can))}
                  testID="runOut.confirm.go"
                />
                <SecondaryButton
                  label="Cancel"
                  stacked
                  onPress={leave}
                  testID="runOut.confirm.cancel"
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <SecondaryButton
                  label="Cancel"
                  paired
                  onPress={leave}
                  testID="runOut.confirm.cancel"
                />
                <PrimaryButton
                  label={bulkLabel(r.confirm)}
                  paired
                  onPress={() => onChange(confirmBulk(r, can))}
                  testID="runOut.confirm.go"
                />
              </View>
            )}
          </>
        ) : g != null ? (
          <ScrollView contentContainerStyle={styles.chooseBody}>
            <Text ref={title} size={20} weight="bold" accessibilityRole="header">
              {`Choose for ${g.name}`}
            </Text>
            <Text size={14} weight="medium" style={shared.secondary}>
              {where(g)}
            </Text>
            {g.flags.map((f) => (
              <FlagWords key={f.words} f={f} />
            ))}
            {options(g).map((o) =>
              o.no == null ? (
                <RowButton
                  key={o.label}
                  label={o.label}
                  phone={phone}
                  onPress={() => onChange(pick(r, can, o.item))}
                  testID={`runOut.pick.${o.label}`}
                />
              ) : (
                <View
                  key={o.label}
                  style={styles.refusedRow}
                  accessible
                  accessibilityLabel={`${o.label}. ${o.no.line}${o.no.note === '' ? '' : `. ${o.no.note}`}`}
                  accessibilityState={{ disabled: true }}
                  testID={`runOut.refusedPick.${o.label}`}
                >
                  <Glyph paths={PATHS.ban} ink={tokens.colorBrokenText} side={18} circle />
                  <View style={[shared.grow, styles.headText]}>
                    <Text size={15} weight="semibold" style={shared.secondary}>
                      {o.label}
                    </Text>
                    <Text size={14} weight="bold" style={styles.broken}>
                      {o.no.line}
                    </Text>
                    {o.no.note !== '' && (
                      <Text size={14} style={shared.secondary}>
                        {o.no.note}
                      </Text>
                    )}
                  </View>
                </View>
              ),
            )}
            <SecondaryButton
              label="Cancel"
              stacked={phone}
              onPress={leave}
              testID="runOut.chooseFor.cancel"
            />
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  endDock: { flexDirection: 'row', justifyContent: 'flex-end' },
  endPhone: { justifyContent: 'flex-end' },
  centre: { justifyContent: 'center', alignItems: 'center', padding: tokens.spaceXxl },
  panel: { backgroundColor: tokens.colorPage, overflow: 'hidden' },
  panelDock: { width: DOCK, maxWidth: '100%', height: '100%' },
  panelPhone: {
    flex: 1,
    borderTopLeftRadius: tokens.radiusSheet,
    borderTopRightRadius: tokens.radiusSheet,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.spaceLg,
    backgroundColor: tokens.colorCard,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  headText: { gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  close: { alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colorInset },
  body: { padding: tokens.spaceXl, gap: tokens.spaceXl },
  status: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  part: { gap: tokens.spaceSm },
  foot: { paddingTop: tokens.spaceLg },
  row: {
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    paddingVertical: tokens.spaceSm,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  stands: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHit,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  guest: { gap: tokens.spaceSm, paddingVertical: tokens.spaceLg },
  flag: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  now: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  refused: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  card: { backgroundColor: tokens.colorCard, gap: tokens.spaceLg, padding: tokens.spaceXl },
  cardTablet: { width: 440, maxWidth: '100%', maxHeight: '90%', borderRadius: tokens.radiusSheet },
  cardPhone: {
    maxHeight: '90%',
    borderTopLeftRadius: tokens.radiusSheet,
    borderTopRightRadius: tokens.radiusSheet,
  },
  chooseBody: { gap: tokens.spaceMd },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spaceSm },
  actionsPhone: { gap: tokens.spaceSm },
  refusedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
  },
  broken: { color: tokens.colorBrokenText },
  pressed: { opacity: tokens.opacityPressed },
});
