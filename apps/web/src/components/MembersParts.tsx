import type { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Card,
  CardStep,
  Chevron,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
} from './SettingsParts.tsx';

/** Members' first read: the card sunk, with four people's rows under it. */
export function MembersLoading({ words }: { words: string }) {
  return (
    <div className="desk-loading" role="status" aria-label={words}>
      <span className="desk-unseen" data-page-waits>
        {words}
      </span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <ul className="desk-rows has-lead" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-sunk is-face" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Members' list did not come: why as its heading, and Try again. */
export function MembersFailed({
  heading,
  alert = true,
  onRetry,
}: {
  heading?: Ref<HTMLHeadingElement>;
  alert?: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="desk-failed" role={alert ? 'alert' : undefined}>
      <h2 ref={heading} tabIndex={heading == null ? undefined : -1}>
        {t('membersScreen.failedTitle')}
      </h2>
      <p className="desk-line">{t('membersScreen.failedLine')}</p>
      <TextAction label={t('membersScreen.retry')} onClick={onRetry} />
    </div>
  );
}

export interface CardFace {
  key: string;
  initials: string;
  tone: number;
}

/** Members' card: what it says and its lines, up to five faces and how many more, and its one step. */
export function MembersCardView<Step extends { label: string }>({
  card,
  size = 'page',
  onStep,
}: {
  card: {
    says: string;
    lines: readonly string[];
    faces: readonly CardFace[];
    more: number;
    step: Step | null;
  };
  size?: 'page' | 'column';
  onStep: (step: Step) => void;
}) {
  const { step } = card;

  return (
    <Card size={size}>
      <div className="desk-said-lines" tabIndex={-1}>
        <Says focusable>{card.says}</Says>
        {card.lines.map((line) => (
          <OnCard key={line}>{line}</OnCard>
        ))}
      </div>
      {card.faces.length > 0 && (
        <div className="desk-faces" aria-hidden="true">
          {card.faces.map((face) => (
            <Avatar key={face.key} initials={face.initials} tone={face.tone} size="face" />
          ))}
          {card.more > 0 && <span className="desk-more">+{card.more}</span>}
        </div>
      )}
      {step != null && <CardStep label={step.label} onClick={() => onStep(step)} />}
    </Card>
  );
}

/** A person in Members' list: a button to their page or their answer, or a row that opens nothing once they have gone. */
export function MemberRow({
  member,
  initials,
  tone,
  name,
  tag,
  line,
  size,
  on = false,
  onPress,
}: {
  member?: string;
  initials: string;
  tone: number;
  name: string;
  tag?: ReactNode;
  line: string;
  size?: 'row' | 'small' | undefined;
  on?: boolean;
  onPress?: () => void;
}) {
  const words = (
    <>
      <Avatar initials={initials} tone={tone} {...(size == null ? {} : { size })} />
      <RowWords title={name} tag={tag} lines={[line]} />
    </>
  );

  if (onPress == null)
    return (
      <div className="desk-row" data-member={member}>
        {words}
      </div>
    );

  return (
    <button
      type="button"
      className={on ? 'desk-row is-on' : 'desk-row'}
      aria-current={on || undefined}
      data-member={member}
      onClick={onPress}
    >
      {words}
      <Chevron />
    </button>
  );
}

/** A filter that shows nobody: why, a line under it when there is one, and the way back to everyone. */
export function MembersEmpty({
  title,
  line,
  onEveryone,
}: {
  title: string;
  line?: string | undefined;
  onEveryone: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="desk-empty">
      <p className="desk-empty-title">{title}</p>
      {line != null && <p className="desk-line">{line}</p>}
      <TextAction label={t('membersScreen.showEveryone')} onClick={onEveryone} />
    </div>
  );
}

/** An invitation's address, its tag once it has ended, its lines, and what can be done with it. */
export function InvitationLine({
  email,
  ended,
  lines,
  children,
}: {
  email: string;
  ended?: string | undefined;
  lines: readonly ReactNode[];
  children?: ReactNode;
}) {
  return (
    <li className="desk-row">
      <RowWords
        title={email}
        tag={ended == null ? undefined : <Tag kind="ended" word={ended} />}
        lines={lines}
      />
      {children}
    </li>
  );
}
