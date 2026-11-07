import { type RefObject, useEffect, useRef, useState } from 'react';

import {
  firstName,
  grantable,
  historyRows,
  type MembersDialog,
  ORGANISATION,
  type Person,
  type PersonEvent,
  personView,
  PROOF_LINE,
  type Proving,
  ROLE_KEPT,
  roleMeans,
  SUSPEND_LINE,
  TAKES_EFFECT,
  tagOf,
  underRoles,
  withRole,
} from './members.ts';
import type { SettingsSay, Viewer } from './settings.ts';
import { useProof } from './useProof.ts';
import {
  Ask,
  Card,
  CardStep,
  Choices,
  Dialog,
  Field,
  Head,
  Mark,
  Note,
  OnCard,
  RedAction,
  RowWords,
  TextAction,
} from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';

/** A person in the list's place: their card, how they got here, and what the viewer may do, by their standing. */
export function PersonPage({
  person,
  people,
  viewer,
  event,
  say,
  level,
  tell,
  onRole,
  onRestore,
  onSuspend,
  onRemove,
}: {
  person: Person;
  people: readonly Person[];
  viewer: Viewer;
  event: PersonEvent | null;
  say: SettingsSay;
  level: 1 | 2;
  tell: Tell;
  onRole: () => void;
  onRestore: () => void;
  onSuspend: () => void;
  onRemove: () => void;
}) {
  const view = personView({ person, people, viewer, event, say });
  const tag = tagOf(person);
  const Name = level === 1 ? 'h1' : 'h2';

  return (
    <>
      <Card size="person">
        <div className="desk-who">
          <span className="desk-disc" aria-hidden="true">
            {person.initials}
          </span>
          <div className="desk-who-words">
            <Name className="desk-name" tabIndex={-1}>
              {person.name}
            </Name>
            <OnCard>{person.id}</OnCard>
          </div>
        </div>
        <ul className="desk-glass-tags">
          <li className="desk-glass">{person.role ?? 'No role yet'}</li>
          <li className="desk-glass">
            <Mark kind={tag.kind} />
            {tag.word}
          </li>
        </ul>
        {view.lines.map((line) => (
          <OnCard key={line}>{line}</OnCard>
        ))}
        {view.step != null && (
          <CardStep
            label={view.step.label}
            onClick={view.step.does === 'role' ? onRole : onRestore}
          />
        )}
      </Card>
      {view.kept && <Note>{ROLE_KEPT}</Note>}
      <section className="desk-block">
        <Head title="How they got here" />
        <ul className="desk-rows">
          {historyRows(person, people, viewer, say).map((step) => (
            <li key={`${step.what}${step.when}`} className="desk-row is-plain">
              <RowWords title={step.what} lines={[step.when]} />
            </li>
          ))}
        </ul>
      </section>
      {view.after.length > 0 && (
        <div className="desk-after">
          {view.after.map((line) => (
            <Note key={line}>{line}</Note>
          ))}
          {view.goGeneral && (
            <TextAction
              label="Go to General"
              after="chevron"
              onClick={() => tell('General has its own design.')}
            />
          )}
        </div>
      )}
      {view.suspend && <RedAction label="Suspend…" line={SUSPEND_LINE} onClick={onSuspend} />}
      {view.remove != null && (
        <RedAction label={`Remove from ${ORGANISATION}…`} line={view.remove} onClick={onRemove} />
      )}
    </>
  );
}

const CODE_HELP = 'From your authenticator app, or one of your recovery codes.';

/** The password and code an owner gives before somebody else is made an owner. */
export function ProofFields({
  proving,
  onChange,
  password,
  code,
}: {
  proving: Proving;
  onChange: (proving: Proving) => void;
  password: RefObject<HTMLInputElement | null>;
  code: RefObject<HTMLInputElement | null>;
}) {
  const wrong = (field: 'password' | 'code') =>
    proving.problem?.field === field ? proving.problem.message : null;

  return (
    <div className="desk-fields">
      <Field
        label="Your password"
        value={proving.password}
        secret
        autoComplete="current-password"
        inputRef={password}
        error={wrong('password')}
        onChange={(value) => onChange({ ...proving, password: value, problem: null })}
      />
      <Field
        label="Code"
        value={proving.code}
        help={CODE_HELP}
        autoComplete="one-time-code"
        inputRef={code}
        error={wrong('code')}
        onChange={(value) => onChange({ ...proving, code: value, problem: null })}
      />
    </div>
  );
}

/** A person's role, then, for Owner, the proof that it is you: Save waits until something changes. */
export function RoleDialog({
  person,
  people,
  viewer,
  proved,
  start,
  onClose,
  onPeople,
}: {
  person: Person;
  people: readonly Person[];
  viewer: Viewer;
  proved: boolean;
  start: Extract<MembersDialog, { kind: 'role' }>;
  onClose: () => void;
  onPeople: (people: Person[], then: { event: PersonEvent; proved?: boolean }) => void;
}) {
  const [picked, setPicked] = useState(start.picked);
  const [asking, setAsking] = useState(start.ask);
  const [proving, setProving, password, code, proofOk] = useProof(start.proving);
  const none = useRef<HTMLElement>(null);
  const was = useRef(start.proving != null);
  const current = person.role ?? '';
  const changed = picked !== current;
  const first = firstName(person.name);
  const save = (role: string, prove: boolean) => {
    onPeople(withRole(people, person.id, role), { event: 'roleChanged', proved: prove });
    onClose();
  };

  useEffect(() => {
    if (proving != null && !was.current) password.current?.focus();
    was.current = proving != null;
  }, [proving, password]);

  return (
    <>
      <Dialog
        title={proving == null ? `${first}’s role` : `Make ${first} an owner`}
        verb={proving == null ? 'Save' : 'Make owner'}
        on={proving != null || changed}
        first={proving == null ? none : proving.problem?.field === 'code' ? code : password}
        onDismiss={() => {
          if (proving != null) setProving(null);
          else if (changed) setAsking(true);
          else onClose();
        }}
        onConfirm={() => {
          if (proving != null) {
            if (proofOk()) save('Owner', true);
          } else if (picked === 'Owner' && !proved)
            setProving({ password: '', code: '', problem: null });
          else save(picked, false);
        }}
      >
        {proving == null ? (
          <>
            <Note>
              {changed
                ? `${person.name} becomes ${picked} on their next request. Nobody is signed out.`
                : TAKES_EFFECT}
            </Note>
            <Choices
              legend="Role"
              hideLegend
              choices={grantable(viewer).map((name) => ({
                name,
                line: roleMeans(name),
                now: name === current,
              }))}
              picked={picked}
              onPick={setPicked}
              foot={underRoles(viewer)}
            />
          </>
        ) : (
          <>
            <Note>{PROOF_LINE}</Note>
            <ProofFields proving={proving} onChange={setProving} password={password} code={code} />
          </>
        )}
      </Dialog>
      {asking && (
        <Ask
          title="Discard your change?"
          line={`${person.name} stays ${current}.`}
          keep="Keep editing"
          go="Discard"
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}
