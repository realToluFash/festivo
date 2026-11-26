import { setStringAsync } from 'expo-clipboard';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { NoteBox } from '../../components/EventEdits.tsx';
import { Field, TextField } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { ListPicker } from '../../components/ListPicker.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Sheet, SheetActions } from '../../components/Sheet.tsx';
import { Skeleton } from '../../components/Skeleton.tsx';
import { ShapeMark } from '../../components/StatusMark.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { StatusShape } from '../staffLink/StaffLinkScreen.tsx';
import type { OnRoster } from '../staffLink/StaffRosterModel.ts';
import {
  type Brief,
  type BriefingStart,
  type BriefingState,
  type Check,
  type Person,
  type Side,
  BW,
  ISSUE_MS,
  SAMPLE_LINK,
  afterBriefCopy,
  afterBriefMark,
  briefingStart,
  checkOf,
  countLine,
  dueAll,
  dueChanged,
  fitRules,
  noMobileFor,
  noteOf,
  onShift,
  resultLines,
  sendTo,
  tallyOf,
} from './briefingModel.ts';

const BRIEFS: readonly Brief[] = ['read', 'sent', 'changed', 'none'];

export interface BriefingParts {
  card: ReactNode;
  row: (one: OnRoster) => { words: string; below: ReactNode; after: ReactNode } | null;
  panels: ReactNode;
  demo: ReactNode;
  restart: () => void;
}

const NO_BRIEF = { brief: 'none', heldText: false, channel: 'sms', briefCopy: null } as const;

type Extra = Pick<Person, 'brief' | 'heldText' | 'channel' | 'briefCopy'>;

function extrasOf(people: readonly Person[]): Record<string, Extra> {
  return Object.fromEntries(
    people.map((one) => [
      one.id,
      { brief: one.brief, heldText: one.heldText, channel: one.channel, briefCopy: one.briefCopy },
    ]),
  );
}

/** The briefing on the roster on a tablet (sc-3917): the card above it, its mark and buttons on each row, and its panels docked on a tablet on its side, centred upright. The roster keeps each row's link status; a briefing copy or send hands its change back through `hold`. */
export function useBriefing(
  state: BriefingState | null,
  first: BriefingStart | null,
  roster: readonly OnRoster[],
  hold: (next: Person[]) => void,
): BriefingParts | null {
  const [opening] = useState(() => first ?? briefingStart('populated'));
  const [extras, setExtras] = useState(() => extrasOf(opening.people));
  const [side, setSide] = useState<Side>(opening.side);
  const [rules, setRules] = useState(opening.rules);
  const [draft, setDraft] = useState<string>(opening.draft ?? opening.rules);
  const [cut, setCut] = useState(opening.cut);
  const [saved, setSaved] = useState(opening.saved);
  const [busy, setBusy] = useState(opening.busy);
  const [missed, setMissed] = useState(opening.missed);
  const [handHeld, setHandHeld] = useState(opening.handHeld);
  const [checkAt, setCheckAt] = useState(opening.checkAt);
  const [stuck, setStuck] = useState(opening.checkAt === 'loading');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [result, setResult] = useState(opening.result);
  const [clipFails, setClipFails] = useState(opening.copy === 'refused');
  const [toast, setToast] = useState<string | null>(null);
  const opener = useRef<ViewInstance | null>(null);
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (side?.kind !== 'check' || checkAt !== 'loading' || stuck) return undefined;
    const timer = setTimeout(() => setCheckAt('shown'), ISSUE_MS);
    return () => clearTimeout(timer);
  }, [side, checkAt, stuck]);

  if (state == null || first == null) return null;

  if (kind === 'phone')
    return {
      card: (
        <DemoOnly title="Demo only: no phone frame">
          <Text size={15}>
            The briefing is drawn for the web and the tablets (sc-3917). Open this link on a tablet.
          </Text>
        </DemoOnly>
      ),
      row: () => null,
      panels: null,
      demo: null,
      restart: () => undefined,
    };

  const people: Person[] = roster.map((one) => ({ ...one, ...(extras[one.id] ?? NO_BRIEF) }));
  const manage = first.access === 'manage';
  const acts = manage && !first.finished;
  const sends = acts && first.live;
  const all = dueAll(people);
  const changed = dueChanged(people);
  const tally = tallyOf(people);
  const shown = (id: string) => people.find((one) => one.id === id) as Person;

  function commit(next: Person[]) {
    setExtras(extrasOf(next));
    hold(next);
  }

  function restart() {
    const fresh = briefingStart(state as BriefingState);
    setExtras(extrasOf(fresh.people));
    setSide(fresh.side);
    setRules(fresh.rules);
    setDraft(fresh.draft ?? fresh.rules);
    setCut(fresh.cut);
    setSaved(fresh.saved);
    setBusy(fresh.busy);
    setMissed(fresh.missed);
    setHandHeld(fresh.handHeld);
    setCheckAt(fresh.checkAt);
    setStuck(fresh.checkAt === 'loading');
    setSending(false);
    setSendFailed(false);
    setResult(fresh.result);
    setClipFails(fresh.copy === 'refused');
    setToast(null);
  }

  function say(words: string, shownToo = false) {
    readOut(words);
    if (shownToo) setToast(words);
  }

  function open(next: Side) {
    setSaved(false);
    setCut(false);
    if (next?.kind === 'check') {
      setStuck(false);
      setSendFailed(false);
      setCheckAt('loading');
    }
    setSide(next);
  }

  function change(id: string, to: (one: Person) => Person) {
    commit(people.map((one) => (one.id === id ? to(one) : one)));
  }

  async function copy(id: string) {
    if (busy != null) return;
    setBusy(id);
    setMissed(null);
    if (handHeld?.id === id) setHandHeld(null);
    if (first?.copy === 'slow') return;
    await new Promise((resolve) => setTimeout(resolve, ISSUE_MS));
    if (first?.copy === 'notIssued') {
      setBusy(null);
      setMissed(id);
      say(BW.notCopied);
      return;
    }
    const refused =
      clipFails ||
      (await setStringAsync(SAMPLE_LINK).then(
        () => false,
        () => true,
      ));
    setBusy(null);
    change(id, afterBriefCopy);
    if (!refused) {
      say(BW.copied, true);
      return;
    }
    setHandHeld({ id, url: SAMPLE_LINK });
    say(BW.refused);
  }

  function mark(id: string) {
    change(id, afterBriefMark);
    if (handHeld?.id === id) setHandHeld(null);
    say(BW.marked(shown(id).name), true);
  }

  const target = side?.kind === 'check' ? side.target : null;
  const due =
    target == null
      ? []
      : target === 'all'
        ? all
        : target === 'changed'
          ? changed
          : people.filter((one) => one.id === target);
  const costs = target == null ? null : checkOf(due, noMobileFor(people, target), first.balance);
  const verb =
    target === 'all'
      ? BW.sendAll(costs?.people ?? 0)
      : target === 'changed'
        ? BW.sendChanged(costs?.people ?? 0)
        : BW.sendAgain;

  function sendNow() {
    if (costs == null || sending || checkAt !== 'shown') return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      if (first?.sendFails === true) {
        setSendFailed(true);
        say(BW.sendFailed);
        return;
      }
      const sent = sendTo(people, due, costs);
      commit(sent.people);
      setSide(null);
      const lines = resultLines(sent.sent, costs.noMobile, sent.held.length);
      setResult({ lines, held: sent.held });
      say(lines.join(' '));
    }, ISSUE_MS);
  }

  function typed(next: string) {
    const fitted = fitRules(draft, next);
    setDraft(fitted.text);
    if (fitted.cut) {
      setCut(true);
      say(BW.cut);
    } else if (cut) setCut(false);
  }

  const card = (
    <>
      <View style={styles.card} testID={`briefing.${state}`}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {BW.card}
        </Text>
        <Text size={15} style={styles.secondary}>
          {BW.cardLine}
        </Text>
        <View style={styles.tally} accessible accessibilityLabel={tallyWords(tally)}>
          {BRIEFS.map((brief) => (
            <View key={brief} style={styles.inline}>
              <BriefMark brief={brief} />
              <Text size={15} weight="medium" accessible={false}>
                {BW.tally[brief]}
              </Text>
              <Text size={15} weight="bold" accessible={false}>
                {String(tally[brief])}
              </Text>
            </View>
          ))}
        </View>
        {acts && (
          <View style={styles.acts}>
            {sends && all.length > 0 && (
              <PrimaryButton
                label={BW.sendAll(all.length)}
                onPress={() => open({ kind: 'check', target: 'all' })}
                paired
                testID="briefing.send"
              />
            )}
            {sends && changed.length > 0 && (
              <SecondaryButton
                label={BW.sendChanged(changed.length)}
                onPress={() => open({ kind: 'check', target: 'changed' })}
                paired
                testID="briefing.changed"
              />
            )}
            <SecondaryButton
              ref={opener}
              label={BW.copy}
              onPress={() => open({ kind: 'copy' })}
              paired
              testID="briefing.copy"
            />
          </View>
        )}
        <View style={styles.acts}>
          <QuietButton
            label={manage ? BW.editRules : BW.rules}
            onPress={() => open({ kind: 'rules', editing: false })}
            testID="briefing.rules"
          />
          <QuietButton
            label={BW.previewAs}
            onPress={() => open({ kind: 'preview', id: onShift(people)[0]?.id ?? 'chinedu' })}
            testID="briefing.preview"
          />
        </View>
        {result != null && (
          <View style={styles.result} testID="briefing.result">
            <View style={styles.inline}>
              <Glyph name="tick" size={18} ink={tokens.colorAccentText} />
              <Text size={15} weight="semibold" style={styles.shrink}>
                {result.lines.join(' ')}
              </Text>
            </View>
            {result.held.map((id) => (
              <CopyRow
                key={id}
                one={shown(id)}
                acts={acts}
                busy={busy === id}
                missed={missed === id}
                handHeld={handHeld?.id === id ? handHeld.url : null}
                onCopy={() => void copy(id)}
                onMark={() => mark(id)}
                brief={false}
              />
            ))}
            <QuietButton
              label={BW.dismiss}
              onPress={() => setResult(null)}
              testID="briefing.result.dismiss"
            />
          </View>
        )}
      </View>
      {!manage && (
        <View style={styles.inline}>
          <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} />
          <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
            {BW.lock}
          </Text>
        </View>
      )}
    </>
  );

  function row(onRoster: OnRoster) {
    const one = shown(onRoster.id);
    const words = [BW.tally[one.brief], noteOf(one)].filter(Boolean).join(' · ');
    const rowActs = acts && one.brief === 'changed' && one.mobile != null;
    const after = (
      <>
        {rowActs && (
          <View style={styles.rowActs}>
            {sends && !one.heldText && (
              <SecondaryButton
                label={BW.sendAgain}
                accessibilityLabel={BW.forBriefing(BW.sendAgain, one.name)}
                onPress={() => open({ kind: 'check', target: one.id })}
                paired
                testID={`briefing.row.${one.id}.again`}
              />
            )}
            <SecondaryButton
              label={busy === one.id ? `${BW.copy}…` : BW.copy}
              accessibilityLabel={BW.forBriefing(BW.copy, one.name)}
              off={busy === one.id}
              onPress={() => void copy(one.id)}
              paired
              testID={`briefing.row.${one.id}.copy`}
            />
            {one.briefCopy != null && !one.briefCopy.marked && (
              <QuietButton
                label={BW.markSent}
                onPress={() => mark(one.id)}
                testID={`briefing.row.${one.id}.mark`}
              />
            )}
          </View>
        )}
        {missed === one.id && one.brief === 'changed' && <Missed />}
        {handHeld?.id === one.id && side?.kind !== 'copy' && result == null && (
          <View style={styles.rowActs}>
            <HandHeld one={one} url={handHeld.url} />
          </View>
        )}
      </>
    );

    return {
      words,
      below: (
        <>
          <View style={styles.inline} testID={`briefing.row.${one.id}`}>
            <BriefMark brief={one.brief} />
            <Text size={14} weight="semibold" accessible={false} style={styles.shrink}>
              {words}
            </Text>
          </View>
          {one.briefCopy != null && one.brief === 'changed' && <CopiedLine one={one} />}
        </>
      ),
      after,
    };
  }

  const panels = (
    <>
      <Sheet
        open={side != null}
        onClose={() => setSide(null)}
        scrimLabel={BW.close}
        held={sending}
        opener={opener}
        docked
        testID="briefing.sheet"
      >
        <View style={styles.sheet}>
          {side?.kind === 'copy' && (
            <CopyPanel
              people={people}
              loading={first.loading}
              acts={acts}
              busy={busy}
              missed={missed}
              handHeld={handHeld}
              onCopy={(id) => void copy(id)}
              onMark={mark}
              onClose={() => setSide(null)}
            />
          )}
          {side?.kind === 'rules' && (
            <RulesPanel
              rules={rules}
              draft={side.editing ? draft : null}
              manage={acts}
              cut={cut}
              saved={saved}
              onEdit={() => {
                setDraft(rules);
                setSaved(false);
                setSide({ kind: 'rules', editing: true });
              }}
              onType={typed}
              onSave={() => {
                setRules(draft.trim());
                setSaved(true);
                setSide({ kind: 'rules', editing: false });
                say(BW.saved);
              }}
              onCancel={() => {
                setCut(false);
                setSide({ kind: 'rules', editing: false });
              }}
              onClose={() => setSide(null)}
            />
          )}
          {side?.kind === 'preview' && (
            <PreviewPanel
              people={people}
              one={shown(side.id)}
              rules={rules}
              onPick={(id) => setSide({ kind: 'preview', id })}
              onClose={() => setSide(null)}
            />
          )}
          {side?.kind === 'check' && costs != null && (
            <CheckPanel
              costs={costs}
              at={checkAt}
              verb={verb}
              billing={first.billing}
              sending={sending}
              failed={sendFailed}
              onRetry={() => setCheckAt('loading')}
              onSend={sendNow}
              onCopy={() => setSide({ kind: 'copy' })}
              onAsk={() => setToast(`${BW.askOwner} has its own design (sc-3963).`)}
              onCancel={() => setSide(null)}
            />
          )}
        </View>
      </Sheet>
      {toast != null && (
        <PageToast
          words={toast}
          onClose={() => setToast(null)}
          bottom={insets.bottom + tokens.spaceXl}
        />
      )}
    </>
  );

  const demo = (
    <SecondaryButton
      label={clipFails ? 'The clipboard refuses · on' : 'The clipboard refuses'}
      onPress={() => setClipFails(!clipFails)}
      testID="briefing.demo.clipboard"
    />
  );

  return { card, row, panels, demo, restart };
}

function tallyWords(tally: Record<Brief, number>): string {
  return BRIEFS.map((brief) => `${BW.tally[brief]} ${tally[brief]}`).join(', ');
}

/** sc-4333's four marks, told apart by shape: a filled tick, an open tick, a dashed ring and a heavy amber ring. */
export function BriefMark({ brief, side = 16 }: { brief: Brief; side?: number }) {
  const round = { width: side, height: side, borderRadius: side / 2 };
  if (brief === 'read') return <ShapeMark kind="yes" side={side} ink={tokens.colorAccent} />;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ring,
        round,
        brief === 'none' && styles.ringDashed,
        brief === 'changed' && styles.ringHeavy,
      ]}
    >
      {brief === 'sent' && (
        <Glyph name="tick" size={Math.round(side * 0.6)} ink={tokens.colorAccent} weight={3.4} />
      )}
    </View>
  );
}

function CopiedLine({ one }: { one: Person }) {
  if (one.briefCopy == null) return null;

  return (
    <View style={styles.inline}>
      <StatusShape shape={one.briefCopy.marked ? 'sent' : 'copied'} side={14} />
      <Text size={14} style={[styles.secondary, styles.shrink]}>
        {one.briefCopy.marked ? BW.markedBy(one.briefCopy.trail) : BW.copiedBy(one.briefCopy.trail)}
      </Text>
    </View>
  );
}

function Missed() {
  return (
    <View style={[styles.inline, styles.rowActs]}>
      <Glyph name="alert" size={16} ink={tokens.colorBrokenText} />
      <Text size={14} weight="semibold" style={[styles.broken, styles.shrink]}>
        {BW.notCopied}
      </Text>
    </View>
  );
}

/** The issued link the clipboard refused, to copy by hand; "Link" where the row cannot hold the name. */
function HandHeld({ one, url, short = false }: { one: Person; url: string; short?: boolean }) {
  return (
    <View style={styles.held}>
      <View style={styles.inline}>
        <Glyph name="alert" size={16} ink={tokens.colorBrokenText} />
        <Text size={14} weight="semibold" style={[styles.broken, styles.shrink]}>
          {BW.refused}
        </Text>
      </View>
      <Field label={short ? BW.link : BW.linkFor(one.name)}>
        <TextField
          value={url}
          accessibilityLabel={short ? BW.link : BW.linkFor(one.name)}
          submitting
          selectTextOnFocus
          testID={`briefing.held.${one.id}`}
        />
      </Field>
    </View>
  );
}

function CopyRow({
  one,
  acts,
  busy,
  missed,
  handHeld,
  onCopy,
  onMark,
  brief = true,
}: {
  one: Person;
  acts: boolean;
  busy: boolean;
  missed: boolean;
  handHeld: string | null;
  onCopy: () => void;
  onMark: () => void;
  brief?: boolean;
}) {
  const note = noteOf(one);

  return (
    <View style={styles.copyRow} testID={`briefing.copy.${one.id}`}>
      <Text size={16} weight="semibold">
        {one.name}
      </Text>
      {brief && (
        <View style={styles.inline}>
          <Text size={14} style={[styles.secondary, styles.shrink]}>
            {[one.job, one.shift, one.station].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.pill}>
            <Text size={12} weight="semibold" style={styles.secondary}>
              {BW.notBuilt}
            </Text>
          </View>
        </View>
      )}
      {brief && (
        <View style={styles.inline}>
          <BriefMark brief={one.brief} side={14} />
          <Text size={14} weight="semibold" style={styles.shrink}>
            {[BW.tally[one.brief], note].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}
      <CopiedLine one={one} />
      {missed && <Missed />}
      {handHeld != null && <HandHeld one={one} url={handHeld} short />}
      {acts && one.mobile != null && (
        <View style={styles.acts}>
          <SecondaryButton
            label={busy ? `${BW.copy}…` : BW.copy}
            accessibilityLabel={`${BW.copy}: ${one.name}`}
            off={busy}
            onPress={onCopy}
            paired
            testID={`briefing.copy.${one.id}.copy`}
          />
          {one.briefCopy != null && !one.briefCopy.marked && (
            <QuietButton
              label={BW.markSent}
              onPress={onMark}
              testID={`briefing.copy.${one.id}.mark`}
            />
          )}
        </View>
      )}
    </View>
  );
}

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.panelHead}>
      <View style={styles.shrink}>
        <Text size={12} weight="semibold" style={styles.eyebrow}>
          {BW.card.toUpperCase()}
        </Text>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <QuietButton label={BW.close} onPress={onClose} testID="briefing.close" />
    </View>
  );
}

function CopyPanel({
  people,
  loading,
  acts,
  busy,
  missed,
  handHeld,
  onCopy,
  onMark,
  onClose,
}: {
  people: readonly Person[];
  loading: boolean;
  acts: boolean;
  busy: string | null;
  missed: string | null;
  handHeld: { id: string; url: string } | null;
  onCopy: (id: string) => void;
  onMark: (id: string) => void;
  onClose: () => void;
}) {
  const listed = onShift(people);

  return (
    <>
      <PanelHead title={BW.copyTitle} onClose={onClose} />
      {loading ? (
        <Skeleton shape="rows" rowHeight={64} rows={4} words={BW.loading} />
      ) : listed.length === 0 ? (
        <View style={styles.empty}>
          <Text size={17} weight="semibold">
            {BW.nobody}
          </Text>
          <SecondaryButton
            label={BW.giveShift}
            onPress={onClose}
            testID="briefing.copy.giveShift"
          />
        </View>
      ) : (
        <>
          <Text size={15} style={styles.secondary}>
            {BW.copyLine}
          </Text>
          {listed.map((one) => (
            <CopyRow
              key={one.id}
              one={one}
              acts={acts}
              busy={busy === one.id}
              missed={missed === one.id}
              handHeld={handHeld?.id === one.id ? handHeld.url : null}
              onCopy={() => onCopy(one.id)}
              onMark={() => onMark(one.id)}
            />
          ))}
        </>
      )}
    </>
  );
}

function RulesPanel({
  rules,
  draft,
  manage,
  cut,
  saved,
  onEdit,
  onType,
  onSave,
  onCancel,
  onClose,
}: {
  rules: string;
  draft: string | null;
  manage: boolean;
  cut: boolean;
  saved: boolean;
  onEdit: () => void;
  onType: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const count = draft == null ? null : countLine(draft);

  return (
    <>
      <PanelHead title={BW.rules} onClose={onClose} />
      {saved && (
        <View style={styles.inline}>
          <Glyph name="tick" size={16} ink={tokens.colorAccentText} />
          <Text size={15} weight="semibold" style={[styles.accent, styles.shrink]}>
            {BW.saved}
          </Text>
        </View>
      )}
      {draft == null ? (
        <>
          {rules === '' ? (
            <Text size={17} weight="semibold">
              {BW.rulesNone}
            </Text>
          ) : null}
          <Text size={15} style={styles.secondary}>
            {BW.rulesWhere}
          </Text>
          {rules !== '' && <Text size={16}>{rules}</Text>}
          {manage && (
            <SecondaryButton label={BW.editRules} onPress={onEdit} testID="briefing.rules.edit" />
          )}
        </>
      ) : (
        <>
          <Field label={BW.rules} help={BW.rulesWhere}>
            <NoteBox
              value={draft}
              onChangeText={onType}
              accessibilityLabel={BW.rules}
              testID="briefing.rules.box"
            />
          </Field>
          {count != null && (
            <View style={styles.inline} testID="briefing.rules.count">
              {count.limit && <Glyph name="warn" size={16} ink={tokens.colorAttentionText} />}
              <Text size={14} style={count.limit ? styles.attention : styles.secondary}>
                {count.words}
              </Text>
            </View>
          )}
          {cut && (
            <View style={styles.inline}>
              <Glyph name="warn" size={16} ink={tokens.colorAttentionText} />
              <Text size={14} weight="semibold" style={[styles.attention, styles.shrink]}>
                {BW.cut}
              </Text>
            </View>
          )}
          <SheetActions>
            <QuietButton
              label={BW.cancel}
              onPress={onCancel}
              inset
              testID="briefing.rules.cancel"
            />
            <PrimaryButton label={BW.save} onPress={onSave} paired testID="briefing.rules.save" />
          </SheetActions>
        </>
      )}
    </>
  );
}

function PreviewPanel({
  people,
  one,
  rules,
  onPick,
  onClose,
}: {
  people: readonly Person[];
  one: Person;
  rules: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <PanelHead title={BW.previewAs} onClose={onClose} />
      <Field label={BW.previewWho}>
        <ListPicker
          label={BW.previewWho}
          searchLabel={BW.previewSearch}
          choices={people.map((person) => ({ code: person.id, name: person.name }))}
          value={one.id}
          onChange={onPick}
          testID="briefing.preview.who"
        />
      </Field>
      <View style={styles.banner}>
        <Glyph name="eye" size={16} ink={tokens.colorAttentionText} />
        <Text size={14} weight="semibold" style={[styles.attention, styles.shrink]}>
          {BW.previewBanner}
        </Text>
      </View>
      <View style={styles.phone} testID="briefing.preview.page">
        {one.shift == null ? (
          <Text size={17} weight="semibold">
            {BW.previewNoShift('Saturday')}
          </Text>
        ) : (
          <>
            <Text size={20} weight="bold">
              {`${BW.onTonight} ${one.station ?? one.job ?? ''}`}
            </Text>
            <View style={styles.phoneCard}>
              <Text size={13} weight="semibold" style={styles.secondary}>
                {BW.yourShift}
              </Text>
              <Text size={17} weight="bold">
                {one.job ?? ''}
              </Text>
              <Text size={15}>{one.shift}</Text>
            </View>
            <View style={styles.phoneCard}>
              <Text size={13} weight="semibold" style={styles.secondary}>
                {BW.yourLead}
              </Text>
              <Text size={17} weight="bold">
                {one.id === 'ifeoma' ? BW.noLead : `Ifeoma Nduka · ${BW.floorLead}`}
              </Text>
            </View>
          </>
        )}
        {rules !== '' && (
          <View style={styles.phoneCard}>
            <Text size={13} weight="semibold" style={styles.secondary}>
              {BW.beforeYouStart}
            </Text>
            <Text size={15}>{rules}</Text>
          </View>
        )}
      </View>
    </>
  );
}

function CheckPanel({
  costs,
  at,
  verb,
  billing,
  sending,
  failed,
  onRetry,
  onSend,
  onCopy,
  onAsk,
  onCancel,
}: {
  costs: Check;
  at: 'loading' | 'shown' | 'failed';
  verb: string;
  billing: boolean;
  sending: boolean;
  failed: boolean;
  onRetry: () => void;
  onSend: () => void;
  onCopy: () => void;
  onAsk: () => void;
  onCancel: () => void;
}) {
  const short = costs.smsWaits + costs.whatsAppWaits > 0;

  return (
    <>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {BW.checkTitle}
      </Text>
      {at === 'loading' ? (
        <Text size={15} style={styles.secondary} testID="briefing.check.working">
          {BW.working}
        </Text>
      ) : at === 'failed' ? (
        <View style={styles.empty} testID="briefing.check.failed">
          <Text size={15} weight="semibold" style={styles.broken}>
            {BW.costFailed}
          </Text>
          <SecondaryButton label={BW.tryAgain} onPress={onRetry} testID="briefing.check.retry" />
        </View>
      ) : (
        <>
          <Text size={16} weight="semibold">
            {BW.people(costs.people)}
          </Text>
          {costs.noMobile > 0 && (
            <Text size={15} style={styles.secondary}>
              {BW.noMobileCount(costs.noMobile)}
            </Text>
          )}
          <View style={styles.credits} testID="briefing.check.credits">
            {costs.sms.n > 0 && <Text size={15}>{BW.smsLine(costs.sms.n, costs.sms.credits)}</Text>}
            {costs.whatsApp != null && costs.whatsApp.n > 0 && (
              <Text size={15}>{BW.whatsAppLine(costs.whatsApp.n, costs.whatsApp.credits)}</Text>
            )}
            <Text size={15} weight="semibold">
              {BW.totalLine(costs.credits)}
            </Text>
            <Text size={15} style={styles.secondary}>
              {BW.after(costs.after)}
            </Text>
            {costs.whatsAppWaits > 0 && <Waits words={BW.whatsAppWaits(costs.whatsAppWaits)} />}
            {costs.smsWaits > 0 && <Waits words={BW.smsWaits(costs.smsWaits)} />}
            {short &&
              (billing ? (
                <Text size={15} style={styles.secondary}>
                  {BW.notInApp}
                </Text>
              ) : (
                <QuietButton label={BW.askOwner} onPress={onAsk} testID="briefing.check.ask" />
              ))}
          </View>
          <Text size={14} style={styles.secondary}>
            {BW.usage}
          </Text>
          {failed && (
            <Text size={15} weight="semibold" style={styles.broken}>
              {BW.sendFailed}
            </Text>
          )}
        </>
      )}
      <SheetActions>
        <QuietButton
          label={BW.cancel}
          onPress={onCancel}
          off={sending}
          inset
          testID="briefing.check.cancel"
        />
        <SecondaryButton
          label={BW.copy}
          onPress={onCopy}
          off={sending}
          paired
          testID="briefing.check.copy"
        />
        <PrimaryButton
          label={verb}
          busy={sending}
          off={at !== 'shown'}
          onPress={onSend}
          paired
          testID="briefing.check.send"
        />
      </SheetActions>
    </>
  );
}

function Waits({ words }: { words: string }) {
  return (
    <View style={styles.inline}>
      <Glyph name="clock" size={16} ink={tokens.colorAttentionText} />
      <Text size={15} weight="semibold" style={[styles.attention, styles.shrink]}>
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  tally: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXl,
    rowGap: tokens.spaceSm,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, flexWrap: 'wrap' },
  acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  below: { gap: tokens.spaceXs, paddingTop: tokens.spaceXs },
  rowActs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    paddingBottom: tokens.spaceMd,
  },
  result: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorInset,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.colorAccent,
  },
  ringDashed: { borderStyle: 'dashed', borderColor: tokens.colorInkSecondary },
  ringHeavy: { borderWidth: 4, borderColor: tokens.colorAttention },
  sheet: { flexShrink: 1, gap: tokens.spaceLg, padding: tokens.space3xl },
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  eyebrow: { color: tokens.colorInkSecondary, letterSpacing: 1 },
  copyRow: {
    gap: tokens.spaceXs,
    paddingTop: tokens.spaceMd,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  pill: {
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkSecondary,
  },
  held: { gap: tokens.spaceXs, flexGrow: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorAttentionTint,
  },
  phone: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorPage,
  },
  phoneCard: {
    gap: tokens.spaceXxs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
  },
  credits: {
    gap: tokens.spaceXs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorInset,
  },
  empty: { gap: tokens.spaceMd, alignItems: 'flex-start' },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  accent: { color: tokens.colorAccentText },
  broken: { color: tokens.colorBrokenText },
  shrink: { flexShrink: 1 },
});
