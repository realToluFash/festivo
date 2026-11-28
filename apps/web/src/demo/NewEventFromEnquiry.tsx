import { useEffect, useRef, useState } from 'react';

import { Quiet } from '../components/EventPageParts.tsx';
import { FormBlock, Select } from '../components/EventFormParts.tsx';
import { ENQUIRY_EVENT_WORDS as W, MEMBERS } from './enquiryToEvent.ts';
import './enquiryEvent.css';

/** Above New event's first block: whose enquiry filled it, and to check each field. */
export function FilledNotice({ client }: { client: string }) {
  return <Quiet>{W.filledIn(client)}</Quiet>;
}

type Focus = 'change' | 'choose' | 'list' | null;

/** Lead, after Hosted by: the assigned Member with Change and Remove, or No lead with Choose a lead; either opens the Members. */
export function LeadBlock({
  lead,
  removed,
  off,
}: {
  lead: string;
  removed: boolean;
  off: boolean;
}) {
  const [name, setName] = useState(lead);
  const [chosen, setChosen] = useState(!removed);
  const [picking, setPicking] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const list = useRef<HTMLDivElement>(null);
  const change = useRef<HTMLButtonElement>(null);
  const choose = useRef<HTMLButtonElement>(null);
  const shown = chosen ? name : W.noLead;

  useEffect(() => {
    if (focus === 'list') list.current?.querySelector('select')?.focus();
    if (focus === 'change') change.current?.focus();
    if (focus === 'choose') choose.current?.focus();
  }, [focus]);

  function open(): void {
    setPicking(true);
    setFocus('list');
  }

  return (
    <FormBlock title={W.lead}>
      {picking ? (
        <div
          onBlur={(blur) => {
            if (blur.currentTarget.contains(blur.relatedTarget)) return;
            setPicking(false);
            setFocus(null);
          }}
        >
          <Select
            refTo={list}
            label={W.members}
            value={chosen ? name : ''}
            placeholder={W.chooseLead}
            choices={MEMBERS.map((one) => [one, one])}
            off={off}
            onChange={(picked) => {
              setName(picked);
              setChosen(true);
              setPicking(false);
              setFocus('change');
            }}
          />
        </div>
      ) : (
        <div role="group" aria-label={W.leadNamed(shown)} className="enq-lead">
          <p className="enq-lead-name">{shown}</p>
          <p className="desk-help enq-lead-line">{chosen ? W.leadLine : W.noRole(name)}</p>
          <div className="enq-lead-actions">
            {chosen ? (
              <>
                <button
                  ref={change}
                  type="button"
                  className="desk-text"
                  disabled={off}
                  onClick={open}
                >
                  {W.change}
                </button>
                <button
                  type="button"
                  className="desk-text"
                  disabled={off}
                  onClick={() => {
                    setChosen(false);
                    setFocus('choose');
                  }}
                >
                  {W.remove}
                </button>
              </>
            ) : (
              <button
                ref={choose}
                type="button"
                className="desk-text"
                disabled={off}
                onClick={open}
              >
                {W.chooseLead}
              </button>
            )}
          </div>
        </div>
      )}
    </FormBlock>
  );
}
