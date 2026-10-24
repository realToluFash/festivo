<?php

declare(strict_types=1);

namespace App\Http;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use Psl\Json;
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

        try {
            $decoded = Json\decode($raw);
        } catch (Json\Exception\DecodeException $e) {
            throw new ApiException(ErrorCode::BadRequest, 'The request body is not valid JSON.', [], $e);
        }

        // `[]` and `{}` decode to the same array, so only the text tells a list from an object.
        if (!Str\starts_with(\ltrim($raw), '{')) {
            throw new ShapeRefusal('');
        }

        return self::coerce($decoded, $shape, $refusals);
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
