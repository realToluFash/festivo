<?php

declare(strict_types=1);

namespace App\Enum;

/** One person's answer to one course that asks (sc-3907). Not answered is no answer at all; Defaulted is set only by sc-1362, and MenuChanged only by a menu change that asks them again (sc-3913). */
enum MealAnswerKind: string
{
    case Chosen = 'chosen';
    case ChefsChoice = 'chefsChoice';
    case Skipped = 'skipped';
    case NeedsHost = 'needsHost';
    case Defaulted = 'defaulted';
    case MenuChanged = 'menuChanged';
}
