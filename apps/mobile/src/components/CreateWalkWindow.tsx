import { deviceRegion, newOrganisationEntered } from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { useIsFocused } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { focusChecked, focusRefused } from './Field.tsx';
import { raiseKeysOn, useKeysUp } from './keyboardWatch.ts';
import { useSendingWords } from './ReadOut.tsx';
import { SETTLED_MS } from './Screen.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
  useScreenReaderOn,
} from './screenReaderFocus.ts';
import {
  SilentWindowName,
  WINDOW_ARRIVES_MS,
  useFocusBack,
  useUnnamedWindow,
  useWindowTurn,
} from './Sheet.tsx';
import type { TextHandle } from './Text.tsx';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useAccessibilitySizes, useLayout } from '../layout/useLayout.ts';
import { fadeAway, glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { currentLocale, dateLocale } from '../i18n/index.ts';
import {
  type Currencies,
  type Device,
  type Naming,
  STEPS,
  type Walk,
  type WalkAnswer,
  answered,
  back,
  firstTurn,
  footPlace,
  onItsSideTyping,
  walkNav,
  forward,
  picked,
  turnEnded,
  turnTo,
  typed,
} from '../kit/createWalk.ts';
import { Bars, NavAction, Progress, WalkButton, takingFocus } from './CreateWalkParts.tsx';
import {
  Brings,
  type CardFrame,
  CountryStep,
  type Look,
  NameStep,
  ReadyStep,
  WideCard,
} from './CreateWalkSteps.tsx';
import { AskLayer } from './AskLayer.tsx';

const GROW_FROM = 0.96;
const PANEL = 760;
const CARD = 300;
const SIDE_PADDING = 32;

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
  /** What takes focus as it opens: the name, the country search, or the step's question. */
  focus: 'name' | 'search' | 'question';
  /** Opened at the country list: it scrolls to the pick. */
  toPick: boolean;
  opener: RefObject<ScreenReaderTarget | null> | null;
}

/** Create an organisation (sc-30334): full screen on the phone, one focused panel on the iPad. `create` sends it, and `onCreated` has what it made. */
export function CreateWalkWindow<Made>({
  opening,
  open,
  email,
  statusBar,
  currencies,
  managedBanner,
  create,
  onCancel,
  onCreated,
}: {
  opening: WalkOpening;
  open: boolean;
  email: string;
  statusBar: 'light' | 'dark';
  currencies: Currencies | null;
  /** sc-563's refusal, in place of the steps when the walk is `managed`. */
  managedBanner?: ReactNode;
  create: (walk: Walk) => Promise<WalkAnswer<Made>>;
  onCancel: () => void;
  onCreated: (made: Made) => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { width, height } = useWindowDimensions();
  const accessibilitySizes = useAccessibilitySizes();
  const phone = kind === 'phone';
  const keysUp = useKeysUp();
  const sideways = onItsSideTyping({ phone, width, height, keysUp });
  const look = useMemo<Look>(
    () => ({ phone, large: phone && accessibilitySizes, sideways }),
    [phone, accessibilitySizes, sideways],
  );
  const here = useIsFocused();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const locale = dateLocale();
  const language = currentLocale();
  const naming = useMemo<Naming>(() => ({ locale: language, currencies }), [language, currencies]);
  const [turning, setTurning] = useState(() => firstTurn(opening.walk));
  const { walk, turn, leaving, dir } = turning;
  const setWalk = (change: (now: Walk) => Walk) =>
    setTurning((now) => ({ ...now, walk: change(now.walk) }));
  const [move] = useState(() => new Animated.Value(1));
  // 'waiting' from a turn until its step has laid out; then the turn whose glide may settle it.
  const playing = useRef<'waiting' | number | null>(null);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [answer, setAnswer] = useState<object | undefined>(undefined);
  const [scrolled, setScrolled] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [landed, setLanded] = useState(false);
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const wanted = phone ? open : present;
  const { shown, gone } = useWindowTurn(useModalOpen(wanted && here));
  const [onScreen, setOnScreen] = useState(false);
  if (!shown && onScreen) setOnScreen(false);
  const readerOn = useScreenReaderOn();
  const talkBack = Platform.OS === 'android' && readerOn;
  const arriving = reduced ? 0 : phone ? WINDOW_ARRIVES_MS : tokens.motionBase;
  // With TalkBack on, hidden while the window arrives, so its focus lands on nothing, Cancel included (sc-42690).
  const unnamed = useUnnamedWindow(
    talkBack && shown,
    onScreen,
    null,
    phone ? WINDOW_ARRIVES_MS : arriving,
  );
  const [fade] = useState(() => new Animated.Value(0));
  const [grow] = useState(() => new Animated.Value(GROW_FROM));
  const [frame, setFrame] = useState({ panel: 0, stage: 0 });
  const field = useRef<TextInputInstance>(null);
  const search = useRef<TextInputInstance>(null);
  const spare = useRef<TextInputInstance>(null);
  const question = useRef<TextHandle>(null);
  const nobody = useRef<ScreenReaderTarget>(null);
  const focusing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef<TextInputInstance | null>(null);
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

    return fadeAway(fade, SETTLED_MS, () => setPresent(false));
  }, [phone, open, present, fade]);

  useEffect(() => {
    if (talkBack || !shown || opening.walk.asking) return;
    const wait = setTimeout(() => {
      if (opening.focus === 'search') search.current?.focus();
      else if (opening.focus === 'name') field.current?.focus();
      else moveScreenReaderFocus(question.current);
    }, SETTLED_MS);

    return () => clearTimeout(wait);
  }, [talkBack, shown, opening]);

  // The tablet's field takes the keys while the window is still hidden, so TalkBack says nothing as it does; once shown, its focus reads the field once (sc-42690). On the phone a field focused while hidden lost its keys as the window was shown (qa3 #47084), so it takes them once, as it is shown.
  useEffect(() => {
    if (!talkBack || phone || !onScreen || !unnamed || opening.walk.asking) return;
    const keys = setTimeout(() => {
      if (opening.focus === 'search') search.current?.focus();
      else if (opening.focus === 'name') field.current?.focus();
    }, arriving);

    return () => clearTimeout(keys);
  }, [talkBack, phone, onScreen, unnamed, arriving, opening]);

  useEffect(() => {
    if (!talkBack || !onScreen || unnamed || opening.walk.asking) return;
    const input =
      opening.focus === 'search' ? search.current : opening.focus === 'name' ? field.current : null;
    if (input == null) {
      moveScreenReaderFocus(question.current);
      return;
    }
    // A hover and then the focus command on an unfocused field read it twice (qa3 #45182): the command alone moves TalkBack's focus with it and reads it once.
    if (input.isFocused()) moveScreenReaderFocus(input);
    if (phone) holding.current = input;
    raiseKeysOn(input);
  }, [talkBack, onScreen, unnamed, opening, phone]);

  useEffect(() => {
    const up = Keyboard.addListener('keyboardDidShow', () => {
      holding.current = null;
    });

    return () => up.remove();
  }, []);
  // A field that gives up focus after the window raised its keys and before they came up gets them once more (qa3 #47084).
  const keysLost = () => {
    const input = holding.current;
    holding.current = null;
    if (input != null && open && !walk.asking) raiseKeysOn(input);
  };

  useEffect(
    () => () => {
      clearTimeout(focusing.current ?? undefined);
      clearTimeout(settling.current ?? undefined);
    },
    [],
  );

  const turnMs = phone ? 240 : tokens.motionBase;
  const settle = () => {
    clearTimeout(settling.current ?? undefined);
    playing.current = null;
    move.setValue(1);
    setTurning((now) => turnEnded(now, now.turn));
  };
  const goTo = (next: Walk) => {
    if (next.step === walk.step) {
      setWalk(() => next);
      return;
    }
    holding.current = null;
    Keyboard.dismiss();
    if (!phone && !reduced)
      LayoutAnimation.configureNext({
        duration: tokens.motionBase,
        update: { type: 'easeInEaseOut' },
      });
    setTurning((now) => turnTo(now, next));
    setScrolled(false);
    setSearchFocused(false);
    playing.current = 'waiting';
    move.setValue(0);
    // Android can lose a native glide's end, which kept the step it left on screen (qa3, #39178).
    clearTimeout(settling.current ?? undefined);
    settling.current = setTimeout(settle, turnMs + SETTLED_MS);
    clearTimeout(focusing.current ?? undefined);
    focusing.current = setTimeout(() => moveScreenReaderFocus(question.current), SETTLED_MS);
  };
  // A glide started before the arriving step's views exist is lost, so it starts once they are laid out (sc-23267).
  const play = (forTurn: number) => {
    if (playing.current !== 'waiting') return;
    playing.current = forTurn;
    requestAnimationFrame(() => {
      if (playing.current !== forTurn) return;
      glide(move, 1, turnMs).start(() => {
        if (playing.current === forTurn) settle();
      });
    });
  };
  useEffect(() => {
    if (!creating) return;
    let live = true;
    void create(walk).then((answer) => {
      // Once the server has made it, it is joined even if the walk has gone.
      if (answer.kind === 'created') {
        setLanded(true);
        onCreated(answer.made);
        return;
      }
      if (!live) return;
      goTo(answered(walk, answer));
    });

    return () => {
      live = false;
    };
    // Once per Create: the walk it sends is the one on screen as it was pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating]);
  const cancel = () => {
    if (creating) return;
    if (newOrganisationEntered(walk)) setWalk((now) => ({ ...now, asking: true }));
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
    holding.current = null;
    if (creating) return;
    if (walk.step === 3) {
      setWalk((now) => ({ ...now, sent: 'creating' }));
      return;
    }
    const next = forward(walk, t);
    if (next.step !== walk.step) {
      goTo(next);
      return;
    }
    setWalk(() => next);
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
        <Brings walk={walk} naming={naming} />
      )}
      <WalkButton
        takesFocus={!talkBack}
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
      naming,
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
          onLeft={live ? keysLost : undefined}
        />
      );
    if (shownWalk.step === 2)
      return (
        <CountryStep
          {...shared}
          field={live ? search : spare}
          toPick={shownWalk.cameBack || opening.toPick}
          onQuery={(query) => setWalk((now) => ({ ...now, query }))}
          onPick={(code) => setWalk((now) => picked(now, code))}
          onSearchFocused={(focused) => {
            setSearchFocused(focused);
            if (!focused && live) keysLost();
          }}
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
          key={live ? turn : turn - 1}
          onLayout={live ? () => play(turn) : undefined}
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
  const behind = walk.asking || unnamed ? ('no-hide-descendants' as const) : ('auto' as const);
  const managed = walk.managed;
  const refusal = (
    <View style={[styles.refusal, phone && styles.refusalPhone]}>{managedBanner}</View>
  );
  // With TalkBack on, its focus landing on a button as the window is revealed took input focus from the field, and the app put the keys down (qa2 #46600).
  const closeAction = (
    <NavAction
      takesFocus={!talkBack}
      label={t('switcher.close')}
      onPress={onCancel}
      testID="createWalk.close"
    />
  );
  const cancelAction = (
    <NavAction
      takesFocus={!talkBack}
      label={t('createOrganisation.cancel')}
      onPress={cancel}
      testID="createWalk.cancel"
    />
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
      onShow={() => setOnScreen(true)}
      onDismiss={gone}
    >
      {Platform.OS === 'android' && <SilentWindowName />}
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
                { paddingTop: insets.top, minHeight: insets.top + walkNav(sideways) },
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
                        takesFocus={!talkBack}
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
              {...takingFocus(!talkBack, creating ? undefined : cancel)}
              disabled={creating}
              accessibilityRole="button"
              accessibilityLabel={t('createOrganisation.cancel')}
              accessibilityState={{ disabled: creating }}
              importantForAccessibility={unnamed ? 'no-hide-descendants' : 'auto'}
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
                  <WideCard walk={walk} email={email} naming={naming} />
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
                          takesFocus={!talkBack}
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
                        takesFocus={!talkBack}
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
          title={t('createOrganisation.discardTitle')}
          line={t('createOrganisation.discardBody')}
          keep={{ label: t('eventEdit.keepEditing'), testID: 'createWalk.keep' }}
          confirm={{
            label: t('createOrganisation.discard'),
            removes: true,
            testID: 'createWalk.discard',
          }}
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
