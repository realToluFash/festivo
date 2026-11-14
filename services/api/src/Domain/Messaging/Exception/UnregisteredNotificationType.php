<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exception;

use LogicException;
use Psl\Str;

final class UnregisteredNotificationType extends LogicException
{
    public function __construct(public readonly string $type)
    {
        parent::__construct(Str\format('"%s" is not a registered notification type.', $type));
    }
}
