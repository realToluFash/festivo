import { deviceRegion, formattingLocale } from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { router, useIsFocused } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Pressable,
  StyleSheet,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { focusChecked, focusRefused } from '../../components/Field.tsx';
import { useKeysUp } from '../../components/keyboardWatch.ts';
import { useSendingWords } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { useFocusBack, useWindowTurn } from '../../components/Sheet.tsx';
import type { TextHandle } from '../../components/Text.tsx';
import { TURNS_WITH_THE_APP } from '../../layout/orientations.ts';
import { useAccessibilitySizes, useLayout } from '../../layout/useLayout.ts';
import { glide } from '../../motion.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import {
  type CreateState,
  type Device,
  STEPS,
  WALK,
  type Walk,
  answerTo,
  back,
  entered,
  footPlace,
  forward,
  opensTyping,
  picked,
  typed,
} from './CreateWalk.ts';
import { Bars, NavAction, Progress, WalkButton } from './WalkParts.tsx';
import {
  Brings,
  type CardFrame,
  CountryStep,
  type Look,
  NameStep,
  ReadyStep,
  WideCard,
} from './WalkSteps.tsx';
import { AskLayer } from '../../components/AskLayer.tsx';
import { ManagedBanner } from '../Managed.tsx';

const SEND_MS = 1200;
/** A deep-linked Creating… holds long enough to be looked at, then lands. */
const HELD_MS = 8000;
const LEAVE = Easing.bezier(0.4, 0, 1, 1);
const GROW_FROM = 0.96;
const PANEL = 760;
const CARD = 300;
const SIDE_PADDING = 32;
const NAV = 52;

export function deviceNow(): Device {
  return {
    country: deviceRegion(
      getLocales()[0]?.regionCode ?? null,
      getLocales().map((tag) => tag.languageTag),
    ),
    zone: getCalendars()[0]?.timeZone ?? 'UTC',
  };
}

export interface WalkOpening {
  visit: number;
  walk: Walk;
  state: CreateState | null;
  opener: RefObject<ScreenReaderTarget | null> | null;
}

/** The walk: full screen on the phone, one focused panel on the iPad. Nothing is sent: Create answers from the sample. */
export function CreateWalkWindow({
  opening,
  open,
  email,
  statusBar,
  onCancel,
  onCreated,
}: {
  opening: WalkOpening;
  open: boolean;
  email: string;
  statusBar: 'light' | 'dark';
  onCancel: () => void;
  onCreated: (walk: Walk) => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { width, height } = useWindowDimensions();
  const accessibilitySizes = useAccessibilitySizes();
  const phone = kind === 'phone';
  const look = useMemo<Look>(
    () => ({ phone, large: phone && accessibilitySizes }),
    [phone, accessibilitySizes],
  );
  const here = useIsFocused();
  const reduced = useReducedMotion();
  const keysUp = useKeysUp();
  const insets = useSafeAreaInsets();
  const locale = useMemo(() => formattingLocale('en', getLocales()[0]?.languageTag), []);
  const [walk, setWalk] = useState(opening.walk);
  const [leaving, setLeaving] = useState<Walk | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [move] = useState(() => new Animated.Value(1));
  const [answer, setAnswer] = useState<object | undefined>(undefined);
  const [scrolled, setScrolled] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [landed, setLanded] = useState(false);
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const wanted = phone ? open : present;
  const { shown, gone } = useWindowTurn(useModalOpen(wanted && here));
  const [fade] = useState(() => new Animated.Value(0));
  const [grow] = useState(() => new Animated.Value(GROW_FROM));
  const [frame, setFrame] = useState({ panel: 0, stage: 0 });
  const field = useRef<TextInputInstance>(null);
  const search = useRef<TextInputInstance>(null);
  const spare = useRef<TextInputInstance>(null);
  const question = useRef<TextHandle>(null);
  const nobody = useRef<ScreenReaderTarget>(null);
  const result = useRef<'created' | 'limited'>('created');
  const held = useRef(opening.state === 'creating');
  const focusing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creating = walk.sent === 'creating';
  const searching = walk.query.trim() !== '';

  useFocusBack(open || landed, opening.opener ?? nobody);
  useSendingWords(creating ? t('createOrganisation.creating') : undefined);

  useEffect(() => {
    if (open && !here && !landed) onCancel();
  }, [open, here, landed, onCancel]);

  useEffect(() => {
    if (!phone || !shown) return;
    setStatusBarStyle('dark');

    return () => setStatusBarStyle(statusBar);
  }, [phone, shown, statusBar]);

  useEffect(() => {
    if (phone || !shown) return;
    fade.setValue(0);
    grow.setValue(reduced ? 1 : GROW_FROM);
    Animated.parallel([
      glide(fade, 1, tokens.motionBase),
      glide(grow, 1, tokens.motionBase),
    ]).start();
  }, [phone, shown, reduced, fade, grow]);

  useEffect(() => {
    if (phone || open || !present) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: tokens.motionFast,
      easing: LEAVE,
      useNativeDriver: true,
    }).start(() => setPresent(false));
  }, [phone, open, present, fade]);

  useEffect(() => {
    if (!shown || opening.walk.asking) return;
    const wait = setTimeout(() => {
      if (opening.state === 'country-search') search.current?.focus();
      else if (opening.walk.step === 1 && opensTyping(opening.state)) field.current?.focus();
      else moveScreenReaderFocus(question.current);
    }, SETTLED_MS);

    return () => clearTimeout(wait);
  }, [shown, opening]);

  useEffect(() => {
    if (!creating) return;
    const wait = setTimeout(
      () => {
        if (result.current === 'limited') {
          setWalk((now) => ({ ...now, sent: 'limited' }));
          return;
        }
        setLanded(true);
        onCreated(walk);
      },
      held.current ? HELD_MS : SEND_MS,
    );
    held.current = false;

    return () => clearTimeout(wait);
    // Once per Create: the walk it sends is the one on screen as it was pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating]);

  useEffect(() => () => clearTimeout(focusing.current ?? undefined), []);

  const goTo = (next: Walk) => {
    const ahead = next.step > walk.step ? 1 : -1;
    Keyboard.dismiss();
    if (!phone && !reduced)
      LayoutAnimation.configureNext({
        duration: tokens.motionBase,
        update: { type: 'easeInEaseOut' },
      });
    setLeaving(walk);
    setDir(ahead);
    setScrolled(false);
    setSearchFocused(false);
    setWalk(next);
    move.setValue(0);
    glide(move, 1, phone ? 240 : tokens.motionBase).start(() => setLeaving(null));
    clearTimeout(focusing.current ?? undefined);
    focusing.current = setTimeout(() => moveScreenReaderFocus(question.current), SETTLED_MS);
  };
  const cancel = () => {
    if (creating) return;
    if (entered(walk)) setWalk({ ...walk, asking: true });
    else onCancel();
  };
  const keep = () => setWalk((now) => ({ ...now, asking: false }));
  const discard = () => {
    keep();
    onCancel();
  };
  const goBack = () => {
    if (!creating) goTo(back(walk));
  };
  const escape = () => {
    if (walk.asking) keep();
    else if (creating) return;
    else if (walk.step === 1) cancel();
    else goBack();
  };
  const onPrimary = () => {
    if (creating) return;
    if (walk.step === 3) {
      result.current = answerTo(walk);
      setWalk({ ...walk, sent: 'creating' });
      return;
    }
    const next = forward(walk, t);
    if (next.step !== walk.step) {
      goTo(next);
      return;
    }
    setWalk(next);
    setAnswer({});
    if (walk.step === 1) focusChecked(field);
    else focusRefused(search);
  };

  const stepWords = (shownWalk: Walk) => t('steps.stepOf', { step: shownWalk.step, steps: STEPS });
  const card: CardFrame | null =
    phone || frame.panel === 0
      ? null
      : {
          left: -(CARD + SIDE_PADDING),
          top: -frame.stage,
          width: CARD,
          height: frame.panel,
        };
  const primaryLabel =
    walk.step === 3
      ? creating
        ? t('createOrganisation.creating')
        : t('createOrganisation.create')
      : t('steps.continue');
  const placed = footPlace({ phone, width, height, keysUp, step: walk.step });
  const phoneFoot = (
    <View
      style={[
        walk.managed && styles.hidden,
        styles.foot,
        { paddingBottom: keysUp ? tokens.spaceLg : insets.bottom + tokens.spaceSm },
        placed === 'scrolls' && styles.footScrolled,
      ]}
    >
      {walk.step === 2 && walk.country != null && !(searchFocused && keysUp) && (
        <Brings walk={walk} />
      )}
      <WalkButton
        label={primaryLabel}
        busy={creating}
        reduced={reduced}
        height={look.large ? 64 : tokens.sizeHitPhoneHero}
        size={look.large ? 15 : 16}
        onPress={onPrimary}
        testID="createWalk.primary"
      />
    </View>
  );
  const stepFor = (shownWalk: Walk, live: boolean) => {
    const shared = {
      walk: shownWalk,
      look,
      stepWords: stepWords(shownWalk),
      answer,
      onScrolled: live ? setScrolled : () => undefined,
      ...(live ? { question } : {}),
      ...(live && placed === 'scrolls' ? { foot: phoneFoot } : {}),
    };

    if (shownWalk.step === 1)
      return (
        <NameStep
          {...shared}
          field={live ? field : spare}
          onTyped={(name) => setWalk((now) => typed(now, name))}
          onContinue={onPrimary}
        />
      );
    if (shownWalk.step === 2)
      return (
        <CountryStep
          {...shared}
          field={live ? search : spare}
          toPick={shownWalk.cameBack || opening.state === 'country-list'}
          onQuery={(query) => setWalk((now) => ({ ...now, query }))}
          onPick={(code) => setWalk((now) => picked(now, code))}
          onSearchFocused={setSearchFocused}
        />
      );

    return <ReadyStep {...shared} email={email} locale={locale} card={live ? card : null} />;
  };
  const shift = phone ? 24 : 12;
  const slide = (from: number, to: number) =>
    reduced ? 0 : move.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const steps = [leaving, walk]
    .filter((shownWalk): shownWalk is Walk => shownWalk != null)
    .sort((a, b) => a.step - b.step)
    .map((shownWalk) => {
      const live = shownWalk === walk;

      return (
        <Animated.View
          key={shownWalk.step}
          style={
            live
              ? [styles.step, { opacity: move, transform: [{ translateX: slide(dir * shift, 0) }] }]
              : [
                  StyleSheet.absoluteFill,
                  {
                    opacity: Animated.subtract(1, move),
                    transform: [{ translateX: slide(0, -dir * shift) }],
                  },
                ]
          }
          pointerEvents={live ? 'auto' : 'none'}
          {...(live
            ? {}
            : {
                accessibilityElementsHidden: true,
                importantForAccessibility: 'no-hide-descendants' as const,
              })}
        >
          {stepFor(shownWalk, live)}
        </Animated.View>
      );
    });
  const behind = walk.asking ? ('no-hide-descendants' as const) : ('auto' as const);
  const managed = walk.managed;
  const refusal = (
    <View style={[styles.refusal, phone && styles.refusalPhone]}>
      <ManagedBanner
        onChange={() => {
          onCancel();
          setTimeout(() => router.push('/demo/settings/account'), SETTLED_MS);
        }}
        testID="createWalk.managed"
      />
    </View>
  );
  const closeAction = (
    <NavAction label={t('switcher.close')} onPress={onCancel} testID="createWalk.close" />
  );
  const cancelAction = (
    <NavAction label={t('createOrganisation.cancel')} onPress={cancel} testID="createWalk.cancel" />
  );
  const fills = walk.step === 2 && !searching;

  return (
    <Modal
      visible={shown}
      transparent
      animationType={phone ? (reduced ? 'fade' : 'slide') : 'none'}
      supportedOrientations={TURNS_WITH_THE_APP}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={escape}
      onDismiss={gone}
    >
      {phone ? (
        <KeyboardAvoidingView behavior="padding" style={[styles.fill, styles.screen]}>
          <View
            style={styles.fill}
            accessibilityViewIsModal
            onAccessibilityEscape={escape}
            importantForAccessibility={behind}
            testID="createWalk"
          >
            <View
              style={[
                styles.nav,
                { paddingTop: insets.top, minHeight: insets.top + NAV },
                scrolled && styles.navRuled,
              ]}
            >
              <View style={styles.navSide}>
                {managed
                  ? closeAction
                  : !creating &&
                    (walk.step === 1 ? (
                      cancelAction
                    ) : (
                      <NavAction
                        label={t('steps.back')}
                        back
                        onPress={goBack}
                        testID="createWalk.back"
                      />
                    ))}
              </View>
              {managed ? null : look.large ? (
                <Bars step={walk.step} duration={240} reduced={reduced} />
              ) : (
                <Progress
                  step={walk.step}
                  words={stepWords(walk)}
                  align="center"
                  duration={240}
                  reduced={reduced}
                />
              )}
              <View style={[styles.navSide, styles.navEnd]}>
                {!creating && walk.step > 1 && cancelAction}
              </View>
            </View>
            <View style={[styles.fill, styles.clip]}>{managed ? refusal : steps}</View>
            {placed === 'pinned' && phoneFoot}
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: fade }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={cancel}
              accessibilityRole="button"
              accessibilityLabel={t('createOrganisation.cancel')}
              testID="createWalk.scrim"
            />
          </Animated.View>
          <KeyboardAvoidingView behavior="padding" style={styles.fill} pointerEvents="box-none">
            <View
              style={[styles.room, roomPadding(kind === 'tabletLandscape', keysUp)]}
              pointerEvents="box-none"
            >
              <Animated.View
                style={[
                  styles.panel,
                  {
                    width: Math.min(PANEL, width - 2 * tokens.space3xl),
                    opacity: fade,
                    transform: [{ scale: grow }],
                  },
                  !(kind === 'tabletLandscape' && keysUp) && styles.panelTall,
                  fills && styles.panelList,
                ]}
                onLayout={(event) => {
                  const panel = event.nativeEvent.layout.height;
                  setFrame((now) => (now.panel === panel ? now : { ...now, panel }));
                }}
                accessibilityViewIsModal
                onAccessibilityEscape={escape}
                importantForAccessibility={behind}
                testID="createWalk"
              >
                <View style={styles.panelClip}>
                  <WideCard walk={walk} email={email} />
                  <View style={styles.side}>
                    <View style={styles.top}>
                      {managed ? (
                        <View />
                      ) : (
                        <Progress
                          step={walk.step}
                          words={stepWords(walk)}
                          align="flex-start"
                          duration={tokens.motionBase}
                          reduced={reduced}
                        />
                      )}
                      {managed ? closeAction : !creating && cancelAction}
                    </View>
                    <View
                      style={[fills ? styles.fill : styles.shrink, styles.clip]}
                      onLayout={(event) => {
                        const stage = event.nativeEvent.layout.y;
                        setFrame((now) => (now.stage === stage ? now : { ...now, stage }));
                      }}
                    >
                      {managed ? refusal : steps}
                    </View>
                    <View style={[styles.wideFoot, managed && styles.hidden]}>
                      {!creating && walk.step > 1 && (
                        <WalkButton
                          label={t('steps.back')}
                          kind="secondary"
                          reduced={reduced}
                          height={tokens.sizeHitPhonePrimary}
                          size={15}
                          full={false}
                          onPress={goBack}
                          testID="createWalk.back"
                        />
                      )}
                      <WalkButton
                        label={primaryLabel}
                        busy={creating}
                        reduced={reduced}
                        height={tokens.sizeHitPhonePrimary}
                        size={15}
                        full={false}
                        onPress={onPrimary}
                        testID="createWalk.primary"
                      />
                    </View>
                  </View>
                </View>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
      {walk.asking && (
        <AskLayer
          title={WALK.discardTitle}
          line={WALK.discardBody}
          keep={{ label: t('eventEdit.keepEditing'), testID: 'createWalk.keep' }}
          confirm={{ label: WALK.discard, removes: true, testID: 'createWalk.discard' }}
          onKeep={keep}
          onConfirm={discard}
          width={phone ? 340 : 400}
          testID="createWalk.ask"
        />
      )}
    </Modal>
  );
}

/** The room the panel is centred in: clear of the status bar, and 24 or 12 above the keys. */
function roomPadding(landscape: boolean, keysUp: boolean) {
  if (landscape) return { paddingTop: 42, paddingBottom: keysUp ? tokens.spaceLg : 32 };

  return { paddingTop: 60, paddingBottom: keysUp ? tokens.space3xl : 44 };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shrink: { flexGrow: 0, flexShrink: 1 },
  clip: { overflow: 'hidden' },
  screen: { backgroundColor: tokens.colorCard },
  step: { flexGrow: 1, flexShrink: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    backgroundColor: tokens.colorCard,
  },
  navRuled: { borderBottomColor: tokens.colorBorder },
  navSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  navEnd: { justifyContent: 'flex-end' },
  foot: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    backgroundColor: tokens.colorCard,
  },
  footScrolled: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 },
  scrim: { backgroundColor: tokens.scrimDialog },
  room: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space3xl,
  },
  panel: {
    flexShrink: 1,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.dialog.ios,
    elevation: tokens.elevationNative.dialog.android.elevation,
  },
  panelClip: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: tokens.space3xl,
  },
  panelTall: { minHeight: 400 },
  panelList: { height: 658 },
  side: {
    flex: 1,
    minWidth: 0,
    paddingVertical: tokens.space4xl,
    paddingHorizontal: SIDE_PADDING,
    gap: 18,
  },
  top: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hidden: { display: 'none' },
  refusal: { paddingTop: tokens.spaceXs },
  refusalPhone: { paddingTop: tokens.spaceXl, paddingHorizontal: tokens.spaceXxl },
  wideFoot: {
    marginTop: 'auto',
    paddingTop: tokens.spaceXs,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spaceLg,
  },
});
