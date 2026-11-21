<?php

declare(strict_types=1);

namespace App\Http\Access;

use Psl\Iter;

/** Routes the framework registers, where no attribute can go. Each is public, and each is named. */
final class FrameworkRoutes
{
    public const array PUBLIC = [
        'api_doc',
        'api_genid',
        'api_validation_errors',
        '_api_errors',
        '_api_validation_errors_problem',
        '_api_validation_errors_hydra',
        '_api_validation_errors_jsonapi',
        '_api_validation_errors_xml',
        '_preview_error',
    ];

    public static function isPublic(string $route): bool
    {
        return Iter\contains(self::PUBLIC, $route);
    }
}
