/** Make live and its offer to send invitations (sc-3971): main's eventLive.* English, then the story's settled words (pm, l10n, 13 Nov). */
export const LW = {
  confirmTitle: 'Make {{name}} live?',
  confirmLine: 'Guests can be invited, and they can see it. It can’t go back to being a draft.',
  notYet: 'Not yet',
  makeLive: 'Make live',
  making: 'Making live…',
  failed: 'Not made live. Try again in a moment.',
  madeLive: '✓ Live',
  close: 'Close',
  offerTitle_one: 'Send the invitation to {{count, number}} guest now?',
  offerTitle_other: 'Send invitations to {{count, number}} guests now?',
  isLive: '{{name}} is live.',
  sendThem_one: 'Send it',
  sendThem_other: 'Send them',
  sending: 'Sending…',
  notSent: 'Not sent. Try again in a moment.',
  cannotTitle_one: 'The invitation cannot be sent yet.',
  cannotTitle_other: 'The invitations cannot be sent yet.',
  nobody_one:
    'This guest cannot be reached. Add an email address or a mobile number for them in Guests.',
  nobody_other:
    'None of the {{count, number}} guests can be reached. Add an email address or a mobile number for them in Guests.',
  forbidden: 'Your role no longer includes sending messages, so nothing was sent.',
  queued_one: 'Invitation queued. Sending to {{count, number}} guest now.',
  queued_other: 'Invitations queued. Sending to {{count, number}} guests now.',
  messages: 'Messages',
} as const;
