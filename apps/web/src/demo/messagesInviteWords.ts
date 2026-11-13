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
