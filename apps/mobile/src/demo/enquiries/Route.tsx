import { useLocalSearchParams } from 'expo-router';

import { EventsShell } from '../events/Route.tsx';
import { EnquiriesList } from './EnquiriesList.tsx';
import { enquiryStateOf } from './EnquiriesModel.ts';
import { W } from './EnquiriesWords.ts';
import { newStartOf, newStateOf } from './EnquiryFormModel.ts';
import { EnquiryPage } from './EnquiryPage.tsx';
import { pageStateOf } from './EnquiryPageModel.ts';

/** /demo/enquiries: the list and its search, with ?state= for each state the board names. */
export function EnquiriesRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = enquiryStateOf(params.state);

  return (
    <EventsShell key={state}>
      <EnquiriesList state={state} />
    </EventsShell>
  );
}

/** /demo/enquiries/new: New enquiry open over the list, with ?state= for each of its states. */
export function NewEnquiryRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = newStateOf(params.state);
  const start = newStartOf(state);

  return (
    <EventsShell key={state}>
      <EnquiriesList
        state={start.viewer.role === 'member' ? 'memberList' : 'idle'}
        newStart={start}
      />
    </EventsShell>
  );
}

/** /demo/enquiries/[id]: an enquiry's page, with ?state= and ?as= for who is looking. */
export function EnquiryRoute() {
  const params = useLocalSearchParams<{
    id?: string;
    state?: string;
    as?: string;
    saved?: string;
  }>();
  const state = pageStateOf(params.state);

  return (
    <EventsShell
      key={`${params.id ?? ''}.${state}`}
      told={params.saved === '1' ? W.saved : undefined}
    >
      <EnquiryPage id={params.id} state={state} as={params.as} />
    </EventsShell>
  );
}
