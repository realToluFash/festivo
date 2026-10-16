<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\Http\IssuedTokensResponse;
use App\Domain\User\UserAuthenticator;
use App\Enum\ErrorCode;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimit;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

#[PublicAccess]
final class SignInController
{
    public function __construct(
        private readonly UserAuthenticator $userAuthenticator,
        private readonly RateLimiterFactoryInterface $signInIpLimiter,
        private readonly RateLimiterFactoryInterface $signInAccountLimiter,
    ) {
    }

    #[Route('/api/auth/login', name: 'auth_login', methods: ['POST'])]
    public function signIn(Request $request): IssuedTokensResponse
    {
        $body = Input::body($request, Type\shape([
            'email' => Type\string(),
            'password' => Type\string(),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));

        // Keyed on the address as given: limiting only known accounts answers "is this registered".
        $limits = [
            $this->signInAccountLimiter->create(EmailAddressNormaliser::normalise($body['email'])),
            $this->signInIpLimiter->create($request->getClientIp()),
        ];

        foreach ($limits as $limit) {
            self::refuseIfSpent($limit->consume(0));
        }

        try {
            $result = $this->userAuthenticator->signIn($body['email'], $body['password'], $request);
        } catch (ApiException $e) {
            if (ErrorCode::InvalidCredentials === $e->errorCode) {
                foreach ($limits as $limit) {
                    $limit->consume();
                }
            }

            throw $e;
        }

        return new IssuedTokensResponse(
            $result->tokens,
            $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body,
            $request,
            ['account' => AccountSerialiser::serialise($result->user)],
        );
    }

    /** A peek, not a spend: only a refused password costs anything, so a success spends nothing. */
    private static function refuseIfSpent(RateLimit $peek): void
    {
        if ($peek->getRemainingTokens() > 0) {
            return;
        }

        throw ApiException::tooManyAttempts('Too many sign-in attempts.', $peek->getRetryAfter());
    }
}
