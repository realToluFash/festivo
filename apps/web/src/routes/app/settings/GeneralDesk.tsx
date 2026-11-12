import { type CompanyDomains, type Membership, type RequestLink } from '@soirely/api-client';
import {
  countryChoices,
  heldCurrencyLabel,
  initials,
  keptBackBy,
  roleName,
  timezoneLabel,
} from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Bones, Switch } from '../../../components/GeneralParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import {
  Ask,
  Card,
  CardStep,
  DeskPage,
  Head,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { useOffline } from '../../../offline.ts';
import { can, useSession } from '../../../session.ts';
import { AddDomainDialog, DetailsDialog } from './GeneralDeskDialogs.tsx';
import { Ownership } from './GeneralDeskOwnership.tsx';
import { languageName, rereadOrganisation } from './organisationDetails.ts';
import { SECURITY, securityOn } from './signInRulesDesk.ts';
import '../../../components/SettingsParts.css';

type Said = { kind: 'saved'; line: string } | { kind: 'transferred'; to: string };

type Tell = (words: string) => void;

/** General at a desk in B · Summary first (sc-30191), as the design demo's /demo/settings/general draws it. */
export function GeneralDesk() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const organisationId = organisation?.id;
  const title = useRef<HTMLHeadingElement>(null);
  const { layers, covered, setHost } = useDeskLayers();
  const [said, setSaid] = useState<{ id: string; said: Said } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [told, setTold] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const { watch, refreshing } = useOffline({
    loaded: loadedFor != null && loadedFor === organisationId,
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  // The page draws the session's organisation; this read is what the offline band dates.
  useEffect(() => {
    if (organisationId == null) return;
    let current = true;

    rereadOrganisation(organisationId, watch).then(
      () => current && setLoadedFor(organisationId),
      () => {},
    );

    return () => {
      current = false;
    };
  }, [organisationId, refresh, watch]);

  if (organisation == null) return null;

  const manages = can(session, 'organisation.manage');
  const joins = can(session, 'members.manage');
  const shown = said?.id === organisation.id ? said.said : null;

  return (
    <DeskPage layers={layers}>
      <div className="desk-column general-desk" inert={covered}>
        {refreshing && <Refreshing />}
        <TitleRow title={t('orgGeneral.title')} titleRef={title} />
        <OrganisationCard
          organisation={organisation}
          said={shown}
          manages={manages}
          onEdit={() => setEditing(organisation.id)}
        />
        <Details organisation={organisation} />
        {joins && (
          <Domains key={`domains:${organisation.id}`} organisation={organisation} tell={setTold} />
        )}
        {joins && (
          <RequestLinkBlock
            key={`link:${organisation.id}`}
            organisation={organisation}
            tell={setTold}
          />
        )}
        <Ownership
          key={`ownership:${organisation.id}`}
          organisation={organisation}
          onTransferred={(to) =>
            setSaid({ id: organisation.id, said: { kind: 'transferred', to } })
          }
        />
      </div>
      <div ref={setHost} className="desk-layers" />
      {editing === organisation.id && (
        <DetailsDialog
          organisation={organisation}
          onClose={() => setEditing(null)}
          onSaved={(line) => {
            setEditing(null);
            setSaid({ id: organisation.id, said: { kind: 'saved', line } });
          }}
        />
      )}
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </DeskPage>
  );
}

/** The organisation's tile, name and contact, or what was just done in their place; the lock lines when the viewer only reads. */
function OrganisationCard({
  organisation,
  said,
  manages,
  onEdit,
}: {
  organisation: Membership;
  said: Said | null;
  manages: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const rules = manages ? [] : keptBackBy(organisation, 'organisation.manage');

  return (
    <Card size="person">
      <div aria-live="polite">
        {said == null ? (
          <div className="desk-who">
            <span className="desk-disc general-tile" aria-hidden="true">
              {initials(organisation.name)}
            </span>
            <div className="desk-who-words">
              <p className="desk-name">{organisation.name}</p>
              <OnCard>{organisation.contactAddress}</OnCard>
            </div>
          </div>
        ) : said.kind === 'saved' ? (
          <>
            <Says>{t('generalDesk.savedSays')}</Says>
            <OnCard>{said.line}</OnCard>
          </>
        ) : (
          <>
            <Says>{t('generalDesk.transferredSays', { name: said.to })}</Says>
            <OnCard>{t('generalDesk.transferredLine')}</OnCard>
          </>
        )}
      </div>
      {manages ? (
        <CardStep label={t('generalDesk.edit')} onClick={onEdit} />
      ) : rules.length === 0 ? (
        <Lock line={t('orgGeneral.readOnly', { role: roleName(t, organisation.role) })} />
      ) : (
        rules.map((rule) => (
          <div key={rule} className="general-held">
            <Lock
              line={t(
                rule === 'linking'
                  ? 'orgGeneral.readOnlyUntilLinked'
                  : 'orgGeneral.readOnlyUntilTwoFactor',
                { organisation: organisation.name },
              )}
            />
            <Link
              className="desk-step"
              to={SECURITY}
              state={securityOn(rule === 'linking' ? 'link' : 'turnOn')}
            >
              {t(rule === 'linking' ? 'signInRules.unlinkedLink' : 'signInRules.gateTurnOn')}
              <Glyph name="arrow" size={16} weight={2.4} />
            </Link>
          </div>
        ))
      )}
    </Card>
  );
}

function Lock({ line }: { line: string }) {
  return (
    <div className="general-lock">
      <Glyph name="lock" size={16} weight={2.2} />
      <OnCard>{line}</OnCard>
    </div>
  );
}

function Details({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const country =
    countryChoices(locale).find(({ code }) => code === organisation.countryCode)?.name ??
    organisation.countryCode;
  const rows = [
    { label: t('orgGeneral.country'), value: country },
    {
      label: t('orgGeneral.currency'),
      value: heldCurrencyLabel(organisation.currency, locale, (code) =>
        t('orgGeneral.currencyRetired', { code }),
      ),
    },
    { label: t('orgGeneral.timezone'), value: timezoneLabel(organisation.timezone) },
    { label: t('orgGeneral.language'), value: languageName(t, organisation.locale) },
  ];

  return (
    <section className="desk-block">
      <Head title={t('generalDesk.details')} />
      <ul className="desk-rows">
        {rows.map((row) => (
          <li key={row.label} className="desk-row is-plain">
            <RowWords title={row.value} lines={[row.label]} />
          </li>
        ))}
      </ul>
      <p className="desk-foot">{t('orgGeneral.defaultsNote')}</p>
    </section>
  );
}

function Domains({ organisation, tell }: { organisation: Membership; tell: Tell }) {
  const { t } = useTranslation();
  const section = useRef<HTMLElement>(null);
  const [list, setList] = useState<CompanyDomains | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;

    api.companyDomains(organisation.id).then(
      (found) => current && setList(found),
      () => current && setUnreadable(true),
    );

    return () => {
      current = false;
    };
  }, [organisation.id]);

  const full = list != null && list.domains.length >= list.most;
  const lead = t('generalDesk.domainsLead', { organisation: organisation.name });

  async function remove(domain: string): Promise<void> {
    setBusy(true);
    setFailed(false);

    try {
      setList(await api.removeCompanyDomain(organisation.id, domain));
      if (added === domain) setAdded(null);
      setRemoving(null);
      tell(t('companyDomains.removed', { domain }));
      // Its row has gone, so focus lands on Add domain once the confirm has handed it back.
      focusWhenFree(() => section.current?.querySelector('button') ?? null);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section ref={section} className="desk-block">
      <Head title={t('companyDomains.title')}>
        {list != null && !full && (
          <TextAction label={t('companyDomains.add')} onClick={() => setAdding(true)} />
        )}
      </Head>
      {list == null ? (
        unreadable ? (
          <div className="desk-failed" role="alert">
            <p className="desk-empty-title">{t('companyDomains.unreadable')}</p>
          </div>
        ) : (
          <Bones count={3} label={t('pending.loading')} />
        )
      ) : list.domains.length === 0 ? (
        <div className="desk-empty">
          <p className="desk-empty-title">{t('companyDomains.off')}</p>
          <p className="desk-line">{t('generalDesk.domainsOffUntil')}</p>
        </div>
      ) : (
        <ul className="desk-rows general-domains" aria-label={t('companyDomains.listLabel')}>
          {list.domains.map(({ domain, stopped }) => (
            <li key={domain} className="desk-row">
              <span className="general-globe" aria-hidden="true">
                <Glyph name="globe" size={22} />
              </span>
              <RowWords
                title={domain}
                tag={stopped && <Tag kind="waiting" word={t('companyDomains.stopped')} />}
                lines={[
                  stopped
                    ? t('companyDomains.stoppedBody', { domain })
                    : domain === added
                      ? t('generalDesk.domainAdded')
                      : t('companyDomains.working'),
                ]}
              />
              <button
                type="button"
                className="desk-text is-red"
                aria-label={t('companyDomains.removeLabel', { domain })}
                onClick={() => {
                  setFailed(false);
                  setRemoving(domain);
                }}
              >
                {t('companyDomains.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="desk-foot">
        {full ? `${lead} ${t('companyDomains.full', { count: list.most })}` : lead}
      </p>
      {adding && list != null && (
        <AddDomainDialog
          organisation={organisation}
          list={list}
          onClose={() => setAdding(false)}
          onAdded={(next, domain) => {
            setAdding(false);
            setList(next);
            setAdded(domain);
          }}
        />
      )}
      {removing != null && (
        <Ask
          title={t('companyDomains.removeTitle', { domain: removing })}
          line={t('companyDomains.removeBody', { domain: removing })}
          keep={t('companyDomains.keep')}
          go={t('companyDomains.removeConfirm', { domain: removing })}
          busy={busy ? t('companyDomains.removeConfirm', { domain: removing }) : undefined}
          failed={failed ? t('companyDomains.failed') : undefined}
          onKeep={() => setRemoving(null)}
          onGo={() => void remove(removing)}
        />
      )}
    </section>
  );
}

function RequestLinkBlock({ organisation, tell }: { organisation: Membership; tell: Tell }) {
  const { t } = useTranslation();
  const [link, setLink] = useState<RequestLink | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceFailed, setReplaceFailed] = useState(false);

  useEffect(() => {
    let current = true;

    api.requestLink(organisation.id).then(
      (found) => current && setLink(found),
      () => current && setUnreadable(true),
    );

    return () => {
      current = false;
    };
  }, [organisation.id, attempt]);

  async function turn(on: boolean): Promise<void> {
    setBusy(true);
    setFailed(false);

    try {
      setLink(
        await (on
          ? api.turnOnRequestLink(organisation.id)
          : api.turnOffRequestLink(organisation.id)),
      );
      setReplaced(false);
      if (on) tell(t('requestLink.flash.on'));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function replace(): Promise<void> {
    setBusy(true);
    setReplaceFailed(false);

    try {
      setLink(await api.replaceRequestLink(organisation.id));
      setReplaced(true);
      setReplacing(false);
    } catch {
      setReplaceFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (link == null)
    return (
      <section className="desk-block">
        <Head title={t('requestLink.title')} />
        {unreadable ? (
          <div className="desk-failed" role="alert">
            <p className="desk-empty-title">{t('generalDesk.linkUnreadable')}</p>
            <TextAction
              label={t('generalDesk.tryAgain')}
              onClick={() => {
                setUnreadable(false);
                setAttempt((count) => count + 1);
              }}
            />
          </div>
        ) : (
          <Bones count={1} label={t('pending.loading')} />
        )}
      </section>
    );

  const url = link.on ? link.url : null;

  return (
    <section className="desk-block">
      <Head title={t('requestLink.title')} />
      <ul className="desk-rows">
        <li className="desk-row">
          <RowWords
            title={t('requestLink.linkLabel')}
            lines={[
              url == null ? (
                t('requestLink.flash.off')
              ) : (
                <span className="general-link">{url}</span>
              ),
            ]}
          />
          <Switch
            on={link.on}
            label={t('requestLink.switchLabel')}
            words={{ on: t('requestLink.on'), off: t('requestLink.off') }}
            busy={busy}
            onChange={(next) => void turn(next)}
          />
        </li>
      </ul>
      {failed && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('requestLink.failed')}
        </p>
      )}
      {url != null && (
        <div className="desk-red">
          <div className="general-pair">
            <TextAction
              label={t('requestLink.copy')}
              before="copy"
              onClick={() =>
                void navigator.clipboard.writeText(url).then(
                  () => tell(t('requestLink.flash.copied')),
                  () => setFailed(true),
                )
              }
            />
            <TextAction
              label={t('requestLink.replace')}
              red
              onClick={() => {
                setReplaceFailed(false);
                setReplacing(true);
              }}
            />
          </div>
          <p className="desk-note" role="status">
            {replaced ? t('requestLink.flash.replaced') : t('requestLink.replaceBody')}
          </p>
        </div>
      )}
      <p className="desk-foot">
        {`${t('generalDesk.linkLead', { organisation: organisation.name })} ${t('requestLink.help')}`}
      </p>
      {replacing && (
        <Ask
          title={t('requestLink.replaceTitle')}
          line={t('requestLink.replaceBody')}
          keep={t('requestLink.keep')}
          go={t('requestLink.replaceConfirm')}
          busy={busy ? t('requestLink.replaceConfirm') : undefined}
          failed={replaceFailed ? t('requestLink.failed') : undefined}
          onKeep={() => setReplacing(false)}
          onGo={() => void replace()}
        />
      )}
    </section>
  );
}
