import {
  CHANNELS,
  type Channel,
  type Press,
  type Visit,
  type WhatsAppConsent,
  type Yours,
} from './guest.ts';

export interface ChannelRow {
  channel: Channel;
  has: boolean;
  on: boolean;
  /** Where the switch is drawn: the pressed side while its change is recorded. */
  shown: boolean;
  saved: boolean;
  saving: boolean;
  failed: boolean;
  whatsAppLine: boolean;
}

type Reached = Pick<Visit, 'mobile' | 'whatsApp' | 'reach' | 'yours'>;

export function whatsAppOn(consent: WhatsAppConsent): boolean {
  return consent === 'agreed' || consent === 'hostRecorded';
}

function hasAddress(visit: Pick<Visit, 'mobile' | 'yours'>, channel: Channel): boolean {
  return channel === 'email' ? visit.yours.emailAddress : visit.mobile;
}

/** sc-3969's three rows: Email has a switch with an email address on record, the other two with a mobile number (sc-1468). */
export function channelRows(visit: Reached): ChannelRow[] {
  return CHANNELS.map((channel) => {
    const has = hasAddress(visit, channel);
    const on = has && (channel === 'whatsApp' ? whatsAppOn(visit.whatsApp) : visit.reach[channel]);
    const saving = has && visit.yours.busy === channel;

    return {
      channel,
      has,
      on,
      shown: saving ? !on : on,
      saved: has && visit.reach.saved === channel,
      saving,
      failed: has && visit.yours.failed === channel,
      whatsAppLine: has && channel === 'whatsApp',
    };
  });
}

/** One switch pressed, saved at once on the sample: WhatsApp on is the guest's agreement, off ends it. */
export function switched(visit: Reached, channel: Channel): Partial<Visit> {
  if (!hasAddress(visit, channel)) return {};
  const reach = { ...visit.reach, saved: channel };

  if (channel === 'whatsApp') {
    return { reach, whatsApp: whatsAppOn(visit.whatsApp) ? 'stopped' : 'agreed' };
  }

  return { reach: { ...reach, [channel]: !visit.reach[channel] } };
}

/** A press starts its save; while one is recorded every press does nothing, and any other change clears the failed line. */
export function saving(
  visit: Pick<Visit, 'yours'>,
  press: Press,
  retrying = false,
): Partial<Visit> {
  const { yours } = visit;
  if (yours.busy != null) return {};

  return {
    yours: { ...yours, busy: press, retrying, failed: yours.failed === press ? press : null },
  };
}

/** The save recorded: the button and Undo leave their words in the button's place, and Email turned by hand removes them. */
export function saved(visit: Reached, press: Press): Partial<Visit> {
  const done: Yours = { ...visit.yours, busy: null, retrying: false, failed: null };

  if (press === 'stop' || press === 'undo') {
    const on = press === 'undo';

    return {
      reach: { ...visit.reach, email: on, saved: null },
      yours: { ...done, lead: on ? 'undone' : 'stopped' },
    };
  }

  const change = switched(visit, press);
  if (change.reach == null) return {};

  return { ...change, yours: { ...done, lead: press === 'email' ? null : visit.yours.lead } };
}

/** An opened state that was held: the save it was recording lands, or the page it was loading opens. */
export function landed(visit: Reached): Partial<Visit> {
  const { busy } = visit.yours;

  return busy == null ? { yours: { ...visit.yours, opening: 'open' } } : saved(visit, busy);
}

/** A save that did not record: nothing is shown as made, and the one failed line sits under what was pressed. */
export function notSaved(visit: Pick<Visit, 'yours'>, press: Press): Partial<Visit> {
  return { yours: { ...visit.yours, busy: null, retrying: false, failed: press } };
}

export function switchPressed(visit: Reached, channel: Channel): Partial<Visit> {
  return visit.yours.busy == null ? saved(visit, channel) : {};
}

export function focusAfter(press: Press): string {
  return press === 'stop' || press === 'undo' ? 'yoursLead' : `switch-${press}`;
}
