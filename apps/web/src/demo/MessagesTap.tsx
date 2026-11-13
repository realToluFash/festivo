import { Fragment } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { HOSTS } from './messages.ts';
import type { WaButtons } from './messagesInvite.ts';
import { type TapCase, notSentBit, receiptBit, tapLine, tapMessage } from './messagesTap.ts';
import { DayRule, Meta, SoirelyCard, SystemLine } from './MessagesParts.tsx';
import './messagesTap.css';

function OpensLink() {
  return (
    <svg
      className="mt-glyph"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

/** sc-46343: the three buttons as WhatsApp stacks them: Yes opens the guest's page, the two others answer in the chat. */
export function WaAnswers({ answers }: { answers: WaButtons }) {
  return (
    <>
      <span>
        <OpensLink />
        {answers.yes}
      </span>
      <span>
        <Glyph name="undo" size={15} weight={2.2} />
        {answers.no}
      </span>
      <span>
        <Glyph name="undo" size={15} weight={2.2} />
        {answers.maybe}
      </span>
    </>
  );
}

/** A tap's line, then Soirely's one message, or why it did not go; a further repeat has neither. */
export function TapLines({ kase, name, ruled }: { kase: TapCase; name: string; ruled: boolean }) {
  return (
    <>
      {ruled && <DayRule>Today</DayRule>}
      {kase.taps.map((tap) => (
        <Fragment key={tap.at}>
          <SystemLine glyph="whatsApp">
            {tapLine(tap, name)} · {tap.at}
          </SystemLine>
          {tap.notSent == null ? (
            <SoirelyCard
              glyph="whatsApp"
              lines={tapMessage(tap, kase.language, HOSTS)}
              bits={tap.receipt == null ? [] : [receiptBit(tap.receipt)]}
              {...(kase.language === 'en' ? {} : { lang: kase.language })}
            />
          ) : (
            <li className="mg-said is-host">
              <Meta bits={[notSentBit(tap.notSent)]} end />
            </li>
          )}
        </Fragment>
      ))}
    </>
  );
}
