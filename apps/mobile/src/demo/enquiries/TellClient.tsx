import { formattingLocale } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { AskLayer } from '../../components/AskLayer.tsx';
import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Field } from '../../components/Field.tsx';
import { DoneLine, SheetBody, SheetLayer } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Card, CardHead } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { TaskPage } from '../settings/Frame.tsx';
import { BookForm, Chips, ConsultationRow } from './Consultations.tsx';
import {
  CW,
  type Consultation,
  type Draft,
  type Panel,
  type Save,
  changeable,
  consultationOf,
  dayWords,
  draftOf,
  earliestFirst,
  mayEdit,
  timesWords,
} from './ConsultationsModel.ts';
import { PEOPLE } from './EnquiriesModel.ts';
import {
  type AsBooked,
  LANGUAGES,
  type Language,
  ORG,
  type Said,
  type Surface,
  TELL_BOARDS,
  TELL_NOW,
  TW,
  type TellStart,
  type TellState,
  type Way,
  asBooked,
  hrefOf,
  languageName,
  languageOf,
  messageOf,
  saidOf,
  tellStart,
  waysOf,
} from './TellClientModel.ts';

const SAVE_MS = 700;

function useLocale(): string {
  return formattingLocale('en', getLocales()[0]?.languageTag);
}

/** /demo/tell-client (sc-37133): Tell {client} on a consultation's row, its panel, and the offer after a save. */
export function TellClient({ state }: { state: TellState }) {
  const start = tellStart(state);

  if (start.free) return <FreeOrganisation />;

  return <EnquiryWithTell start={start} state={state} />;
}

type Layer =
  | Surface
  | { kind: 'book'; panel: Extract<Panel, { kind: 'book' }> }
  | { kind: 'cancel'; consultation: Consultation };

function EnquiryWithTell({ start, state }: { start: TellStart; state: TellState }) {
  const shell = useShell();
  const locale = useLocale();
  const [list, setList] = useState<Consultation[]>(start.list);
  const [booked, setBooked] = useState<Record<string, AsBooked>>(start.booked);
  const [layer, setLayer] = useState<Layer>(start.surface);
  const [save, setSave] = useState<Save>('idle');
  const arrivedTell = useRef<ViewInstance>(null);
  const edits = mayEdit(start.enquiry, start.viewer);
  const manages = start.viewer.role !== 'member';
  const client = start.enquiry.client;
  const docked = shell.layout === 'landscape' && layer.kind !== 'none' && layer.kind !== 'cancel';
  const board = TELL_BOARDS.find((one) => one.state === state);

  useEffect(() => {
    if (start.arrived != null) moveScreenReaderFocus(arrivedTell.current);
  }, [start.arrived]);

  const close = () => setLayer({ kind: 'none' });
  const finish = (after: () => void) => {
    setSave('saving');
    setTimeout(() => {
      setSave('idle');
      after();
    }, SAVE_MS);
  };
  const openBook = (change: Consultation | null) =>
    setLayer({
      kind: 'book',
      panel: {
        kind: 'book',
        change,
        draft: draftOf(change, start.enquiry, start.viewer),
        touched: false,
        pressed: false,
      },
    });
  const book = (draft: Draft, change: Consultation | null) => {
    const made = consultationOf(draft, change?.id ?? `con-${Date.now()}`);

    if (made == null) return;
    finish(() => {
      const before = change == null ? asBooked(made) : (booked[made.id] ?? asBooked(change));

      setList((now) =>
        change == null ? [...now, made] : now.map((one) => (one.id === change.id ? made : one)),
      );
      setBooked((now) => ({ ...now, [made.id]: before }));
      setLayer({ kind: 'offer', id: made.id, said: saidOf(made, before, TELL_NOW) ?? 'booked' });
    });
  };
  const found = (id: string) => list.find((one) => one.id === id) ?? null;

  const surface =
    layer.kind === 'book' ? (
      <BookForm
        key={layer.panel.change?.id ?? 'new'}
        panel={layer.panel}
        start={start}
        save={save}
        onClose={close}
        onBook={book}
        now={TELL_NOW}
      />
    ) : layer.kind === 'tell' && found(layer.id) != null ? (
      <TellPanel
        consultation={found(layer.id) as Consultation}
        said={
          saidOf(
            found(layer.id) as Consultation,
            booked[layer.id] ?? asBooked(found(layer.id) as Consultation),
            TELL_NOW,
          ) ?? 'booked'
        }
        start={start}
        onClose={close}
      />
    ) : layer.kind === 'offer' && found(layer.id) != null ? (
      <Offer
        consultation={found(layer.id) as Consultation}
        said={layer.said}
        client={client}
        locale={locale}
        onTell={() => setLayer({ kind: 'tell', id: layer.id })}
        onDone={close}
      />
    ) : null;

  return (
    <View style={styles.fill}>
      <View style={styles.split}>
        <View style={styles.fill}>
          <TaskPage
            back={{ label: 'Enquiries', onPress: () => router.back() }}
            title={client}
            sub="Open"
          >
            {start.arrived != null && (
              <View style={styles.arrived}>
                <Glyph name="bell" size={18} ink={tokens.colorInk} weight={2.2} />
                <Text size={15} weight="medium" style={styles.grow}>
                  {TW.fromNotification(start.arrived.words)}
                </Text>
              </View>
            )}
            {!edits && (
              <View style={styles.readOnly}>
                <Glyph name="eye" size={18} ink={tokens.colorInk} weight={2.2} />
                <Text size={15} weight="medium" style={styles.grow}>
                  {CW.readOnly(PEOPLE.folake.name)}
                </Text>
              </View>
            )}
            <Card>
              <CardHead title={CW.consultations} />
              {earliestFirst(list).map((one, index) => {
                const said = saidOf(one, booked[one.id] ?? asBooked(one), TELL_NOW);
                const lit = start.arrived?.id === one.id;

                return (
                  <View key={one.id} style={lit && styles.lit}>
                    <ConsultationRow
                      consultation={one}
                      list={list}
                      first={index === 0 || lit}
                      locale={locale}
                      edits={edits}
                      manages={manages}
                      now={TELL_NOW}
                      onChange={() => openBook(one)}
                      onCancel={() => setLayer({ kind: 'cancel', consultation: one })}
                      tell={
                        said == null ? null : (
                          <View style={styles.tellRow}>
                            <SecondaryButton
                              ref={lit ? arrivedTell : undefined}
                              label={TW.tell(client)}
                              onPress={() => setLayer({ kind: 'tell', id: one.id })}
                              testID={`tell.open.${one.id}`}
                            />
                          </View>
                        )
                      }
                    />
                  </View>
                );
              })}
              {edits && (
                <SecondaryButton
                  label={CW.book}
                  onPress={() => openBook(null)}
                  testID="tell.book"
                />
              )}
            </Card>
            <DemoOnly title={board == null ? CW.demoPage : `${board.title}: ${board.what}`}>
              {start.note != null && (
                <Text size={14} weight="medium" style={styles.secondary}>
                  {start.note}
                </Text>
              )}
              <Text size={14} weight="medium" style={styles.secondary}>
                {TW.pressNotSeen}
              </Text>
              <Text size={14} weight="medium" style={styles.secondary}>
                {TW.proposal}
              </Text>
            </DemoOnly>
          </TaskPage>
        </View>
        {docked && <View style={styles.dock}>{surface}</View>}
      </View>
      {!docked && surface != null && (
        <SheetLayer onClose={close} label={TW.close}>
          {surface}
        </SheetLayer>
      )}
      {layer.kind === 'cancel' && (
        <AskLayer
          title={CW.cancelTitle}
          line={CW.cancelLine(
            dayWords(layer.consultation, locale),
            timesWords(layer.consultation, locale),
          )}
          keep={{ label: CW.keepIt, off: save === 'saving', testID: 'tell.keep' }}
          confirm={{
            label: CW.cancelIt,
            removes: true,
            busy: save === 'saving' ? CW.saving : undefined,
            busyWords: CW.saving,
            testID: 'tell.cancelIt',
          }}
          onKeep={close}
          onConfirm={() =>
            finish(() => {
              const id = layer.consultation.id;

              setList((now) =>
                now.map((one) => (one.id === id ? { ...one, cancelled: true } : one)),
              );
              setLayer(
                changeable(layer.consultation, TELL_NOW)
                  ? { kind: 'offer', id, said: 'cancelled' }
                  : { kind: 'none' },
              );
            })
          }
          testID="tell.cancelAsk"
        />
      )}
    </View>
  );
}

const SAVED: Record<Said, string> = {
  booked: CW.booked,
  changed: CW.changed,
  cancelled: CW.cancelledSaid,
};

/** Straight after a save: what was saved, and Tell {client} as the next step. Leaving keeps the save. */
function Offer({
  consultation,
  said,
  client,
  locale,
  onTell,
  onDone,
}: {
  consultation: Consultation;
  said: Said;
  client: string;
  locale: string;
  onTell: () => void;
  onDone: () => void;
}) {
  return (
    <SheetBody title={SAVED[said]} close={TW.close} onClose={onDone} closeTestID="tell.offer.close">
      <DoneLine text={SAVED[said]} reads />
      <Text
        size={15}
        weight="medium"
        style={[styles.secondary, said === 'cancelled' && styles.struck]}
      >
        {`${dayWords(consultation, locale)} · ${timesWords(consultation, locale)} · ${CW.how[consultation.how]}`}
      </Text>
      <Text size={16} weight="semibold">
        {TW.offerLine[said](client)}
      </Text>
      <PrimaryButton label={TW.tell(client)} onPress={onTell} testID="tell.offer.tell" />
      <QuietButton label={TW.done} onPress={onDone} testID="tell.offer.done" />
    </SheetBody>
  );
}

function TellPanel({
  consultation,
  said,
  start,
  onClose,
}: {
  consultation: Consultation;
  said: Said;
  start: TellStart;
  onClose: () => void;
}) {
  const { i18n } = useTranslation();
  const phone = useShell().layout === 'phone';
  const [language, setLanguage] = useState<Language>(start.language ?? languageOf(i18n.language));
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>(start.copied ? 'yes' : 'no');
  const [opened, setOpened] = useState<string | null>(null);
  const client = start.enquiry.client;
  const message = messageOf(consultation, said, client, ORG, language, TELL_NOW);
  const ways = waysOf(start.reach, start.device);

  const copy = async () => {
    setCopied('no');
    try {
      await setStringAsync(message.body);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  };
  const press = (way: Way) => {
    if (way === 'copy') {
      void copy();

      return;
    }
    setOpened(hrefOf(way, start.reach, message));
  };

  return (
    <SheetBody
      title={TW.tell(client)}
      close={TW.close}
      onClose={onClose}
      closeTestID="tell.panel.close"
    >
      <Field label={TW.language}>
        <Chips
          items={LANGUAGES.map((one) => ({ key: one, title: languageName(one) }))}
          on={language}
          onPick={(one) => {
            setLanguage(one);
            setCopied('no');
            setOpened(null);
          }}
          testID="tell.language"
        />
      </Field>
      <Field label={TW.message}>
        <View style={styles.preview}>
          <Text size={16} weight="medium" selectable testID="tell.message">
            {message.body}
          </Text>
        </View>
      </Field>
      <View style={styles.ways}>
        {ways.map((way) => (
          <View key={way} style={styles.way}>
            <WayPill
              way={way}
              phone={phone}
              label={TW.ways[way]}
              accessibilityLabel={TW.named[way](client)}
              onPress={() => press(way)}
            />
            {way === 'email' && (
              <Text size={14} weight="medium" style={styles.secondary}>
                {TW.subject(message.subject)}
              </Text>
            )}
            {way === 'copy' && copied === 'yes' && (
              <ReadOut words={TW.copied} style={styles.inline}>
                <Glyph name="tick" size={16} ink={tokens.marks.done.fill} weight={2.6} />
                <Text size={15} weight="semibold">
                  {TW.copied}
                </Text>
              </ReadOut>
            )}
            {way === 'copy' && copied === 'failed' && (
              <ReadOut words={TW.notCopied} style={styles.inline}>
                <Glyph name="warn" size={16} ink={tokens.colorAttentionText} weight={2.4} />
                <Text size={15} weight="medium" style={[styles.grow, styles.attention]}>
                  {TW.notCopied}
                </Text>
              </ReadOut>
            )}
          </View>
        ))}
      </View>
      {opened != null && (
        <DemoOnly title={TW.wouldOpen}>
          <Text size={14} weight="medium" selectable style={styles.secondary} testID="tell.href">
            {opened}
          </Text>
        </DemoOnly>
      )}
    </SheetBody>
  );
}

/** A stacked full-width pill: 48 tall at phone width, 44 elsewhere. The two that leave Soirely carry sc-3627's outward mark. */
function WayPill({
  way,
  phone,
  label,
  accessibilityLabel,
  onPress,
}: {
  way: Way;
  phone: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const leaves = way !== 'copy';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        phone ? styles.pillPhone : styles.pillWide,
        pressed && styles.pressed,
      ]}
      accessibilityRole={leaves ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel}
      testID={`tell.way.${way}`}
    >
      {way === 'copy' && <Glyph name="copy" size={18} ink={tokens.colorInk} weight={2.2} />}
      <Text size={tokens.typeButton.size} weight="semibold">
        {label}
      </Text>
      {leaves && <Outward />}
    </Pressable>
  );
}

/** sc-3627's outward mark: it leaves Soirely. Beside words that say where, so hidden. */
function Outward() {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tokens.colorInkSecondary}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M15 3h6v6" />
      <Path d="M10 14 21 3" />
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Svg>
  );
}

function FreeOrganisation() {
  return (
    <TaskPage title="Events">
      <DemoOnly title="A Free organisation">
        <Text size={14} weight="medium" style={styles.secondary}>
          {TW.free}
        </Text>
      </DemoOnly>
    </TaskPage>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  split: { flex: 1, flexDirection: 'row' },
  dock: {
    width: 400,
    borderLeftWidth: 1,
    borderLeftColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  struck: { textDecorationLine: 'line-through' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  readOnly: {
    flexDirection: 'row',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorNeutralFill,
  },
  arrived: {
    flexDirection: 'row',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  lit: {
    marginHorizontal: -tokens.spaceMd,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    borderWidth: 2,
    borderColor: tokens.colorAccent,
  },
  tellRow: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: tokens.spaceXs },
  preview: {
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  ways: { gap: tokens.spaceMd },
  way: { gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  pillPhone: {
    minHeight: tokens.sizeHitPhonePrimary,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
  },
  pillWide: { minHeight: tokens.sizeHit, borderRadius: tokens.sizeHit / 2 },
  pressed: { opacity: 0.6 },
});
