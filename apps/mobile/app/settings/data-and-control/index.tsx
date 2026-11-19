import { Redirect, router } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DataFrame, useEmailDomainsPage } from '../../../src/components/DataAndControl.tsx';
import { Lead, TagRow } from '../../../src/components/DataParts.tsx';
import { useBackToSettings } from '../../../src/components/SettingsList.tsx';
import {
  CardSays,
  FailedBlock,
  Line,
  LoadingBlock,
  OnCard,
  RowList,
  Section,
  SummaryCard,
} from '../../../src/components/Summary.tsx';
import type { TextHandle } from '../../../src/components/Text.tsx';
import { dateLocale } from '../../../src/i18n/index.ts';
import { DATA_HREF, dataAndControlListed, DESTINATION_HREF } from '../../../src/kit/appNav.ts';
import { type DataGo, hubCard, hubDomainsLine } from '../../../src/kit/emailDomains.ts';
import { settingsListBeside, useLayout } from '../../../src/layout/useLayout.ts';
import { useSignedIn } from '../../../src/signedIn.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** Settings › Data and control as its demo draws it (sc-560, sc-611): one card with the soonest step, Control's Email domains and Audit log, and what is on the web. */
export default function DataAndControl() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const title = useRef<TextHandle>(null);
  const listed = organisation != null && dataAndControlListed(organisation);
  const { load, stale, refreshing, retry } = useEmailDomainsPage(
    listed ? organisation.id : undefined,
    title,
  );

  if (organisation != null && !listed) return <Redirect href={DESTINATION_HREF.settings} />;

  const open = (go: DataGo | null) => {
    const params = go == null ? {} : go.kind === 'prove' ? { prove: '1' } : { record: go.domain };
    const href = { pathname: DATA_HREF.emailDomains, params };
    // On its side the list stays put, so the page changes beside it rather than stacking.
    if (settingsListBeside(kind)) router.replace(href);
    else router.push(href);
  };

  const openAuditLog = () => {
    if (settingsListBeside(kind)) router.replace(DATA_HREF.auditLog);
    else router.push(DATA_HREF.auditLog);
  };

  const body = (() => {
    if (load.kind === 'loading' || organisation == null)
      return <LoadingBlock words={t('dataAndControl.loading')} />;
    if (load.kind === 'failed')
      return (
        <FailedBlock
          title={t('dataAndControl.failed')}
          line={t('dataAndControl.tryLine')}
          onRetry={retry}
          testID="dataAndControl.retry"
        />
      );
    const { page } = load;
    const card = hubCard(t, page, organisation.name, dateLocale());
    const step = card.step;

    return (
      <>
        <SummaryCard
          size={kind === 'tabletPortrait' ? 'wide' : 'page'}
          height={step == null ? 170 : 210}
          step={
            step == null
              ? null
              : { label: step.label, onPress: () => open(step.go), testID: 'dataAndControl.step' }
          }
          testID="dataAndControl.card"
        >
          {card.says != null && (
            <CardSays text={card.says} size={kind === 'tabletLandscape' ? 26 : 24} heading />
          )}
          <OnCard text={card.line} />
        </SummaryCard>
        <View>
          <Section title={t('dataAndControl.control')}>
            <RowList
              items={[
                {
                  key: 'emailDomains',
                  inset: 28 + tokens.spaceLg,
                  row: (
                    <TagRow
                      title={t('dataAndControl.rows.domains')}
                      line={hubDomainsLine(t, page, organisation.name)}
                      lead={<Lead glyph="globe" />}
                      tag={
                        page.plan === 'enterprise'
                          ? null
                          : { kind: 'lock', word: t('dataAndControl.enterprise') }
                      }
                      opens
                      onPress={() => open(null)}
                      testID="dataAndControl.emailDomains"
                    />
                  ),
                },
                {
                  key: 'auditLog',
                  inset: 28 + tokens.spaceLg,
                  row: (
                    <TagRow
                      title={t('dataAndControl.rows.audit')}
                      line={t('dataAndControl.rows.auditLine')}
                      lead={<Lead glyph="history" />}
                      tag={
                        page.plan === 'enterprise'
                          ? null
                          : { kind: 'lock', word: t('dataAndControl.enterprise') }
                      }
                      opens
                      onPress={openAuditLog}
                      testID="dataAndControl.auditLog"
                    />
                  ),
                },
              ]}
            />
          </Section>
          <View style={styles.web}>
            <Line size={14} text={t('dataAndControl.onTheWeb')} />
          </View>
        </View>
      </>
    );
  })();

  return (
    <DataFrame
      title={t('dataAndControl.title')}
      back={backToSettings(t('settings.title'))}
      stale={stale}
      refreshing={refreshing}
      titleRef={title}
    >
      {body}
    </DataFrame>
  );
}

const styles = StyleSheet.create({
  web: { paddingTop: tokens.spaceXs },
});
