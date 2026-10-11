<?php

declare(strict_types=1);

namespace App\Http;

use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * The one shape every endpoint answers in.
 *
 * A client that has to recognise a different envelope per endpoint ends up
 * with a different error path per endpoint, and most of them never get
 * exercised. One shape means one place to handle a failure.
 */
final class ApiResponse
{
    public static function ok(mixed $data = null, int $status = 200): JsonResponse
    {
        return new JsonResponse(['success' => true, 'data' => $data], $status);
    }

    public static function created(mixed $data = null): JsonResponse
    {
        return self::ok($data, 201);
    }

    public static function noContent(): JsonResponse
    {
        return new JsonResponse(null, 204);
    }

    /**
     * @param array<string, array{code: string, message: string}> $fields
     */
    public static function error(
        ErrorCode $code,
        string $message,
        array $fields = [],
        ?string $correlationId = null,
    ): JsonResponse {
        $body = [
            'success' => false,
            'error' => $message,
            'code' => $code->value,
        ];

        if ([] !== $fields) {
            $body['fields'] = $fields;
        }

        if (null !== $correlationId) {
            $body['correlation_id'] = $correlationId;
        }

        return new JsonResponse($body, $code->status());
    }

    /**
     * A page of a list.
     *
     * Decided once, here, rather than per endpoint. The previous build returned
     * three different pagination shapes and every client carried three readers.
     *
     * @param list<mixed> $items
     */
    public static function page(
        array $items,
        int $page,
        int $perPage,
        ?int $total = null,
        ?string $nextCursor = null,
    ): JsonResponse {
        $meta = [
            'page' => $page,
            'per_page' => $perPage,
        ];

        // A total is honest only when it was actually counted. A cursor-paged
        // list does not know one, and inventing a zero reads as "no results".
        if (null !== $total) {
            $meta['total'] = $total;
            $meta['total_pages'] = $perPage > 0 ? (int) ceil($total / $perPage) : 0;
        }

        if (null !== $nextCursor) {
            $meta['next_cursor'] = $nextCursor;
        }

        return self::ok(['items' => $items, 'meta' => $meta]);
    }
}
