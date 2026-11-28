import type { OrganisationEvent } from '@soirely/api-client';
import {
  type EventPhase,
  PHASE_LOOK,
  shownPhase,
} from '@soirely/domain';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PHASE_WORD } from '../kit/makeLive.ts';
import { useLoadedAt } from '../kit/serverNow.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { StatusChip } from './StatusChip.tsx';
import { rereadOrganisations } from '../signedIn.ts';

/** The phase the page shows: the server's, flipped by the corrected clock at the start and the end (sc-3585). */
export function useShownPhase(event: OrganisationEvent, now: Date): EventPhase {
  return shownPhase(event, useLoadedAt(event), now);
}

const NO_EVENT = {};

/** The same, for a screen whose event may not have loaded yet. */
export function usePhaseOf(event: OrganisationEvent | null, now: Date): EventPhase | null {
  const loadedAt = useLoadedAt(event ?? NO_EVENT);

  return event == null ? null : shownPhase(event, loadedAt, now);
}

export function EventState({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();

  return (
    <StatusChip
      look={PHASE_LOOK[phase]}
      word={t(PHASE_WORD[phase])}
      testID={`events.phase.${phase}`}
    />
  );
}

export function EventsFailed({
  words,
  onRetry,
  testID,
}: {
  words?: string;
  onRetry: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} accessibilityRole="alert">
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        body={words ?? t('eventsScreen.failedLoad')}
        announce
      />
      <PrimaryButton
        label={t('eventsScreen.retry')}
        onPress={() => {
          void rereadOrganisations();
          onRetry();
        }}
        testID={testID}
      />
    </View>
  );
}

/** The same for an event in another organisation and one that does not exist, so it says nothing of which. */
export function EventNotFound({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} testID="events.notFound">
      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        title={t('eventsScreen.notFound')}
        heading
      />
      <SecondaryButton
        label={t('eventsScreen.backToEvents')}
        onPress={onBack}
        testID="events.backToEvents"
      />
    </View>
  );
}

/** The not-found for an account with no organisation (sc-68438): no Events to go back to, so back to an event, or Continue. */
export function OutsideNotFound({ back, onBack }: { back: string | null; onBack: () => void }) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} testID="outside.notFound">
      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        title={t('eventsScreen.notFound')}
        heading
      />
      <SecondaryButton
        label={back == null ? t('outsideEvent.continue') : t('outsideEvent.backTo', { name: back })}
        onPress={onBack}
        testID="outside.notFound.back"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
});
