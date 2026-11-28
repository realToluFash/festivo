import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import type { Enquiry } from './enquiries.ts';
import { type Asking, ERASE_WORDS as E, type ErasePageStart } from './enquiryErase.ts';
import { RaceDialog, Refusal } from './EnquiryDelete.tsx';
import { LIST, listPath } from './enquiryPage.ts';
import { useStore } from './enquiryStore.ts';

const DELETE_MS = 700;

function fromList(state: unknown): boolean {
  return typeof state === 'object' && state != null && 'from' in state && state.from === 'list';
}

/** The confirm and what Delete does: back where the enquiry was opened from, with "Enquiry deleted." and no Undo. */
export function useDelete(enquiry: Enquiry, erase: ErasePageStart | null, stacks: boolean) {
  const store = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [asking, setAsking] = useState<Asking>(erase?.asking ?? 'none');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function deleted(): void {
    store.remove(enquiry.id);
    if (fromList(location.state)) navigate(listPath(location.search));
    else {
      store.setTab('open');
      navigate(LIST);
    }
    store.tell(E.deleted);
  }

  function go(): void {
    setAsking('deleting');
    timer.current = window.setTimeout(deleted, DELETE_MS);
  }

  function won(): void {
    store.put({ ...enquiry, tab: 'won', lost: null });
    setAsking('none');
  }

  const dialog =
    asking === 'none' ? null : asking === 'race' ? (
      <RaceDialog onClose={won} />
    ) : (
      <ConfirmDialog
        id="enq-delete"
        title={E.deleteTitle}
        keep={E.keepIt}
        go={
          asking === 'deleting'
            ? E.deleting
            : asking === 'failed' || asking === 'offline'
              ? E.tryAgain
              : E.delete
        }
        pending={asking === 'deleting'}
        stacks={stacks}
        refusal={
          asking === 'failed' ? (
            <Refusal words={E.notDeleted} />
          ) : asking === 'offline' ? (
            <Refusal words={E.offline} />
          ) : undefined
        }
        onKeep={() => setAsking('none')}
        onGo={go}
      >
        <p>
          {enquiry.erased == null ? E.deleteBody(enquiry.client) : E.deleteBodyErased}
          {asking === 'deleting' && (
            <span className="enq-deleting">
              <span className="pending-spinner" aria-hidden="true" />
            </span>
          )}
        </p>
      </ConfirmDialog>
    );

  return { open: () => setAsking('confirm'), dialog };
}
