<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Verification\ContactVerifier;
use App\Domain\User\Verification\ResendCooldown;
use App\Domain\User\Verification\VerificationCodeMailer;
use App\Domain\User\Verification\VerificationCodeResender;
use App\Entity\EmailAddress;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Authenticated]
final class VerificationController
{
    public function __construct(
        private readonly Security $security,
        private readonly ContactVerifier $contactVerifier,
        private readonly VerificationCodeResender $verificationCodeResender,
        private readonly VerificationCodeMailer $verificationCodeMailer,
        private readonly ResendCooldown $resendCooldown,
    ) {
    }

    #[Route('/api/auth/verify/email', name: 'auth_verify_email', methods: ['POST'])]
    public function verifyEmail(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['code' => Type\string()]));

        $address = $this->address();

        $refusal = $this->contactVerifier->attempt($address, $body['code']);

        if (null !== $refusal) {
            throw $refusal;
        }

        return new JsonResponse([
            'id' => $address->getId()->toRfc4122(),
            'address' => $address->getAddress(),
            'verified' => $address->isVerified(),
            'primary' => $address->isPrimary(),
        ]);
    }

    /** Read when the screen opens: a cooldown started elsewhere already counting down, and a spent code shown as spent. */
    #[Route('/api/auth/verify/resend', name: 'auth_verify_resend_cooldown', methods: ['GET'])]
    public function cooldown(): JsonResponse
    {
        $address = $this->address();

        return new JsonResponse([
            'cooldownSeconds' => $this->resendCooldown->secondsLeftFor($address),
            'codeState' => $this->contactVerifier->codeState($address)->value,
        ]);
    }

    #[Route('/api/auth/verify/resend', name: 'auth_verify_resend', methods: ['POST'])]
    public function resend(): JsonResponse
    {
        $address = $this->address();

        $issued = $this->verificationCodeResender->resend($address);

        if (0 === $issued) {
            return new JsonResponse(['cooldownSeconds' => 0]);
        }

        if (\is_int($issued)) {
            throw new ApiException(
                ErrorCode::TooManyAttempts,
                'Wait before asking for another code.',
                [],
                null,
                ['Retry-After' => (string) $issued],
            );
        }

        $this->verificationCodeMailer->send($address, $issued->code);

        return new JsonResponse(['cooldownSeconds' => VerificationChallenge::RESEND_COOLDOWN_SECONDS]);
    }

    private function address(): EmailAddress
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
        }

        $address = $user->getPrimaryEmailAddress();

        if (null === $address) {
            throw ApiException::notFound('This account has no primary email address.');
        }

        return $address;
    }
}
