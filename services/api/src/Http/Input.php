<?php

declare(strict_types=1);

namespace App\Http;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use BackedEnum;
use JsonException;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Type\Exception\CoercionException;
use Psl\Type\TypeInterface;
use Symfony\Component\HttpFoundation\Request;

// A body that is not JSON is 400; a body that is JSON but the wrong shape is
// 422. Collapsing them loses the only signal that says which end is wrong.
final readonly class Input
{
    /**
     * @template T
     *
     * @param TypeInterface<T>      $shape
     * @param array<string, string> $refusals the refusal key for a field whose meaning has its own sentence, by path
     *
     * @return T
     */
    public static function body(Request $request, TypeInterface $shape, array $refusals = []): mixed
    {
        $raw = $request->getContent();

        if ('' === \trim($raw)) {
            throw new ApiException(ErrorCode::BadRequest, 'A JSON body is required.');
        }

        // Not Json\decode: it reads an integer past PHP_INT_MAX as a string, which a string field would then take.
        try {
            $decoded = \json_decode($raw, true, 512, \JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new ApiException(ErrorCode::BadRequest, 'The request body is not valid JSON.', [], $e);
        }

        // `[]` and `{}` decode to the same array, so only the text tells a list from an object.
        if (!Str\starts_with(\ltrim($raw), '{')) {
            throw new ShapeRefusal('');
        }

        $body = self::coerce($decoded, $shape, $refusals);

        $mismatch = self::mismatch($body, $decoded);

        if (null !== $mismatch) {
            $path = Str\join($mismatch, '.');

            throw new ShapeRefusal($path, $refusals[$path] ?? ShapeRefusal::FIELD);
        }

        return $body;
    }

    /**
     * @template T
     *
     * @param TypeInterface<T> $shape
     *
     * @return T
     */
    public static function query(Request $request, TypeInterface $shape): mixed
    {
        return self::coerce($request->query->all(), $shape);
    }

    /**
     * JSON has one number type, so a whole number read as a float, or written as 30.0 and read as an int, is not a change.
     *
     * @return list<string>|null the path of the first value coercion changed
     */
    private static function mismatch(mixed $coerced, mixed $sent): ?array
    {
        if (\is_array($coerced)) {
            if (!\is_array($sent) || (\array_is_list($coerced) && !\array_is_list($sent))) {
                return [];
            }

            foreach ($coerced as $key => $value) {
                if (!Iter\contains_key($sent, $key)) {
                    if (null === $value) {
                        continue;
                    }

                    return [(string) $key];
                }

                $inner = self::mismatch($value, $sent[$key]);

                if (null !== $inner) {
                    return [(string) $key, ...$inner];
                }
            }

            return null;
        }

        $same = match (true) {
            $coerced instanceof BackedEnum => $coerced->value === $sent,
            \is_float($coerced) && \is_int($sent) => true,
            \is_int($coerced) && \is_float($sent) => self::isWhole($sent) && (float) $coerced === $sent,
            default => $coerced === $sent,
        };

        return $same ? null : [];
    }

    // -PHP_INT_MIN is 2^63, a double but not an int: a cast from it or past it wraps rather than fails.
    private static function isWhole(float $number): bool
    {
        return $number >= (float) \PHP_INT_MIN && $number < -(float) \PHP_INT_MIN && Math\floor($number) === $number;
    }

    /**
     * @template T
     *
     * @param TypeInterface<T>      $shape
     * @param array<string, string> $refusals
     *
     * @return T
     */
    public static function coerce(mixed $value, TypeInterface $shape, array $refusals = []): mixed
    {
        try {
            return $shape->coerce($value);
        } catch (CoercionException $e) {
            $path = Str\join($e->getPaths(), '.');

            throw new ShapeRefusal($path, $refusals[$path] ?? ShapeRefusal::FIELD, $e);
        }
    }
}
