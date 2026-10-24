<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\Http\SignInResponse;
use App\Domain\User\Recovery\PasswordRecovery;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\AfterResponse;
use App\Http\CodeField;
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
        private AfterResponse $afterResponse,
        private SignInResponse $signInResponse,
        private RateLimiterFactoryInterface $passwordResetAddressLimiter,
        private RateLimiterFactoryInterface $passwordResetIpLimiter,
        private CodeField $codeField,
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

        // After the answer has gone, or a registered address would answer slower than an unknown one.
        $email = $body['email'];
        $locale = $request->getLocale();
        $this->afterResponse->defer(fn () => $this->passwordRecovery->request($email, $locale));

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
            'code' => Type\optional(Type\mixed()),
            'recoveryCode' => Type\optional(Type\mixed()),
        ]));
        $code = $this->codeField->optional($body, 'code', CodeField::FROM_APP);
        $recoveryCode = $this->codeField->optional($body, 'recoveryCode', CodeField::RECOVERY);

        // Neither sent is the app's code missing, the field the screen asks for first.
        if (null === $code && null === $recoveryCode) {
            $code = $this->codeField->required($body, 'code', CodeField::FROM_APP);
        }

        $this->passwordRecovery->passSecondFactor($body['token'], $code, $recoveryCode);

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
