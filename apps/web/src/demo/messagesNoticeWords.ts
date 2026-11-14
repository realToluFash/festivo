/** sc-3976's refusals, waits and conversation lines, in l10n's English (#45411 to #45428, #45485). */
export const NW = {
  cannotTell: 'Your answer goes on {{name}}’s page. Soirely cannot tell them by {{channel}}.',
  tellNowBy: 'Tell them now by:',
  noOther:
    'No other channel can tell them now. They see your answer when they next open their page.',
  textedStopOn: 'Texted STOP on {{date}} at {{time}}. Texting START brings texts back.',
  noTemplate: 'Soirely’s WhatsApp message cannot be sent in {{language}} at the moment.',
  reportedSpam: 'Reported an earlier email as spam',
  reportedAsSpam: 'Reported as spam',
  unavailableIn: 'WhatsApp message unavailable in {{language}}',
  windowRanOut:
    'Nothing was sent. The 24 hours after their last WhatsApp message ran out while you were writing.',
  sendAgainTemplate: 'Send again to tell them with Soirely’s approved WhatsApp message.',
  whatsAppWaitsUntil: 'This WhatsApp message waits until {{time}}, their time.',
  textWaitsUntil: 'This text waits until {{time}}, their time.',
  waitingUntil: 'Waiting until {{time}}, their time',
  stoppedTexts: '{{guest}} stopped texts',
  startedTexts: '{{guest}} started texts again',
  stoppedWhatsApp: '{{guest}} stopped WhatsApp',
  attachmentsNotKept_one: '{{count, number}} attachment not kept',
  attachmentsNotKept_other: '{{count, number}} attachments not kept',
  sharedBy: '{{number}} · shared by {{count, number}} guests',
  shareNumberLast:
    '{{count, number}} guests share this number. Soirely matched it to {{guest}}, the one it last messaged there.',
  shareNumberNewest:
    '{{count, number}} guests share this number. Soirely matched it to {{guest}}, the guest added most recently.',
  unknownSender: 'Unknown sender',
  couldNotMatch: 'Soirely could not match this sender to a guest.',
  today: 'Today',
} as const;
