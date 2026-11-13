/** Send invitations from the composer (sc-3971): l10n's English on the story, beside Messaging B's own words. */
export const IW = {
  noteHint: 'Shown on each guest’s page, in Messages. Never sent by email or text.',
  noteTooLong: 'Shorten the note to {{count, number}} characters or fewer.',
  alreadyHave_one: '{{count, number}} already has their invitation',
  alreadyHave_other: '{{count, number}} already have their invitation',
  leaveOut: 'Leave them out',
  sendAgain: 'Send again',
  cantBeReached_one: '{{count, number}} can’t be reached',
  cantBeReached_other: '{{count, number}} can’t be reached',
  cannotSend_one: 'The invitation cannot be sent yet.',
  cannotSend_other: 'The invitations cannot be sent yet.',
  noneReached_one:
    'This guest cannot be reached. Add an email address or a mobile number for them in Guests.',
  noneReached_other:
    'None of the {{count, number}} guests can be reached. Add an email address or a mobile number for them in Guests.',
  cancelled: 'Cancelled. No invitation was sent.',
  queued_one: 'Invitation queued. Sending to {{count, number}} guest now.',
  queued_other: 'Invitations queued. Sending to {{count, number}} guests now.',
  noteFrom: 'A note from {{hosts}}',
  willYouNoDate: 'Will you be there? Please reply when you can.',
  eachAnswer: 'Each answer opens your own page, where you can add details or change your mind.',
  notForward:
    'These links are yours alone and answer for you, so please do not forward this email.',
  whySent:
    '{{organisation}} sent this through Soirely because you are on the guest list for {{event}}.',
  sms: "{{hosts}}: {{greeting}}, you're invited to {{event}} on {{date}}. Please reply by {{replyBy}} at {{link}}",
  smsNoDate:
    "{{hosts}}: {{greeting}}, you're invited to {{event}} on {{date}}. Please reply at {{link}}",
  smsStop: 'Reply STOP to opt out.',
  onTheirPage: 'On {{name}}’s page',
  messages: 'Messages',
} as const;

/** The invitation by WhatsApp (sc-45251), on the wedding's fourteen Not yet invited with sample numbers and consent. */
export const WA_INVITE_STATES = [
  { key: 'inviteWhatsAppOffered', name: 'WhatsApp offered, not ticked' },
  { key: 'inviteWhatsApp', name: 'WhatsApp ticked at marketing: US numbers left out' },
  { key: 'inviteWhatsAppUtility', name: 'WhatsApp ticked at utility' },
  { key: 'inviteWhatsAppSms', name: 'SMS and WhatsApp ticked: instead of SMS' },
  { key: 'inviteCheckWhatsApp', name: 'The check, by WhatsApp at marketing' },
  { key: 'inviteCheckWhatsAppUtility', name: 'The check, by WhatsApp at utility' },
  { key: 'inviteCheckWhatsAppWaits', name: 'Too few credits: WhatsApp waits, email goes' },
  { key: 'invitePreviewWhatsApp', name: 'The preview, by WhatsApp' },
  { key: 'invitePreviewWhatsAppNoDate', name: 'The preview, no reply-by date' },
  { key: 'invitePreviewWhatsAppPt', name: 'The preview, by WhatsApp in Portuguese' },
  { key: 'invitedReachedWhatsApp', name: 'Who it reached, by WhatsApp' },
  { key: 'invitedReachedWhatsAppNoSms', name: 'Who it reached, SMS not ticked: Try SMS instead' },
] as const;

/** Soirely's WhatsApp invitation template as Meta shows it (sc-45251, 'English copy (l10n)' and 'Template copy in es, fr and pt', 13 Nov): never the hosts' note. */
export const WA_INVITATION = {
  en: {
    dear: 'Dear {{greeting}},',
    invitation: 'This is your invitation from {{hosts}} to {{event}} on {{date}}.',
    replyBy:
      'Please reply by {{replyBy}}. The button below opens your own page, where you can answer. The page is yours alone, so please do not forward this message.',
    noDate:
      'Please reply when you can. The button below opens your own page, where you can answer. The page is yours alone, so please do not forward this message.',
    button: 'Reply on your page',
  },
  es: {
    dear: 'Hola, {{greeting}}:',
    invitation: 'Esta es su invitación de {{hosts}} para {{event}}, el {{date}}.',
    replyBy:
      'Le rogamos que responda como muy tarde el {{replyBy}}. El botón de abajo abre su página personal, donde puede responder. La página es solo suya, así que no reenvíe este mensaje, por favor.',
    noDate:
      'Le rogamos que responda cuando pueda. El botón de abajo abre su página personal, donde puede responder. La página es solo suya, así que no reenvíe este mensaje, por favor.',
    button: 'Responder en su página',
  },
  fr: {
    dear: 'Bonjour {{greeting}},',
    invitation: 'Voici votre invitation de la part de {{hosts}} pour {{event}}, le {{date}}.',
    replyBy:
      'Merci de répondre au plus tard le {{replyBy}}. Le bouton ci-dessous ouvre votre page personnelle, où vous pouvez répondre. Cette page n’est qu’à vous, merci donc de ne pas transférer ce message.',
    noDate:
      'Merci de répondre dès que vous le pourrez. Le bouton ci-dessous ouvre votre page personnelle, où vous pouvez répondre. Cette page n’est qu’à vous, merci donc de ne pas transférer ce message.',
    button: 'Répondre sur votre page',
  },
  pt: {
    dear: 'Olá, {{greeting}}.',
    invitation: 'Este é o seu convite da parte de {{hosts}} para {{event}}, {{date}}.',
    replyBy:
      'Pedimos-lhe que responda até {{replyBy}}. O botão abaixo abre a sua página pessoal, onde pode responder. A página é só sua, por isso, por favor, não reencaminhe esta mensagem.',
    noDate:
      'Pedimos-lhe que responda quando puder. O botão abaixo abre a sua página pessoal, onde pode responder. A página é só sua, por isso, por favor, não reencaminhe esta mensagem.',
    button: 'Responder na sua página',
  },
} as const;

export const WA_INVITE_GROUP = 'The invitation by WhatsApp (sc-45251)';
