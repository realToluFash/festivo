import { ApiError, type EmailDomain, primaryEmailAddress } from '@soirely/api-client';
import { domainOf } from '@soirely/domain';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../../../src/api.ts';
import { DataFrame, useEmailDomainsPage } from '../../../src/components/DataAndControl.tsx';
import { Lead, TagRow } from '../../../src/components/DataParts.tsx';
import {
  ProveScreen,
  type RecordCheck,
  RecordScreen,
} from '../../../src/components/EmailDomainsScreens.tsx';
import { ConfettiSwitch } from '../../../src/components/ConfettiSwitch.tsx';
import { readOut } from '../../../src/components/ReadOut.tsx';
import { SETTLED_MS } from '../../../src/components/Screen.tsx';
import type { ScreenReaderTarget } from '../../../src/components/screenReaderFocus.ts';
import {
  Ask,
  CardSays,
  FailedBlock,
  Line,
  LoadingBlock,
  OnCard,
  PageToast,
  RowList,
  Section,
  SummaryCard,
  TextAction,
} from '../../../src/components/Summary.tsx';
import type { TextHandle } from '../../../src/components/Text.tsx';
import { dateLocale } from '../../../src/i18n/index.ts';
import { DATA_HREF, dataAndControlListed, DESTINATION_HREF } from '../../../src/kit/appNav.ts';
import {
  type DataGo,
  type DomainRow,
  domainRefusal,
  domainRows,
  domainsCard,
  type DomainsSaid,
  verifiedOf,
} from '../../../src/kit/emailDomains.ts';
import { settingsListBeside, useLayout } from '../../../src/layout/useLayout.ts';
import { useSignedIn } from '../../../src/signedIn.ts';
import { tokens } from '../../../src/theme/tokens.ts';

type From = 'card' | 'prove' | string;

/** iOS shows one window at a time: the record waits for Prove a domain to go. */
const AFTER_WINDOW_MS = SETTLED_MS * 2 + 100;

/** Data and control › Email domains as its demo draws it (sc-560, sc-563): prove a domain by its DNS record, Verify it, remove it, and keep its accounts to the organisation. */
export default function EmailDomains() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const { account, organisation } = useSignedIn();
  const params = useLocalSearchParams<{ record?: string; prove?: string }>();
  const listed = organisation != null && dataAndControlListed(organisation);
  const title = useRef<TextHandle>(null);
  const { load, stale, refreshing, setPage, retry } = useEmailDomainsPage(
    listed ? organisation.id : undefined,
    title,
  );
  const [said, setSaid] = useState<DomainsSaid | null>(null);
  const [record, setRecord] = useState<string | null>(params.record ?? null);
  const [check, setCheck] = useState<RecordCheck>({ kind: 'resting' });
  const [proving, setProving] = useState(params.prove === '1');
  const [proveVisit, setProveVisit] = useState(0);
  const [recordVisit, setRecordVisit] = useState(0);
  const [asking, setAsking] = useState<string | null>(null);
  const [limiting, setLimiting] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleFailed, setScheduleFailed] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeFailed, setRemoveFailed] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shown, setShown] = useState<EmailDomain | null>(null);
  const cardStep = useRef<ViewInstance>(null);
  const proveAction = useRef<ViewInstance>(null);
  const rows = useRef<Record<string, ViewInstance | null>>({});
  const from = useRef<From>('card');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  const page = load.kind === 'loaded' ? load.page : null;
  const recordDomain = page?.domains.find((one) => one.domain === record) ?? null;
  // The record keeps its last domain while it slides away.
  if (recordDomain != null && recordDomain !== shown) setShown(recordDomain);

  if (organisation != null && !listed) return <Redirect href={DESTINATION_HREF.settings} />;

  const toHub = () => {
    if (settingsListBeside(kind)) router.replace(DATA_HREF.hub);
    else router.dismissTo(DATA_HREF.hub);
  };
  const back = { label: t('dataAndControl.title'), onPress: toHub };
  const example = domainOf(account == null ? null : primaryEmailAddress(account)) ?? 'example.com';

  const openRecord = (domain: string, by: From) => {
    from.current = by;
    setCheck({ kind: 'resting' });
    setRemoveFailed(null);
    setRecordVisit((n) => n + 1);
    setRecord(domain);
  };
  const openProve = (by: From) => {
    from.current = by;
    setProveVisit((n) => n + 1);
    setProving(true);
  };
  const go = (to: DataGo) => {
    if (to.kind === 'prove') openProve('card');
    else if (to.kind === 'only') {
      from.current = 'card';
      setScheduleFailed(null);
      setLimiting(to.domain);
    } else openRecord(to.domain, 'card');
  };
  const day = (at: string) =>
    new Intl.DateTimeFormat(dateLocale(), {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: account?.timezone ?? 'UTC',
    }).format(new Date(at));

  async function schedule(domain: string): Promise<void> {
    if (organisation == null || scheduling) return;
    setScheduling(true);
    setScheduleFailed(null);
    try {
      setPage(await api.switchOnlyOursOn(organisation.id, domain));
      setSaid(null);
      setLimiting(null);
    } catch {
      setScheduleFailed(t('companyDomains.failed'));
    } finally {
      setScheduling(false);
    }
  }

  async function onlyOff(domain: string, kind: 'cancelled' | 'turnedOff'): Promise<void> {
    if (organisation == null) return;
    try {
      setPage(await api.switchOnlyOursOff(organisation.id, domain));
      setSaid({ kind, domain });
      readOut(
        t(kind === 'cancelled' ? 'emailDomains.card.cancelled' : 'emailDomains.card.turnedOff'),
      );
    } catch {
      setToast(t('companyDomains.failed'));
    }
  }

  async function verify(domain: string): Promise<void> {
    if (organisation == null || check.kind === 'checking') return;
    setCheck({ kind: 'checking' });
    try {
      const { found, page: next } = await api.verifyEmailDomain(organisation.id, domain);
      setPage(next);
      const verified = verifiedOf(found, next, domain);
      if (verified.kind === 'notFound') {
        setCheck(verified);
        return;
      }
      setCheck({ kind: 'resting' });
      setRecord(null);
      setSaid({ kind: 'proved', domain, at: verified.at });
    } catch (error) {
      setCheck({
        kind: 'refused',
        words:
          error instanceof ApiError && error.is('email_domain_taken')
            ? error.problem.title
            : t('companyDomains.failed'),
      });
    }
  }

  async function remove(domain: string, asked: boolean): Promise<void> {
    if (organisation == null || removing) return;
    setRemoving(true);
    setRemoveFailed(null);
    try {
      setPage(await api.removeEmailDomain(organisation.id, domain));
      setRecord(null);
      setAsking(null);
      if (asked) {
        setSaid({ kind: 'removed', domain });
        readOut(t('emailDomains.card.removed', { domain }));
      } else setToast(t('emailDomains.removed', { domain }));
    } catch {
      setRemoveFailed(t('companyDomains.failed'));
    } finally {
      setRemoving(false);
    }
  }

  async function add(domain: string): Promise<string | null> {
    if (organisation == null) return null;
    try {
      setPage(await api.addEmailDomain(organisation.id, domain));
    } catch (error) {
      const refusal = domainRefusal(error);
      if (refusal == null) throw error;

      return refusal;
    }
    setProving(false);
    setSaid(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => openRecord(domain, 'prove'), AFTER_WINDOW_MS);

    return null;
  }

  const body = (() => {
    if (load.kind === 'loading' || organisation == null)
      return <LoadingBlock words={t('emailDomains.loading')} />;
    if (load.kind === 'failed')
      return (
        <FailedBlock
          title={t('emailDomains.failed')}
          line={t('dataAndControl.tryLine')}
          onRetry={retry}
          testID="emailDomains.retry"
        />
      );
    const { page: loaded } = load;
    const card = domainsCard(t, loaded, said, organisation.name, dateLocale());
    const step = card.step;
    const enterprise = loaded.plan === 'enterprise';

    return (
      <>
        <SummaryCard
          size={kind === 'tabletPortrait' ? 'wide' : 'page'}
          height={step == null ? 170 : 210}
          step={
            step == null
              ? null
              : {
                  label: step.label,
                  onPress: () => go(step.go),
                  testID: 'emailDomains.step',
                  ref: cardStep,
                }
          }
          testID="emailDomains.card"
        >
          {card.says != null && (
            <CardSays text={card.says} size={kind === 'tabletLandscape' ? 26 : 24} heading />
          )}
          <OnCard text={card.line} />
        </SummaryCard>
        {loaded.plan !== 'free' && (
          <Section
            title={t('emailDomains.block')}
            right={
              enterprise ? (
                <TextAction
                  ref={proveAction}
                  label={t('emailDomains.prove')}
                  glyph="plus"
                  onPress={() => openProve('prove')}
                  testID="emailDomains.prove"
                />
              ) : undefined
            }
            foot={t('emailDomains.foot')}
          >
            {loaded.domains.length === 0 ? (
              <View style={styles.none}>
                <Line size={15} quiet={false} text={t('emailDomains.none')} />
              </View>
            ) : (
              <RowList
                items={domainRows(t, loaded, day).flatMap((row) => {
                  const only = row.only;
                  const items = [
                    {
                      key: row.domain,
                      inset: 28 + tokens.spaceLg,
                      row: (
                        <DomainLine
                          row={row}
                          rowRef={(view) => {
                            rows.current[row.domain] = view;
                          }}
                          onRemove={() => {
                            from.current = row.domain;
                            setRemoveFailed(null);
                            setAsking(row.domain);
                          }}
                          onRecord={() => openRecord(row.domain, row.domain)}
                        />
                      ),
                    },
                  ];
                  if (only == null) return items;

                  return [
                    ...items,
                    {
                      key: `${row.domain}.only`,
                      inset: ONLY_INDENT,
                      row: (
                        <OnlyLine
                          domain={row.domain}
                          only={only}
                          phone={kind === 'phone'}
                          rowRef={(view) => {
                            rows.current[`${row.domain}.only`] = view;
                          }}
                          onSwitch={(next) => {
                            from.current = `${row.domain}.only`;
                            if (next) {
                              setScheduleFailed(null);
                              setLimiting(row.domain);
                            } else void onlyOff(row.domain, 'turnedOff');
                          }}
                          onCancel={() => void onlyOff(row.domain, 'cancelled')}
                        />
                      ),
                    },
                  ];
                })}
              />
            )}
          </Section>
        )}
      </>
    );
  })();

  return (
    <DataFrame
      title={t('emailDomains.title')}
      back={{ ...back, pill: true }}
      paneBack={back}
      stale={stale}
      refreshing={refreshing}
      titleRef={title}
      over={
        <>
          <RecordScreen
            key={`record.${recordVisit}`}
            open={recordDomain != null}
            domain={recordDomain ?? shown}
            check={check}
            listed={page?.plan === 'enterprise'}
            removing={removing}
            removeFailed={removeFailed}
            opener={opener}
            onClose={() => {
              setRecord(null);
              setCheck({ kind: 'resting' });
            }}
            onVerify={() => {
              if (record != null) void verify(record);
            }}
            onRemove={(domain, asked) => void remove(domain.domain, asked)}
          />
          <ProveScreen
            key={`prove.${proveVisit}`}
            open={proving}
            example={example}
            opener={opener}
            onCancel={() => setProving(false)}
            onAdd={add}
          />
          <Ask
            open={asking != null}
            opener={opener}
            title={t('emailDomains.removeAsk.title', { domain: asking ?? '' })}
            line={t('emailDomains.removeAsk.line')}
            keep={{
              label: t('emailDomains.removeAsk.keep'),
              testID: 'emailDomains.remove.keep',
              off: removing,
            }}
            confirm={{
              label: t('emailDomains.remove'),
              removes: true,
              busy: removing ? t('emailDomains.remove') : undefined,
              busyWords: t('emailDomains.remove'),
              testID: 'emailDomains.remove.confirm',
            }}
            failed={asking != null ? removeFailed : null}
            onKeep={() => {
              if (removing) return;
              setRemoveFailed(null);
              setAsking(null);
            }}
            onConfirm={() => {
              if (asking != null) void remove(asking, true);
            }}
            testID="emailDomains.remove"
          />
          <Ask
            open={limiting != null}
            opener={opener}
            title={t('emailDomains.onlyAsk.title', {
              domain: limiting ?? '',
              organisation: organisation?.name ?? '',
            })}
            line={t('emailDomains.onlyAsk.line', {
              at: page?.domains.find((one) => one.domain === limiting)?.onlyOursIfNow ?? '',
              domain: limiting ?? '',
              organisation: organisation?.name ?? '',
            })}
            body={<Line text={t('emailDomains.onlyAsk.more', { domain: limiting ?? '' })} />}
            keep={{
              label: t('emailDomains.cancel'),
              testID: 'emailDomains.only.cancel',
              off: scheduling,
            }}
            confirm={{
              label: t('emailDomains.onlyAsk.schedule'),
              busy: scheduling ? t('emailDomains.onlyAsk.schedule') : undefined,
              busyWords: t('emailDomains.onlyAsk.schedule'),
              testID: 'emailDomains.only.schedule',
            }}
            failed={limiting != null ? scheduleFailed : null}
            onKeep={() => {
              if (!scheduling) setLimiting(null);
            }}
            onConfirm={() => {
              if (limiting != null) void schedule(limiting);
            }}
            testID="emailDomains.only"
          />
          {toast != null && (
            <PageToast
              words={toast}
              onClose={() => setToast(null)}
              bottom={insets.bottom + tokens.spaceLg}
            />
          )}
        </>
      }
    >
      {body}
    </DataFrame>
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
  const { t } = useTranslation();
  const lead = <Lead glyph="globe" />;

  if (row.action === 'record')
    return (
      <TagRow
        ref={rowRef}
        title={row.domain}
        tag={row.tag}
        line={row.line}
        lead={lead}
        opens
        onPress={onRecord}
        testID={`emailDomains.${row.domain}`}
      />
    );

  return (
    <TagRow
      title={row.domain}
      tag={row.tag}
      line={row.line}
      lead={lead}
      trail={
        row.action === 'remove' ? (
          <TextAction
            ref={rowRef}
            label={t('emailDomains.removeAsks')}
            removes
            onPress={onRemove}
            accessibilityLabel={t('emailDomains.removeLabel', { domain: row.domain })}
            testID={`emailDomains.${row.domain}.remove`}
          />
        ) : undefined
      }
      testID={`emailDomains.${row.domain}`}
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
  const { t } = useTranslation();

  return (
    <View style={styles.only}>
      <TagRow
        title={t('emailDomains.only')}
        line={only.line}
        trail={
          only.control === 'switch' ? (
            <View ref={rowRef}>
              <ConfettiSwitch
                on={only.on}
                label={t('emailDomains.onlyFor', { domain })}
                stacked={phone}
                onChange={onSwitch}
                testID={`emailDomains.${domain}.only`}
              />
            </View>
          ) : only.control === 'cancel' ? (
            <TextAction
              ref={rowRef}
              label={t('emailDomains.cancel')}
              onPress={onCancel}
              accessibilityLabel={t('emailDomains.cancelOnlyFor', { domain })}
              testID={`emailDomains.${domain}.only.cancel`}
            />
          ) : undefined
        }
        testID={`emailDomains.${domain}.onlyRow`}
      />
    </View>
  );
}

const ONLY_INDENT = 40;

const styles = StyleSheet.create({
  none: { paddingVertical: tokens.spaceSm },
  only: { paddingLeft: ONLY_INDENT },
});
