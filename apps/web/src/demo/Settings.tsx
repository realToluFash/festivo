import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { Toast } from '../components/Toast.tsx';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import {
  type Drawn,
  type Section,
  SECTION_NAMES,
  SIDEBAR_EVENTS,
  type Viewer,
  groupsFor,
  isDrawn,
  settingsPath,
  viewerOf,
} from './settings.ts';
import { Account } from './Account.tsx';
import { DataControl } from './DataControl.tsx';
import { type DataControlPage, dataControlViewerKey } from './dataControl.ts';
import { DrawnGlyph } from './DataControlParts.tsx';
import { General } from './General.tsx';
import { LayersContext } from '../layers.ts';
import { Members } from './Members.tsx';
import { Notifications } from './Notifications.tsx';
import { PaymentReminders } from './Payments.tsx';
import { HeldStandIn } from './OrgSwitcher.tsx';
import { Personalisation } from './Personalisation.tsx';
import { PersonalTile } from './SchemeArt.tsx';
import { underSavedName, useSavedNames } from './savedName.ts';
import { Security } from './Security.tsx';
import { SignInRules } from './SignInRules.tsx';
import { SingleSignOn } from './SingleSignOn.tsx';
import { Vendors } from './Vendors.tsx';
import { vendorsViewerKey } from './vendors.ts';
import { SectionTile, SettingsSections } from '../components/SettingsList.tsx';
import { TextAction, TitleRow, type Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { DemoOffline } from './DemoOffline.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import { DeskSearch } from './Search.tsx';
import { usePhoneWidth } from '../phoneWidth.ts';
import { reachOfRole } from './search.ts';
import { PAUSED, useHeld, usePaused, useSwitcherStart } from './switcher.ts';
import './today.css';
import './phone.css';
import '../components/SettingsParts.css';

const TILES: Record<
  Exclude<Section, 'account' | 'general' | 'personalisation' | 'vendors' | 'data'>,
  GlyphName
> = {
  security: 'shield',
  notifications: 'bell',
  members: 'users',
  signInRules: 'lock',
};

/** Settings at a desk in B · Summary first (Web-Settings.dc.html, page 29), on sample data. */
export function Settings({
  open = 'members',
  reminders = false,
  page = 'hub',
  sso = false,
}: {
  open?: Drawn;
  reminders?: boolean;
  page?: DataControlPage;
  sso?: boolean;
}) {
  const [params] = useSearchParams();
  const state = params.get('state') ?? '';
  const as = params.get('as');
  const viewer = viewerOf(
    open === 'vendors'
      ? vendorsViewerKey(as, state)
      : open === 'data'
        ? dataControlViewerKey(page, as, state)
        : as,
  );
  const names = useSavedNames();
  const seen = useMemo(() => underSavedName(viewer, names), [viewer, names]);
  useSwitcherStart();
  const held = useHeld();
  const paused = usePaused();
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const [stack, setStack] = useState<readonly string[]>([]);
  const push = useCallback(
    (id: string) => setStack((now) => [...now.filter((one) => one !== id), id]),
    [],
  );
  const pop = useCallback((id: string) => setStack((now) => now.filter((one) => one !== id)), []);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const layers = useMemo(() => ({ stack, push, pop, host }), [stack, push, pop, host]);
  const covered = stack.length > 0;
  const fit = open === 'vendors' && !reminders;
  const atPhone = usePhoneWidth();
  const shell = fit ? 'today desk dp-fit' : atPhone ? 'today desk dp-bar' : 'today desk';

  return (
    <LayersContext value={layers}>
      <div className={shell}>
        <DeskSearch reach={reachOfRole(viewer.role)} tell={tell}>
          <TodaySidebar
            events={SIDEBAR_EVENTS}
            tell={tell}
            settings
            person={seen}
            inert={covered}
            phone={fit || atPhone}
            bell={atPhone && <DemoBell tell={tell} />}
          />
          <main id="content" className="desk-main" inert={covered}>
            <>
              <SettingsList
                open={
                  (open !== 'members' && open !== 'vendors' && open !== 'data') || viewer.manages
                    ? open
                    : null
                }
                viewer={seen}
                paused={paused}
                tell={tell}
              />
              {held && !YOURS.includes(open) ? (
                <div className="desk-page">
                  <HeldStandIn />
                </div>
              ) : open === 'account' ? (
                <Account key={`${viewer.key}:${state}`} viewer={viewer} state={state} tell={tell} />
              ) : open === 'security' ? (
                <Security
                  key={`${viewer.key}:${state}`}
                  viewer={viewer}
                  state={state}
                  tell={tell}
                />
              ) : open === 'notifications' ? (
                <Notifications key={`${viewer.key}:${state}`} state={state} tell={tell} />
              ) : open === 'personalisation' ? (
                <Personalisation key={`${viewer.key}:${state}`} state={state} tell={tell} />
              ) : open === 'general' ? (
                <General key={`${viewer.key}:${state}`} viewer={viewer} state={state} tell={tell} />
              ) : open === 'signInRules' && sso ? (
                <SingleSignOn
                  key={`sso:${viewer.key}:${state}:${params.get('plan') ?? ''}`}
                  viewer={viewer}
                  state={state}
                  plan={params.get('plan') === 'free' ? 'free' : 'enterprise'}
                  tell={tell}
                />
              ) : open === 'signInRules' ? (
                <SignInRules
                  key={`${viewer.key}:${state}`}
                  viewer={viewer}
                  state={state}
                  tell={tell}
                />
              ) : open === 'data' && viewer.manages ? (
                <DataControl
                  key={`${page}:${viewer.key}:${state}`}
                  page={page}
                  viewer={viewer}
                  state={state}
                  tell={tell}
                />
              ) : open === 'vendors' && reminders ? (
                <PaymentReminders key={`${viewer.key}:${state}`} viewer={viewer} state={state} />
              ) : open === 'vendors' && viewer.manages ? (
                <Vendors
                  key={`${viewer.key}:${state}:${params.get('vendor') ?? ''}`}
                  state={state}
                  tell={tell}
                  bell={!atPhone}
                />
              ) : viewer.manages ? (
                <Members
                  key={`${open}:${viewer.key}:${state}`}
                  viewer={viewer}
                  state={state}
                  tell={tell}
                />
              ) : open === 'members' || open === 'vendors' ? (
                <Forbidden tell={tell} />
              ) : (
                <div className="desk-page" />
              )}
            </>
          </main>
          <div ref={setHost} className="desk-layers" />
        </DeskSearch>
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
      </div>
    </LayersContext>
  );
}

/** Your account's own sections: they stay open while access to the organisation is paused or two-factor is overdue, as in the product. */
const YOURS: readonly Drawn[] = ['account', 'security', 'notifications', 'personalisation'];

/** Members or Vendors for a role without their read permission, as the product's shared Forbidden page refuses it. */
function Forbidden({ tell }: { tell: Tell }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="desk-page">
      <div className="desk-column" role="alert">
        <DemoOffline />
        <TitleRow title={t('forbidden.title')} bell={<DemoBell tell={tell} />} />
        <p className="desk-line">{t('forbidden.body')}</p>
        <TextAction label={t('forbidden.back')} onClick={() => void navigate('/demo/today')} />
      </div>
    </div>
  );
}

/** Your account's sections, then the organisation's, drawn by the product's list: a section with no design yet says so. While paused, the organisation's are the paused one's, General with its initials (sc-86077). */
function SettingsList({
  open,
  viewer,
  paused,
  tell,
}: {
  open: Drawn | null;
  viewer: Viewer;
  paused: boolean;
  tell: Tell;
}) {
  const groups = groupsFor(viewer, paused).map((group) => ({
    name: group.name,
    entries: group.sections.map((section) => ({
      section,
      label: SECTION_NAMES[section],
      tile: <Tile section={section} viewer={viewer} paused={paused} />,
      ...(isDrawn(section)
        ? { to: settingsPath(section, viewer) }
        : { onPress: () => tell(`${SECTION_NAMES[section]} has its own design.`) }),
    })),
  }));

  return (
    <SettingsSections
      label="Settings"
      groups={groups}
      open={groups.flatMap((group) => group.entries).find((entry) => entry.section === open)}
    />
  );
}

function Tile({ section, viewer, paused }: { section: Section; viewer: Viewer; paused: boolean }) {
  if (section === 'account') return <SectionTile look="account">{viewer.initials}</SectionTile>;
  if (section === 'personalisation') return <PersonalTile />;
  if (section === 'general')
    return <SectionTile look="general">{paused ? PAUSED.initials : 'IE'}</SectionTile>;
  if (section === 'vendors')
    return (
      <SectionTile look="vendors">
        <Glyph name="storefront" size={17} />
      </SectionTile>
    );
  if (section === 'data')
    return (
      <SectionTile look="data">
        <DrawnGlyph name="data" size={17} />
      </SectionTile>
    );

  return (
    <SectionTile look={section === 'signInRules' ? 'sign-in-rules' : section}>
      <Glyph name={TILES[section]} size={17} />
    </SectionTile>
  );
}
