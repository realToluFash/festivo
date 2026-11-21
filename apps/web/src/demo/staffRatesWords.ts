const listed = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** Staff rates' English (sc-101, Budget-A-StaffRates): the story's settled words and the board's proposals. */
export const STAFF_RATES_WORDS = {
  title: 'Staff rates',
  jobs: 'Jobs',
  ownRates: 'People on their own rate',
  addOne: 'Add one',
  hours: (hours: number) => `${hours} h`,
  hoursMinutes: (hours: number, minutes: number) => `${hours} h ${minutes} min`,
  anHour: (amount: string) => `${amount} an hour`,
  eachPerson: (amount: string) => `${amount} for the event, each person`,
  from: (counted: string, scheduled: string) => `From ${counted} of ${scheduled} scheduled.`,
  jobsHours: (job: string, hours: string) => `${job}’s ${hours}`,
  notCounted: (names: readonly string[], count: number) =>
    count === 1
      ? `${listed(names)} not counted until it has a rate.`
      : `${listed(names)} not counted until they have a rate.`,
  fromShifts: (hours: string, shifts: number) =>
    shifts === 1 ? `${hours} from 1 shift` : `${hours} from ${shifts} shifts`,
  notFilled: (count: number) =>
    count === 1 ? '1 place not filled yet' : `${count} places not filled yet`,
  people: (count: number) => (count === 1 ? '1 person' : `${count} people`),
  noShifts: '0 h · No shifts yet',
  hoursSource: 'Hours are the scheduled hours of each job’s shifts, from Staff.',
  noRateYet: 'No rate yet',
  notCountedEnd: 'Not counted',
  setRate: (job: string) => `Set ${job}’s rate`,
  nextUp: (job: string, hours: string) =>
    `${job} has no rate yet, so its ${hours} are not in the budget.`,
  howPaid: (job: string) => `How is each ${job} paid?`,
  howPaidPerson: (person: string) => `How is ${person} paid?`,
  howTheyPaid: 'How are they paid?',
  byTheHour: 'By the hour',
  byTheHourLine: 'Their scheduled hours times the rate',
  flatFee: 'A flat fee for the event, once for each person',
  flatFeeLine: 'However many shifts they work',
  rateAnHour: 'Rate an hour',
  feeEachPerson: 'Fee for each person',
  saveRate: 'Save rate',
  cancel: 'Cancel',
  removeRate: 'Remove the rate',
  jobRateAction: (job: string) => `Use ${job}’s rate`,
  sum: (quantity: string, rate: string, amount: string) => `${quantity} × ${rate} = ${amount}.`,
  fees: (count: number) => (count === 1 ? '1 fee' : `${count} fees`),
  keepOwn: (names: readonly string[]) =>
    names.length === 1
      ? `${names[0]} keeps their own rate.`
      : `${listed(names)} keep their own rates.`,
  oncePaid: (names: readonly string[]) =>
    names.length === 1
      ? `${names[0]} works more than one shift and is paid once.`
      : `${listed(names)} work more than one shift and are each paid once.`,
  openFees: (count: number) =>
    count === 1
      ? 'A place nobody has taken yet counts as one more fee until somebody takes it.'
      : `${count} places nobody has taken yet count as ${count} more fees until somebody takes them.`,
  blankRate: 'Enter the rate an hour.',
  blankFee: 'Enter the fee for each person.',
  negative: (fee: boolean) =>
    fee
      ? 'The fee cannot be below 0. Enter 0 or more.'
      : 'The rate cannot be below 0. Enter 0 or more.',
  notNumber: (fee: boolean) =>
    fee ? 'Enter the fee in numbers only.' : 'Enter the rate in numbers only.',
  decimals: (fee: boolean, example: string) =>
    `That has too many decimal places for this event’s currency. Enter the ${fee ? 'fee' : 'rate'} like ${example}.`,
  refused: (rate: string) =>
    `Not saved. Changing a rate needs the Manage the budget permission, and you no longer have it on this event. The rate is still ${rate}.`,
  setBy: (who: string, day: string) => `Set by ${who} on ${day}`,
  setByYou: 'Set by you just now.',
  changedByYou: (was: string) => `Changed by you just now. Was ${was}.`,
  removedByYou: (was: string) => `Rate removed by you just now. Was ${was}.`,
  instead: (rate: string, job: string, jobRate: string) =>
    `${rate} · Instead of ${job}’s ${jobRate}`,
  ownHours: (hours: string, job: string) => `${hours} as ${job}`,
  noOwn: 'Nobody is on their own rate. Everyone is paid their job’s rate.',
  who: 'Who',
  chooseWho: 'Choose who',
  whoOption: (person: string, job: string) => `${person} · ${job}`,
  whoBlank: 'Choose who this rate is for.',
  whoHelp: 'People on this event’s shifts, with their job.',
  addRate: 'Add rate',
  howCounted: 'How it is counted',
  howCountedLines: [
    'By the hour: each shift’s scheduled hours, once for every place it needs, times the rate.',
    'A flat fee: once for each person on the job’s shifts, however many they work.',
    'Shifts not assigned to anyone count, because somebody intends to pay for them. Each place counts until it is filled.',
    'A job with no rate is not counted, and says so.',
  ],
  readOnly:
    'You can see staff rates but not change them. Changing a rate needs the Manage the budget permission.',
  emptyTitle: 'No jobs on this event yet',
  emptyLine:
    'Staff rates come from the jobs on Staff. Add a job and its shifts there, and it shows here ready for a rate.',
  openStaff: 'Open Jobs and shifts',
  staffLine: 'Staff',
  staffRatesLink: 'Staff rates',
  staffHours: (counted: string, scheduled: string) =>
    `${counted} of ${scheduled} scheduled · from Staff rates`,
  staffNote:
    'No rate on this line. It adds up each job’s rate, or flat fee, from Staff rates, so there is one place to change a rate.',
  openStaffRates: 'Open Staff rates',
  saved: (job: string) => `${job}’s rate saved.`,
  scheduled: 'Scheduled',
  worked: 'Worked',
  workedNone: '0 h · No shifts',
  workedBy: (count: number) =>
    count === 0 ? 'Nobody worked it' : count === 1 ? '1 person worked' : `${count} people worked`,
  assumed: (hours: string) => `of which ${hours} assumed (not clocked out)`,
  noAttendance: (count: number) =>
    count === 1
      ? '1 shift with no attendance recorded'
      : `${count} shifts with no attendance recorded`,
  afterLine: (worked: string, scheduled: string, cost: string) =>
    `Worked ${worked} of ${scheduled} scheduled: ${cost}.`,
  afterAssumed: (hours: string) =>
    `Of the hours worked, ${hours} are assumed: a missing clock-out counts to the scheduled end.`,
  afterLines: [
    'Scheduled: each shift’s scheduled hours, once for every place it needs, times the rate.',
    'Worked: the hours each person clocked, times the rate. A missing clock-out counts to the scheduled end, and says so. A shift with no clock-in counts nothing.',
    'A flat fee after the event: once for each person who worked. A shift nobody worked costs nothing.',
    'A job with no rate is not counted, and says so.',
  ],
  hoursFrom: 'Worked hours are the clock-ins and clock-outs on Staff, Hours worked.',
  backOn: (person: string, job: string) => `${person} is back on ${job}’s rate.`,
  removed: (job: string) => `${job}’s rate removed. Its hours are not counted until it has one.`,
} as const;
