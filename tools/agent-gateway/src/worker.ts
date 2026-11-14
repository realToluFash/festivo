import type { Effort, Thinking } from './request.ts';

export type WorkerTask = {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  model: string;
  thinking: Thinking;
  effort: Effort | null;
  signal: AbortSignal;
};

export type WorkerUsage = { inputTokens: number; outputTokens: number };

export type WorkerResult = {
  output: unknown;
  stopReason: string | null;
  usage: WorkerUsage | null;
};

export interface Worker {
  run(task: WorkerTask): Promise<WorkerResult>;
}

export class WorkerFailed extends Error {}
