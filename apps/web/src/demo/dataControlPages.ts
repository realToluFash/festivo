import { type PageLinks, linkTo } from './dataControl.ts';
import { type DemoLink, VIEWERS, settingsPath } from './settings.ts';
import { way } from './rules.ts';

const hub = (state: string | undefined, name: string, viewer = VIEWERS.folake) =>
  linkTo('hub', state, name, viewer);
const domains = (state: string, name: string, viewer = VIEWERS.folake) =>
  linkTo('emailDomains', state, name, viewer);
const audit = (state: string, name: string) => linkTo('auditLog', state, name);
const exported = (state: string, name: string, viewer = VIEWERS.folake) =>
  linkTo('export', state, name, viewer);
const retention = (state: string | undefined, name: string, viewer = VIEWERS.folake) =>
  linkTo('deleteGuestData', state, name, viewer);
const request = (state: string, name: string) => linkTo('guestRequest', state, name);

/** Their data at the foot of Dr Emeka Nwosu's details in Guests A: `state=guest` opens him, `data=` its state. */
export function theirDataPath(data: string): string {
  return `/demo/guests?state=guest&data=${data}`;
}

const their = (data: string, name: string): DemoLink => ({ to: theirDataPath(data), name });

/** Data and control's states as the demo's home lists them, a group per page (enterprise-b-spec §3). */
export const DATA_CONTROL_PAGES: PageLinks = [
  {
    name: 'The list and Data and control',
    states: [
      hub(undefined, 'An owner: your export is ready, Download'),
      hub(undefined, 'An admin in London: ireevents.com waiting, See the record', VIEWERS.julien),
      hub('quiet', 'Nothing needs your attention'),
      hub('new', 'Nothing set up yet: Prove a domain'),
      hub('locked', 'Never on Enterprise: three of these locked'),
      hub('downgraded', 'Left Enterprise: kept as they were'),
      hub(undefined, 'A member: no Data and control', VIEWERS.ana),
      hub('loading', 'Loading'),
      hub('failed', 'Failed'),
    ],
  },
  {
    name: 'Email domains',
    states: [
      domains('domains', 'ire.events proved, ireevents.com waiting'),
      domains('domains', 'The same, an admin: no switch', VIEWERS.julien),
      domains('ed_empty', 'No domains yet'),
      domains('ed_add', 'Prove a domain, nothing typed'),
      domains('ed_blank', 'Add with nothing'),
      domains('ed_invalid', '“ire events”: not a domain'),
      domains('ed_public', '“gmail.com”: a public domain'),
      domains('ed_taken', '“lumenfeiras.pt”: proved elsewhere'),
      domains('ed_record', 'The record'),
      domains('ed_checking', 'Verifying…'),
      domains('ed_not_found', 'Not found yet'),
      domains('ed_proved', 'ireevents.com proved'),
      domains('ed_failed', 'ireevents.com not proved'),
      domains('ed_lapsing', 'The record for ire.events is missing'),
      domains('ed_lapsing', 'The record missing, an admin in London', VIEWERS.julien),
      domains('ed_remove', 'Remove ire.events?'),
      domains('ed_removed', 'ire.events removed'),
      domains('ed_locked', 'Never on Enterprise'),
      domains('ed_downgraded', 'Left Enterprise: kept'),
      domains('oo_off', 'Only our organisation off'),
      domains('oo_confirm', 'Limit ire.events accounts to Ire Events?'),
      domains('oo_scheduled', 'Scheduled, with Cancel'),
      domains('oo_cancelled', 'Cancelled'),
      domains('oo_on', 'On since Saturday, Oct 3'),
      domains('oo_turned_off', 'Turned off'),
      domains('oo_not_owner', 'Scheduled, an admin reads it', VIEWERS.julien),
      domains('loading', 'Loading'),
      domains('failed', 'Failed'),
    ],
  },
  {
    name: 'Audit log',
    states: [
      audit('list', 'The entries by day'),
      audit('filter_person', 'The person menu open'),
      audit('filter_type', 'The type menu open'),
      audit('filter_event', 'The event menu open'),
      audit('dates', 'Dates, Oct 1 to Oct 19'),
      audit('date_invalid', 'Dates the wrong way round'),
      audit('filtered', 'Sign-in and security only'),
      audit('empty_filter', 'Ana Souza and Events: no entry'),
      audit('detail', 'An entry: Made Ireti at 40 live'),
      audit('detail_gone', 'An entry on a deleted event'),
      audit('detail_signin', 'An entry with its address and device'),
      audit('detail_old', 'An entry from before devices were kept'),
      audit('detail_system', 'An entry by System'),
      audit('export', 'Export these entries'),
      audit('export_small', 'Exported: downloading'),
      audit('export_preparing', 'Exported: preparing, emailed'),
      audit('export_too_many', 'Over 1,000,000: nothing starts'),
      audit('locked', 'Never on Enterprise'),
      audit('loading', 'Loading'),
      audit('failed', 'Failed'),
    ],
  },
  {
    name: 'Export all data',
    states: [
      exported('ex_idle', 'Nothing asked yet'),
      exported('ex_preparing', 'Preparing'),
      exported('ex_ready', 'Ready, Download'),
      exported('ex_ready_other', 'Ready, an admin sees Folake’s', VIEWERS.julien),
      exported('ex_used', 'Downloaded'),
      exported('ex_used_link', 'The emailed link, used'),
      exported('ex_expired', 'The link ended'),
      exported('ex_limited', 'Pressed again on a stale page: refused'),
      exported('ex_failed', 'Didn’t finish'),
      exported('not_owner', 'An admin, nothing asked', VIEWERS.julien),
      exported('loading', 'Loading'),
      exported('failed', 'Failed'),
    ],
  },
  {
    name: 'Delete guest data after an event (#1544, one level down)',
    states: [
      retention('rt_off', 'Off, an owner'),
      retention('rt_off', 'Off, an admin reads it', VIEWERS.julien),
      retention('rt_locked', 'Locked, never on Enterprise, an owner'),
      retention('rt_locked', 'Locked, never on Enterprise, an admin', VIEWERS.julien),
      retention('rt_downgraded', 'Left Enterprise: the period and a hold kept, an owner'),
      retention('rt_downgraded', 'Left Enterprise, an admin sees the same', VIEWERS.julien),
      retention(undefined, 'A member has none', VIEWERS.ana),
      retention('rt_turned_off', 'Turned off: asked nothing, next run cancelled'),
      retention('rt_confirm', 'Turning on, 2 events'),
      retention('rt_confirm_one', 'Turning on, 1 event'),
      retention('rt_confirm_none', 'Turning on, no event'),
      retention('rt_change', 'Changing the period replaces the run'),
      retention('rt_refused_owner', 'Refused, owner_required'),
      retention('rt_refused_plan', 'Refused, plan_required'),
      retention('rt_on', 'On, the next run and its events'),
      retention('rt_on_empty', 'On, a run with no events'),
      retention('rt_on_utc', 'On, an account with no zone: labelled UTC'),
      retention('rt_on', 'On, an admin in London', VIEWERS.julien),
      retention('rt_hold', 'Holding an event back'),
      retention('rt_hold_blank', 'A blank reason holds nothing'),
      retention('rt_hold_long', 'A reason over 500 characters holds nothing'),
      retention('rt_hold', 'An admin holding an event back', VIEWERS.julien),
      retention('rt_held', 'Held events, an owner'),
      retention('rt_held_long', 'A long reason, in full and wrapped'),
      retention('not_owner', 'Held events, an admin: period read only', VIEWERS.julien),
      retention('rt_released', 'Released'),
      retention('rt_off_held', 'Off: a hold kept, with Release'),
      retention('rt_off_released', 'Off: released, no longer held back'),
      retention('loading', 'Loading'),
      retention('failed', 'Failed'),
    ],
  },
  {
    name: 'A guest’s request',
    states: [
      request('find', 'Nothing typed'),
      request('find_blank', 'Find with nothing'),
      request('find_invalid', '“emeka nwosu”: neither'),
      request('find_none', '“nobody@example.com”: nobody'),
      request('found', '“emeka.nwosu@nhs.net”: Their data'),
      request('loading', 'Loading'),
      request('failed', 'Failed'),
    ],
  },
  {
    name: 'Their data, on Dr Emeka Nwosu’s details in Guests',
    states: [
      their('covered', 'The 4 records and both actions'),
      their('member', 'A member: no Their data'),
      their('preparing', 'Preparing their export'),
      their('ready', 'Their export is ready'),
      their('other_admin', 'An admin while Folake’s is ready'),
      their('failed', 'Their export did not finish'),
      their('link_used', 'The download used or expired'),
      their('set_changed_export', 'The records changed: 5'),
      their('erase_question', 'Erase from every event?'),
      their('set_changed_erase', 'Erase, the records changed'),
      their('erasing', 'Erasing…'),
      their('erased', 'Erased guest'),
    ],
  },
  {
    name: 'Outside Settings',
    states: [
      {
        to: settingsPath('general', VIEWERS.folake, 'domainBoth'),
        name: 'General: ire.events on both lists, Proved',
      },
      { to: '/demo/events?create=managed', name: 'Create an organisation: managed by Ire Events' },
      { to: '/demo/events?switcher=managed', name: 'An invitation to join: managed by Ire Events' },
      { to: way('ask', 'managed'), name: 'A request link: managed by Ire Events' },
      {
        to: way('details', 'managed'),
        name: 'A few details: managed, no Start my own organisation',
      },
      {
        to: settingsPath('members', VIEWERS.folake, 'alsoMember'),
        name: 'Members: Priya, also a member of 2 others',
      },
    ],
  },
];
