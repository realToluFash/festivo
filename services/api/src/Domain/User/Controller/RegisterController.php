<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\Http\IssuedTokensResponse;
use App\Domain\User\UserRegistrar;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

#[PublicAccess]
final class RegisterController
{
    public function __construct(
        private readonly AccountSerialiser $accountSerialiser,
        private readonly UserRegistrar $registration,
        private readonly RateLimiterFactoryInterface $registrationLimiter,
    ) {
    }

    #[Route('/api/auth/register', name: 'auth_register', methods: ['POST'])]
    public function register(Request $request): IssuedTokensResponse
    {
        $this->limit($request);

        $body = Input::body($request, Type\shape([
            'email' => Type\string(),
            'name' => Type\string(),
            'password' => Type\string(),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));

        $result = $this->registration->register(
            $body['email'],
            $body['name'],
            $body['password'],
            $request,
        );

        return new IssuedTokensResponse(
            $result->tokens,
            $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body,
            $request,
            ['account' => $this->accountSerialiser->serialise($result->user)],
            Response::HTTP_CREATED,
        );
    }

    private function limit(Request $request): void
    {
        $limit = $this->registrationLimiter->create($request->getClientIp())->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('Too many sign-ups from this network.', $limit->getRetryAfter());
        }
    }
}
