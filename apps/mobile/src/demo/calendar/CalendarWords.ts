/** The few words the boards add to main's `calendar.*` and `calendarFeed.*`, in the demo's English. */
export const CW = {
  showNeedsYou: 'Only what needs you',
  emptyNeedsDay: 'Nothing needs you on this day.',
  overdue: 'Overdue',
  openApp: 'Your calendar app has its own design.',
} as const;

export const say = {
  emptyNeedsMonth: (month: string) => `Nothing needs you in ${month}.`,
  needsRowLabel: (title: string, event: string, time: string) => `${title}, ${event}, ${time}`,
  needsRowLabelOverdue: (title: string, event: string, time: string) =>
    `${title}, ${event}, ${time}, overdue`,
  timeThen: (time: string, word: string) => `${time} · ${word}`,
  calledOff: (name: string) => `${name} called off`,
};
