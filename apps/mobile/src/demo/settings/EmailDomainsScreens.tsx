import { type RefObject, useEffect, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import {
  Field,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from '../../components/Field.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { FocusedScreen, Line, TextAction } from '../../components/Summary.tsx';
import { type Check, domainFieldProblem, domainRefusal, type ProveOpen } from './DataModel.ts';
import { StatusLine } from './DataParts.tsx';
import { type DataSay, DERIVED, type Domain, IRE, RECORD_VALUE, recordName } from './DataSample.ts';
import { RecordRows, useCopied } from './RecordRows.tsx';
import { DOMAINS_WORDS as D } from './DataWords.ts';

const SEND_MS = 600;
const R = D.record;

/** The record to add where the domain's DNS is managed: Close, the title and Verify, the three values, and Remove at its foot. */
export function RecordScreen({
  open,
  domain,
  check,
  opener,
  say,
  listed,
  onClose,
  onVerify,
  onRemove,
}: {
  open: boolean;
  domain: Domain | null;
  check: Check;
  opener: RefObject<ScreenReaderTarget | null>;
  say: DataSay;
  listed: boolean;
  onClose: () => void;
  onVerify: () => void;
  onRemove: (domain: Domain, asked: boolean) => void;
}) {
  const { copied, copy, clear } = useCopied();
  const [asking, setAsking] = useState(false);
  const checking = check === 'checking';
  const name = domain?.name ?? '';
  const values = [
    { label: R.type, value: 'TXT', copied: R.copied(R.type) },
    { label: R.name, value: recordName(name), copied: R.copied(R.name) },
    { label: R.value, value: RECORD_VALUE, copied: R.copied(R.value) },
  ];
  const deadline = say.at(domain?.deadline ?? DERIVED.checksUntil);
  const foot =
    domain?.status === 'failed'
      ? D.stopped(deadline)
      : domain?.status === 'missing'
        ? `${D.putBack(deadline)}.`
        : D.card.waitingLine(deadline);
  const asks = domain?.status === 'missing';

  return (
    <FocusedScreen
      open={open && domain != null}
      title={R.title(name)}
      cancelLabel={R.close}
      verb={{
        label: checking ? R.verifying : R.verify,
        on: !checking,
        busy: checking,
        onPress: onVerify,
        testID: 'domains.record.verify',
      }}
      onCancel={onClose}
      cancelTestID="domains.record.close"
      opener={opener}
      ask={
        asking && domain != null
          ? {
              title: D.removeAsk.title(name),
              line: D.removeAsk.line,
              keep: { label: D.removeAsk.keep, testID: 'domains.record.keep' },
              confirm: { label: D.remove, removes: true, testID: 'domains.record.confirm' },
              onKeep: () => setAsking(false),
              onConfirm: () => {
                setAsking(false);
                onRemove(domain, true);
              },
            }
          : null
      }
      toast={copied == null ? null : { words: copied.copied, onClose: clear }}
      testID="domains.record"
    >
      <Line quiet={false} text={R.lead(name)} />
      <RecordRows rows={values} copied={copied} onCopy={copy} testID="domains.record.copy" />
      {check === 'notFound' && <NotFound />}
      <Line text={foot} />
      {listed && domain != null && (
        <TextAction
          label={asks ? D.removeAsks : D.remove}
          removes
          onPress={() => {
            if (asks) setAsking(true);
            else onRemove(domain, false);
          }}
          accessibilityLabel={D.removeLabel(name)}
          testID="domains.record.remove"
        />
      )}
    </FocusedScreen>
  );
}

function NotFound() {
  useReadOut(R.notFound);

  return <StatusLine text={R.notFound} />;
}

/** Prove a domain: the one field, checked before it is sent, then the server's refusals under it. */
export function ProveScreen({
  open,
  start,
  listed,
  opener,
  onCancel,
  onAdded,
}: {
  open: boolean;
  start: ProveOpen | null;
  listed: readonly string[];
  opener: RefObject<ScreenReaderTarget | null>;
  onCancel: () => void;
  onAdded: (typed: string) => void;
}) {
  const typed = useRef(start?.typed ?? '');
  const input = useRef<TextInputInstance>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [error, setError] = useState<string | null>(start?.problem ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  function add(): void {
    if (busy) return;
    const problem = domainFieldProblem(typed.current);
    setError(problem);
    if (problem != null) {
      focusChecked(input);
      return;
    }
    keysStayDown();
    setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      const refusal = domainRefusal(typed.current, listed);
      if (refusal == null) {
        onAdded(typed.current);
        return;
      }
      setError(refusal);
      focusRefused(input);
    }, SEND_MS);
  }

  return (
    <FocusedScreen
      open={open}
      title={D.add.title}
      verb={{ label: D.add.verb, on: !busy, busy, onPress: add, testID: 'domains.prove.add' }}
      waits={busy}
      onCancel={onCancel}
      cancelTestID="domains.prove.cancel"
      opener={opener}
      testID="domains.proveScreen"
    >
      <Field label={D.add.field} error={error} help={D.add.help}>
        <TextField
          ref={input}
          defaultValue={start?.typed ?? ''}
          placeholder={IRE}
          onChangeText={(text) => {
            typed.current = text;
            if (error != null && domainFieldProblem(text) == null) setError(null);
          }}
          wrong={error != null}
          submitting={busy}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={add}
          submitBehavior="submit"
          accessibilityLabel={D.add.field}
          testID="domains.prove.field"
        />
      </Field>
    </FocusedScreen>
  );
}
