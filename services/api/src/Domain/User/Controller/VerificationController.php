<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Verification\EmailAddressVerifier;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeMailer;
use App\Entity\EmailAddress;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Math;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

final class VerificationController
{
    public function __construct(
        private readonly Security $security,
        private readonly EmailAddressVerifier $emailAddressVerifier,
        private readonly VerificationCodeIssuer $verificationCodeIssuer,
        private readonly VerificationCodeMailer $verificationCodeMailer,
        private readonly RateLimiterFactoryInterface $verificationResendLimiter,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/api/auth/verify/email', name: 'auth_verify_email', methods: ['POST'])]
    public function verifyEmail(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['code' => Type\string()]));

        $address = $this->address();

        $this->emailAddressVerifier->verify($address, $body['code']);
        $this->entityManager->flush();

        return new JsonResponse([
            'id' => $address->getId()->toRfc4122(),
            'address' => $address->getAddress(),
            'verified' => $address->isVerified(),
            'primary' => $address->isPrimary(),
        ]);
    }

    #[Route('/api/auth/verify/resend', name: 'auth_verify_resend', methods: ['POST'])]
    public function resend(): JsonResponse
    {
        $address = $this->address();

        if ($address->isVerified()) {
            return new JsonResponse(['cooldownSeconds' => 0]);
        }

        $limit = $this->verificationResendLimiter->create($address->getAddress())->consume();

        if (!$limit->isAccepted()) {
            throw new ApiException(
                ErrorCode::TooManyAttempts,
                'Wait before asking for another code.',
                [],
                null,
                ['Retry-After' => (string) self::secondsUntil($limit->getRetryAfter())],
            );
        }

        $issued = $this->verificationCodeIssuer->issueFor($address);
        $this->entityManager->flush();

        $this->verificationCodeMailer->send($address, $issued->code);

        return new JsonResponse(['cooldownSeconds' => self::secondsUntil($limit->getRetryAfter())]);
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

    private static function secondsUntil(DateTimeImmutable $moment): int
    {
        return Math\maxva(0, $moment->getTimestamp() - new DateTimeImmutable()->getTimestamp());
    }
}
