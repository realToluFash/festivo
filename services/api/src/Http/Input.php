<?php

declare(strict_types=1);

namespace App\Http;

use App\Http\Exception\ApiException;
use Psl\Json;
use Psl\Type\Exception\CoercionException;
use Psl\Type\TypeInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Where untyped input becomes typed, and the only place allowed to do it.
 *
 * PHP answers bad input with a falsy value and a coercion. `json_decode`
 * returns null for both a literal null and a malformed body. A declared
 * `string $country` accepts an integer. `$request->query->get('q')` is
 * `string|null` whatever the handler's signature claims it to be. Every one of
 * those is a defect that typechecks, and the previous build shipped several —
 * a cache-key builder declaring `string ...$parts` was handed a null country
 * code, PHP coerced it on the way in, and it surfaced three frames later as a
 * 500 that never mentioned the country.
 *
 * So a handler never reaches into the request. It declares the shape it needs
 * and gets either that shape or an error naming the field that failed.
 *
 * The two failures are deliberately different statuses. A body that is not JSON
 * is a 400 — the request could not be read at all, and there is no field to
 * blame. A readable request whose fields are the wrong shape is a 422 carrying
 * the path as a violation, which is the channel clients already render field
 * errors from.
 */
final readonly class Input
{
    /**
     * The JSON body, as the declared shape.
     *
     * @template T
     *
     * @param TypeInterface<T> $shape
     *
     * @return T
     */
    public static function body(Request $request, TypeInterface $shape): mixed
    {
        $raw = $request->getContent();

        if ('' === trim($raw)) {
            throw new ApiException(ErrorCode::BadRequest, 'A JSON body is required.');
        }

        try {
            $decoded = Json\decode($raw);
        } catch (Json\Exception\DecodeException $e) {
            throw new ApiException(ErrorCode::BadRequest, 'The request body is not valid JSON.', [], $e);
        }

        return self::coerce($decoded, $shape);
    }

    /**
     * The query string, as the declared shape.
     *
     * Every value arrives as a string, so a shape declaring `Type\int()` is
     * doing real work: it coerces "5" to 5 and refuses "five", rather than
     * casting "five" to 0 the way `(int)` would.
     *
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
     * @param TypeInterface<T> $shape
     *
     * @return T
     */
    public static function coerce(mixed $value, TypeInterface $shape): mixed
    {
        try {
            return $shape->coerce($value);
        } catch (CoercionException $e) {
            throw ApiException::validation(
                [[
                    // Psl walks nested shapes and reports the path it stopped
                    // at. Empty when the top-level value itself is wrong — a
                    // list where an object was declared — and there is no
                    // field to point at.
                    'propertyPath' => implode('.', $e->getPaths()),
                    'message' => $e->getMessage(),
                    'code' => 'invalid_shape',
                ]],
                'The request does not have the expected shape.',
            );
        }
    }
}
