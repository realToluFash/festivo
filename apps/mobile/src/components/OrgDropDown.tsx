import { invitationWording, refusalBody } from '@soirely/domain';
import { useIsFocused } from 'expo-router';
import { Fragment, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { dateLocale } from '../i18n/index.ts';
import {
  CELL_GAP,
  type DropFrame,
  type Invite,
  type Offer,
  type Session,
  type Tile,
  cellWidth,
  columnsFor,
  noneMatch,
  rowsOf,
  scrollToShow,
  searchable,
  tileKey,
  tilesOf,
  untilIn,
} from '../kit/orgSwitcher.ts';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useAccessibilitySizes } from '../layout/useLayout.ts';
import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { Initials } from './Initials.tsx';
import { Notice } from './Notice.tsx';
import { OrgMark } from './OrgMark.tsx';
import { useReadOut, useSendingWords } from './ReadOut.tsx';
import {
  SETTLED_MS,
  type StepClosed,
  stepClosed,
  useFocusBackToOpener,
  useFocusOnAnswer,
} from './Screen.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Pill, TYPE } from './SettingsParts.tsx';
import { useFocusBack, useWindowTurn } from './Sheet.tsx';
import { TurningMark } from './SummaryRows.tsx';
import { Text, type TextHandle } from './Text.tsx';

const GROW_FROM = 0.92;
const LEAVE = Easing.bezier(0.4, 0, 1, 1);
const CARET = 16;
/** A tile's name stops at two lines with an ellipsis, in the grid and beside its mark alike; the label, the search and the opened panel keep it whole (sc-486, sc-13496). */
const NAME_LINES = 2;

interface Sizes {
  fixed: boolean;
  question: number;
  name: number;
  line: number;
  note: number;
  title: number;
  body: number;
  tile: number;
  badge: number;
}

const GRID: Sizes = {
  fixed: false,
  question: 18,
  name: 15,
  line: 13,
  note: 13,
  title: 16,
  body: 13.5,
  tile: 48,
  badge: 20,
};
const ROWS: Sizes = { ...GRID, tile: 56, badge: 26 };
const DRAWN_LARGE: Sizes = {
  fixed: true,
  question: 36,
  name: 30,
  line: 26,
  note: 26,
  title: 32,
  body: 27,
  tile: 56,
  badge: 26,
};

export interface DropDownAnswers {
  onClose: () => void;
  onPick: (id: string) => void;
  onCreate: () => void;
  /** Opens the invitation or offer under its tile, or closes it again. */
  onExpand: (id: string) => void;
  onAnswer: (invite: Invite, yes: boolean) => void;
  onAsk: () => void | Promise<void>;
  onNotNow: () => void;
}

/** "Where are you working?": the organisations as tiles, dropped from the opener that `frame` was measured from. */
export function OrgDropDown({
  session,
  frame,
  open,
  back,
  email,
  managed,
  onClose,
  onPick,
  onCreate,
  onExpand,
  onAnswer,
  onAsk,
  onNotNow,
}: DropDownAnswers & {
  session: Session;
  frame: DropFrame;
  open: boolean;
  /** Where screen reader focus goes back to once the drop-down has gone. */
  back: RefObject<ScreenReaderTarget | null>;
  /** Where the answer to Ask to join is emailed. */
  email: string;
  /** sc-563's banner, in place of the answers for the invitation `session.managed` names. */
  managed?: ReactNode;
}) {
  const { t } = useTranslation();
  const here = useIsFocused();
  const reduced = useReducedMotion();
  const accessibilitySizes = useAccessibilitySizes();
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const { shown, gone } = useWindowTurn(useModalOpen(present && here));
  const [fade] = useState(() => new Animated.Value(0));
  const [grow] = useState(() => new Animated.Value(GROW_FROM));
  const heading = useRef<TextHandle>(null);
  const field = useRef<TextInputInstance>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  const seen = useRef({ offset: 0, viewport: 0 });
  const shownFor = useRef<string | null>(null);
  const [typed, setTyped] = useState(session.query);
  const [cleared, setCleared] = useState(0);
  const [under, setUnder] = useState(false);
  const [answered, setAnswered] = useState<object | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const remembered = useRef<TextHandle>(null);
  const [afterOffer, setAfterOffer] = useState<StepClosed>();
  const locale = dateLocale();
  const sizes = session.large ? DRAWN_LARGE : accessibilitySizes ? ROWS : GRID;
  const large = sizes !== GRID;
  const typingAtOpen = searchable(session) && session.query !== '';

  useFocusBack(open, back);
  const tileOpener = useFocusBackToOpener(afterOffer, remembered);

  useEffect(() => {
    if (open && !here) onClose();
  }, [open, here, onClose]);

  useEffect(() => {
    if (!open) return;
    fade.setValue(0);
    grow.setValue(reduced ? 1 : GROW_FROM);
    Animated.parallel([
      glide(fade, 1, tokens.motionBase),
      glide(grow, 1, reduced ? 0 : tokens.motionBase),
    ]).start();
    const focus = setTimeout(
      () => (typingAtOpen ? field.current?.focus() : moveScreenReaderFocus(heading.current)),
      SETTLED_MS,
    );

    return () => clearTimeout(focus);
    // As it opens: what it opened with decides where focus goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fade, grow, reduced]);

  useEffect(() => {
    if (open || !present) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: tokens.motionFast,
      easing: LEAVE,
      useNativeDriver: true,
    }).start(() => setPresent(false));
  }, [open, present, fade]);

  useEffect(() => {
    if (cleared > 0) field.current?.focus();
  }, [cleared]);

  const query = searchable(session) ? typed : '';
  const tiles = tilesOf(session, query);
  const none = noneMatch(session, query);
  const count = tiles.length - 1;
  const typedWords = query.trim();
  useReadOut(
    typedWords === ''
      ? null
      : none
        ? t('switcher.noMatch', { text: typedWords })
        : t('switcher.matches', { count }),
    { afterTyping: typed, quietAtMount: true },
  );

  const across = large ? 1 : columnsFor(frame.width);
  const cell = large ? 0 : cellWidth(frame.width);
  const rows = rowsOf(tiles, across);

  const clear = () => {
    setTyped('');
    setCleared((times) => times + 1);
  };
  const reveal = (top: number, bottom: number) => {
    const to = scrollToShow({ top, bottom, ...seen.current });
    if (to != null) scroller.current?.scrollTo({ y: to, animated: !reduced });
  };
  const answerWith = (invite: Invite, yes: boolean) => {
    setAnswered({});
    onAnswer(invite, yes);
  };
  const ask = () => {
    if (asking) return;
    setAnswered({});
    setAsking(true);
    void Promise.resolve(onAsk()).finally(() => setAsking(false));
  };
  const notNow = (offerKey: string) => {
    const after = tiles[tiles.findIndex((tile) => tileKey(tile) === offerKey) + 1];
    setAfterOffer(stepClosed(after == null ? 'remembered' : tileKey(after)));
    onNotNow();
  };

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      supportedOrientations={TURNS_WITH_THE_APP}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={gone}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('switcher.close')}
        testID="switcher.close"
      />
      <Animated.View
        style={[
          styles.drop,
          {
            left: frame.left,
            top: frame.top,
            width: frame.width,
            maxHeight: frame.maxHeight,
            opacity: fade,
            transform: [{ scale: grow }],
            transformOrigin: [frame.originX, 0, 0],
          },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        testID="switcher"
      >
        <View style={styles.clip}>
          <View style={[styles.head, under && styles.headRuled]}>
            <Text
              ref={heading}
              size={sizes.question}
              weight="bold"
              accessibilityRole="header"
              maxFontSizeMultiplier={sizes.fixed ? 1 : undefined}
              style={[styles.question, { lineHeight: sizes.question * (large ? 1.2 : 1.25) }]}
              testID="switcher.heading"
            >
              {t('switcher.asks')}
            </Text>
            {searchable(session) && (
              <Search
                key={cleared}
                start={cleared > 0 ? '' : session.query}
                typed={typed}
                field={field}
                onTyped={setTyped}
                onClear={clear}
                words={{ search: t('switcher.search'), clear: t('switcher.clearSearch') }}
              />
            )}
          </View>
          <ScrollView
            ref={scroller}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            scrollEventThrottle={16}
            onLayout={(event) => {
              seen.current.viewport = event.nativeEvent.layout.height;
            }}
            onScroll={(event) => {
              const offset = event.nativeEvent.contentOffset.y;
              seen.current.offset = offset;
              setUnder(offset > 0);
            }}
          >
            {none && (
              <View style={styles.none}>
                <Text
                  size={15}
                  weight="medium"
                  maxFontSizeMultiplier={sizes.fixed ? 1 : undefined}
                  style={styles.noneWords}
                >
                  {t('switcher.noMatch', { text: typedWords })}
                </Text>
                <View style={styles.noneClear}>
                  <Pill
                    label={t('switcher.clearSearch')}
                    kind="quiet"
                    full={false}
                    height={tokens.sizeHit}
                    onPress={clear}
                    testID="switcher.search.clearAll"
                  />
                </View>
              </View>
            )}
            <View style={large && styles.list}>
              {rows.map((row, index) => {
                const column = row.findIndex(
                  (tile) =>
                    tile.kind !== 'place' &&
                    tile.kind !== 'create' &&
                    tileKey(tile) === session.expanded,
                );
                const opened = row[column];
                const hasCurrent = row.some((tile) => tile.kind === 'place' && tile.current);

                return (
                  <Fragment key={row.map(tileKey).join(':')}>
                    <View
                      style={[styles.row, !large && index > 0 && styles.rowGap]}
                      onLayout={(event: LayoutChangeEvent) => {
                        if (!hasCurrent || shownFor.current != null) return;
                        shownFor.current = session.current;
                        const { y, height } = event.nativeEvent.layout;
                        reveal(y, y + height);
                      }}
                    >
                      {row.map((tile) => (
                        <Cell
                          key={tileKey(tile)}
                          tile={tile}
                          width={large ? null : cell}
                          sizes={sizes}
                          open={tileKey(tile) === session.expanded}
                          ref={tileOpener(tileKey(tile))}
                          onPress={() => {
                            if (tile.kind === 'create') onCreate();
                            else if (tile.kind === 'place' && tile.current) onClose();
                            else if (tile.kind === 'place') onPick(tile.place.id);
                            else if (tile.kind === 'joined') onPick(joinedId(session, tile));
                            else onExpand(tileKey(tile));
                          }}
                        />
                      ))}
                    </View>
                    {opened != null && opened.kind !== 'place' && opened.kind !== 'create' && (
                      <View
                        style={styles.panel}
                        onLayout={(event) => {
                          const id = tileKey(opened);
                          if (shownFor.current === id) return;
                          shownFor.current = id;
                          const { y, height } = event.nativeEvent.layout;
                          reveal(y, y + height);
                        }}
                        testID={`switcher.panel.${tileKey(opened)}`}
                      >
                        <View
                          style={[
                            styles.caret,
                            {
                              left: large
                                ? tokens.spaceLg + sizes.tile / 2 - CARET / 2
                                : column * (cell + CELL_GAP) + cell / 2 - CARET / 2,
                            },
                          ]}
                        />
                        {opened.kind === 'offer' ? (
                          <OfferPanel
                            offer={opened.offer}
                            email={email}
                            sizes={sizes}
                            answered={answered}
                            busy={asking}
                            onAsk={ask}
                            onNotNow={() => notNow(tileKey(opened))}
                          />
                        ) : (
                          <InvitationPanel
                            invite={opened.invite}
                            outcome={opened.kind === 'invitation' ? opened.outcome : undefined}
                            joined={opened.kind === 'joined'}
                            managed={session.managed === opened.invite.id ? managed : undefined}
                            sizes={sizes}
                            locale={locale}
                            answered={answered}
                            onAnswer={(yes) => answerWith(opened.invite, yes)}
                            onOpen={() => onPick(joinedId(session, opened))}
                          />
                        )}
                      </View>
                    )}
                  </Fragment>
                );
              })}
            </View>
            <Text
              ref={remembered}
              size={sizes.note}
              weight="medium"
              maxFontSizeMultiplier={sizes.fixed ? 1 : undefined}
              style={[styles.note, { lineHeight: sizes.note * 1.45 }]}
            >
              {t('switcher.remembered')}
            </Text>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

/** The organisation an accepted invitation joined, which the server names. */
function joinedId(session: Session, tile: Tile): string {
  if (tile.kind !== 'joined' && tile.kind !== 'invitation') return tileKey(tile);
  const outcome = session.outcomes[tile.invite.id];

  return outcome?.kind === 'accepted' ? outcome.organisationId : tile.invite.id;
}

/** The switcher's search field; Members' person menu takes it too, in its own words (sc-31310). */
export function Search({
  start,
  typed,
  field,
  onTyped,
  onClear,
  words,
  testID = 'switcher.search',
}: {
  start: string;
  typed: string;
  field: RefObject<TextInputInstance | null>;
  onTyped: (typed: string) => void;
  onClear: () => void;
  words: { search: string; clear: string };
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View accessibilityRole="search" style={[styles.search, focused && styles.searchFocused]}>
      <Glyph name="search" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
      <TextField
        ref={field}
        defaultValue={start}
        placeholder={words.search}
        placeholderTextColor={tokens.colorInkSecondary}
        onChangeText={onTyped}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
        accessibilityLabel={words.search}
        style={styles.searchInput}
        testID={testID}
      />
      {typed !== '' && (
        <Pressable
          onPress={onClear}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={words.clear}
          testID={`${testID}.clear`}
        >
          <View style={styles.clearDot}>
            <Glyph name="x" size={11} ink={tokens.colorInkOnDark} weight={3} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

function useTileWords(tile: Tile): { name: string; line: string | null; label: string } {
  const { t } = useTranslation();
  const current = t('switcher.current');

  switch (tile.kind) {
    case 'place': {
      const line = t('switcher.yourRole', { role: tile.place.role });

      return {
        name: tile.place.name,
        line,
        label: `${tile.place.name}, ${line}${tile.current ? `, ${current}` : ''}`,
      };
    }
    case 'joined': {
      const line = t('switcher.yourRole', { role: tile.invite.role });

      return { name: tile.invite.name, line, label: `${tile.invite.name}, ${line}` };
    }
    case 'invitation': {
      const line = t('invitations.fromNobody', { role: tile.invite.role });

      return { name: tile.invite.name, line, label: `${tile.invite.name}, ${line}` };
    }
    case 'offer': {
      const line = t('switcher.canAsk');

      return { name: tile.offer.name, line, label: `${tile.offer.name}, ${line}` };
    }
    case 'create': {
      const name = t('createOrganisation.row');

      return { name, line: null, label: name };
    }
  }
}

function Cell({
  tile,
  width,
  sizes,
  open,
  ref,
  onPress,
}: {
  tile: Tile;
  width: number | null;
  sizes: Sizes;
  open: boolean;
  ref: (view: ViewInstance | null) => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const words = useTileWords(tile);
  const lit = tile.kind === 'place' && tile.current;
  const opens = tile.kind === 'invitation' || tile.kind === 'offer';
  const cap = sizes.fixed ? 1 : undefined;
  const beside = width == null;

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [
        beside ? styles.entry : [styles.cell, { width }],
        lit ? styles.lit : (open || pressed) && styles.surf,
      ]}
      accessibilityRole="button"
      accessibilityLabel={words.label}
      accessibilityState={opens ? { expanded: open } : { selected: lit }}
      testID={`switcher.tile.${tileKey(tile)}`}
    >
      {({ pressed }) => (
        <>
          <TileFace
            tile={tile}
            sizes={sizes}
            open={open}
            ground={
              lit ? tokens.colorAccentTint : open || pressed ? tokens.colorInset : tokens.colorCard
            }
          />
          <View style={beside ? styles.entryWords : styles.cellWords}>
            <Text
              size={sizes.name}
              weight="semibold"
              numberOfLines={NAME_LINES}
              accessible={false}
              maxFontSizeMultiplier={cap}
              style={[
                beside ? styles.left : styles.centred,
                { lineHeight: sizes.name * (beside ? 1.25 : 1.3) },
                tile.kind === 'create' && styles.violet,
              ]}
            >
              {words.name}
            </Text>
            {words.line != null && (
              <Text
                size={sizes.line}
                weight={tile.kind === 'invitation' ? 'semibold' : 'medium'}
                accessible={false}
                maxFontSizeMultiplier={cap}
                style={[
                  beside ? styles.left : styles.centred,
                  styles.line,
                  { lineHeight: sizes.line * 1.35 },
                  tile.kind === 'invitation' ? styles.invitationInk : styles.secondary,
                ]}
              >
                {words.line}
              </Text>
            )}
            {lit && (
              <Text
                size={sizes.line}
                weight="semibold"
                accessible={false}
                maxFontSizeMultiplier={cap}
                style={[
                  beside ? styles.left : styles.centred,
                  styles.line,
                  styles.violet,
                  { lineHeight: sizes.line * 1.35 },
                ]}
              >
                {t('switcher.current')}
              </Text>
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}

function TileFace({
  tile,
  sizes,
  open,
  ground,
}: {
  tile: Tile;
  sizes: Sizes;
  open: boolean;
  ground: string;
}) {
  const side = sizes.tile;
  const radius = Math.round(side / 3);
  const badge = {
    width: sizes.badge + 4,
    height: sizes.badge + 4,
    borderRadius: (sizes.badge + 4) / 2,
    borderColor: ground,
  };

  if (tile.kind === 'create')
    return (
      <View
        style={[styles.tile, styles.create, { width: side, height: side, borderRadius: radius }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Glyph
          name="plus"
          size={Math.round(side * 0.42)}
          ink={tokens.colorAccentText}
          weight={2.4}
        />
      </View>
    );

  if (tile.kind === 'place' || tile.kind === 'joined') {
    const { id, name } = tile.kind === 'place' ? tile.place : tile.invite;

    return (
      <View style={{ width: side, height: side }}>
        <OrgMark id={id} name={name} side={side} />
        {tile.kind === 'place' && tile.current && (
          <View
            style={[styles.badge, badge, styles.badgeCurrent]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Glyph
              name="tick"
              size={Math.round(sizes.badge * 0.55)}
              ink={tokens.colorInkOnDark}
              weight={3.2}
            />
          </View>
        )}
      </View>
    );
  }

  const name = tile.kind === 'offer' ? tile.offer.name : tile.invite.name;

  return (
    <View style={{ width: side, height: side }}>
      <View
        style={[
          styles.tile,
          styles.dashed,
          { width: side, height: side, borderRadius: radius },
          open && styles.rimOpen,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Initials
          name={name}
          size={Math.floor(side * 0.42)}
          weight="bold"
          style={styles.secondary}
        />
      </View>
      <View
        style={[
          styles.badge,
          badge,
          tile.kind === 'offer' ? styles.badgeOffer : styles.badgeInvited,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {tile.kind === 'offer' ? (
          <Glyph
            name="plus"
            size={Math.round(sizes.badge * 0.6)}
            ink={tokens.colorInkSecondary}
            weight={2.6}
          />
        ) : (
          <View
            style={[
              styles.invitedRing,
              { width: sizes.badge / 2, height: sizes.badge / 2, borderRadius: sizes.badge / 4 },
            ]}
          />
        )}
      </View>
    </View>
  );
}

function InvitationPanel({
  invite,
  outcome,
  joined,
  managed,
  sizes,
  locale,
  answered,
  onAnswer,
  onOpen,
}: {
  invite: Invite;
  outcome: Session['outcomes'][string] | undefined;
  joined: boolean;
  managed: ReactNode | undefined;
  sizes: Sizes;
  locale: string;
  answered: object | undefined;
  onAnswer: (yes: boolean) => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const cap = sizes.fixed ? 1 : undefined;
  const full = sizes !== GRID;
  const keys = invitationWording(invite);
  const organisation = invite.name;
  const inviter = invite.invitedBy?.name ?? '';
  const busy = outcome?.kind === 'busy' ? outcome.answer : null;
  const height = full ? tokens.sizeHitPhoneHero : tokens.sizeHit;

  useSendingWords(
    busy == null
      ? undefined
      : t(busy === 'accept' ? 'invitations.joining' : 'invitations.declining'),
  );

  if (joined)
    return (
      <View>
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          body={t('invitations.joined', { organisation, role: invite.role })}
          answer={answered}
          takesFocus
        />
        <View style={styles.buttonsUnder}>
          <Pill
            label={t('invitations.open', { organisation })}
            height={full ? tokens.sizeHitPhoneHero : tokens.sizeHit}
            onPress={onOpen}
            testID={`switcher.invitation.${invite.id}.open`}
          />
        </View>
      </View>
    );

  return (
    <View>
      <Text
        size={sizes.title}
        weight="bold"
        maxFontSizeMultiplier={cap}
        style={{ lineHeight: sizes.title * 1.3 }}
      >
        {organisation}
      </Text>
      <View style={styles.panelLines}>
        <Text
          size={sizes.body}
          weight="medium"
          maxFontSizeMultiplier={cap}
          style={[styles.secondary, { lineHeight: sizes.body * 1.4 }]}
        >
          {t(keys.line, { inviter, role: invite.role })}
        </Text>
        <Text
          size={sizes.body}
          weight="medium"
          maxFontSizeMultiplier={cap}
          style={[styles.secondary, styles.figures, { lineHeight: sizes.body * 1.4 }]}
        >
          {t(keys.until, { date: untilIn(locale, invite.until), email: invite.email })}
        </Text>
      </View>
      {managed != null ? (
        <View style={styles.answerUnder}>{managed}</View>
      ) : outcome?.kind === 'declined' ? (
        <View style={styles.answerUnder}>
          <Notice
            tone="quiet"
            mark="–"
            body={t(keys.declined, { inviter })}
            answer={answered}
            takesFocus
          />
        </View>
      ) : outcome?.kind === 'refused' ? (
        <View style={styles.answerUnder}>
          <Notice
            tone={outcome.refusal === 'invitation_expired' ? 'attention' : 'quiet'}
            mark={outcome.refusal === 'invitation_expired' ? '!' : 'i'}
            title={t(`invitations.refused.${outcome.refusal}.word`)}
            body={t(refusalBody(outcome.refusal, invite.invitedBy != null), {
              inviter,
              organisation,
              email: invite.email,
              signedInAs: invite.signedInAs ?? '',
            })}
            answer={answered}
            takesFocus
          />
        </View>
      ) : (
        <View style={styles.answerUnder}>
          {outcome?.kind === 'failed' && (
            <View style={styles.failed}>
              <Notice
                tone="broken"
                mark={tokens.marks.broken.glyph}
                body={t('invitations.failed')}
                answer={answered}
              />
            </View>
          )}
          <View style={styles.buttons}>
            {busy === 'accept' ? (
              <SendingPill
                words={t('invitations.joining')}
                full={full}
                height={height}
                testID={`switcher.invitation.${invite.id}.accept`}
              />
            ) : (
              <Pill
                label={t('invitations.accept')}
                accessibilityLabel={t('invitations.acceptLabel', { organisation })}
                kind={busy == null ? 'primary' : 'off'}
                full={full}
                height={height}
                onPress={() => onAnswer(true)}
                testID={`switcher.invitation.${invite.id}.accept`}
              />
            )}
            {busy === 'decline' ? (
              <SendingPill
                words={t('invitations.declining')}
                full={full}
                height={height}
                testID={`switcher.invitation.${invite.id}.decline`}
              />
            ) : (
              <Pill
                label={t('invitations.decline')}
                accessibilityLabel={t('invitations.declineLabel', { organisation })}
                kind={busy == null ? 'secondary' : 'off'}
                full={full}
                height={height}
                onPress={() => onAnswer(false)}
                testID={`switcher.invitation.${invite.id}.decline`}
              />
            )}
          </View>
          <Text
            size={sizes.line}
            weight="medium"
            maxFontSizeMultiplier={cap}
            style={[styles.secondary, styles.declineNote, { lineHeight: sizes.line * 1.4 }]}
          >
            {t(keys.declineNote, { inviter })}
          </Text>
        </View>
      )}
    </View>
  );
}

/** The pressed answer while it is out: the Pill's `off` ground, the turning mark and what it is doing in Ink 2, as the Ask's busy confirm says it. */
function SendingPill({
  words,
  full,
  height,
  testID,
}: {
  words: string;
  full: boolean;
  height: number;
  testID: string;
}) {
  return (
    <Pressable
      disabled
      style={[
        styles.sending,
        full ? styles.sendingFull : styles.sendingFit,
        { height, borderRadius: height / 2 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={words}
      accessibilityState={{ disabled: true, busy: true }}
      testID={testID}
    >
      <TurningMark side={16} />
      <Text
        size={height >= tokens.sizeHitPhonePrimary ? 16 : TYPE.body}
        weight="semibold"
        numberOfLines={1}
        accessible={false}
        style={styles.secondary}
      >
        {words}
      </Text>
    </Pressable>
  );
}

function OfferPanel({
  offer,
  email,
  sizes,
  answered,
  busy,
  onAsk,
  onNotNow,
}: {
  offer: Offer;
  email: string;
  sizes: Sizes;
  answered: object | undefined;
  busy: boolean;
  onAsk: () => void;
  onNotNow: () => void;
}) {
  const { t } = useTranslation();
  const cap = sizes.fixed ? 1 : undefined;
  const full = sizes !== GRID;
  const refused = offer.status === 'unavailable';
  const asked = offer.status === 'asked';
  const waiting = t('domainJoining.waiting');
  const askedWords = t('domainJoining.switcherAsked', { email });

  useReadOut(refused && answered != null ? t('domainJoining.unavailable') : null, {
    answer: answered,
  });
  const { read: waitingWords } = useFocusOnAnswer<ViewInstance>(asked ? answered : undefined);

  return (
    <View>
      <Text
        size={sizes.title}
        weight="bold"
        maxFontSizeMultiplier={cap}
        style={{ lineHeight: sizes.title * 1.3 }}
      >
        {t('domainJoining.usesSoirely', { organisation: offer.name })}
      </Text>
      <Text
        size={sizes.body}
        weight="medium"
        maxFontSizeMultiplier={cap}
        style={[styles.secondary, styles.offerBody, { lineHeight: sizes.body * 1.45 }]}
      >
        {t('domainJoining.switcherBody', { domain: offer.domain })}
      </Text>
      {asked ? (
        <View style={styles.asked}>
          <View style={styles.askedRing} />
          <View ref={waitingWords} style={styles.grow} accessible>
            <Text
              size={sizes.body}
              weight="semibold"
              maxFontSizeMultiplier={cap}
              style={{ lineHeight: sizes.body * 1.45 }}
            >
              {waiting}
            </Text>
            <Text
              size={sizes.body}
              weight="medium"
              maxFontSizeMultiplier={cap}
              style={[styles.secondary, { lineHeight: sizes.body * 1.45 }]}
            >
              {`· ${askedWords}`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.answerUnder}>
          {refused && (
            <Text
              size={sizes.body}
              weight="semibold"
              maxFontSizeMultiplier={cap}
              style={[styles.refused, { lineHeight: sizes.body * 1.45 }]}
            >
              {t('domainJoining.unavailable')}
            </Text>
          )}
          <View style={styles.buttons}>
            <Pill
              label={t('domainJoining.ask')}
              kind={busy ? 'off' : 'primary'}
              full={full}
              height={full ? tokens.sizeHitPhoneHero : tokens.sizeHit}
              onPress={onAsk}
              testID="switcher.offer.ask"
            />
            <Pill
              label={t('domainJoining.notNow')}
              kind={busy ? 'off' : 'secondary'}
              full={full}
              height={full ? tokens.sizeHitPhoneHero : tokens.sizeHit}
              onPress={onNotNow}
              testID="switcher.offer.notNow"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
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
    gap: tokens.spaceLg,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headRuled: { borderBottomColor: tokens.colorBorder },
  question: { textAlign: 'center', letterSpacing: -0.18 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: tokens.spaceLg, paddingBottom: tokens.spaceLg },
  search: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: tokens.spaceLg,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
  },
  searchFocused: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    paddingLeft: tokens.spaceLg - 2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    fontWeight: '500',
  },
  clear: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearDot: {
    width: tokens.spaceXxl,
    height: tokens.spaceXxl,
    borderRadius: tokens.spaceMd,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkSecondary,
  },
  none: {
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingTop: tokens.spaceXxl,
    paddingHorizontal: tokens.spaceSm,
    paddingBottom: tokens.spaceSm,
  },
  noneWords: { textAlign: 'center', lineHeight: 15 * 1.4 },
  noneClear: { alignSelf: 'center' },
  list: { gap: tokens.spaceXxs },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: CELL_GAP },
  rowGap: { marginTop: tokens.spaceSm },
  cell: {
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: tokens.spaceXl,
  },
  entry: {
    flex: 1,
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXl,
    padding: tokens.spaceLg,
    borderRadius: tokens.spaceXl,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
  surf: { backgroundColor: tokens.colorInset },
  cellWords: { alignSelf: 'stretch', marginTop: tokens.spaceSm },
  entryWords: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  centred: { textAlign: 'center' },
  left: { textAlign: 'left' },
  line: { marginTop: tokens.spaceHair },
  violet: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  invitationInk: { color: tokens.colorPrimaryHover },
  figures: { fontVariant: ['tabular-nums'] },
  tile: { alignItems: 'center', justifyContent: 'center' },
  create: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  dashed: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  rimOpen: { borderStyle: 'solid', borderColor: tokens.colorAccent },
  badge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCurrent: { backgroundColor: tokens.colorAccent },
  badgeInvited: { backgroundColor: tokens.colorAccentTint },
  badgeOffer: { backgroundColor: tokens.colorNeutralFill },
  invitedRing: { borderWidth: 2, borderColor: tokens.colorPrimaryHover },
  panel: {
    marginTop: tokens.spaceMd,
    paddingVertical: tokens.spacePillEnd,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorInset,
  },
  caret: {
    position: 'absolute',
    top: -7,
    width: CARET,
    height: CARET,
    borderRadius: 3,
    backgroundColor: tokens.colorInset,
    transform: [{ rotate: '45deg' }],
  },
  panelLines: { marginTop: tokens.spaceMd, gap: tokens.spaceHair },
  answerUnder: { marginTop: tokens.spaceMd },
  failed: { marginBottom: tokens.spaceSm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  sending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    backgroundColor: tokens.colorNeutralFill,
  },
  sendingFull: { alignSelf: 'stretch', paddingHorizontal: tokens.spaceXxl },
  sendingFit: { alignSelf: 'flex-start', paddingHorizontal: 22 },
  buttonsUnder: { marginTop: tokens.spaceMd, alignItems: 'flex-start' },
  declineNote: { marginTop: tokens.spaceSm },
  offerBody: { marginTop: tokens.spaceMd },
  refused: { color: tokens.colorBroken, marginBottom: tokens.spaceSm },
  asked: {
    marginTop: tokens.spaceMd,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
  },
  askedRing: {
    width: tokens.spaceLg,
    height: tokens.spaceLg,
    marginTop: 4,
    borderRadius: tokens.spaceXs,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  note: { marginTop: tokens.spaceXl, textAlign: 'center', color: tokens.colorInkSecondary },
});
