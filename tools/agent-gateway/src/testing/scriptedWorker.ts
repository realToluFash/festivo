import type { Worker, WorkerResult, WorkerTask } from '../worker.ts';

type Step = WorkerResult | Error | (() => Promise<WorkerResult>);

export class ScriptedWorker implements Worker {
  readonly tasks: WorkerTask[] = [];
  private readonly steps: Step[];

  constructor(...steps: Step[]) {
    this.steps = steps;
  }

  async run(task: WorkerTask): Promise<WorkerResult> {
    this.tasks.push(task);
    const step = this.steps.shift();

    if (step === undefined) {
      throw new Error(`The scripted worker has no answer for run ${this.tasks.length}.`);
    }

    if (step instanceof Error) {
      throw step;
    }

    return typeof step === 'function' ? step() : step;
  }
}

export function says(text: string, outputTokens = 12): WorkerResult {
  return {
    output: { answer: { type: 'text', text } },
    stopReason: 'end_turn',
    usage: { inputTokens: 900, outputTokens },
  };
}

export function calls(name: string, input: Record<string, unknown>): WorkerResult {
  return {
    output: { answer: { type: 'tool_use', name, input } },
    stopReason: 'end_turn',
    usage: { inputTokens: 900, outputTokens: 30 },
  };
}
