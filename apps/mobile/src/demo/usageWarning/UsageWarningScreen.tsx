import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bell } from '../../components/BellButton.tsx';
import { BellBody, BellFrame, BellMute, type BellRowData } from '../../components/BellParts.tsx';
import { QuietButton } from '../../components/Buttons.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import type { Anchor } from '../../components/Summary.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { Title } from '../../components/Title.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { measuredUnder } from '../measuredUnder.ts';
import { openOnceSettled } from '../menuSettles.ts';
import {
  ARRIVAL,
  EVENT_SAMPLE,
  type FeedItem,
  type UsageState,
  feedOf,
  langOf,
  said,
} from './usageRules.ts';

const MENU_AFTER_MS = 300;

/** sc-3931: the 80% and 100% usage warning in the bell (sc-83081), its own screen on a phone and the 380 popover under the bell on a tablet. Opening the item marks it read and opens nothing else: it carries no link (App Store 3.1.1, 3.1.3(f)). */
export function UsageWarningScreen({ state }: { state: UsageState }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const lang = langOf(state);
  const [items, setItems] = useState<readonly FeedItem[]>(() =>
    state === 'opened'
      ? feedOf(state).map((item, index) => (index === 0 ? { ...item, read: true } : item))
      : feedOf(state),
  );
  const [open, setOpen] = useState(true);
  const [at, setAt] = useState<Anchor | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState<string | null>(
    state === 'opened'
      ? 'Opened: the item is read and focus is still on it. Nothing else opened.'
      : null,
  );
  const heading = useRef<TextHandle>(null);
  const bellRef = useRef<ViewInstance>(null);
  const unread = items.filter((item) => !item.read).length;
  const played = items.some((item) => item.id === ARRIVAL.id);

  useEffect(() => {
    if (phone || !open) return undefined;
    return openOnceSettled(measuredUnder(bellRef), setAt, MENU_AFTER_MS);
  }, [phone, open]);

  const rows: BellRowData[] = items.map((item) => {
    if (item.warning == null)
      return {
        id: item.id,
        category: item.category,
        title: EVENT_SAMPLE.title,
        lines: EVENT_SAMPLE.lines,
        where: t('notifications.whereWhen', { event: EVENT_SAMPLE.event, when: item.when }),
        unread: !item.read,
        muted: false,
        more: {
          label: t('notifications.more', { title: EVENT_SAMPLE.title, event: EVENT_SAMPLE.event }),
          mute: <BellMute on={muted} onChange={setMuted} testID="demo.usage.mute" />,
        },
        goneShown: false,
        testID: `demo.usage.item.${item.id}`,
      };
    const words = said(item.warning, lang);

    return {
      id: item.id,
      category: item.category,
      title: words.heading,
      lines: words.lines,
      where: item.when,
      unread: !item.read,
      muted: false,
      more: null,
      goneShown: false,
      testID: `demo.usage.item.${item.id}`,
    };
  });

  function pick(row: BellRowData): void {
    setItems((now) => now.map((one) => (one.id === row.id ? { ...one, read: true } : one)));
    if (row.id === 'event') setDone('The event item opens its event, as on main.');
    else setDone('Opened: the item is read and focus is still on it. Nothing else opened.');
  }

  function play(): void {
    setItems((now) => [ARRIVAL, ...now]);
    if (ARRIVAL.warning != null)
      readOut(t('notifications.arrived', { title: said(ARRIVAL.warning, lang).heading }));
  }

  const demo = (
    <View style={styles.demo}>
      <DemoOnly
        title={
          done ??
          (state === 'live'
            ? 'Stand-in for the server. The arrival joins the top, the badge counts up and it is read out politely; focus and scroll stay where they are.'
            : lang === 'en'
              ? 'The warnings name Ire Events. In the app an item opens nothing: no link, button or web address.'
              : `${lang === 'fr' ? 'French' : 'Portuguese'} stand-in, about 30% longer and length only, with values formatted in ${lang}. l10n words it.`)
        }
      >
        {state === 'live' && (
          <QuietButton
            label="Play the arrival"
            off={played}
            onPress={play}
            testID="demo.usage.play"
          />
        )}
      </DemoOnly>
    </View>
  );

  const body = (
    <>
      <BellBody
        ask={null}
        feed="loaded"
        rows={rows}
        menu={menu}
        onMenu={setMenu}
        onPick={pick}
        onTryAgain={() => undefined}
        more={null}
        onSettings={() => setDone('Notification settings opens, as on main.')}
        testID="demo.usage.bell"
      />
      {demo}
    </>
  );

  const markAllRead = {
    off: unread === 0,
    onPress: () => {
      setItems((now) => now.map((item) => ({ ...item, read: true })));
      readOut(t('notifications.allRead'));
    },
    testID: 'demo.usage.markAll',
  };

  if (phone)
    return (
      <View style={styles.page}>
        <BellFrame
          where={{ kind: 'screen', open: true, back: t('notifications.back'), onBack: goBack }}
          heading={heading}
          refreshing={null}
          markAllRead={markAllRead}
          band={null}
          testID="demo.usage.screen"
        >
          {body}
        </BellFrame>
      </View>
    );

  return (
    <View style={[styles.page, styles.tablet, { paddingTop: insets.top + tokens.spaceXl }]}>
      <View style={styles.titleRow}>
        <View style={styles.fill}>
          <Title size={34} accessibilityRole="header">
            Events
          </Title>
        </View>
        <Bell
          ref={bellRef}
          unread={unread}
          onPress={() => setOpen(true)}
          testID="demo.usage.bellButton"
        />
      </View>
      <Text size={tokens.typeBodyPhone.size} muted>
        The page under the bell stands in for whichever page is open.
      </Text>
      <QuietButton label="Back to the demo" onPress={goBack} testID="demo.usage.back" />
      <BellFrame
        where={{
          kind: 'popover',
          at: open ? at : null,
          opener: bellRef,
          onClose: () => setOpen(false),
        }}
        heading={heading}
        refreshing={null}
        markAllRead={markAllRead}
        band={null}
        testID="demo.usage.popover"
      >
        {body}
      </BellFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  tablet: { gap: tokens.spaceXl, paddingHorizontal: tokens.space5xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  fill: { flex: 1 },
  demo: { paddingTop: tokens.spaceXl },
});
