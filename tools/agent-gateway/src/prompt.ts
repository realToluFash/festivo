import type { Block, MessagesRequest, Tool } from './request.ts';

const ROLE = `You are answering the next turn of a conversation, as the assistant the instructions below describe.

You have no tools of your own: you cannot read files, run commands, search or browse, and you must not try. Answer only through the structured output, in one of two ways:

- {"type": "text", "text": "..."}: your reply to the conversation's last message.
- {"type": "tool_use", "name": "...", "input": {...}}: a call to one of the caller's tools listed below, when you need it to answer. The caller runs it, not you, and its result arrives in a later turn. Call at most one tool, and only one that is listed.`;

export function systemFor(request: MessagesRequest): string {
  const parts = [ROLE];

  if (request.tools.length > 0) {
    parts.push(`# The caller's tools\n\n${request.tools.map(describeTool).join('\n\n')}`);
  } else {
    parts.push("# The caller's tools\n\nNone. Answer with text.");
  }

  if (request.system.length > 0) {
    parts.push(`# Instructions\n\n${request.system.join('\n\n')}`);
  }

  return parts.join('\n\n');
}

export function promptFor(request: MessagesRequest): string {
  const turns = request.messages.map(
    (message) =>
      `<turn role="${message.role}">\n${message.content.map(renderBlock).join('\n')}\n</turn>`,
  );

  return `<conversation>\n${turns.join('\n')}\n</conversation>\n\nWrite the assistant's next turn.`;
}

export function answerSchema(tools: Tool[]): Record<string, unknown> {
  const text = {
    type: 'object',
    properties: { type: { const: 'text' }, text: { type: 'string' } },
    required: ['type', 'text'],
    additionalProperties: false,
  };

  const calls = tools.map((tool) => ({
    type: 'object',
    properties: {
      type: { const: 'tool_use' },
      name: { const: tool.name },
      input: tool.inputSchema,
    },
    required: ['type', 'name', 'input'],
    additionalProperties: false,
  }));

  return {
    type: 'object',
    properties: { answer: { anyOf: [text, ...calls] } },
    required: ['answer'],
    additionalProperties: false,
  };
}

function describeTool(tool: Tool): string {
  return `## ${tool.name}\n\n${tool.description}\n\nInput schema: ${JSON.stringify(tool.inputSchema)}`;
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'text':
      return block.text;
    case 'tool_use':
      return `<tool_use id="${block.id}" name="${block.name}">${JSON.stringify(block.input)}</tool_use>`;
    case 'tool_result':
      return `<tool_result tool_use_id="${block.toolUseId}"${block.isError ? ' is_error="true"' : ''}>${block.content}</tool_result>`;
  }
}
