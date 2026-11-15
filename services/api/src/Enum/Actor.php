<?php

declare(strict_types=1);

namespace App\Enum;

use Elao\Enum\Attribute\ReadableEnum;
use Elao\Enum\Bridge\Symfony\Translation\TranslatableEnumInterface;
use Elao\Enum\Bridge\Symfony\Translation\TranslatableEnumTrait;

#[ReadableEnum(prefix: 'actor.', useValueAsDefault: true)]
enum Actor: string implements TranslatableEnumInterface
{
    use TranslatableEnumTrait;

    case User = 'user';
    case Agent = 'agent';
    case System = 'system';
    case ApiClient = 'api_client';
}
