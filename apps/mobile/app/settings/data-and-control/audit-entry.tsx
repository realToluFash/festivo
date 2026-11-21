import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { EntryRows } from '../../../src/components/AuditLogParts.tsx';
import { DataFrame } from '../../../src/components/DataAndControl.tsx';
import type { TextHandle } from '../../../src/components/Text.tsx';
import { DATA_HREF, dataAndControlListed, DESTINATION_HREF } from '../../../src/kit/appNav.ts';
import { rememberedEntry } from '../../../src/kit/auditLog.ts';
import { eventHref } from '../../../src/kit/eventNav.ts';
import { NOT_OFFLINE } from '../../../src/offline.ts';
import { useSignedIn } from '../../../src/signedIn.ts';

/** On a phone, an audit log entry one level down from the log (sc-611). */
export default function AuditEntry() {
  const { t } = useTranslation();
  const { organisation } = useSignedIn();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const title = useRef<TextHandle>(null);
  const entry = rememberedEntry(id);

  if (organisation != null && !dataAndControlListed(organisation))
    return <Redirect href={DESTINATION_HREF.settings} />;
  if (entry == null) return <Redirect href={DATA_HREF.auditLog} />;

  const back = { label: t('auditLog.title'), onPress: () => router.back() };

  return (
    <DataFrame
      title={t('auditLog.entry')}
      back={{ ...back, pill: true }}
      paneBack={back}
      stale={NOT_OFFLINE.stale}
      refreshing={NOT_OFFLINE.refreshing}
      titleRef={title}
    >
      <EntryRows entry={entry} onEvent={(eventId) => router.push(eventHref(eventId))} />
    </DataFrame>
  );
}
