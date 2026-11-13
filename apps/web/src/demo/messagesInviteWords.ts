/** The invitation in Messaging B's New message, and Send invitations in Guests A (sc-3971, Messaging-B-Web-Invite and Guests-A-Web-Invite, 13 Nov), settled by pm and l10n. */
export const IW = {
  sendInvitations: 'Send invitations',
  sendInvitation: 'Send invitation',
  sendInvitationLine: 'Soirely sends it to them by email or text.',
  asSeenBy: 'Invitation · As {{name}} will see it',
  noteForGuests: 'Note for your guests',
  noteHint: 'Shown on each guest’s page, in Messages. Never sent by email or text.',
  noteTooLong: 'Shorten the note to {{count, number}} characters or fewer.',
  already_one: '{{count, number}} already has their invitation',
  already_other: '{{count, number}} already have their invitation',
  leaveThemOut: 'Leave them out',
  sendAgain: 'Send again',
  cantBeReached_one: '{{count, number}} can’t be reached',
  cantBeReached_other: '{{count, number}} can’t be reached',
  backToCheck: 'Back to the check',
  emailIsOff: 'Email is off',
  cancelled: 'Cancelled. No invitation was sent.',
  queued_one: 'Invitation queued. Sending to {{count, number}} guest now.',
  queued_other: 'Invitations queued. Sending to {{count, number}} guests now.',
  noteFromHosts: 'A note from {{hosts}}',
  smsLine:
    "{{hosts}}: {{name}}, you're invited to {{event}} on {{date}}. Please reply by {{replyBy}} at {{link}}",
  eachAnswer: 'Each answer opens your own page, where you can add details or change your mind.',
  yoursAlone:
    'These links are yours alone and answer for you, so please do not forward this email.',
  sentBecause:
    '{{organisation}} sent this through Soirely because you are on the guest list for {{event}}.',
} as const;

export const INVITE_STATES = [
  { key: 'inviteWrite', name: 'The invitation, from Send invitations' },
  { key: 'inviteWriteOne', name: 'The invitation, from a guest’s details' },
  { key: 'inviteNote', name: 'The note written' },
  { key: 'inviteNoteLong', name: 'The note too long' },
  { key: 'invitePreview', name: 'The preview for one guest, no note' },
  { key: 'invitePreviewNote', name: 'The preview, with the note' },
  { key: 'invitePreviewSms', name: 'Previewed as Yusuf Ibrahim, by text' },
  { key: 'inviteCheck', name: 'The check, nobody already invited' },
  { key: 'inviteCheckSome', name: 'The check, some already invited: Leave them out' },
  { key: 'inviteCheckAgain', name: 'The check, Send again chosen' },
  { key: 'inviteCheckSeeAll', name: 'The check, See all open' },
  { key: 'inviteCheckAll', name: 'The check, everyone already invited' },
  { key: 'inviteRefused', name: 'Nobody can be reached' },
  { key: 'inviteCountdown', name: 'Ten seconds' },
  { key: 'inviteSent', name: 'Where it lands' },
] as const;

export const INVITE_GROUP = 'The invitation in New message (sc-3971)';

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
