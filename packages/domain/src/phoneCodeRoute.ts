export type CodeRoute =
  'whatsapp' | 'sms_fallback' | 'sms_chosen' | 'sms_preferred' | 'sms_only' | null;

export interface CodeWording {
  /** The one line saying where the code went, which changes in place as the route does. */
  line: 'whatsapp' | 'fallback' | 'chosen' | 'texted';
  /** The field and its messages speak of WhatsApp only while the code is only there. */
  fromWhatsApp: boolean;
  /** "Text it to me instead", offered only while the code is on WhatsApp alone. */
  offerText: boolean;
  /** Keep reading the route: WhatsApp may still hand over to SMS. */
  watch: boolean;
}

/** How the phone code screen words the code's route (sc-750), the same on web and in the app. */
export function codeWording(route: CodeRoute): CodeWording {
  if (route === 'whatsapp')
    return { line: 'whatsapp', fromWhatsApp: true, offerText: true, watch: true };
  if (route === 'sms_fallback')
    return { line: 'fallback', fromWhatsApp: false, offerText: false, watch: false };
  if (route === 'sms_chosen')
    return { line: 'chosen', fromWhatsApp: false, offerText: false, watch: false };

  return { line: 'texted', fromWhatsApp: false, offerText: false, watch: false };
}
