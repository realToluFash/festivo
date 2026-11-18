import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventNotice } from '../../components/EventNotice.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Back, Card, Pill } from '../../components/SettingsParts.tsx';
import { StatusMark } from '../../components/StatusMark.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { CREATED_ID, NewEventScreen } from '../events/NewEvent.tsx';
import { ORG_DEFAULTS } from '../events/NewEventModel.ts';
import { currencyRows } from '../events/EventsSample.ts';
import { openEvent } from '../events/openEvent.ts';
import { TaskPage } from '../settings/Frame.tsx';
import { W } from './EnquiryEventWords.ts';
import {
  EVENT_ENQUIRIES,
  type EventEnquiry,
  FORM_ENQUIRY,
  type FormState,
  type PageState,
  eventEnquiryOf,
  filledFrom,
  fromEnquiry,
} from './EnquiryToEventModel.ts';

const OFFERED: readonly string[] = currencyRows('').map((row) => row.code);

type Shown = 'open' | 'won' | 'lost';

/** An enquiry's page with sc-31232's parts: Create event, the Member's line, Won and its event, and Reopen refused once it has one. */
export function EnquiryEventPage({
  id,
  state,
  form,
}: {
  id: string | undefined;
  state: PageState;
  form: FormState | null;
}) {
  const enquiry = form == null ? eventEnquiryOf(id) : EVENT_ENQUIRIES[FORM_ENQUIRY[form]];
  const back = { label: W.enquiries, onPress: () => router.back() };

  if (enquiry == null)
    return (
      <TaskPage back={back} title={W.enquiries}>
        <Text size={16} weight="medium">
          {W.notInSample}
        </Text>
      </TaskPage>
    );

  return <Page enquiry={enquiry} state={state} form={form} onBack={back.onPress} />;
}

function Page({
  enquiry,
  state,
  form,
  onBack,
}: {
  enquiry: EventEnquiry;
  state: PageState;
  form: FormState | null;
  onBack: () => void;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const [stale, setStale] = useState(false);
  const [making, setMaking] = useState(form == null ? 0 : 1);
  const [newOpen, setNewOpen] = useState(form != null);
  const opener = useRef<ViewInstance>(null);
  const filling = useMemo(
    () => fromEnquiry(enquiry, OFFERED, ORG_DEFAULTS, making === 1 ? form : null),
    [enquiry, form, making],
  );
  const landscape = shell.layout === 'landscape';
  const tablet = shell.layout !== 'phone';
  const shown: Shown =
    state === 'won' || state === 'won-has-event' ? (stale ? 'lost' : 'won') : 'open';
  const creates = state === 'open-admin' || state === 'event-deleted';
  const event = filledFrom(enquiry, OFFERED, ORG_DEFAULTS).name;
  const tellOwn = (what: string) => shell.tell(W.ownDesign(what));
  const create = () => {
    setMaking((times) => times + 1);
    setNewOpen(true);
  };

  const createButton = (height: number, full: boolean) => (
    <Pill
      ref={opener}
      label={W.createEvent}
      onPress={create}
      height={height}
      full={full}
      testID="enquiryEvent.create"
    />
  );
  const closeButton = (height: number, full: boolean) => (
    <Pill
      label={W.closeAsLost}
      kind="secondary"
      onPress={() => tellOwn(W.closeAsLost)}
      height={height}
      full={full}
      testID="enquiryEvent.closeAsLost"
    />
  );
  const notice: ReactNode =
    state === 'won-has-event' && !stale ? (
      <EventNotice tone="broken" words={W.notReopened} />
    ) : state === 'event-deleted' ? (
      <EventNotice tone="quiet" words={W.eventDeleted} />
    ) : null;
  const card: ReactNode =
    shown === 'won' ? (
      <Card gap={tokens.spaceXs}>
        <Text size={17} weight="bold" accessibilityRole="header">
          {W.won}
        </Text>
        <TextAction
          label={W.became(event)}
          after="chevron"
          wraps
          onPress={() => openEvent(CREATED_ID, { state: 'from-enquiry' })}
          testID="enquiryEvent.won.event"
        />
      </Card>
    ) : shown === 'lost' ? (
      <Card gap={tokens.spaceLg}>
        <Text size={17} weight="bold" accessibilityRole="header">
          {W.lost}
        </Text>
        <Pill
          label={W.reopen}
          kind="secondary"
          height={tokens.sizeHit}
          full={false}
          onPress={() => setStale(false)}
          testID="enquiryEvent.reopen"
        />
      </Card>
    ) : null;

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          styles.task,
          tablet && styles.tablet,
          {
            paddingTop: insets.top + tokens.spaceXl,
            paddingBottom: insets.bottom + tokens.space6xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Back label={W.enquiries} onPress={onBack} />
        <View style={[styles.head, landscape && styles.headRow]}>
          <View style={styles.headWords}>
            <Text
              size={tablet ? 36 : 30}
              weight="bold"
              accessibilityRole="header"
              style={styles.title}
            >
              {enquiry.client}
            </Text>
            <StatusMark
              tone={shown === 'won' ? 'done' : shown === 'lost' ? 'skipped' : 'progress'}
              word={shown === 'won' ? W.won : shown === 'lost' ? W.lost : W.open}
            />
          </View>
          {landscape && shown === 'open' && (
            <View style={styles.headActions}>
              {closeButton(tokens.sizeHit, false)}
              {creates && createButton(tokens.sizeHit, false)}
            </View>
          )}
        </View>
        {!landscape && creates && createButton(tokens.sizeHitPhonePrimary, true)}
        {state === 'open-member' && (
          <View style={styles.memberLine}>
            <View style={styles.glyph}>
              <Glyph name="info" size={18} ink={tokens.colorInkSecondary} />
            </View>
            <Text size={15} weight="medium" style={[styles.secondary, styles.grow]}>
              {W.memberLine}
            </Text>
          </View>
        )}
        {notice}
        {card}
        <DemoOnly title={W.restOfPage}>{null}</DemoOnly>
        {state === 'won-has-event' && !stale && (
          <DemoOnly title={W.staleDemo}>
            <TextAction
              label={W.pressReopen}
              onPress={() => setStale(true)}
              testID="enquiryEvent.demo.stale"
            />
          </DemoOnly>
        )}
        {!landscape && shown === 'open' && closeButton(tokens.sizeHitPhonePrimary, true)}
      </ScrollView>
      {making > 0 && (
        <NewEventScreen
          key={making}
          open={newOpen}
          start={filling.start}
          from={filling.from}
          locale={locale}
          opener={opener}
          onClose={() => setNewOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  task: { paddingHorizontal: tokens.space3xl, gap: tokens.spaceXl },
  tablet: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  head: { gap: tokens.spaceLg, paddingTop: tokens.spaceMd, paddingBottom: tokens.spaceSm },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headWords: { flex: 1, minWidth: 0, gap: tokens.spaceMd },
  headActions: { flexDirection: 'row', gap: tokens.spaceSm, paddingTop: tokens.spaceXs },
  title: { letterSpacing: -0.5 },
  memberLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  secondary: { color: tokens.colorInkSecondary, lineHeight: 15 * 1.4 },
  glyph: { paddingTop: 1.5 },
  grow: { flex: 1, minWidth: 0 },
});
