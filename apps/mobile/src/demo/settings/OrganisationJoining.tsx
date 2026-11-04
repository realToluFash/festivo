import { normaliseDomain } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import {
  Field,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from '../../components/Field.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { SAMPLE } from '../samples.ts';
import { ConfettiSwitch } from './NotificationsSwitch.tsx';
import {
  DOMAINS_MOST,
  domainProblem,
  domainRefusal,
  domainsFoot,
  LOADING_MS,
  type OrganisationStart,
  requestLink,
  RETRY_MS,
  SEND_MS,
  YOUR_DOMAIN,
} from './OrganisationModel.ts';
import {
  DOMAIN_WORDS as D,
  LINK_WORDS as L,
  LOADING,
  OFF,
  TRY_AGAIN,
} from './OrganisationWords.ts';
import {
  Ask,
  FocusedScreen,
  Line,
  Row,
  RowList,
  RowShapes,
  Section,
  TextAction,
} from './Summary.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** One timer at a time per section, cleared when the section goes. */
function useLater() {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (ms: number, then: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(then, ms);
  };
}

/** The domains people may ask to join from: a row each with Remove…, and Add domain on a screen of its own. */
export function DomainsSection({
  start,
  onToast,
}: {
  start: OrganisationStart;
  onToast: (words: string) => void;
}) {
  const [loading, setLoading] = useState(start.domainsLoading);
  const [domains, setDomains] = useState<string[]>([YOUR_DOMAIN]);
  const [added, setAdded] = useState<string | null>(null);
  const [adding, setAdding] = useState(start.screen === 'addDomain');
  const [addVisit, setAddVisit] = useState(0);
  const [removing, setRemoving] = useState<string | null>(
    start.ask === 'removeDomain' ? YOUR_DOMAIN : null,
  );
  const addRef = useRef<ViewInstance>(null);
  const removeRef = useRef<ScreenReaderTarget | null>(null);
  const full = domains.length >= DOMAINS_MOST;

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), LOADING_MS);

    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <>
      <Section
        title={D.title}
        right={
          loading || full ? undefined : (
            <TextAction
              ref={addRef}
              label={D.add}
              onPress={() => {
                setAddVisit((count) => count + 1);
                setAdding(true);
              }}
              testID="organisation.domain.add"
            />
          )
        }
        foot={domainsFoot(domains.length)}
      >
        {loading ? (
          <RowShapes count={3} words={LOADING} />
        ) : domains.length === 0 ? (
          <View style={styles.off}>
            <Text size={16} weight="semibold">
              {OFF}
            </Text>
            <Line size={14} text={D.offUntil} />
          </View>
        ) : (
          <RowList
            items={domains.map((domain) => ({
              key: domain,
              row: (
                <Row
                  title={domain}
                  line={domain === added ? D.added : D.working}
                  lead={
                    <View style={styles.globe} {...hidden}>
                      <Glyph name="globe" size={22} ink={tokens.colorInkSecondary} weight={2} />
                    </View>
                  }
                  trail={
                    <TextAction
                      ref={(view) => {
                        if (domain === removing) removeRef.current = view;
                      }}
                      label={D.remove}
                      removes
                      onPress={() => setRemoving(domain)}
                      accessibilityLabel={D.removeLabel(domain)}
                      testID={`organisation.domain.${domain}.remove`}
                    />
                  }
                  testID={`organisation.domain.${domain}`}
                />
              ),
            }))}
          />
        )}
      </Section>
      <AddDomainScreen
        key={addVisit}
        open={adding}
        listed={domains}
        opener={addRef}
        onClose={() => setAdding(false)}
        onAdded={(domain) => {
          setAdding(false);
          setDomains((listed) => [...listed, domain]);
          setAdded(domain);
          readOut(D.added);
        }}
      />
      <Ask
        open={removing != null}
        opener={removeRef}
        title={D.removeTitle(removing ?? YOUR_DOMAIN)}
        line={D.removeBody(removing ?? YOUR_DOMAIN)}
        keep={{ label: D.keep, testID: 'organisation.domain.keep' }}
        confirm={{ label: D.confirmRemove, testID: 'organisation.domain.confirm', removes: true }}
        onKeep={() => setRemoving(null)}
        onConfirm={() => {
          if (removing == null) return;
          setDomains((listed) => listed.filter((other) => other !== removing));
          if (added === removing) setAdded(null);
          setRemoving(null);
          onToast(D.removed(removing));
        }}
      />
    </>
  );
}

function AddDomainScreen({
  open,
  listed,
  opener,
  onClose,
  onAdded,
}: {
  open: boolean;
  listed: readonly string[];
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onAdded: (domain: string) => void;
}) {
  const later = useLater();
  const typed = useRef('');
  const input = useRef<TextInputInstance>(null);
  const [filled, setFilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function add(): void {
    if (busy) return;
    const problem = domainProblem(typed.current);
    setError(problem);
    if (problem != null) {
      focusChecked(input);
      return;
    }

    keysStayDown();
    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      const refusal = domainRefusal(typed.current, listed);
      if (refusal == null) {
        onAdded(normaliseDomain(typed.current));
        return;
      }
      setError(refusal);
      focusRefused(input);
    });
  }

  return (
    <FocusedScreen
      open={open}
      title={D.addTitle}
      verb={{
        label: D.addVerb,
        on: filled && !busy,
        onPress: add,
        testID: 'organisation.domain.send',
      }}
      onCancel={onClose}
      cancelTestID="organisation.domain.cancel"
      opener={opener}
      testID="organisation.addDomain"
    >
      <Field label={D.field} error={error} help={D.help(SAMPLE.email, DOMAINS_MOST)}>
        <TextField
          ref={input}
          defaultValue=""
          placeholder={YOUR_DOMAIN}
          onChangeText={(text) => {
            typed.current = text;
            setFilled(text.trim() !== '');
            if (error != null && domainProblem(text) == null) setError(null);
          }}
          wrong={error != null}
          submitting={busy}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={add}
          submitBehavior="submit"
          accessibilityLabel={D.field}
          testID="organisation.domain.field"
        />
      </Field>
    </FocusedScreen>
  );
}

/** The request link: its switch, the link itself, Copy and Replace…; it says what turning it off did until the page is left. */
export function RequestsSection({
  start,
  phone,
  onToast,
}: {
  start: OrganisationStart;
  phone: boolean;
  onToast: (words: string) => void;
}) {
  const later = useLater();
  const [status, setStatus] = useState<'loaded' | 'loading' | 'failed'>(
    start.link === 'failed' ? 'failed' : 'loaded',
  );
  const [on, setOn] = useState(start.link !== 'turnedOff');
  const [made, setMade] = useState(0);
  const [replaced, setReplaced] = useState(false);
  const [replacing, setReplacing] = useState(start.ask === 'replaceLink');
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<ViewInstance>(null);
  const link = requestLink(made);

  function turn(next: boolean): void {
    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      setOn(next);
      setReplaced(false);
      if (next) {
        setMade((count) => count + 1);
        onToast(L.on);
      } else readOut(L.off);
    });
  }

  if (status !== 'loaded')
    return (
      <Section title={L.title}>
        {status === 'loading' ? (
          <RowShapes count={1} words={LOADING} />
        ) : (
          <View style={styles.failed}>
            <Text size={16} weight="semibold">
              {L.unreadable}
            </Text>
            <TextAction
              label={TRY_AGAIN}
              onPress={() => {
                setStatus('loading');
                later(RETRY_MS, () => setStatus('loaded'));
              }}
              testID="organisation.link.tryAgain"
            />
          </View>
        )}
      </Section>
    );

  return (
    <>
      <Section title={L.title} foot={`${L.lead} ${L.help}`}>
        <View style={styles.switchRow}>
          <View style={styles.words}>
            <Text size={16} weight="semibold">
              {L.linkLabel}
            </Text>
            <Text
              size={14}
              weight="medium"
              selectable={on}
              style={[styles.secondary, on && styles.figures]}
              testID="organisation.link.line"
            >
              {on ? link : L.off}
            </Text>
          </View>
          <ConfettiSwitch
            on={on}
            label={L.title}
            busy={busy}
            stacked={phone}
            onChange={turn}
            testID="organisation.link.switch"
          />
        </View>
        {on && (
          <View style={styles.actions}>
            <View style={styles.pair}>
              <TextAction
                label={L.copy}
                glyph="copy"
                onPress={() => {
                  void setStringAsync(link).then(() => onToast(L.copied));
                }}
                testID="organisation.link.copy"
              />
              <TextAction
                ref={replaceRef}
                label={L.replace}
                removes
                onPress={() => setReplacing(true)}
                testID="organisation.link.replace"
              />
            </View>
            <Line size={14} text={replaced ? L.replaced : L.replaceBody} />
          </View>
        )}
      </Section>
      <Ask
        open={replacing}
        opener={replaceRef}
        title={L.replaceTitle}
        line={L.replaceBody}
        keep={{ label: L.keep, testID: 'organisation.link.keep' }}
        confirm={{ label: L.replaceConfirm, testID: 'organisation.link.confirm', removes: true }}
        onKeep={() => setReplacing(false)}
        onConfirm={() => {
          setReplacing(false);
          setMade((count) => count + 1);
          setReplaced(true);
          readOut(L.replaced);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  words: { flex: 1, minWidth: 0, gap: 3 },
  off: { gap: 3, paddingVertical: tokens.spaceXs },
  globe: { width: 28, alignItems: 'center' },
  failed: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXxs },
  switchRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: 11,
  },
  actions: { paddingBottom: tokens.spaceXxs },
  pair: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
});
