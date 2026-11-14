<?php

declare(strict_types=1);

namespace App\Http\Access;

use Closure;
use Psl\Str;

/** A controller as a class and a method, however Symfony was handed it. */
final class ControllerName
{
    /** @return array{0: string, 1: string} */
    public static function split(mixed $controller): array
    {
        return match (true) {
            \is_array($controller) && \is_object($controller[0]) => [$controller[0]::class, (string) $controller[1]],
            \is_array($controller) => [(string) $controller[0], (string) $controller[1]],
            \is_string($controller) && Str\contains($controller, '::') => self::pair($controller),
            \is_string($controller) => [$controller, '__invoke'],
            \is_object($controller) && !$controller instanceof Closure => [$controller::class, '__invoke'],
            default => ['', ''],
        };
    }

    /** @return array{0: string, 1: string} */
    private static function pair(string $controller): array
    {
        [$class, $method] = Str\split($controller, '::', 2);

        return [$class, $method];
    }
}
