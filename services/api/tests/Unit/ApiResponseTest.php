<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Http\ApiResponse;
use App\Http\ErrorCode;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class ApiResponseTest extends TestCase
{
    #[Test]
    public function aSuccessCarriesDataAndNothingElse(): void
    {
        $body = $this->decode(ApiResponse::ok(['id' => 1]));

        self::assertTrue($body['success']);
        self::assertSame(['id' => 1], $body['data']);
        self::assertArrayNotHasKey('error', $body);
        self::assertArrayNotHasKey('code', $body);
    }

    #[Test]
    public function aFailureCarriesACodeAndASentence(): void
    {
        $response = ApiResponse::error(ErrorCode::NotFound, 'No such guest.');
        $body = $this->decode($response);

        self::assertSame(404, $response->getStatusCode());
        self::assertFalse($body['success']);
        self::assertSame('not_found', $body['code']);
        self::assertSame('No such guest.', $body['error']);
        self::assertArrayNotHasKey('fields', $body);
    }

    #[Test]
    public function aValidationFailureMarksTheFields(): void
    {
        $response = ApiResponse::error(
            ErrorCode::ValidationFailed,
            'Check the form.',
            ['email' => ['code' => 'not_an_email', 'message' => 'That is not an email address.']],
        );
        $body = $this->decode($response);

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('not_an_email', $body['fields']['email']['code']);
    }

    #[Test]
    public function theStatusComesFromTheCodeNotTheCaller(): void
    {
        self::assertSame(403, ApiResponse::error(ErrorCode::Forbidden, 'x')->getStatusCode());
        self::assertSame(429, ApiResponse::error(ErrorCode::TooManyRequests, 'x')->getStatusCode());
        self::assertSame(500, ApiResponse::error(ErrorCode::InternalError, 'x')->getStatusCode());
    }

    #[Test]
    public function aPageReportsItsOwnTotals(): void
    {
        $body = $this->decode(ApiResponse::page(['a', 'b'], page: 2, perPage: 2, total: 7));

        self::assertSame(['a', 'b'], $body['data']['items']);
        self::assertSame(2, $body['data']['meta']['page']);
        self::assertSame(7, $body['data']['meta']['total']);
        self::assertSame(4, $body['data']['meta']['total_pages']);
    }

    /**
     * A cursor-paged list does not know a total, and reporting zero reads as
     * "no results" to anything rendering a count.
     */
    #[Test]
    public function aCursorPageOmitsATotalRatherThanInventingOne(): void
    {
        $body = $this->decode(ApiResponse::page(['a'], page: 1, perPage: 1, nextCursor: 'abc'));

        self::assertArrayNotHasKey('total', $body['data']['meta']);
        self::assertSame('abc', $body['data']['meta']['next_cursor']);
    }

    /** @return array<string, mixed> */
    private function decode(\Symfony\Component\HttpFoundation\JsonResponse $r): array
    {
        return json_decode((string) $r->getContent(), true, 512, \JSON_THROW_ON_ERROR);
    }
}
