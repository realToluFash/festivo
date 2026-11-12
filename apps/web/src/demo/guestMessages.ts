import { CHANNELS, type Channel, type Visit, type WhatsAppConsent } from './guest.ts';

export interface ChannelRow {
  channel: Channel;
  has: boolean;
  on: boolean;
  saved: boolean;
  whatsAppLine: boolean;
}

type Reached = Pick<Visit, 'mobile' | 'whatsApp' | 'reach'>;

export function whatsAppOn(consent: WhatsAppConsent): boolean {
  return consent === 'agreed' || consent === 'hostRecorded';
}

/** sc-3969's three rows: Text messages and WhatsApp have a switch only with a mobile number (sc-1468). */
export function channelRows(visit: Reached): ChannelRow[] {
  return CHANNELS.map((channel) => {
    const has = channel === 'email' || visit.mobile;
    const on = channel === 'whatsApp' ? whatsAppOn(visit.whatsApp) : visit.reach[channel];

    return {
      channel,
      has,
      on: has && on,
      saved: has && visit.reach.saved === channel,
      whatsAppLine: has && channel === 'whatsApp',
    };
  });
}

/** One switch pressed, saved at once on the sample: WhatsApp on is the guest's agreement, off ends it. */
export function switched(visit: Reached, channel: Channel): Partial<Visit> {
  if (channel !== 'email' && !visit.mobile) return {};
  const reach = { ...visit.reach, saved: channel };

  if (channel === 'whatsApp') {
    return { reach, whatsApp: whatsAppOn(visit.whatsApp) ? 'stopped' : 'agreed' };
  }

  return { reach: { ...reach, [channel]: !visit.reach[channel] } };
}
