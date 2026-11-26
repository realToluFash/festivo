<?php

declare(strict_types=1);

namespace App\Domain\User\Http;

use App\Domain\User\Model\IssuedTokens;
use App\Enum\RefreshTokenDelivery;
use App\Http\RefreshTokenCookies;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

final class IssuedTokensResponse extends JsonResponse
{
    /** @param array<string, mixed> $alongside */
    public function __construct(
        IssuedTokens $tokens,
        RefreshTokenDelivery $delivery,
        Request $request,
        array $alongside = [],
        int $status = Response::HTTP_OK,
    ) {
        $payload = $alongside + [
            'accessToken' => $tokens->accessToken,
            'refreshExpiresAt' => $tokens->refreshExpiresAt->format(\DATE_ATOM),
            'sessionId' => $tokens->sessionId->toRfc4122(),
        ];

        if (RefreshTokenDelivery::Body === $delivery) {
            $payload['refreshToken'] = $tokens->refreshToken;
        }

        parent::__construct($payload, $status);

        if (RefreshTokenDelivery::Cookie === $delivery) {
            RefreshTokenCookies::attachTo($this, $tokens->refreshToken, $tokens->refreshExpiresAt, $request);
        }
    }
}
