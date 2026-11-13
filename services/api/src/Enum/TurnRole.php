<?php

declare(strict_types=1);

namespace App\Enum;

enum TurnRole: string
{
    case User = 'user';
    case Assistant = 'assistant';
    case ToolCall = 'tool_call';
    case ToolResult = 'tool_result';
}
