<?php

declare(strict_types=1);

namespace App\AppVersion\Exception;

use Psl\Str;
use RuntimeException;

final class MinimumAppVersionMalformed extends RuntimeException
{
    public function __construct(string $setting, string $value)
    {
        parent::__construct(Str\format(
            '%s is "%s", which is not a version. Set it to three numbers, major.minor.patch such as 1.4.0, or leave it empty for no minimum.',
            $setting,
            $value,
        ));
    }
}
