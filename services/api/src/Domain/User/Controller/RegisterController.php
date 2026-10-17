<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\Http\IssuedTokensResponse;
use App\Domain\User\Registration\PendingRegistrations;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\CodeField;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

#[PublicAccess]
final class RegisterController
{
    public function __construct(
        private readonly AccountSerialiser $accountSerialiser,
        private readonly PendingRegistrations $pendingRegistrations,
        private readonly RateLimiterFactoryInterface $registrationLimiter,
        private readonly CodeField $codeField,
    ) {
    }

    /** The same answer for every address, new or held by an account: the code, or the email, follows. */
    #[Route('/api/auth/register', name: 'auth_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $this->limit($request);

        $body = Input::body($request, Type\shape([
            'email' => Type\string(),
            'name' => Type\string(),
            'password' => Type\string(),
        ]));

        $handle = $this->pendingRegistrations->start($body['email'], $body['name'], $body['password'], $request->getLocale());

        return new JsonResponse(
            ['registration' => $handle, 'email' => EmailAddressNormaliser::normalise($body['email'])],
            Response::HTTP_ACCEPTED,
        );
    }

    /** The code proves the address, and only then is the account made and signed in. */
    #[Route('/api/auth/register/verify', name: 'auth_register_verify', methods: ['POST'])]
    public function verify(Request $request): IssuedTokensResponse
    {
        $body = Input::body($request, Type\shape([
            'registration' => Type\string(),
            'code' => Type\optional(Type\mixed()),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));
        $code = $this->codeField->required($body, 'code', CodeField::FROM_EMAIL);

        $result = $this->pendingRegistrations->verify($body['registration'], $code, $request);

        return new IssuedTokensResponse(
            $result->tokens,
            $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body,
            $request,
            ['account' => $this->accountSerialiser->serialise($result->user)],
            Response::HTTP_CREATED,
        );
    }

    #[Route('/api/auth/register/resend', name: 'auth_register_resend_cooldown', methods: ['GET'])]
    public function cooldown(Request $request): JsonResponse
    {
        $handle = Type\string()->coerce($request->query->get('registration', ''));

        $opening = $this->pendingRegistrations->opening($handle);

        return new JsonResponse(['cooldownSeconds' => $opening['cooldownSeconds'], 'codeState' => $opening['codeState']->value]);
    }

    #[Route('/api/auth/register/resend', name: 'auth_register_resend', methods: ['POST'])]
    public function resend(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['registration' => Type\string()]));
        $wait = $this->pendingRegistrations->resend($body['registration']);

        if (null !== $wait) {
            throw new ApiException(ErrorCode::TooManyAttempts, 'Wait before asking for another code.', [], null, ['Retry-After' => (string) $wait]);
        }

        return new JsonResponse(['cooldownSeconds' => VerificationChallenge::RESEND_COOLDOWN_SECONDS]);
    }

    private function limit(Request $request): void
    {
        $limit = $this->registrationLimiter->create($request->getClientIp())->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('Too many sign-ups from this network.', $limit->getRetryAfter());
        }
    }
}
