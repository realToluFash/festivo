/** SMS's own words (sc-3946 English copy, settled by l10n and pm on 13 Nov), in the demo beside Messaging B's. */
export const SW = {
  smsReaches: 'SMS reaches {{count, number}} of {{total, number}}',
  noMobile_one: '{{count, number}} has no mobile number',
  noMobile_other: '{{count, number}} have no mobile number',
  stoppedTexts_one: '{{count, number}} stopped texts',
  stoppedTexts_other: '{{count, number}} stopped texts',
  counterParts_one: 'SMS · {{count, number}} part',
  counterParts_other: 'SMS · {{count, number}} parts',
  counterChars_one: '{{count, number}} character',
  counterChars_other: '{{count, number}} characters',
  gsm7: 'GSM-7',
  unicode: 'Unicode',
  firstText: 'Their first text from {{organisation}}, so it ends with how to stop texts.',
  textsWait_one: 'The text to {{count, number}} person waits until {{time}}, their time.',
  textsWait_other: 'Texts to {{count, number}} people wait until {{time}}, their time.',
  bothWait_one:
    'Messages to {{count, number}} person by text or WhatsApp wait until {{time}}, their time.',
  bothWait_other:
    'Texts and WhatsApp messages to {{count, number}} people wait until {{time}}, their time.',
  whatsAppWait_one:
    'The WhatsApp message to {{count, number}} person waits until {{time}}, their time.',
  whatsAppWait_other:
    'WhatsApp messages to {{count, number}} people wait until {{time}}, their time.',
  notInUse: 'Number not in use ({{code}})',
  cannotReceive: 'Number cannot receive texts ({{code}})',
  phoneOff: 'Phone off or out of signal ({{code}})',
  blocked: 'Blocked by their network ({{code}})',
  noReasonCode: 'No reason given ({{code}})',
  noReason: 'No reason given',
  liveAtNight:
    'Thu, Nov 5 at 23:00 London time. The wedding is Happening now, so no text waits for morning.',
} as const;
