<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\UserRegistrar;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

final class RegisterController
{
    public function __construct(
        private readonly UserRegistrar $registration,
        private readonly RateLimiterFactoryInterface $registrationLimiter,
    ) {
    }

    #[Route('/api/auth/register', name: 'auth_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $this->limit($request);

        $body = Input::body($request, Type\shape([
            'email' => Type\string(),
            'name' => Type\string(),
            'password' => Type\string(),
        ]));

        $result = $this->registration->register(
            $body['email'],
            $body['name'],
            $body['password'],
            $request,
        );

        return new JsonResponse([
            'user' => [
                'id' => $result->user->getId()->toRfc4122(),
                'email' => $result->user->getPrimaryEmailAddress()?->getAddress(),
                'name' => $result->user->getName(),
                'emailVerified' => $result->user->getPrimaryEmailAddress()?->isVerified() ?? false,
                'profileComplete' => $result->user->isComplete(),
            ],
            'accessToken' => $result->tokens->accessToken,
            'refreshToken' => $result->tokens->refreshToken,
            'refreshExpiresAt' => $result->tokens->refreshExpiresAt->format(\DATE_ATOM),
        ], Response::HTTP_CREATED);
    }

    private function limit(Request $request): void
    {
        if (!$this->registrationLimiter->create($request->getClientIp())->consume()->isAccepted()) {
            throw new ApiException(
                ErrorCode::TooManyRequests,
                'Too many sign-ups from this network. Wait a while, then try again.',
            );
        }
    }
}
