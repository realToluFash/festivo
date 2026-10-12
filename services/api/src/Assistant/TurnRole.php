<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * What a turn in the conversation is.
 *
 * Four kinds rather than two, because a tool round trip is part of the
 * conversation and has to be replayed as faithfully as the text. A history that
 * drops the call and keeps only its result reads, to the model, as a fact
 * nobody asked for.
 */
enum TurnRole: string
{
    case User = 'user';
    case Assistant = 'assistant';
    case ToolCall = 'tool_call';
    case ToolResult = 'tool_result';
}
