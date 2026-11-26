/** The codes of a service (sc-4005). The API decides every stage; a client reads these to order, group and name them through its catalogue, and never to work a stage out. */

export const PLATE_STAGES = ['toServe', 'dishing', 'checked', 'onItsWay', 'served'] as const;

export type PlateStage = (typeof PLATE_STAGES)[number];

export const ITEM_STATES = ['ready', 'preparing'] as const;

export type ItemState = (typeof ITEM_STATES)[number];

export const READY_IN_MINUTES = [5, 10, 15] as const;

export type ReadyIn = (typeof READY_IN_MINUTES)[number];

export const ITEM_MARKS = ['on', 'notOn', 'bringAfter'] as const;

export type ItemMark = (typeof ITEM_MARKS)[number];

export const OWED_REASONS = ['bringAfter', 'toFollow', 'sentBack'] as const;

export type OwedReason = (typeof OWED_REASONS)[number];

export const SENT_BACK_REASONS = ['wrongDish', 'notRight', 'dropped', 'allergyConcern'] as const;

export type SentBackReason = (typeof SENT_BACK_REASONS)[number];

export const HELD_CHOICES = ['whatsReadyNow', 'waitForAll'] as const;

export type HeldChoice = (typeof HELD_CHOICES)[number];

export const NO_ORDER_REASONS = ['notHereYet', 'nothingForThisCourse', 'left'] as const;

export type NoOrderReason = (typeof NO_ORDER_REASONS)[number];

export const PLATE_STEPS = [
  'start',
  'check',
  'takeOff',
  'takeToTable',
  'serve',
  'sendBack',
] as const;

export type PlateStep = (typeof PLATE_STEPS)[number];

const STEPS: Record<PlateStep, { from: readonly PlateStage[]; to: PlateStage }> = {
  start: { from: ['toServe'], to: 'dishing' },
  check: { from: ['dishing'], to: 'checked' },
  takeOff: { from: ['dishing', 'checked'], to: 'toServe' },
  takeToTable: { from: ['checked'], to: 'onItsWay' },
  serve: { from: ['onItsWay'], to: 'served' },
  sendBack: { from: ['onItsWay', 'served'], to: 'toServe' },
};

/** The stage a step takes a plate to, or null where the API refuses it `plate_stage_invalid`. */
export function plateStep(from: PlateStage, step: PlateStep): PlateStage | null {
  const row = STEPS[step];

  return row.from.includes(from) ? row.to : null;
}

/** The steps a plate at this stage allows. */
export function stepsFrom(stage: PlateStage): readonly PlateStep[] {
  return PLATE_STEPS.filter((step) => STEPS[step].from.includes(stage));
}

export function comparePlateStages(a: PlateStage, b: PlateStage): number {
  return PLATE_STAGES.indexOf(a) - PLATE_STAGES.indexOf(b);
}

/** A guest is held while their order is To serve and one of its items is Preparing, unless they chose What's ready, now with something Ready. Held is never a stage. */
export function isHeld(order: {
  stage: PlateStage;
  items: readonly { state: ItemState }[];
  choice: HeldChoice | null;
}): boolean {
  if (order.stage !== 'toServe' || !order.items.some((item) => item.state === 'preparing')) {
    return false;
  }

  return !(order.choice === 'whatsReadyNow' && order.items.some((item) => item.state === 'ready'));
}

/** Waiting since: the time of the order's last step, so the longest wait at a table is the earliest of these among its orders not yet Served. */
export function waitingSince(steps: readonly { at: string }[]): string | null {
  return steps.length === 0 ? null : steps[steps.length - 1]!.at;
}

/** The catalogue key of each code, one key per word, so es, fr and pt can agree each with its noun. */
export const SERVICE_WORD_KEYS = {
  stage: Object.fromEntries(PLATE_STAGES.map((code) => [code, `service.stage.${code}`])) as Record<
    PlateStage,
    string
  >,
  stageCount: Object.fromEntries(
    PLATE_STAGES.map((code) => [code, `service.stageCount.${code}`]),
  ) as Record<PlateStage, string>,
  item: Object.fromEntries(ITEM_STATES.map((code) => [code, `service.item.${code}`])) as Record<
    ItemState,
    string
  >,
  mark: Object.fromEntries(ITEM_MARKS.map((code) => [code, `service.mark.${code}`])) as Record<
    ItemMark,
    string
  >,
  owed: Object.fromEntries(OWED_REASONS.map((code) => [code, `service.owed.${code}`])) as Record<
    OwedReason,
    string
  >,
  sentBack: Object.fromEntries(
    SENT_BACK_REASONS.map((code) => [code, `service.sentBack.${code}`]),
  ) as Record<SentBackReason, string>,
  choice: Object.fromEntries(
    HELD_CHOICES.map((code) => [code, `service.choice.${code}`]),
  ) as Record<HeldChoice, string>,
  noOrder: Object.fromEntries(
    NO_ORDER_REASONS.map((code) => [code, `service.noOrder.${code}`]),
  ) as Record<NoOrderReason, string>,
  readyIn: 'service.readyIn',
  held: 'service.held',
  heldCount: 'service.heldCount',
} as const;
