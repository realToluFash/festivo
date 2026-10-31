<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

enum EventVerdict
{
    case Send;
    case Hold;
    case Cancel;
}
