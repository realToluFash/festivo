<?php

declare(strict_types=1);

namespace App\Enum;

/** What a press on the night screen does to its item (sc-3895). */
enum PressKind: string
{
    case Start = 'start';
    case Done = 'done';
    case Skip = 'skip';
}
