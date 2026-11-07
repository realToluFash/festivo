import { formattingLocale, type OrganisationDetails } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ScrollViewInstance, ViewInstance } from 'react-native';

import {
  DetailRows,
  type DetailsOpening,
  DetailsScreen,
  FRESH_DETAILS,
  OrganisationCard,
} from './OrganisationDetails.tsx';
import { DomainsSection, RequestsSection } from './OrganisationJoining.tsx';
import {
  type CardSaid,
  type OrganisationStart,
  organisationStart,
  organisationStateOf,
  SAMPLE_DETAILS,
} from './OrganisationModel.ts';
import { OwnershipSection } from './OrganisationOwnership.tsx';
import { DETAILS_WORDS } from './OrganisationWords.ts';
import { VIEWER_ORGANISATION } from './sample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { SummaryPage } from './SummaryPage.tsx';

/** Settings › Organisation in B, summary first, on sample data. A member reads the details and may only leave. */
export function OrganisationSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { viewer } = useShell();
  const name = organisationStateOf(state);
  const role = VIEWER_ORGANISATION[viewer]?.role ?? 'Member';

  return (
    <OrganisationPage
      key={`${viewer}:${name ?? 'atRest'}`}
      start={organisationStart(name, role)}
      manages={viewer === 'owner'}
    />
  );
}

function OrganisationPage({ start, manages }: { start: OrganisationStart; manages: boolean }) {
  const shell = useShell();
  const pane = shell.layout === 'landscape';
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const [details, setDetails] = useState<OrganisationDetails>(SAMPLE_DETAILS);
  const [said, setSaid] = useState<CardSaid | null>(start.said);
  const [role, setRole] = useState(start.role);
  const [editing, setEditing] = useState(start.screen === 'details');
  const [editVisit, setEditVisit] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const cardStep = useRef<ViewInstance>(null);
  const opening: DetailsOpening =
    editVisit === 0 ? { picking: start.picking, contactWrong: start.contactWrong } : FRESH_DETAILS;

  useEffect(() => {
    if (said != null) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [said]);

  return (
    <>
      <SummaryPage
        title={DETAILS_WORDS.title}
        scrollRef={scroll}
        toast={toast == null ? null : { words: toast, onClose: () => setToast(null) }}
      >
        <OrganisationCard
          details={details}
          said={said}
          role={role}
          manages={manages}
          pane={pane}
          stepRef={cardStep}
          onEdit={() => {
            setEditVisit((count) => count + 1);
            setEditing(true);
          }}
        />
        <DetailRows details={details} />
        {manages && <DomainsSection start={start} onToast={setToast} />}
        {manages && (
          <RequestsSection start={start} phone={shell.layout === 'phone'} onToast={setToast} />
        )}
        <OwnershipSection
          start={start}
          role={role}
          locale={locale}
          onTransferred={(to) => {
            setRole('Admin');
            setSaid({ kind: 'transferred', to });
          }}
        />
      </SummaryPage>
      {manages && (
        <DetailsScreen
          key={editVisit}
          saved={details}
          open={editing}
          opening={opening}
          opener={cardStep}
          onClose={() => setEditing(false)}
          onSaved={(next, words) => {
            setEditing(false);
            setDetails(next);
            setSaid({ kind: 'saved', words });
          }}
        />
      )}
    </>
  );
}
