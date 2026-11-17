import { formattingLocale, type OrganisationDetails, organisationChanges } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance, ViewInstance } from 'react-native';

import { SeenBy } from './Frame.tsx';
import { LEAVER, offeredFor, SAMPLE_LEADS, samplePeople } from './MembersSample.ts';
import {
  DetailRows,
  type DetailsOpening,
  DetailsScreen,
  FRESH_DETAILS,
  OrganisationCard,
} from '../../components/OrganisationDetails.tsx';
import { DomainsSection, RequestsSection } from '../../components/OrganisationJoining.tsx';
import { OwnershipSection } from '../../components/OrganisationOwnership.tsx';
import { useOrganisationChoices } from '../../components/OrganisationPicker.tsx';
import { type CardSaid } from '../../kit/organisationSave.ts';
import { sampleCalls } from './OrganisationCalls.ts';
import {
  CANDIDATES,
  LEAVE_STATES,
  MALFORMED_CONTACT,
  type OrganisationStart,
  organisationStart,
  organisationStateOf,
  SAMPLE_DETAILS,
  SEND_MS,
} from './OrganisationModel.ts';
import { DETAILS_WORDS, OWNERSHIP_WORDS } from './OrganisationWords.ts';
import { managesOrganisation, memberLooking, VIEWER_ORGANISATION } from './sample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { SummaryPage } from './SummaryPage.tsx';
import { SAMPLE } from '../samples.ts';
import { ledEvents } from './MembersHandover.ts';
import { HandoverAsk } from './MembersHandover.tsx';

/** The board's mismatch: Delete pressed with a lowercase e. */
const MISTYPED = 'Ire events';

/** Settings › Organisation in B, summary first, on sample data. A member reads the details and may only leave; Leave's states are Ana Souza's. */
export function OrganisationSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { viewer } = useShell();
  const name = organisationStateOf(state);
  const role = VIEWER_ORGANISATION[viewer]?.role ?? 'Member';
  const page = (
    <OrganisationPage
      key={`${viewer}:${name ?? 'atRest'}`}
      start={organisationStart(name, role)}
      manages={managesOrganisation(viewer)}
    />
  );

  return name != null && LEAVE_STATES.includes(name) && role !== 'Owner' ? (
    <SeenBy looking={memberLooking(LEAVER)}>{page}</SeenBy>
  ) : (
    page
  );
}

const ORGANISATION = { id: 'org_ire', name: SAMPLE.organisation };

function OrganisationPage({ start, manages }: { start: OrganisationStart; manages: boolean }) {
  const shell = useShell();
  const { looking } = shell;
  const pane = shell.layout === 'landscape';
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const calls = useMemo(() => sampleCalls(start, locale), [start, locale]);
  const [details, setDetails] = useState<OrganisationDetails>(
    start.currencyBlank ? { ...SAMPLE_DETAILS, currency: '' } : SAMPLE_DETAILS,
  );
  const choices = useOrganisationChoices(SAMPLE_DETAILS);
  const [said, setSaid] = useState<CardSaid | null>(start.said);
  const [role, setRole] = useState(start.role);
  const [editing, setEditing] = useState(start.screen === 'details');
  const [editVisit, setEditVisit] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const cardStep = useRef<ViewInstance>(null);
  const opening: DetailsOpening =
    editVisit === 0
      ? {
          picking: start.picking,
          contactWrong: start.contactWrong ? MALFORMED_CONTACT : null,
          currencyBlank: start.currencyBlank,
        }
      : FRESH_DETAILS;
  // Whoever is looking leaves: Ana in Leave's states, Priya on a member's page at rest (sc-614).
  const led = ledEvents(SAMPLE_LEADS[looking.email] ?? []);
  const events = start.leadsAny ? (start.leadsOne ? led.slice(0, 1) : led) : [];
  const owner = role === 'Owner';
  const handsOver = !owner && events.length > 0;
  const [leaveVisit, setLeaveVisit] = useState(0);
  const [handingOver, setHandingOver] = useState(handsOver && start.ask === 'leave');
  const leaveRef = useRef<ViewInstance>(null);

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
          held={manages ? null : { by: 'role', role }}
          pane={pane}
          stepRef={cardStep}
          onEdit={() => {
            setEditVisit((count) => count + 1);
            setEditing(true);
          }}
          onSecurity={() => {}}
        />
        <DetailRows details={details} choices={choices} />
        {manages && (
          <DomainsSection
            organisation={ORGANISATION}
            calls={calls}
            proved={start.proved}
            opening={
              start.screen === 'addDomain'
                ? 'addDomain'
                : start.ask === 'removeDomain'
                  ? 'removeDomain'
                  : null
            }
            onToast={setToast}
          />
        )}
        {manages && (
          <RequestsSection
            organisation={ORGANISATION}
            calls={calls}
            phone={shell.layout === 'phone'}
            opening={
              start.ask === 'replaceLink'
                ? 'replaceLink'
                : start.link === 'turnedOff'
                  ? 'linkOff'
                  : null
            }
            onToast={setToast}
          />
        )}
        <OwnershipSection
          organisation={ORGANISATION}
          calls={calls}
          owner={owner}
          onlyOwner
          candidates={CANDIDATES.map((member) => ({
            id: member.initials,
            name: member.name,
            role: member.role,
          }))}
          via="password"
          opening={{
            screen: start.screen === 'transfer' || start.screen === 'delete' ? start.screen : null,
            ask:
              (start.ask === 'leave' && !handsOver) || start.ask === 'onlyOwner' ? start.ask : null,
            transfer: start.transferPicked ? { password: SAMPLE.password } : null,
            mistyped: start.deleteMistyped ? MISTYPED : null,
          }}
          leaveRef={leaveRef}
          onLeave={handsOver ? () => setHandingOver(true) : undefined}
          onTransferred={(to) => {
            setRole('Admin');
            setSaid({ kind: 'transferred', to });
          }}
          onGone={() => router.replace('/demo/today')}
        />
      </SummaryPage>
      {handsOver && (
        <HandoverAsk
          key={`leave.${leaveVisit}`}
          open={handingOver}
          opener={leaveRef}
          kind="leave"
          departing={null}
          events={events}
          offered={offeredFor(samplePeople(), looking.email)}
          you={looking.email}
          words={{
            title: OWNERSHIP_WORDS.leaveTitle,
            tail: OWNERSHIP_WORDS.leaveBody,
            keep: { label: OWNERSHIP_WORDS.stay, testID: 'organisation.leave.stay' },
            verb: {
              label: OWNERSHIP_WORDS.leave,
              testID: 'organisation.leave.confirm',
              removes: true,
            },
          }}
          start={leaveVisit === 0 ? start.leaving : null}
          onKeep={() => {
            setLeaveVisit((count) => count + 1);
            setHandingOver(false);
          }}
          onDone={() => router.replace('/demo/today')}
          testID="organisation.leave"
        />
      )}
      {manages && (
        <DetailsScreen
          key={editVisit}
          saved={details}
          choices={choices}
          open={editing}
          opening={opening}
          opener={cardStep}
          onSave={(values) =>
            new Promise((resolve) => {
              setTimeout(
                () =>
                  resolve({
                    kind: 'saved',
                    details: { ...details, ...organisationChanges(details, values) },
                  }),
                SEND_MS,
              );
            })
          }
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
