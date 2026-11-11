import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../../src/api.ts';
import {
  hearChoice,
  keepBeforeSaving,
  keepLaunchScheme,
  PERSONALISATION_LANDING,
  restartIn,
  schemeToFollow,
  useAccountChoice,
} from '../../src/colourScheme.ts';
import { AppFrame, FrameTop, besideRow } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { SETTINGS_PAGE } from '../../src/components/listFrame.ts';
import { ColoursScreen } from '../../src/components/ColoursScreen.tsx';
import { useReadOut } from '../../src/components/ReadOut.tsx';
import { SchemeCard } from '../../src/components/SchemeParts.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { FailedBlock } from '../../src/components/Summary.tsx';
import { Text } from '../../src/components/Text.tsx';
import {
  cardLine,
  type Choice,
  type Colours,
  inUse,
  refusalOf,
} from '../../src/kit/personalisation.ts';
import { schemeOf } from '../../src/kit/schemes.ts';
import { settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { schemeAtLaunch, tokens } from '../../src/theme/tokens.ts';
import { PANE_TITLE, paneTitle } from '../../src/components/topTitle.ts';

type Load = 'loading' | 'loaded' | 'failed';

function choiceIn(answer: unknown): Choice {
  const value = (answer as { colourScheme?: unknown } | null)?.colourScheme;

  return schemeOf(value);
}

/** Settings › Personalisation in the app (sc-30441), under Your account: the person's colours, and Colours to choose others. */
export default function Personalisation() {
  const { t } = useTranslation();
  const { saved: landed } = useLocalSearchParams<{ saved?: string }>();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const alone = !settingsListBeside(kind);
  const heard = useAccountChoice();
  const choice = heard ?? null;
  const current = inUse(choice);
  const [load, setLoad] = useState<Load>(heard === undefined ? 'loading' : 'loaded');
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(landed === '1');
  const [open, setOpen] = useState(false);
  const [visit, setVisit] = useState(0);
  const [colours, setColours] = useState<Colours>({ picked: current, phase: 'choosing' });
  const step = useRef<ViewInstance>(null);

  useEffect(() => {
    if (load !== 'loading') return;
    let live = true;

    api.request<unknown>('/api/auth/me').then(
      (answer) => {
        hearChoice(choiceIn(answer));
        if (live) setLoad('loaded');
      },
      () => {
        if (live) setLoad('failed');
      },
    );

    return () => {
      live = false;
    };
  }, [load, attempt]);

  useReadOut(load === 'loading' ? t('personalisation.loading') : null);

  function openColours(): void {
    setVisit((count) => count + 1);
    setSaved(false);
    setColours({ picked: current, phase: 'choosing' });
    setOpen(true);
  }

  async function save(): Promise<void> {
    const { picked } = colours;
    setColours({ picked, phase: 'saving' });

    if (!keepBeforeSaving(picked)) {
      setColours({ picked, phase: 'failed' });
      return;
    }

    let chosen: Choice;
    try {
      const answer = await api.request<unknown>('/api/auth/colour-scheme', {
        method: 'PUT',
        body: { colourScheme: picked },
      });
      chosen = choiceIn(answer) ?? picked;
    } catch (error) {
      keepLaunchScheme();
      setColours({ picked, phase: refusalOf(error) });
      return;
    }

    const follow = schemeToFollow(chosen, schemeAtLaunch);
    if (follow != null && !(await restartIn(follow, PERSONALISATION_LANDING))) {
      setColours({ picked, phase: 'failed' });
      return;
    }

    hearChoice(chosen);
    if (follow != null) return;
    setSaved(true);
    setOpen(false);
  }

  const page = (
    <>
      {load === 'loading' && <Loading words={t('personalisation.loading')} />}
      {load === 'failed' && (
        <FailedBlock
          title={t('personalisation.notLoaded')}
          line={t('personalisation.notLoadedLine')}
          onRetry={() => {
            setLoad('loading');
            setAttempt((tries) => tries + 1);
          }}
          testID="personalisation.tryAgainLoad"
        />
      )}
      {load === 'loaded' && (
        <>
          <SchemeCard
            scheme={current}
            line={cardLine(t, choice, saved)}
            wide={kind === 'tabletPortrait'}
            stepRef={step}
            onChoose={openColours}
          />
          <View style={styles.lines}>
            <Text size={14} weight="medium" style={styles.quiet}>
              {t('personalisation.follows')}
            </Text>
            <Text size={14} weight="medium" style={styles.quiet}>
              {t('personalisation.keeps')}
            </Text>
          </View>
        </>
      )}
    </>
  );

  return (
    <AppFrame
      current="settings"
      top="scrolls"
      listUnderTabs
      aboutTheAccount
      title={alone ? t('personalisation.title') : t('settings.title')}
      back={alone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="personalisation">
        <Screen edges={bodyEdges(kind)} contentStyle={SETTINGS_PAGE[kind]}>
          {alone && <FrameTop />}
          {!alone && (
            <View style={besideRow.row}>
              <Text size={PANE_TITLE} weight="bold" accessibilityRole="header" style={paneTitle}>
                {t('personalisation.title')}
              </Text>
            </View>
          )}
          {page}
        </Screen>
      </SettingsSplit>
      <ColoursScreen
        key={visit}
        open={open}
        colours={colours}
        current={current}
        opener={step}
        onPick={(scheme) => setColours({ picked: scheme, phase: 'choosing' })}
        onSave={() => void save()}
        onCancel={() => setOpen(false)}
      />
    </AppFrame>
  );
}

const BARS = ['86%', '64%', '78%'] as const;

/** The card's shape and the section's lines while the account answers; Loading… is read out. */
function Loading({ words }: { words: string }) {
  return (
    <View
      style={styles.loading}
      accessible
      accessibilityLabel={words}
      accessibilityState={{ busy: true }}
    >
      <View style={styles.sunkCard} />
      <View style={styles.bars}>
        {BARS.map((width) => (
          <View key={width} style={[styles.bar, { width }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: tokens.spaceSm },
  quiet: { lineHeight: Math.round(14 * 1.45), color: tokens.colorInkSecondary },
  loading: { gap: 18 },
  sunkCard: { height: 200, borderRadius: 26, backgroundColor: tokens.colorNeutralFill },
  bars: { gap: tokens.spaceMd },
  bar: { height: 13, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
});
