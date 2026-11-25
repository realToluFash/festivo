import { createContext, type RefObject, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { OrgMark } from '../../components/OrgMark.tsx';
import { SETTLED_MS, useWindowOrigin } from '../../components/Screen.tsx';
import { inModal } from '../../kit/anchoredMenu.ts';
import { TURNS_WITH_THE_APP } from '../../layout/orientations.ts';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import { useStartWalk } from '../OrgSwitcher.tsx';
import { type DropFrame, frameFor } from '../OrgSwitcherModel.ts';
import { FitWords } from './FitWords.tsx';
import {
  SWITCHER_ASKS,
  SWITCHER_LINE,
  SWITCHER_NAME,
  SWITCHER_TILE,
  type TodayOrg,
  dotKept,
  orgName,
  piecesKeepingDot,
  switcherOrgs,
} from './todaySizeRules.ts';

const ROLE = 'Owner';
const BADGE = 26;

export function orgId(org: TodayOrg): string {
  return `org-${org}`;
}

/** The organisation the size demo is in, and how a row of the stand-in switcher moves it. */
export const SizeOrg = createContext<{
  org: TodayOrg;
  onSwitch: (org: TodayOrg, words: string) => void;
  /** ?switcher=open: the switcher opens once, as the page settles, so a board shows it. */
  openAtStart: boolean;
}>({ org: 'qa', onSwitch: () => undefined, openAtStart: false });

/** sc-92465: from AX1 the pill opens this stand-in for Where are you working?, its rows drawn at the size chosen as main draws them from AX1 (`ROWS`). */
export function useSizeSwitcher(
  opener: RefObject<ViewInstance | null>,
  scale: number,
  ours: boolean,
) {
  const { openAtStart } = useContext(SizeOrg);
  const { width, height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const origin = useWindowOrigin();
  const [frame, setFrame] = useState<DropFrame | null>(null);

  const show = () =>
    opener.current?.measureInWindow((x, y, w, h) =>
      setFrame(
        frameFor({
          opener: { x, y: inModal(y, origin), width: w, height: h },
          window: { width, height },
          insets: { bottom },
          phone: true,
        }),
      ),
    );
  const close = () => setFrame(null);

  useEffect(() => {
    if (!openAtStart || !ours) return undefined;
    const wait = setTimeout(show, 2 * SETTLED_MS);

    return () => clearTimeout(wait);
    // Once, as the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    open: frame != null,
    show,
    drawn:
      frame == null ? null : (
        <SizeSwitcher frame={frame} scale={scale} opener={opener} onClose={close} />
      ),
  };
}

function SizeSwitcher({
  frame,
  scale,
  opener,
  onClose,
}: {
  frame: DropFrame;
  scale: number;
  opener: RefObject<ViewInstance | null>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { org, onSwitch } = useContext(SizeOrg);
  const startWalk = useStartWalk(opener);
  const shown = useModalOpen(true);

  return (
    <Modal
      visible={shown}
      transparent
      animationType="fade"
      supportedOrientations={TURNS_WITH_THE_APP}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('switcher.close')}
        testID="demo.todaySize.switcher.close"
      />
      <View
        style={[
          styles.drop,
          { left: frame.left, top: frame.top, width: frame.width, maxHeight: frame.maxHeight },
        ]}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        testID="demo.todaySize.switcher"
      >
        <View style={styles.clip}>
          <Asks scale={scale} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <View style={styles.list}>
              {switcherOrgs(org).map((key) => (
                <Row
                  key={key}
                  org={key}
                  current={key === org}
                  scale={scale}
                  onPress={() => {
                    onClose();
                    if (key !== org) onSwitch(key, t('switcher.switched', { name: orgName(key) }));
                  }}
                />
              ))}
              <Row
                org={null}
                current={false}
                scale={scale}
                onPress={() => {
                  onClose();
                  setTimeout(startWalk, SETTLED_MS);
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Asks({ scale }: { scale: number }) {
  const { t } = useTranslation();
  const [room, setRoom] = useState(0);

  return (
    <View
      style={styles.head}
      onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
    >
      <FitWords
        text={t('switcher.asks')}
        size={SWITCHER_ASKS}
        scale={scale}
        cap={Infinity}
        room={Math.max(room - 2 * tokens.spaceLg, 0)}
        weight="bold"
        line={1.2}
        role="header"
        style={styles.question}
        testID="demo.todaySize.switcher.heading"
      />
    </View>
  );
}

/** One organisation, or Create an organisation where `org` is null: the name wraps only between its words, and the role line and Current each step alone, never larger than the name. */
function Row({
  org,
  current,
  scale,
  onPress,
}: {
  org: TodayOrg | null;
  current: boolean;
  scale: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const [room, setRoom] = useState(0);
  const [nameAt, setNameAt] = useState<number | null>(null);
  const name = org == null ? t('createOrganisation.row') : orgName(org);
  const line = org == null ? null : dotKept(t('switcher.yourRole', { role: ROLE }));
  const under = nameAt ?? SWITCHER_NAME * scale;
  const said = t('switcher.yourRole', { role: ROLE });
  const label =
    org == null ? name : `${name}, ${said}${current ? `, ${t('switcher.current')}` : ''}`;
  const id = org == null ? 'create' : org;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.entry, current ? styles.lit : pressed && styles.surf]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: current }}
      testID={`demo.todaySize.switcher.${id}`}
    >
      <Tile org={org} current={current} />
      <View
        style={styles.entryWords}
        onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
      >
        <FitWords
          text={name}
          size={SWITCHER_NAME}
          scale={scale}
          cap={Infinity}
          room={room}
          weight="semibold"
          line={1.25}
          style={org == null && styles.violet}
          onDrawn={setNameAt}
          testID={`demo.todaySize.switcher.${id}.name`}
        />
        {line != null && (
          <FitWords
            text={line}
            pieces={piecesKeepingDot(line)}
            size={SWITCHER_LINE}
            scale={scale}
            cap={under}
            room={room}
            weight="medium"
            line={1.35}
            style={[styles.line, styles.secondary]}
            testID={`demo.todaySize.switcher.${id}.role`}
          />
        )}
        {current && (
          <FitWords
            text={t('switcher.current')}
            size={SWITCHER_LINE}
            scale={scale}
            cap={under}
            room={room}
            weight="semibold"
            line={1.35}
            style={[styles.line, styles.violet]}
            testID={`demo.todaySize.switcher.${id}.current`}
          />
        )}
      </View>
    </Pressable>
  );
}

function Tile({ org, current }: { org: TodayOrg | null; current: boolean }) {
  if (org == null)
    return (
      <View
        style={[styles.tile, styles.create]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Glyph
          name="plus"
          size={Math.round(SWITCHER_TILE * 0.42)}
          ink={tokens.colorAccentText}
          weight={2.4}
        />
      </View>
    );

  return (
    <View style={styles.face}>
      <OrgMark id={orgId(org)} name={orgName(org)} side={SWITCHER_TILE} />
      {current && (
        <View
          style={styles.badge}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Glyph
            name="tick"
            size={Math.round(BADGE * 0.55)}
            ink={tokens.colorInkOnDark}
            weight={3.2}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  drop: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.dialog.ios,
    elevation: tokens.elevationNative.dialog.android.elevation,
  },
  clip: { flexShrink: 1, borderRadius: tokens.space3xl - 1, overflow: 'hidden' },
  head: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceLg,
    paddingBottom: tokens.spaceLg,
  },
  question: { textAlign: 'center', letterSpacing: -0.18 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: tokens.spaceLg, paddingBottom: tokens.spaceLg },
  list: { gap: tokens.spaceXxs },
  entry: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXl,
    padding: tokens.spaceLg,
    borderRadius: tokens.spaceXl,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
  surf: { backgroundColor: tokens.colorInset },
  entryWords: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  line: { marginTop: tokens.spaceHair },
  violet: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  face: { width: SWITCHER_TILE, height: SWITCHER_TILE },
  tile: {
    width: SWITCHER_TILE,
    height: SWITCHER_TILE,
    borderRadius: Math.round(SWITCHER_TILE / 3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  create: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  badge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: BADGE + 4,
    height: BADGE + 4,
    borderRadius: (BADGE + 4) / 2,
    borderWidth: 2,
    borderColor: tokens.colorAccentTint,
    backgroundColor: tokens.colorAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
