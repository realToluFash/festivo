<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\SignInResponse;
use App\Domain\User\SignInAttempts;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[PublicAccess]
final readonly class SignInController
{
    public function __construct(
        private SignInResponse $signInResponse,
        private SignInAttempts $signInAttempts,
    ) {
    }

    #[Route('/api/auth/login', name: 'auth_login', methods: ['POST'])]
    public function signIn(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'email' => Type\string(),
            'password' => Type\string(),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));

        $result = $this->signInAttempts->signIn($body['email'], $body['password'], $request);

        return $this->signInResponse->for($result->admission, $result->user, $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body, $request);
    }
}
