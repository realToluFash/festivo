import { randomInt } from 'node:crypto';
import { Ajv, type ValidateFunction } from 'ajv';
import { GatewayError } from './errors.ts';
import { answerSchema, promptFor, systemFor } from './prompt.ts';
import { parseRequest, type MessagesRequest, type Tool } from './request.ts';
import { WorkerFailed, type Worker, type WorkerResult } from './worker.ts';

export type Reply = { status: number; headers: Record<string, string>; body: unknown };

export type IdSource = (prefix: 'msg' | 'toolu' | 'req') => string;

type Answer =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> };

type Usage = { inputTokens: number; outputTokens: number; estimated: boolean };

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const CHARACTERS_PER_TOKEN = 4;

export const randomId: IdSource = (prefix) => {
  let suffix = '';

  for (let i = 0; i < 22; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }

  return `${prefix}_01${suffix}`;
};

export class Gateway {
  private running = false;
  private readonly worker: Worker;
  private readonly ids: IdSource;

  constructor(worker: Worker, ids: IdSource = randomId) {
    this.worker = worker;
    this.ids = ids;
  }

  requestId(): string {
    return this.ids('req');
  }

  async messages(body: unknown, signal: AbortSignal): Promise<Reply> {
    const request = parseRequest(body);

    if (this.running) {
      throw new GatewayError(
        529,
        'overloaded_error',
        'The agent gateway is already running a worker. Try again shortly.',
      );
    }

    this.running = true;

    try {
      return await this.answer(request, signal);
    } finally {
      this.running = false;
    }
  }

  private async answer(request: MessagesRequest, signal: AbortSignal): Promise<Reply> {
    const validators = compileTools(request.tools);
    const task = {
      system: systemFor(request),
      prompt: promptFor(request),
      schema: answerSchema(request.tools),
      model: request.model,
      thinking: request.thinking,
      effort: request.effort,
      signal,
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await this.run(task);

      if (result.stopReason === 'refusal') {
        return this.reply(request, [], 'refusal', usageOf(result, task, ''));
      }

      const answer = readAnswer(result.output, validators);

      if (answer !== null) {
        return this.respond(request, answer, usageOf(result, task, written(answer)));
      }
    }

    throw new GatewayError(
      500,
      'api_error',
      "The worker's answer did not match the request's tools, twice.",
    );
  }

  private async run(task: Parameters<Worker['run']>[0]): Promise<WorkerResult> {
    if (task.signal.aborted) {
      throw new GatewayError(500, 'api_error', 'The caller hung up before the worker started.');
    }

    try {
      return await this.worker.run(task);
    } catch (error) {
      if (error instanceof WorkerFailed) {
        throw new GatewayError(500, 'api_error', `The worker failed: ${error.message}`);
      }

      throw error;
    }
  }

  private respond(request: MessagesRequest, answer: Answer, usage: Usage): Reply {
    if (usage.outputTokens > request.maxTokens) {
      const capped = { ...usage, outputTokens: request.maxTokens, estimated: true };

      if (answer.type === 'tool_use') {
        return this.reply(request, [], 'max_tokens', capped);
      }

      const kept = Math.floor((answer.text.length * request.maxTokens) / usage.outputTokens);

      return this.reply(
        request,
        [{ type: 'text', text: answer.text.slice(0, kept) }],
        'max_tokens',
        capped,
      );
    }

    if (answer.type === 'tool_use') {
      const block = {
        type: 'tool_use' as const,
        id: this.ids('toolu'),
        name: answer.name,
        input: answer.input,
      };

      return this.reply(request, [block], 'tool_use', usage);
    }

    return this.reply(request, [{ type: 'text', text: answer.text }], 'end_turn', usage);
  }

  private reply(
    request: MessagesRequest,
    content: ContentBlock[],
    stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal',
    usage: Usage,
  ): Reply {
    const headers: Record<string, string> = usage.estimated
      ? { 'x-soirely-usage': 'estimated' }
      : {};

    return {
      status: 200,
      headers,
      body: {
        id: this.ids('msg'),
        type: 'message',
        role: 'assistant',
        model: request.model,
        content,
        stop_reason: stopReason,
        stop_sequence: null,
        usage: {
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
          service_tier: 'standard',
        },
      },
    };
  }
}

function compileTools(tools: Tool[]): Map<string, ValidateFunction> {
  const ajv = new Ajv({ strict: false, allErrors: false });

  return new Map(
    tools.map((tool, i) => {
      try {
        return [tool.name, ajv.compile(tool.inputSchema)];
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        throw GatewayError.invalid(`tools.${i}.input_schema: ${reason}`);
      }
    }),
  );
}

function readAnswer(output: unknown, tools: Map<string, ValidateFunction>): Answer | null {
  if (typeof output !== 'object' || output === null) {
    return null;
  }

  const answer = (output as Record<string, unknown>)['answer'];

  if (typeof answer !== 'object' || answer === null) {
    return null;
  }

  const { type, text, name, input } = answer as Record<string, unknown>;

  if (type === 'text' && typeof text === 'string' && text.trim() !== '') {
    return { type, text };
  }

  if (
    type !== 'tool_use' ||
    typeof name !== 'string' ||
    typeof input !== 'object' ||
    input === null
  ) {
    return null;
  }

  const validate = tools.get(name);

  if (validate === undefined || !validate(input)) {
    return null;
  }

  return { type, name, input: input as Record<string, unknown> };
}

function written(answer: Answer): string {
  return answer.type === 'text' ? answer.text : JSON.stringify(answer.input);
}

function usageOf(
  result: WorkerResult,
  task: { system: string; prompt: string },
  output: string,
): Usage {
  if (result.usage === null || result.usage.inputTokens < 1 || result.usage.outputTokens < 1) {
    return {
      inputTokens: estimateTokens(task.system + task.prompt),
      outputTokens: Math.max(1, estimateTokens(output)),
      estimated: true,
    };
  }

  return {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    estimated: false,
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARACTERS_PER_TOKEN);
}
