import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { readOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { useShell } from '../../components/settingsShell.ts';
import {
  Ask,
  CardSays,
  FailedBlock,
  Line,
  LoadingBlock,
  OnCard,
  RowList,
  Section,
  SummaryCard,
  TextAction,
} from '../../components/Summary.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SeenBy } from './Frame.tsx';
import { useLoad } from './MembersLoading.tsx';
import { ConfettiSwitch } from './NotificationsSwitch.tsx';
import { DOMAIN_WORDS } from './OrganisationWords.ts';
import { memberLooking } from './sample.ts';
import {
  DATA_PEOPLE,
  type DomainRow,
  domainRows,
  domainsCard,
  type DomainsModel,
  domainsOwns,
  domainsStart,
  domainsStateOf,
  type Go,
  verifyFinds,
  withAdded,
  withOnly,
  withRemoved,
  withVerified,
} from './DataModel.ts';
import { DataSubPage, Lead, TagRow, useDataNav } from './DataParts.tsx';
import { dataSayIn, type Domain, DERIVED, zoneFor } from './DataSample.ts';
import { DATA_WORDS as H, DOMAINS_WORDS as D } from './DataWords.ts';
import { ProveScreen, RecordScreen } from './EmailDomainsScreens.tsx';

const CHECK_MS = 1200;
/** A linked Verifying… holds long enough to be looked at, then answers. */
const HELD_MS = 8000;
/** iOS shows one window at a time: the record waits for Prove a domain to go. */
const AFTER_WINDOW_MS = SETTLED_MS * 2 + 100;
const ONLY_INDENT = 40;

/** Email domains in B (sc-560, sc-563): prove a domain by its DNS record, then keep its accounts to Ire Events. */
export function EmailDomainsSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { viewer } = useDataNav();
  const name = domainsStateOf(state);
  const owns = domainsOwns(name, viewer);
  const email = owns ? DATA_PEOPLE[viewer].email : DATA_PEOPLE.julien.email;
  const looking = useMemo(() => memberLooking(email), [email]);

  return (
    <SeenBy looking={looking}>
      <DomainsPage
        key={`${name}:${String(owns)}`}
        start={domainsStart(name, owns)}
        owns={owns}
        held={name === 'ed_checking'}
      />
    </SeenBy>
  );
}

type From = 'card' | 'prove' | string;

function DomainsPage({ start, owns, held }: { start: DomainsModel; owns: boolean; held: boolean }) {
  const shell = useShell();
  const pane = shell.layout === 'landscape';
  const { viewer } = useDataNav();
  const say = dataSayIn(formattingLocale('en', getLocales()[0]?.languageTag), zoneFor(viewer));
  const { load, retry } = useLoad(start.load);
  const [model, setModel] = useState(start);
  const [tries, setTries] = useState<Record<string, number>>({});
  const [proveVisit, setProveVisit] = useState(0);
  const recordDomain = model.domains.find((one) => one.name === model.record) ?? null;
  const [record, setRecord] = useState({
    domain: recordDomain,
    visit: 0,
    open: recordDomain != null,
  });
  const recordOpen = recordDomain != null;
  // The record keeps its last domain while it slides away, and starts afresh each time it opens.
  if (recordOpen !== record.open || (recordOpen && recordDomain !== record.domain))
    setRecord({
      domain: recordDomain ?? record.domain,
      visit: recordOpen && !record.open ? record.visit + 1 : record.visit,
      open: recordOpen,
    });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const holding = useRef(held);
  const cardStep = useRef<ViewInstance>(null);
  const proveAction = useRef<ViewInstance>(null);
  const rows = useRef<Record<string, ViewInstance | null>>({});
  const from = useRef<From>('card');
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        if (from.current === 'card') return cardStep.current;
        if (from.current === 'prove') return proveAction.current;

        return rows.current[from.current] ?? cardStep.current;
      },
    }),
    [],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (model.check !== 'checking') return;
    const name = model.record;
    const domain = model.domains.find((one) => one.name === name);
    if (name == null || domain == null) return;
    const wait = holding.current ? HELD_MS : CHECK_MS;
    holding.current = false;
    timer.current = setTimeout(() => {
      if (verifyFinds(domain, tries[name] ?? 0)) {
        setModel((now) => withVerified(now, name));
        return;
      }
      setTries((now) => ({ ...now, [name]: (now[name] ?? 0) + 1 }));
      setModel((now) => ({ ...now, check: 'notFound' }));
    }, wait);
    // Once per Verify: the answer is for the record that was open as it was pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.check]);

  if (load !== 'loaded')
    return (
      <DataSubPage title={D.title}>
        {load === 'failed' ? (
          <FailedBlock title={D.failed} line={H.tryLine} onRetry={retry} testID="domains.retry" />
        ) : (
          <LoadingBlock words={D.loading} />
        )}
      </DataSubPage>
    );

  const card = domainsCard(model, owns, say);
  const listed = model.plan === 'enterprise';
  const openRecord = (name: string, by: From) => {
    from.current = by;
    setModel((now) => ({ ...now, record: name, check: 'resting' }));
  };
  const openProve = () => {
    from.current = 'prove';
    setProveVisit((count) => count + 1);
    setModel((now) => ({ ...now, prove: { typed: '', problem: null } }));
  };
  const go = (to: Go) => {
    if (to.kind === 'contact') shell.tell(H.contacting);
    else if (to.kind === 'prove') {
      from.current = 'card';
      setProveVisit((count) => count + 1);
      setModel((now) => ({ ...now, prove: { typed: '', problem: null } }));
    } else if (to.kind === 'record' && to.domain != null) openRecord(to.domain, 'card');
    else if (to.kind === 'only' && to.domain != null) {
      from.current = 'card';
      const domain = to.domain;
      setModel((now) => ({ ...now, ask: { kind: 'only', domain } }));
    }
  };
  const askDomain = model.ask?.domain ?? '';

  return (
    <>
      <DataSubPage title={D.title}>
        <SummaryCard
          size={shell.layout === 'portrait' ? 'wide' : 'page'}
          height={card.step == null ? 170 : 210}
          step={
            card.step == null
              ? null
              : {
                  label: card.step.label,
                  onPress: () => go(card.step?.go ?? { kind: 'contact' }),
                  testID: 'domains.step',
                  ref: cardStep,
                }
          }
          testID="domains.card"
        >
          <CardSays text={card.says} size={pane ? 26 : 24} heading />
          <OnCard text={card.line} />
        </SummaryCard>
        {model.plan !== 'locked' && (
          <Section
            title={D.block}
            right={
              listed ? (
                <TextAction
                  ref={proveAction}
                  label={D.prove}
                  glyph="plus"
                  onPress={openProve}
                  testID="domains.prove"
                />
              ) : undefined
            }
            foot={D.foot}
          >
            {model.domains.length === 0 ? (
              <View style={styles.none}>
                <Line size={15} quiet={false} text={D.none} />
              </View>
            ) : (
              <RowList
                items={domainRows(model, owns, say).flatMap((row) => {
                  const items = [
                    {
                      key: row.name,
                      inset: 28 + tokens.spaceLg,
                      row: (
                        <DomainLine
                          row={row}
                          rowRef={(view) => {
                            rows.current[row.name] = view;
                          }}
                          onRemove={() => {
                            from.current = row.name;
                            setModel((now) => ({
                              ...now,
                              ask: { kind: 'remove', domain: row.name },
                            }));
                          }}
                          onRecord={() => openRecord(row.name, row.name)}
                        />
                      ),
                    },
                  ];
                  if (row.only == null) return items;

                  return [
                    ...items,
                    {
                      key: `${row.name}.only`,
                      inset: ONLY_INDENT,
                      row: (
                        <OnlyLine
                          domain={row.name}
                          only={row.only}
                          phone={shell.layout === 'phone'}
                          onSwitch={(next) => {
                            from.current = `${row.name}.only`;
                            if (next)
                              setModel((now) => ({
                                ...now,
                                ask: { kind: 'only', domain: row.name },
                              }));
                            else setModel((now) => withOnly(now, row.name, 'off'));
                          }}
                          onCancel={() => setModel((now) => withOnly(now, row.name, 'off'))}
                          rowRef={(view) => {
                            rows.current[`${row.name}.only`] = view;
                          }}
                        />
                      ),
                    },
                  ];
                })}
              />
            )}
          </Section>
        )}
      </DataSubPage>
      <RecordScreen
        key={`record.${record.visit}`}
        open={recordOpen}
        domain={record.domain}
        check={model.check}
        opener={opener}
        say={say}
        listed={listed}
        onClose={() => setModel((now) => ({ ...now, record: null, check: 'resting' }))}
        onVerify={() => setModel((now) => ({ ...now, check: 'checking' }))}
        onRemove={(domain: Domain, asked: boolean) => {
          setModel((now) => withRemoved(now, domain.name, asked));
          if (!asked) shell.tell(DOMAIN_WORDS.removed(domain.name));
        }}
      />
      <ProveScreen
        key={`prove.${proveVisit}`}
        open={model.prove != null}
        start={model.prove}
        listed={model.domains.map((one) => one.name)}
        opener={opener}
        onCancel={() => setModel((now) => ({ ...now, prove: null }))}
        onAdded={(typed) => {
          setModel((now) => ({ ...now, prove: null }));
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            from.current = 'prove';
            setModel((now) => withAdded(now, typed));
          }, AFTER_WINDOW_MS);
        }}
      />
      <Ask
        open={model.ask?.kind === 'remove'}
        opener={opener}
        title={D.removeAsk.title(askDomain)}
        line={D.removeAsk.line}
        keep={{ label: D.removeAsk.keep, testID: 'domains.remove.keep' }}
        confirm={{ label: D.remove, removes: true, testID: 'domains.remove.confirm' }}
        onKeep={() => setModel((now) => ({ ...now, ask: null }))}
        onConfirm={() => {
          setModel((now) => withRemoved(now, askDomain, true));
          readOut(D.card.removed(askDomain));
        }}
        testID="domains.remove"
      />
      <Ask
        open={model.ask?.kind === 'only'}
        opener={opener}
        title={D.onlyAsk.title(askDomain)}
        line={D.onlyAsk.line(say.at(DERIVED.onlyStarts), askDomain)}
        body={<Line text={D.onlyAsk.more(askDomain)} />}
        keep={{ label: D.cancel, testID: 'domains.only.cancel' }}
        confirm={{ label: D.onlyAsk.schedule, testID: 'domains.only.schedule' }}
        onKeep={() => setModel((now) => ({ ...now, ask: null }))}
        onConfirm={() => setModel((now) => withOnly(now, askDomain, 'scheduled'))}
        testID="domains.only"
      />
    </>
  );
}

function DomainLine({
  row,
  rowRef,
  onRemove,
  onRecord,
}: {
  row: DomainRow;
  rowRef: (view: ViewInstance | null) => void;
  onRemove: () => void;
  onRecord: () => void;
}) {
  const lead = <Lead glyph="globe" />;

  if (row.action === 'record')
    return (
      <TagRow
        ref={rowRef}
        title={row.name}
        tag={row.tag}
        line={row.line}
        lead={lead}
        opens
        onPress={onRecord}
        testID={`domains.${row.name}`}
      />
    );

  return (
    <TagRow
      title={row.name}
      tag={row.tag}
      line={row.line}
      lead={lead}
      trail={
        row.action === 'remove' ? (
          <TextAction
            ref={rowRef}
            label={D.removeAsks}
            removes
            onPress={onRemove}
            accessibilityLabel={D.removeLabel(row.name)}
            testID={`domains.${row.name}.remove`}
          />
        ) : undefined
      }
      testID={`domains.${row.name}`}
    />
  );
}

function OnlyLine({
  domain,
  only,
  phone,
  onSwitch,
  onCancel,
  rowRef,
}: {
  domain: string;
  only: NonNullable<DomainRow['only']>;
  phone: boolean;
  onSwitch: (next: boolean) => void;
  onCancel: () => void;
  rowRef: (view: ViewInstance | null) => void;
}) {
  return (
    <View style={styles.only}>
      <TagRow
        title={D.only}
        line={only.line}
        trail={
          only.control === 'switch' ? (
            <View ref={rowRef}>
              <ConfettiSwitch
                on={only.on}
                label={`${D.only}, ${domain}`}
                stacked={phone}
                onChange={onSwitch}
                testID={`domains.${domain}.only`}
              />
            </View>
          ) : only.control === 'cancel' ? (
            <TextAction
              ref={rowRef}
              label={D.cancel}
              onPress={onCancel}
              accessibilityLabel={`${D.cancel} ${D.only}, ${domain}`}
              testID={`domains.${domain}.only.cancel`}
            />
          ) : undefined
        }
        testID={`domains.${domain}.onlyRow`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  none: { paddingVertical: tokens.spaceSm },
  only: { paddingLeft: ONLY_INDENT },
});
