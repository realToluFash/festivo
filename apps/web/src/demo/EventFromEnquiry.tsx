import { Link, useSearchParams } from 'react-router';

import { Lead } from '../components/EventPageParts.tsx';
import { Chevron, RowWords } from '../components/SettingsParts.tsx';
import {
  ENQUIRY_EVENT_WORDS as W,
  MADE_FROM,
  SOURCES,
  fromEnquiryShown,
  madeStateOf,
} from './enquiryToEvent.ts';

/** The last of the Overview's Details on an event made from an enquiry: where it came from, to whoever may see it. */
export function FromEnquiryRow({ eventId }: { eventId: string }) {
  const [params] = useSearchParams();

  if (eventId !== MADE_FROM || !fromEnquiryShown(madeStateOf(params.get('state')))) return null;

  return (
    <li className="ev-part">
      <Link className="desk-row ev-detail" to={`/demo/enquiries/${SOURCES.bisi.id}?state=won`}>
        <Lead name="message" />
        <RowWords title={W.fromEnquiry(SOURCES.bisi.client)} />
        <Chevron />
      </Link>
    </li>
  );
}
