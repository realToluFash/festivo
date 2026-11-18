import { useLocalSearchParams } from 'expo-router';

import { EventsShell } from '../events/Route.tsx';
import { Consultations } from './Consultations.tsx';
import { consultationStateOf } from './ConsultationsModel.ts';
import { EnquiriesList } from './EnquiriesList.tsx';
import { enquiryStateOf } from './EnquiriesModel.ts';
import { W } from './EnquiriesWords.ts';
import { newStartOf, newStateOf } from './EnquiryFormModel.ts';
import { EnquiryPage } from './EnquiryPage.tsx';
import { EnquiryEventPage } from './EnquiryEvent.tsx';
import { pageStateOf } from './EnquiryPageModel.ts';
import { formStateOf, pageStateOf as madeStateOf } from './EnquiryToEventModel.ts';

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

/** /demo/enquiries/[id]: an enquiry's page, with ?state= and ?as= for who is looking; sc-31232's ?state= draws its parts of the page, and ?new= opens New event filled from it. */
export function EnquiryRoute() {
  const params = useLocalSearchParams<{
    id?: string;
    state?: string;
    as?: string;
    saved?: string;
    new?: string;
  }>();
  const form = formStateOf(params.new);
  const made = madeStateOf(params.state) ?? (form == null ? null : 'open-admin');
  const state = pageStateOf(params.state);

  return (
    <EventsShell
      key={`${params.id ?? ''}.${made ?? state}.${form ?? ''}`}
      told={params.saved === '1' ? W.saved : undefined}
    >
      {made == null ? (
        <EnquiryPage id={params.id} state={state} as={params.as} />
      ) : (
        <EnquiryEventPage id={params.id} state={made} form={form} />
      )}
    </EventsShell>
  );
}

/** /demo/consultations (sc-31228): an enquiry's Consultations, with ?state= for each state the board names. */
export function ConsultationsRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = consultationStateOf(params.state);

  return (
    <EventsShell key={state}>
      <Consultations state={state} />
    </EventsShell>
  );
}
