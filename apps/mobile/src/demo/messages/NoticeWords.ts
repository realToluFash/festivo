/** sc-3976's refusals, waits and conversation lines, in l10n's English (#45411 to #45428, #45485), beside the web demo's. */
export const NW = {
  tellNowBy: 'Tell them now by:',
  noOther:
    'No other channel can tell them now. They see your answer when they next open their page.',
  reportedSpam: 'Reported an earlier email as spam',
  reportedAsSpam: 'Reported as spam',
  windowRanOut:
    'Nothing was sent. The 24 hours after their last WhatsApp message ran out while you were writing.',
  sendAgainTemplate: 'Send again to tell them with Soirely’s approved WhatsApp message.',
  unknownSender: 'Unknown sender',
  couldNotMatch: 'Soirely could not match this sender to a guest.',
  onlyManage: 'Only someone who can change Messages can send.',
};

export const sayNotice = {
  cannotTell: (name: string, channel: string) =>
    `Your answer goes on ${name}’s page. Soirely cannot tell them by ${channel}.`,
  textedStopOn: (date: string, time: string) =>
    `Texted STOP on ${date} at ${time}. Texting START brings texts back.`,
  noTemplate: (language: string) =>
    `Soirely’s WhatsApp message cannot be sent in ${language} at the moment.`,
  unavailableIn: (language: string) => `WhatsApp message unavailable in ${language}`,
  waitsUntil: (whatsApp: boolean, time: string) =>
    whatsApp
      ? `This WhatsApp message waits until ${time}, their time.`
      : `This text waits until ${time}, their time.`,
  waitingUntil: (time: string) => `Waiting until ${time}, their time`,
  stoppedTexts: (guest: string, time: string) => `${guest} stopped texts · ${time}`,
  stoppedWhatsApp: (guest: string, time: string) => `${guest} stopped WhatsApp · ${time}`,
  startedTexts: (guest: string, time: string) => `${guest} started texts again · ${time}`,
  attachmentsNotKept: (count: number) =>
    count === 1 ? '1 attachment not kept' : `${count} attachments not kept`,
  sharedBy: (number: string, count: number) => `${number} · shared by ${count} guests`,
  shareNumberLast: (count: number, guest: string) =>
    `${count} guests share this number. Soirely matched it to ${guest}, the one it last messaged there.`,
};
