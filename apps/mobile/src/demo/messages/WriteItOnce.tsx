import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { keyboardTopNow } from '../../components/keyboardWatch.ts';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { type Anchor, AnchoredMenu, Row } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventField } from '../events/EventEdits.tsx';
import { SheetBody } from '../guests/GuestEdit.tsx';
import { TOKENS, type Token } from './MessagesSample.ts';
import { W } from './MessagesWords.ts';
import { PREVIEW_AS, optionOf } from './PreviewModel.ts';
import type { PreviewKey, PreviewPerson } from './PreviewSample.ts';
import { PW, TOKEN_LINE } from './PreviewWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

/** An anchor that also knows the top of what opened it, so a menu with no room under it can sit above. */
export interface Anchored extends Anchor {
  top: number;
}

export function anchorAt(node: ViewInstance | null | undefined, then: (at: Anchored) => void) {
  node?.measureInWindow((x, y, width, height) => then({ x, y: y + height, width, top: y }));
}

const GAP = tokens.spaceXxs;
const INSERT_WIDTH = 360;
const SELECT_WIDTH = 360;
/** Four rows of a word and a line, until the menu has measured its own. */
const INSERT_GUESS = 300;

function InsertRows({
  role,
  inSheet,
  onInsert,
}: {
  role: 'menuitem' | 'button';
  inSheet: boolean;
  onInsert: (token: Token) => void;
}) {
  return TOKENS.map((token) => (
    <Pressable
      key={token}
      onPress={() => onInsert(token)}
      style={({ pressed }) => [
        styles.insertRow,
        inSheet ? styles.sheetRow : styles.menuRow,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole={role}
      accessibilityLabel={`${token}, ${TOKEN_LINE[token]}`}
      testID={`messages.insert.${token}`}
    >
      <View style={styles.token}>
        <Text size={14} weight="semibold" accessible={false} style={styles.accent}>
          {token}
        </Text>
      </View>
      <Text size={14} weight="medium" accessible={false} style={[styles.secondary, styles.line]}>
        {TOKEN_LINE[token]}
      </Text>
    </Pressable>
  ));
}

/** Insert (sc-3960): each token's word with its line; a menu at the Insert button on the iPad, a sheet with Cancel on the phone. */
export function InsertMenu({
  open,
  phone,
  at,
  opener,
  onInsert,
  onClose,
}: {
  open: boolean;
  phone: boolean;
  at: Anchored | null;
  opener: Opener;
  onInsert: (token: Token) => void;
  onClose: () => void;
}) {
  const frame = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tall, setTall] = useState(INSERT_GUESS);

  if (phone)
    return (
      <Sheet
        open={open}
        onClose={onClose}
        scrimLabel={W.cancel}
        opener={opener}
        testID="messages.insertSheet"
      >
        <SheetBody title={W.insert} close={W.cancel} onClose={onClose}>
          <View>
            <InsertRows role="button" inSheet onInsert={onInsert} />
          </View>
        </SheetBody>
      </Sheet>
    );

  // The Insert button sits at the composer's foot, so with no room under it the menu opens above it.
  const foot = (keyboardTopNow(0) ?? frame.height - Math.max(insets.bottom, tokens.spaceLg)) - GAP;
  const place =
    at != null && at.y + GAP + tall > foot
      ? { below: at.top - at.y - GAP - tall, floor: at.top - GAP }
      : { below: GAP, floor: null };

  return (
    <AnchoredMenu
      at={open ? at : null}
      onClose={onClose}
      opener={opener}
      width={INSERT_WIDTH}
      align="start"
      below={place.below}
      floor={place.floor}
      testID="messages.insertMenu"
    >
      <View onLayout={(event) => setTall(event.nativeEvent.layout.height + tokens.spaceXs * 2 + 2)}>
        <InsertRows role="menuitem" inSheet={false} onInsert={onInsert} />
      </View>
    </AnchoredMenu>
  );
}

/** Preview as: on the iPad a labelled box that opens a menu, as a select does; on the phone a row that opens a sheet. */
export function PreviewAsControl({
  person,
  phone,
  open,
  ref,
  onOpen,
}: {
  person: PreviewPerson;
  phone: boolean;
  open: boolean;
  ref: Ref<ViewInstance>;
  onOpen: () => void;
}) {
  const shown = optionOf(person);

  if (phone)
    return (
      <Row
        ref={ref}
        title={PW.previewAs}
        value={shown}
        opens
        onPress={onOpen}
        accessibilityLabel={`${PW.previewAs}, ${shown}`}
        accessibilityState={{ expanded: open }}
        testID="messages.previewAs"
      />
    );

  return (
    <View style={styles.select}>
      <EventField label={PW.previewAs}>
        <Pressable
          ref={ref}
          onPress={onOpen}
          style={({ pressed }) => [styles.box, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={PW.previewAs}
          accessibilityValue={{ text: shown }}
          accessibilityState={{ expanded: open }}
          testID="messages.previewAs"
        >
          <Text size={16} weight="medium" accessible={false} style={styles.grow}>
            {shown}
          </Text>
          <Glyph name="down" size={15} ink={tokens.colorInkSecondary} weight={2.4} />
        </Pressable>
      </EventField>
    </View>
  );
}

function AsChoices({
  shown,
  inSheet,
  shownRef,
  onPick,
}: {
  shown: PreviewKey;
  inSheet: boolean;
  shownRef: Ref<ViewInstance>;
  onPick: (who: PreviewKey) => void;
}) {
  return PREVIEW_AS.map((person) => {
    const on = person.key === shown;

    return (
      <Pressable
        key={person.key}
        ref={on ? shownRef : undefined}
        onPress={() => onPick(person.key)}
        style={({ pressed }) => [
          styles.option,
          inSheet ? styles.sheetRow : styles.menuRow,
          on && styles.lit,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={optionOf(person)}
        testID={`messages.previewAs.${person.key}`}
      >
        <Text size={16} weight="semibold" accessible={false} style={styles.grow}>
          {optionOf(person)}
        </Text>
        {on && <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.6} />}
      </Pressable>
    );
  });
}

/** Preview as's options: a menu under the box on the iPad, a sheet with Cancel on the phone; focus starts on the one shown. */
export function PreviewAsChooser({
  open,
  phone,
  at,
  shown,
  opener,
  onPick,
  onClose,
}: {
  open: boolean;
  phone: boolean;
  at: Anchor | null;
  shown: PreviewKey;
  opener: Opener;
  onPick: (who: PreviewKey) => void;
  onClose: () => void;
}) {
  const shownRef = useRef<ViewInstance>(null);

  useEffect(() => {
    if (!open) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(shownRef.current), 600);

    return () => clearTimeout(later);
  }, [open]);

  if (phone)
    return (
      <Sheet
        open={open}
        onClose={onClose}
        scrimLabel={W.cancel}
        opener={opener}
        testID="messages.previewAsSheet"
      >
        <SheetBody title={PW.previewAs} close={W.cancel} onClose={onClose}>
          <View>
            <AsChoices shown={shown} inSheet shownRef={shownRef} onPick={onPick} />
          </View>
        </SheetBody>
      </Sheet>
    );

  return (
    <AnchoredMenu
      at={open ? at : null}
      onClose={onClose}
      opener={opener}
      width={at?.width ?? SELECT_WIDTH}
      align="start"
      testID="messages.previewAsMenu"
    >
      <AsChoices shown={shown} inSheet={false} shownRef={shownRef} onPick={onPick} />
    </AnchoredMenu>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  line: { lineHeight: 14 * 1.4 },
  insertRow: {
    minHeight: 64,
    justifyContent: 'center',
    gap: tokens.spaceXxs,
    paddingVertical: tokens.spaceMd,
  },
  menuRow: { paddingHorizontal: tokens.spaceXl },
  sheetRow: {
    marginHorizontal: -tokens.spaceMd,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
  },
  rowPressed: { backgroundColor: tokens.colorInset },
  token: {
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderRadius: 7,
    backgroundColor: tokens.colorAccentTint,
  },
  select: { maxWidth: SELECT_WIDTH },
  box: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 14.5,
    paddingRight: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  lit: { backgroundColor: tokens.colorAccentTint },
});
