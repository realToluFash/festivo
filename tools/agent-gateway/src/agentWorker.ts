import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { query, type Options, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { WorkerFailed, type Worker, type WorkerResult, type WorkerTask } from './worker.ts';

export class AgentWorker implements Worker {
  async run(task: WorkerTask): Promise<WorkerResult> {
    if (task.signal.aborted) {
      throw new WorkerFailed('The caller hung up before the worker started.');
    }

    const abortController = new AbortController();
    const abort = () => abortController.abort();
    task.signal.addEventListener('abort', abort, { once: true });

    const cwd = await mkdtemp(join(tmpdir(), 'agent-gateway-'));

    try {
      return read(await finalResult(task, options(task, abortController, cwd)));
    } finally {
      task.signal.removeEventListener('abort', abort);
      await rm(cwd, { recursive: true, force: true });
    }
  }
}

function options(task: WorkerTask, abortController: AbortController, cwd: string): Options {
  return {
    abortController,
    cwd,
    model: task.model,
    systemPrompt: task.system,
    outputFormat: { type: 'json_schema', schema: task.schema },
    // Isolation from the developer's machine: no built-in tools, no ~/.claude settings, no MCP servers.
    tools: [],
    settingSources: [],
    mcpServers: {},
    strictMcpConfig: true,
    skills: [],
    persistSession: false,
    thinking: task.thinking,
    ...(task.effort === null ? {} : { effort: task.effort }),
  };
}

async function finalResult(task: WorkerTask, options: Options): Promise<SDKResultMessage> {
  let result: SDKResultMessage | null = null;

  try {
    for await (const message of query({ prompt: task.prompt, options })) {
      if (message.type === 'result') {
        result = message;
      }
    }
  } catch (error) {
    throw new WorkerFailed(error instanceof Error ? error.message : String(error));
  }

  if (result === null) {
    throw new WorkerFailed('The worker ended without a result.');
  }

  return result;
}

function read(result: SDKResultMessage): WorkerResult {
  const usage = {
    inputTokens:
      result.usage.input_tokens +
      result.usage.cache_read_input_tokens +
      result.usage.cache_creation_input_tokens,
    outputTokens: result.usage.output_tokens,
  };

  if (result.stop_reason === 'refusal') {
    return { output: null, stopReason: 'refusal', usage };
  }

  if (result.subtype !== 'success') {
    if (result.subtype === 'error_max_structured_output_retries') {
      return { output: null, stopReason: result.stop_reason, usage };
    }

    throw new WorkerFailed(`${result.subtype}: ${result.errors.join('; ')}`);
  }

  return { output: result.structured_output ?? null, stopReason: result.stop_reason, usage };
}
