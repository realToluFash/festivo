<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\UserAuthenticator;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
use DateTimeImmutable;
use Psl\Math;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

final class SignInController
{
    public function __construct(
        private readonly UserAuthenticator $userAuthenticator,
        private readonly RateLimiterFactoryInterface $signInIpLimiter,
        private readonly RateLimiterFactoryInterface $signInAccountLimiter,
    ) {
    }

    #[Route('/api/auth/login', name: 'auth_login', methods: ['POST'])]
    public function signIn(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'email' => Type\string(),
            'password' => Type\string(),
        ]));

        $this->limit($request, $body['email']);

        $tokens = $this->userAuthenticator->signIn($body['email'], $body['password'], $request);

        return new JsonResponse([
            'accessToken' => $tokens->accessToken,
            'refreshToken' => $tokens->refreshToken,
            'refreshExpiresAt' => $tokens->refreshExpiresAt->format(\DATE_ATOM),
            'sessionId' => $tokens->sessionId->toRfc4122(),
        ]);
    }

    /**
     * Keyed on the address as given, not on an account. Limiting only known
     * accounts answers "is this registered" through the rate limit.
     */
    private static function secondsUntil(DateTimeImmutable $moment): int
    {
        return Math\maxva(1, $moment->getTimestamp() - new DateTimeImmutable()->getTimestamp());
    }

    private function limit(Request $request, string $email): void
    {
        $byAddress = $this->signInAccountLimiter
            ->create(EmailAddressNormaliser::normalise($email))
            ->consume();

        $byIp = $this->signInIpLimiter->create($request->getClientIp())->consume();

        foreach ([$byAddress, $byIp] as $limit) {
            if (!$limit->isAccepted()) {
                throw new ApiException(
                    ErrorCode::TooManyAttempts,
                    'Too many sign-in attempts. Try again at ' . $limit->getRetryAfter()->format('H:i') . '.',
                    [],
                    null,
                    ['Retry-After' => (string) self::secondsUntil($limit->getRetryAfter())],
                );
            }
        }
    }
}
