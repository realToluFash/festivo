<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

enum PathSymptom: string
{
    case Stopped = 'stopped';
    case Behind = 'behind';
    case Failing = 'failing';
}
