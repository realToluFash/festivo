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
import { ERASE_WORDS as E, erasePageStateOf, landingOf } from './EraseModel.ts';
import { pageStateOf } from './EnquiryPageModel.ts';
import { formStateOf, pageStateOf as madeStateOf } from './EnquiryToEventModel.ts';
import { TellClient } from './TellClient.tsx';
import { tellStateOf } from './TellClientModel.ts';

/** /demo/enquiries: the list and its search, with ?state= for each state the board names. */
export function EnquiriesRoute() {
  const params = useLocalSearchParams<{
    state?: string;
    tab?: string;
    mine?: string;
    deleted?: string;
  }>();
  const state = enquiryStateOf(params.state);
  const landing = landingOf(params);

  return (
    <EventsShell key={`${state}.${landing.deleted ?? ''}`}>
      <EnquiriesList state={state} landing={landing} />
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
    from?: string;
    back?: string;
  }>();
  const form = formStateOf(params.new);
  const made = madeStateOf(params.state) ?? (form == null ? null : 'open-admin');
  const state = pageStateOf(params.state);
  const erase = erasePageStateOf(params.state);

  return (
    <EventsShell
      key={`${params.id ?? ''}.${made ?? erase ?? state}.${form ?? ''}`}
      told={params.saved === '1' ? W.saved : undefined}
    >
      {made == null ? (
        <EnquiryPage
          id={params.id}
          state={state}
          erase={erase}
          as={params.as}
          from={params.from}
          backTo={params.back}
        />
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
    <EventsShell key={state} told={state === 'deleted-from-calendar' ? E.deleted : undefined}>
      <Consultations state={state} />
    </EventsShell>
  );
}

/** /demo/tell-client (sc-37133): Tell {client}, with ?state= for each state the board names. */
export function TellClientRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = tellStateOf(params.state);

  return (
    <EventsShell key={state}>
      <TellClient state={state} />
    </EventsShell>
  );
}
