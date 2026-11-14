<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Http\Access\Policy\Policy;
use LogicException;
use Psl\Iter;
use Psl\Str;
use ReflectionAttribute;
use ReflectionClass;
use ReflectionMethod;

/** One reading of a route's policy, shared by the boot check and the request check so they cannot disagree. */
final class PolicyReader
{
    /** An API Platform operation's policy is on its resource class; anything else, on its controller. */
    public static function forRoute(mixed $controller, mixed $resourceClass): ?Policy
    {
        if (\is_string($resourceClass) && '' !== $resourceClass) {
            return self::read($resourceClass, '');
        }

        [$class, $method] = ControllerName::split($controller);

        return self::read($class, $method);
    }

    /** The method's own policy wins over its class's; two on one level is a mistake, not a choice. */
    public static function read(string $class, string $method): ?Policy
    {
        if (!\class_exists($class)) {
            return null;
        }

        $reflection = new ReflectionClass($class);
        $onMethod = '' !== $method && $reflection->hasMethod($method) ? self::policies(new ReflectionMethod($class, $method)) : [];
        $chosen = [] !== $onMethod ? $onMethod : self::policies($reflection);

        if (Iter\count($chosen) > 1) {
            throw new LogicException(Str\format('%s::%s declares more than one access policy.', $class, $method));
        }

        return $chosen[0] ?? null;
    }

    /** @return list<Policy> */
    private static function policies(ReflectionClass|ReflectionMethod $target): array
    {
        $policies = [];

        foreach ($target->getAttributes(Policy::class, ReflectionAttribute::IS_INSTANCEOF) as $attribute) {
            $policies[] = $attribute->newInstance();
        }

        return $policies;
    }
}
