<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\Http\SignInResponse;
use App\Domain\User\Recovery\PasswordRecovery;
use App\Domain\User\Recovery\RecoveryRequests;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use stdClass;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

#[PublicAccess]
final readonly class PasswordRecoveryController
{
    public function __construct(
        private PasswordRecovery $passwordRecovery,
        private RecoveryRequests $recoveryRequests,
        private SignInResponse $signInResponse,
        private RateLimiterFactoryInterface $passwordResetAddressLimiter,
        private RateLimiterFactoryInterface $passwordResetIpLimiter,
    ) {
    }

    /** The same answer for an account, an unknown address and a provider account alike. */
    #[Route('/api/auth/password/forgot', name: 'auth_password_forgot', methods: ['POST'])]
    public function forgot(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['email' => Type\string()]));

        foreach ([
            $this->passwordResetAddressLimiter->create(EmailAddressNormaliser::normalise($body['email'])),
            $this->passwordResetIpLimiter->create($request->getClientIp()),
        ] as $limiter) {
            $limit = $limiter->consume();

            if (!$limit->isAccepted()) {
                throw ApiException::tooManyAttempts('Too many reset requests.', $limit->getRetryAfter());
            }
        }

        $this->recoveryRequests->accept($body['email']);

        return new JsonResponse(new stdClass(), Response::HTTP_ACCEPTED);
    }

    #[Route('/api/auth/password/reset/check', name: 'auth_password_reset_check', methods: ['POST'])]
    public function check(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['token' => Type\string()]));
        $user = $this->passwordRecovery->check($body['token']);

        return new JsonResponse([
            'email' => $user->getPrimaryEmailAddress()?->getAddress(),
            'twoFactor' => $this->passwordRecovery->asksForSecondFactor($user),
        ]);
    }

    #[Route('/api/auth/password/reset/code', name: 'auth_password_reset_code', methods: ['POST'])]
    public function code(Request $request): Response
    {
        $body = Input::body($request, Type\shape([
            'token' => Type\string(),
            'code' => Type\optional(Type\string()),
            'recoveryCode' => Type\optional(Type\string()),
        ]));

        $this->passwordRecovery->passSecondFactor($body['token'], $body['code'] ?? null, $body['recoveryCode'] ?? null);

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/auth/password/reset', name: 'auth_password_reset', methods: ['POST'])]
    public function reset(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'token' => Type\string(),
            'password' => Type\string(),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));

        $result = $this->passwordRecovery->reset($body['token'], $body['password'], $request);

        return $this->signInResponse->for($result->admission, $result->user, $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body, $request);
    }
}
