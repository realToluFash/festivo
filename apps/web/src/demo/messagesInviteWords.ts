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
