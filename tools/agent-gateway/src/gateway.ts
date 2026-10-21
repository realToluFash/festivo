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

  constructor(
    private readonly worker: Worker,
    private readonly ids: IdSource = randomId,
  ) {}

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
        return this.reply(request, [], 'refusal', result, task, false);
      }

      const answer = readAnswer(result.output, validators);

      if (answer !== null) {
        return this.respond(request, answer, result, task);
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

  private respond(
    request: MessagesRequest,
    answer: Answer,
    result: WorkerResult,
    task: { system: string; prompt: string },
  ): Reply {
    if (answer.type === 'tool_use') {
      if (estimateTokens(JSON.stringify(answer.input)) > request.maxTokens) {
        return this.reply(request, [], 'max_tokens', result, task, true);
      }

      const block = {
        type: 'tool_use' as const,
        id: this.ids('toolu'),
        name: answer.name,
        input: answer.input,
      };

      return this.reply(request, [block], 'tool_use', result, task, false);
    }

    if (estimateTokens(answer.text) > request.maxTokens) {
      const text = answer.text.slice(0, request.maxTokens * CHARACTERS_PER_TOKEN);

      return this.reply(request, [{ type: 'text', text }], 'max_tokens', result, task, true);
    }

    return this.reply(
      request,
      [{ type: 'text', text: answer.text }],
      'end_turn',
      result,
      task,
      false,
    );
  }

  private reply(
    request: MessagesRequest,
    content: ContentBlock[],
    stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal',
    result: WorkerResult,
    task: { system: string; prompt: string },
    truncated: boolean,
  ): Reply {
    const reported =
      result.usage !== null && result.usage.inputTokens > 0 && result.usage.outputTokens > 0;
    const inputTokens = reported
      ? result.usage!.inputTokens
      : estimateTokens(task.system + task.prompt);
    const outputTokens = truncated
      ? request.maxTokens
      : reported
        ? result.usage!.outputTokens
        : Math.max(1, estimateTokens(JSON.stringify(content)));

    const headers: Record<string, string> = {};

    if (!reported || truncated) {
      headers['x-soirely-usage'] = 'estimated';
    }

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
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
          server_tool_use: null,
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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARACTERS_PER_TOKEN);
}
