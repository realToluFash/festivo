import { type ReactNode, type RefObject, useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { useDialogKeys } from '../dialogFocus.ts';
import { Hourglass } from './Enquiries.tsx';
import type { Enquiry, Person } from './enquiries.ts';
import { ERASE_WORDS as E, WON_EVENT, mayDelete } from './enquiryErase.ts';

export function WonNote() {
  return (
    <div className="enq-won-note" role="note">
      <Glyph name="info" size={17} weight={2.3} />
      <p>
        {E.deleteEventFirst} <Link to={WON_EVENT.to}>{WON_EVENT.name}</Link>
      </p>
    </div>
  );
}

/** Delete enquiry… with its consequence, or for a Won one the reason it cannot go; a Member sees neither. */
export function DeleteFoot({
  enquiry,
  viewer,
  openerRef,
  onOpen,
}: {
  enquiry: Enquiry;
  viewer: Person;
  openerRef?: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
}) {
  if (viewer.role === 'member') return null;
  if (!mayDelete(enquiry, viewer)) return <WonNote />;

  return (
    <div className="enq-delete">
      <button ref={openerRef} type="button" className="button enq-delete-open" onClick={onOpen}>
        {E.deleteOpen}
      </button>
      <p className="desk-note">{enquiry.erased == null ? E.deleteLine : E.deleteLineErased}</p>
    </div>
  );
}

export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <p className="enq-warning" role="note">
      <Hourglass />
      <span>{children}</span>
    </p>
  );
}

export function Refusal({ words }: { words: string }) {
  return (
    <div className="notice notice-broken" role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p>{words}</p>
      </div>
    </div>
  );
}

export function RaceDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => close.current?.focus(), []);
  useDialogKeys(dialog, onClose, false);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="enq-race-title"
        aria-describedby="enq-race-body"
      >
        <div className="dialog-heading">
          <h2 id="enq-race-title">{E.deleteTitle}</h2>
          <div id="enq-race-body" className="dialog-body">
            <WonNote />
          </div>
        </div>
        <div className="dialog-actions">
          <button ref={close} type="button" className="button" onClick={onClose}>
            {E.close}
          </button>
        </div>
      </div>
    </>
  );
}
