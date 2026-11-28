export const EVENT = 'Adaeze & Tunde’s wedding';
export const NOW = '20:24';
export const AS_OF = '20:22';

export const COURSES = ['Starter', 'Mains', 'Dessert', 'Coffee'] as const;
export const SECTIONS = ['A', 'B', 'C'] as const;

export const THRESHOLD_MIN = 50;
export const THRESHOLD_MAX = 100;
export const THRESHOLD_STEP = 10;
export const THRESHOLD_START = 80;
export const NOT_YET_MIN = 5;

export const RUN_ITEM = 'Speeches';
export const RUN_COURSE = 2;

export const OFFLINE_LINE = 'Firing, the next course and ending service need a connection.';
export const OFFLINE_BEFORE_LINE = 'Starting service needs a connection.';
export const NO_MENU_LINE = 'Add a menu to start service';
export const NOTHING_TICKED = 'Choose at least one table. Nothing was fired.';

export type Phase = 'notStarted' | 'on' | 'ended';
export type Section = (typeof SECTIONS)[number];
export type Scope = 'all' | 'choose' | Section;
export type Confirm = 'next' | 'end' | null;

export interface FireTable {
  name: string;
  section: Section | null;
  seated: number;
  arrived: number;
  fired: Partial<Record<number, string>>;
  /** Guests due the room's current course who are counted Served (sc-34107). */
  served: number;
  owed: boolean;
}

export interface FireChoice {
  course: number;
  scope: Scope;
  ticked: string[];
  error: boolean;
  fromPrompt: boolean;
}

export interface FireState {
  phase: Phase;
  paused: boolean;
  menu: boolean;
  manage: boolean;
  online: boolean;
  current: number;
  since: string;
  tables: FireTable[];
  thresholds: number[];
  notYetUntil: string | null;
  runStarted: boolean;
  promptDone: boolean;
  fire: FireChoice | null;
  confirm: Confirm;
  thresholdsOpen: boolean;
  result: string[];
  offlineTried: boolean;
  say: string;
}

function table(n: number, section: Section | null, extra: Partial<FireTable> = {}): FireTable {
  return {
    name: `Table ${n}`,
    section,
    seated: 8,
    arrived: 8,
    fired: { 0: '19:40', 1: '20:10' },
    served: 8,
    owed: false,
    ...extra,
  };
}

function room(): FireTable[] {
  const starterOnly = { 0: '19:40' };
  return [
    table(1, 'A'),
    table(2, 'A'),
    table(3, 'A', { owed: true }),
    table(4, 'A'),
    table(5, 'A'),
    table(6, 'B'),
    table(7, 'B'),
    table(8, 'B', { arrived: 0, served: 0 }),
    table(9, 'B'),
    table(10, 'B'),
    table(11, 'C', { served: 3 }),
    table(12, 'C', { fired: starterOnly, served: 0 }),
    table(13, 'C', { fired: starterOnly, served: 0 }),
    table(14, 'C', { seated: 0, arrived: 0, fired: {}, served: 0 }),
    table(15, null, { seated: 6, arrived: 6, fired: {}, served: 0 }),
  ];
}

function unfired(): FireTable[] {
  return room().map((t) => ({ ...t, fired: {}, served: 0, owed: false }));
}

export const FIRE_STATES = [
  'notStarted',
  'notStartedPaused',
  'noMenu',
  'started',
  'fireAll',
  'fireSection',
  'fireChoose',
  'fireNothing',
  'firedPartial',
  'fireEarlier',
  'fireLater',
  'suggestion',
  'notYet',
  'prompt',
  'thresholds',
  'nextConfirm',
  'lastCourse',
  'endConfirm',
  'ended',
  'offline',
  'offlineBefore',
  'noManage',
] as const;

export type FireStateName = (typeof FIRE_STATES)[number];

export function fireStateOf(raw: string | null | undefined): FireStateName {
  return FIRE_STATES.find((s) => s === raw) ?? 'started';
}

export const FIRE_STATE_WHAT: Record<FireStateName, string> = {
  notStarted: 'Not started, with a menu: Start service, the event Happening now',
  notStartedPaused: 'Not started while the event is Paused: Start service still offered',
  noMenu: 'Not started with no menu: “Add a menu to start service”, no button',
  started: 'Started, on mains: the service line, Fire mains and Next course',
  fireAll: 'Fire mains on All tables: “Fire mains at 3 tables”',
  fireSection: 'Fire mains on Section C: its own count, Table 14 refused',
  fireChoose: 'Choose tables: fired tables ticked and locked, Table 14 refused with its reason',
  fireNothing: 'Choose tables with nothing ticked, Fire pressed: nothing sent, and it says so',
  firedPartial: 'Fired, partial: “Mains fired at 3 tables.” and Table 14’s line',
  fireEarlier: 'The course picker on Starter: only Table 15, which never had it, can fire',
  fireLater: 'The course picker on Dessert: firing it moves the room on',
  suggestion: 'The next-course suggestion: “8 of 10 tables served mains”, Fire dessert now',
  notYet: 'After Not yet: the suggestion hidden, a line saying when it comes back',
  prompt:
    'The run of show’s prompt: “Speeches has started. Fire dessert?”, standing in for the dessert suggestion',
  thresholds: 'The thresholds open: a stepper on dessert and coffee, crossing 80% at once',
  nextConfirm: 'Next course pressed: “Move the room to dessert?”',
  lastCourse: 'On the last course, coffee: End service in place of Next course',
  endConfirm: 'End service pressed: its confirmation',
  ended: 'Ended: the service line only, orders still workable elsewhere',
  offline: 'No connection during service: every control drawn and disabled',
  offlineBefore:
    'No connection before service starts: Start service disabled, “Starting service needs a connection.”',
  noManage: 'Without service.manage: the service line only',
};

function base(): FireState {
  return {
    phase: 'on',
    paused: false,
    menu: true,
    manage: true,
    online: true,
    current: 1,
    since: '20:10',
    tables: room(),
    thresholds: COURSES.map(() => THRESHOLD_START),
    notYetUntil: null,
    runStarted: false,
    promptDone: false,
    fire: null,
    confirm: null,
    thresholdsOpen: false,
    result: [],
    offlineTried: false,
    say: '',
  };
}

function lastCourse(): FireState {
  const all = { 0: '19:40', 1: '20:10', 2: '21:05', 3: '21:40' };
  const tables = room().map((t) =>
    t.seated === 0 ? t : { ...t, fired: all, served: t.arrived, owed: false },
  );
  return { ...base(), current: 3, since: '21:40', tables };
}

function choice(course: number, scope: Scope): FireChoice {
  return { course, scope, ticked: [], error: false, fromPrompt: false };
}

export function seed(name: FireStateName): FireState {
  const b = base();
  const before: FireState = { ...b, phase: 'notStarted', current: 0, since: '', tables: unfired() };
  switch (name) {
    case 'notStarted':
      return before;
    case 'notStartedPaused':
      return { ...before, paused: true };
    case 'noMenu':
      return { ...before, menu: false };
    case 'started':
    case 'suggestion':
      return b;
    case 'fireAll':
      return openFire(b);
    case 'fireSection':
      return { ...b, fire: choice(1, 'C') };
    case 'fireChoose':
      return { ...b, fire: choice(1, 'choose') };
    case 'fireNothing':
      return pressFire({ ...b, fire: choice(1, 'choose') });
    case 'firedPartial':
      return pressFire(openFire(b));
    case 'fireEarlier':
      return { ...b, fire: choice(0, 'all') };
    case 'fireLater':
      return { ...b, fire: choice(2, 'all') };
    case 'notYet':
      return notYet(b);
    case 'prompt':
      return { ...b, runStarted: true };
    case 'thresholds':
      return { ...b, thresholdsOpen: true };
    case 'nextConfirm':
      return { ...b, confirm: 'next' };
    case 'lastCourse':
      return lastCourse();
    case 'endConfirm':
      return { ...lastCourse(), confirm: 'end' };
    case 'ended':
      return { ...lastCourse(), phase: 'ended' };
    case 'offline':
      return { ...b, online: false, runStarted: true };
    case 'offlineBefore':
      return { ...before, online: false };
    case 'noManage':
      return { ...b, manage: false, runStarted: true };
  }
}

export function courseName(i: number): string {
  return COURSES[i] ?? '';
}

export function courseWord(i: number): string {
  return courseName(i).toLowerCase();
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function isLast(s: FireState): boolean {
  return s.current === COURSES.length - 1;
}

export function offlineLine(s: FireState): string {
  return s.phase === 'notStarted' ? OFFLINE_BEFORE_LINE : OFFLINE_LINE;
}

export function offlineTry(s: FireState): FireState {
  return { ...s, offlineTried: true, say: offlineLine(s) };
}

export function serviceLine(s: FireState): string {
  if (s.phase === 'notStarted') return 'Service hasn’t started';
  if (s.phase === 'ended') return 'Service has ended';
  return `Service · ${courseName(s.current)} · course ${s.current + 1} of ${COURSES.length} since ${s.since}`;
}

export const ENDED_LINE =
  'Orders, owed plates and trays already made stay workable on Next, Floor and every station.';

export function controls(s: FireState): {
  start: boolean;
  noMenu: boolean;
  fire: boolean;
  next: boolean;
  end: boolean;
} {
  const none = { start: false, noMenu: false, fire: false, next: false, end: false };
  if (!s.manage) return none;
  if (s.phase === 'notStarted') return { ...none, start: s.menu, noMenu: !s.menu };
  if (s.phase === 'ended') return none;
  return { ...none, fire: true, next: !isLast(s), end: isLast(s) };
}

export function seatedTables(s: FireState): FireTable[] {
  return s.tables.filter((t) => t.seated > 0);
}

export function isFired(t: FireTable, course: number): boolean {
  return t.fired[course] != null;
}

export function canFire(t: FireTable, course: number): boolean {
  return t.seated > 0 && !isFired(t, course);
}

export function inScope(s: FireState, scope: Scope): FireTable[] {
  if (scope === 'all' || scope === 'choose') return s.tables;
  return s.tables.filter((t) => t.section === scope);
}

export function targets(s: FireState, f: FireChoice): FireTable[] {
  if (f.scope === 'choose') {
    return s.tables.filter((t) => f.ticked.includes(t.name) && canFire(t, f.course));
  }
  return inScope(s, f.scope).filter((t) => canFire(t, f.course));
}

export function refusedIn(s: FireState, f: FireChoice): FireTable[] {
  if (f.scope === 'choose') return [];
  return inScope(s, f.scope).filter((t) => t.seated === 0 && !isFired(t, f.course));
}

export function scopeCount(s: FireState, course: number, scope: Scope): number {
  return inScope(s, scope).filter((t) => canFire(t, course)).length;
}

export function scopeName(scope: Scope): string {
  if (scope === 'all') return 'All tables';
  if (scope === 'choose') return 'Choose tables';
  return `Section ${scope}`;
}

export function scopeLine(s: FireState, course: number, scope: Scope): string {
  if (scope === 'choose') return 'Tick the tables to fire';
  const n = scopeCount(s, course, scope);
  return n === 0 ? 'Every table already fired' : `${plural(n, 'table', 'tables')} to fire`;
}

export function fireLabel(s: FireState, f: FireChoice): string {
  return `Fire ${courseWord(f.course)} at ${plural(targets(s, f).length, 'table', 'tables')}`;
}

export function courseOffer(s: FireState, course: number): string {
  const n = seatedTables(s).filter((t) => canFire(t, course)).length;
  if (course === s.current) return `Now · ${plural(n, 'table', 'tables')} still to fire`;
  if (course < s.current) {
    return n === 0
      ? 'Every seated table had it'
      : `Earlier · ${plural(n, 'table', 'tables')} never had it`;
  }
  return 'Later · moves the room on';
}

export function movesOn(s: FireState, course: number): boolean {
  return course > s.current;
}

export function choiceLine(s: FireState, f: FireChoice): string {
  if (f.course < s.current) {
    return `Only tables that never had ${courseWord(f.course)} can fire. The room stays on ${courseWord(s.current)}.`;
  }
  if (movesOn(s, f.course)) {
    return `Firing ${courseWord(f.course)} moves the room on to ${courseWord(f.course)}.`;
  }
  return `Tables already fired for ${courseWord(f.course)} stay as they are.`;
}

export function tableLine(t: FireTable, course: number): string {
  const at = t.fired[course];
  if (at != null) return `Fired at ${at}`;
  if (t.seated === 0) return 'Not fired: no one is seated there';
  return t.section == null ? `${t.seated} seated · in no section` : `${t.seated} seated`;
}

export function openFire(s: FireState, course = s.current): FireState {
  return { ...s, fire: choice(course, 'all'), confirm: null, result: [], say: '' };
}

export function closeFire(s: FireState): FireState {
  return { ...s, fire: null };
}

export function pickCourse(s: FireState, course: number): FireState {
  if (s.fire == null) return s;
  return { ...s, fire: { ...s.fire, course, ticked: [], error: false } };
}

export function pickScope(s: FireState, scope: Scope): FireState {
  if (s.fire == null) return s;
  return { ...s, fire: { ...s.fire, scope, error: false } };
}

export function toggle(s: FireState, name: string): FireState {
  const f = s.fire;
  const t = s.tables.find((x) => x.name === name);
  if (f == null || t == null || !canFire(t, f.course)) return s;
  const ticked = f.ticked.includes(name) ? f.ticked.filter((x) => x !== name) : [...f.ticked, name];
  return { ...s, fire: { ...f, ticked, error: false } };
}

export function firstTickable(s: FireState): string {
  const f = s.fire;
  if (f == null) return '';
  return s.tables.find((t) => canFire(t, f.course))?.name ?? '';
}

/** Fire: every target gets the course; a later course moves the room on, and the header follows. */
export function pressFire(s: FireState): FireState {
  const f = s.fire;
  if (f == null) return s;
  if (!s.online) return offlineTry(s);
  if (f.scope === 'choose' && f.ticked.length === 0) {
    return { ...s, fire: { ...f, error: true }, say: NOTHING_TICKED };
  }
  const to = targets(s, f);
  const refused = refusedIn(s, f);
  if (to.length === 0 && refused.length === 0) {
    const line = `${courseName(f.course)} is already fired at every table in ${scopeName(f.scope)}. Nothing changed.`;
    return { ...s, fire: null, result: [line], say: line };
  }
  const names = new Set(to.map((t) => t.name));
  const later = movesOn(s, f.course);
  const tables = s.tables.map((t) => {
    const reset = later ? { served: 0, owed: false } : {};
    if (!names.has(t.name)) return { ...t, ...reset };
    return { ...t, ...reset, fired: { ...t.fired, [f.course]: NOW } };
  });
  const result = [
    `${courseName(f.course)} fired at ${plural(to.length, 'table', 'tables')}.`,
    ...refused.map((t) => `${t.name} was not fired: no one is seated there.`),
    ...(later ? [`The room is on ${courseWord(f.course)} now.`] : []),
  ];
  return {
    ...s,
    tables,
    current: later ? f.course : s.current,
    since: later ? NOW : s.since,
    notYetUntil: later ? null : s.notYetUntil,
    promptDone: s.promptDone || (f.fromPrompt && f.course === RUN_COURSE),
    fire: null,
    result,
    say: result.join(' '),
  };
}

/** sc-34107's Served: tables fired for the current course with a guest due, and those whose guests are all Served with nothing owed. */
export function share(s: FireState): { served: number; of: number } {
  const counted = s.tables.filter((t) => isFired(t, s.current) && t.arrived > 0);
  const served = counted.filter((t) => t.served >= t.arrived && !t.owed);
  return { served: served.length, of: counted.length };
}

export function sharePercent(s: FireState): number {
  const { served, of } = share(s);
  return of === 0 ? 0 : (served / of) * 100;
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function threshold(s: FireState, course: number): number {
  return s.thresholds[course] ?? THRESHOLD_START;
}

export function suggesting(s: FireState): boolean {
  if (!s.manage || !s.online || s.phase !== 'on' || isLast(s)) return false;
  if (s.notYetUntil != null && minutesOf(NOW) < minutesOf(s.notYetUntil)) return false;
  return share(s).of > 0 && sharePercent(s) >= threshold(s, s.current + 1);
}

export function suggestionLine(s: FireState): string {
  const { served, of } = share(s);
  return `${served} of ${plural(of, 'table', 'tables')} served ${courseWord(s.current)}`;
}

export function suggestionWhy(s: FireState): string {
  const next = s.current + 1;
  return `${courseName(next)} is suggested from ${threshold(s, next)}%. A table with no guest due ${courseWord(s.current)} yet is left out.`;
}

export function notYet(s: FireState): FireState {
  const until = hhmm(minutesOf(NOW) + NOT_YET_MIN);
  return { ...s, notYetUntil: until, say: `Suggestion hidden until ${until}.` };
}

export function notYetLine(s: FireState): string {
  if (s.notYetUntil == null || !s.manage || !s.online || s.phase !== 'on') return '';
  return `The ${courseWord(s.current + 1)} suggestion comes back at ${s.notYetUntil}.`;
}

/** The run of show's prompt: once, and not when its course is fired at every seated table. */
export function prompting(s: FireState): boolean {
  if (!s.manage || !s.online || s.phase !== 'on' || !s.runStarted || s.promptDone) return false;
  return seatedTables(s).some((t) => !isFired(t, RUN_COURSE));
}

export function promptLine(): string {
  return `${RUN_ITEM} has started. Fire ${courseWord(RUN_COURSE)}?`;
}

/** Only one cue asks about a course: the prompt stands in for that course's suggestion until it is answered. */
export function cues(s: FireState): { prompt: boolean; suggest: boolean } {
  const prompt = prompting(s);
  return { prompt, suggest: suggesting(s) && !(prompt && RUN_COURSE === s.current + 1) };
}

/** Not now answers the prompt for good, and hides the same course's suggestion as Not yet would. */
export function dismissPrompt(s: FireState): FireState {
  const done = { ...s, promptDone: true };
  return RUN_COURSE === s.current + 1 ? { ...notYet(done), say: 'Prompt dismissed.' } : done;
}

/** A cue's Fire {course} now opens the choice and never fires; the cue stays until a fire answers it. */
export function fireFrom(s: FireState, course: number, prompt: boolean): FireState {
  const opened = openFire(s, course);
  if (opened.fire == null) return opened;
  return { ...opened, fire: { ...opened.fire, fromPrompt: prompt } };
}

export function steppable(s: FireState): number[] {
  return COURSES.map((_, i) => i).filter((i) => s.tables.every((t) => !isFired(t, i)));
}

export function step(s: FireState, course: number, by: 1 | -1): FireState {
  const was = threshold(s, course);
  const next = Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, was + by * THRESHOLD_STEP));
  if (next === was || !s.online) return s;
  return {
    ...s,
    thresholds: s.thresholds.map((v, i) => (i === course ? next : v)),
    say: `${courseName(course)} is suggested from ${next}% of tables served.`,
  };
}

export function validThreshold(v: number): boolean {
  return (
    Number.isInteger(v) &&
    v >= THRESHOLD_MIN &&
    v <= THRESHOLD_MAX &&
    (v - THRESHOLD_MIN) % THRESHOLD_STEP === 0
  );
}

export function startService(s: FireState): FireState {
  if (!s.online) return offlineTry(s);
  if (!s.manage || s.phase !== 'notStarted' || !s.menu) return s;
  return {
    ...s,
    phase: 'on',
    current: 0,
    since: NOW,
    say: `Service has started. The room is on ${courseWord(0)}.`,
  };
}

export function askNext(s: FireState): FireState {
  if (!s.online) return offlineTry(s);
  return { ...s, fire: null, confirm: isLast(s) ? 'end' : 'next' };
}

export function confirmTitle(s: FireState): string {
  return s.confirm === 'end' ? 'End service?' : `Move the room to ${courseWord(s.current + 1)}?`;
}

export function confirmLine(s: FireState): string {
  return s.confirm === 'end'
    ? `No course can be fired after this. ${ENDED_LINE}`
    : `Tables still on ${courseWord(s.current)} keep their orders.`;
}

export function confirmWords(s: FireState): { keep: string; go: string } {
  return s.confirm === 'end'
    ? { keep: 'Keep serving', go: 'End service' }
    : { keep: `Stay on ${courseWord(s.current)}`, go: `Move to ${courseWord(s.current + 1)}` };
}

export function closeConfirm(s: FireState): FireState {
  return { ...s, confirm: null };
}

export function confirm(s: FireState): FireState {
  if (!s.online) return offlineTry(s);
  if (s.confirm === 'end') {
    return { ...s, phase: 'ended', confirm: null, fire: null, say: 'Service has ended.' };
  }
  if (s.confirm === 'next') {
    const current = s.current + 1;
    return {
      ...s,
      current,
      since: NOW,
      confirm: null,
      notYetUntil: null,
      tables: s.tables.map((t) => ({ ...t, served: 0, owed: false })),
      say: `The room is on ${courseWord(current)} now.`,
    };
  }
  return s;
}

export function serveAll(s: FireState): FireState {
  return {
    ...s,
    tables: s.tables.map((t) =>
      isFired(t, s.current) ? { ...t, served: t.arrived, owed: false } : t,
    ),
  };
}

export function runStarts(s: FireState): FireState {
  return { ...s, runStarted: true };
}

export function setOnline(s: FireState, online: boolean): FireState {
  return { ...s, online, offlineTried: false, say: '' };
}
