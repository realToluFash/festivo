<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Model\IssuedVerificationCode;
use App\Domain\User\Verification\EmailAddressVerifier;
use App\Domain\User\Verification\ResendCooldown;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeMailer;
use App\Entity\EmailAddress;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class VerificationController
{
    public function __construct(
        private readonly Security $security,
        private readonly EmailAddressVerifier $emailAddressVerifier,
        private readonly VerificationCodeIssuer $verificationCodeIssuer,
        private readonly VerificationCodeMailer $verificationCodeMailer,
        private readonly ResendCooldown $resendCooldown,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/api/auth/verify/email', name: 'auth_verify_email', methods: ['POST'])]
    public function verifyEmail(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['code' => Type\string()]));

        $address = $this->address();

        // The same lock as a resend, so codes sent at once are checked one at a time against one count.
        $refusal = $this->entityManager->wrapInTransaction(function () use ($address, $body): ?ApiException {
            $this->entityManager->lock($address, LockMode::PESSIMISTIC_WRITE);

            try {
                $this->emailAddressVerifier->verify($address, $body['code']);
                $this->entityManager->flush();
            } catch (ApiException $e) {
                return $e;
            }

            return null;
        });

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

    /** Read when the screen opens, so a cooldown started elsewhere is already counting down. */
    #[Route('/api/auth/verify/resend', name: 'auth_verify_resend_cooldown', methods: ['GET'])]
    public function cooldown(): JsonResponse
    {
        return new JsonResponse(['cooldownSeconds' => $this->resendCooldown->secondsLeftFor($this->address())]);
    }

    #[Route('/api/auth/verify/resend', name: 'auth_verify_resend', methods: ['POST'])]
    public function resend(): JsonResponse
    {
        $address = $this->address();

        if ($address->isVerified()) {
            return new JsonResponse(['cooldownSeconds' => 0]);
        }

        // Locked, so resends sent at once queue here: the first issues a code, the rest find its cooldown.
        $issued = $this->entityManager->wrapInTransaction(function () use ($address): IssuedVerificationCode|int {
            $this->entityManager->lock($address, LockMode::PESSIMISTIC_WRITE);

            $left = $this->resendCooldown->secondsLeftFor($address);

            if ($left > 0) {
                return $left;
            }

            $issued = $this->verificationCodeIssuer->issueFor($address);
            $this->entityManager->flush();

            return $issued;
        });

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
