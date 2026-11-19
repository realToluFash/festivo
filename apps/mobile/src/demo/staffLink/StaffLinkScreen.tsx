import { setStringAsync } from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DestructiveButton,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
} from '../../components/Buttons.tsx';
import { Spinner } from '../../components/CalendarControls.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Sheet, SheetActions } from '../../components/Sheet.tsx';
import { ShapeMark } from '../../components/StatusMark.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  ISSUE_MS,
  type LinkState,
  type LinkStatus,
  PERSON,
  SAMPLE_LINK,
  W,
  WORDS,
  askReplace,
  backFromShare,
  copiedNow,
  copyRefused,
  linkStateOf,
  markSent,
  notIssued,
  notYet,
  offersMarkSent,
  offersReplace,
  pressed,
  replace,
  seed,
  trailLine,
} from './StaffLinkModel.ts';

export function StaffLinkRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const name = linkStateOf(params.state);

  return <StaffLink key={name} start={name} />;
}

function issue(fails: boolean): Promise<string> {
  return new Promise((resolve, reject) =>
    setTimeout(() => (fails ? reject(new Error('503')) : resolve(SAMPLE_LINK)), ISSUE_MS),
  );
}

function StaffLink({ start }: { start: ReturnType<typeof linkStateOf> }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<LinkState>(() => seed(start));
  const [said, setSaid] = useState(0);
  const replaceOpener = useRef<ViewInstance | null>(null);
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';

  function apply(next: LinkState): void {
    setS(next);
    setSaid((n) => n + 1);
  }

  useEffect(() => {
    if (said === 0 || s.say === '') return;

    return readOut(s.say);
  }, [said, s.say]);

  async function share(): Promise<void> {
    if (s.busy != null) return;
    const busy = pressed(s, 'share');
    apply(busy);
    let url: string;
    try {
      url = await issue(s.issueFails);
    } catch {
      apply(notIssued(busy));
      return;
    }
    await Share.share({ message: url }).catch(() => undefined);
    apply(backFromShare(busy));
  }

  async function copy(): Promise<void> {
    if (s.busy != null) return;
    const busy = pressed(s, 'copy');
    apply(busy);
    let url: string;
    try {
      url = await issue(s.issueFails);
    } catch {
      apply(notIssued(busy));
      return;
    }
    const held = await setStringAsync(url).then(
      () => false,
      () => true,
    );
    apply(held ? copyRefused(busy) : copiedNow(busy));
  }

  const person = (
    <View style={styles.header}>
      <Text size={30} weight="bold" accessibilityRole="header">
        {PERSON.name}
      </Text>
      <Text size={16} weight="medium" style={styles.secondary}>
        {`${PERSON.job} · ${PERSON.shift}`}
      </Text>
    </View>
  );

  const status = (
    <View style={styles.card} testID="staffLink.status">
      <Text size={13} weight="semibold" style={styles.kicker}>
        {W.link.toUpperCase()}
      </Text>
      <View style={styles.statusRow}>
        <StatusShape status={s.status} />
        <Text size={17} weight="semibold">
          {WORDS[s.status]}
        </Text>
      </View>
      {trailLine(s.status, s.trail) != null && (
        <Text size={15} style={styles.secondary}>
          {trailLine(s.status, s.trail)}
        </Text>
      )}
      <Text size={15} style={styles.secondary}>
        {W.help}
      </Text>
    </View>
  );

  const actions = (
    <View style={styles.actions}>
      {s.failed && (
        <View style={styles.failed} accessibilityRole="alert" testID="staffLink.failed">
          <Glyph name="alert" size={18} ink={tokens.colorBrokenText} />
          <Text size={16} weight="semibold" style={styles.broken}>
            {W.notIssued}
          </Text>
        </View>
      )}
      {s.asking && (
        <View style={styles.ask} testID="staffLink.ask">
          <Text size={17} weight="bold" accessibilityRole="header">
            {W.didYouSend(PERSON.first)}
          </Text>
          <Text size={15} style={styles.secondary}>
            {W.didYouSendLine}
          </Text>
          <View style={phone ? styles.stack : styles.row}>
            <PrimaryButton
              label={W.markSent}
              onPress={() => apply(markSent(s))}
              paired={!phone}
              testID="staffLink.ask.sent"
            />
            <QuietButton
              label={W.notYet}
              onPress={() => apply(notYet(s))}
              inset={!phone}
              testID="staffLink.ask.notYet"
            />
          </View>
        </View>
      )}
      <PrimaryButton
        label={W.share}
        busy={s.busy === 'share'}
        onPress={() => void share()}
        testID="staffLink.share"
      />
      <View>
        <SecondaryButton
          label={W.copy}
          off={s.busy === 'copy'}
          onPress={() => void copy()}
          testID="staffLink.copy"
        />
        {s.busy === 'copy' && (
          <View style={styles.issuing} pointerEvents="none" testID="staffLink.copy.spinner">
            <Spinner />
          </View>
        )}
      </View>
      {offersMarkSent(s) && (
        <SecondaryButton
          label={W.markSent}
          onPress={() => apply(markSent(s))}
          testID="staffLink.markSent"
        />
      )}
      {offersReplace(s) && (
        <QuietButton
          ref={replaceOpener}
          label={W.replaceOpen}
          onPress={() => apply(askReplace(s, true))}
          testID="staffLink.replace"
        />
      )}
    </View>
  );

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          phone ? styles.bodyPhone : styles.bodyTablet,
          { paddingBottom: insets.bottom + 96 },
        ]}
      >
        <View style={phone ? undefined : landscape ? styles.wide : styles.column}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            style={styles.back}
            testID="staffLink.back"
          >
            <Text size={16} weight="semibold" style={styles.accent}>
              Roster
            </Text>
          </Pressable>
          {landscape ? (
            <View style={styles.sides}>
              <View style={styles.sideMain}>
                {person}
                {status}
              </View>
              <View style={styles.sidePanel}>{actions}</View>
            </View>
          ) : (
            <View style={styles.list}>
              {person}
              {status}
              {actions}
            </View>
          )}
          <DemoOnly title="Demo only: the board’s switches">
            <SecondaryButton
              label="Start again"
              onPress={() => setS(seed(start))}
              testID="staffLink.demo.reset"
            />
            <SecondaryButton
              label={s.issueFails ? 'No link is issued · on' : 'No link is issued (no connection)'}
              onPress={() => setS({ ...s, issueFails: !s.issueFails })}
              testID="staffLink.demo.fails"
            />
            <SecondaryButton
              label="Ada opens the link"
              onPress={() => setS({ ...s, status: 'opened', trail: { by: '', at: '19:20' } })}
              testID="staffLink.demo.opened"
            />
          </DemoOnly>
        </View>
      </ScrollView>
      <Sheet
        open={s.replacing}
        onClose={() => apply(askReplace(s, false))}
        scrimLabel={W.keep}
        opener={replaceOpener}
        docked
        testID="staffLink.replaceSheet"
      >
        <View style={styles.confirm}>
          <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
            {W.replaceTitle(PERSON.first)}
          </Text>
          <Text size={tokens.typeBodyPhone.size}>{W.replaceLine}</Text>
          <SheetActions>
            {phone ? (
              <>
                <DestructiveButton
                  label={W.replace}
                  onPress={() => apply(replace(s))}
                  testID="staffLink.replace.go"
                />
                <QuietButton
                  label={W.keep}
                  onPress={() => apply(askReplace(s, false))}
                  testID="staffLink.replace.keep"
                />
              </>
            ) : (
              <>
                <QuietButton
                  label={W.keep}
                  onPress={() => apply(askReplace(s, false))}
                  testID="staffLink.replace.keep"
                />
                <DestructiveButton
                  label={W.replace}
                  onPress={() => apply(replace(s))}
                  stacked={false}
                  testID="staffLink.replace.go"
                />
              </>
            )}
          </SheetActions>
        </View>
      </Sheet>
      {s.toast !== '' && (
        <PageToast
          words={s.toast}
          onClose={() => setS({ ...s, toast: '' })}
          bottom={insets.bottom + tokens.spaceXl}
        />
      )}
    </View>
  );
}

/** Each status a shape with its word: a dashed ring, a half ring, a ring, a filled tick. */
function StatusShape({ status }: { status: LinkStatus }) {
  if (status === 'none')
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.dashed}
      />
    );
  const kind = status === 'opened' ? 'yes' : status === 'sent' ? 'notyet' : 'waiting';

  return <ShapeMark kind={kind} side={16} ink={tokens.colorAccent} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { gap: tokens.spaceLg },
  bodyPhone: { padding: tokens.spaceLg },
  bodyTablet: { padding: tokens.spaceXl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, gap: tokens.spaceLg },
  wide: { width: '100%', maxWidth: 960, gap: tokens.spaceLg },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText, flexShrink: 1 },
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.6 },
  header: { gap: tokens.spaceXs },
  list: { gap: tokens.spaceLg },
  sides: { flexDirection: 'row', gap: tokens.spaceXl, alignItems: 'flex-start' },
  sideMain: { flex: 1, minWidth: 0, gap: tokens.spaceLg },
  sidePanel: { width: 360 },
  card: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  dashed: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkSecondary,
  },
  actions: { gap: tokens.spaceMd },
  issuing: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: tokens.spaceLg,
    justifyContent: 'center',
  },
  failed: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  ask: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorAccentTint,
    borderWidth: 1,
    borderColor: tokens.colorAccentTintBorder,
  },
  stack: { gap: tokens.spaceSm },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd, flexWrap: 'wrap' },
  confirm: { flexShrink: 1, gap: tokens.spaceLg, padding: tokens.space3xl },
});
