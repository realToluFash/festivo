import { GatewayError } from './errors.ts';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type Thinking =
  { type: 'adaptive' } | { type: 'disabled' } | { type: 'enabled'; budgetTokens: number };

export type TextBlock = { type: 'text'; text: string };

export type ToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ToolResultBlock = {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError: boolean;
};

export type Block = TextBlock | ToolUseBlock | ToolResultBlock;

export type Message = { role: 'user' | 'assistant'; content: Block[] };

export type Tool = { name: string; description: string; inputSchema: Record<string, unknown> };

export type MessagesRequest = {
  model: string;
  maxTokens: number;
  system: string[];
  messages: Message[];
  tools: Tool[];
  thinking: Thinking;
  effort: Effort | null;
};

const EFFORTS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max'];

const ACCEPTED_AND_IGNORED = ['metadata', 'temperature', 'top_p', 'top_k', 'service_tier'];

const KNOWN = [
  'model',
  'max_tokens',
  'messages',
  'system',
  'tools',
  'tool_choice',
  'thinking',
  'output_config',
  'stream',
  'stop_sequences',
  ...ACCEPTED_AND_IGNORED,
];

export function parseRequest(body: unknown): MessagesRequest {
  const request = object(body, 'The request body');

  for (const key of Object.keys(request)) {
    if (!KNOWN.includes(key)) {
      throw GatewayError.invalid(`${key}: Extra inputs are not permitted`);
    }
  }

  if (request['stream'] === true) {
    throw GatewayError.unsupported('stream: true (streaming)');
  }

  if (Array.isArray(request['stop_sequences']) && request['stop_sequences'].length > 0) {
    throw GatewayError.unsupported('stop_sequences');
  }

  const tools = parseTools(request['tools']);

  return {
    model: nonEmptyString(request['model'], 'model'),
    maxTokens: positiveInteger(request['max_tokens'], 'max_tokens'),
    system: parseSystem(request['system']),
    messages: parseMessages(request['messages']),
    tools: toolChoice(request['tool_choice']) === 'none' ? [] : tools,
    thinking: parseThinking(request['thinking']),
    effort: parseEffort(request['output_config']),
  };
}

function parseSystem(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (typeof value === 'string') {
    return [value];
  }

  return array(value, 'system').map((block, i) => textBlock(block, `system.${i}`).text);
}

function parseMessages(value: unknown): Message[] {
  const messages = array(value, 'messages');

  if (messages.length === 0) {
    throw GatewayError.invalid('messages: at least one message is required');
  }

  const parsed = messages.map((message, i) => parseMessage(message, `messages.${i}`));

  if (parsed[0]?.role !== 'user') {
    throw GatewayError.invalid('messages: the first message must use the "user" role');
  }

  return parsed;
}

function parseMessage(value: unknown, at: string): Message {
  const message = object(value, at);
  const role = message['role'];

  if (role !== 'user' && role !== 'assistant') {
    throw GatewayError.invalid(`${at}.role: Input should be 'user' or 'assistant'`);
  }

  const content = message['content'];

  if (typeof content === 'string') {
    return { role, content: [{ type: 'text', text: content }] };
  }

  const blocks = array(content, `${at}.content`).flatMap((block, i) => {
    const parsed = parseBlock(block, `${at}.content.${i}`);

    return parsed === null ? [] : [parsed];
  });

  return { role, content: blocks };
}

function parseBlock(value: unknown, at: string): Block | null {
  const block = object(value, at);

  switch (block['type']) {
    case 'text':
      return textBlock(block, at);
    case 'thinking':
    case 'redacted_thinking':
      return null;
    case 'tool_use':
      return {
        type: 'tool_use',
        id: nonEmptyString(block['id'], `${at}.id`),
        name: nonEmptyString(block['name'], `${at}.name`),
        input: object(block['input'], `${at}.input`),
      };
    case 'tool_result':
      return {
        type: 'tool_result',
        toolUseId: nonEmptyString(block['tool_use_id'], `${at}.tool_use_id`),
        content: toolResultContent(block['content'], `${at}.content`),
        isError: block['is_error'] === true,
      };
    default:
      throw GatewayError.unsupported(`${at}: a "${String(block['type'])}" content block`);
  }
}

function toolResultContent(value: unknown, at: string): string {
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return array(value, at)
    .map((block, i) => textBlock(block, `${at}.${i}`).text)
    .join('\n');
}

function textBlock(value: unknown, at: string): TextBlock {
  const block = object(value, at);

  if (block['type'] !== 'text') {
    throw GatewayError.unsupported(`${at}: a "${String(block['type'])}" content block`);
  }

  if (typeof block['text'] !== 'string') {
    throw GatewayError.invalid(`${at}.text: Field required`);
  }

  return { type: 'text', text: block['text'] };
}

function parseTools(value: unknown): Tool[] {
  if (value === undefined || value === null) {
    return [];
  }

  const tools = array(value, 'tools').map((raw, i): Tool => {
    const tool = object(raw, `tools.${i}`);

    if (tool['type'] !== undefined && tool['type'] !== 'custom') {
      throw GatewayError.unsupported(`tools.${i}: the server tool "${String(tool['type'])}"`);
    }

    const inputSchema = object(tool['input_schema'], `tools.${i}.input_schema`);

    if (inputSchema['type'] !== 'object') {
      throw GatewayError.invalid(`tools.${i}.input_schema.type: Input should be 'object'`);
    }

    return {
      name: nonEmptyString(tool['name'], `tools.${i}.name`),
      description: typeof tool['description'] === 'string' ? tool['description'] : '',
      inputSchema,
    };
  });

  const names = new Set(tools.map((tool) => tool.name));

  if (names.size !== tools.length) {
    throw GatewayError.invalid('tools: Tool names must be unique.');
  }

  return tools;
}

function toolChoice(value: unknown): 'auto' | 'none' {
  if (value === undefined) {
    return 'auto';
  }

  const type = object(value, 'tool_choice')['type'];

  if (type === 'auto' || type === 'none') {
    return type;
  }

  throw GatewayError.unsupported(`tool_choice "${String(type)}"`);
}

function parseThinking(value: unknown): Thinking {
  if (value === undefined) {
    return { type: 'disabled' };
  }

  const thinking = object(value, 'thinking');

  switch (thinking['type']) {
    case 'adaptive':
      return { type: 'adaptive' };
    case 'disabled':
      return { type: 'disabled' };
    case 'enabled':
      return {
        type: 'enabled',
        budgetTokens: positiveInteger(thinking['budget_tokens'], 'thinking.budget_tokens'),
      };
    default:
      throw GatewayError.invalid(
        `thinking.type: Input should be 'adaptive', 'enabled' or 'disabled'`,
      );
  }
}

function parseEffort(value: unknown): Effort | null {
  if (value === undefined) {
    return null;
  }

  const config = object(value, 'output_config');

  for (const key of Object.keys(config)) {
    if (key !== 'effort') {
      throw GatewayError.unsupported(`output_config.${key}`);
    }
  }

  const effort = config['effort'];

  if (effort === undefined) {
    return null;
  }

  if (typeof effort !== 'string' || !EFFORTS.includes(effort)) {
    throw GatewayError.invalid(
      `output_config.effort: Input should be one of ${EFFORTS.join(', ')}`,
    );
  }

  return effort as Effort;
}

function object(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw GatewayError.invalid(`${at}: Input should be an object`);
  }

  return value as Record<string, unknown>;
}

function array(value: unknown, at: string): unknown[] {
  if (!Array.isArray(value)) {
    throw GatewayError.invalid(`${at}: Input should be a valid list`);
  }

  return value;
}

function nonEmptyString(value: unknown, at: string): string {
  if (typeof value !== 'string' || value === '') {
    throw GatewayError.invalid(`${at}: Field required`);
  }

  return value;
}

function positiveInteger(value: unknown, at: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw GatewayError.invalid(`${at}: Input should be an integer greater than or equal to 1`);
  }

  return value;
}
