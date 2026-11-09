import { ApiError, type Membership, type SignInRulesPage } from '@soirely/api-client';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import {
  Ask,
  Card,
  CardStep,
  DeskPage,
  Choices,
  Dialog,
  Head,
  Note,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { RuleMark, RulesBones } from '../../../components/SignInRulesParts.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { useDeskLayers } from '../../../layers.ts';
import { useOffline } from '../../../offline.ts';
import { can, replaceOrganisation, useSession } from '../../../session.ts';
import { markRulesSeen, seenAt } from '../../../signInRulesSeen.ts';
import { useStepFocus } from '../../../stepFocus.ts';
import {
  type Hold,
  type Reader,
  REFUSALS,
  type RuleKey,
  type RuleRow,
  SECURITY,
  type Step,
  applied,
  changeRows,
  changedFoot,
  choicesOf,
  differences,
  editTitle,
  effectsOf,
  holdOf,
  inForce,
  refusalOf,
  rulesCard,
  rulesOf,
  standFoot,
  stepLabel,
  whereYouStand,
} from './signInRulesDesk.ts';
import '../../../components/SettingsParts.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; retried: boolean }
  | { kind: 'loaded'; page: SignInRulesPage };

interface Edit {
  key: RuleKey;
  picked: string;
  ask: boolean;
  saving: boolean;
  failed: boolean;
}

/** Sign-in rules at a desk in B · Summary first (sc-30192), as the design demo's /demo/settings/sign-in-rules draws it. */
export function SignInRules() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;

  return <RulesDesk key={organisation.id} organisation={organisation} />;
}

function RulesDesk({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const { layers, covered, setHost } = useDeskLayers();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [seen, setSeen] = useState(() => seenAt(organisation.id));
  const [edit, setEdit] = useState<Edit | null>(null);
  const loaded = useRef(false);
  const retrying = useRef(false);
  const [title, arriveAtTitle] = useStepFocus();
  const [failedTitle, arriveAtFailed] = useStepFocus();
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  useEffect(() => {
    let current = true;
    const askedAgain = loaded.current;

    watch(api.signInRules(organisation.id)).then(
      (page) => {
        if (!current) return;
        loaded.current = true;
        setLoad({ kind: 'loaded', page });
        if (retrying.current) arriveAtTitle();
        retrying.current = false;
      },
      () => {
        if (!current) return;
        const retried = retrying.current;
        retrying.current = false;
        setLoad((before) =>
          askedAgain && before.kind === 'loaded' ? before : { kind: 'failed', retried },
        );
        if (retried) arriveAtFailed();
      },
    );

    return () => {
      current = false;
    };
  }, [organisation.id, attempt, refresh, arriveAtTitle, arriveAtFailed, watch]);

  useEffect(() => {
    markRulesSeen(organisation);
  }, [organisation]);

  const manages = can(session, 'organisation.manage');
  const hold = holdOf(organisation, manages);
  const reader: Reader = {
    t,
    organisation,
    providers: session.providers,
    locale: dateLocale(),
    timezone: session.timezone,
    thisYear: new Date().getFullYear(),
  };
  const toSecurity = (step: Step | null) => {
    if (step != null) void navigate(SECURITY);
  };

  const saved = (page: SignInRulesPage) => {
    const {
      providerOnly,
      inactivityTimeoutDays,
      administratorsNeedTwoFactor,
      everyoneNeedsTwoFactor,
      changedAt,
    } = page;
    const next = {
      ...organisation,
      signInRules: {
        providerOnly,
        inactivityTimeoutDays,
        administratorsNeedTwoFactor,
        everyoneNeedsTwoFactor,
        changedAt,
      },
    };

    setLoad({ kind: 'loaded', page });
    setSeen(changedAt);
    setEdit(null);
    markRulesSeen(next);
    replaceOrganisation(next);
  };

  async function save(page: SignInRulesPage, sent: Edit): Promise<void> {
    const changes = differences(rulesOf(page), applied(sent.key, sent.picked, rulesOf(page)));
    setEdit({ ...sent, saving: true, failed: false });

    try {
      saved(await api.updateSignInRules(organisation.id, changes));
    } catch (error) {
      // Google or Apple unlinked, or two-factor turned off, in another tab say: the pick is refused where it stands.
      const ownGone =
        error instanceof ApiError &&
        (error.is('two_factor_off')
          ? { ownTwoFactor: false }
          : error.is('oauth_only_unlinked')
            ? { ownProvider: false }
            : null);
      const now = ownGone ? { ...page, ...ownGone } : page;
      if (ownGone) setLoad({ kind: 'loaded', page: now });
      setEdit({ ...sent, saving: false, failed: refusalOf(sent.key, sent.picked, now) == null });
    }
  }

  return (
    <DeskPage layers={layers}>
      <div className="desk-column" inert={covered}>
        {refreshing && <Refreshing />}
        <header className="desk-top">
          <h1 ref={title} className="desk-title" tabIndex={-1}>
            {t('signInRules.title')}
          </h1>
        </header>
        {load.kind === 'loading' && <RulesBones words={t('signInRules.loading')} />}
        {load.kind === 'failed' && (
          <div className="desk-failed" role={load.retried ? undefined : 'alert'}>
            <h2 ref={failedTitle} tabIndex={-1}>
              {t('signInRules.failedLoadTitle')}
            </h2>
            <p className="desk-line">{t('signInRules.failedLoadLine')}</p>
            <TextAction
              label={t('signInRules.retry')}
              onClick={() => {
                retrying.current = true;
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            />
          </div>
        )}
        {load.kind === 'loaded' && (
          <Loaded
            page={load.page}
            hold={hold}
            reader={reader}
            seen={seen}
            onStep={toSecurity}
            onOpen={(key) =>
              setEdit({
                key,
                picked: inForce(key, rulesOf(load.page)),
                ask: false,
                saving: false,
                failed: false,
              })
            }
          />
        )}
      </div>
      <div ref={setHost} className="desk-layers" />
      {load.kind === 'loaded' && edit != null && hold == null && (
        <EditDialog
          edit={edit}
          page={load.page}
          reader={reader}
          onStep={toSecurity}
          onEdit={setEdit}
          onClose={() => setEdit(null)}
          onSave={() => {
            if (!edit.saving) void save(load.page, edit);
          }}
        />
      )}
    </DeskPage>
  );
}

function Loaded({
  page,
  hold,
  reader,
  seen,
  onStep,
  onOpen,
}: {
  page: SignInRulesPage;
  hold: Hold;
  reader: Reader;
  seen: string | null;
  onStep: (step: Step | null) => void;
  onOpen: (key: RuleKey) => void;
}) {
  const { t } = reader;
  const rows = whereYouStand(page, hold, reader);
  const card = rulesCard(rows, hold, reader);
  const stand = standFoot(t, page);
  const changed = changedFoot(t, hold, reader.organisation.name);
  const changes = changeRows(page.changes, seen, reader);

  return (
    <>
      <Card>
        <Says>{card.says}</Says>
        <OnCard>{card.line}</OnCard>
        {card.step != null && (
          <CardStep label={stepLabel(t, card.step)} onClick={() => onStep(card.step)} />
        )}
      </Card>
      <section className="desk-block">
        <Head title={t('signInRules.standTitle')} />
        <ul className="desk-rows signin-rows">
          {rows.map((rule) => (
            <li key={rule.key}>
              {hold == null ? (
                <button type="button" className="desk-row" onClick={() => onOpen(rule.key)}>
                  <RuleWords rule={rule} />
                  <span className="signin-change">{t('signInRules.change')}</span>
                </button>
              ) : (
                <div className="desk-row">
                  <RuleWords rule={rule} />
                </div>
              )}
            </li>
          ))}
        </ul>
        {stand != null && <p className="desk-foot">{stand}</p>}
      </section>
      <section className="desk-block">
        <Head title={t('signInRules.whatChangedTitle')} />
        <ul className="desk-rows">
          {changes.length === 0 ? (
            <li className="desk-row">
              <RowWords
                title={t('signInRules.noChangesTitle')}
                lines={[t('signInRules.noChangesLine')]}
              />
            </li>
          ) : (
            changes.map((change) => (
              <li key={change.key} className="desk-row">
                <RowWords
                  title={change.title}
                  tag={change.isNew && <Tag kind="now" word={t('signInRules.changeNew')} />}
                  lines={[change.line]}
                />
              </li>
            ))
          )}
        </ul>
        {changed != null && <p className="desk-foot">{changed}</p>}
      </section>
    </>
  );
}

/** The mark, its word for a screen reader, the rule in a few words and its lines about you. */
function RuleWords({ rule }: { rule: RuleRow }) {
  const { t } = useTranslation();
  const word = {
    met: t('signInRules.markMet'),
    needs: t('signInRules.markNeeds'),
    notApplicable: t('signInRules.markNotApplicable'),
  }[rule.mark];

  return (
    <>
      <RuleMark mark={rule.mark} />
      <span className="desk-unseen">{word} </span>
      <RowWords title={rule.title} lines={rule.lines} />
    </>
  );
}

/** One rule's choices, what saving does, and nothing saved before the verb. */
function EditDialog({
  edit,
  page,
  reader,
  onStep,
  onEdit,
  onClose,
  onSave,
}: {
  edit: Edit;
  page: SignInRulesPage;
  reader: Reader;
  onStep: (step: Step) => void;
  onEdit: (edit: Edit) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t, organisation } = reader;
  const none = useRef<HTMLElement>(null);
  const rules = rulesOf(page);
  const changed = edit.picked !== inForce(edit.key, rules);
  const refusal = refusalOf(edit.key, edit.picked, page);
  const refused = refusal == null ? null : REFUSALS[refusal];
  const title = editTitle(t, edit.key);
  const stays = whereYouStand(page, null, reader).find((row) => row.key === edit.key)?.title;
  let after: ReactNode;

  if (refused != null)
    after = (
      <Refused>
        <p className="desk-empty-title">{t(refused.title)}</p>
        <p className="desk-line">{t(refused.line)}</p>
        <TextAction label={stepLabel(t, refused.step)} onClick={() => onStep(refused.step)} />
      </Refused>
    );
  else if (edit.failed)
    after = (
      <Refused>
        <p className="desk-line">{t('signInRules.failedSave')}</p>
      </Refused>
    );
  else
    after = (
      <div className="desk-after">
        <Head title={t('signInRules.effectsTitle')} level={3} />
        {effectsOf(t, page, applied(edit.key, edit.picked, rules), currentLocale()).map((line) => (
          <p key={line} className="desk-line">
            {line}
          </p>
        ))}
        {changed && <p className="desk-foot">{t('signInRules.emailNote')}</p>}
      </div>
    );

  return (
    <>
      <Dialog
        title={title}
        verb={edit.saving ? t('signInRules.saving') : t('signInRules.saveVerb')}
        on={changed && refusal == null}
        locked={edit.saving}
        first={none}
        onDismiss={() => {
          if (edit.saving) return;
          if (changed) onEdit({ ...edit, ask: true });
          else onClose();
        }}
        onConfirm={onSave}
      >
        {edit.key === 'limit' && <Note>{t('signInRules.idleIntro')}</Note>}
        <Choices
          legend={title}
          hideLegend
          choices={choicesOf(t, edit.key, page, organisation.name)}
          picked={edit.picked}
          onPick={(picked) => onEdit({ ...edit, picked, failed: false })}
        />
        {after}
      </Dialog>
      {edit.ask && (
        <Ask
          title={t('signInRules.discardTitle')}
          line={t('signInRules.discardLine', { rule: stays ?? title })}
          keep={t('signInRules.discardKeep')}
          go={t('signInRules.discardGo')}
          onKeep={() => onEdit({ ...edit, ask: false })}
          onGo={onClose}
        />
      )}
    </>
  );
}

function Refused({ children }: { children: ReactNode }) {
  return (
    <div className="signin-refusal" role="alert">
      <Glyph name="alert" size={20} weight={2.2} />
      <div className="desk-after">{children}</div>
    </div>
  );
}
