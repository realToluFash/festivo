import {
  ApiError,
  type ApiClient,
  type CompanyDomains,
  type RequestLink,
} from '@soirely/api-client';
import { companyDomainProblem, domainOf, normaliseDomain } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { ConfettiSwitch } from './ConfettiSwitch.tsx';
import { FailureLine } from './FailureLine.tsx';
import { Field, focusChecked, focusRefused, keysStayDown, TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { readOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import {
  Ask,
  FocusedScreen,
  Line,
  Row,
  RowList,
  RowShapes,
  Section,
  SectionFailed,
  TextAction,
} from './Summary.tsx';
import { Text } from './Text.tsx';

/** What Organisation asks of the API; the demo answers the same calls from its sample. */
export type OrganisationCalls = Pick<
  ApiClient,
  | 'companyDomains'
  | 'addCompanyDomain'
  | 'removeCompanyDomain'
  | 'requestLink'
  | 'turnOnRequestLink'
  | 'turnOffRequestLink'
  | 'replaceRequestLink'
  | 'prove'
  | 'transferOwnership'
  | 'leaveOrganisation'
  | 'organisationDeletion'
  | 'deleteOrganisation'
>;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

type Loaded<T> = { kind: 'loading' } | { kind: 'loaded'; value: T } | { kind: 'failed' };

/** One read, again on Try again; dropped when the organisation changes under it. */
function useLoad<T>(load: () => Promise<T>, key: string): [Loaded<T>, (value: T) => void, () => void] {
  const [state, setState] = useState<Loaded<T>>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    let current = true;
    latest.current().then(
      (value) => current && setState({ kind: 'loaded', value }),
      () => current && setState({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [key, attempt]);

  return [
    state,
    (value) => setState({ kind: 'loaded', value }),
    () => {
      setState({ kind: 'loading' });
      setAttempt((count) => count + 1);
    },
  ];
}

/** The domains people may ask to join from (sc-561): a row each with Remove…, and Add domain on a screen of its own. */
export function DomainsSection({
  organisation,
  calls,
  proved = [],
  opening = null,
  onToast,
}: {
  organisation: { id: string; name: string };
  calls: OrganisationCalls;
  /** Domains also proved in Email domains (sc-560), tagged Proved. */
  proved?: readonly string[];
  /** Where a demo state opens it. */
  opening?: 'addDomain' | 'removeDomain' | null;
  onToast: (words: string) => void;
}) {
  const { t } = useTranslation();
  const [load, setList, retry] = useLoad(
    () => calls.companyDomains(organisation.id),
    organisation.id,
  );
  const [added, setAdded] = useState<string | null>(null);
  const [adding, setAdding] = useState(opening === 'addDomain');
  const [addVisit, setAddVisit] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const [askedRemove, setAskedRemove] = useState(opening !== 'removeDomain');
  const [busy, setBusy] = useState(false);
  const [notRemoved, setNotRemoved] = useState<string | null>(null);
  const addRef = useRef<ViewInstance>(null);
  const removeRef = useRef<ScreenReaderTarget | null>(null);
  const list = load.kind === 'loaded' ? load.value : null;

  if (!askedRemove && list != null) {
    setAskedRemove(true);
    setRemoving(list.domains[0]?.domain ?? null);
  }

  const lead = t('companyDomains.lead', { organisation: organisation.name });
  const full = list != null && list.domains.length >= list.most;
  const title = t('companyDomains.title');

  if (list == null)
    return (
      <Section title={title}>
        {load.kind === 'failed' ? (
          <SectionFailed
            title={t('companyDomains.unreadable')}
            onRetry={retry}
            testID="organisation.domain.tryAgain"
          />
        ) : (
          <RowShapes count={3} words={t('pending.loading')} />
        )}
      </Section>
    );

  async function remove(domain: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setNotRemoved(null);

    try {
      setList(await calls.removeCompanyDomain(organisation.id, domain));
      if (added === domain) setAdded(null);
      setRemoving(null);
      onToast(t('companyDomains.removed', { domain }));
    } catch {
      setNotRemoved(t('companyDomains.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section
        title={title}
        right={
          full ? undefined : (
            <TextAction
              ref={addRef}
              label={t('companyDomains.add')}
              onPress={() => {
                setAddVisit((count) => count + 1);
                setAdding(true);
              }}
              testID="organisation.domain.add"
            />
          )
        }
        foot={full ? `${lead} ${t('companyDomains.full', { count: list.most })}` : lead}
      >
        {list.domains.length === 0 ? (
          <View style={styles.off}>
            <Text size={16} weight="semibold">
              {t('companyDomains.off')}
            </Text>
            <Line size={14} text={t('companyDomains.offUntil')} />
          </View>
        ) : (
          <RowList
            items={list.domains.map(({ domain, stopped }) => ({
              key: domain,
              row: (
                <Row
                  title={domain}
                  tag={
                    proved.includes(domain)
                      ? { kind: 'yes', word: t('companyDomains.proved') }
                      : null
                  }
                  line={
                    stopped
                      ? undefined
                      : domain === added
                        ? t('companyDomains.addedLine')
                        : t('companyDomains.working')
                  }
                  below={stopped ? <Stopped domain={domain} /> : undefined}
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
                      label={t('companyDomains.remove')}
                      removes
                      onPress={() => {
                        setNotRemoved(null);
                        setRemoving(domain);
                      }}
                      accessibilityLabel={t('companyDomains.removeLabel', { domain })}
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
        organisation={organisation}
        calls={calls}
        list={list}
        opener={addRef}
        onClose={() => setAdding(false)}
        onAdded={(domain, next) => {
          setAdding(false);
          setList(next);
          setAdded(domain);
          readOut(t('companyDomains.addedLine'));
        }}
      />
      <Ask
        open={removing != null}
        opener={removeRef}
        title={t('companyDomains.removeTitle', { domain: removing ?? '' })}
        line={t('companyDomains.removeBody', { domain: removing ?? '' })}
        keep={{ label: t('companyDomains.keep'), testID: 'organisation.domain.keep', off: busy }}
        confirm={{
          label: t('companyDomains.confirmRemove'),
          testID: 'organisation.domain.confirm',
          removes: true,
          busy: busy ? t('companyDomains.confirmRemove') : undefined,
        }}
        failed={notRemoved}
        onKeep={() => {
          if (busy) return;
          setNotRemoved(null);
          setRemoving(null);
        }}
        onConfirm={() => {
          if (removing != null) void remove(removing);
        }}
      />
    </>
  );
}

/** Stopped beside the alert mark, a shape with the word and not colour alone, then why. */
function Stopped({ domain }: { domain: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.stopped}>
      <View style={styles.stoppedWord}>
        <View {...hidden}>
          <Glyph name="alert" size={16} ink={tokens.colorInkSecondary} weight={2.2} />
        </View>
        <Text size={14} weight="semibold">
          {t('companyDomains.stopped')}
        </Text>
      </View>
      <Text size={14} weight="medium" style={styles.secondary}>
        {t('companyDomains.stoppedBody', { domain })}
      </Text>
    </View>
  );
}

function AddDomainScreen({
  open,
  organisation,
  calls,
  list,
  opener,
  onClose,
  onAdded,
}: {
  open: boolean;
  organisation: { id: string };
  calls: OrganisationCalls;
  list: CompanyDomains;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onAdded: (domain: string, list: CompanyDomains) => void;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const input = useRef<TextInputInstance>(null);
  const [filled, setFilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const example = domainOf(list.ownAddress) ?? 'example.com';

  function problem(text: string): string | null {
    const found = companyDomainProblem(text);
    if (found == null) return null;

    return t(found === 'blank' ? 'companyDomains.blank' : 'companyDomains.shape', { example });
  }

  async function add(): Promise<void> {
    if (busy) return;
    const checked = problem(typed.current);
    setError(checked);
    if (checked != null) {
      focusChecked(input);
      return;
    }

    keysStayDown();
    setBusy(true);
    setFailed(null);

    const domain = normaliseDomain(typed.current);
    try {
      onAdded(domain, await calls.addCompanyDomain(organisation.id, domain));
    } catch (refusal) {
      const violation =
        refusal instanceof ApiError && refusal.is('validation_failed')
          ? refusal.problem.violations?.find((one) => one.propertyPath === 'domain')
          : undefined;
      if (violation == null) setFailed(t('companyDomains.failed'));
      else {
        setError(violation.message);
        focusRefused(input);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <FocusedScreen
      open={open}
      title={t('companyDomains.addLabel')}
      verb={{
        label: t('companyDomains.addVerb'),
        on: filled && !busy,
        onPress: () => void add(),
        testID: 'organisation.domain.send',
      }}
      onCancel={onClose}
      cancelTestID="organisation.domain.cancel"
      opener={opener}
      testID="organisation.addDomain"
    >
      {failed != null && <FailureLine words={failed} testID="organisation.domain.failed" />}
      <Field
        label={t('companyDomains.field')}
        error={error}
        help={
          list.ownAddress == null
            ? t('companyDomains.helpNoAddress', { count: list.most })
            : t('companyDomains.help', { email: list.ownAddress, count: list.most })
        }
      >
        <TextField
          ref={input}
          defaultValue=""
          placeholder={example}
          onChangeText={(text) => {
            typed.current = text;
            setFilled(text.trim() !== '');
            if (error != null && problem(text) == null) setError(null);
          }}
          wrong={error != null}
          submitting={busy}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void add()}
          submitBehavior="submit"
          accessibilityLabel={t('companyDomains.field')}
          testID="organisation.domain.field"
        />
      </Field>
    </FocusedScreen>
  );
}

/** The request link (sc-562): its switch, the link itself, Copy and Replace…; it says what turning it off did until the page is left. */
export function RequestsSection({
  organisation,
  calls,
  phone,
  opening = null,
  onToast,
}: {
  organisation: { id: string; name: string };
  calls: OrganisationCalls;
  phone: boolean;
  /** Where a demo state opens it. */
  opening?: 'replaceLink' | 'linkOff' | null;
  onToast: (words: string) => void;
}) {
  const { t } = useTranslation();
  const [load, setLink, retry] = useLoad(
    () => calls.requestLink(organisation.id),
    organisation.id,
  );
  const [turnedOff, setTurnedOff] = useState(opening === 'linkOff');
  const [replaced, setReplaced] = useState(false);
  const [replacing, setReplacing] = useState(opening === 'replaceLink');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [notReplaced, setNotReplaced] = useState<string | null>(null);
  const replaceRef = useRef<ViewInstance>(null);
  const title = t('requestLink.title');

  if (load.kind !== 'loaded')
    return (
      <Section title={title}>
        {load.kind === 'loading' ? (
          <RowShapes count={1} words={t('pending.loading')} />
        ) : (
          <SectionFailed
            title={t('requestLink.unreadable')}
            onRetry={retry}
            testID="organisation.link.tryAgain"
          />
        )}
      </Section>
    );

  const link = load.value;
  const on = link.on && link.url != null;

  async function turn(next: boolean): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailed(null);

    try {
      setLink(
        await (next
          ? calls.turnOnRequestLink(organisation.id)
          : calls.turnOffRequestLink(organisation.id)),
      );
      setReplaced(false);
      setTurnedOff(!next);
      if (next) onToast(t('requestLink.flash.on'));
      else readOut(t('requestLink.flash.off'));
    } catch {
      setFailed(t('requestLink.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function replace(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setNotReplaced(null);

    try {
      setLink(await calls.replaceRequestLink(organisation.id));
      setReplacing(false);
      setReplaced(true);
      readOut(t('requestLink.flash.replaced'));
    } catch {
      setNotReplaced(t('requestLink.failed'));
    } finally {
      setBusy(false);
    }
  }

  function copy(url: string): void {
    setFailed(null);
    setStringAsync(url).then(
      () => onToast(t('requestLink.flash.copied')),
      () => setFailed(t('requestLink.failed')),
    );
  }

  const line = on ? link.url : turnedOff ? t('requestLink.flash.off') : null;

  return (
    <>
      <Section
        title={title}
        foot={`${t('requestLink.lead', { organisation: organisation.name })} ${t('requestLink.help')}`}
      >
        <View style={styles.switchRow}>
          <View style={styles.words}>
            <Text size={16} weight="semibold">
              {t('requestLink.linkLabel')}
            </Text>
            {line != null && (
              <Text
                size={14}
                weight="medium"
                selectable={on}
                style={[styles.secondary, on && styles.figures]}
                testID="organisation.link.line"
              >
                {line}
              </Text>
            )}
          </View>
          <ConfettiSwitch
            on={link.on}
            label={t('requestLink.switchLabel')}
            busy={busy && !replacing}
            stacked={phone}
            onChange={(next) => void turn(next)}
            testID="organisation.link.switch"
          />
        </View>
        {failed != null && <FailureLine words={failed} testID="organisation.link.failed" />}
        {on && (
          <View style={styles.actions}>
            <View style={styles.pair}>
              <TextAction
                label={t('requestLink.copy')}
                glyph="copy"
                onPress={() => copy(link.url ?? '')}
                testID="organisation.link.copy"
              />
              <TextAction
                ref={replaceRef}
                label={t('requestLink.replace')}
                removes
                onPress={() => {
                  setNotReplaced(null);
                  setReplacing(true);
                }}
                testID="organisation.link.replace"
              />
            </View>
            <Line
              size={14}
              text={replaced ? t('requestLink.flash.replaced') : t('requestLink.replaceBody')}
            />
          </View>
        )}
      </Section>
      <Ask
        open={replacing}
        opener={replaceRef}
        title={t('requestLink.replaceTitle')}
        line={t('requestLink.replaceBody')}
        keep={{ label: t('requestLink.keep'), testID: 'organisation.link.keep', off: busy }}
        confirm={{
          label: t('requestLink.replaceConfirm'),
          testID: 'organisation.link.confirm',
          removes: true,
          busy: busy ? t('requestLink.replaceConfirm') : undefined,
        }}
        failed={notReplaced}
        onKeep={() => {
          if (busy) return;
          setNotReplaced(null);
          setReplacing(false);
        }}
        onConfirm={() => void replace()}
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
  stopped: { gap: 3, paddingTop: 3 },
  stoppedWord: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
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
