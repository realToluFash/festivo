import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';

import { SettingsPage, useShell } from './Frame.tsx';
import { DetailsCard, DetailsReadOnly } from './OrganisationDetails.tsx';
import { DomainsCard, RequestsCard } from './OrganisationJoining.tsx';
import { organisationStateOf } from './OrganisationModel.ts';
import { OwnershipCard } from './OrganisationOwnership.tsx';
import { DETAILS_WORDS } from './OrganisationWords.ts';
import { VIEWER_ORGANISATION } from './sample.ts';

/** Settings › Organisation, in B, on sample data: the board on page 29, working. A planner sees it read-only. */
export function OrganisationSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { layout, viewer } = useShell();
  const start = organisationStateOf(state);
  const owner = viewer === 'owner';
  const tablet = layout !== 'phone';
  const key = `${viewer}:${start ?? 'atRest'}`;
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);

  return (
    <SettingsPage title={DETAILS_WORDS.title} sub={DETAILS_WORDS.intro}>
      {owner ? (
        <DetailsCard key={`details:${key}`} start={start} tablet={tablet} />
      ) : (
        <DetailsReadOnly role={VIEWER_ORGANISATION[viewer]?.role ?? 'Planner'} />
      )}
      {owner && <DomainsCard key={`domains:${key}`} start={start} layout={layout} />}
      {owner && <RequestsCard key={`link:${key}`} start={start} layout={layout} />}
      <OwnershipCard
        key={`ownership:${key}`}
        start={start}
        layout={layout}
        owner={owner}
        locale={locale}
      />
    </SettingsPage>
  );
}
