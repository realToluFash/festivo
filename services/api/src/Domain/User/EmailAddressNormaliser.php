<?php

declare(strict_types=1);

namespace App\Domain\User;

use Psl\Str;

final readonly class EmailAddressNormaliser
{
    public static function normalise(string $email): string
    {
        return Str\lowercase(Str\trim($email));
    }
}
