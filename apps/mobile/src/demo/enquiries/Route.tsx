import { useLocalSearchParams } from 'expo-router';

import { EventsShell } from '../events/Route.tsx';
import { Consultations } from './Consultations.tsx';
import { consultationStateOf } from './ConsultationsModel.ts';
import { EnquiriesList } from './EnquiriesList.tsx';
import { enquiryStateOf } from './EnquiriesModel.ts';
import { EnquiryPage } from './EnquiryPage.tsx';
import { EnquiryEventPage } from './EnquiryEvent.tsx';
import { formStateOf, pageStateOf } from './EnquiryToEventModel.ts';

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

/** /demo/enquiries/[id]: where a result opens; sc-31232's ?state= draws its parts of the page, and ?new= opens New event filled from it. */
export function EnquiryRoute() {
  const params = useLocalSearchParams<{ id?: string; state?: string; new?: string }>();
  const form = formStateOf(params.new);
  const state = pageStateOf(params.state) ?? (form == null ? null : 'open-admin');

  return (
    <EventsShell key={`${params.id ?? ''}:${state ?? ''}:${form ?? ''}`}>
      {state == null ? (
        <EnquiryPage id={params.id} />
      ) : (
        <EnquiryEventPage id={params.id} state={state} form={form} />
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
