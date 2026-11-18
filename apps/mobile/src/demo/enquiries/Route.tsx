import { useLocalSearchParams } from 'expo-router';

import { EventsShell } from '../events/Route.tsx';
import { EnquiriesList } from './EnquiriesList.tsx';
import { enquiryStateOf } from './EnquiriesModel.ts';
import { EnquiryPage } from './EnquiryPage.tsx';

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

/** /demo/enquiries/[id]: where a result opens. */
export function EnquiryRoute() {
  const params = useLocalSearchParams<{ id?: string }>();

  return (
    <EventsShell>
      <EnquiryPage id={params.id} />
    </EventsShell>
  );
}
